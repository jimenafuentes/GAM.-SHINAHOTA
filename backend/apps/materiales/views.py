# ============================================================
# apps/materiales/views.py - Endpoints API para Materiales e Inventario
# ============================================================
# Este archivo define los endpoints REST para gestionar el inventario
# de materiales, proveedores, categorías y movimientos de inventario.
#
# Endpoints principales:
#   /api/materiales/categorias/     → CRUD de categorías
#   /api/materiales/proveedores/    → CRUD de proveedores
#   /api/materiales/items/          → CRUD de materiales
#   /api/materiales/items/alertas_stock/ → materiales con stock bajo
#   /api/materiales/items/estadisticas/  → resumen del inventario
#   /api/materiales/movimientos/    → CRUD de movimientos (entradas/salidas)
#
# La parte más importante es MovimientoInventarioViewSet.perform_create()
# que maneja la lógica de negocio: actualiza el stock según el tipo de movimiento.
# ============================================================

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction                    # Para operaciones atómicas
from django.db import models
from django.db.models import Sum, Count, Q
from .models import Material, Categoria, Proveedor, MovimientoInventario
from .serializers import (
    MaterialSerializer, CategoriaSerializer,
    ProveedorSerializer, MovimientoInventarioSerializer
)
from apps.usuarios.permissions import IsAdminOrJefeAlmacen
from apps.blockchain.services import BlockchainService


class CategoriaViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para categorías de materiales.

    Permisos:
      - Ver/listar: cualquier usuario autenticado
      - Crear/editar/borrar: solo ADMIN o JEFE_ALMACEN
    """
    queryset = Categoria.objects.filter(activo=True)
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nombre']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrJefeAlmacen()]
        return [IsAuthenticated()]


class ProveedorViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para proveedores de materiales.

    Permisos:
      - Ver/listar: cualquier usuario autenticado
      - Crear/editar/borrar: solo ADMIN o JEFE_ALMACEN
    """
    queryset = Proveedor.objects.filter(activo=True)
    serializer_class = ProveedorSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nombre', 'nit', 'contacto']  # Búsqueda por nombre, NIT o contacto

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrJefeAlmacen()]
        return [IsAuthenticated()]


class MaterialViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para el catálogo de materiales del almacén.

    select_related('categoria', 'proveedor') → hace un JOIN en SQL para
    cargar los datos relacionados en una sola consulta (evita el problema N+1).

    Filtros disponibles:
      ?search=papel         → busca en código, nombre y descripción
      ?categoria=1          → filtra por categoría
      ?ordering=stock_actual→ ordena por stock
    """
    queryset = Material.objects.filter(activo=True).select_related('categoria', 'proveedor')
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['codigo', 'nombre', 'descripcion']
    filterset_fields = ['categoria', 'activo']
    ordering_fields = ['nombre', 'codigo', 'stock_actual', 'fecha_creacion']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrJefeAlmacen()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def alertas_stock(self, request):
        """
        GET /api/materiales/items/alertas_stock/

        Retorna todos los materiales cuyo stock_actual <= stock_minimo.
        models.F('stock_minimo') → referencia al campo stock_minimo en SQL
        (permite comparar dos columnas de la misma tabla directamente en la BD).

        El dashboard lo usa para mostrar la alerta de "materiales con bajo stock".
        """
        materiales = Material.objects.filter(
            activo=True,
            stock_actual__lte=models.F('stock_minimo')  # stock_actual <= stock_minimo
        ).select_related('categoria')
        serializer = self.get_serializer(materiales, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """
        GET /api/materiales/items/estadisticas/

        Retorna un resumen del estado del inventario:
          - total_materiales: cuántos materiales hay en el catálogo
          - con_stock:        cuántos tienen stock > 0
          - sin_stock:        cuántos están completamente agotados (stock = 0)
          - bajo_stock:       cuántos están entre 1 y el mínimo (en alerta)
        """
        total = Material.objects.filter(activo=True).count()
        con_stock = Material.objects.filter(activo=True, stock_actual__gt=0).count()
        sin_stock = Material.objects.filter(activo=True, stock_actual=0).count()
        # Bajo stock: tiene algo pero está por debajo del mínimo
        bajo_stock = Material.objects.filter(
            activo=True, stock_actual__lte=models.F('stock_minimo'), stock_actual__gt=0
        ).count()
        return Response({
            'total_materiales': total,
            'con_stock': con_stock,
            'sin_stock': sin_stock,
            'bajo_stock': bajo_stock,
        })

    def destroy(self, request, *args, **kwargs):
        """
        Elimina un material. Si el material tiene movimientos de inventario o solicitudes asociadas,
        se realiza borrado lógico (activo = False) para preservar el historial de inventario.
        """
        from django.db.models import ProtectedError
        from django.db import IntegrityError
        instance = self.get_object()
        try:
            instance.delete()
            return Response({'detail': 'Material eliminado permanentemente'}, status=status.HTTP_200_OK)
        except (ProtectedError, IntegrityError):
            instance.activo = False
            instance.save()
            return Response(
                {'detail': 'El material tiene movimientos o solicitudes registradas. Se ha marcado como inactivo para preservar el historial.'},
                status=status.HTTP_200_OK
            )


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para registrar y consultar movimientos de inventario.

    Un movimiento es cualquier cambio en el stock de un material:
      ENTRADA   → suma al stock (compra de materiales)
      SALIDA    → resta del stock (entrega por solicitud)
      DEVOLUCION→ suma al stock (devolución de materiales)
      AJUSTE    → establece el stock a un valor específico (corrección)

    La lógica de negocio está en perform_create():
      1. Valida que hay stock suficiente para salidas
      2. Actualiza el stock del material según el tipo
      3. Guarda el movimiento con stock_anterior y stock_posterior
      4. Registra el movimiento en blockchain

    @transaction.atomic garantiza que la actualización de stock y la
    creación del movimiento son una sola operación atómica: si algo
    falla, ningún cambio se guarda en la BD.
    """
    queryset = MovimientoInventario.objects.all().select_related('material', 'usuario', 'solicitud')
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['tipo', 'material']
    search_fields = ['referencia', 'material__nombre', 'material__codigo']
    ordering_fields = ['fecha', 'tipo']

    def get_permissions(self):
        # Solo ADMIN o JEFE_ALMACEN pueden crear movimientos (registrar entradas/salidas)
        if self.action in ['create']:
            return [IsAdminOrJefeAlmacen()]
        return [IsAuthenticated()]

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Lógica de negocio para registrar un movimiento de inventario.

        Paso 1: Extrae los datos del request (material, tipo, cantidad)
        Paso 2: Guarda el stock actual (antes del movimiento) para auditoría
        Paso 3: Valida que hay suficiente stock para SALIDAS (evita negativos)
        Paso 4: Actualiza el stock según el tipo de movimiento:
                  ENTRADA/DEVOLUCION → stock += cantidad
                  SALIDA             → stock -= cantidad
                  AJUSTE             → stock = cantidad (reemplazo directo)
        Paso 5: Guarda el material con el nuevo stock
        Paso 6: Crea el registro del movimiento con stock_anterior y stock_posterior
        Paso 7: Registra el movimiento en blockchain (opcional, no interrumpe si falla)
        """
        material = serializer.validated_data['material']
        tipo = serializer.validated_data['tipo']
        cantidad = serializer.validated_data['cantidad']
        stock_anterior = material.stock_actual  # Guarda el stock antes del movimiento

        # Validación: no permitir salidas si no hay suficiente stock
        if tipo == 'SALIDA' and stock_anterior < cantidad:
            from rest_framework.serializers import ValidationError
            raise ValidationError({'cantidad': 'Stock insuficiente'})

        # Actualizar stock según tipo de movimiento
        if tipo in ['ENTRADA', 'DEVOLUCION']:
            material.stock_actual += cantidad    # Suma al inventario
        elif tipo == 'SALIDA':
            material.stock_actual -= cantidad    # Resta del inventario
        elif tipo == 'AJUSTE':
            material.stock_actual = cantidad     # Establece el stock directamente

        material.save()  # Guarda el nuevo stock en la BD

        # Crea el registro del movimiento con los stocks antes/después
        movimiento = serializer.save(
            usuario=self.request.user,           # Quién registró el movimiento
            stock_anterior=stock_anterior,        # Para auditoría
            stock_posterior=material.stock_actual # Para auditoría
        )

        # Registrar en blockchain (opcional: si falla, el movimiento igual se guarda)
        try:
            bc = BlockchainService()
            hash_data, tx_hash = bc.registrar_movimiento(movimiento)
            movimiento.hash_blockchain = hash_data
            movimiento.tx_hash = tx_hash
            movimiento.save()
        except Exception:
            pass
