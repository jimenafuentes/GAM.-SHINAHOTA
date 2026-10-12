# ============================================================
# apps/blockchain/views.py - Endpoints API para Blockchain
# ============================================================
# Este archivo define los endpoints que el frontend usa para
# consultar, verificar y ver estadísticas de los registros blockchain.
#
# URLs disponibles (configuradas en blockchain/urls.py):
#   GET  /api/blockchain/            → lista todos los registros blockchain
#   POST /api/blockchain/verificar/  → verifica si un hash existe y es válido
#   GET  /api/blockchain/estadisticas/ → estadísticas de eventos en blockchain
#   GET  /api/blockchain/estado_red/ → estado de conexión con la red blockchain
#
# Solo permite LECTURA (ReadOnlyModelViewSet) porque los registros
# blockchain son inmutables: nadie debe poder crearlos o borrarlos
# manualmente desde la API (se crean automáticamente en los otros módulos).
# ============================================================

from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import RegistroBlockchain
from .serializers import RegistroBlockchainSerializer
from .services import BlockchainService
from apps.usuarios.permissions import IsAdminOrJefeAlmacenOrAuditor


class RegistroBlockchainViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de SOLO LECTURA para los registros blockchain.

    ReadOnlyModelViewSet provee únicamente:
      - list()    → GET /blockchain/       (lista todos)
      - retrieve()→ GET /blockchain/{id}/  (detalle de uno)

    No provee create/update/delete porque los registros blockchain
    son auditables e inmutables; se crean solo automáticamente.

    Acceso: cualquier usuario autenticado puede ver los registros.
    """

    # Todos los registros, con información del usuario precargada
    queryset = RegistroBlockchain.objects.all().select_related('usuario')
    serializer_class = RegistroBlockchainSerializer
    permission_classes = [IsAuthenticated]

    # Permite buscar por: ?search=0x7f3a... (tx_hash o hash_datos)
    search_fields = ['hash_datos', 'tx_hash', 'tipo_evento']

    # Permite filtrar por: ?tipo_evento=SOLICITUD_CREADA, ?red=LOCAL
    filterset_fields = ['tipo_evento', 'red', 'entidad_tipo']

    # Permite ordenar por: ?ordering=-fecha (más recientes primero)
    ordering_fields = ['fecha']

    @action(detail=False, methods=['post'])
    def verificar(self, request):
        """
        POST /api/blockchain/verificar/
        Body: {"hash": "a3f2b1c9d8e7..."}

        Verifica si un hash SHA-256 existe en los registros del sistema.

        Uso: el auditor copia un hash del sistema y lo pega aquí para
        confirmar que corresponde a un evento real registrado en la blockchain.

        Retorna:
          - Si existe: {valido: true, tipo_evento, fecha, tx_hash, red}
          - Si no existe: {valido: false, mensaje: '...'}
        """
        hash_datos = request.data.get('hash')
        if not hash_datos:
            return Response({'error': 'Se requiere el campo hash'}, status=400)
        bc = BlockchainService()
        resultado = bc.verificar_integridad(hash_datos)
        return Response(resultado)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """
        GET /api/blockchain/estadisticas/

        Retorna un resumen estadístico de los registros blockchain:
          - total_registros: cuántos eventos hay registrados en total
          - por_tipo: conteo agrupado por tipo de evento
          - por_red: conteo agrupado por red (LOCAL, SEPOLIA, MAINNET)

        El dashboard lo usa para mostrar la tarjeta de "Blockchain".
        """
        from django.db.models import Count
        total = RegistroBlockchain.objects.count()
        # Agrupa por tipo_evento y cuenta cuántos hay de cada tipo
        por_tipo = RegistroBlockchain.objects.values('tipo_evento').annotate(total=Count('id'))
        # Agrupa por red (LOCAL, SEPOLIA, etc.)
        por_red = RegistroBlockchain.objects.values('red').annotate(total=Count('id'))
        return Response({
            'total_registros': total,
            'por_tipo': list(por_tipo),
            'por_red': list(por_red),
        })

    @action(detail=False, methods=['get'])
    def estado_red(self, request):
        """
        GET /api/blockchain/estado_red/

        Verifica el estado de la conexión con la red blockchain local.

        Si está conectada, también devuelve:
          - bloque_actual: número del último bloque minado
          - cuentas: cuántas cuentas tiene disponibles Hardhat

        El frontend muestra este estado en la barra superior ("Blockchain Activa")
        y en la página de Blockchain.
        """
        bc = BlockchainService()
        conectado = bc.web3 is not None  # True si la conexión a Hardhat/Ganache está activa

        info = {
            'conectado': conectado,
            'red': 'LOCAL (Hardhat/Ganache)',
            # Lee la URL de Ganache desde settings, con fallback al valor por defecto
            'url': getattr(__import__('django.conf', fromlist=['settings']).settings, 'GANACHE_URL', 'http://127.0.0.1:8545'),
        }

        # Si está conectada, agrega información del estado de la red
        if conectado:
            try:
                info['bloque_actual'] = bc.web3.eth.block_number  # Número del bloque actual
                info['cuentas'] = len(bc.web3.eth.accounts)        # Cantidad de cuentas disponibles
            except Exception:
                pass  # Si falla obtener estos datos, igual retorna lo básico

        return Response(info)
