# ============================================================
# apps/blockchain/services.py - Servicio de Integración con Blockchain
# ============================================================
# Este es el archivo más importante del módulo blockchain.
# Contiene la clase BlockchainService que es el puente entre
# Django (Python) y la blockchain Ethereum (Hardhat/Ganache).
#
# ¿Cómo funciona el sistema blockchain?
# ======================================
# 1. Cuando ocurre un evento (ej: solicitud creada):
#    a) Se toman los datos del evento (número, solicitante, fecha, etc.)
#    b) Se calcula su hash SHA-256 (huella digital única de esos datos)
#    c) Se envía ese hash al smart contract GestionActivos.sol en la blockchain
#    d) La blockchain registra el hash de forma INMUTABLE
#    e) Se guarda localmente en PostgreSQL (tabla RegistroBlockchain)
#
# 2. Para verificar integridad:
#    a) Se calcula el hash actual de los datos del objeto
#    b) Se compara con el hash guardado en la BD y/o blockchain
#    c) Si coinciden → datos íntegros. Si no → datos fueron alterados.
#
# Modo de operación:
#   - Con blockchain: usa Web3.py para conectar a Hardhat/Ganache local
#   - Sin blockchain: solo guarda el hash en PostgreSQL (modo hash-only)
#     El sistema funciona aunque blockchain esté apagada.
# ============================================================

import hashlib      # Para generar el hash SHA-256
import json         # Para serializar los datos a JSON antes de hashear
import logging      # Para registrar advertencias y errores sin detener el programa
from datetime import datetime
from django.conf import settings  # Para leer variables de configuración del .env

# Logger del módulo: muestra mensajes en la consola del servidor Django
logger = logging.getLogger(__name__)


class BlockchainService:
    """
    Servicio de blockchain híbrida para el Sistema WEG.

    MODO HÍBRIDO:
      - Blockchain Privada: Hardhat/Ganache local (sin costo, alta velocidad, solo desarrollo)
      - Blockchain Pública: Ethereum Sepolia testnet (para auditoría externa)

    Si la red blockchain no está disponible, el servicio opera en "modo hash-only":
    calcula y guarda el hash SHA-256 localmente pero no lo envía a blockchain.

    Esto garantiza que el sistema nunca falla por culpa de la blockchain.
    """

    def __init__(self):
        """
        Constructor: se llama al instanciar BlockchainService().
        Inicializa web3 y el contrato en None, luego intenta conectar.
        """
        self.web3 = None       # Instancia de Web3 (conexión a blockchain)
        self.contract = None   # Referencia al smart contract GestionActivos
        self._init_web3()      # Intenta establecer la conexión

    def _init_web3(self):
        """
        Intenta conectar con la blockchain local (Hardhat/Ganache).

        Pasos:
          1. Importa Web3 (librería Python para interactuar con Ethereum)
          2. Lee la URL del nodo blockchain desde settings (variable GANACHE_URL)
          3. Crea una conexión HTTPProvider (protocolo de comunicación)
          4. Verifica si la conexión es exitosa con is_connected()
          5. Si está conectado, carga el contrato inteligente
          6. Si no está conectado, pone web3=None (modo hash-only)

        El try/except captura cualquier error (ej: web3 no instalado, puerto cerrado)
        y permite al sistema continuar funcionando.
        """
        try:
            from web3 import Web3
            ganache_url = getattr(settings, 'GANACHE_URL', 'http://127.0.0.1:8545')
            self.web3 = Web3(Web3.HTTPProvider(ganache_url))
            if self.web3.is_connected():
                logger.info("Conectado a blockchain local")
                self._load_contract()  # Carga el ABI y dirección del contrato
            else:
                logger.warning("Blockchain local no disponible - operando en modo hash-only")
                self.web3 = None  # Sin blockchain, funciona igual pero sin registro en cadena
        except Exception as e:
            logger.warning(f"Error inicializando Web3: {e}")
            self.web3 = None

    def _load_contract(self):
        """
        Carga la referencia al smart contract GestionActivos en blockchain.

        Para interactuar con un contrato inteligente desde Python se necesitan:
          1. La DIRECCIÓN del contrato (dónde vive en la blockchain)
          2. El ABI (Application Binary Interface): descripción de las funciones
             del contrato (nombres, parámetros, tipos de retorno)

        CONTRACT_ADDRESS viene del archivo backend/.env después del despliegue.

        El ABI aquí solo incluye las funciones que el backend usa:
          - registrarEvento: guardar un evento en blockchain
          - obtenerEvento: recuperar datos de un evento
        (el ABI completo estaría en blockchain/artifacts/)
        """
        try:
            contract_address = getattr(settings, 'CONTRACT_ADDRESS', '')
            if not contract_address:
                return  # Si no hay dirección configurada, no hace nada

            # ABI parcial del contrato GestionActivos (solo las funciones necesarias)
            ABI = [
                {
                    # Función registrarEvento(uint256 _id, string _hashDatos, string _tipo)
                    "inputs": [
                        {"internalType": "uint256", "name": "_id", "type": "uint256"},
                        {"internalType": "string", "name": "_hashDatos", "type": "string"},
                        {"internalType": "string", "name": "_tipo", "type": "string"}
                    ],
                    "name": "registrarEvento",
                    "outputs": [],
                    "stateMutability": "nonpayable",  # Modifica estado (cuesta gas)
                    "type": "function"
                },
                {
                    # Función obtenerEvento(uint256 _id) → (string, uint256, string)
                    "inputs": [{"internalType": "uint256", "name": "_id", "type": "uint256"}],
                    "name": "obtenerEvento",
                    "outputs": [
                        {"internalType": "string", "name": "hashDatos", "type": "string"},
                        {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                        {"internalType": "string", "name": "tipo", "type": "string"}
                    ],
                    "stateMutability": "view",  # Solo lectura (no cuesta gas)
                    "type": "function"
                }
            ]

            # to_checksum_address convierte la dirección al formato estándar de Ethereum
            self.contract = self.web3.eth.contract(
                address=self.web3.to_checksum_address(contract_address),
                abi=ABI
            )
        except Exception as e:
            logger.warning(f"Error cargando contrato: {e}")

    def _generar_hash(self, datos: dict) -> str:
        """
        Genera el hash SHA-256 de un diccionario de datos.

        Proceso:
          1. Convierte el dict a JSON con claves ordenadas (sort_keys=True)
             Esto es crítico: el mismo dict siempre produce el mismo JSON
          2. Codifica el texto a bytes UTF-8
          3. Calcula el hash SHA-256
          4. Retorna el hash en formato hexadecimal (64 caracteres)

        Ejemplo:
          datos = {"nombre": "Juan", "monto": 100}
          → JSON: '{"monto": 100, "nombre": "Juan"}' (ordenado!)
          → hash: "a3f2b1c9d8e7f6a5..."
        """
        datos_str = json.dumps(datos, sort_keys=True, default=str, ensure_ascii=False)
        return hashlib.sha256(datos_str.encode('utf-8')).hexdigest()

    def _registrar_en_blockchain(self, evento_id: int, hash_datos: str, tipo: str) -> str:
        """
        Envía el hash a la blockchain a través del smart contract.

        Pasos:
          1. Verifica que hay conexión activa y contrato cargado
          2. Obtiene la primera cuenta disponible (deployer account en Hardhat)
          3. Llama a la función registrarEvento() del smart contract
          4. Espera confirmación de la transacción (wait_for_transaction_receipt)
          5. Retorna el hash de la transacción (tx_hash) para guardar en la BD

        Si algo falla, retorna cadena vacía (no interrumpe el flujo del sistema).
        """
        if not self.web3 or not self.contract:
            return ""  # Sin blockchain disponible, retorna vacío
        try:
            account = self.web3.eth.accounts[0]  # Cuenta del deployer en Hardhat local
            # Construye y envía la transacción al contrato
            tx = self.contract.functions.registrarEvento(
                evento_id, hash_datos, tipo
            ).transact({'from': account, 'gas': 200000})  # 200000 unidades de gas máximo

            # Espera a que la transacción sea procesada (minada) por la blockchain
            receipt = self.web3.eth.wait_for_transaction_receipt(tx)

            # transactionHash es bytes, .hex() lo convierte a string legible
            return receipt['transactionHash'].hex()
        except Exception as e:
            logger.error(f"Error registrando en blockchain: {e}")
            return ""

    def _guardar_registro(self, tipo_evento, datos, hash_datos, tx_hash, usuario, entidad_tipo, entidad_id):
        """
        Guarda el registro del evento en la base de datos local (PostgreSQL).

        Este espejo local permite:
          - Buscar registros sin consultar blockchain
          - Funcionar cuando blockchain está desconectada
          - Mostrar historial en la página Blockchain del frontend
        """
        from .models import RegistroBlockchain
        return RegistroBlockchain.objects.create(
            tipo_evento=tipo_evento,
            datos_json=datos,         # Datos originales en JSON
            hash_datos=hash_datos,    # Hash SHA-256 de los datos
            tx_hash=tx_hash,          # Hash de la transacción (vacío si sin blockchain)
            usuario=usuario,          # Usuario que causó el evento
            entidad_tipo=entidad_tipo,# Tipo de entidad (ej: 'SolicitudMaterial')
            entidad_id=entidad_id,    # ID de la entidad en la BD
            red='LOCAL' if self.web3 else 'LOCAL',
        )

    # =========================================================
    # MÉTODOS PÚBLICOS - Llamados desde otras apps del backend
    # =========================================================

    def registrar_solicitud(self, solicitud):
        """
        Registra en blockchain la creación de una solicitud de material.

        Los datos que se hashean incluyen los campos más importantes de la solicitud
        para que cualquier modificación posterior sea detectable.

        Retorna: (hash_datos, tx_hash) para guardar en el modelo de la solicitud.
        """
        datos = {
            'numero': solicitud.numero,
            'solicitante': str(solicitud.solicitante),
            'departamento': str(solicitud.departamento),
            'fecha': str(solicitud.fecha_creacion),
            'estado': solicitud.estado,
            'motivo': solicitud.motivo,
        }
        hash_datos = self._generar_hash(datos)
        tx_hash = self._registrar_en_blockchain(solicitud.id, hash_datos, 'SOLICITUD_CREADA')
        self._guardar_registro(
            'SOLICITUD_CREADA', datos, hash_datos, tx_hash,
            solicitud.solicitante, 'SolicitudMaterial', solicitud.id
        )
        return hash_datos, tx_hash

    def registrar_cambio_estado(self, solicitud, nuevo_estado, usuario):
        """
        Registra en blockchain cuando una solicitud cambia de estado.

        Guarda el estado anterior y el nuevo estado para crear una
        cadena auditable de cambios: PENDIENTE → APROBADO → ENTREGADO.

        Se llama desde: aprobar(), rechazar(), entregar() en solicitudes/views.py
        """
        datos = {
            'numero': solicitud.numero,
            'estado_anterior': solicitud.estado,
            'nuevo_estado': nuevo_estado,
            'usuario': str(usuario),
            'fecha': str(datetime.now()),
        }
        hash_datos = self._generar_hash(datos)
        tipo = f'SOLICITUD_{nuevo_estado}'  # Ej: 'SOLICITUD_APROBADO'
        tx_hash = self._registrar_en_blockchain(solicitud.id, hash_datos, tipo)
        self._guardar_registro(tipo, datos, hash_datos, tx_hash, usuario, 'SolicitudMaterial', solicitud.id)
        return hash_datos, tx_hash

    def registrar_activo(self, activo):
        """
        Registra en blockchain la creación de un activo fijo.

        Hashea los datos más importantes del activo para garantizar
        que no sean modificados retroactivamente sin dejar rastro.

        Se llama desde: activos/views.py → perform_create()
        """
        datos = {
            'codigo_patrimonial': activo.codigo_patrimonial,
            'nombre': activo.nombre,
            'tipo': activo.tipo,
            'valor': str(activo.valor_adquisicion),
            'fecha_adquisicion': str(activo.fecha_adquisicion),
            'departamento': str(activo.departamento),
        }
        hash_datos = self._generar_hash(datos)
        tx_hash = self._registrar_en_blockchain(activo.id, hash_datos, 'ACTIVO_REGISTRADO')
        self._guardar_registro(
            'ACTIVO_REGISTRADO', datos, hash_datos, tx_hash, None, 'ActivoFijo', activo.id
        )
        return hash_datos, tx_hash

    def registrar_asignacion(self, asignacion):
        """
        Registra en blockchain la asignación de un activo a un usuario.

        Se llama desde: activos/views.py → AsignacionActivoViewSet.perform_create()
        """
        datos = {
            'activo': str(asignacion.activo),
            'usuario': str(asignacion.usuario),
            'departamento': str(asignacion.departamento),
            'fecha': str(asignacion.fecha_asignacion),
        }
        hash_datos = self._generar_hash(datos)
        tx_hash = self._registrar_en_blockchain(asignacion.id, hash_datos, 'ACTIVO_ASIGNADO')
        self._guardar_registro(
            'ACTIVO_ASIGNADO', datos, hash_datos, tx_hash,
            asignacion.registrado_por, 'AsignacionActivo', asignacion.id
        )
        return hash_datos, tx_hash

    def registrar_movimiento(self, movimiento):
        """
        Registra en blockchain un movimiento de inventario (entrada/salida/ajuste).

        Guarda información completa: qué material, tipo de movimiento,
        cantidad, stock antes y después del movimiento.

        Se llama desde: materiales/views.py → MovimientoInventarioViewSet.perform_create()
        """
        datos = {
            'material': str(movimiento.material),
            'tipo': movimiento.tipo,             # ENTRADA, SALIDA, AJUSTE, DEVOLUCION
            'cantidad': str(movimiento.cantidad),
            'stock_anterior': str(movimiento.stock_anterior),
            'stock_posterior': str(movimiento.stock_posterior),
            'referencia': movimiento.referencia, # Nro. de solicitud o documento
            'fecha': str(movimiento.fecha),
        }
        hash_datos = self._generar_hash(datos)
        tx_hash = self._registrar_en_blockchain(movimiento.id, hash_datos, 'MOVIMIENTO_INVENTARIO')
        self._guardar_registro(
            'MOVIMIENTO_INVENTARIO', datos, hash_datos, tx_hash,
            movimiento.usuario, 'MovimientoInventario', movimiento.id
        )
        return hash_datos, tx_hash

    def verificar_integridad(self, query_hash: str) -> dict:
        """
        Verifica si un hash SHA-256 o Transaction Hash existe en los registros blockchain locales.
        Soporta búsquedas por coincidencia exacta, parcial, prefijo/sufijo o hashes truncados con '...'.
        """
        from .models import RegistroBlockchain
        from django.db.models import Q

        if not query_hash:
            return {'valido': False, 'mensaje': 'Debe proporcionar un hash'}

        raw = str(query_hash).strip()
        
        # 1. Búsqueda exacta inicial
        registro = RegistroBlockchain.objects.filter(
            Q(hash_datos__iexact=raw) | Q(tx_hash__iexact=raw)
        ).first()

        # 2. Si contiene puntos de truncación '...' o '…', separar prefijo y sufijo
        if not registro and ('...' in raw or '…' in raw or '..' in raw):
            parts = [p.strip() for p in raw.replace('…', '...').replace('..', '.').split('.') if p.strip()]
            if len(parts) >= 2:
                prefix, suffix = parts[0], parts[-1]
                registro = RegistroBlockchain.objects.filter(
                    (Q(hash_datos__istartswith=prefix) & Q(hash_datos__iendswith=suffix)) |
                    (Q(tx_hash__istartswith=prefix) & Q(tx_hash__iendswith=suffix))
                ).first()
            elif len(parts) == 1:
                clean_term = parts[0]
                registro = RegistroBlockchain.objects.filter(
                    Q(hash_datos__istartswith=clean_term) | Q(tx_hash__istartswith=clean_term) |
                    Q(hash_datos__icontains=clean_term) | Q(tx_hash__icontains=clean_term)
                ).first()

        # 3. Búsqueda limpia por prefijo o contiene (sin puntos)
        cleaned = raw.replace('.', '').replace('…', '').strip()
        if not registro and cleaned:
            registro = RegistroBlockchain.objects.filter(
                Q(hash_datos__istartswith=cleaned) | Q(tx_hash__istartswith=cleaned) |
                Q(hash_datos__icontains=cleaned) | Q(tx_hash__icontains=cleaned)
            ).first()

        # 4. Si aún no encuentra en RegistroBlockchain, buscar en los modelos principales que guardan hash_blockchain
        if not registro and cleaned:
            try:
                from apps.solicitudes.models import SolicitudMaterial
                sol = SolicitudMaterial.objects.filter(
                    Q(hash_blockchain__icontains=cleaned) | Q(tx_hash__icontains=cleaned)
                ).first()
                if sol:
                    registro = RegistroBlockchain.objects.filter(entidad_tipo='SolicitudMaterial', entidad_id=sol.id).first()
            except Exception:
                pass

            if not registro:
                try:
                    from apps.materiales.models import MovimientoInventario
                    mov = MovimientoInventario.objects.filter(
                        Q(hash_blockchain__icontains=cleaned)
                    ).first()
                    if mov:
                        registro = RegistroBlockchain.objects.filter(entidad_tipo='MovimientoInventario', entidad_id=mov.id).first()
                except Exception:
                    pass

            if not registro:
                try:
                    from apps.activos.models import ActivoFijo
                    act = ActivoFijo.objects.filter(
                        Q(hash_blockchain__icontains=cleaned)
                    ).first()
                    if act:
                        registro = RegistroBlockchain.objects.filter(entidad_tipo='ActivoFijo', entidad_id=act.id).first()
                except Exception:
                    pass

        if registro:
            return {
                'valido': True,
                'id': registro.id,
                'tipo_evento': registro.get_tipo_evento_display() if hasattr(registro, 'get_tipo_evento_display') else registro.tipo_evento,
                'tipo_evento_code': registro.tipo_evento,
                'hash_datos': registro.hash_datos,
                'tx_hash': registro.tx_hash,
                'fecha': registro.fecha.strftime('%d/%m/%Y %H:%M:%S') if registro.fecha else '',
                'red': registro.get_red_display() if hasattr(registro, 'get_red_display') else registro.red,
                'usuario_nombre': registro.usuario.nombre if (registro.usuario and getattr(registro.usuario, 'nombre', None)) else (registro.usuario.email if registro.usuario else 'Sistema'),
                'entidad_tipo': registro.entidad_tipo,
                'entidad_id': registro.entidad_id,
                'datos_json': registro.datos_json,
            }

        return {'valido': False, 'mensaje': f'Hash no encontrado en los registros auditables del sistema'}
