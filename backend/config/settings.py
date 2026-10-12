# ============================================================
# config/settings.py - Ajustes de Configuración Global de Django
# ============================================================
# Este archivo contiene toda la configuración global del backend para el
# Sistema WEG de la Alcaldía de Shinahota.
#
# Configura e inicializa:
#   1. Variables de entorno seguras con decouple.
#   2. Registro de aplicaciones locales y librerías de terceros (DRF, JWT, CORS, drf-yasg).
#   3. Conexión principal con la base de datos relacional PostgreSQL.
#   4. Modelo de Usuario Personalizado (Usuario con roles).
#   5. Localización en Español de Bolivia (La Paz).
#   6. Políticas de acceso CORS para el frontend en React/Vite.
#   7. Ajustes avanzados de REST Framework (JWT, filtros, búsquedas y paginación).
#   8. Parámetros de comunicación con la red Blockchain local (Hardhat/Ganache).
# ============================================================

from pathlib import Path
from decouple import config
from datetime import timedelta

# Ruta base del proyecto (sistema_weg/backend)
BASE_DIR = Path(__file__).resolve().parent.parent

# --- SEGURIDAD ---
# LLave secreta para criptografía y firmas (se carga de forma segura desde .env)
SECRET_KEY = config('SECRET_KEY', default='django-insecure-fallback-key-change-in-production')
# DEBUG: True en desarrollo, False en producción (se carga desde .env)
DEBUG = config('DEBUG', default=True, cast=bool)
# Hosts permitidos para realizar peticiones al servidor (* permite todos en desarrollo)
ALLOWED_HOSTS = ['*']


# --- APLICACIONES REGISTRADAS ---
INSTALLED_APPS = [
    # Aplicaciones nativas / por defecto de Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Paquetes y herramientas de terceros
    'rest_framework',                               # Framework para construir la API REST
    'rest_framework_simplejwt',                     # Autenticación basada en JSON Web Tokens
    'rest_framework_simplejwt.token_blacklist',     # Permite invalidar tokens (Cerrar sesión)
    'corsheaders',                                  # Manejo de políticas CORS
    'django_filters',                               # Filtros dinámicos de base de datos en la API
    'drf_yasg',                                     # Generador de documentación Swagger de la API
    
    # Aplicaciones locales (Módulos del Sistema WEG)
    'apps.usuarios',                                # Autenticación, Roles y Departamentos
    'apps.materiales',                              # Kardex e Inventario de Materiales
    'apps.activos',                                 # Catálogo e Historial de Activos Fijos
    'apps.solicitudes',                             # Flujo de aprobación de pedidos de material
    'apps.blockchain',                              # Auditoría y Trazabilidad inmutable
    'apps.reportes',                                # Generación de estadísticas y dashboards
]


# --- INTERCEPTORES DE PETICIONES (MIDDLEWARES) ---
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',         # Debe estar al principio para manejar solicitudes CORS
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

# --- MOTOR DE PLANTILLAS ---
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# --- CONEXIÓN DE BASE DE DATOS (PostgreSQL) ---
# Extrae credenciales del archivo .env para proteger accesos en producción
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='sistema_weg'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='12345'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}


# --- MODELO DE USUARIO PERSONALIZADO ---
# Indica a Django que use nuestro modelo personalizado de Usuario en vez del nativo
AUTH_USER_MODEL = 'usuarios.Usuario'


# --- POLÍTICAS DE CONTRASEÑAS ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- INTERNACIONALIZACIÓN Y LOCALIZACIÓN ---
# Idioma de respuesta y administración en Español de Bolivia
LANGUAGE_CODE = 'es-bo'
# Zona horaria local de Bolivia
TIME_ZONE = 'America/La_Paz'
USE_I18N = True
USE_TZ = True


# --- ARCHIVOS ESTÁTICOS Y MULTIMEDIA ---
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Configuración para archivos subidos por los usuarios (fotos de activos, etc.)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- CONFIGURACIÓN CORS (Cross-Origin Resource Sharing) ---
# Permite al frontend React comunicarse con este backend sin bloqueos del navegador
CORS_ALLOW_ALL_ORIGINS = True        # Permite TODOS los orígenes (desarrollo)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_METHODS = [
    'DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]


# --- CONFIGURACIÓN DE DJANGO REST FRAMEWORK (DRF) ---
REST_FRAMEWORK = {
    # Define la autenticación JWT como método principal de verificación de identidad
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Requiere que cualquier petición esté autenticada por defecto
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Motores para filtrar, buscar y ordenar datos directamente en URLs
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    # Paginación estándar de registros para evitar sobrecarga en respuestas JSON
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20, # Cantidad máxima de registros por página
}


# --- CONFIGURACIÓN DE SEGURIDAD JWT (SIMPLE_JWT) ---
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),    # El token de acceso expira en 8 horas
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),    # El token de refresco expira en 7 días
    'ROTATE_REFRESH_TOKENS': True,                  # Genera un nuevo refresh token al refrescar
    'BLACKLIST_AFTER_ROTATION': True,               # Agrega el viejo refresh token a lista negra para seguridad
    'AUTH_HEADER_TYPES': ('Bearer',),               # Tipo de cabecera HTTP requerida: Authorization: Bearer <token>
}


# --- PARÁMETROS DE COMUNICACIÓN CON BLOCKCHAIN ---
BLOCKCHAIN_NETWORK = config('BLOCKCHAIN_NETWORK', default='local')
GANACHE_URL = config('GANACHE_URL', default='http://127.0.0.1:8545') # Nodo RPC local (Ganache/Hardhat)
CONTRACT_ADDRESS = config('CONTRACT_ADDRESS', default='')            # Dirección del contrato inteligente desplegado
