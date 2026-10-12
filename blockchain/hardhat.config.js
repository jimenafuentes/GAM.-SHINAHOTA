// ============================================================
// hardhat.config.js - Configuración del entorno Hardhat
// ============================================================
// Hardhat es el framework de desarrollo para contratos inteligentes.
// Este archivo le dice a Hardhat:
//   1. Qué versión del compilador Solidity usar
//   2. A qué redes blockchain puede conectarse
//   3. Dónde están los archivos del proyecto (contratos, tests, etc.)
//
// Comandos comunes de Hardhat:
//   npx hardhat node              → Inicia la red blockchain local en puerto 8545
//   npx hardhat compile           → Compila los contratos .sol
//   npx hardhat run scripts/deploy.js --network localhost → Despliega el contrato
//   npx hardhat test              → Ejecuta los tests
// ============================================================

require("@nomicfoundation/hardhat-toolbox");
// Importa el conjunto de herramientas de Hardhat:
// incluye ethers.js, waffle para tests, coverage de código, etc.

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // Configuración del compilador de Solidity
  solidity: {
    version: "0.8.19", // Versión exacta del compilador (debe coincidir con pragma del .sol)
    settings: {
      optimizer: {
        enabled: true,  // Activa el optimizador de bytecode
        runs: 200       // Optimiza para 200 ejecuciones (balance entre tamaño y velocidad)
      }
    }
  },

  // Redes donde se puede desplegar el contrato
  networks: {
    // Red local para desarrollo (se inicia con: npx hardhat node)
    // El backend conecta aquí durante el desarrollo
    localhost: {
      url: "http://127.0.0.1:8545", // Puerto por defecto de Hardhat Node
    },

    // Red interna de Hardhat (para tests automáticos, se crea en memoria)
    // chainId 1337 es el ID estándar para redes de desarrollo local
    hardhat: {
      chainId: 1337,
    },
  },

  // Rutas de las carpetas del proyecto blockchain
  paths: {
    sources: "./contracts",  // Aquí están los archivos .sol (smart contracts)
    tests: "./test",         // Aquí irían los tests del contrato
    cache: "./cache",        // Caché de compilación (generado automáticamente)
    artifacts: "./artifacts", // ABI y bytecode compilados (generados automáticamente)
  },
};
