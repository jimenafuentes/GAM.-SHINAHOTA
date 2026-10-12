from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView, LogoutView, UsuarioViewSet, DepartamentoViewSet

router = DefaultRouter()
router.register('usuarios', UsuarioViewSet, basename='usuarios')
router.register('departamentos', DepartamentoViewSet, basename='departamentos')

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('', include(router.urls)),
]
