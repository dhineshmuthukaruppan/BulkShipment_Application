"""
Order Number Generator Service

Handles atomic order number generation for shipments using database transactions
and SELECT FOR UPDATE locking to prevent race conditions in concurrent scenarios.
"""
import re
from typing import List, Dict
from django.db import transaction
from django.db.models import Q
from shipping_app.services.logger_service import ShippingLogger


class OrderNumberGenerator:
    """Service for generating sequential order numbers atomically"""
    
    def __init__(self):
        self.logger = ShippingLogger()
    
    @staticmethod
    @transaction.atomic
    def generate_order_numbers_for_shipments(shipment_ids: List[int]) -> Dict[int, str]:
        """
        Generate order numbers for shipments that have empty order_number fields.
        Uses SELECT FOR UPDATE to ensure atomicity in concurrent scenarios.
        
        IMPORTANT: Order numbers are generated continuously across ALL shipments in the database,
        not just the current purchase. If the last order number is ORD-0015, the next purchase
        will start from ORD-0016, ensuring a continuous sequence regardless of which user
        or purchase creates the shipments.
        
        Args:
            shipment_ids: List of shipment IDs that need order numbers
            
        Returns:
            Dict mapping shipment_id to generated order_number
            
        Raises:
            Exception: If order number generation fails
        """
        if not shipment_ids:
            return {}
        
        # Import models here to avoid circular import
        from shipping_app.models import Shipment, OrderNumberSettings
        
        # Lock the active OrderNumberSettings to prevent concurrent modifications
        try:
            settings = OrderNumberSettings.objects.select_for_update().filter(is_active=True).first()
            if not settings:
                # Create default settings if none exist
                settings = OrderNumberSettings.objects.create(
                    prefix='ORD',
                    starting_number=1,
                    number_format='0000',
                    separator='-',
                    is_active=True
                )
            # Extract settings values
            prefix = settings.prefix
            separator = settings.separator
            number_format = settings.number_format
            starting_number = settings.starting_number
        except Exception as e:
            logger = ShippingLogger()
            logger.log_error('order_number_settings_error', f"Failed to load settings: {str(e)}")
            # Fallback to default values
            prefix = 'ORD'
            separator = '-'
            number_format = '0000'
            starting_number = 1
        
        # Get shipments that need order numbers (empty order_number field)
        shipments = Shipment.objects.filter(
            id__in=shipment_ids
        ).filter(
            # Order number is empty or null
            Q(order_number__isnull=True) | Q(order_number='')
        ).order_by('id')
        
        if not shipments.exists():
            return {}
        
        # Find the highest existing order number in the database
        # IMPORTANT: This queries ALL shipments in the database (not just current purchase)
        # to ensure continuous order number sequence across all purchases/users.
        # Example: If last order number is ORD-0015, next purchase starts from ORD-0016
        existing_shipments = Shipment.objects.filter(
            Q(order_number__isnull=False) & ~Q(order_number='')
        ).exclude(id__in=shipment_ids)  # Exclude shipments we're about to update (they're empty anyway)
        
        max_suffix = starting_number - 1  # Start from configured starting number - 1
        
        # Extract numeric suffixes from all existing order numbers to find the maximum
        # This ensures continuous numbering: if max is 15, next starts at 16
        for shipment in existing_shipments.only('order_number'):
            order_num = shipment.order_number
            if not order_num:
                continue
            
            # Try to extract numeric suffix from configured prefix format
            # Pattern: prefix + separator + digits (e.g., ORD-0001, ORDER-1, etc.)
            pattern = re.escape(prefix) + re.escape(separator) + r'(\d+)'
            match = re.search(pattern, order_num, re.IGNORECASE)
            if match:
                suffix = int(match.group(1))
                max_suffix = max(max_suffix, suffix)
            else:
                # Also check for prefix without separator or with different separator
                pattern_alt = re.escape(prefix) + r'[-_]?' + r'(\d+)'
                match_alt = re.search(pattern_alt, order_num, re.IGNORECASE)
                if match_alt:
                    suffix = int(match_alt.group(1))
                    max_suffix = max(max_suffix, suffix)
        
        # Generate sequential order numbers starting from max_suffix + 1
        current_counter = max_suffix + 1
        order_number_mapping = {}
        
        # Convert number_format like "0000" to Python format spec "04d"
        if number_format.isdigit():
            padding_width = len(number_format)
            format_spec = f"0{padding_width}d"
        else:
            format_spec = number_format
        
        format_str = f"{{:{format_spec}}}"
        
        # Generate order numbers for each shipment
        shipments_to_update = []
        for shipment in shipments:
            formatted_num = format_str.format(current_counter)
            order_number = f"{prefix}{separator}{formatted_num}"
            
            shipment.order_number = order_number
            order_number_mapping[shipment.id] = order_number
            shipments_to_update.append(shipment)
            
            # Update validation flags
            validation_flags = list(shipment.validation_flags or [])
            if 'order_number_auto_generated' not in validation_flags:
                validation_flags.append('order_number_auto_generated')
            # Remove missing_order_number flag if present
            if 'missing_order_number' in validation_flags:
                validation_flags.remove('missing_order_number')
            shipment.validation_flags = validation_flags
            
            current_counter += 1
        
        # Bulk update shipments with generated order numbers
        Shipment.objects.bulk_update(
            shipments_to_update,
            ['order_number', 'validation_flags'],
            batch_size=100
        )
        
        # Format the starting order number for logging (reuse format_str already created)
        starting_order_num = f"{prefix}{separator}{format_str.format(max_suffix + 1)}"
        # Log the order number generation using structlog directly
        import structlog
        log = structlog.get_logger()
        log.info(
            "order_numbers_generated",
            count=len(order_number_mapping),
            starting_order_number=starting_order_num,
            event_type="order_number_generation"
        )
        
        return order_number_mapping
