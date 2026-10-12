# ============================================================
# apps/solicitudes/serializers.py - Serializers para Solicitudes
# ============================================================
# Los serializers convierten objetos Django a JSON y viceversa.
#
# En este archivo definimos la representación para:
#   1. DetalleSolicitudSerializer: Serializa los ítems (materiales y cantidades).
#   2. SolicitudMaterialSerializer: Serializa la cabecera completa con sus detalles
#      e incluye lógica personalizada para crear una solicitud con sus detalles
#      en una sola llamada API (creación anidada).
#   3. SolicitudListSerializer: Serializer optimizado para mostrar listas compactas
#      en el frontend de forma rápida sin sobrecargar la red.
# ============================================================

from rest_framework import serializers
from .models import SolicitudMaterial, DetalleSolicitud
from apps.materiales.serializers import MaterialSerializer


class DetalleSolicitudSerializer(serializers.ModelSerializer):
    """
    Serializer para el detalle individual de cada ítem de material solicitado.

    Además de los campos nativos del modelo, extrae datos de consulta rápida (sólo lectura)
    del material relacionado (nombre, código, unidad de medida y stock actual) para que
    el frontend muestre la información completa sin hacer peticiones adicionales.
    """
    material_nombre = serializers.CharField(source='material.nombre', read_only=True)
    material_codigo = serializers.CharField(source='material.codigo', read_only=True)
    material_unidad = serializers.CharField(source='material.unidad_medida', read_only=True)
    material_stock = serializers.DecimalField(source='material.stock_actual', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = DetalleSolicitud
        fields = '__all__'
        read_only_fields = ['solicitud']  # La solicitud se asigna automáticamente al crearla

    def validate_cantidad_solicitada(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("No se puede crear la solicitud con esa cantidad. La cantidad debe ser mayor a 0.")
        return value


class SolicitudMaterialSerializer(serializers.ModelSerializer):
    """
    Serializer completo de Solicitud de Materiales (Cabecera + Detalles).

    Permite leer toda la información de la solicitud, incluyendo la lista
    de materiales solicitados gracias a la relación anidada de 'detalles'.
    """
    # Relación anidada: incluye los serializadores de detalles de la solicitud
    detalles = DetalleSolicitudSerializer(many=True)

    # Campos auxiliares descriptivos de sólo lectura obtenidos a través de las relaciones
    solicitante_nombre = serializers.CharField(source='solicitante.nombre_completo', read_only=True)
    departamento_nombre = serializers.CharField(source='departamento.nombre', read_only=True)
    aprobado_por_nombre = serializers.CharField(source='aprobado_por.nombre_completo', read_only=True)
    entregado_por_nombre = serializers.CharField(source='entregado_por.nombre_completo', read_only=True)

    # Devuelve el texto legible de los campos Choice (ej. 'Pendiente' en lugar de 'PENDIENTE')
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    prioridad_display = serializers.CharField(source='get_prioridad_display', read_only=True)

    class Meta:
        model = SolicitudMaterial
        fields = '__all__'
        # Evita que el cliente altere campos de control interno de forma malintencionada
        read_only_fields = ['numero', 'solicitante', 'departamento', 'estado', 'aprobado_por', 'fecha_aprobacion',
                            'entregado_por', 'fecha_entrega', 'hash_blockchain', 'tx_hash']

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError("Debe incluir al menos un material en la solicitud.")
        for item in value:
            cant = item.get('cantidad_solicitada')
            if cant is None or cant <= 0:
                raise serializers.ValidationError("No se puede crear la solicitud con esa cantidad. La cantidad debe ser mayor a 0.")
        return value

    def create(self, validated_data):
        """
        Lógica personalizada de creación anidada.

        Debido a que DRF no soporta la creación directa de relaciones anidadas (Writable Nested),
        extraemos los detalles, creamos la cabecera 'SolicitudMaterial' y luego creamos
        cada uno de los registros de 'DetalleSolicitud' vinculados a la solicitud padre.
        """
        detalles_data = validated_data.pop('detalles')  # Extrae la lista de materiales solicitados
        solicitud = SolicitudMaterial.objects.create(**validated_data)  # Crea la cabecera
        for detalle in detalles_data:
            # Crea y asocia cada detalle con la solicitud creada anteriormente
            DetalleSolicitud.objects.create(solicitud=solicitud, **detalle)
        return solicitud


class SolicitudListSerializer(serializers.ModelSerializer):
    """
    Serializer compacto y optimizado diseñado específicamente para listados/grillas.

    Evita serializar toda la estructura anidada de detalles (que puede ser muy pesada
    para decenas de registros) y en su lugar calcula y retorna de forma ligera el número
    total de ítems solicitados en cada solicitud.
    """
    solicitante_nombre = serializers.CharField(source='solicitante.nombre_completo', read_only=True)
    departamento_nombre = serializers.CharField(source='departamento.nombre', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    prioridad_display = serializers.CharField(source='get_prioridad_display', read_only=True)

    # Campo personalizado dinámico para contar cuántos tipos de materiales hay en la solicitud
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudMaterial
        fields = ['id', 'numero', 'solicitante_nombre', 'departamento_nombre',
                  'estado', 'estado_display', 'prioridad', 'prioridad_display',
                  'motivo', 'total_items', 'hash_blockchain', 'fecha_creacion']

    def get_total_items(self, obj):
        """
        Retorna la cantidad de registros en el detalle de la solicitud.
        """
        return obj.detalles.count()
