from rest_framework import serializers
from shipping_app.models import Shipment
from shipping_app.services import AddressValidator
from concurrent.futures import ThreadPoolExecutor
import logging

logger = logging.getLogger(__name__)


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
        """Override update to track which parts have been reviewed and validate addresses"""
        logger.info(f"[SERIALIZER-DEBUG] ShipmentSerializer.update() CALLED for shipment_id={instance.id}")
        
        validation_flags = list(instance.validation_flags or [])
        validation_errors = list(instance.validation_errors or [])
        
        # If status is being explicitly set, preserve it and skip auto-calculation
        status_explicitly_set = 'status' in validated_data
        if status_explicitly_set:
            logger.info(f"[SERIALIZER-DEBUG] Status explicitly set to: {validated_data.get('status')}")
            instance._skip_auto_status = True
        
        # Check if sender or recipient address fields are being updated
        sender_fields = ['from_first_name', 'from_last_name', 'from_address', 'from_city', 'from_state', 'from_zip']
        recipient_fields = ['to_first_name', 'to_last_name', 'to_address', 'to_city', 'to_state', 'to_zip']
        address_fields_updated = any(field in validated_data for field in sender_fields + recipient_fields)
        
        # Check if package detail fields are being updated
        package_fields = ['length', 'width', 'height', 'weight_lbs', 'weight_oz']
        package_fields_updated = any(field in validated_data for field in package_fields)
        
        logger.info(f"[SERIALIZER-DEBUG] address_fields_updated={address_fields_updated}, package_fields_updated={package_fields_updated}")
        
        # Validate addresses if address fields are being updated
        if address_fields_updated:
            logger.info(f"[SERIALIZER-DEBUG] Starting address validation for shipment_id={instance.id}")
            
            # Determine which addresses are being updated
            # Only check for fields that actually affect address validation (address, city, state, zip)
            from_address_fields = ['from_address', 'from_city', 'from_state', 'from_zip']
            to_address_fields = ['to_address', 'to_city', 'to_state', 'to_zip']
            
            from_fields_updated = any(field in validated_data for field in from_address_fields)
            to_fields_updated = any(field in validated_data for field in to_address_fields)
            
            logger.info(f"[SERIALIZER-DEBUG] from_fields_updated={from_fields_updated}, to_fields_updated={to_fields_updated}")
            logger.info(f"[SERIALIZER-DEBUG] Fields in request: {list(validated_data.keys())}")
            
            # Only build and validate addresses that have address-related fields updated
            validator = AddressValidator()
            results = {}
            from_address = None
            to_address = None
            
            logger.info(f"[SERIALIZER-DEBUG] Submitting address validation tasks for shipment_id={instance.id}")
            
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = {}
                
                # Only validate from_address if from address fields are being updated
                if from_fields_updated:
                    # Build from_address dictionary only if from fields are being updated
                    from_address = {
                        'first_name': validated_data.get('from_first_name', instance.from_first_name),
                        'last_name': validated_data.get('from_last_name', instance.from_last_name),
                        'address': validated_data.get('from_address', instance.from_address),
                        'address2': validated_data.get('from_address2', instance.from_address2 or ''),
                        'city': validated_data.get('from_city', instance.from_city),
                        'state': validated_data.get('from_state', instance.from_state),
                        'zip': validated_data.get('from_zip', instance.from_zip),
                    }
                    
                    # Only validate if we have the minimum required fields
                    if from_address.get('address') or from_address.get('city') or from_address.get('zip'):
                        logger.info(f"[SERIALIZER-DEBUG] Submitting from_address validation task")
                        logger.info(f"[SERIALIZER-DEBUG] from_address: {from_address.get('address', 'N/A')}, {from_address.get('city', 'N/A')}, {from_address.get('state', 'N/A')} {from_address.get('zip', 'N/A')}")
                        futures['from_address'] = executor.submit(validator.validate, from_address)
                    else:
                        logger.info(f"[SERIALIZER-DEBUG] Skipping from_address validation - insufficient address data")
                
                # Only validate to_address if to address fields are being updated
                if to_fields_updated:
                    # Build to_address dictionary only if to fields are being updated
                    to_address = {
                        'first_name': validated_data.get('to_first_name', instance.to_first_name),
                        'last_name': validated_data.get('to_last_name', instance.to_last_name),
                        'address': validated_data.get('to_address', instance.to_address),
                        'address2': validated_data.get('to_address2', instance.to_address2 or ''),
                        'city': validated_data.get('to_city', instance.to_city),
                        'state': validated_data.get('to_state', instance.to_state),
                        'zip': validated_data.get('to_zip', instance.to_zip),
                    }
                    
                    # Only validate if we have the minimum required fields
                    if to_address.get('address') or to_address.get('city') or to_address.get('zip'):
                        logger.info(f"[SERIALIZER-DEBUG] Submitting to_address validation task")
                        logger.info(f"[SERIALIZER-DEBUG] to_address: {to_address.get('address', 'N/A')}, {to_address.get('city', 'N/A')}, {to_address.get('state', 'N/A')} {to_address.get('zip', 'N/A')}")
                        futures['to_address'] = executor.submit(validator.validate, to_address)
                    else:
                        logger.info(f"[SERIALIZER-DEBUG] Skipping to_address validation - insufficient address data")
                
                # Collect results as they complete
                for key, future in futures.items():
                    try:
                        results[key] = future.result()
                        logger.info(f"[SERIALIZER-DEBUG] Validation completed for {key}: valid={results[key].get('valid', False)}")
                    except Exception as e:
                        logger.error(f"[SERIALIZER-DEBUG] Validation error for {key}: {str(e)}")
                        results[key] = {
                            'valid': False,
                            'error': str(e),
                            'error_details': []
                        }
            
            # Update validation_errors based on validation results
            # Only remove validation errors for addresses that are being updated
            if from_fields_updated:
                # Remove existing from address validation errors
                validation_errors = [
                    err for err in validation_errors 
                    if not err.startswith('Invalid ship from address:')
                ]
            
            if to_fields_updated:
                # Remove existing to address validation errors
                validation_errors = [
                    err for err in validation_errors 
                    if not err.startswith('Invalid ship to address:')
                ]
            
            from_valid = results.get('from_address', {}).get('valid', True) if 'from_address' in futures else None
            to_valid = results.get('to_address', {}).get('valid', True) if 'to_address' in futures else None
            
            # Check if zip code was changed by API (if zip code changed, mark as invalid)
            # Only compare first 5 digits (base ZIP code), ignore +4 extension
            if from_fields_updated and 'from_address' in futures and from_valid and from_address:
                corrected_from = results.get('from_address', {}).get('corrected_address', {})
                original_zip = from_address.get('zip', '').strip()
                corrected_zip = corrected_from.get('zip', '').strip()
                # Extract first 5 digits from both zip codes for comparison
                original_zip_digits = ''.join(filter(str.isdigit, original_zip))[:5]
                corrected_zip_digits = ''.join(filter(str.isdigit, corrected_zip))[:5]
                # Only mark as invalid if the base 5-digit ZIP code changed
                if original_zip_digits and corrected_zip_digits and original_zip_digits != corrected_zip_digits:
                    from_valid = False
                    logger.info(f"[SERIALIZER-DEBUG] From address zip code changed: {original_zip} -> {corrected_zip}, marking as invalid")
                elif original_zip_digits and corrected_zip_digits and original_zip_digits == corrected_zip_digits:
                    logger.info(f"[SERIALIZER-DEBUG] From address zip code base matches: {original_zip} -> {corrected_zip} (only +4 extension added)")
            
            if to_fields_updated and 'to_address' in futures and to_valid and to_address:
                corrected_to = results.get('to_address', {}).get('corrected_address', {})
                original_zip = to_address.get('zip', '').strip()
                corrected_zip = corrected_to.get('zip', '').strip()
                # Extract first 5 digits from both zip codes for comparison
                original_zip_digits = ''.join(filter(str.isdigit, original_zip))[:5]
                corrected_zip_digits = ''.join(filter(str.isdigit, corrected_zip))[:5]
                # Only mark as invalid if the base 5-digit ZIP code changed
                if original_zip_digits and corrected_zip_digits and original_zip_digits != corrected_zip_digits:
                    to_valid = False
                    logger.info(f"[SERIALIZER-DEBUG] To address zip code changed: {original_zip} -> {corrected_zip}, marking as invalid")
                elif original_zip_digits and corrected_zip_digits and original_zip_digits == corrected_zip_digits:
                    logger.info(f"[SERIALIZER-DEBUG] To address zip code base matches: {original_zip} -> {corrected_zip} (only +4 extension added)")
            
            logger.info(f"[SERIALIZER-DEBUG] Validation results: from_valid={from_valid}, to_valid={to_valid}")
            
            # Add validation errors only for addresses that were updated and are invalid
            # Match CSV upload logic: use actual error message from API validation result
            if from_fields_updated and 'from_address' in futures:
                if not from_valid:
                    # Get error message from validation result (match CSV upload format)
                    error_message = results.get('from_address', {}).get('error', 'Address not found - invalid address')
                    validation_errors.append(f"Invalid ship from address: {error_message}")
                    logger.info(f"[SERIALIZER-DEBUG] Added validation error for from_address: {error_message}")
                elif from_valid:
                    # If from address is valid, ensure no from address errors remain
                    validation_errors = [err for err in validation_errors if not err.startswith('Invalid ship from address:')]
                    logger.info(f"[SERIALIZER-DEBUG] From address valid - cleared from address errors")
            
            if to_fields_updated and 'to_address' in futures:
                if not to_valid:
                    # Get error message from validation result (match CSV upload format)
                    error_message = results.get('to_address', {}).get('error', 'Address not found - invalid address')
                    validation_errors.append(f"Invalid ship to address: {error_message}")
                    logger.info(f"[SERIALIZER-DEBUG] Added validation error for to_address: {error_message}")
                elif to_valid:
                    # If to address is valid, ensure no to address errors remain
                    validation_errors = [err for err in validation_errors if not err.startswith('Invalid ship to address:')]
                    logger.info(f"[SERIALIZER-DEBUG] To address valid - cleared to address errors")
            
            # Update validation_flags based on validation results
            # Only update flags for addresses that are being updated
            if from_fields_updated and 'from_address' in futures:
                # Remove existing from address invalid flags
                from_invalid_flags = ['invalid_ship_from_address', 'invalid_ship_from_city', 'invalid_ship_from_pincode']
                validation_flags = [f for f in validation_flags if f not in from_invalid_flags]
                
                if not from_valid and from_address:
                    # Check if zip code was changed (this would make it invalid)
                    # Only compare first 5 digits (base ZIP code), ignore +4 extension
                    corrected_from = results.get('from_address', {}).get('corrected_address', {})
                    original_zip = from_address.get('zip', '').strip()
                    corrected_zip = corrected_from.get('zip', '').strip()
                    # Extract first 5 digits from both zip codes for comparison
                    original_zip_digits = ''.join(filter(str.isdigit, original_zip))[:5]
                    corrected_zip_digits = ''.join(filter(str.isdigit, corrected_zip))[:5]
                    
                    if original_zip_digits and corrected_zip_digits and original_zip_digits != corrected_zip_digits:
                        # Base ZIP code was changed - mark as invalid pincode
                        if 'invalid_ship_from_pincode' not in validation_flags:
                            validation_flags.append('invalid_ship_from_pincode')
                        logger.info(f"[SERIALIZER-DEBUG] Added invalid_ship_from_pincode flag due to zip code change: {original_zip} -> {corrected_zip}")
                    else:
                        # Check error_details from API (match CSV upload logic)
                        error_details = results.get('from_address', {}).get('error_details', [])
                        if error_details:
                            for error_detail in error_details:
                                if error_detail == 'invalid_city':
                                    if 'invalid_ship_from_city' not in validation_flags:
                                        validation_flags.append('invalid_ship_from_city')
                                elif error_detail == 'invalid_pincode':
                                    if 'invalid_ship_from_pincode' not in validation_flags:
                                        validation_flags.append('invalid_ship_from_pincode')
                                elif error_detail == 'invalid_street':
                                    if 'invalid_ship_from_address' not in validation_flags:
                                        validation_flags.append('invalid_ship_from_address')
                        else:
                            if 'invalid_ship_from_address' not in validation_flags:
                                validation_flags.append('invalid_ship_from_address')
                # Note: We preserve user's input values - do not overwrite with API corrected values
                # Validation is only used to determine validity and set flags/errors
            
            if to_fields_updated and 'to_address' in futures:
                # Remove existing to address invalid flags
                to_invalid_flags = ['invalid_ship_to_address', 'invalid_ship_to_city', 'invalid_ship_to_pincode']
                validation_flags = [f for f in validation_flags if f not in to_invalid_flags]
                
                if not to_valid and to_address:
                    # Check if zip code was changed (this would make it invalid)
                    # Only compare first 5 digits (base ZIP code), ignore +4 extension
                    corrected_to = results.get('to_address', {}).get('corrected_address', {})
                    original_zip = to_address.get('zip', '').strip()
                    corrected_zip = corrected_to.get('zip', '').strip()
                    # Extract first 5 digits from both zip codes for comparison
                    original_zip_digits = ''.join(filter(str.isdigit, original_zip))[:5]
                    corrected_zip_digits = ''.join(filter(str.isdigit, corrected_zip))[:5]
                    
                    if original_zip_digits and corrected_zip_digits and original_zip_digits != corrected_zip_digits:
                        # Base ZIP code was changed - mark as invalid pincode
                        if 'invalid_ship_to_pincode' not in validation_flags:
                            validation_flags.append('invalid_ship_to_pincode')
                        logger.info(f"[SERIALIZER-DEBUG] Added invalid_ship_to_pincode flag due to zip code change: {original_zip} -> {corrected_zip}")
                    else:
                        # Check error_details from API (match CSV upload logic)
                        error_details = results.get('to_address', {}).get('error_details', [])
                        if error_details:
                            for error_detail in error_details:
                                if error_detail == 'invalid_city':
                                    if 'invalid_ship_to_city' not in validation_flags:
                                        validation_flags.append('invalid_ship_to_city')
                                elif error_detail == 'invalid_pincode':
                                    if 'invalid_ship_to_pincode' not in validation_flags:
                                        validation_flags.append('invalid_ship_to_pincode')
                                elif error_detail == 'invalid_street':
                                    if 'invalid_ship_to_address' not in validation_flags:
                                        validation_flags.append('invalid_ship_to_address')
                        else:
                            if 'invalid_ship_to_address' not in validation_flags:
                                validation_flags.append('invalid_ship_to_address')
                # Note: We preserve user's input values - do not overwrite with API corrected values
                # Validation is only used to determine validity and set flags/errors
            
            # Mark address as reviewed if address fields are updated
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
        
        # Update validation_flags and validation_errors
        validated_data['validation_flags'] = validation_flags
        validated_data['validation_errors'] = validation_errors
        
        logger.info(f"[SERIALIZER-DEBUG] Final validation_flags: {validation_flags}")
        logger.info(f"[SERIALIZER-DEBUG] Final validation_errors: {validation_errors}")
        
        # Calculate what the status will be after update (for logging)
        # Create a temporary instance to calculate status
        temp_instance = type(instance)(
            id=instance.id,
            validation_flags=validation_flags,
            validation_errors=validation_errors,
            validation_warnings=instance.validation_warnings or [],
            to_first_name=validated_data.get('to_first_name', instance.to_first_name),
            to_address=validated_data.get('to_address', instance.to_address),
            to_city=validated_data.get('to_city', instance.to_city),
            to_state=validated_data.get('to_state', instance.to_state),
            to_zip=validated_data.get('to_zip', instance.to_zip),
        )
        calculated_status = temp_instance.calculate_status()
        logger.info(f"[SERIALIZER-DEBUG] Calculated status will be: {calculated_status}")
        if calculated_status == 'invalid':
            invalid_flags_present = [f for f in validation_flags if f in ['invalid_address', 'invalid_ship_from_address', 'invalid_ship_to_address', 'invalid_ship_from_city', 'invalid_ship_to_city', 'invalid_ship_from_pincode', 'invalid_ship_to_pincode']]
            logger.info(f"[SERIALIZER-DEBUG] Status is invalid because: validation_errors={len(validation_errors)} errors, invalid_flags={invalid_flags_present}")
        
        # Log address values that will be saved (to verify user input is preserved)
        if address_fields_updated:
            logger.info(f"[SERIALIZER-DEBUG] Address values to be saved:")
            if 'from_address' in validated_data or 'from_state' in validated_data:
                logger.info(f"[SERIALIZER-DEBUG]   from_address: {validated_data.get('from_address', 'NOT IN validated_data')}")
                logger.info(f"[SERIALIZER-DEBUG]   from_city: {validated_data.get('from_city', 'NOT IN validated_data')}")
                logger.info(f"[SERIALIZER-DEBUG]   from_state: {validated_data.get('from_state', 'NOT IN validated_data')}")
                logger.info(f"[SERIALIZER-DEBUG]   from_zip: {validated_data.get('from_zip', 'NOT IN validated_data')}")
            if 'to_address' in validated_data or 'to_state' in validated_data:
                logger.info(f"[SERIALIZER-DEBUG]   to_address: {validated_data.get('to_address', 'NOT IN validated_data')}")
                logger.info(f"[SERIALIZER-DEBUG]   to_city: {validated_data.get('to_city', 'NOT IN validated_data')}")
                logger.info(f"[SERIALIZER-DEBUG]   to_state: {validated_data.get('to_state', 'NOT IN validated_data')}")
                logger.info(f"[SERIALIZER-DEBUG]   to_zip: {validated_data.get('to_zip', 'NOT IN validated_data')}")
        
        # Call parent to perform the update
        updated_instance = super().update(instance, validated_data)
        
        logger.info(f"[SERIALIZER-DEBUG] Shipment updated successfully. Final status: {updated_instance.status}")
        
        # Ensure status is preserved if it was explicitly set
        if status_explicitly_set and hasattr(instance, '_skip_auto_status'):
            # Refresh from DB to get the actual saved status
            updated_instance.refresh_from_db()
        
        return updated_instance

