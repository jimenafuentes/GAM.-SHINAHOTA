# ============================================================
# apps/solicitudes/models.py - Modelos de Solicitudes de Materiales
# ============================================================
# Este archivo define los modelos para gestionar el flujo de solicitudes
# de materiales del almacén de la Alcaldía de Shinahota.
#
# El flujo de una solicitud consta de:
#   1. Creación (PENDIENTE): El solicitante pide una lista de materiales con sus cantidades.
#   2. Aprobación (APROBADO/RECHAZADO): El administrador o jefe de almacén aprueba o rechaza la solicitud.
#   3. Entrega (ENTREGADO): Se realiza la entrega física de los materiales, actualizando el inventario.
#
# Para cada solicitud aprobada y entregada, se guarda su huella de integridad en la Blockchain.
# ============================================================

from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class SolicitudMaterial(models.Model):
    """
    Modelo principal que representa la cabecera de una solicitud de materiales.

    Guarda los datos generales como el solicitante, el estado, la prioridad,
    los motivos y los campos de trazabilidad blockchain e históricos.
    """

    # Opciones de estado de la solicitud
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),       # Acaba de ser creada por el funcionario
        ('APROBADO', 'Aprobado'),         # Aceptada por el jefe, lista para entrega
        ('RECHAZADO', 'Rechazado'),       # Rechazada por el jefe (requiere motivo)
        ('EN_PROCESO', 'En Proceso'),     # Preparando los materiales en almacén
        ('ENTREGADO', 'Entregado'),       # Materiales entregados físicamente e inventario actualizado
        ('CANCELADO', 'Cancelado'),       # Anulada por el propio solicitante antes de ser procesada
    ]

    # Opciones de nivel de urgencia de la solicitud
    PRIORIDADES = [
        ('BAJA', 'Baja'),
        ('MEDIA', 'Media'),
        ('ALTA', 'Alta'),
        ('URGENTE', 'Urgente'),
    ]

    # Número único autogenerado en formato AÑO-SECUENCIA (ej. 2026-0001)
    numero = models.CharField(max_length=20, unique=True, editable=False)

    # Funcionario que realiza la solicitud (Relacionado con la app de usuarios)
    solicitante = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.PROTECT, related_name='solicitudes_realizadas'
    )

    # Departamento al que pertenece la solicitud para imputación de costos/recursos
    departamento = models.ForeignKey(
        'usuarios.Departamento', on_delete=models.PROTECT, related_name='solicitudes'
    )

    # Estado del flujo de trabajo y nivel de urgencia
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    prioridad = models.CharField(max_length=10, choices=PRIORIDADES, default='MEDIA')

    # Justificación y comentarios de la solicitud
    motivo = models.TextField(verbose_name='Motivo de la Solicitud')
    observaciones = models.TextField(blank=True)             # Notas generales del proceso
    observaciones_rechazo = models.TextField(blank=True)     # Explicación obligatoria si se rechaza

    # Datos de control de aprobación
    aprobado_por = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_aprobadas'
    )
    fecha_aprobacion = models.DateTimeField(null=True, blank=True)

    # Datos de control de entrega física
    entregado_por = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_entregadas'
    )
    fecha_entrega = models.DateTimeField(null=True, blank=True)

    # Trazabilidad Blockchain: Garantía de no alteración ni borrado del registro
    hash_blockchain = models.CharField(max_length=256, blank=True)  # Hash SHA-256 del contenido
    tx_hash = models.CharField(max_length=256, blank=True)           # Hash de la transacción de Ethereum/Hardhat

    # Fechas automáticas de auditoría interna
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'solicitudes_material'
        verbose_name = 'Solicitud de Material'
        verbose_name_plural = 'Solicitudes de Material'
        ordering = ['-fecha_creacion']  # Muestra siempre las más nuevas primero

    def __str__(self):
        return f"SOL-{self.numero} | {self.solicitante.nombre_completo} | {self.estado}"

    def save(self, *args, **kwargs):
        """
        Sobrescribe el método save() para generar el número de solicitud
        único con base en el año actual y un correlativo numérico.
        Ejemplo: Si es la primera del 2026, el código será "2026-0001".
        """
        if not self.numero:
            import datetime
            ultimo = SolicitudMaterial.objects.filter(
                fecha_creacion__year=datetime.datetime.now().year
            ).count() + 1
            self.numero = f"{datetime.datetime.now().year}-{str(ultimo).zfill(4)}"
        super().save(*args, **kwargs)


class DetalleSolicitud(models.Model):
    """
    Representa un ítem específico dentro de una solicitud de material.

    Relaciona la cabecera de la solicitud con los materiales del inventario,
    registrando las cantidades solicitadas, aprobadas y entregadas para mantener
    el control de inventario y justificación de entregas parciales.
    """

    # Enlace fuerte con la solicitud cabecera. Si se elimina la cabecera, se eliminan sus detalles.
    solicitud = models.ForeignKey(SolicitudMaterial, on_delete=models.CASCADE, related_name='detalles')

    # Enlace con el material del inventario. PROTECT evita eliminar materiales que tengan solicitudes.
    material = models.ForeignKey('materiales.Material', on_delete=models.PROTECT, related_name='detalles_solicitud')

    # Control cuantitativo en cada etapa
    cantidad_solicitada = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'), message="No se puede crear la solicitud con esa cantidad. La cantidad debe ser mayor a 0.")]
    )  # Cantidad requerida inicialmente (debe ser mayor a 0)
    cantidad_aprobada = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)   # Cantidad autorizada
    cantidad_entregada = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # Cantidad real recibida

    # Nota u observación particular sobre este ítem
    observacion = models.TextField(blank=True)

    class Meta:
        db_table = 'detalle_solicitudes'
        verbose_name = 'Detalle de Solicitud'
        verbose_name_plural = 'Detalles de Solicitud'

    def __str__(self):
        return f"{self.solicitud.numero} - {self.material.nombre}"
