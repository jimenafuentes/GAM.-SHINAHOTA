from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegistroBlockchainViewSet

router = DefaultRouter()
router.register('', RegistroBlockchainViewSet, basename='blockchain')

urlpatterns = [path('', include(router.urls))]
