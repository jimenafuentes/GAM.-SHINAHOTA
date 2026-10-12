# ============================================================
# apps/activos/views.py - Vistas (endpoints API) para Activos Fijos
# ============================================================
# Este archivo define los endpoints REST que el frontend consume.
# Usa Django REST Framework (DRF) con ViewSets (controladores CRUD completos).
#
# Endpoints que expone (via router en urls.py):
#   GET    /api/activos/items/              → lista todos los activos activos
#   POST   /api/activos/items/              → crea un nuevo activo (admin/jefe)
#   GET    /api/activos/items/{id}/         → detalle de un activo específico
#   PATCH  /api/activos/items/{id}/         → edita parcialmente un activo
#   DELETE /api/activos/items/{id}/         → elimina un activo
#   GET    /api/activos/items/estadisticas/ → resumen estadístico del inventario
#   POST   /api/activos/items/{id}/dar_baja/→ marca el activo como dado de baja
#   GET    /api/activos/asignaciones/       → lista asignaciones de activos
#   POST   /api/activos/asignaciones/       → crea nueva asignación
# ============================================================

from rest_framework import viewsets, status
from rest_framework.decorators import action         # Para agregar endpoints extra al ViewSet
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction                    # Para operaciones atómicas (todo o nada)
from .models import ActivoFijo, AsignacionActivo
from .serializers import ActivoFijoSerializer, AsignacionActivoSerializer
from apps.usuarios.permissions import IsAdminOrJefeAlmacen, IsAdmin
from apps.blockchain.services import BlockchainService  # Para registrar en blockchain


class ActivoFijoViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para gestión de Activos Fijos.

    ModelViewSet provee automáticamente los métodos:
      list()    → GET /items/
      create()  → POST /items/
      retrieve()→ GET /items/{id}/
      update()  → PUT /items/{id}/
      partial_update() → PATCH /items/{id}/
      destroy() → DELETE /items/{id}/

    Solo muestra activos donde activo=True (los dados de baja no aparecen).
    select_related() hace un JOIN en la BD para evitar consultas extra (optimización).
    """

    # Solo activos vigentes; carga departamento y responsable en la misma consulta SQL
    queryset = ActivoFijo.objects.filter(activo=True).select_related('departamento', 'responsable')
    serializer_class = ActivoFijoSerializer
    permission_classes = [IsAuthenticated]  # Requiere sesión iniciada para cualquier operación
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # Campos por los que se puede buscar con ?search=...
    search_fields = ['codigo_patrimonial', 'nombre', 'marca', 'modelo', 'serie']

    # Campos por los que se puede filtrar con ?estado=BUENO, ?tipo=EQUIPO, etc.
    filterset_fields = ['estado', 'tipo', 'departamento', 'activo', 'responsable']

    # Campos por los que se puede ordenar con ?ordering=nombre, ?ordering=-valor_adquisicion
    ordering_fields = ['codigo_patrimonial', 'nombre', 'fecha_adquisicion', 'valor_adquisicion']

    def get_queryset(self):
        """
        Filtro de seguridad por usuario y rol:
          - Usuarios regulares (ej. SOLICITANTE): solo ven sus propios activos fijos (responsable = user).
          - Administrador y Jefe de Almacén: ven todos los activos fijos, con opción de filtrar por ?responsable=<id>.
        """
        user = self.request.user
        qs = ActivoFijo.objects.filter(activo=True).select_related('departamento', 'responsable')
        if not user.is_authenticated:
            return qs.none()

        if user.rol not in ['ADMIN', 'JEFE_ALMACEN']:
            return qs.filter(responsable=user)

        responsable_id = self.request.query_params.get('responsable')
        if responsable_id:
            qs = qs.filter(responsable_id=responsable_id)
        return qs

    def get_permissions(self):
        """
        Cualquier usuario autenticado puede listar y crear sus propios activos.
        Para modificar o dar de baja, los usuarios regulares solo acceden a sus propios activos
        gracias al filtrado en get_queryset().
        """
        return [IsAuthenticated()]

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Se ejecuta automáticamente al crear un activo (POST /items/).
        Asigna el usuario responsable adecuado:
          - Para solicitantes/usuarios normales: se asigna a sí mismo obligatoriamente.
          - Para admin/jefe: puede asignar a cualquier usuario o a sí mismo por defecto.
        """
        user = self.request.user
        extra_kwargs = {}

        if user.rol not in ['ADMIN', 'JEFE_ALMACEN']:
            extra_kwargs['responsable'] = user
            if not serializer.validated_data.get('departamento') and user.departamento:
                extra_kwargs['departamento'] = user.departamento
        else:
            if not serializer.validated_data.get('responsable'):
                extra_kwargs['responsable'] = user

        activo = serializer.save(**extra_kwargs)
        try:
            bc = BlockchainService()
            hash_data, tx_hash = bc.registrar_activo(activo)
            activo.hash_blockchain = hash_data
            activo.tx_hash = tx_hash
            activo.save()
        except Exception:
            pass

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """
        Endpoint personalizado: GET /api/activos/items/estadisticas/
        Calcula las estadísticas sobre el queryset filtrado para el usuario actual.
        """
        from django.db.models import Count, Sum
        qs = self.get_queryset()
        total = qs.count()
        por_estado = qs.values('estado').annotate(total=Count('id'))
        por_tipo = qs.values('tipo').annotate(total=Count('id'))
        valor_total = qs.aggregate(total=Sum('valor_adquisicion'))
        return Response({
            'total_activos': total,
            'por_estado': list(por_estado),
            'por_tipo': list(por_tipo),
            'valor_total_adquisicion': valor_total['total'] or 0,
        })

    @action(detail=True, methods=['post'])
    def dar_baja(self, request, pk=None):
        """
        Endpoint personalizado: POST /api/activos/items/{id}/dar_baja/
        """
        activo = self.get_object()
        activo.estado = 'DADO_BAJA'
        activo.activo = False
        activo.save()
        return Response({'message': f'Activo {activo.codigo_patrimonial} dado de baja exitosamente'})


class AsignacionActivoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de asignaciones de activos.

    Una asignación vincula un activo con un usuario y departamento.
    Al crear una nueva asignación para un activo, la anterior se desactiva
    automáticamente (para mantener historial sin duplicar asignaciones activas).

    La asignación se registra en blockchain para trazabilidad completa.
    """

    # Carga activo, usuario y departamento en la misma consulta (evita N+1 queries)
    queryset = AsignacionActivo.objects.all().select_related('activo', 'usuario', 'departamento')
    serializer_class = AsignacionActivoSerializer
    permission_classes = [IsAuthenticated]

    # Filtros disponibles por URL: ?activo=1, ?usuario=2, ?activa=true
    filterset_fields = ['activo', 'usuario', 'departamento', 'activa']
    search_fields = ['activo__nombre', 'activo__codigo_patrimonial', 'usuario__nombre']
    ordering_fields = ['fecha_asignacion']

    def get_queryset(self):
        user = self.request.user
        qs = AsignacionActivo.objects.all().select_related('activo', 'usuario', 'departamento')
        if not user.is_authenticated:
            return qs.none()
        if user.rol not in ['ADMIN', 'JEFE_ALMACEN']:
            return qs.filter(usuario=user)
        return qs

    def get_permissions(self):
        """Solo ADMIN o JEFE_ALMACEN pueden crear, editar o borrar asignaciones."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrJefeAlmacen()]
        return [IsAuthenticated()]

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Crea una nueva asignación de activo con lógica especial:

        Paso 1: Desactiva cualquier asignación previa activa del mismo activo
                (un activo solo puede tener UNA asignación activa a la vez)
        Paso 2: Crea la nueva asignación y registra quién la hizo
        Paso 3: Intenta registrar la asignación en blockchain
                (si blockchain falla, la asignación igual se crea)

        @transaction.atomic asegura que el paso 1 y 2 son atómicos:
        si algo falla en el paso 2, el paso 1 también se revierte.
        """
        # Desactivar asignación previa del mismo activo
        activo = serializer.validated_data['activo']
        AsignacionActivo.objects.filter(activo=activo, activa=True).update(activa=False)

        # Crear la nueva asignación; registrado_por = usuario que hace la petición HTTP
        asignacion = serializer.save(registrado_por=self.request.user)

        # Registrar en blockchain
        try:
            bc = BlockchainService()
            hash_data, tx_hash = bc.registrar_asignacion(asignacion)
            asignacion.hash_blockchain = hash_data
            asignacion.save()
        except Exception:
            pass  # Blockchain es opcional; la asignación igual se guarda
