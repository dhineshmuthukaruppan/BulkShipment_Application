from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction
from django.conf import settings
from decimal import Decimal
from datetime import datetime
import traceback

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


class ShipmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Shipment CRUD operations.
    
    IMPORTANT: All operations persist to the database.
    - CREATE: Shipment.objects.create() saves to DB
    - UPDATE: DRF's update()/partial_update() automatically save to DB
    - DELETE: DRF's destroy() automatically deletes from DB
    - BULK UPDATE: Uses .save() which persists to DB
    
    Database is the single source of truth. Redux is only for UI state management.
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
                    
                    # Validate sender address (if present)
                    if row_data.get('from_address') or row_data.get('from_city') or row_data.get('from_zip'):
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
                            validation_flags = row_data.get('validation_flags', [])
                            error_details = from_validation_result.get('error_details', [])
                            
                            # Only flag specific components if API explicitly provides error_details
                            # Don't infer specific issues from generic error messages
                            if error_details:
                                # API provided specific error details - use them
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
                                # No specific error details - only flag as general invalid address
                                # Don't infer specific component issues
                                if 'invalid_ship_from_address' not in validation_flags:
                                    validation_flags.append('invalid_ship_from_address')
                            
                            row_data['validation_flags'] = validation_flags
                            # Store validation error in the same format as validate_all_addresses endpoint
                            error_message = from_validation_result.get('error', 'Address could not be validated')
                            # Initialize address_validation_error if it doesn't exist
                            if 'address_validation_error' not in row_data:
                                row_data['address_validation_error'] = ''
                            # Add ship from error
                            if row_data['address_validation_error']:
                                row_data['address_validation_error'] += f"\nShip From: {error_message}"
                            else:
                                row_data['address_validation_error'] = f"Ship From: {error_message}"
                    
                    # Validate recipient address
                    to_address = {
                        'first_name': row_data.get('to_first_name', ''),
                        'last_name': row_data.get('to_last_name', ''),
                        'address': row_data.get('to_address', ''),
                        'address2': row_data.get('to_address2', ''),
                        'city': row_data.get('to_city', ''),
                        'state': row_data.get('to_state', ''),
                        'zip': row_data.get('to_zip', ''),
                    }
                    
                    validation_result = validator.validate(to_address)
                    if validation_result['valid']:
                        # Update with corrected address
                        corrected = validation_result['corrected_address']
                        row_data['to_address'] = corrected.get('address', row_data.get('to_address'))
                        row_data['to_city'] = corrected.get('city', row_data.get('to_city'))
                        row_data['to_state'] = corrected.get('state', row_data.get('to_state'))
                        row_data['to_zip'] = corrected.get('zip', row_data.get('to_zip'))
                        
                        row_data['address_validated'] = True
                        row_data['address_validation_api_used'] = validation_result['api_used']
                        row_data['address_corrections'] = validation_result.get('corrections', [])
                    else:
                        # Address is invalid - flag specific issues only if API provides them
                        validation_flags = row_data.get('validation_flags', [])
                        error_details = validation_result.get('error_details', [])
                        
                        # Only flag specific components if API explicitly provides error_details
                        # Don't infer specific issues from generic error messages
                        if error_details:
                            # API provided specific error details - use them
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
                            # No specific error details - only flag as general invalid address
                            # Don't infer specific component issues
                            if 'invalid_ship_to_address' not in validation_flags:
                                validation_flags.append('invalid_ship_to_address')
                        
                        row_data['validation_flags'] = validation_flags
                        row_data['address_validated'] = False
                        row_data['address_validation_api_used'] = validation_result.get('api_used', 'Unknown')
                        error_message = validation_result.get('error', 'Address could not be validated')
                        # Store validation error in the same format as validate_all_addresses endpoint
                        # Initialize address_validation_error if it doesn't exist
                        if 'address_validation_error' not in row_data:
                            row_data['address_validation_error'] = ''
                        # Add ship to error (combine with ship from error if exists)
                        if row_data['address_validation_error']:
                            row_data['address_validation_error'] += f"\nShip To: {error_message}"
                        else:
                            row_data['address_validation_error'] = f"Ship To: {error_message}"
                        # Add to validation errors
                        validation_errors = row_data.get('validation_errors', [])
                        validation_errors.append(f"Invalid address: {error_message}")
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
                    shipment.save()  # Persists to database - status will be auto-calculated
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
                    shipment.save()  # Persists to database - status will be auto-calculated
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
    
    @action(detail=True, methods=['post'])
    def validate_all_addresses(self, request, pk=None):
        """Validate both from and to addresses for a specific shipment"""
        shipment = self.get_object()
        validator = AddressValidator()
        validation_messages = []
        
        # Validate from address if present
        from_valid = True
        from_validation_error = None
        if shipment.from_address or shipment.from_city or shipment.from_zip:
            from_address = {
                'first_name': shipment.from_first_name or '',
                'last_name': shipment.from_last_name or '',
                'address': shipment.from_address or '',
                'address2': shipment.from_address2 or '',
                'city': shipment.from_city or '',
                'state': shipment.from_state or '',
                'zip': shipment.from_zip or '',
            }
            from_result = validator.validate(from_address)
            from_valid = from_result['valid']
            if not from_valid:
                from_validation_error = from_result.get('error', 'Ship from address could not be validated')
                validation_messages.append(f"Ship From: {from_validation_error}")
                # Update validation flags
                validation_flags = list(shipment.validation_flags or [])
                if 'invalid_ship_from_address' not in validation_flags:
                    validation_flags.append('invalid_ship_from_address')
                shipment.validation_flags = validation_flags
            else:
                # Remove invalid flags if valid
                validation_flags = list(shipment.validation_flags or [])
                validation_flags = [f for f in validation_flags if not f.startswith('invalid_ship_from')]
                shipment.validation_flags = validation_flags
        
        # Validate to address
        to_address = {
            'first_name': shipment.to_first_name,
            'last_name': shipment.to_last_name,
            'address': shipment.to_address,
            'address2': shipment.to_address2,
            'city': shipment.to_city,
            'state': shipment.to_state,
            'zip': shipment.to_zip,
        }
        to_result = validator.validate(to_address)
        to_valid = to_result['valid']
        to_validation_error = None
        if not to_valid:
            to_validation_error = to_result.get('error', 'Ship to address could not be validated')
            validation_messages.append(f"Ship To: {to_validation_error}")
            # Update validation flags
            validation_flags = list(shipment.validation_flags or [])
            if 'invalid_ship_to_address' not in validation_flags:
                validation_flags.append('invalid_ship_to_address')
            shipment.validation_flags = validation_flags
        else:
            # Remove invalid flags if valid
            validation_flags = list(shipment.validation_flags or [])
            validation_flags = [f for f in validation_flags if not f.startswith('invalid_ship_to')]
            shipment.validation_flags = validation_flags
            # Update with corrected address
            corrected = to_result['corrected_address']
            shipment.to_address = corrected.get('address', shipment.to_address)
            shipment.to_city = corrected.get('city', shipment.to_city)
            shipment.to_state = corrected.get('state', shipment.to_state)
            shipment.to_zip = corrected.get('zip', shipment.to_zip)
            shipment.address_validated = True
            shipment.address_validation_api_used = to_result['api_used']
            shipment.address_corrections = to_result.get('corrections', [])
        
        # Store validation errors in address_validation_error field
        # Combine both from and to errors if they exist
        error_parts = []
        if from_validation_error:
            error_parts.append(f"Ship From: {from_validation_error}")
        if to_validation_error:
            error_parts.append(f"Ship To: {to_validation_error}")
        shipment.address_validation_error = '\n'.join(error_parts) if error_parts else ''
        shipment.save()  # This will trigger status recalculation
        
        all_valid = from_valid and to_valid
        return Response({
            'valid': all_valid,
            'from_valid': from_valid,
            'to_valid': to_valid,
            'validation_messages': validation_messages,
            'from_validation_error': from_validation_error,
            'to_validation_error': to_validation_error,
        })
    
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
                futures['from_address'] = executor.submit(validator.validate, from_address)
            if to_address:
                futures['to_address'] = executor.submit(validator.validate, to_address)
            
            # Collect results as they complete
            for key, future in futures.items():
                try:
                    results[key] = future.result()
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
