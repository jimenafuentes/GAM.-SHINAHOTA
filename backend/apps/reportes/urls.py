# ============================================================
# apps/reportes/urls.py - Configuración de Rutas para Reportes
# ============================================================
# Este archivo define las rutas API específicas para la generación
# de reportes y las estadísticas consolidadas del sistema (Dashboard).
#
# Endpoints expuestos:
#   - GET /api/reportes/dashboard/   -> Datos consolidados para widgets visuales.
#   - GET /api/reportes/movimientos/ -> Historial de movimientos de inventario con filtros de fechas.
# ============================================================

from django.urls import path
from .views import DashboardView, ReporteMovimientosView

urlpatterns = [
    # Mapea la ruta del Dashboard a su vista basada en clases (APIView)
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    
    # Mapea la ruta del reporte detallado de Kardex / Movimientos
    path('movimientos/', ReporteMovimientosView.as_view(), name='reporte-movimientos'),
]
