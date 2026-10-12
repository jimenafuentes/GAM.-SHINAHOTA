# ============================================================
# apps/solicitudes/urls.py - Configuración de Rutas para Solicitudes
# ============================================================
# Este archivo define los mappings de URLs de la API para las
# solicitudes de materiales usando el enrutador automático de DRF.
#
# Genera de manera automática los siguientes endpoints principales:
#   - GET  /api/solicitudes/           -> Listado de solicitudes.
#   - POST /api/solicitudes/          -> Registro de una nueva solicitud.
#   - GET  /api/solicitudes/<id>/      -> Detalle de una solicitud específica.
#   - PUT/PATCH /api/solicitudes/<id>/ -> Modificación de una solicitud.
#   - DELETE /api/solicitudes/<id>/    -> Eliminación de una solicitud.
# ============================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SolicitudMaterialViewSet

# Instanciamos el router por defecto para registrar el ViewSet
router = DefaultRouter()

# Registramos el ViewSet de Solicitudes. Dado que se incluye en el urls.py principal
# bajo el prefijo 'api/solicitudes/', este enrutador manejará la raíz del módulo.
router.register('', SolicitudMaterialViewSet, basename='solicitudes')

# Se incluyen los patrones de URL autogenerados por el enrutador
urlpatterns = [
    path('', include(router.urls))
]
