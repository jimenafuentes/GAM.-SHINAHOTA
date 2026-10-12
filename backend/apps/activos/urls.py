# ============================================================
# apps/activos/urls.py - Rutas URL para la app de Activos Fijos
# ============================================================
# Este archivo mapea las URLs del módulo de activos a sus ViewSets.
#
# Usa DefaultRouter de DRF que genera automáticamente las URLs
# estándar REST (list, create, retrieve, update, destroy, etc.)
# más las acciones personalizadas (@action).
#
# URLs generadas automáticamente:
#   GET    /api/activos/items/                → lista activos
#   POST   /api/activos/items/                → crear activo
#   GET    /api/activos/items/{id}/           → detalle activo
#   PUT    /api/activos/items/{id}/           → reemplazar activo
#   PATCH  /api/activos/items/{id}/           → editar parcial activo
#   DELETE /api/activos/items/{id}/           → eliminar activo
#   GET    /api/activos/items/estadisticas/   → estadísticas (@action)
#   POST   /api/activos/items/{id}/dar_baja/  → dar de baja (@action)
#   GET    /api/activos/asignaciones/         → lista asignaciones
#   POST   /api/activos/asignaciones/         → crear asignación
#   ... (idem para asignaciones)
#
# El prefijo /api/activos/ viene de config/urls.py donde se incluye este archivo.
# ============================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivoFijoViewSet, AsignacionActivoViewSet

# DefaultRouter crea automáticamente todas las rutas CRUD estándar
router = DefaultRouter()

# Registra el ViewSet de activos bajo el prefijo 'items'
# basename='activos' se usa para generar los nombres de las URLs (ej: activos-list)
router.register('items', ActivoFijoViewSet, basename='activos')

# Registra el ViewSet de asignaciones bajo el prefijo 'asignaciones'
router.register('asignaciones', AsignacionActivoViewSet, basename='asignaciones')

# Incluye todas las rutas generadas por el router
urlpatterns = [path('', include(router.urls))]
