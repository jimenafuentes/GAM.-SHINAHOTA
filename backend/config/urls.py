# ============================================================
# config/urls.py - Enrutador Principal del Proyecto Django
# ============================================================
# Este archivo define la estructura de enrutamiento principal para
# todo el backend del Sistema WEG. Mapea y distribuye las peticiones
# HTTP entrantes hacia las diferentes aplicaciones internas y servicios.
#
# Secciones configuradas:
#   1. Panel Administrativo Django (django-admin).
#   2. Documentación interactiva de la API con Swagger y ReDoc.
#   3. Módulo de Autenticación de Usuarios (JWT).
#   4. Enrutamiento hacia los módulos: Materiales, Activos, Solicitudes,
#      Blockchain y Reportes.
#   5. Archivos multimedia estáticos (imágenes de activos, etc.).
# ============================================================

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions

# Configuración de drf-yasg para la auto-generación de documentación de API Swagger
schema_view = get_schema_view(
    openapi.Info(
        title="Sistema WEB API - Alcaldía de Shinahota",
        default_version='v1',
        description="API REST para el Sistema de Gestión de Control y Solicitudes de Material",
        contact=openapi.Contact(email="admin@shinahota.bo"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    # Panel de administración interno de Django para desarrolladores/superusuarios
    path('admin/', admin.site.urls),

    # Endpoints para la documentación de API interactiva en formato Swagger y ReDoc
    path('api/docs/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('api/redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),

    # Rutas para el flujo de Autenticación mediante JSON Web Tokens (JWT)
    path('api/auth/', include('apps.usuarios.urls')),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Rutas de los módulos de la aplicación
    path('api/materiales/', include('apps.materiales.urls')),
    path('api/activos/', include('apps.activos.urls')),
    path('api/solicitudes/', include('apps.solicitudes.urls')),
    path('api/blockchain/', include('apps.blockchain.urls')),
    path('api/reportes/', include('apps.reportes.urls')),
    
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) # Permite servir imágenes subidas en desarrollo
