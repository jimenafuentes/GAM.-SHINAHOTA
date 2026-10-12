from rest_framework import serializers
from .models import RegistroBlockchain


class RegistroBlockchainSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre_completo', read_only=True)
    tipo_evento_display = serializers.CharField(source='get_tipo_evento_display', read_only=True)
    red_display = serializers.CharField(source='get_red_display', read_only=True)

    class Meta:
        model = RegistroBlockchain
        fields = '__all__'
