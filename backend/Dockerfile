FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Los estáticos (admin de Django, Swagger) se sirven con WhiteNoise desde la imagen
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && sed -i 's/\r$//' docker/entrypoint.sh \
    && chmod +x docker/entrypoint.sh \
    && mkdir -p /app/media

EXPOSE 8000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
