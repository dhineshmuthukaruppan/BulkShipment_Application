from rest_framework import serializers
from shipping_app.models import SavedPackage


class SavedPackageSerializer(serializers.ModelSerializer):
    """Serializer for SavedPackage model"""
    
    class Meta:
        model = SavedPackage
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'id']

