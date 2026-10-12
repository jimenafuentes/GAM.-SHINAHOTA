# ============================================================
# apps/materiales/urls.py - Configuración de Rutas para Materiales
# ============================================================
# Este archivo define la estructura de endpoints REST para el módulo
# de materiales e inventarios de la Alcaldía de Shinahota.
#
# Genera las siguientes rutas CRUD automáticas mediante DefaultRouter:
#   - /api/materiales/categorias/  -> Gestión de categorías.
#   - /api/materiales/proveedores/ -> Gestión de proveedores.
#   - /api/materiales/items/       -> Gestión de fichas de materiales de almacén.
#   - /api/materiales/movimientos/ -> Historial de movimientos (Kardex).
# ============================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProveedorViewSet, MaterialViewSet, MovimientoInventarioViewSet

# Instancia del enrutador automático de Django REST Framework
router = DefaultRouter()

# Registro de los ViewSets del módulo de Materiales
router.register('categorias', CategoriaViewSet, basename='categorias')
router.register('proveedores', ProveedorViewSet, basename='proveedores')
router.register('items', MaterialViewSet, basename='materiales')
router.register('movimientos', MovimientoInventarioViewSet, basename='movimientos')

# Se exponen los patrones de URL autogenerados
urlpatterns = [
    path('', include(router.urls)),
]
