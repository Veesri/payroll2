"""Payslip views — generate PDF, serve securely, send email."""
import os
from pathlib import Path
from django.conf import settings
from django.http import FileResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdmin, IsAdminOrOwner
from payroll.models import Payroll
from .models import Payslip
from .pdf_engine import generate_payslip_pdf
from .serializers import PayslipSerializer


class PayslipViewSet(viewsets.ReadOnlyModelViewSet):
    """Payslip management — Admin generates. Employee views own."""
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Payslip.objects.select_related('payroll__employee__user')
        if user.role == 'admin':
            return qs.all()
        return qs.filter(payroll__employee__user=user)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin])
    def generate(self, request):
        """Generate payslips for all processed payrolls for a month/year."""
        month = request.data.get('month')
        year = request.data.get('year')

        payrolls = Payroll.objects.filter(
            month=month, year=year,
            status=Payroll.STATUS_PROCESSED,
        ).exclude(payslip__isnull=False)

        results = []
        for payroll in payrolls:
            try:
                filename = generate_payslip_pdf(payroll)
                payslip_number = Payslip.generate_payslip_number(
                    payroll.employee, payroll.month, payroll.year
                )
                payslip = Payslip.objects.create(
                    payroll=payroll,
                    payslip_number=payslip_number,
                    pdf_filename=filename,
                )
                results.append({'payslip_number': payslip_number, 'status': 'success'})
            except Exception:
                results.append({'employee': payroll.employee.employee_code, 'status': 'failed'})

        from audit_logs.models import AuditLog
        AuditLog.log(request.user, AuditLog.ACTION_PAYSLIP,
                     f"Generated payslips for {month}/{year}", request)

        return Response({'results': results})

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Serve payslip PDF securely with Content-Disposition: attachment."""
        payslip = self.get_object()

        # Object-level permission: employee can only download own payslip
        if request.user.role != 'admin':
            if payslip.payroll.employee.user != request.user:
                return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        pdf_path = Path(settings.PAYSLIP_ROOT) / payslip.pdf_filename

        if not pdf_path.exists():
            return Response({'detail': 'Payslip file not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Serve with secure headers — forces download, prevents execution
        response = FileResponse(
            open(pdf_path, 'rb'),
            content_type='application/pdf',
        )
        response['Content-Disposition'] = f'attachment; filename="{payslip.payslip_number}.pdf"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin])
    def send_email(self, request, pk=None):
        """Send payslip to employee via email."""
        from notifications.email_service import send_payslip_email
        payslip = self.get_object()
        success = send_payslip_email(payslip.payroll.employee, payslip)
        if success:
            return Response({'detail': 'Email sent successfully.'})
        return Response({'detail': 'Failed to send email.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin])
    def send_bulk_emails(self, request):
        """Send all payslip emails for a month/year."""
        from notifications.email_service import send_bulk_payslip_emails
        month = request.data.get('month')
        year = request.data.get('year')
        result = send_bulk_payslip_emails(month, year)
        return Response(result)
