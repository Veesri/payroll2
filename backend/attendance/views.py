"""Attendance views — Admin Scanner endpoint, manual attendance, reports."""
import json
import hmac
import hashlib
from datetime import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

from accounts.permissions import IsAdmin
from employees.models import Employee, EmployeeQR
from settings_app.models import CompanySettings
from .models import Attendance
from audit_logs.models import AuditLog


class QRScanView(APIView):
    """Admin scans Employee QR code to check in/out."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        qr_data_str = request.data.get('qr_data')
        if not qr_data_str:
            return Response({'detail': 'QR data is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse JSON
        try:
            qr_data = json.loads(qr_data_str)
        except json.JSONDecodeError:
            return Response({'detail': 'Invalid QR format.'}, status=status.HTTP_400_BAD_REQUEST)

        emp_id = qr_data.get('employee_id')
        emp_code = qr_data.get('employee_code')
        qr_uuid = qr_data.get('uuid')
        provided_signature = qr_data.get('signature')

        if not all([emp_id, emp_code, qr_uuid, provided_signature]):
            return Response({'detail': 'Missing data in QR code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Recompute signature
        # We need to recreate the exact json string without signature
        verification_data = {
            "employee_id": emp_id,
            "employee_code": emp_code,
            "uuid": qr_uuid
        }
        qr_json = json.dumps(verification_data, separators=(',', ':'))
        secret = settings.SECRET_KEY.encode('utf-8')
        expected_signature = hmac.new(secret, qr_json.encode('utf-8'), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_signature, provided_signature):
            AuditLog.log(request.user, "QR_SCAN_REJECT", f"Invalid QR signature for {emp_code}", request)
            return Response({'detail': 'Invalid or tampered QR code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.select_related('user').get(id=emp_id, employee_code=emp_code)
            emp_qr = EmployeeQR.objects.get(employee=employee, qr_id=qr_uuid)
        except (Employee.DoesNotExist, EmployeeQR.DoesNotExist):
            return Response({'detail': 'Employee or QR record not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Get settings
        comp_settings = CompanySettings.get_settings()
        office_start = comp_settings.work_start_time
        grace = comp_settings.grace_minutes
        min_hours = float(comp_settings.minimum_working_hours)
        half_day_hours = float(comp_settings.half_day_hours)

        today = timezone.localdate()
        now_time = timezone.localtime().time()

        attendance, created = Attendance.objects.get_or_create(
            employee=employee,
            attendance_date=today,
            defaults={'check_in_time': now_time}
        )

        if not created:
            # Check-Out Logic
            if attendance.check_out_time:
                AuditLog.log(request.user, "QR_SCAN_REJECT", f"Already checked out: {emp_code}", request)
                return Response({'detail': 'Attendance Already Completed For Today.'}, status=status.HTTP_400_BAD_REQUEST)
            
            attendance.check_out_time = now_time
            
            # Calculate hours
            t1 = datetime.combine(today, attendance.check_in_time)
            t2 = datetime.combine(today, now_time)
            diff = t2 - t1
            hours = diff.total_seconds() / 3600.0
            attendance.working_hours = hours
            
            # Update status based on hours
            if hours < half_day_hours:
                attendance.attendance_status = Attendance.STATUS_HALF_DAY
            elif hours >= min_hours:
                attendance.attendance_status = Attendance.STATUS_PRESENT
            else:
                # between half day and full day, usually half day
                attendance.attendance_status = Attendance.STATUS_HALF_DAY
                
            attendance.save()
            
            AuditLog.log(request.user, "QR_CHECK_OUT", f"Check-Out {emp_code} at {now_time}", request)
            return Response({
                'detail': 'Checkout Recorded Successfully.',
                'employee_name': employee.user.full_name,
                'employee_code': employee.employee_code,
                'out_time': str(now_time),
                'working_hours': f"{hours:.2f}"
            })

        # New Check-In Logic
        # Check if late
        late_threshold = datetime.combine(today, office_start)
        from datetime import timedelta
        late_threshold += timedelta(minutes=grace)
        current_dt = datetime.combine(today, now_time)

        if current_dt > late_threshold:
            attendance.attendance_status = Attendance.STATUS_LATE
        else:
            attendance.attendance_status = Attendance.STATUS_PRESENT
        attendance.save()

        AuditLog.log(request.user, "QR_CHECK_IN", f"Check-In {emp_code} at {now_time}", request)
        return Response({
            'detail': 'Attendance Recorded Successfully.',
            'employee_name': employee.user.full_name,
            'employee_code': employee.employee_code,
            'in_time': str(now_time)
        })


class AttendanceViewSet(viewsets.ModelViewSet):
    """Admin: view/manage all attendance. Employee: view own."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Attendance.objects.select_related('employee__user')
        if user.role == 'admin':
            emp_id = self.request.query_params.get('employee_id')
            month = self.request.query_params.get('month')
            year = self.request.query_params.get('year')
            if emp_id:
                qs = qs.filter(employee_id=emp_id)
            if month:
                qs = qs.filter(attendance_date__month=month)
            if year:
                qs = qs.filter(attendance_date__year=year)
            return qs
        return qs.filter(employee__user=user)

    def get_serializer_class(self):
        from .serializers import AttendanceSerializer
        return AttendanceSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]
