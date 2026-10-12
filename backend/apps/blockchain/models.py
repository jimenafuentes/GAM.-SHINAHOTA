# ============================================================
# apps/blockchain/models.py - Modelo de Base de Datos: Registro Blockchain
# ============================================================
# Este archivo define la tabla que guarda localmente cada registro
# que se envía (o intenta enviar) a la blockchain.
#
# ¿Por qué guardar en BD si ya está en blockchain?
#   La blockchain puede estar desconectada. Al guardar también en PostgreSQL:
#   1. El sistema sigue funcionando aunque no haya red blockchain
#   2. Las búsquedas son más rápidas (no hay que consultar la blockchain)
#   3. Se puede mostrar el historial sin necesidad de conectarse
#
# Tabla: registros_blockchain
# ============================================================

from django.db import models


class RegistroBlockchain(models.Model):
    """
    Guarda un espejo local de cada evento registrado en la blockchain.

    Cada vez que ocurre una acción importante en el sistema
    (solicitud creada, activo registrado, movimiento de inventario, etc.),
    se crea un RegistroBlockchain con:
      - El tipo de evento
      - Los datos originales en JSON
      - El hash SHA-256 de esos datos
      - El hash de la transacción en Ethereum (si blockchain estaba disponible)
      - El número de bloque en el que se minó la transacción
    """

    # Tipos de eventos que pueden registrarse en blockchain
    TIPOS_EVENTO = [
        ('SOLICITUD_CREADA', 'Solicitud Creada'),
        ('SOLICITUD_APROBADA', 'Solicitud Aprobada'),
        ('SOLICITUD_RECHAZADA', 'Solicitud Rechazada'),
        ('SOLICITUD_ENTREGADA', 'Solicitud Entregada'),
        ('MOVIMIENTO_INVENTARIO', 'Movimiento de Inventario'),
        ('ACTIVO_REGISTRADO', 'Activo Registrado'),
        ('ACTIVO_ASIGNADO', 'Activo Asignado'),
        ('ACTIVO_BAJA', 'Activo Dado de Baja'),
    ]

    # Redes blockchain disponibles
    REDES = [
        ('LOCAL', 'Red Local (Hardhat/Ganache)'),    # Para desarrollo (gratis, rápida)
        ('SEPOLIA', 'Ethereum Sepolia Testnet'),       # Para pruebas en red pública
        ('MAINNET', 'Ethereum Mainnet'),               # Para producción real (cuesta ETH real)
    ]

    # Tipo de evento (ej: 'SOLICITUD_CREADA')
    tipo_evento = models.CharField(max_length=30, choices=TIPOS_EVENTO)

    # Descripción humana legible del evento (opcional)
    descripcion = models.TextField(blank=True)

    # Datos completos del evento en formato JSON
    # Ejemplo: {"numero": "2024-0001", "solicitante": "Juan Pérez", ...}
    datos_json = models.JSONField(default=dict)

    # Hash SHA-256 de los datos_json (huella digital que garantiza integridad)
    # Si alguien modifica los datos_json, el hash ya no coincidirá
    hash_datos = models.CharField(max_length=256, verbose_name='Hash SHA-256 de los datos')

    # Hash de la transacción en Ethereum (vacío si blockchain no estaba disponible)
    # Ejemplo: "0x7f3a9b2c1d4e5f6a..."
    tx_hash = models.CharField(max_length=256, blank=True, verbose_name='Transaction Hash')

    # Número de bloque en el que se incluyó la transacción (auditoría)
    bloque = models.BigIntegerField(null=True, blank=True)

    # En qué red se registró (LOCAL, SEPOLIA, MAINNET)
    red = models.CharField(max_length=10, choices=REDES, default='LOCAL')

    # Usuario del sistema que provocó este evento (puede ser null si fue automático)
    usuario = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.SET_NULL, null=True, related_name='registros_blockchain'
    )

    # Tipo y ID del objeto al que se refiere este evento
    # Ejemplo: entidad_tipo='SolicitudMaterial', entidad_id=42
    entidad_tipo = models.CharField(max_length=50, blank=True)
    entidad_id = models.BigIntegerField(null=True, blank=True)

    # True si el hash fue verificado exitosamente contra la blockchain
    verificado = models.BooleanField(default=False)

    # Fecha y hora exacta del registro (se llena automáticamente)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'registros_blockchain'
        verbose_name = 'Registro Blockchain'
        verbose_name_plural = 'Registros Blockchain'
        ordering = ['-fecha']  # Los más recientes primero

    def __str__(self):
        """Muestra las primeras 16 letras del hash para identificarlo visualmente."""
        return f"{self.tipo_evento} | {self.hash_datos[:16]}... | {self.fecha.strftime('%d/%m/%Y %H:%M')}"
