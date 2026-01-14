"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from shipping_app.views import ShipmentViewSet, SavedAddressViewSet, SavedPackageViewSet, OrderNumberSettingsViewSet

router = DefaultRouter()
router.register(r'shipments', ShipmentViewSet, basename='shipment')
router.register(r'saved-addresses', SavedAddressViewSet, basename='saved-address')
router.register(r'saved-packages', SavedPackageViewSet, basename='saved-package')
router.register(r'order-number-settings', OrderNumberSettingsViewSet, basename='order-number-settings')

def root_view(request):
    """Root endpoint to verify API is running"""
    return JsonResponse({
        'status': 'ok',
        'message': 'Bulk Shipping API is running',
        'endpoints': {
            'api': '/api/',
            'admin': '/admin/',
            'shipments': '/api/shipments/',
            'saved-addresses': '/api/saved-addresses/',
            'saved-packages': '/api/saved-packages/',
            'order-number-settings': '/api/order-number-settings/'
        }
    })

urlpatterns = [
    path('', root_view, name='root'),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]
