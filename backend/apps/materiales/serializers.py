# ============================================================
# apps/materiales/serializers.py - Serializers de Inventario de Materiales
# ============================================================
# Los serializers de Django REST Framework (DRF) controlan cómo se
# transforman los objetos de base de datos a JSON y viceversa.
#
# Este archivo define la conversión para:
#   1. CategoriaSerializer: Serializa categorías e indica cuántos materiales tiene.
#   2. ProveedorSerializer: Serializa proveedores.
#   3. MaterialSerializer: Serializa materiales con campos calculados dinámicos
#      (alerta de stock, valor de inventario total y nombres de llaves foráneas).
#   4. MovimientoInventarioSerializer: Serializa el Kardex / movimientos de stock.
# ============================================================

from rest_framework import serializers
from .models import Material, Categoria, Proveedor, MovimientoInventario


class CategoriaSerializer(serializers.ModelSerializer):
    """
    Serializer para Categorías de Materiales.
    
    Adicionalmente, retorna la cantidad de materiales activos que pertenecen
    a la categoría de forma dinámica y eficiente.
    """
    total_materiales = serializers.SerializerMethodField()

    class Meta:
        model = Categoria
        fields = '__all__'

    def get_total_materiales(self, obj):
        """
        Método calculado que retorna la cantidad de materiales activos asociados
        a esta categoría (evita mostrar materiales dados de baja/inactivos).
        """
        return obj.materiales.filter(activo=True).count()


class ProveedorSerializer(serializers.ModelSerializer):
    """
    Serializer simple para Proveedores de Materiales.
    
    Expone todos los campos del modelo Proveedor para su administración y consulta.
    """
    class Meta:
        model = Proveedor
        fields = '__all__'


class MaterialSerializer(serializers.ModelSerializer):
    """
    Serializer completo para la ficha del Material en Inventario.
    
    Incluye campos de solo lectura para evitar peticiones redundantes desde el frontend:
      - categoria_nombre: Nombre descriptivo de la categoría en lugar de su ID.
      - proveedor_nombre: Nombre legible del proveedor.
      - alerta_stock: Estado booleano si la existencia es menor o igual al stock mínimo.
      - valor_total: Costo financiero total del stock del material (stock_actual * precio_unitario).
    """
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    proveedor_nombre = serializers.CharField(source='proveedor.nombre', read_only=True)
    alerta_stock = serializers.ReadOnlyField()   # Obtiene la propiedad alerta_stock del modelo
    valor_total = serializers.ReadOnlyField()    # Obtiene la propiedad valor_total del modelo

    class Meta:
        model = Material
        fields = '__all__'


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    """
    Serializer para el registro detallado de Movimientos de Inventario (Kardex).
    
    Presenta la información del movimiento, los datos del material involucrado
    y el usuario que registró la operación física.
    """
    material_nombre = serializers.CharField(source='material.nombre', read_only=True)
    material_codigo = serializers.CharField(source='material.codigo', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre_completo', read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = '__all__'
        # Bloqueamos la modificación manual de campos críticos controlados únicamente por el sistema
        read_only_fields = ['stock_anterior', 'stock_posterior', 'hash_blockchain', 'tx_hash']
