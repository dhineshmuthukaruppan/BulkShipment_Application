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
            
            rows = []
            errors = []
            warnings = []
            
            # Parse data rows
            for row_num, row in enumerate(reader, start=3):
                if not row or all(not cell.strip() for cell in row):
                    continue  # Skip empty rows
                
                try:
                    parsed_row = self._parse_row(row, row_num)
                    if parsed_row:
                        rows.append(parsed_row)
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    self.logger.log_error('csv_parse_error', str(e), {'row_num': row_num})
            
            self.logger.log_csv_upload(
                file_name='uploaded_file.csv',
                row_count=len(rows),
                issues=errors + warnings,
                auto_fixes_applied=True
            )
            
            return {
                'rows': rows,
                'errors': errors,
                'warnings': warnings
            }
            
        except Exception as e:
            error_msg = f"Failed to parse CSV: {str(e)}"
            self.logger.log_error('csv_parse_fatal', error_msg)
            return {'rows': [], 'errors': [error_msg], 'warnings': []}
    
    def _parse_row(self, row: List[str], row_num: int) -> Dict[str, Any]:
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
        data = self._apply_defaults(data, row_num)
        data = self._validate_row(data, row_num)
        
        return data
    
    def _apply_defaults(self, data: Dict[str, Any], row_num: int) -> Dict[str, Any]:
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
        
        # Extract order number from Address2 if order_number column is empty
        # PRD Section 7.2: "Order numbers in sequence (Apt 10885, Apt 108, Apt 109, etc.)"
        if not data.get('order_number') and data.get('to_address2'):
            address2 = data.get('to_address2', '')
            # Pattern: "Apt 10885" or "Apt 108" -> extract as order number
            # Try to extract "Apt" followed by numbers
            apt_match = re.search(r'Apt\s+(\d+)', address2, re.IGNORECASE)
            if apt_match:
                order_num = apt_match.group(1)
                data['order_number'] = f"Apt {order_num}"
                validation_flags.append('order_number_extracted_from_address2')
            # Also try other patterns like "Unit", "Suite", etc.
            else:
                unit_match = re.search(r'(?:Unit|Suite|#)\s*(\d+)', address2, re.IGNORECASE)
                if unit_match:
                    data['order_number'] = unit_match.group(0)
                    validation_flags.append('order_number_extracted_from_address2')
        
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

