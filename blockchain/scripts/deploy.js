// ============================================================
// deploy.js - Script de despliegue del Smart Contract
// ============================================================
// Este script utiliza Hardhat + Ethers.js para compilar y
// desplegar el contrato GestionActivos en la red blockchain
// configurada (por defecto: red local Hardhat en localhost:8545)
//
// ¿Cuándo se ejecuta?
//   npx hardhat run scripts/deploy.js --network localhost
//
// ¿Qué hace paso a paso?
//   1. Obtiene la cuenta que va a firmar el despliegue (deployer)
//   2. Muestra su dirección y balance en ETH
//   3. Compila y despliega el contrato GestionActivos
//   4. Espera a que la transacción sea confirmada por la red
//   5. Muestra la dirección final del contrato desplegado
//   6. Indica cómo copiar esa dirección al archivo backend/.env
// ============================================================

const { ethers } = require("hardhat");
// Importa ethers desde hardhat para interactuar con la blockchain

async function main() {
  console.log("Desplegando contrato GestionActivos...");

  // Obtiene la lista de cuentas disponibles en la red y toma la primera
  // En Hardhat local, hay 20 cuentas preconfiguradas con ETH de prueba
  const [deployer] = await ethers.getSigners();
  console.log("Cuenta de despliegue:", deployer.address);
  // Muestra el balance de ETH de la cuenta desplegadora (en formato legible)
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // Obtiene la "fábrica" del contrato GestionActivos
  // Hardhat compila el .sol y genera el bytecode + ABI automáticamente
  const GestionActivos = await ethers.getContractFactory("GestionActivos");

  // Despliega el contrato: envía una transacción especial a la blockchain
  // que contiene el bytecode compilado del contrato
  const contrato = await GestionActivos.deploy();

  // Espera a que la transacción de despliegue sea minada (confirmada)
  await contrato.waitForDeployment();

  // Obtiene la dirección donde quedó desplegado el contrato en la blockchain
  // Esta dirección es permanente y única en esa red
  const address = await contrato.getAddress();
  console.log("\n=== Contrato desplegado exitosamente ===");
  console.log("Direccion del contrato:", address);

  // Instrucción importante: esta dirección debe copiarse en el .env del backend
  // para que el servicio blockchain de Python sepa con qué contrato hablar
  console.log("\nCopie esta direccion en backend/.env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

// Ejecuta la función main y maneja errores
// Si todo va bien, termina el proceso con código 0 (éxito)
// Si hay un error, lo muestra y termina con código 1 (fallo)
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
