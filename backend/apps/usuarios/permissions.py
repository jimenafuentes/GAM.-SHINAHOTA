# ============================================================
# apps/usuarios/permissions.py - Permisos Personalizados del Sistema
# ============================================================
# Este archivo define las reglas de control de acceso (autorización).
#
# ¿Diferencia entre autenticación y autorización?
#   - Autenticación: ¿quién eres? (login con email/contraseña)
#   - Autorización: ¿qué puedes hacer? (según tu rol)
#
# Django REST Framework usa "Permission Classes" para autorización.
# Cada clase define el método has_permission() que retorna True/False.
# Si retorna False, la API responde con HTTP 403 Forbidden.
#
# Roles en el sistema (de mayor a menor privilegio):
#   ADMIN → JEFE_ALMACEN → SOLICITANTE → AUDITOR
#
# Uso en vistas:
#   permission_classes = [IsAdmin]                      → solo ADMIN
#   permission_classes = [IsAdminOrJefeAlmacen]         → ADMIN o JEFE_ALMACEN
#   permission_classes = [IsAdminOrJefeAlmacenOrAuditor]→ los 3 roles superiores
#   permission_classes = [IsAuthenticated]              → cualquier usuario logueado
# ============================================================

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Permiso: solo permite acceso a usuarios con rol 'ADMIN'.

    Se usa en endpoints críticos como:
      - Crear/editar/borrar usuarios
      - Modificar configuraciones del sistema
    """
    def has_permission(self, request, view):
        # request.user.is_authenticated verifica que hay sesión activa
        # request.user.rol == 'ADMIN' verifica el rol específico
        return request.user.is_authenticated and request.user.rol == 'ADMIN'


class IsAdminOrJefeAlmacen(BasePermission):
    """
    Permiso: permite acceso a 'ADMIN' y 'JEFE_ALMACEN'.

    Se usa en endpoints de gestión operativa como:
      - Crear/editar activos fijos
      - Crear/editar materiales e inventario
      - Aprobar/rechazar/entregar solicitudes
      - Crear asignaciones de activos
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol in ['ADMIN', 'JEFE_ALMACEN']


class IsAdminOrJefeAlmacenOrAuditor(BasePermission):
    """
    Permiso: permite acceso a 'ADMIN', 'JEFE_ALMACEN' y 'AUDITOR'.

    El AUDITOR tiene acceso de solo lectura a registros blockchain
    para fines de revisión y auditoría del sistema.

    Se usa en: blockchain/views.py (lectura de registros blockchain)
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol in ['ADMIN', 'JEFE_ALMACEN', 'AUDITOR']
