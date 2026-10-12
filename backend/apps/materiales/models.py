# ============================================================
# apps/materiales/models.py - Modelos de Inventario de Materiales
# ============================================================
# Este archivo define las tablas del módulo de inventario de materiales
# (suministros y bienes consumibles del almacén).
#
# Diferencia clave con activos:
#   - MATERIALES: bienes consumibles (papel, tintas, herramientas menores, etc.)
#     Se manejan en stock, pueden agotarse, tienen entradas y salidas.
#   - ACTIVOS FIJOS: bienes duraderos (computadoras, vehículos, muebles).
#     Tienen código patrimonial único, se deprecian pero no se "consumen".
#
# Tablas que crea este archivo:
#   - categorias           → clasificación de materiales
#   - proveedores          → empresas proveedoras de materiales
#   - materiales           → catálogo de materiales con su stock actual
#   - movimientos_inventario → historial de entradas/salidas de stock
# ============================================================

from django.db import models


class Categoria(models.Model):
    """
    Clasifica los materiales en grupos lógicos.

    Ejemplos de categorías:
      - Materiales de Escritorio
      - Materiales de Limpieza
      - Herramientas
      - Insumos de Computación
    """
    nombre = models.CharField(max_length=100, unique=True)  # Nombre único de la categoría
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)              # Borrado lógico
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categorias'
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Proveedor(models.Model):
    """
    Empresa o persona que provee materiales al almacén.

    NIT = Número de Identificación Tributaria (Bolivia).
    Se usa para identificar al proveedor y para documentos oficiales.
    """
    nombre = models.CharField(max_length=200)
    nit = models.CharField(max_length=20, blank=True, verbose_name='NIT')  # ID tributario
    contacto = models.CharField(max_length=100, blank=True)  # Nombre del contacto
    telefono = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'proveedores'
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Material(models.Model):
    """
    Representa un artículo/material en el inventario del almacén.

    Cada material tiene:
      - Un código único de identificación interna
      - Stock actual (cuántos hay en este momento)
      - Stock mínimo (si baja de aquí, se genera una alerta)
      - Precio unitario para calcular el valor total del inventario
      - Unidad de medida (unidad, kg, litro, metro, etc.)

    Unidades de medida disponibles:
      UNIDAD, KG, LT (litro), MT (metro), M2, M3, CAJA, PAQUETE, ROLLO, JUEGO, RESMA
    """

    UNIDADES = [
        ('UNIDAD', 'Unidad'),
        ('KG', 'Kilogramo'),
        ('LT', 'Litro'),
        ('MT', 'Metro'),
        ('M2', 'Metro cuadrado'),
        ('M3', 'Metro cúbico'),
        ('CAJA', 'Caja'),
        ('PAQUETE', 'Paquete'),
        ('ROLLO', 'Rollo'),
        ('JUEGO', 'Juego'),
        ('RESMA', 'Resma'),
    ]

    codigo = models.CharField(max_length=50, unique=True, verbose_name='Código')  # Código interno único
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)

    # Relaciones con otras tablas
    # PROTECT: no se puede borrar una categoría si tiene materiales
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='materiales')
    # SET_NULL: si se borra el proveedor, el campo queda en null (el material sigue existiendo)
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True, related_name='materiales')

    unidad_medida = models.CharField(max_length=20, choices=UNIDADES, default='UNIDAD')

    # Control de inventario
    stock_actual = models.DecimalField(max_digits=12, decimal_places=2, default=0)   # Cuánto hay ahora
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=2, default=5)   # Nivel mínimo de alerta
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0) # Precio por unidad

    ubicacion = models.CharField(max_length=100, blank=True, verbose_name='Ubicación en almacén')  # Ej: "Estante A-3"
    imagen = models.ImageField(upload_to='materiales/', null=True, blank=True)

    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'materiales'
        verbose_name = 'Material'
        verbose_name_plural = 'Materiales'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

    @property
    def alerta_stock(self):
        """
        Retorna True si el stock actual está en o por debajo del mínimo.
        El frontend usa esto para mostrar alertas de stock bajo.
        """
        return self.stock_actual <= self.stock_minimo

    @property
    def valor_total(self):
        """
        Calcula el valor total del inventario para este material.
        Ejemplo: 50 unidades × Bs. 25 = Bs. 1250
        """
        return self.stock_actual * self.precio_unitario


class MovimientoInventario(models.Model):
    """
    Registra cada entrada o salida de material en el almacén.

    Tipos de movimiento:
      ENTRADA   → ingreso de materiales al almacén (compra, donación)
      SALIDA    → entrega de materiales a un solicitante
      AJUSTE    → corrección manual del stock (ej: después de un inventario físico)
      DEVOLUCION→ devolución de materiales no utilizados

    Cada movimiento guarda el stock ANTES y DESPUÉS del cambio,
    creando un historial completo y auditable de todo el inventario.

    Los movimientos también se registran en blockchain para garantizar
    que ninguna entrada/salida pueda modificarse retroactivamente.

    Campos blockchain:
      - hash_blockchain: huella digital del movimiento
      - tx_hash: identificador de la transacción en Ethereum
    """

    TIPOS = [
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
        ('AJUSTE', 'Ajuste'),
        ('DEVOLUCION', 'Devolución'),
    ]

    # Material afectado por el movimiento
    # PROTECT: no se puede borrar un material que tiene movimientos históricos
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='movimientos')
    tipo = models.CharField(max_length=20, choices=TIPOS)

    cantidad = models.DecimalField(max_digits=12, decimal_places=2)  # Cuánto entra/sale

    # Auditoría del stock: permite reconstruir el historial completo
    stock_anterior = models.DecimalField(max_digits=12, decimal_places=2)   # Stock ANTES del movimiento
    stock_posterior = models.DecimalField(max_digits=12, decimal_places=2)  # Stock DESPUÉS del movimiento

    # Referencia al documento que origina el movimiento (ej: número de solicitud "2024-0042")
    referencia = models.CharField(max_length=100, blank=True, verbose_name='Nro. Documento/Referencia')
    observaciones = models.TextField(blank=True)

    # Usuario que registró el movimiento (PROTECT: no se borra si tiene movimientos)
    usuario = models.ForeignKey(
        'usuarios.Usuario', on_delete=models.PROTECT, related_name='movimientos_inventario'
    )

    # Solicitud que originó este movimiento de salida (puede ser null para entradas manuales)
    solicitud = models.ForeignKey(
        'solicitudes.SolicitudMaterial', on_delete=models.SET_NULL, null=True, blank=True
    )

    # Campos de trazabilidad blockchain
    hash_blockchain = models.CharField(max_length=256, blank=True)
    tx_hash = models.CharField(max_length=256, blank=True, verbose_name='Transaction Hash')

    fecha = models.DateTimeField(auto_now_add=True)  # Fecha/hora exacta del movimiento

    class Meta:
        db_table = 'movimientos_inventario'
        verbose_name = 'Movimiento de Inventario'
        verbose_name_plural = 'Movimientos de Inventario'
        ordering = ['-fecha']  # Más recientes primero

    def __str__(self):
        return f"{self.tipo} - {self.material.nombre} ({self.cantidad}) - {self.fecha.strftime('%d/%m/%Y')}"
