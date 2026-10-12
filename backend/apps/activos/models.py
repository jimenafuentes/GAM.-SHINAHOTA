# ============================================================
# apps/activos/models.py - Modelos de Base de Datos: Activos Fijos
# ============================================================
# Este archivo define las tablas de la base de datos relacionadas
# con los ACTIVOS FIJOS de la Alcaldía (bienes patrimoniales).
#
# ¿Qué es un activo fijo?
#   Son bienes duraderos de la institución: computadoras, vehículos,
#   escritorios, equipos, edificios, etc. Cada uno tiene un código
#   patrimonial único y se deprecia con el tiempo.
#
# Tablas que crea este archivo:
#   - activos_fijos      → registro de cada bien patrimonial
#   - asignaciones_activos → a quién está asignado cada activo
# ============================================================

from django.db import models
from django.utils import timezone
from decimal import Decimal


class ActivoFijo(models.Model):
    """
    Modelo principal para registrar bienes patrimoniales (activos fijos).

    Representa cualquier bien físico de la institución que tiene un valor
    económico, vida útil y puede depreciarse con el tiempo.

    Estados posibles del activo:
      - BUENO        → en perfecto estado de uso
      - REGULAR      → funciona pero con desgaste visible
      - MALO         → deteriorado, necesita reparación mayor
      - DADO_BAJA    → retirado del inventario (no aparece en listas activas)
      - EN_REPARACION → temporalmente fuera de servicio por mantenimiento

    Tipos de activo:
      - MUEBLE, INMUEBLE, EQUIPO, VEHICULO, HERRAMIENTA, TECNOLOGIA, OTRO
    """

    # Opciones de estado del activo (valor_bd, etiqueta_legible)
    ESTADOS = [
        ('BUENO', 'Buen Estado'),
        ('REGULAR', 'Estado Regular'),
        ('MALO', 'Mal Estado'),
        ('DADO_BAJA', 'Dado de Baja'),
        ('EN_REPARACION', 'En Reparación'),
    ]

    # Tipos de activo patrimonial
    TIPOS = [
        ('MUEBLE', 'Mueble'),
        ('INMUEBLE', 'Inmueble'),
        ('EQUIPO', 'Equipo'),
        ('VEHICULO', 'Vehículo'),
        ('HERRAMIENTA', 'Herramienta'),
        ('TECNOLOGIA', 'Tecnología'),
        ('OTRO', 'Otro'),
    ]

    # Identificador único del activo en toda la institución (ej: "ACT-2024-001")
    codigo_patrimonial = models.CharField(max_length=50, unique=True, verbose_name='Código Patrimonial')
    nombre = models.CharField(max_length=200)           # Nombre descriptivo del activo
    descripcion = models.TextField(blank=True)           # Descripción detallada (opcional)
    tipo = models.CharField(max_length=20, choices=TIPOS, default='EQUIPO')   # Categoría del activo
    estado = models.CharField(max_length=20, choices=ESTADOS, default='BUENO') # Estado actual

    # Datos de identificación física del bien
    marca = models.CharField(max_length=100, blank=True)   # Marca del fabricante
    modelo = models.CharField(max_length=100, blank=True)  # Modelo específico
    serie = models.CharField(max_length=100, blank=True, verbose_name='Número de Serie')

    # Datos financieros para calcular depreciación
    valor_adquisicion = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # Precio de compra
    fecha_adquisicion = models.DateField()                                                 # Cuándo se compró
    vida_util_anios = models.IntegerField(default=5, verbose_name='Vida Útil (años)')    # Años de uso esperados
    porcentaje_depreciacion = models.DecimalField(max_digits=5, decimal_places=2, default=20)  # % anual de depreciación

    # Relaciones con otras tablas
    # on_delete=PROTECT: no deja borrar un departamento si tiene activos
    departamento = models.ForeignKey(
        'usuarios.Departamento', on_delete=models.PROTECT, related_name='activos'
    )
    # on_delete=SET_NULL: si el usuario responsable se borra, el campo queda en null
    responsable = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.SET_NULL, null=True, blank=True, related_name='activos_a_cargo'
    )

    ubicacion = models.CharField(max_length=200, blank=True)  # Dónde está físicamente el activo
    imagen = models.ImageField(upload_to='activos/', null=True, blank=True)  # Foto del activo

    # Campos de trazabilidad blockchain
    hash_blockchain = models.CharField(max_length=256, blank=True)  # Hash SHA-256 del registro
    tx_hash = models.CharField(max_length=256, blank=True)           # Hash de la transacción en Ethereum

    activo = models.BooleanField(default=True)  # False = dado de baja (borrado lógico)

    # Fechas automáticas de auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True)      # Se pone al crear
    fecha_actualizacion = models.DateTimeField(auto_now=True)     # Se actualiza en cada save()

    class Meta:
        db_table = 'activos_fijos'           # Nombre real de la tabla en PostgreSQL
        verbose_name = 'Activo Fijo'
        verbose_name_plural = 'Activos Fijos'
        ordering = ['codigo_patrimonial']    # Por defecto, lista ordenada por código

    def __str__(self):
        """Representación en texto del activo (se usa en el admin de Django)."""
        return f"{self.codigo_patrimonial} - {self.nombre}"

    @property
    def valor_depreciado(self):
        """
        Calcula el valor actual del activo considerando la depreciación acumulada.

        Fórmula:
          depreciacion = valor_compra × (porcentaje_anual / 100) × años_de_uso
          valor_actual = valor_compra - depreciacion

        El valor mínimo es 0 (nunca puede ser negativo).
        Este es un @property: se accede como atributo, no como función.
        """
        anios_uso = (timezone.now().date() - self.fecha_adquisicion).days / 365
        depreciacion = self.valor_adquisicion * (self.porcentaje_depreciacion / 100) * Decimal(str(anios_uso))
        valor = self.valor_adquisicion - depreciacion
        return max(valor, Decimal('0'))  # No puede ser negativo

    @property
    def porcentaje_depreciado(self):
        """
        Calcula qué porcentaje del valor original ya se ha depreciado.
        El máximo es 100% (activo totalmente depreciado).
        """
        anios_uso = (timezone.now().date() - self.fecha_adquisicion).days / 365
        porcentaje = float(self.porcentaje_depreciacion) * anios_uso
        return min(porcentaje, 100)  # No puede superar el 100%


class AsignacionActivo(models.Model):
    """
    Registra a quién está asignado un activo fijo en un momento dado.

    Una asignación indica que un activo específico está bajo la
    responsabilidad de un usuario en un departamento.

    Cuando se crea una nueva asignación para un activo, la asignación
    anterior se desactiva automáticamente (activa=False), manteniendo
    el historial completo de asignaciones.

    La asignación también se registra en blockchain para trazabilidad.
    """

    # El activo que se asigna. CASCADE: si se borra el activo, se borran sus asignaciones
    activo = models.ForeignKey(ActivoFijo, on_delete=models.CASCADE, related_name='asignaciones')

    # A quién se le asigna. PROTECT: no deja borrar usuarios con asignaciones activas
    usuario = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.PROTECT, related_name='asignaciones_activos'
    )

    # Departamento donde estará el activo
    departamento = models.ForeignKey(
        'usuarios.Departamento', on_delete=models.PROTECT, related_name='asignaciones_activos'
    )

    fecha_asignacion = models.DateField(auto_now_add=True)          # Se pone automáticamente al crear
    fecha_devolucion = models.DateField(null=True, blank=True)       # Se llena cuando se devuelve el activo
    observaciones = models.TextField(blank=True)                      # Notas adicionales

    # Quién registró esta asignación en el sistema
    registrado_por = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.PROTECT, related_name='asignaciones_registradas'
    )

    # Hash de trazabilidad blockchain
    hash_blockchain = models.CharField(max_length=256, blank=True)

    activa = models.BooleanField(default=True)  # True = asignación vigente, False = histórico

    class Meta:
        db_table = 'asignaciones_activos'
        verbose_name = 'Asignación de Activo'
        verbose_name_plural = 'Asignaciones de Activos'
        ordering = ['-fecha_asignacion']  # Las más recientes primero

    def __str__(self):
        return f"{self.activo.nombre} → {self.usuario.nombre_completo}"
