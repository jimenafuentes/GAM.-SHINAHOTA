# ============================================================
# apps/activos/serializers.py - Serializers para Activos Fijos
# ============================================================
# Los serializers convierten objetos Python/Django ↔ JSON.
#
# ¿Por qué son necesarios?
#   - El frontend envía datos en JSON (texto)
#   - Django trabaja con objetos Python y modelos de BD
#   - El serializer hace la traducción en ambas direcciones:
#       * Entrada: valida el JSON y lo convierte a un objeto del modelo
#       * Salida: convierte el objeto del modelo a JSON para la respuesta
#
# Campos extra (read_only):
#   Algunos campos no existen en la BD pero se añaden al JSON de respuesta
#   para que el frontend tenga información legible sin hacer peticiones extra.
# ============================================================

from rest_framework import serializers
from .models import ActivoFijo, AsignacionActivo


class ActivoFijoSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo ActivoFijo.

    Campos extra de solo lectura (no se envían en POST/PUT, solo en GET):
      - departamento_nombre:  nombre legible del departamento (en lugar del ID)
      - responsable_nombre:   nombre completo del responsable (en lugar del ID)
      - valor_depreciado:     valor actual calculado con depreciación (property del modelo)
      - porcentaje_depreciado:porcentaje de depreciación acumulado (property del modelo)
      - estado_display:       etiqueta legible del estado ('Buen Estado' en vez de 'BUENO')
      - tipo_display:         etiqueta legible del tipo ('Equipo' en vez de 'EQUIPO')

    source='campo.subatributo' → accede a un campo relacionado via FK
    source='get_X_display' → método de Django para obtener la etiqueta de un choices
    read_only=True → no se puede modificar via API, solo se devuelve en GET
    """

    # Nombre del departamento (viene de la relación ForeignKey departamento.nombre)
    departamento_nombre = serializers.CharField(source='departamento.nombre', read_only=True)

    # Nombre completo del responsable (viene de la property nombre_completo del Usuario)
    responsable_nombre = serializers.CharField(source='responsable.nombre_completo', read_only=True)

    # Valor depreciado calculado (definido como @property en el modelo)
    valor_depreciado = serializers.ReadOnlyField()

    # Porcentaje depreciado calculado (definido como @property en el modelo)
    porcentaje_depreciado = serializers.ReadOnlyField()

    # Etiqueta legible del estado (ej: "Buen Estado" en lugar de "BUENO")
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    # Etiqueta legible del tipo (ej: "Equipo" en lugar de "EQUIPO")
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = ActivoFijo
        fields = '__all__'  # Incluye todos los campos del modelo + los extra definidos arriba


class AsignacionActivoSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo AsignacionActivo.

    Agrega campos de solo lectura para mostrar información legible al frontend:
      - activo_nombre:          nombre del activo asignado
      - activo_codigo:          código patrimonial del activo
      - usuario_nombre:         nombre completo del usuario asignado
      - departamento_nombre:    nombre del departamento
      - registrado_por_nombre:  nombre de quien registró la asignación

    Campos de solo lectura en Meta:
      - registrado_por: se establece automáticamente en la vista (usuario logueado)
      - hash_blockchain: se genera automáticamente, no lo envía el frontend
    """

    activo_nombre = serializers.CharField(source='activo.nombre', read_only=True)
    activo_codigo = serializers.CharField(source='activo.codigo_patrimonial', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre_completo', read_only=True)
    departamento_nombre = serializers.CharField(source='departamento.nombre', read_only=True)
    registrado_por_nombre = serializers.CharField(source='registrado_por.nombre_completo', read_only=True)

    class Meta:
        model = AsignacionActivo
        fields = '__all__'
        # Estos campos no pueden ser enviados por el cliente en POST/PATCH
        read_only_fields = ['registrado_por', 'hash_blockchain']
