from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Departamento


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo', 'fecha_creacion']
    list_filter = ['activo']
    search_fields = ['nombre']


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ['email', 'nombre', 'apellido', 'rol', 'departamento', 'is_active']
    list_filter = ['rol', 'is_active', 'departamento']
    search_fields = ['email', 'nombre', 'apellido', 'ci']
    ordering = ['email']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Información Personal', {'fields': ('nombre', 'apellido', 'ci', 'telefono', 'foto')}),
        ('Rol y Departamento', {'fields': ('rol', 'departamento')}),
        ('Permisos', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nombre', 'apellido', 'rol', 'departamento', 'password1', 'password2'),
        }),
    )
