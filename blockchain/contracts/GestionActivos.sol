// SPDX-License-Identifier: MIT
// Licencia de código abierto MIT - permite usar, copiar y modificar el código libremente

pragma solidity ^0.8.19;
// Versión del compilador de Solidity requerida (0.8.19 o superior)

/**
 * @title GestionActivos
 * @dev Smart Contract para el Sistema WEG - Alcaldía de Shinahota
 * @notice Registra de forma inmutable eventos del sistema de activos fijos y solicitudes.
 *
 * ¿Qué hace este contrato?
 * ------------------------
 * Este contrato inteligente vive en la blockchain (red Ethereum/Hardhat local).
 * Su función principal es guardar "huellas digitales" (hashes SHA-256) de los eventos
 * del sistema (solicitudes, activos, asignaciones) de forma que NADIE pueda alterarlos
 * después de registrarlos. Esto garantiza la trazabilidad y auditoría del sistema.
 *
 * Funciones principales:
 *  - registrarEvento()  → guarda el hash de un evento (solicitud, movimiento, etc.)
 *  - registrarActivo()  → registra un activo fijo por primera vez en la blockchain
 *  - verificarHash()    → comprueba si un hash ya existe en la cadena
 *  - obtenerEvento()    → devuelve los datos de un evento por su ID
 *  - obtenerActivo()    → devuelve los datos de un activo por su código patrimonial
 */
contract GestionActivos {

    // Dirección del propietario del contrato (quien lo desplegó)
    address public owner;

    // Contador total de eventos registrados en la blockchain
    uint256 public totalEventos;

    /**
     * Estructura Evento:
     * Representa un evento del sistema (ej: solicitud creada, activo registrado)
     * Cada evento guarda:
     *   - id:            ID del objeto en la base de datos Django
     *   - hashDatos:     Huella digital SHA-256 de los datos del evento
     *   - tipoEvento:    Categoría del evento (SOLICITUD_CREADA, ACTIVO_REGISTRADO, etc.)
     *   - registradoPor: Dirección Ethereum que ejecutó la transacción
     *   - timestamp:     Fecha/hora en que se registró en la blockchain (segundo Unix)
     *   - existe:        Bandera para saber si el evento fue creado (evita confusión con vacíos)
     */
    struct Evento {
        uint256 id;
        string hashDatos;       // SHA-256 hash de los datos del evento
        string tipoEvento;      // Tipo: SOLICITUD_CREADA, ACTIVO_REGISTRADO, etc.
        address registradoPor;  // Dirección que registró el evento
        uint256 timestamp;      // Timestamp de la blockchain
        bool existe;
    }

    /**
     * Estructura ActivoFijo:
     * Representa un activo fijo registrado en la blockchain.
     * Se usa el código patrimonial como identificador único.
     *   - codigoPatrimonial: Código único del activo (ej: "ACT-2024-001")
     *   - hashDatos:         Huella digital de los datos del activo al momento de registro
     *   - timestamp:         Cuándo fue registrado en la blockchain
     *   - registradoPor:     Quién ejecutó la transacción
     *   - existe:            Previene registrar el mismo activo dos veces
     */
    struct ActivoFijo {
        string codigoPatrimonial;
        string hashDatos;
        uint256 timestamp;
        address registradoPor;
        bool existe;
    }

    // Mapeo: ID de evento (número) → datos del Evento
    // Permite buscar un evento dado su número interno
    mapping(uint256 => Evento) public eventos;

    // Mapeo: código patrimonial (texto) → datos del ActivoFijo
    // Permite buscar un activo por su código único
    mapping(string => ActivoFijo) public activos;

    // Mapeo: hash SHA-256 → lista de IDs de eventos asociados a ese hash
    // Útil para verificar cuántos eventos tienen el mismo hash (integridad)
    mapping(string => uint256[]) public hashAEventos; // hash -> lista de event IDs

    // =========================================================
    // EVENTOS DE SOLIDITY (notificaciones que emite el contrato)
    // Estos eventos quedan registrados en los logs de la blockchain
    // y permiten al backend saber qué pasó en cada transacción
    // =========================================================

    // Se emite cuando se registra un nuevo evento del sistema
    event EventoRegistrado(
        uint256 indexed id,     // ID indexado para búsqueda rápida
        string hashDatos,
        string tipoEvento,
        address registradoPor,
        uint256 timestamp
    );

    // Se emite cuando se registra un activo fijo en la blockchain
    event ActivoRegistrado(
        string indexed codigoPatrimonial, // Código indexado para búsqueda rápida
        string hashDatos,
        address registradoPor,
        uint256 timestamp
    );

    /**
     * Modificador soloOwner:
     * Restringe ciertas funciones para que solo el dueño del contrato las ejecute.
     * Si alguien más intenta llamarlas, la transacción se revierte con un mensaje de error.
     * El símbolo _; indica dónde se ejecuta la función protegida.
     */
    modifier soloOwner() {
        require(msg.sender == owner, "Solo el propietario puede ejecutar esta funcion");
        _;
    }

    /**
     * Constructor:
     * Se ejecuta UNA SOLA VEZ cuando el contrato se despliega en la blockchain.
     * Guarda la dirección del desplegador como "owner" e inicializa el contador.
     * msg.sender = la cuenta Ethereum que firmó la transacción de despliegue.
     */
    constructor() {
        owner = msg.sender;
        totalEventos = 0;
    }

    /**
     * @dev Registra un evento del sistema (solicitud, movimiento, activo, etc.)
     * @param _id       ID del objeto en la base de datos Django
     * @param _hashDatos Hash SHA-256 calculado por el backend con los datos del evento
     * @param _tipo     Tipo de evento (ej: "SOLICITUD_CREADA", "ACTIVO_REGISTRADO")
     *
     * ¿Cómo funciona?
     *  1. Valida que el hash y el tipo no estén vacíos
     *  2. Incrementa el contador global de eventos
     *  3. Crea el struct Evento y lo guarda en el mapeo eventos[]
     *  4. Asocia el hash al ID del evento en hashAEventos[]
     *  5. Emite el evento EventoRegistrado para que el backend lo detecte
     */
    function registrarEvento(
        uint256 _id,
        string memory _hashDatos,
        string memory _tipo
    ) public {
        // Validaciones: los campos no pueden estar vacíos
        require(bytes(_hashDatos).length > 0, "Hash no puede estar vacio");
        require(bytes(_tipo).length > 0, "Tipo no puede estar vacio");

        // Incrementar contador y usar como ID interno del evento en blockchain
        totalEventos++;
        uint256 eventoId = totalEventos;

        // Guardar el evento en el mapeo (almacenamiento permanente en blockchain)
        eventos[eventoId] = Evento({
            id: _id,
            hashDatos: _hashDatos,
            tipoEvento: _tipo,
            registradoPor: msg.sender,  // Quién llamó esta función
            timestamp: block.timestamp, // Timestamp del bloque actual
            existe: true
        });

        // Agregar el ID del evento a la lista del hash correspondiente
        hashAEventos[_hashDatos].push(eventoId);

        // Emitir notificación del evento (queda en los logs de la transacción)
        emit EventoRegistrado(eventoId, _hashDatos, _tipo, msg.sender, block.timestamp);
    }

    /**
     * @dev Registra un activo fijo en la blockchain
     * @param _codigoPatrimonial Código único del activo (ej: "ACT-2024-001")
     * @param _hashDatos         Hash SHA-256 de los datos del activo
     *
     * ¿Cómo funciona?
     *  1. Valida que el código no esté vacío
     *  2. Verifica que el activo NO esté ya registrado (previene duplicados)
     *  3. Guarda el ActivoFijo en el mapeo activos[]
     *  4. Emite el evento ActivoRegistrado
     *
     * Nota: Un activo solo puede registrarse UNA VEZ. Si se intenta registrar
     * un código patrimonial ya existente, la transacción falla.
     */
    function registrarActivo(
        string memory _codigoPatrimonial,
        string memory _hashDatos
    ) public {
        require(bytes(_codigoPatrimonial).length > 0, "Codigo patrimonial requerido");
        // Verifica que el activo no exista previamente
        require(!activos[_codigoPatrimonial].existe, "Activo ya registrado");

        // Guardar el activo en la blockchain de forma permanente
        activos[_codigoPatrimonial] = ActivoFijo({
            codigoPatrimonial: _codigoPatrimonial,
            hashDatos: _hashDatos,
            timestamp: block.timestamp,
            registradoPor: msg.sender,
            existe: true
        });

        emit ActivoRegistrado(_codigoPatrimonial, _hashDatos, msg.sender, block.timestamp);
    }

    /**
     * @dev Obtiene información de un evento por su ID interno de blockchain
     * @param _eventoId ID del evento en la blockchain (no el ID de Django)
     * @return hashDatos    Hash SHA-256 guardado
     * @return tipoEvento   Tipo del evento
     * @return timestamp    Cuándo fue registrado (segundos Unix)
     * @return registradoPor Dirección que lo registró
     *
     * Es una función "view" = solo lectura, no modifica estado, no cuesta gas extra
     */
    function obtenerEvento(uint256 _eventoId) public view returns (
        string memory hashDatos,
        string memory tipoEvento,
        uint256 timestamp,
        address registradoPor
    ) {
        // Verifica que el evento exista antes de retornarlo
        require(eventos[_eventoId].existe, "Evento no encontrado");
        Evento memory e = eventos[_eventoId];
        return (e.hashDatos, e.tipoEvento, e.timestamp, e.registradoPor);
    }

    /**
     * @dev Verifica si un hash SHA-256 ya existe registrado en la blockchain
     * @param _hash Hash SHA-256 a verificar
     * @return existe          true si el hash tiene al menos un evento asociado
     * @return cantidadEventos cuántos eventos tienen ese mismo hash
     *
     * Uso principal: el backend llama esta función para validar integridad de datos.
     * Si el hash calculado en tiempo real coincide con el guardado, los datos no fueron alterados.
     */
    function verificarHash(string memory _hash) public view returns (
        bool existe,
        uint256 cantidadEventos
    ) {
        uint256[] memory ids = hashAEventos[_hash];
        return (ids.length > 0, ids.length);
    }

    /**
     * @dev Obtiene información de un activo por su código patrimonial
     * @param _codigo Código patrimonial del activo (ej: "ACT-2024-001")
     * @return hashDatos     Hash original de los datos del activo al registrarse
     * @return timestamp     Cuándo fue registrado en la blockchain
     * @return registradoPor Dirección que realizó el registro
     *
     * Permite auditar qué datos tenía el activo cuando fue creado originalmente.
     */
    function obtenerActivo(string memory _codigo) public view returns (
        string memory hashDatos,
        uint256 timestamp,
        address registradoPor
    ) {
        require(activos[_codigo].existe, "Activo no encontrado");
        ActivoFijo memory a = activos[_codigo];
        return (a.hashDatos, a.timestamp, a.registradoPor);
    }
}
