from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction
from django.conf import settings
from decimal import Decimal
from datetime import datetime
import traceback

from shipping_app.models import Shipment, SavedAddress, SavedPackage
from shipping_app.serializers import (
    ShipmentSerializer,
    SavedAddressSerializer,
    SavedPackageSerializer
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
    
    def update(self, request, *args, **kwargs):
        """Override update to handle manual status changes"""
        # If status is being explicitly set, mark it to skip auto-calculation
        if 'status' in request.data:
            instance = self.get_object()
            instance._skip_auto_status = True
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to handle manual status changes"""
        # If status is being explicitly set, mark it to skip auto-calculation
        if 'status' in request.data:
            instance = self.get_object()
            instance._skip_auto_status = True
        return super().partial_update(request, *args, **kwargs)
    
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
            result = parser.parse_file(file.read())
            
            if result['errors']:
                return Response(
                    {'errors': result['errors'], 'warnings': result['warnings']},
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
                for row_data in result['rows']:
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
                        shipping_provider='USPS',
                        shipping_service='Ground Shipping',
                        process_date=process_date,  # Set process date for dashboard analytics
                    )
                    
                    # Calculate shipping cost
                    shipment.shipping_cost = calculator.calculate(
                        shipment.weight_lbs,
                        shipment.weight_oz,
                        shipment.shipping_service
                    )
                    # Status will be auto-calculated by model's save() method
                    shipment.save()
                    
                    created_shipments.append(shipment)
            
            serializer = self.get_serializer(created_shipments, many=True)
            return Response({
                'shipments': serializer.data,
                'count': len(created_shipments),
                'warnings': result['warnings']
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            error_trace = traceback.format_exc()
            logger = ShippingLogger()
            logger.logger.error('csv_upload_error', exc_info=True, extra={'error': str(e)})
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
            
            # Handle bulk address update
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
                    shipment.shipping_cost = calculator.calculate(
                        shipment.weight_lbs,
                        shipment.weight_oz,
                        shipment.shipping_service
                    )
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
                    shipment.shipping_cost = calculator.calculate(
                        shipment.weight_lbs,
                        shipment.weight_oz,
                        shipment.shipping_service
                    )
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
                    shipment.shipping_cost = calculator.calculate(
                        shipment.weight_lbs,
                        shipment.weight_oz,
                        service
                    )
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
    def calculate_shipping(self, request, pk=None):
        """
        Calculate shipping cost for a shipment.
        
        IMPORTANT: Changes are persisted to database via .save()
        """
        shipment = self.get_object()
        service = request.data.get('service', shipment.shipping_service)
        
        calculator = ShippingCalculator()
        cost = calculator.calculate(shipment.weight_lbs, shipment.weight_oz, service)
        
        shipment.shipping_service = service
        shipment.shipping_cost = cost
        shipment.save()  # Persists to database - status will be auto-calculated
        
        ShippingLogger().log_shipping_calculation(
            shipment.id, service, cost, 'standard'
        )
        
        return Response({
            'service': service,
            'cost': float(cost),
            'formatted_cost': f"${cost:.2f}"
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


class SavedAddressViewSet(viewsets.ModelViewSet):
    """ViewSet for SavedAddress CRUD operations"""
    queryset = SavedAddress.objects.all()
    serializer_class = SavedAddressSerializer


class SavedPackageViewSet(viewsets.ModelViewSet):
    """ViewSet for SavedPackage CRUD operations"""
    queryset = SavedPackage.objects.all()
    serializer_class = SavedPackageSerializer
