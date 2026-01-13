"""
Address validation service with real API integration and fallback mechanism
Supports: USPS, Google Maps, SmartyStreets, Lob, and basic validation
Priority: USPS > Google Maps > SmartyStreets > Lob > Basic validation
"""
import requests
import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.core.cache import cache
from shipping_app.services.logger_service import ShippingLogger
import time
import logging

logger = logging.getLogger(__name__)


class AddressValidator:
    """
    Address validation with multiple API providers and fallback
    Implements rate limiting, quota management, and error handling
    """
    
    def __init__(self):
        self.logger = ShippingLogger()
        # USPS OAuth credentials (new Addresses 3.0 API)
        self.usps_client_id = getattr(settings, 'USPS_CLIENT_ID', '')
        self.usps_client_secret = getattr(settings, 'USPS_CLIENT_SECRET', '')
        self.usps_use_tem = getattr(settings, 'USPS_USE_TEM', False)  # Testing Environment for Mailers
        # Legacy USPS Web Tools (deprecated, shutting down Jan 2026)
        self.usps_api_key = getattr(settings, 'USPS_API_KEY', '')
        
        self.google_api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        self.smarty_auth_id = getattr(settings, 'SMARTY_AUTH_ID', '')
        self.smarty_auth_token = getattr(settings, 'SMARTY_AUTH_TOKEN', '')
        self.lob_api_key = getattr(settings, 'LOB_API_KEY', '')
        
        # Rate limiting configuration
        self.rate_limit_delay = 0.2  # 200ms between requests
        self.max_retries = 2
        self.timeout = 10
    
    def validate(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate address using available APIs with fallback
        
        Args:
            address_dict: Dictionary with address fields (first_name, last_name, address, city, state, zip, etc.)
        
        Returns:
            {
                'valid': bool,
                'corrected_address': Dict,
                'corrections': List[str],
                'api_used': str,
                'fallback_used': bool,
                'error': Optional[str]
            }
        """
        # Normalize address input
        normalized = self._normalize_address(address_dict)
        
        # Try USPS Addresses 3.0 API first (new OAuth-based API)
        if self.usps_client_id and self.usps_client_secret and self._check_rate_limit('usps'):
            result = self._validate_usps_v3(normalized)
            if result.get('valid'):
                self._update_rate_limit('usps')
                self.logger.log_address_validation(
                    address_dict, 'USPS Addresses 3.0', result, fallback_triggered=False
                )
                return result
        
        # Try legacy USPS Web Tools API (deprecated, shutting down Jan 2026)
        if self.usps_api_key and self._check_rate_limit('usps_legacy'):
            result = self._validate_usps(normalized)
            if result.get('valid'):
                self._update_rate_limit('usps_legacy')
                self.logger.log_address_validation(
                    address_dict, 'USPS Web Tools (Legacy)', result, fallback_triggered=False
                )
                return result
        
        # Try Google Maps (free tier: $200/month credit)
        if self.google_api_key and self._check_rate_limit('google'):
            result = self._validate_google_maps(normalized)
            if result.get('valid'):
                self._update_rate_limit('google')
                self.logger.log_address_validation(
                    address_dict, 'Google Maps', result, 
                    fallback_triggered=not bool(self.usps_api_key)
                )
                return result
        
        # Try SmartyStreets (free tier: 250 lookups/month)
        if self.smarty_auth_id and self.smarty_auth_token and self._check_rate_limit('smarty'):
            result = self._validate_smarty(normalized)
            if result.get('valid'):
                self._update_rate_limit('smarty')
                self.logger.log_address_validation(
                    address_dict, 'SmartyStreets', result, fallback_triggered=True
                )
                return result
        
        # Try Lob (free tier: 10,000 verifications/month)
        if self.lob_api_key and self._check_rate_limit('lob'):
            result = self._validate_lob(normalized)
            if result.get('valid'):
                self._update_rate_limit('lob')
                self.logger.log_address_validation(
                    address_dict, 'Lob', result, fallback_triggered=True
                )
                return result
        
        # Fallback to basic validation
        result = self._basic_validation(normalized)
        self.logger.log_address_validation(
            address_dict, 'Basic', result, fallback_triggered=True
        )
        return result
    
    def _normalize_address(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize address fields before validation"""
        normalized = {}
        for key, value in address_dict.items():
            if isinstance(value, str):
                normalized[key] = value.strip()
            else:
                normalized[key] = value
        return normalized
    
    def _check_rate_limit(self, api_name: str) -> bool:
        """Check if API can be used (rate limiting)"""
        cache_key = f'address_validator_rate_limit_{api_name}'
        last_request = cache.get(cache_key)
        if last_request:
            time_since = time.time() - last_request
            if time_since < self.rate_limit_delay:
                return False
        return True
    
    def _update_rate_limit(self, api_name: str):
        """Update rate limit timestamp"""
        cache_key = f'address_validator_rate_limit_{api_name}'
        cache.set(cache_key, time.time(), timeout=60)
    
    def _get_usps_oauth_token(self) -> Optional[str]:
        """Get OAuth access token for USPS Addresses 3.0 API"""
        try:
            # Check cache first
            cache_key = 'usps_oauth_token'
            cached_token = cache.get(cache_key)
            if cached_token:
                return cached_token
            
            # OAuth endpoint
            oauth_url = "https://apis-tem.usps.com/oauth2/v3/token" if self.usps_use_tem else "https://apis.usps.com/oauth2/v3/token"
            
            payload = {
                "grant_type": "client_credentials",
                "client_id": self.usps_client_id,
                "client_secret": self.usps_client_secret
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            response = requests.post(oauth_url, json=payload, headers=headers, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                access_token = data.get('access_token')
                expires_in = data.get('expires_in', 3600)  # Default 1 hour
                
                # Cache token (expires slightly before actual expiry)
                if access_token:
                    cache.set(cache_key, access_token, timeout=expires_in - 60)
                    return access_token
            else:
                logger.error(f"USPS OAuth token request failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.error(f"USPS OAuth token error: {str(e)}")
        
        return None
    
    def _validate_usps_v3(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using USPS Addresses 3.0 API (new OAuth-based API)"""
        try:
            # Get OAuth token
            access_token = self._get_usps_oauth_token()
            if not access_token:
                return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': 'Failed to get OAuth token'}
            
            # Build address string
            street_address = address_dict.get('address', '')
            if address_dict.get('address2'):
                street_address = f"{street_address}, {address_dict.get('address2')}"
            
            # API endpoint
            base_url = "https://apis-tem.usps.com" if self.usps_use_tem else "https://apis.usps.com"
            url = f"{base_url}/addresses/v3/address"
            
            params = {
                'streetAddress': street_address,
                'city': address_dict.get('city', ''),
                'state': address_dict.get('state', '').upper()[:2],
                'zipCode': address_dict.get('zip', '').replace('-', '').replace(' ', '')[:5]
            }
            
            # Add firm if available
            firm = address_dict.get('firm', '') or address_dict.get('company', '')
            if firm:
                params['firm'] = firm
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'address' in data:
                    corrected = address_dict.copy()
                    corrections = []
                    
                    address_info = data.get('address', {})
                    
                    # Extract standardized address
                    standardized_address = address_info.get('streetAddress', '')
                    if standardized_address and standardized_address != address_dict.get('address', ''):
                        corrections.append('Address standardized')
                        corrected['address'] = standardized_address
                    
                    # Extract city
                    city = address_info.get('city', '')
                    if city and city.upper() != address_dict.get('city', '').upper():
                        corrections.append('City corrected')
                        corrected['city'] = city
                    
                    # Extract state
                    state = address_info.get('state', '')
                    if state:
                        corrected['state'] = state.upper()
                    
                    # Extract ZIP
                    zip_code = address_info.get('zipCode', '')
                    zip_plus4 = address_info.get('zipPlus4', '')
                    if zip_code:
                        if zip_plus4:
                            corrected['zip'] = f"{zip_code}-{zip_plus4}"
                        else:
                            corrected['zip'] = zip_code
                    
                    return {
                        'valid': True,
                        'corrected_address': corrected,
                        'corrections': corrections,
                        'api_used': 'USPS Addresses 3.0',
                        'fallback_used': False
                    }
                else:
                    return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': 'Invalid response format'}
            elif response.status_code == 401:
                logger.warning("USPS OAuth token expired or invalid")
                # Clear cached token and retry once
                cache.delete('usps_oauth_token')
                return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': 'Authentication failed'}
            elif response.status_code == 404:
                return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': 'Address not found'}
            else:
                logger.warning(f"USPS API error: {response.status_code} - {response.text}")
                return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': f'API error: {response.status_code}'}
                
        except requests.exceptions.Timeout:
            logger.warning("USPS Addresses 3.0 API timeout")
            return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': 'Timeout'}
        except requests.exceptions.RequestException as e:
            logger.error(f"USPS Addresses 3.0 API request error: {str(e)}")
            return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': str(e)}
        except Exception as e:
            logger.error(f"USPS Addresses 3.0 validation error: {str(e)}")
            self.logger.log_error('usps_v3_validation_error', str(e))
        
        return {'valid': False, 'api_used': 'USPS Addresses 3.0', 'error': 'Unknown error'}
    
    def _validate_usps(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using USPS Address Validation API (free tier available)"""
        try:
            url = "https://secure.shippingapis.com/ShippingAPI.dll"
            
            # Build XML request
            address1 = address_dict.get('address', '').replace('&', '&amp;')
            address2 = address_dict.get('address2', '').replace('&', '&amp;')
            city = address_dict.get('city', '').replace('&', '&amp;')
            state = address_dict.get('state', '').upper()[:2]
            zip5 = address_dict.get('zip', '').replace('-', '').replace(' ', '')[:5]
            
            xml_request = f"""<?xml version="1.0"?>
<AddressValidateRequest USERID="{self.usps_api_key}">
    <Address>
        <Address1>{address1}</Address1>
        <Address2>{address2}</Address2>
        <City>{city}</City>
        <State>{state}</State>
        <Zip5>{zip5}</Zip5>
    </Address>
</AddressValidateRequest>"""
            
            params = {
                'API': 'Verify',
                'XML': xml_request
            }
            
            response = requests.get(url, params=params, timeout=self.timeout)
            
            if response.status_code == 200:
                # Parse XML response
                try:
                    root = ET.fromstring(response.text)
                    address_elem = root.find('Address')
                    
                    if address_elem is not None:
                        error = address_elem.find('Error')
                        if error is not None:
                            error_desc = error.find('Description')
                            if error_desc is not None and error_desc.text:
                                logger.warning(f"USPS validation error: {error_desc.text}")
                                return {'valid': False, 'api_used': 'USPS', 'error': error_desc.text}
                        
                        # Extract corrected address
                        corrected = address_dict.copy()
                        corrections = []
                        
                        addr1 = address_elem.find('Address1')
                        addr2 = address_elem.find('Address2')
                        city_elem = address_elem.find('City')
                        state_elem = address_elem.find('State')
                        zip5_elem = address_elem.find('Zip5')
                        zip4_elem = address_elem.find('Zip4')
                        
                        if addr1 is not None and addr1.text:
                            if addr1.text != address_dict.get('address', ''):
                                corrections.append('Address standardized')
                            corrected['address'] = addr1.text
                        
                        if addr2 is not None and addr2.text:
                            corrected['address2'] = addr2.text
                        
                        if city_elem is not None and city_elem.text:
                            if city_elem.text.upper() != address_dict.get('city', '').upper():
                                corrections.append('City corrected')
                            corrected['city'] = city_elem.text
                        
                        if state_elem is not None and state_elem.text:
                            corrected['state'] = state_elem.text.upper()
                        
                        if zip5_elem is not None and zip5_elem.text:
                            zip_code = zip5_elem.text
                            if zip4_elem is not None and zip4_elem.text:
                                zip_code = f"{zip_code}-{zip4_elem.text}"
                            corrected['zip'] = zip_code
                        
                        return {
                            'valid': True,
                            'corrected_address': corrected,
                            'corrections': corrections,
                            'api_used': 'USPS',
                            'fallback_used': False
                        }
                except ET.ParseError as e:
                    logger.error(f"USPS XML parse error: {str(e)}")
                    return {'valid': False, 'api_used': 'USPS', 'error': 'XML parse error'}
            
        except requests.exceptions.Timeout:
            logger.warning("USPS API timeout")
            return {'valid': False, 'api_used': 'USPS', 'error': 'Timeout'}
        except requests.exceptions.RequestException as e:
            logger.error(f"USPS API request error: {str(e)}")
            return {'valid': False, 'api_used': 'USPS', 'error': str(e)}
        except Exception as e:
            logger.error(f"USPS validation error: {str(e)}")
            self.logger.log_error('usps_validation_error', str(e))
        
        return {'valid': False, 'api_used': 'USPS', 'error': 'Unknown error'}
    
    def _validate_google_maps(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using Google Maps Geocoding API"""
        try:
            # Build address string
            address_parts = [
                address_dict.get('address', ''),
                address_dict.get('city', ''),
                address_dict.get('state', ''),
                address_dict.get('zip', '')
            ]
            address_string = ', '.join(filter(None, address_parts))
            
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': address_string,
                'key': self.google_api_key
            }
            
            response = requests.get(url, params=params, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for API errors
                if data.get('status') == 'OVER_QUERY_LIMIT':
                    logger.warning("Google Maps API quota exceeded")
                    return {'valid': False, 'api_used': 'Google Maps', 'error': 'Quota exceeded'}
                
                if data.get('status') == 'OK' and data.get('results'):
                    result = data['results'][0]
                    components = {}
                    for comp in result.get('address_components', []):
                        for comp_type in comp.get('types', []):
                            components[comp_type] = comp.get('long_name')
                            if 'short_name' in comp:
                                components[f"{comp_type}_short"] = comp.get('short_name')
                    
                    corrected = address_dict.copy()
                    corrections = []
                    
                    # Extract street address
                    street_number = components.get('street_number', '')
                    route = components.get('route', '')
                    if street_number or route:
                        new_address = f"{street_number} {route}".strip()
                        if new_address and new_address != address_dict.get('address', ''):
                            corrections.append('Address standardized')
                        corrected['address'] = new_address or address_dict.get('address', '')
                    
                    # Extract city
                    city = components.get('locality') or components.get('sublocality') or components.get('administrative_area_level_3')
                    if city and city.upper() != address_dict.get('city', '').upper():
                        corrections.append('City corrected')
                        corrected['city'] = city
                    
                    # Extract state
                    state = components.get('administrative_area_level_1_short') or components.get('administrative_area_level_1')
                    if state:
                        corrected['state'] = state.upper()[:2]
                    
                    # Extract ZIP
                    zip_code = components.get('postal_code', '')
                    if zip_code:
                        corrected['zip'] = zip_code
                    
                    return {
                        'valid': True,
                        'corrected_address': corrected,
                        'corrections': corrections,
                        'api_used': 'Google Maps',
                        'fallback_used': False
                    }
                else:
                    return {'valid': False, 'api_used': 'Google Maps', 'error': data.get('status', 'Unknown error')}
                    
        except requests.exceptions.Timeout:
            logger.warning("Google Maps API timeout")
            return {'valid': False, 'api_used': 'Google Maps', 'error': 'Timeout'}
        except requests.exceptions.RequestException as e:
            logger.error(f"Google Maps API request error: {str(e)}")
            return {'valid': False, 'api_used': 'Google Maps', 'error': str(e)}
        except Exception as e:
            logger.error(f"Google Maps validation error: {str(e)}")
            self.logger.log_error('google_validation_error', str(e))
        
        return {'valid': False, 'api_used': 'Google Maps', 'error': 'Unknown error'}
    
    def _validate_smarty(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using SmartyStreets API (free tier: 250/month)"""
        try:
            url = "https://us-street.api.smartystreets.com/street-address"
            params = {
                'auth-id': self.smarty_auth_id,
                'auth-token': self.smarty_auth_token,
                'street': address_dict.get('address', ''),
                'city': address_dict.get('city', ''),
                'state': address_dict.get('state', ''),
                'zipcode': address_dict.get('zip', '').replace('-', '').replace(' ', '')[:5]
            }
            
            response = requests.get(url, params=params, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    result = data[0]
                    components = result.get('components', {})
                    metadata = result.get('metadata', {})
                    
                    corrected = address_dict.copy()
                    corrections = []
                    
                    # Extract delivery line
                    delivery_line_1 = result.get('delivery_line_1', '')
                    if delivery_line_1 and delivery_line_1 != address_dict.get('address', ''):
                        corrections.append('Address standardized')
                        corrected['address'] = delivery_line_1
                    
                    # Extract secondary (address2)
                    secondary = result.get('secondary', '')
                    if secondary:
                        corrected['address2'] = secondary
                    
                    # Extract city
                    city = components.get('city_name', '')
                    if city and city.upper() != address_dict.get('city', '').upper():
                        corrections.append('City corrected')
                        corrected['city'] = city
                    
                    # Extract state
                    state = components.get('state_abbreviation', '')
                    if state:
                        corrected['state'] = state.upper()
                    
                    # Extract ZIP
                    zipcode = components.get('zipcode', '')
                    zipcode_plus4 = components.get('plus4_code', '')
                    if zipcode:
                        if zipcode_plus4:
                            corrected['zip'] = f"{zipcode}-{zipcode_plus4}"
                        else:
                            corrected['zip'] = zipcode
                    
                    return {
                        'valid': True,
                        'corrected_address': corrected,
                        'corrections': corrections,
                        'api_used': 'SmartyStreets',
                        'fallback_used': False
                    }
            elif response.status_code == 401:
                logger.warning("SmartyStreets API authentication failed")
                return {'valid': False, 'api_used': 'SmartyStreets', 'error': 'Authentication failed'}
            elif response.status_code == 402:
                logger.warning("SmartyStreets API quota exceeded")
                return {'valid': False, 'api_used': 'SmartyStreets', 'error': 'Quota exceeded'}
                
        except requests.exceptions.Timeout:
            logger.warning("SmartyStreets API timeout")
            return {'valid': False, 'api_used': 'SmartyStreets', 'error': 'Timeout'}
        except requests.exceptions.RequestException as e:
            logger.error(f"SmartyStreets API request error: {str(e)}")
            return {'valid': False, 'api_used': 'SmartyStreets', 'error': str(e)}
        except Exception as e:
            logger.error(f"SmartyStreets validation error: {str(e)}")
            self.logger.log_error('smarty_validation_error', str(e))
        
        return {'valid': False, 'api_used': 'SmartyStreets', 'error': 'Unknown error'}
    
    def _validate_lob(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using Lob Address Verification API (free tier: 10,000/month)"""
        try:
            url = "https://api.lob.com/v1/us_verifications"
            
            payload = {
                'primary_line': address_dict.get('address', ''),
                'secondary_line': address_dict.get('address2', ''),
                'city': address_dict.get('city', ''),
                'state': address_dict.get('state', ''),
                'zip_code': address_dict.get('zip', '').replace('-', '').replace(' ', '')[:5]
            }
            
            headers = {
                'Authorization': f'Basic {self.lob_api_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('deliverability') in ['deliverable', 'deliverable_unnecessary_unit', 'deliverable_missing_unit']:
                    corrected = address_dict.copy()
                    corrections = []
                    
                    # Extract primary line
                    primary_line = data.get('primary_line', '')
                    if primary_line and primary_line != address_dict.get('address', ''):
                        corrections.append('Address standardized')
                        corrected['address'] = primary_line
                    
                    # Extract secondary line
                    secondary_line = data.get('secondary_line', '')
                    if secondary_line:
                        corrected['address2'] = secondary_line
                    
                    # Extract city
                    city = data.get('components', {}).get('city', '')
                    if city and city.upper() != address_dict.get('city', '').upper():
                        corrections.append('City corrected')
                        corrected['city'] = city
                    
                    # Extract state
                    state = data.get('components', {}).get('state', '')
                    if state:
                        corrected['state'] = state.upper()
                    
                    # Extract ZIP
                    zip_code = data.get('components', {}).get('zip_code', '')
                    zip_code_plus_4 = data.get('components', {}).get('zip_code_plus_4', '')
                    if zip_code:
                        if zip_code_plus_4:
                            corrected['zip'] = f"{zip_code}-{zip_code_plus_4}"
                        else:
                            corrected['zip'] = zip_code
                    
                    return {
                        'valid': True,
                        'corrected_address': corrected,
                        'corrections': corrections,
                        'api_used': 'Lob',
                        'fallback_used': False
                    }
                else:
                    return {'valid': False, 'api_used': 'Lob', 'error': f"Not deliverable: {data.get('deliverability', 'unknown')}"}
            elif response.status_code == 401:
                logger.warning("Lob API authentication failed")
                return {'valid': False, 'api_used': 'Lob', 'error': 'Authentication failed'}
            elif response.status_code == 429:
                logger.warning("Lob API rate limit exceeded")
                return {'valid': False, 'api_used': 'Lob', 'error': 'Rate limit exceeded'}
                
        except requests.exceptions.Timeout:
            logger.warning("Lob API timeout")
            return {'valid': False, 'api_used': 'Lob', 'error': 'Timeout'}
        except requests.exceptions.RequestException as e:
            logger.error(f"Lob API request error: {str(e)}")
            return {'valid': False, 'api_used': 'Lob', 'error': str(e)}
        except Exception as e:
            logger.error(f"Lob validation error: {str(e)}")
            self.logger.log_error('lob_validation_error', str(e))
        
        return {'valid': False, 'api_used': 'Lob', 'error': 'Unknown error'}
    
    def _basic_validation(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Basic validation using regex patterns (fallback)"""
        corrections = []
        corrected = address_dict.copy()
        
        # Validate ZIP code format (5 digits or 5+4)
        zip_code = address_dict.get('zip', '').strip()
        if zip_code:
            if not re.match(r'^\d{5}(-\d{4})?$', zip_code):
                # Try to fix common issues
                zip_digits = re.sub(r'\D', '', zip_code)
                if len(zip_digits) >= 5:
                    corrected['zip'] = zip_digits[:5]
                    if len(zip_digits) > 5:
                        corrected['zip'] = f"{zip_digits[:5]}-{zip_digits[5:9]}"
                    corrections.append('ZIP code formatted')
        
        # Validate state (2-letter abbreviation)
        state = address_dict.get('state', '').strip().upper()
        if state and len(state) == 2:
            corrected['state'] = state
        elif state:
            # Try to extract 2-letter code
            state_match = re.match(r'^([A-Z]{2})', state)
            if state_match:
                corrected['state'] = state_match.group(1)
                corrections.append('State code standardized')
        
        # Check required fields
        required = ['address', 'city', 'state', 'zip']
        is_valid = all(corrected.get(field) for field in required)
        
        return {
            'valid': is_valid,
            'corrected_address': corrected,
            'corrections': corrections,
            'api_used': 'Basic',
            'fallback_used': True
        }
