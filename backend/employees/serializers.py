from rest_framework import serializers
from accounts.serializers import UserSerializer
from departments.serializers import DepartmentSerializer
from .models import Employee


class EmployeeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    full_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.department_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Employee
        fields = ['id', 'employee_code', 'full_name', 'email', 'department_name',
                  'designation', 'employment_status', 'basic_salary']

    def get_full_name(self, obj):
        return obj.user.full_name


class EmployeeDetailSerializer(serializers.ModelSerializer):
    """Full employee detail including user info."""
    user = UserSerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.IntegerField(write_only=True)
    qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_code', 'user', 'department', 'department_id',
            'designation', 'mobile', 'joining_date', 'employment_status',
            'basic_salary', 'profile_picture', 'created_at', 'qr_code_url'
        ]
        read_only_fields = ['id', 'employee_code', 'created_at', 'qr_code_url']

    def get_qr_code_url(self, obj):
        try:
            if obj.qr_code and obj.qr_code.qr_image:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.qr_code.qr_image.url)
                return obj.qr_code.qr_image.url
        except Exception:
            pass
        return None


class EmployeeCreateSerializer(serializers.Serializer):
    """
    Create employee + user account together.
    Admin provides basic details; system generates employee code.
    """
    # User fields
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True, min_length=8)

    # Employee fields
    department_id = serializers.IntegerField()
    designation = serializers.CharField(max_length=100)
    mobile = serializers.CharField(max_length=15)
    joining_date = serializers.DateField()
    basic_salary = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_email(self, value):
        from accounts.models import User
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value
