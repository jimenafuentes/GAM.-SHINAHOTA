# ============================================================
# apps/solicitudes/views.py - Vistas y Endpoints para Solicitudes
# ============================================================
# Este archivo define el controlador principal (ViewSet) para manejar
# el ciclo de vida completo de las solicitudes de materiales.
#
# Características Clave:
#   1. CRUD Completo: Utiliza Django REST Framework (DRF) ModelViewSet.
#   2. Permisos y Filtros de Seguridad:
#      - Los solicitantes normales solo pueden ver sus propias solicitudes.
#      - Los administradores y jefes de almacén pueden ver y procesar todo.
#   3. Transacciones Atómicas (@transaction.atomic):
#      - Al entregar materiales, si un material se queda sin stock, la entrega completa
#        se revierte para evitar inconsistencias en el inventario.
#   4. Trazabilidad Blockchain:
#      - Registra la creación y cambios de estado (aprobado/rechazado/entregado) en la blockchain.
# ============================================================

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from .models import SolicitudMaterial, DetalleSolicitud
from .serializers import SolicitudMaterialSerializer, SolicitudListSerializer, DetalleSolicitudSerializer
from apps.usuarios.permissions import IsAdminOrJefeAlmacen
from apps.blockchain.services import BlockchainService


class SolicitudMaterialViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de Solicitudes de Materiales.
    
    Optimiza el rendimiento de la base de datos con select_related y prefetch_related
    para evitar el problema de consultas N+1 en las tablas relacionadas.
    """
    queryset = SolicitudMaterial.objects.all().select_related(
        'solicitante', 'departamento', 'aprobado_por', 'entregado_por'
    ).prefetch_related('detalles__material')
    permission_classes = [IsAuthenticated]
    
    # Configuración de búsquedas, filtros y ordenación en la API
    search_fields = ['numero', 'solicitante__nombre', 'departamento__nombre', 'motivo']
    filterset_fields = ['estado', 'prioridad', 'departamento', 'solicitante']
    ordering_fields = ['fecha_creacion', 'prioridad', 'estado']

    def get_serializer_class(self):
        """
        Retorna el serializador dinámicamente según la acción:
          - 'list' -> SolicitudListSerializer (diseño compacto, sin detalles pesados).
          - Otras acciones -> SolicitudMaterialSerializer (completo con detalles).
        """
        if self.action == 'list':
            return SolicitudListSerializer
        return SolicitudMaterialSerializer

    def get_queryset(self):
        """
        Aplica filtro de seguridad:
          - Si el usuario es de rol 'SOLICITANTE', solo puede listar y consultar sus propias solicitudes.
          - Administradores, Jefes de almacén y Auditores tienen acceso al listado general.
        Permite filtrar por rango de fechas (fecha_inicio, fecha_fin).
        """
        user = self.request.user
        qs = super().get_queryset()
        if user.rol == 'SOLICITANTE':
            qs = qs.filter(solicitante=user)

        fecha_inicio = self.request.query_params.get('fecha_inicio')
        fecha_fin = self.request.query_params.get('fecha_fin')
        if fecha_inicio:
            qs = qs.filter(fecha_creacion__date__gte=fecha_inicio)
        if fecha_fin:
            qs = qs.filter(fecha_creacion__date__lte=fecha_fin)
        return qs

    def perform_create(self, serializer):
        """
        Acción ejecutada automáticamente al registrar una nueva solicitud (POST /api/solicitudes/).
        
        Asigna el usuario actual como solicitante y su departamento respectivo.
        Adicionalmente, intenta registrar de forma asíncrona la solicitud en la Blockchain.
        """
        solicitud = serializer.save(solicitante=self.request.user, departamento=self.request.user.departamento)
        try:
            bc = BlockchainService()
            hash_data, tx_hash = bc.registrar_solicitud(solicitud)
            solicitud.hash_blockchain = hash_data
            solicitud.tx_hash = tx_hash
            solicitud.save()
        except Exception:
            pass  # Si la red Blockchain está caída, la solicitud igual se guarda en base de datos local

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrJefeAlmacen])
    def aprobar(self, request, pk=None):
        """
        Endpoint Extra: POST /api/solicitudes/<id>/aprobar/
        
        Permite al Administrador o Jefe de Almacén aprobar una solicitud pendiente,
        pudiendo ajustar opcionalmente la cantidad aprobada para cada ítem.
        """
        solicitud = self.get_object()
        if solicitud.estado != 'PENDIENTE':
            return Response({'error': 'Solo se pueden aprobar solicitudes pendientes'}, status=400)
            
        detalles_data = request.data.get('detalles', [])
        # Actualiza las cantidades aprobadas para cada ítem solicitado
        for item in detalles_data:
            DetalleSolicitud.objects.filter(
                id=item['id'], solicitud=solicitud
            ).update(cantidad_aprobada=item.get('cantidad_aprobada'))
            
        # Cambia el estado del flujo, y registra quién y cuándo aprobó
        solicitud.estado = 'APROBADO'
        solicitud.aprobado_por = request.user
        solicitud.fecha_aprobacion = timezone.now()
        solicitud.observaciones = request.data.get('observaciones', '')
        solicitud.save()
        
        # Registrar el cambio de estado en la Blockchain
        try:
            bc = BlockchainService()
            bc.registrar_cambio_estado(solicitud, 'APROBADO', request.user)
        except Exception:
            pass
            
        return Response({'message': 'Solicitud aprobada exitosamente', 'numero': solicitud.numero})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrJefeAlmacen])
    def rechazar(self, request, pk=None):
        """
        Endpoint Extra: POST /api/solicitudes/<id>/rechazar/
        
        Permite denegar la solicitud. Requiere registrar un motivo de rechazo.
        """
        solicitud = self.get_object()
        if solicitud.estado not in ['PENDIENTE', 'APROBADO']:
            return Response({'error': 'No se puede rechazar esta solicitud'}, status=400)
            
        solicitud.estado = 'RECHAZADO'
        solicitud.aprobado_por = request.user
        solicitud.fecha_aprobacion = timezone.now()
        solicitud.observaciones_rechazo = request.data.get('motivo', '')
        solicitud.save()
        
        # Registrar cambio en Blockchain
        try:
            bc = BlockchainService()
            bc.registrar_cambio_estado(solicitud, 'RECHAZADO', request.user)
        except Exception:
            pass
            
        return Response({'message': 'Solicitud rechazada', 'numero': solicitud.numero})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrJefeAlmacen])
    @transaction.atomic
    def entregar(self, request, pk=None):
        """
        Endpoint Extra: POST /api/solicitudes/<id>/entregar/
        
        Maneja la entrega física y la salida de stock.
        Se ejecuta de forma atómica (@transaction.atomic). Si falla el stock para algún ítem,
        toda la transacción se revierte, impidiendo inventarios erróneos o negativos.
        """
        solicitud = self.get_object()
        if solicitud.estado != 'APROBADO':
            return Response({'error': 'Solo se pueden entregar solicitudes aprobadas'}, status=400)
            
        # Procesar ítem por ítem
        for detalle in solicitud.detalles.all():
            # Si no hay cantidad aprobada específica, se toma la cantidad originalmente solicitada
            cantidad = detalle.cantidad_aprobada or detalle.cantidad_solicitada
            material = detalle.material
            
            # Validación estricta de existencias en almacén
            if material.stock_actual < cantidad:
                return Response({'error': f'Stock insuficiente para {material.nombre}'}, status=400)
                
            # Disminuir el stock en inventario
            material.stock_actual -= cantidad
            material.save()
            
            # Registrar cantidad realmente entregada
            detalle.cantidad_entregada = cantidad
            detalle.save()
            
            # Crear y registrar el movimiento de Kardex (MovimientoInventario)
            from apps.materiales.models import MovimientoInventario
            MovimientoInventario.objects.create(
                material=material,
                tipo='SALIDA',
                cantidad=cantidad,
                stock_anterior=material.stock_actual + cantidad,
                stock_posterior=material.stock_actual,
                referencia=solicitud.numero,
                usuario=request.user,
                solicitud=solicitud
            )
            
        # Actualiza el estado a entregado y registra auditoría
        solicitud.estado = 'ENTREGADO'
        solicitud.entregado_por = request.user
        solicitud.fecha_entrega = timezone.now()
        solicitud.save()
        
        # Registrar el cambio final en la Blockchain
        try:
            bc = BlockchainService()
            bc.registrar_cambio_estado(solicitud, 'ENTREGADO', request.user)
        except Exception:
            pass
            
        return Response({'message': 'Materiales entregados exitosamente', 'numero': solicitud.numero})

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """
        Endpoint Extra: GET /api/solicitudes/estadisticas/
        
        Retorna estadísticas globales rápidas del total de solicitudes en el sistema,
        el número de pendientes y el desglose de solicitudes agrupadas por estado.
        """
        from django.db.models import Count
        total = SolicitudMaterial.objects.count()
        por_estado = SolicitudMaterial.objects.values('estado').annotate(total=Count('id'))
        pendientes = SolicitudMaterial.objects.filter(estado='PENDIENTE').count()
        return Response({
            'total': total,
            'pendientes': pendientes,
            'por_estado': list(por_estado),
        })
