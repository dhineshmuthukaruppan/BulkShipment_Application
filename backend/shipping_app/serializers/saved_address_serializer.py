from rest_framework import serializers
from shipping_app.models import SavedAddress


class SavedAddressSerializer(serializers.ModelSerializer):
    """Serializer for SavedAddress model"""
    
    class Meta:
        model = SavedAddress
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'id']

