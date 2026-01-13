from rest_framework import serializers
from shipping_app.models import Shipment


class ShipmentSerializer(serializers.ModelSerializer):
    """Serializer for Shipment model with computed fields"""
    
    formatted_from_address = serializers.SerializerMethodField()
    formatted_to_address = serializers.SerializerMethodField()
    package_details = serializers.SerializerMethodField()
    validation_status = serializers.SerializerMethodField()
    has_label = serializers.SerializerMethodField()
    tracking_number = serializers.SerializerMethodField()
    weight_calculation_breakdown = serializers.SerializerMethodField()
    zone_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Shipment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'id']
    
    def get_formatted_from_address(self, obj):
        return obj.get_formatted_from_address()
    
    def get_formatted_to_address(self, obj):
        return obj.get_formatted_to_address()
    
    def get_package_details(self, obj):
        return obj.get_package_details()
    
    def get_validation_status(self, obj):
        return obj.get_validation_status()
    
    def get_has_label(self, obj):
        """Check if shipment has a shipping label (shipped)"""
        try:
            return hasattr(obj, 'label') and obj.label is not None
        except:
            return False
    
    def get_tracking_number(self, obj):
        """Get tracking number if label exists"""
        try:
            if hasattr(obj, 'label') and obj.label:
                return obj.label.tracking_number
        except:
            pass
        return None
    
    def get_weight_calculation_breakdown(self, obj):
        """Get weight calculation breakdown string"""
        if not obj.billable_weight:
            return None
        
        parts = []
        parts.append(f"Actual: {obj.weight_lbs} lbs {obj.weight_oz} oz")
        
        if obj.dimensional_weight:
            parts.append(f"Dimensional: {obj.dimensional_weight} lbs")
        
        parts.append(f"Billable: {obj.billable_weight} lbs ({obj.get_weight_type_display() or obj.weight_type})")
        
        return " | ".join(parts)
    
    def get_zone_info(self, obj):
        """Get formatted zone information string"""
        if not obj.shipping_zone:
            return None
        
        zone_type_display = obj.get_zone_type_display() or obj.zone_type or ''
        return f"Zone {obj.shipping_zone} ({zone_type_display})"
    
    def update(self, instance, validated_data):
        """Override update to track which parts have been reviewed"""
        validation_flags = list(instance.validation_flags or [])
        
        # If status is being explicitly set, preserve it and skip auto-calculation
        status_explicitly_set = 'status' in validated_data
        if status_explicitly_set:
            instance._skip_auto_status = True
        
        # Check if sender or recipient address fields are being updated
        sender_fields = ['from_first_name', 'from_last_name', 'from_address', 'from_city', 'from_state', 'from_zip']
        recipient_fields = ['to_first_name', 'to_last_name', 'to_address', 'to_city', 'to_state', 'to_zip']
        address_fields_updated = any(field in validated_data for field in sender_fields + recipient_fields)
        
        # Check if package detail fields are being updated
        package_fields = ['length', 'width', 'height', 'weight_lbs', 'weight_oz']
        package_fields_updated = any(field in validated_data for field in package_fields)
        
        # Mark address as reviewed if address fields are updated
        if address_fields_updated:
            if 'address_reviewed' not in validation_flags:
                validation_flags.append('address_reviewed')
            # Remove old flags related to missing address
            flags_to_remove = ['missing_sender_address', 'auto_assigned_sender']
            for flag in flags_to_remove:
                if flag in validation_flags:
                    validation_flags.remove(flag)
        
        # Mark package as reviewed if package fields are updated
        if package_fields_updated:
            if 'package_reviewed' not in validation_flags:
                validation_flags.append('package_reviewed')
            # Remove old flags related to missing package
            flags_to_remove = ['missing_package_details', 'auto_assigned_package']
            for flag in flags_to_remove:
                if flag in validation_flags:
                    validation_flags.remove(flag)
        
        # Update validation_flags
        validated_data['validation_flags'] = validation_flags
        
        # Call parent to perform the update
        updated_instance = super().update(instance, validated_data)
        
        # Ensure status is preserved if it was explicitly set
        if status_explicitly_set and hasattr(instance, '_skip_auto_status'):
            # Refresh from DB to get the actual saved status
            updated_instance.refresh_from_db()
        
        return updated_instance

