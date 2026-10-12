# ============================================================
# apps/reportes/views.py - Vistas para Reportes y Tablero de Control
# ============================================================
# Este archivo define la lógica de negocio para generar informes y
# estadísticas del sistema de control patrimonial de la Alcaldía de Shinahota.
#
# Contiene dos vistas principales:
#   1. DashboardView: Consolida métricas clave sobre materiales bajo stock,
#      estado físico de activos, volumen de solicitudes y actividad en la Blockchain.
#   2. ReporteMovimientosView: Permite filtrar e imprimir el historial de
#      Kardex (entradas y salidas de inventario) en un rango de fechas.
# ============================================================

from rest_framework import views, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
from apps.materiales.models import Material, MovimientoInventario
from apps.activos.models import ActivoFijo
from apps.solicitudes.models import SolicitudMaterial
from apps.blockchain.models import RegistroBlockchain
from django.db import models  # Importado al inicio para su uso en expresiones F


class DashboardView(views.APIView):
    """
    Vista del Tablero de Control Principal (Dashboard).
    
    Procesa de forma agregada la información de todos los módulos para alimentar
    los gráficos e indicadores del panel de control del usuario administrador y jefe.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Retorna estadísticas agregadas en tiempo real.
        """
        hoy = timezone.now()
        hace_30_dias = hoy - timedelta(days=30)

        # ----------------- SECCIÓN: MATERIALES -----------------
        # Cuenta el número total de materiales vigentes/activos
        total_materiales = Material.objects.filter(activo=True).count()
        
        # Identifica materiales cuya cantidad actual es menor o igual al stock mínimo configurado
        # Usamos F() para comparar dinámicamente dos columnas de la misma fila en la BD
        materiales_bajo_stock = Material.objects.filter(
            activo=True, stock_actual__lte=models.F('stock_minimo')
        ).count()

        # ------------------ SECCIÓN: ACTIVOS ------------------
        # Total de activos fijos que no han sido dados de baja (para usuarios normales: solo sus activos a cargo)
        if request.user.rol not in ['ADMIN', 'JEFE_ALMACEN']:
            activos_qs = ActivoFijo.objects.filter(activo=True, responsable=request.user)
        else:
            activos_qs = ActivoFijo.objects.filter(activo=True)
        total_activos = activos_qs.count()
        activos_buenos = activos_qs.filter(estado='BUENO').count()

        # ----------------- SECCIÓN: SOLICITUDES -----------------
        # Estadísticas del flujo de solicitudes (para usuarios normales: solo sus solicitudes)
        if request.user.rol not in ['ADMIN', 'JEFE_ALMACEN']:
            solicitudes_base = SolicitudMaterial.objects.filter(solicitante=request.user)
        else:
            solicitudes_base = SolicitudMaterial.objects.all()

        total_solicitudes = solicitudes_base.count()
        solicitudes_pendientes = solicitudes_base.filter(estado='PENDIENTE').count()
        solicitudes_mes = solicitudes_base.filter(fecha_creacion__gte=hace_30_dias).count()

        # ------------------ SECCIÓN: BLOCKCHAIN ------------------
        # Registros locales de transacciones realizadas en la Blockchain
        total_registros_bc = RegistroBlockchain.objects.count()
        registros_bc_mes = RegistroBlockchain.objects.filter(fecha__gte=hace_30_dias).count()

        # ---------- SECCIÓN: MOVIMIENTOS ÚLTIMOS 7 DÍAS ---------
        # Estructura datos históricos diarios para un gráfico de líneas o barras
        movimientos_por_dia = []
        for i in range(7):
            dia = hoy - timedelta(days=i)
            # Cuenta cuántos movimientos de inventario ocurrieron en esta fecha específica
            count = MovimientoInventario.objects.filter(
                fecha__date=dia.date()
            ).count()
            movimientos_por_dia.append({
                'dia': dia.strftime('%d/%m'),
                'movimientos': count
            })

        # -------------- SOLICITUDES AGRUPADAS POR ESTADO -------------
        # Agrupa solicitudes por su estado actual y cuenta cuántas hay de cada uno
        solicitudes_por_estado = list(
            SolicitudMaterial.objects.values('estado').annotate(total=Count('id'))
        )

        # Respuesta consolidada en formato JSON jerárquico
        return Response({
            'materiales': {
                'total': total_materiales,
                'bajo_stock': materiales_bajo_stock,
            },
            'activos': {
                'total': total_activos,
                'en_buen_estado': activos_buenos,
            },
            'solicitudes': {
                'total': total_solicitudes,
                'pendientes': solicitudes_pendientes,
                'ultimo_mes': solicitudes_mes,
                'por_estado': solicitudes_por_estado,
            },
            'blockchain': {
                'total_registros': total_registros_bc,
                'ultimo_mes': registros_bc_mes,
            },
            # Invierte la lista para que aparezca en orden cronológico ascendente (de más antiguo a más reciente)
            'movimientos_ultimos_7_dias': list(reversed(movimientos_por_dia)),
        })


class ReporteMovimientosView(views.APIView):
    """
    Vista para el Reporte Detallado de Kardex.
    
    Genera el listado plano de todos los movimientos de entrada y salida de materiales,
    permitiendo filtrar opcionalmente por rango de fechas mediante parámetros query de la URL.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Retorna la lista de movimientos serializados con base en los filtros provistos.
        """
        from apps.materiales.serializers import MovimientoInventarioSerializer
        
        # Captura de parámetros query en la URL (ej. ?fecha_inicio=2026-01-01&fecha_fin=2026-02-01)
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        
        # select_related() carga en un solo JOIN las tablas de material y usuario responsable
        qs = MovimientoInventario.objects.all().select_related('material', 'usuario')
        
        # Aplicación de filtros según corresponda
        if fecha_inicio:
            qs = qs.filter(fecha__date__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha__date__lte=fecha_fin)
            
        # Limitamos la respuesta a los primeros 500 registros para evitar sobrecarga en consultas masivas
        serializer = MovimientoInventarioSerializer(qs[:500], many=True)
        return Response(serializer.data)
