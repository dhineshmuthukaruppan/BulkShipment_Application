from django.db import models
from django.core.validators import MinValueValidator


class SavedAddress(models.Model):
    """Frequently used ship-from addresses"""
    name = models.CharField(max_length=200)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    address = models.TextField()
    address2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    zip_code = models.CharField(max_length=10)
    phone = models.CharField(max_length=20, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Saved Addresses"
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} - {self.city}, {self.state}"


class SavedPackage(models.Model):
    """Frequently used package presets"""
    name = models.CharField(max_length=200)
    length = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0.01)])
    width = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0.01)])
    height = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0.01)])
    weight_lbs = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0)])
    weight_oz = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Saved Packages"
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} - {self.length}x{self.width}x{self.height} in, {self.weight_lbs} lbs"


class Shipment(models.Model):
    STATUS_CHOICES = [
        ('ready', 'Ready'),
        ('needs_review', 'Needs Review'),
        ('needs_review_address', 'Needs Review - Address'),
        ('needs_review_package', 'Needs Review - Package'),
        ('invalid', 'Invalid'),
    ]

    # From Address (columns 0-6)
    from_first_name = models.CharField(max_length=100, blank=True)
    from_last_name = models.CharField(max_length=100, blank=True)
    from_address = models.TextField(blank=True)
    from_address2 = models.CharField(max_length=200, blank=True)
    from_city = models.CharField(max_length=100, blank=True)
    from_state = models.CharField(max_length=2, blank=True)
    from_zip = models.CharField(max_length=10, blank=True)
    from_phone = models.CharField(max_length=20, blank=True)

    # To Address (columns 7-13)
    to_first_name = models.CharField(max_length=100)
    to_last_name = models.CharField(max_length=100, blank=True)
    to_address = models.TextField()
    to_address2 = models.CharField(max_length=200, blank=True)
    to_city = models.CharField(max_length=100)
    to_state = models.CharField(max_length=2)
    to_zip = models.CharField(max_length=10)
    to_phone = models.CharField(max_length=20, blank=True)

    # Package Details (columns 14-18)
    weight_lbs = models.DecimalField(max_digits=5, decimal_places=2, default=1.0, validators=[MinValueValidator(0)])
    weight_oz = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    length = models.DecimalField(max_digits=5, decimal_places=2, default=6.0, validators=[MinValueValidator(0.01)])
    width = models.DecimalField(max_digits=5, decimal_places=2, default=6.0, validators=[MinValueValidator(0.01)])
    height = models.DecimalField(max_digits=5, decimal_places=2, default=6.0, validators=[MinValueValidator(0.01)])

    # Reference (columns 19-22)
    order_number = models.CharField(max_length=100, blank=True)
    item_sku = models.CharField(max_length=100, blank=True)
    phone_num1 = models.CharField(max_length=20, blank=True)
    phone_num2 = models.CharField(max_length=20, blank=True)

    # System fields
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='needs_review')
    validation_errors = models.JSONField(default=list, blank=True)
    validation_warnings = models.JSONField(default=list, blank=True)
    validation_flags = models.JSONField(default=list, blank=True)
    shipping_provider = models.CharField(max_length=50, blank=True, default='USPS')
    shipping_service = models.CharField(max_length=50, blank=True, default='Ground Shipping')
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Address validation results
    address_validated = models.BooleanField(default=False)
    address_validation_api_used = models.CharField(max_length=50, blank=True)
    address_corrections = models.JSONField(default=list, blank=True)

    # Process date for dashboard analytics
    process_date = models.DateField(null=True, blank=True, help_text="Date when the order was processed (for dashboard analytics)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Shipment {self.id} - {self.to_first_name} {self.to_last_name} - {self.order_number}"

    def get_formatted_from_address(self):
        """Format the from address for display"""
        parts = []
        if self.from_first_name or self.from_last_name:
            parts.append(f"{self.from_first_name} {self.from_last_name}".strip())
        if self.from_address:
            parts.append(self.from_address)
        if self.from_address2:
            parts.append(self.from_address2)
        if self.from_city and self.from_state:
            parts.append(f"{self.from_city}, {self.from_state} {self.from_zip}".strip())
        return "\n".join(parts) if parts else "No sender address"

    def get_formatted_to_address(self):
        """Format the to address for display"""
        parts = []
        if self.to_first_name or self.to_last_name:
            parts.append(f"{self.to_first_name} {self.to_last_name}".strip())
        if self.to_address:
            parts.append(self.to_address)
        if self.to_address2:
            parts.append(self.to_address2)
        if self.to_city and self.to_state:
            parts.append(f"{self.to_city}, {self.to_state} {self.to_zip}".strip())
        return "\n".join(parts)

    def get_package_details(self):
        """Format package details for display"""
        return f"{self.length}\" x {self.width}\" x {self.height}\" | {self.weight_lbs} lbs {self.weight_oz} oz"

    def get_validation_status(self):
        """Determine validation status for UI (legacy method - kept for compatibility)"""
        if self.validation_errors:
            return 'invalid'
        elif self.validation_warnings or self.validation_flags:
            return 'warning'
        else:
            return 'valid'
    
    def calculate_status(self):
        """
        Auto-calculate status based on validation and completeness:
        - 'invalid': Required data missing (validation_errors exist)
        - 'needs_review_address': Address not reviewed yet
        - 'needs_review_package': Package not reviewed yet
        - 'needs_review': Neither address nor package reviewed
        - 'ready': Both address and package have been reviewed
        """
        # Check for validation errors (required data missing)
        if self.validation_errors:
            return 'invalid'
        
        # Check required fields completeness first
        required_to_fields = [
            self.to_first_name,
            self.to_address,
            self.to_city,
            self.to_state,
            self.to_zip,
        ]
        
        # If any required recipient field is missing, it's invalid
        if not all(required_to_fields):
            return 'invalid'
        
        # Check review flags
        validation_flags = self.validation_flags or []
        address_reviewed = 'address_reviewed' in validation_flags
        package_reviewed = 'package_reviewed' in validation_flags
        
        # Both reviewed = ready
        if address_reviewed and package_reviewed:
            return 'ready'
        
        # Only address reviewed = needs package review
        if address_reviewed and not package_reviewed:
            return 'needs_review_package'
        
        # Only package reviewed = needs address review
        if package_reviewed and not address_reviewed:
            return 'needs_review_address'
        
        # Neither reviewed = needs review
        return 'needs_review'
    
    def save(self, *args, **kwargs):
        """Auto-update status before saving"""
        # Check if status is being explicitly set (manual override)
        # This happens when user toggles status or when status is in update_fields
        update_fields = kwargs.get('update_fields')
        
        # If status is in update_fields, it means it's being explicitly set
        # Store the original status value before auto-calculation
        original_status = self.status
        status_in_update_fields = update_fields is not None and 'status' in update_fields
        
        # Check if status should be skipped from auto-calculation
        should_skip_auto_status = hasattr(self, '_skip_auto_status') and self._skip_auto_status
        
        # Auto-calculate status unless explicitly set via update_fields or skip flag
        if not status_in_update_fields and not should_skip_auto_status:
            calculated_status = self.calculate_status()
            self.status = calculated_status
            # If update_fields is specified, add status to it
            if update_fields is not None:
                kwargs['update_fields'] = list(update_fields) + ['status']
        elif should_skip_auto_status:
            # Status was explicitly set, ensure it's included in update_fields if specified
            if update_fields is not None and 'status' not in update_fields:
                kwargs['update_fields'] = list(update_fields) + ['status']
        
        # Clear skip flag after using it
        if hasattr(self, '_skip_auto_status'):
            delattr(self, '_skip_auto_status')
            
        super().save(*args, **kwargs)


class OrderNumberSettings(models.Model):
    """Master configuration for sequential order number generation"""
    prefix = models.CharField(max_length=20, default='ORD', help_text="Prefix for order numbers (e.g., 'ORD', 'ORDER', 'SHIP')")
    starting_number = models.IntegerField(default=1, validators=[MinValueValidator(1)], help_text="Starting number for sequential IDs")
    number_format = models.CharField(
        max_length=10, 
        default='0000', 
        help_text="Number format: '0000' = 4 digits (ORD-0001), '00000' = 5 digits (ORD-00001)"
    )
    separator = models.CharField(max_length=5, default='-', help_text="Separator between prefix and number (e.g., '-', '_', or empty)")
    is_active = models.BooleanField(default=True, help_text="Whether this configuration is active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Order Number Settings"
        ordering = ['-is_active', '-created_at']

    def __str__(self):
        example = self.get_example()
        return f"{self.prefix}{self.separator}{example} (Starting: {self.starting_number})"
    
    def get_example(self):
        """Get an example order number with current settings"""
        # Convert number_format like "0000" to Python format spec "04d"
        if self.number_format.isdigit():
            padding_width = len(self.number_format)
            format_spec = f"0{padding_width}d"
        else:
            format_spec = self.number_format
        
        format_str = f"{{:{format_spec}}}"
        formatted_num = format_str.format(self.starting_number)
        return f"{self.prefix}{self.separator}{formatted_num}"
    
    def generate_order_number(self, sequence_number: int) -> str:
        """Generate an order number for a given sequence number"""
        # Convert number_format like "0000" to Python format spec "04d"
        # "0000" means 4 digits with zero padding
        if self.number_format.isdigit():
            # Count zeros to determine padding width
            padding_width = len(self.number_format)
            format_spec = f"0{padding_width}d"
        else:
            # Already a format spec like "04d"
            format_spec = self.number_format
        
        format_str = f"{{:{format_spec}}}"
        formatted_num = format_str.format(sequence_number)
        return f"{self.prefix}{self.separator}{formatted_num}"

    @classmethod
    def get_active_settings(cls):
        """Get the active order number settings, or create default if none exist"""
        settings = cls.objects.filter(is_active=True).first()
        if not settings:
            # Create default settings
            settings = cls.objects.create(
                prefix='ORD',
                starting_number=1,
                number_format='0000',
                separator='-',
                is_active=True
            )
        return settings


class ShippingLabel(models.Model):
    """Generated shipping labels"""
    shipment = models.OneToOneField(Shipment, on_delete=models.CASCADE, related_name='label')
    label_size = models.CharField(max_length=20, choices=[
        ('letter', 'Letter/A4'),
        ('4x6', '4x6 inch'),
    ], default='letter')
    label_data = models.TextField(blank=True)  # Base64 encoded label or PDF data
    tracking_number = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Label for Shipment {self.shipment.id}"
