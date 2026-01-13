"""
CSV Parser service for handling 2-header row format from Template.csv
"""
import csv
import io
from typing import List, Dict, Any
from shipping_app.services.logger_service import ShippingLogger


class CSVParser:
    """
    Parser for CSV files with 2-header row structure:
    Row 1: "From,,,,,,,To,,,,,,,weight*,weight*,Dimensions*,Dimensions*,Dimensions*,,,,"  
    Row 2: Actual column headers
    Row 3+: Data rows
    """
    
    COLUMN_MAPPING = {
        # From Address (0-6)
        'from_first_name': 0,
        'from_last_name': 1,
        'from_address': 2,
        'from_address2': 3,
        'from_city': 4,
        'from_zip': 5,
        'from_state': 6,
        # To Address (7-13)
        'to_first_name': 7,
        'to_last_name': 8,
        'to_address': 9,
        'to_address2': 10,
        'to_city': 11,
        'to_zip': 12,
        'to_state': 13,
        # Package Details (14-18)
        'weight_lbs': 14,
        'weight_oz': 15,
        'length': 16,
        'width': 17,
        'height': 18,
        # Reference (19-22)
        'phone_num1': 19,
        'phone_num2': 20,
        'order_number': 21,
        'item_sku': 22,
    }
    
    def __init__(self):
        self.logger = ShippingLogger()
    
    def parse_file(self, file_content: bytes) -> Dict[str, Any]:
        """
        Parse CSV file with 2-header row format
        
        Returns:
            {
                'rows': List[Dict] - Parsed shipment data,
                'errors': List[str] - Parsing errors,
                'warnings': List[str] - Data warnings
            }
        """
        try:
            # Decode file content
            content = file_content.decode('utf-8')
            reader = csv.reader(io.StringIO(content))
            
            # Skip first header row (descriptive row)
            first_row = next(reader, None)
            if not first_row:
                return {'rows': [], 'errors': ['Empty file'], 'warnings': []}
            
            # Skip second header row (column names)
            second_row = next(reader, None)
            if not second_row:
                return {'rows': [], 'errors': ['No data rows found'], 'warnings': []}
            
            # First pass: Parse all rows and collect order numbers
            raw_rows = []
            for row_num, row in enumerate(reader, start=3):
                if not row or all(not cell.strip() for cell in row):
                    continue  # Skip empty rows
                raw_rows.append((row, row_num))
            
            # Parse all rows first (extract from Address2 if order_number column is empty)
            parsed_rows = []
            errors = []
            warnings = []
            
            for row, row_num in raw_rows:
                try:
                    parsed_row = self._parse_row(row, row_num, skip_order_generation=True)
                    if parsed_row:
                        parsed_rows.append(parsed_row)
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    self.logger.log_error('csv_parse_error', str(e), {'row_num': row_num})
            
            # Generate sequential order numbers for rows where order_number column is empty
            # This is the primary requirement: fill empty order_number columns with sequential IDs
            parsed_rows = self._generate_sequential_order_numbers(parsed_rows)
            
            # Add comprehensive validation flags
            for row in parsed_rows:
                row['validation_flags'] = self._add_comprehensive_validation_flags(row)
            
            self.logger.log_csv_upload(
                file_name='uploaded_file.csv',
                row_count=len(parsed_rows),
                issues=errors + warnings,
                auto_fixes_applied=True
            )
            
            return {
                'rows': parsed_rows,
                'errors': errors,
                'warnings': warnings
            }
            
        except Exception as e:
            error_msg = f"Failed to parse CSV: {str(e)}"
            self.logger.log_error('csv_parse_fatal', error_msg)
            return {'rows': [], 'errors': [error_msg], 'warnings': []}
    
    def _parse_row(self, row: List[str], row_num: int, skip_order_generation: bool = False) -> Dict[str, Any]:
        """Parse a single CSV row into structured data"""
        # Ensure row has enough columns
        while len(row) < 23:
            row.append('')
        
        # Extract data using column mapping
        data = {}
        for field, col_index in self.COLUMN_MAPPING.items():
            value = row[col_index].strip() if col_index < len(row) else ''
            data[field] = value
        
        # Apply validation and defaults
        data = self._apply_defaults(data, row_num, skip_order_generation)
        data = self._validate_row(data, row_num)
        
        return data
    
    def _apply_defaults(self, data: Dict[str, Any], row_num: int, skip_order_generation: bool = False) -> Dict[str, Any]:
        """Apply intelligent defaults for missing data"""
        import re
        validation_flags = []
        
        # Check if sender address is empty (all From fields empty)
        from_fields = ['from_first_name', 'from_last_name', 'from_address', 
                      'from_city', 'from_state', 'from_zip']
        if all(not data.get(field) for field in from_fields):
            # Will be assigned from saved addresses in validation step
            validation_flags.append('missing_sender_address')
        
        # Check if package data is missing
        package_fields = ['weight_lbs', 'length', 'width', 'height']
        if all(not data.get(field) for field in package_fields):
            # Apply default package
            data['weight_lbs'] = '1.0'
            data['weight_oz'] = '0'
            data['length'] = '6.0'
            data['width'] = '6.0'
            data['height'] = '6.0'
            validation_flags.append('auto_assigned_package')
        
        # Ensure weight_oz has a value
        if not data.get('weight_oz'):
            data['weight_oz'] = '0'
        
        # DO NOT extract order number from Address2
        # The PRIMARY requirement is: if order_number column (column 21) is empty,
        # generate sequential IDs using Master configuration (handled in _generate_sequential_order_numbers)
        # Address2 extraction is disabled to ensure sequential IDs from Master are used for empty order_number columns
        # This ensures that empty order_number columns get sequential IDs like ORD-0001, ORD-0002, etc. from Master settings
        
        data['validation_flags'] = validation_flags
        return data
    
    def _validate_row(self, data: Dict[str, Any], row_num: int) -> Dict[str, Any]:
        """Validate required fields"""
        errors = []
        warnings = []
        
        # Required recipient fields
        required_to_fields = {
            'to_first_name': 'Recipient first name',
            'to_address': 'Recipient address',
            'to_city': 'Recipient city',
            'to_state': 'Recipient state',
            'to_zip': 'Recipient ZIP code',
        }
        
        for field, label in required_to_fields.items():
            if not data.get(field):
                errors.append(f"{label} is required")
        
        # Validate numeric fields
        numeric_fields = {
            'weight_lbs': 'Weight (lbs)',
            'weight_oz': 'Weight (oz)',
            'length': 'Length',
            'width': 'Width',
            'height': 'Height',
        }
        
        for field, label in numeric_fields.items():
            value = data.get(field, '0')
            try:
                float_value = float(value) if value else 0.0
                if float_value < 0:
                    warnings.append(f"{label} cannot be negative")
                data[field] = str(float_value)
            except ValueError:
                warnings.append(f"{label} must be a number")
                data[field] = '0' if field != 'weight_lbs' else '1.0'
        
        data['validation_errors'] = errors
        data['validation_warnings'] = warnings
        
        return data
    
    def _generate_sequential_order_numbers(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate sequential order numbers using master configuration for rows where order_number column is empty.
        
        Primary requirement: If the order_number column (column 21) is empty in the CSV,
        generate sequential order numbers using the format configured in Master settings.
        
        Process:
        1. Get active order number settings from Master configuration
        2. Scan all rows to find existing order numbers (including those extracted from Address2)
        3. Find the highest numeric suffix
        4. For each row with empty order_number column, assign the next sequential ID using master format
        """
        import re
        from shipping_app.models import OrderNumberSettings
        
        # Get active order number settings from Master
        try:
            settings = OrderNumberSettings.get_active_settings()
            prefix = settings.prefix
            separator = settings.separator
            number_format = settings.number_format
            starting_number = settings.starting_number
        except Exception as e:
            # Fallback to default if settings not available
            self.logger.log_error('order_number_settings_error', f"Failed to load settings: {str(e)}")
            prefix = 'ORD'
            separator = '-'
            number_format = '0000'
            starting_number = 1
        
        # Extract all existing order numbers from the order_number column (column 21)
        # Only consider order numbers that are already in the order_number column, not from Address2
        existing_order_numbers = []
        for row in rows:
            order_num = row.get('order_number', '').strip()
            if order_num:
                existing_order_numbers.append(order_num)
        
        # Find the highest numeric suffix from existing order numbers
        # Only consider order numbers that match the configured prefix format from Master
        max_suffix = starting_number - 1  # Start from configured starting number - 1
        for order_num in existing_order_numbers:
            # Try to extract numeric suffix from configured prefix format (e.g., ORD-0001, ORDER-1, etc.)
            # This ensures we only consider order numbers that match the Master configuration
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
        
        # Generate sequential order numbers for rows where order_number column is empty
        # This is the primary requirement: fill empty order_number columns with sequential IDs
        current_counter = max_suffix + 1
        for row in rows:
            # Check if order_number column is empty (this is the main check)
            if not row.get('order_number', '').strip():
                # Generate order number using master configuration format
                format_str = f"{{:{number_format}}}"
                formatted_num = format_str.format(current_counter)
                order_number = f"{prefix}{separator}{formatted_num}"
                row['order_number'] = order_number
                validation_flags = row.get('validation_flags', [])
                # Remove any existing order_number related flags and add auto-generated flag
                flags_to_remove = ['order_number_extracted_from_address2', 'missing_order_number']
                for flag in flags_to_remove:
                    if flag in validation_flags:
                        validation_flags.remove(flag)
                if 'order_number_auto_generated' not in validation_flags:
                    validation_flags.append('order_number_auto_generated')
                row['validation_flags'] = validation_flags
                current_counter += 1
        
        return rows
    
    def _add_comprehensive_validation_flags(self, data: Dict[str, Any]) -> List[str]:
        """
        Add comprehensive validation flags for missing data fields.
        Returns updated list of validation flags.
        """
        validation_flags = list(data.get('validation_flags', []))
        
        # Check for missing order number
        if not data.get('order_number', '').strip():
            if 'order_number_auto_generated' not in validation_flags:
                validation_flags.append('missing_order_number')
        
        # Check for missing sender address (from address)
        from_fields = ['from_first_name', 'from_last_name', 'from_address', 
                      'from_city', 'from_state', 'from_zip']
        if all(not data.get(field) for field in from_fields):
            if 'missing_sender_address' not in validation_flags:
                validation_flags.append('missing_sender_address')
        
        # Check for missing recipient address (to address)
        to_required_fields = ['to_first_name', 'to_address', 'to_city', 'to_state', 'to_zip']
        missing_to_fields = [field for field in to_required_fields if not data.get(field)]
        if missing_to_fields:
            validation_flags.append('missing_recipient_address')
        
        # Check for missing pincode (ZIP code)
        if not data.get('to_zip', '').strip():
            validation_flags.append('missing_pincode')
        if not data.get('from_zip', '').strip() and any(data.get(f) for f in from_fields):
            validation_flags.append('missing_from_pincode')
        
        # Check for missing package details
        package_fields = ['weight_lbs', 'length', 'width', 'height']
        missing_package_fields = [field for field in package_fields if not data.get(field)]
        if missing_package_fields:
            validation_flags.append('missing_package_details')
        
        # Check for missing weight
        if not data.get('weight_lbs', '').strip() or data.get('weight_lbs', '0') == '0':
            validation_flags.append('missing_weight')
        
        # Check for missing dimensions
        dim_fields = ['length', 'width', 'height']
        missing_dims = [field for field in dim_fields if not data.get(field)]
        if missing_dims:
            validation_flags.append('missing_dimensions')
        
        # Check for missing recipient name
        if not data.get('to_first_name', '').strip():
            validation_flags.append('missing_recipient_name')
        
        # Check for missing recipient address line
        if not data.get('to_address', '').strip():
            validation_flags.append('missing_recipient_address_line')
        
        # Check for missing city
        if not data.get('to_city', '').strip():
            validation_flags.append('missing_city')
        
        # Check for missing state
        if not data.get('to_state', '').strip():
            validation_flags.append('missing_state')
        
        return validation_flags

