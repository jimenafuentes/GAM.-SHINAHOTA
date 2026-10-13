#!/usr/bin/env bash
# Deploy en el VPS: baja las imágenes del commit actual desde ghcr.io y levanta.
# Uso: bash deploy.sh
#
# Todo va dentro de main() para que el git pull, que puede reescribir este
# mismo archivo, no rompa el script mientras corre.

main() {
    set -euo pipefail
    cd "$(dirname "$0")"

    local servicios=(backend frontend)
    local origen="https://github.com/jimenafuentes/GAM.-SHINAHOTA"

    if [ ! -f .env ]; then
        echo "Falta el archivo .env (copiar .env.example y completarlo)."
        exit 1
    fi

    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "Hay cambios sin commitear en el servidor; no se hace deploy:"
        git status --short
        exit 1
    fi

    git pull --ff-only

    TAG="$(git rev-parse HEAD)"
    export TAG
    echo "Desplegando ${TAG}"

    # Si GitHub Actions todavía está construyendo, reintenta cada 30 s hasta 15 min
    local intento max=30
    for ((intento = 1; intento <= max; intento++)); do
        if docker compose pull "${servicios[@]}"; then
            break
        fi
        if ((intento == max)); then
            echo "Las imágenes de ${TAG} no aparecieron en ghcr.io después de 15 min."
            echo "Revisa GitHub Actions. Producción sigue con la versión anterior."
            exit 1
        fi
        echo "Imágenes aún no disponibles (intento ${intento}/${max}); reintentando en 30 s..."
        sleep 30
    done

    docker compose pull --ignore-pull-failures db ganache || true
    docker compose up -d --no-build --remove-orphans

    # Limpia solo imágenes viejas de ESTE proyecto, sin tocar las de otros sistemas
    docker image prune -f --filter "label=org.opencontainers.image.source=${origen}" >/dev/null || true
    local en_uso
    en_uso="$(docker compose images -q | sort -u)"
    docker images -q --filter "label=org.opencontainers.image.source=${origen}" | sort -u | while read -r id; do
        if ! grep -qx "$id" <<<"$en_uso"; then
            docker rmi "$id" >/dev/null 2>&1 || true
        fi
    done

    docker compose ps
    echo "Deploy listo: ${TAG}"
}

main "$@"
