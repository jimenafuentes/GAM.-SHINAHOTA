#!/bin/sh
# Arranque del backend en Docker: espera la BD, migra, asegura el contrato
# y levanta gunicorn.
set -e

echo "Esperando a PostgreSQL en ${DB_HOST}:${DB_PORT}..."
until python -c "import psycopg2, os; psycopg2.connect(host=os.environ['DB_HOST'], port=os.environ['DB_PORT'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'], dbname=os.environ['DB_NAME']).close()" 2>/dev/null; do
    sleep 2
done

# Con el dump restaurado, django_migrations ya está al día y esto no cambia nada;
# solo aplica migraciones nuevas que vengan en el commit.
python manage.py migrate --noinput

python manage.py asegurar_contrato || echo "No se pudo verificar el contrato; se sigue en modo hash-only"

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout 120 \
    --access-logfile -
