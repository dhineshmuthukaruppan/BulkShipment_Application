from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction
from django.conf import settings
from decimal import Decimal
from datetime import datetime
import traceback
import logging

logger = logging.getLogger(__name__)

from shipping_app.models import Shipment, SavedAddress, SavedPackage, OrderNumberSettings
from shipping_app.serializers import (
    ShipmentSerializer,
    SavedAddressSerializer,
    SavedPackageSerializer,
    OrderNumberSettingsSerializer
)
from shipping_app.services import (
    CSVParser,
    AddressValidator,
    ShippingCalculator,
    ShippingLogger
)

# US state codes for country-aware validation
US_STATE_CODES = {
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC'  # District of Columbia
}


class ShipmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Shipment CRUD operations.
    
    IMPORTANT: All operations persist to the database.
    - CREATE: Shipment.objects.create() saves to DB
    - UPDATE: DRF's update()/partial_update() automatically save to DB
    - DELETE: DRF's destroy() automatically deletes from DB
    - BULK UPDATE: Uses .save() which persists to DB
    
    Database is the single source of truth. Redux is only for UI state management.
    
    NOTE: AddressValidator.validate() MUST be called only from:
    - batch_validate_addresses endpoint
    - shipment edit operations
    - label purchase flow
    
    CSV upload uses lightweight validation only (no external API calls).
    """
    queryset = Shipment.objects.all()
    serializer_class = ShipmentSerializer
    
    def create(self, request, *args, **kwargs):
        """Override create to add logging"""
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            shipment_id = response.data.get('id')
            ShippingLogger().log_shipment_create(
                shipment_id=shipment_id,
                order_number=response.data.get('order_number'),
                status=response.data.get('status')
            )
        return response
    
    def update(self, request, *args, **kwargs):
        """Override update to handle manual status changes and add logging"""
        instance = self.get_object()
        previous_values = {
            'status': instance.status,
            'shipping_service': instance.shipping_service,
            'shipping_cost': str(instance.shipping_cost) if instance.shipping_cost else None,
        }
        
        # If status is being explicitly set, mark it to skip auto-calculation
        if 'status' in request.data:
            instance._skip_auto_status = True
        
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200:
            ShippingLogger().log_shipment_update(
                shipment_id=instance.id,
                changes=request.data,
                previous_values=previous_values
            )
        return response
    
    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to handle manual status changes and add logging"""
        instance = self.get_object()
        previous_values = {
            'status': instance.status,
            'shipping_service': instance.shipping_service,
            'shipping_cost': str(instance.shipping_cost) if instance.shipping_cost else None,
        }
        
        # If status is being explicitly set, mark it to skip auto-calculation
        if 'status' in request.data:
            instance._skip_auto_status = True
        
        response = super().partial_update(request, *args, **kwargs)
        if response.status_code == 200:
            ShippingLogger().log_shipment_update(
                shipment_id=instance.id,
                changes=request.data,
                previous_values=previous_values
            )
        return response
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to add logging"""
        instance = self.get_object()
        shipment_id = instance.id
        order_number = instance.order_number
        shipment_status = instance.status
        
        response = super().destroy(request, *args, **kwargs)
        if response.status_code == 204:
            ShippingLogger().log_shipment_delete(
                shipment_id=shipment_id,
                order_number=order_number,
                status=shipment_status
            )
        return response
    
    def _basic_csv_address_check(self, row_data: dict, prefix: str) -> tuple[list, list]:
        """
        Lightweight address validation for CSV upload (no external API calls).
        Validates only: required fields, ZIP format (5 digits), state format (2 letters).
        
        Args:
            row_data: Row data dictionary
            prefix: 'from' or 'to' to indicate address type
            
        Returns:
            tuple: (validation_flags, validation_errors)
        """
        validation_flags = []
        validation_errors = []
        
        address = row_data.get(f'{prefix}_address', '').strip()
        city = row_data.get(f'{prefix}_city', '').strip()
        state = row_data.get(f'{prefix}_state', '').strip().upper()
        zip_code = row_data.get(f'{prefix}_zip', '').strip()
        
        # Check if non-US address (skip validation for non-US)
        if state and state not in US_STATE_CODES:
            validation_flags.append('non_us_address')
            return validation_flags, validation_errors
        
        # Check required fields
        if not address:
            validation_flags.append(f'invalid_ship_{prefix}_address')
            validation_errors.append(f"Missing {prefix} address")
        
        if not city:
            validation_flags.append(f'invalid_ship_{prefix}_city')
            validation_errors.append(f"Missing {prefix} city")
        
        # Validate ZIP format (must have at least 5 digits)
        if zip_code:
            zip_digits = ''.join(filter(str.isdigit, zip_code))
            if len(zip_digits) < 5:
                validation_flags.append(f'invalid_ship_{prefix}_pincode')
                validation_errors.append(f"Invalid {prefix} ZIP code: must have at least 5 digits")
        else:
            validation_flags.append(f'invalid_ship_{prefix}_pincode')
            validation_errors.append(f"Missing {prefix} ZIP code")
        
        # Validate state format (must be 2 letters)
        if state:
            if len(state) != 2 or not state.isalpha():
                validation_flags.append(f'invalid_ship_{prefix}_state')
                validation_errors.append(f"Invalid {prefix} state format: must be 2-letter code")
        else:
            validation_flags.append(f'invalid_ship_{prefix}_state')
            validation_errors.append(f"Missing {prefix} state")
        
        return validation_flags, validation_errors
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_csv(self, request):
        """Upload and parse CSV file"""
        try:
            if 'file' not in request.FILES:
                return Response(
                    {'error': 'No file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            file = request.FILES['file']
            
            # Get process_date from form data
            process_date_str = request.data.get('process_date')
            process_date = None
            if process_date_str:
                try:
                    process_date = datetime.strptime(process_date_str, '%Y-%m-%d').date()
                except ValueError:
                    return Response(
                        {'error': 'Invalid process_date format. Expected YYYY-MM-DD'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            parser = CSVParser()
            parse_result = parser.parse_file(file.read())
            
            if parse_result.get('errors'):
                return Response(
                    {'errors': parse_result.get('errors', []), 'warnings': parse_result.get('warnings', [])},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # CRITICAL: Clear all existing shipments before creating new ones
            # This ensures each CSV upload is treated as a separate, isolated batch
            # No overlapping between different CSV uploads
            with transaction.atomic():
                # Delete all existing shipments to start fresh
                Shipment.objects.all().delete()
            
            # Get default sender address (first saved address or create default)
            default_address = SavedAddress.objects.filter(is_default=True).first()
            if not default_address:
                default_address = SavedAddress.objects.first()
            
            # Create shipments from parsed rows
            created_shipments = []
            validator = AddressValidator()
            calculator = ShippingCalculator()
            
            # Two-stage validation approach:
            # 1. First: Lightweight validation (basic format checks) - filters out obviously invalid addresses
            # 2. Second: Full validation (AddressValidator.validate()) - only for addresses that pass basic checks
            
            with transaction.atomic():
                for row_data in parse_result.get('rows', []):
                    # Apply default sender address if missing
                    if 'missing_sender_address' in row_data.get('validation_flags', []):
                        if default_address:
                            row_data['from_first_name'] = default_address.first_name
                            row_data['from_last_name'] = default_address.last_name
                            row_data['from_address'] = default_address.address
                            row_data['from_address2'] = default_address.address2
                            row_data['from_city'] = default_address.city
                            row_data['from_state'] = default_address.state
                            row_data['from_zip'] = default_address.zip_code
                    
                    # Initialize validation tracking
                    validation_flags = row_data.get('validation_flags', [])
                    validation_errors = row_data.get('validation_errors', [])
                    from_address_valid = True
                    to_address_valid = True
                    
                    # STAGE 1: Lightweight validation for sender address (if present)
                    if row_data.get('from_address') or row_data.get('from_city') or row_data.get('from_zip'):
                        from_flags, from_errors = self._basic_csv_address_check(row_data, 'from')
                        if from_flags or from_errors:
                            # Basic check failed - mark as invalid, skip full validation
                            validation_flags.extend([f for f in from_flags if f not in validation_flags])
                            validation_errors.extend(from_errors)
                            from_address_valid = False
                            
                            # Add error message for non-US addresses
                            if 'non_us_address' in from_flags:
                                validation_errors.append("Invalid ship from address: Address not found - invalid address")
                                row_data['from_address_validation_error'] = "Address not found - invalid address"
                    
                    # STAGE 1: Lightweight validation for recipient address
                    to_flags, to_errors = self._basic_csv_address_check(row_data, 'to')
                    if to_flags or to_errors:
                        # Basic check failed - mark as invalid, skip full validation
                        validation_flags.extend([f for f in to_flags if f not in validation_flags])
                        validation_errors.extend(to_errors)
                        to_address_valid = False
                        
                        # Add error message for non-US addresses
                        if 'non_us_address' in to_flags:
                            validation_errors.append("Invalid ship to address: Address not found - invalid address")
                            row_data['address_validation_error'] = "Address not found - invalid address"
                    
                    # STAGE 2: Full validation for addresses that passed basic checks
                    # Validate sender address (only if basic check passed and not non-US)
                    from_validation_result = None
                    if from_address_valid and row_data.get('from_address') and 'non_us_address' not in validation_flags:
                        from_address = {
                            'first_name': row_data.get('from_first_name', ''),
                            'last_name': row_data.get('from_last_name', ''),
                            'address': row_data.get('from_address', ''),
                            'address2': row_data.get('from_address2', ''),
                            'city': row_data.get('from_city', ''),
                            'state': row_data.get('from_state', ''),
                            'zip': row_data.get('from_zip', ''),
                        }
                        
                        from_validation_result = validator.validate(from_address)
                        if not from_validation_result['valid']:
                            from_address_valid = False
                            error_details = from_validation_result.get('error_details', [])
                            
                            # Only flag specific components if API explicitly provides error_details
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
                            
                            error_message = from_validation_result.get('error', 'Address could not be validated')
                            row_data['from_address_validation_error'] = error_message
                            validation_errors.append(f"Invalid ship from address: {error_message}")
                    
                    # STAGE 2: Full validation for recipient address (only if basic check passed and not non-US)
                    to_validation_result = None
                    if to_address_valid and 'non_us_address' not in validation_flags:
                        to_address = {
                            'first_name': row_data.get('to_first_name', ''),
                            'last_name': row_data.get('to_last_name', ''),
                            'address': row_data.get('to_address', ''),
                            'address2': row_data.get('to_address2', ''),
                            'city': row_data.get('to_city', ''),
                            'state': row_data.get('to_state', ''),
                            'zip': row_data.get('to_zip', ''),
                        }
                        
                        to_validation_result = validator.validate(to_address)
                        if to_validation_result['valid']:
                            # Update with corrected address
                            corrected = to_validation_result['corrected_address']
                            row_data['to_address'] = corrected.get('address', row_data.get('to_address'))
                            row_data['to_city'] = corrected.get('city', row_data.get('to_city'))
                            row_data['to_state'] = corrected.get('state', row_data.get('to_state'))
                            row_data['to_zip'] = corrected.get('zip', row_data.get('to_zip'))
                        else:
                            to_address_valid = False
                            error_details = to_validation_result.get('error_details', [])
                            
                            # Only flag specific components if API explicitly provides error_details
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
                            
                            error_message = to_validation_result.get('error', 'Address could not be validated')
                            row_data['address_validation_error'] = error_message
                            validation_errors.append(f"Invalid address: {error_message}")
                    
                    # Set final validation status based on both addresses
                    if from_address_valid and to_address_valid:
                        # Both addresses passed full validation
                        row_data['address_validated'] = True
                        # Use the API from the last validation (to address takes precedence, or from if to wasn't validated)
                        if to_validation_result:
                            row_data['address_validation_api_used'] = to_validation_result['api_used']
                            row_data['address_corrections'] = to_validation_result.get('corrections', [])
                        elif from_validation_result:
                            row_data['address_validation_api_used'] = from_validation_result['api_used']
                            row_data['address_corrections'] = from_validation_result.get('corrections', [])
                        row_data['address_validation_error'] = ''
                    else:
                        # At least one address failed validation
                        row_data['address_validated'] = False
                        if not row_data.get('address_validation_api_used'):
                            row_data['address_validation_api_used'] = 'Unknown'
                        if not row_data.get('address_validation_error'):
                            row_data['address_validation_error'] = 'Address validation failed'
                        if not row_data.get('address_corrections'):
                            row_data['address_corrections'] = []
                    
                    # Update row_data with final validation flags and errors
                    row_data['validation_flags'] = validation_flags
                    row_data['validation_errors'] = validation_errors
                    
                    # Create shipment
                    shipment = Shipment.objects.create(
                        from_first_name=row_data.get('from_first_name', ''),
                        from_last_name=row_data.get('from_last_name', ''),
                        from_address=row_data.get('from_address', ''),
                        from_address2=row_data.get('from_address2', ''),
                        from_city=row_data.get('from_city', ''),
                        from_state=row_data.get('from_state', ''),
                        from_zip=row_data.get('from_zip', ''),
                        to_first_name=row_data.get('to_first_name', ''),
                        to_last_name=row_data.get('to_last_name', ''),
                        to_address=row_data.get('to_address', ''),
                        to_address2=row_data.get('to_address2', ''),
                        to_city=row_data.get('to_city', ''),
                        to_state=row_data.get('to_state', ''),
                        to_zip=row_data.get('to_zip', ''),
                        weight_lbs=Decimal(row_data.get('weight_lbs', '1.0')),
                        weight_oz=Decimal(row_data.get('weight_oz', '0')),
                        length=Decimal(row_data.get('length', '6.0')),
                        width=Decimal(row_data.get('width', '6.0')),
                        height=Decimal(row_data.get('height', '6.0')),
                        order_number=row_data.get('order_number', ''),
                        item_sku=row_data.get('item_sku', ''),
                        phone_num1=row_data.get('phone_num1', ''),
                        phone_num2=row_data.get('phone_num2', ''),
                        validation_errors=row_data.get('validation_errors', []),
                        validation_warnings=row_data.get('validation_warnings', []),
                        validation_flags=row_data.get('validation_flags', []),
                        # Status will be auto-calculated by model's save() method
                        address_validated=row_data.get('address_validated', False),
                        address_validation_api_used=row_data.get('address_validation_api_used', ''),
                        address_corrections=row_data.get('address_corrections', []),
                        address_validation_error=row_data.get('address_validation_error', ''),
                        shipping_provider='USPS',
                        shipping_service='Ground Shipping',
                        process_date=process_date,  # Set process date for dashboard analytics
                    )
                    
                    # Calculate shipping cost with zone-based rates and volumetric weight
                    result = calculator.calculate(
                        weight_lbs=shipment.weight_lbs,
                        weight_oz=shipment.weight_oz,
                        length=shipment.length,
                        width=shipment.width,
                        height=shipment.height,
                        provider=shipment.shipping_provider or 'USPS',
                        service=shipment.shipping_service,
                        origin_zip=shipment.from_zip,
                        origin_state=shipment.from_state,
                        destination_zip=shipment.to_zip,
                        destination_state=shipment.to_state
                    )
                    
                    # Update shipment with calculated values
                    shipment.shipping_cost = result['cost']
                    breakdown = result['breakdown']
                    shipment.dimensional_weight = Decimal(str(breakdown['dimensional_weight_lbs'])) if breakdown['dimensional_weight_lbs'] else None
                    shipment.billable_weight = Decimal(str(breakdown['billable_weight_lbs']))
                    shipment.weight_type = breakdown['weight_type']
                    shipment.shipping_zone = breakdown['shipping_zone']
                    shipment.zone_type = breakdown['zone_type']
                    shipment.is_intrastate = breakdown['zone_type'] == 'intrastate'
                    
                    # Skip auto-calculation since we're setting values explicitly
                    shipment._skip_weight_calculation = True
                    # Status will be auto-calculated by model's save() method
                    shipment.save()
                    
                    created_shipments.append(shipment)
            
            serializer = self.get_serializer(created_shipments, many=True)
            return Response({
                'shipments': serializer.data,
                'count': len(created_shipments),
                'warnings': parse_result.get('warnings', [])
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            error_trace = traceback.format_exc()
            logger = ShippingLogger()
            logger.log_error('csv_upload_error', str(e))
            return Response(
                {'error': f'Internal server error: {str(e)}', 'traceback': error_trace if settings.DEBUG else None},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """Clear all shipments (used when rejecting preview)"""
        count = Shipment.objects.count()
        Shipment.objects.all().delete()
        return Response({
            'message': f'Cleared {count} shipments',
            'deleted_count': count
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk update shipments.
        
        IMPORTANT: All changes are persisted to the database using .save()
        This ensures data integrity and persistence across server restarts.
        Uses transaction.atomic() to ensure all updates succeed or all fail.
        """
        shipment_ids = request.data.get('ids', [])
        updates = request.data.get('updates', {})
        
        if not shipment_ids:
            return Response(
                {'error': 'No shipment IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use transaction to ensure all updates succeed or all fail
        with transaction.atomic():
            shipments = Shipment.objects.filter(id__in=shipment_ids)
            updated_count = 0
            
            # Handle bulk address update (Ship From)
            if 'saved_address_id' in updates:
                address = SavedAddress.objects.get(id=updates['saved_address_id'])
                # Use individual save() to trigger status recalculation and persist to DB
                for shipment in shipments:
                    shipment.from_first_name = address.first_name
                    shipment.from_last_name = address.last_name
                    shipment.from_address = address.address
                    shipment.from_address2 = address.address2
                    shipment.from_city = address.city
                    shipment.from_state = address.state
                    shipment.from_zip = address.zip_code
                    # Mark address as reviewed
                    validation_flags = list(shipment.validation_flags or [])
                    if 'address_reviewed' not in validation_flags:
                        validation_flags.append('address_reviewed')
                    # Remove old flags
                    flags_to_remove = ['missing_sender_address', 'auto_assigned_sender']
                    for flag in flags_to_remove:
                        if flag in validation_flags:
                            validation_flags.remove(flag)
                    shipment.validation_flags = validation_flags
                    shipment.save()  # Persists to database - status will be auto-calculated
                updated_count = shipments.count()
                ShippingLogger().log_bulk_action(
                    'change_sender_address',
                    updated_count,
                    {'address_id': address.id, 'address_name': address.name}
                )
            
            # Handle bulk address update (Ship To)
            if 'saved_to_address_id' in updates:
                address = SavedAddress.objects.get(id=updates['saved_to_address_id'])
                # Use individual save() to trigger status recalculation and persist to DB
                for shipment in shipments:
                    shipment.to_first_name = address.first_name
                    shipment.to_last_name = address.last_name
                    shipment.to_address = address.address
                    shipment.to_address2 = address.address2
                    shipment.to_city = address.city
                    shipment.to_state = address.state
                    shipment.to_zip = address.zip_code
                    # Mark address as reviewed
                    validation_flags = list(shipment.validation_flags or [])
                    if 'address_reviewed' not in validation_flags:
                        validation_flags.append('address_reviewed')
                    # Remove old flags
                    flags_to_remove = ['missing_recipient_address']
                    for flag in flags_to_remove:
                        if flag in validation_flags:
                            validation_flags.remove(flag)
                    shipment.validation_flags = validation_flags
                    shipment.save()  # Persists to database - status will be auto-calculated
                updated_count = shipments.count()
                ShippingLogger().log_bulk_action(
                    'change_recipient_address',
                    updated_count,
                    {'address_id': address.id, 'address_name': address.name}
                )
            
            # Handle bulk package update
            if 'saved_package_id' in updates:
                package = SavedPackage.objects.get(id=updates['saved_package_id'])
                calculator = ShippingCalculator()
                for shipment in shipments:
                    shipment.length = package.length
                    shipment.width = package.width
                    shipment.height = package.height
                    shipment.weight_lbs = package.weight_lbs
                    shipment.weight_oz = package.weight_oz
                    
                    # Calculate shipping cost with zone-based rates and volumetric weight
                    result = calculator.calculate(
                        weight_lbs=shipment.weight_lbs,
                        weight_oz=shipment.weight_oz,
                        length=shipment.length,
                        width=shipment.width,
                        height=shipment.height,
                        provider=shipment.shipping_provider or 'USPS',
                        service=shipment.shipping_service,
                        origin_zip=shipment.from_zip,
                        origin_state=shipment.from_state,
                        destination_zip=shipment.to_zip,
                        destination_state=shipment.to_state
                    )
                    
                    # Update shipment with calculated values
                    shipment.shipping_cost = result['cost']
                    breakdown = result['breakdown']
                    shipment.dimensional_weight = Decimal(str(breakdown['dimensional_weight_lbs'])) if breakdown['dimensional_weight_lbs'] else None
                    shipment.billable_weight = Decimal(str(breakdown['billable_weight_lbs']))
                    shipment.weight_type = breakdown['weight_type']
                    shipment.shipping_zone = breakdown['shipping_zone']
                    shipment.zone_type = breakdown['zone_type']
                    shipment.is_intrastate = breakdown['zone_type'] == 'intrastate'
                    
                    # Mark package as reviewed
                    validation_flags = list(shipment.validation_flags or [])
                    if 'package_reviewed' not in validation_flags:
                        validation_flags.append('package_reviewed')
                    # Remove old flags
                    flags_to_remove = ['missing_package_details', 'auto_assigned_package']
                    for flag in flags_to_remove:
                        if flag in validation_flags:
                            validation_flags.remove(flag)
                    shipment.validation_flags = validation_flags
                    shipment._skip_weight_calculation = True
                    shipment.save()  # Persists to database - status will be auto-calculated
                updated_count = shipments.count()
                ShippingLogger().log_bulk_action(
                    'change_package',
                    updated_count,
                    {'package_id': package.id, 'package_name': package.name}
                )
            
            # Handle bulk shipping provider update
            if 'shipping_provider' in updates:
                provider = updates['shipping_provider']
                # If service is also provided, use it; otherwise keep existing service
                service = updates.get('shipping_service')
                calculator = ShippingCalculator()
                for shipment in shipments:
                    # Preserve current status if it's 'ready' - changing provider shouldn't change status
                    current_status = shipment.status
                    preserve_status = (current_status == 'ready')
                    
                    shipment.shipping_provider = provider
                    if service:
                        shipment.shipping_service = service
                    
                    # Calculate shipping cost with zone-based rates and volumetric weight
                    result = calculator.calculate(
                        weight_lbs=shipment.weight_lbs,
                        weight_oz=shipment.weight_oz,
                        length=shipment.length,
                        width=shipment.width,
                        height=shipment.height,
                        provider=provider,
                        service=shipment.shipping_service,
                        origin_zip=shipment.from_zip,
                        origin_state=shipment.from_state,
                        destination_zip=shipment.to_zip,
                        destination_state=shipment.to_state
                    )
                    
                    # Update shipment with calculated values
                    shipment.shipping_cost = result['cost']
                    breakdown = result['breakdown']
                    shipment.dimensional_weight = Decimal(str(breakdown['dimensional_weight_lbs'])) if breakdown['dimensional_weight_lbs'] else None
                    shipment.billable_weight = Decimal(str(breakdown['billable_weight_lbs']))
                    shipment.weight_type = breakdown['weight_type']
                    shipment.shipping_zone = breakdown['shipping_zone']
                    shipment.zone_type = breakdown['zone_type']
                    shipment.is_intrastate = breakdown['zone_type'] == 'intrastate'
                    shipment._skip_weight_calculation = True
                    
                    # Preserve status if it was 'ready' - don't recalculate
                    if preserve_status:
                        shipment._skip_auto_status = True
                    
                    shipment.save()  # Persists to database
                updated_count = shipments.count()
                ShippingLogger().log_bulk_action(
                    'change_shipping_provider',
                    updated_count,
                    {'provider': provider, 'service': service or 'unchanged'}
                )
            
            # Handle bulk shipping service update
            if 'shipping_service' in updates and 'shipping_provider' not in updates:
                calculator = ShippingCalculator()
                service = updates['shipping_service']
                for shipment in shipments:
                    # Preserve current status if it's 'ready' - changing service shouldn't change status
                    current_status = shipment.status
                    preserve_status = (current_status == 'ready')
                    
                    shipment.shipping_service = service
                    
                    # Calculate shipping cost with zone-based rates and volumetric weight
                    result = calculator.calculate(
                        weight_lbs=shipment.weight_lbs,
                        weight_oz=shipment.weight_oz,
                        length=shipment.length,
                        width=shipment.width,
                        height=shipment.height,
                        provider=shipment.shipping_provider or 'USPS',
                        service=service,
                        origin_zip=shipment.from_zip,
                        origin_state=shipment.from_state,
                        destination_zip=shipment.to_zip,
                        destination_state=shipment.to_state
                    )
                    
                    # Update shipment with calculated values
                    shipment.shipping_cost = result['cost']
                    breakdown = result['breakdown']
                    shipment.dimensional_weight = Decimal(str(breakdown['dimensional_weight_lbs'])) if breakdown['dimensional_weight_lbs'] else None
                    shipment.billable_weight = Decimal(str(breakdown['billable_weight_lbs']))
                    shipment.weight_type = breakdown['weight_type']
                    shipment.shipping_zone = breakdown['shipping_zone']
                    shipment.zone_type = breakdown['zone_type']
                    shipment.is_intrastate = breakdown['zone_type'] == 'intrastate'
                    shipment._skip_weight_calculation = True
                    
                    # Preserve status if it was 'ready' - don't recalculate
                    if preserve_status:
                        shipment._skip_auto_status = True
                    
                    shipment.save()  # Persists to database
                updated_count = shipments.count()
                ShippingLogger().log_bulk_action(
                    'change_shipping_service',
                    updated_count,
                    {'service': service}
                )
            
            serializer = self.get_serializer(shipments, many=True)
            return Response({
                'shipments': serializer.data,
                'updated_count': updated_count
            })
    
    @action(detail=True, methods=['post'])
    def validate_address(self, request, pk=None):
        """Validate address for a specific shipment"""
        shipment = self.get_object()
        validator = AddressValidator()
        
        to_address = {
            'first_name': shipment.to_first_name,
            'last_name': shipment.to_last_name,
            'address': shipment.to_address,
            'address2': shipment.to_address2,
            'city': shipment.to_city,
            'state': shipment.to_state,
            'zip': shipment.to_zip,
        }
        
        result = validator.validate(to_address)
        
        if result['valid']:
            corrected = result['corrected_address']
            shipment.to_address = corrected.get('address', shipment.to_address)
            shipment.to_city = corrected.get('city', shipment.to_city)
            shipment.to_state = corrected.get('state', shipment.to_state)
            shipment.to_zip = corrected.get('zip', shipment.to_zip)
            shipment.address_validated = True
            shipment.address_validation_api_used = result['api_used']
            shipment.address_corrections = result.get('corrections', [])
            shipment.save()
        
        return Response(result)
    
    @action(detail=False, methods=['post'])
    def test_validate_address(self, request):
        """
        Test address validation API endpoint.
        Accepts address data in request body and returns validation result.
        """
        validator = AddressValidator()
        
        address_data = request.data.get('address', {})
        if not address_data:
            return Response(
                {'error': 'Address data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate the address
        result = validator.validate(address_data)
        
        return Response(result, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'])
    def batch_validate_addresses(self, request):
        """
        Batch validate multiple addresses in one API call.
        Accepts 'from_address' and 'to_address' in request body.
        Returns validation results for both addresses and overall status.
        Validates both addresses in parallel for better performance.
        """
        logger.info("batch_validate_addresses endpoint HIT")
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        validator = AddressValidator()
        
        from_address = request.data.get('from_address', {})
        to_address = request.data.get('to_address', {})
        
        if not from_address and not to_address:
            return Response(
                {'error': 'At least one address (from_address or to_address) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = {}
        
        # Validate both addresses in parallel using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {}
            
            # Submit validation tasks
            if from_address:
                logger.info("Submitting from_address validation task")
                futures['from_address'] = executor.submit(validator.validate, from_address)
            if to_address:
                logger.info("Submitting to_address validation task")
                futures['to_address'] = executor.submit(validator.validate, to_address)
            
            # Collect results as they complete
            for key, future in futures.items():
                try:
                    results[key] = future.result()
                    logger.info(f"Validation completed for {key}")
                except Exception as e:
                    # If validation fails, return error result
                    results[key] = {
                        'valid': False,
                        'error': str(e),
                        'error_details': []
                    }
        
        # Determine overall validation status
        from_valid = results.get('from_address', {}).get('valid', True) if from_address else True
        to_valid = results.get('to_address', {}).get('valid', True) if to_address else True
        
        # Add individual validation statuses
        results['from_address_valid'] = from_valid
        results['to_address_valid'] = to_valid
        results['both_valid'] = from_valid and to_valid
        results['valid'] = from_valid and to_valid  # Overall valid status
        results['overall_status'] = 'valid' if results['both_valid'] else 'invalid'
        
        return Response(results, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def calculate_shipping(self, request, pk=None):
        """
        Calculate shipping cost for a shipment with zone-based rates and volumetric weight.
        
        IMPORTANT: Changes are persisted to database via .save()
        
        Accepts optional parameters:
        - service: Shipping service name
        - provider: Shipping provider (USPS, UPS, FedEx)
        """
        shipment = self.get_object()
        service = request.data.get('service', shipment.shipping_service)
        provider = request.data.get('provider', shipment.shipping_provider or 'USPS')
        
        calculator = ShippingCalculator()
        result = calculator.calculate(
            weight_lbs=shipment.weight_lbs,
            weight_oz=shipment.weight_oz,
            length=shipment.length,
            width=shipment.width,
            height=shipment.height,
            provider=provider,
            service=service,
            origin_zip=shipment.from_zip,
            origin_state=shipment.from_state,
            destination_zip=shipment.to_zip,
            destination_state=shipment.to_state
        )
        
        cost = result['cost']
        breakdown = result['breakdown']
        
        # Preserve current status if it's 'ready' - changing provider/service shouldn't change status
        current_status = shipment.status
        preserve_status = (current_status == 'ready')
        
        # Update shipment with calculated values
        shipment.shipping_provider = provider
        shipment.shipping_service = service
        shipment.shipping_cost = cost
        shipment.dimensional_weight = Decimal(str(breakdown['dimensional_weight_lbs'])) if breakdown['dimensional_weight_lbs'] else None
        shipment.billable_weight = Decimal(str(breakdown['billable_weight_lbs']))
        shipment.weight_type = breakdown['weight_type']
        shipment.shipping_zone = breakdown['shipping_zone']
        shipment.zone_type = breakdown['zone_type']
        shipment.is_intrastate = breakdown['zone_type'] == 'intrastate'
        
        # Skip auto-calculation since we're setting values explicitly
        shipment._skip_weight_calculation = True
        
        # Preserve status if it was 'ready' - don't recalculate
        if preserve_status:
            shipment._skip_auto_status = True
        
        shipment.save()  # Persists to database
        
        ShippingLogger().log_shipping_calculation(
            shipment.id, service, cost, 'zone_based'
        )
        
        return Response({
            'service': service,
            'provider': provider,
            'cost': float(cost),
            'formatted_cost': f"${cost:.2f}",
            'breakdown': breakdown
        })
    
    @action(detail=False, methods=['post'])
    def purchase(self, request):
        """Purchase labels for selected shipments"""
        shipment_ids = request.data.get('shipment_ids', [])
        label_size = request.data.get('label_size', 'letter')
        
        if not shipment_ids:
            return Response(
                {'error': 'No shipments selected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get shipments - only accept 'ready' status
        # Also ensure they have a shipping service selected
        shipments = Shipment.objects.filter(
            id__in=shipment_ids,
            status='ready'
        ).exclude(shipping_service='')
        
        if not shipments.exists():
            return Response(
                {'error': 'No ready shipments found. Please ensure shipments are valid and have shipping services selected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        calculator = ShippingCalculator()
        total_cost = calculator.calculate_bulk_total(shipments)
        
        # Create labels (simulated)
        from shipping_app.models import ShippingLabel
        labels = []
        for shipment in shipments:
            label = ShippingLabel.objects.create(
                shipment=shipment,
                label_size=label_size,
                tracking_number=f"TRACK{shipment.id:06d}"
            )
            labels.append(label)
            # Keep status as 'ready' after purchase (labels are created but shipment remains ready)
            # Status stays 'ready' to indicate labels are ready for use
        
        ShippingLogger().log_purchase(
            f"TXN{len(labels):06d}",
            total_cost,
            len(labels),
            label_size
        )
        
        return Response({
            'success': True,
            'labels_created': len(labels),
            'total_cost': float(total_cost),
            'label_size': label_size,
            'tracking_numbers': [label.tracking_number for label in labels]
        })
    
    @action(detail=False, methods=['get'])
    def get_tariff_chart(self, request):
        """
        Get tariff chart data with zone-based rates for all providers and services
        
        Returns structured tariff data for display in tariff chart modal
        """
        calculator = ShippingCalculator()
        tariff_data = calculator.get_tariff_chart()
        return Response(tariff_data)


class SavedAddressViewSet(viewsets.ModelViewSet):
    """ViewSet for SavedAddress CRUD operations"""
    queryset = SavedAddress.objects.all()
    serializer_class = SavedAddressSerializer
    
    def get_queryset(self):
        """Filter addresses by type if address_type query parameter is provided"""
        queryset = SavedAddress.objects.all()
        address_type = self.request.query_params.get('address_type', None)
        if address_type in ['from', 'to']:
            queryset = queryset.filter(address_type=address_type)
        return queryset
    
    def perform_create(self, serializer):
        """Override create to handle default address logic"""
        instance = serializer.save()
        # If this is set as default, unset all others of the same type
        if instance.is_default:
            SavedAddress.objects.filter(
                is_default=True,
                address_type=instance.address_type
            ).exclude(id=instance.id).update(is_default=False)
    
    def perform_update(self, serializer):
        """Override update to handle default address logic"""
        instance = serializer.save()
        # If this is set as default, unset all others of the same type
        if instance.is_default:
            SavedAddress.objects.filter(
                is_default=True,
                address_type=instance.address_type
            ).exclude(id=instance.id).update(is_default=False)


class SavedPackageViewSet(viewsets.ModelViewSet):
    """ViewSet for SavedPackage CRUD operations"""
    queryset = SavedPackage.objects.all()
    serializer_class = SavedPackageSerializer
    
    def perform_create(self, serializer):
        """Override create to handle default package logic"""
        instance = serializer.save()
        # If this is set as default, unset all others
        if instance.is_default:
            SavedPackage.objects.filter(is_default=True).exclude(id=instance.id).update(is_default=False)
    
    def perform_update(self, serializer):
        """Override update to handle default package logic"""
        instance = serializer.save()
        # If this is set as default, unset all others
        if instance.is_default:
            SavedPackage.objects.filter(is_default=True).exclude(id=instance.id).update(is_default=False)


class OrderNumberSettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for OrderNumberSettings CRUD operations"""
    queryset = OrderNumberSettings.objects.all()
    serializer_class = OrderNumberSettingsSerializer
    
    def get_queryset(self):
        """Return active settings or create default if none exist"""
        OrderNumberSettings.get_active_settings()  # Ensure default exists
        return super().get_queryset()
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the active order number settings"""
        settings = OrderNumberSettings.get_active_settings()
        serializer = self.get_serializer(settings)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        """Override create to handle active settings logic"""
        instance = serializer.save()
        # If this is set as active, unset all others
        if instance.is_active:
            OrderNumberSettings.objects.filter(is_active=True).exclude(id=instance.id).update(is_active=False)
    
    def perform_update(self, serializer):
        """Override update to handle active settings logic"""
        instance = serializer.save()
        # If this is set as active, unset all others
        if instance.is_active:
            OrderNumberSettings.objects.filter(is_active=True).exclude(id=instance.id).update(is_active=False)
