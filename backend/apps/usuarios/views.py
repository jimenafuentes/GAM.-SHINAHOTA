# ============================================================
# apps/usuarios/views.py - Endpoints API para Usuarios y Autenticación
# ============================================================
# Este archivo maneja todo lo relacionado con autenticación y gestión de usuarios.
#
# Sistema de autenticación: JWT (JSON Web Tokens)
#   - El frontend envía email + contraseña al endpoint de login
#   - El backend responde con dos tokens:
#       * access_token: token de corta duración (15-60 min) para las peticiones
#       * refresh_token: token de larga duración (días) para renovar el access_token
#   - El frontend guarda ambos en localStorage y envía el access_token
#     en el header "Authorization: Bearer {token}" de cada petición
#
# Endpoints disponibles (configurados en usuarios/urls.py):
#   POST /api/auth/login/                    → obtener tokens JWT
#   POST /api/auth/logout/                   → invalidar refresh token
#   POST /api/auth/token/refresh/            → renovar access token expirado
#   GET  /api/auth/usuarios/                 → listar usuarios (admin)
#   POST /api/auth/usuarios/                 → crear usuario (admin)
#   POST /api/auth/usuarios/registrar/       → auto-registro (público)
#   GET  /api/auth/usuarios/me/              → perfil del usuario logueado
#   PUT  /api/auth/usuarios/cambiar_password/→ cambiar contraseña propia
#   GET  /api/auth/departamentos/            → listar departamentos (público)
# ============================================================

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView   # Vista base de JWT
from rest_framework_simplejwt.tokens import RefreshToken          # Para manejar tokens JWT
from django.contrib.auth import get_user_model
from django.db.models import ProtectedError
from django.db import IntegrityError
from .models import Departamento
from .serializers import (
    UsuarioSerializer, UsuarioCreateSerializer,
    DepartamentoSerializer, CustomTokenObtainPairSerializer
)
from .permissions import IsAdmin, IsAdminOrJefeAlmacen

# Obtiene el modelo de usuario activo (el nuestro personalizado, no el de Django)
Usuario = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista de login que extiende la vista JWT estándar.

    Usa nuestro CustomTokenObtainPairSerializer que agrega datos extra
    al token y a la respuesta (como el rol, nombre, etc. del usuario).

    Endpoint: POST /api/auth/login/
    Body: {"email": "...", "password": "..."}
    Respuesta: {"access": "...", "refresh": "...", "user": {...}}
    """
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(generics.GenericAPIView):
    """
    Vista para cerrar sesión e invalidar el refresh token.

    JWT es stateless (sin estado): normalmente no se puede "invalidar".
    Para resolverlo, se usa la lista negra (blacklist) de tokens:
    el refresh_token queda marcado como inválido en la BD.

    Esto requiere que simplejwt tenga 'rest_framework_simplejwt.token_blacklist'
    instalado en INSTALLED_APPS del settings.

    Endpoint: POST /api/auth/logout/
    Body: {"refresh": "token_de_refresco"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()  # Agrega el token a la lista negra (ya no es válido)
            return Response({'message': 'Sesión cerrada exitosamente'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Token inválido'}, status=status.HTTP_400_BAD_REQUEST)


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para gestión de usuarios.

    Permisos según la acción:
      - registrar:                  sin autenticación (cualquiera puede registrarse)
      - create/update/delete:       solo ADMIN
      - list/retrieve/me/password:  usuario autenticado

    Serializers según la acción:
      - create: UsuarioCreateSerializer (incluye campo de contraseña)
      - resto:  UsuarioSerializer (no expone contraseña)
    """
    queryset = Usuario.objects.all().order_by('-fecha_creacion')
    permission_classes = [IsAuthenticated]
    search_fields = ['nombre', 'apellido', 'email', 'ci', 'cargo']
    filterset_fields = ['rol', 'departamento', 'is_active']

    def get_serializer_class(self):
        """Usa diferente serializer según si es creación o lectura."""
        if self.action == 'create':
            return UsuarioCreateSerializer  # Incluye campo password
        return UsuarioSerializer            # Sin campo password

    def get_permissions(self):
        """
        Control de permisos dinámico:
          - registrar: AllowAny (endpoint público para auto-registro)
          - create/update/destroy: solo ADMIN
          - todo lo demás: usuario autenticado
        """
        if self.action == 'registrar':
            return [AllowAny()]
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        """
        Elimina un usuario. Si el usuario tiene registros vinculados (solicitudes,
        movimientos o activos), lo deshabilita (is_active = False) para preservar
        la integridad del historial sin causar un error 500 en la base de datos.
        """
        instance = self.get_object()

        if request.user.id == instance.id:
            return Response(
                {'detail': 'No puedes eliminar tu propia cuenta de usuario en sesión activa.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            instance.delete()
            return Response({'detail': 'Usuario eliminado permanentemente'}, status=status.HTTP_200_OK)
        except (ProtectedError, IntegrityError):
            instance.is_active = False
            instance.save()
            return Response(
                {'detail': 'El usuario tiene registros asociados (solicitudes o movimientos). Se ha deshabilitado para preservar la integridad del historial.'},
                status=status.HTTP_200_OK
            )

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def registrar(self, request):
        """
        POST /api/auth/usuarios/registrar/
        Permite que cualquier persona se registre en el sistema sin estar logueada.
        El nuevo usuario recibe el rol 'SOLICITANTE' por defecto (definido en el modelo).
        """
        serializer = UsuarioCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UsuarioSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        GET /api/auth/usuarios/me/
        Retorna el perfil completo del usuario que está logueado actualmente.
        El frontend lo usa al cargar la aplicación para saber quién está autenticado
        y cuál es su rol (para mostrar/ocultar menús y funciones).
        """
        serializer = UsuarioSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['put'], permission_classes=[IsAuthenticated])
    def cambiar_password(self, request):
        """
        PUT /api/auth/usuarios/cambiar_password/
        Permite a cualquier usuario cambiar su propia contraseña.

        Requiere:
          - old_password: contraseña actual (para verificación de seguridad)
          - new_password: nueva contraseña

        check_password() verifica si la contraseña ingresada coincide con el hash almacenado.
        set_password() hashea y guarda la nueva contraseña de forma segura.
        """
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        if not user.check_password(old_password):
            return Response({'error': 'Contraseña actual incorrecta'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)  # Hashea automáticamente la nueva contraseña
        user.save()
        return Response({'message': 'Contraseña actualizada exitosamente'})


class DepartamentoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de departamentos.

    Permisos:
      - list (GET /departamentos/): público (AllowAny)
        Necesario para el formulario de registro donde el usuario debe
        seleccionar su departamento sin estar logueado.
      - create/update/delete: solo ADMIN
      - retrieve: usuario autenticado

    Solo muestra departamentos activos (activo=True).
    """
    queryset = Departamento.objects.filter(activo=True).order_by('nombre')
    serializer_class = DepartamentoSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nombre']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        if self.action == 'list':
            return [AllowAny()]  # El listado es público para el formulario de registro
        return [IsAuthenticated()]
