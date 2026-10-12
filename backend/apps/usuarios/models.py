# ============================================================
# apps/usuarios/models.py - Modelos de Usuarios y Departamentos
# ============================================================
# Este archivo define el sistema de autenticación personalizado del proyecto.
#
# Django viene con un modelo de Usuario por defecto, pero aquí se
# reemplaza completamente para usar EMAIL como identificador (en lugar
# de username) y agregar campos personalizados como rol, CI, etc.
#
# Tablas que crea este archivo:
#   - departamentos → las áreas/dependencias de la Alcaldía
#   - usuarios      → los usuarios del sistema con sus roles
#
# Roles del sistema:
#   ADMIN         → acceso total, puede crear usuarios y administrar todo
#   JEFE_ALMACEN  → gestiona materiales, activos y puede aprobar solicitudes
#   SOLICITANTE   → solo puede crear y ver sus propias solicitudes
#   AUDITOR       → solo lectura, puede ver reportes y registros blockchain
# ============================================================

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models


class Departamento(models.Model):
    """
    Representa una dependencia o área de la Alcaldía de Shinahota.

    Los departamentos se usan para:
      - Asignar usuarios a un área específica
      - Vincular activos fijos a un departamento
      - Agrupar solicitudes por dependencia
    """
    nombre = models.CharField(max_length=100)       # Nombre del departamento (ej: "Administración")
    descripcion = models.TextField(blank=True)        # Descripción opcional del departamento
    activo = models.BooleanField(default=True)        # False = departamento inactivo (borrado lógico)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'departamentos'
        verbose_name = 'Departamento'
        verbose_name_plural = 'Departamentos'

    def __str__(self):
        return self.nombre


class UsuarioManager(BaseUserManager):
    """
    Manager personalizado para el modelo Usuario.

    BaseUserManager provee utilidades para crear usuarios.
    Se sobreescribe para manejar email en lugar de username.

    Este Manager lo usa Django internamente cuando llamas:
      Usuario.objects.create_user(...)
      Usuario.objects.create_superuser(...)
    """

    def create_user(self, email, password=None, **extra_fields):
        """
        Crea y guarda un usuario normal.

        normalize_email() convierte el email a minúsculas en el dominio
        (ej: "JUAN@Gmail.Com" → "JUAN@gmail.com")

        set_password() hashea la contraseña antes de guardarla
        (NUNCA se guarda la contraseña en texto plano).
        """
        if not email:
            raise ValueError('El email es requerido')
        email = self.normalize_email(email)   # Normaliza el email
        user = self.model(email=email, **extra_fields)
        user.set_password(password)           # Hashea la contraseña con bcrypt
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Crea un superusuario (admin total del sistema).
        Se usa principalmente para crear el primer usuario administrador.
        Se llama con: python manage.py createsuperuser
        """
        extra_fields.setdefault('is_staff', True)       # Puede acceder al admin de Django
        extra_fields.setdefault('is_superuser', True)   # Tiene todos los permisos de Django
        extra_fields.setdefault('rol', 'ADMIN')          # Rol del sistema: ADMIN
        return self.create_user(email, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    Modelo de usuario personalizado del Sistema WEG.

    Hereda de:
      - AbstractBaseUser: provee autenticación (password, last_login, etc.)
      - PermissionsMixin: provee sistema de permisos de Django

    El identificador único es el EMAIL (no el username típico de Django).
    USERNAME_FIELD = 'email' le dice a Django que use email para login.

    Roles disponibles:
      ADMIN        → control total del sistema
      JEFE_ALMACEN → gestión de inventario y aprobaciones
      SOLICITANTE  → solo puede pedir materiales
      AUDITOR      → solo lectura para revisión y auditoría
    """

    ROLES = [
        ('ADMIN', 'Administrador'),
        ('SOLICITANTE', 'Solicitante'),
        ('AUDITOR', 'Auditor'),
    ]

    email = models.EmailField(unique=True)     # Login identifier (único en el sistema)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)

    # CI = Cédula de Identidad (documento boliviano)
    ci = models.CharField(max_length=20, unique=True, blank=True, null=True, verbose_name='Cédula de Identidad')
    telefono = models.CharField(max_length=20, blank=True)
    cargo = models.CharField(max_length=100, blank=True, default='', verbose_name='Cargo / Puesto')

    # Rol del usuario en el sistema (determina qué puede hacer)
    rol = models.CharField(max_length=20, choices=ROLES, default='SOLICITANTE')

    # Departamento al que pertenece el usuario (puede ser null si aún no tiene)
    departamento = models.ForeignKey(
        Departamento, on_delete=models.SET_NULL, null=True, blank=True, related_name='usuarios'
    )

    # Foto de perfil (se guarda en media/usuarios/)
    foto = models.ImageField(upload_to='usuarios/', null=True, blank=True)

    # Campos requeridos por Django para el sistema de autenticación
    is_active = models.BooleanField(default=True)   # False = usuario deshabilitado
    is_staff = models.BooleanField(default=False)    # True = puede acceder al admin de Django

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    # Indica a Django que use nuestro UsuarioManager personalizado
    objects = UsuarioManager()

    # Django usará el email como campo de login (en lugar del username)
    USERNAME_FIELD = 'email'

    # Campos adicionales requeridos al crear superusuario por consola
    REQUIRED_FIELDS = ['nombre', 'apellido']

    class Meta:
        db_table = 'usuarios'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f"{self.nombre} {self.apellido} ({self.email})"

    @property
    def nombre_completo(self):
        """
        Propiedad calculada: concatena nombre y apellido.
        Se accede como: usuario.nombre_completo
        Lo usan los serializers para mostrar el nombre en las respuestas JSON.
        """
        return f"{self.nombre} {self.apellido}"
