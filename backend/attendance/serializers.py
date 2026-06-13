from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = ['id', 'employee', 'employee_name', 'employee_code',
                  'attendance_date', 'check_in_time', 'check_out_time',
                  'working_hours', 'attendance_status', 'is_manual', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_employee_name(self, obj):
        return obj.employee.user.full_name

    def get_employee_code(self, obj):
        return obj.employee.employee_code
