# ============================================================
# asegurar_contrato.py - Despliega el contrato si todavía no existe
# ============================================================
# Se ejecuta al arrancar el contenedor del backend (docker/entrypoint.sh).
#
#   - Si no hay nodo blockchain disponible: avisa y sigue (modo hash-only).
#   - Si ya hay código en CONTRACT_ADDRESS: no hace nada.
#   - Si la cadena está vacía: despliega GestionActivos con la cuenta 0.
#
# Ganache usa el mismo mnemónico de Hardhat, así que el primer despliegue
# de la cuenta 0 siempre queda en 0x5FbDB2315678afecb367f032d93F642f64180aa3,
# la misma dirección que se usa en desarrollo.
#
# Uso manual: python manage.py asegurar_contrato
# ============================================================

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

ARTEFACTO = Path(__file__).resolve().parents[2] / 'contrato' / 'GestionActivos.json'


class Command(BaseCommand):
    help = 'Despliega el contrato GestionActivos si no existe en la red configurada'

    def handle(self, *args, **options):
        from web3 import Web3

        web3 = Web3(Web3.HTTPProvider(settings.GANACHE_URL))
        if not web3.is_connected():
            self.stdout.write(self.style.WARNING(
                f'Blockchain no disponible en {settings.GANACHE_URL}: modo hash-only'))
            return

        direccion = settings.CONTRACT_ADDRESS
        if direccion and web3.eth.get_code(Web3.to_checksum_address(direccion)):
            self.stdout.write(f'Contrato ya desplegado en {direccion}')
            return

        cuenta = web3.eth.accounts[0]
        if web3.eth.get_transaction_count(cuenta) > 0:
            # La cuenta ya hizo transacciones pero no hay contrato en la dirección
            # configurada: no se despliega otro a ciegas.
            self.stdout.write(self.style.ERROR(
                f'No hay contrato en CONTRACT_ADDRESS={direccion!r} y la cuenta {cuenta} '
                'ya tiene transacciones. Revise CONTRACT_ADDRESS en el .env.'))
            return

        artefacto = json.loads(ARTEFACTO.read_text(encoding='utf-8'))
        contrato = web3.eth.contract(abi=artefacto['abi'], bytecode=artefacto['bytecode'])
        tx = contrato.constructor().transact({'from': cuenta})
        recibo = web3.eth.wait_for_transaction_receipt(tx)
        nueva = recibo['contractAddress']

        self.stdout.write(self.style.SUCCESS(f'Contrato GestionActivos desplegado en {nueva}'))
        if not direccion or nueva.lower() != direccion.lower():
            self.stdout.write(self.style.WARNING(
                f'CONTRACT_ADDRESS no coincide: ponga CONTRACT_ADDRESS={nueva} en el .env '
                'y reinicie el backend.'))
