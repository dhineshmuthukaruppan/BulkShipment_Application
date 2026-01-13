from rest_framework import serializers
from shipping_app.models import OrderNumberSettings


class OrderNumberSettingsSerializer(serializers.ModelSerializer):
    """Serializer for OrderNumberSettings model"""
    example = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderNumberSettings
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'id']
    
    def get_example(self, obj):
        """Get an example order number with current settings"""
        return obj.get_example()
