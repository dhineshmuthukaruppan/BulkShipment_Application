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
        self.rate_limit_delay = 0.05  # 50ms between requests (allows 20 req/sec)
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
            # If invalid, return immediately with error_details (don't fallback if we got a definitive answer)
            if result.get('error_details'):
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
            # If invalid, return immediately with error_details (don't fallback if we got a definitive answer)
            if result.get('error_details'):
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
            # If invalid, return immediately with error_details (don't fallback if we got a definitive answer)
            if result.get('error_details'):
                self._update_rate_limit('google')
                self.logger.log_address_validation(
                    address_dict, 'Google Maps', result, 
                    fallback_triggered=not bool(self.usps_api_key)
                )
                return result
        
        # Try SmartyStreets (free tier: 250 lookups/month)
        # Prioritize SmartyStreets if configured (it's more reliable than basic validation)
        if self.smarty_auth_id and self.smarty_auth_token and self._check_rate_limit('smarty'):
            result = self._validate_smarty(normalized)
            self._update_rate_limit('smarty')
            # Return result whether valid or invalid - SmartyStreets gives definitive answer
            self.logger.log_address_validation(
                address_dict, 'SmartyStreets', result, fallback_triggered=not bool(self.usps_api_key or self.google_api_key)
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
            # If invalid, return immediately with error_details (don't fallback if we got a definitive answer)
            if result.get('error_details'):
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
    
    def _analyze_address_fields(self, address_dict: Dict[str, Any]) -> List[str]:
        error_details = []

        # Required: street
        if not address_dict.get('address') or not address_dict.get('address', '').strip():
            error_details.append('invalid_street')

        # Required: city
        if not address_dict.get('city') or not address_dict.get('city', '').strip():
            error_details.append('invalid_city')

        # Required: ZIP (minimum 5 digits)
        zip_code = address_dict.get('zip', '').strip()

        if not zip_code:
            error_details.append('invalid_pincode')
        else:
            # Extract digits only
            zip_digits = re.sub(r'\D', '', zip_code)

            # ZIP must have at least 5 digits
            if len(zip_digits) < 5:
                error_details.append('invalid_pincode')

        return error_details

    def _validate_usps_v3(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate using USPS Addresses 3.0 API (new OAuth-based API)"""
        try:
            # Get OAuth token
            access_token = self._get_usps_oauth_token()
            if not access_token:
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'USPS Addresses 3.0', 
                    'error': 'Failed to get OAuth token',
                    'error_details': error_details if error_details else ['invalid_address']
                }
            
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
                    # No address in response - analyze which fields might be invalid
                    error_details = self._analyze_address_fields(address_dict)
                    return {
                        'valid': False, 
                        'api_used': 'USPS Addresses 3.0', 
                        'error': 'Invalid response format - address not found',
                        'error_details': error_details if error_details else ['invalid_address']
                    }
            elif response.status_code == 401:
                logger.warning("USPS OAuth token expired or invalid")
                # Clear cached token and retry once
                cache.delete('usps_oauth_token')
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'USPS Addresses 3.0', 
                    'error': 'Authentication failed',
                    'error_details': error_details if error_details else ['invalid_address']
                }
            elif response.status_code == 404:
                # Address not found - analyze which fields might be invalid
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'USPS Addresses 3.0', 
                    'error': 'Address not found',
                    'error_details': error_details if error_details else ['invalid_address']
                }
            else:
                logger.warning(f"USPS API error: {response.status_code} - {response.text}")
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'USPS Addresses 3.0', 
                    'error': f'API error: {response.status_code}',
                    'error_details': error_details if error_details else ['invalid_address']
                }
                
        except requests.exceptions.Timeout:
            logger.warning("USPS Addresses 3.0 API timeout")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'USPS Addresses 3.0', 
                'error': 'Timeout',
                'error_details': error_details if error_details else ['invalid_address']
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"USPS Addresses 3.0 API request error: {str(e)}")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'USPS Addresses 3.0', 
                'error': str(e),
                'error_details': error_details if error_details else ['invalid_address']
            }
        except Exception as e:
            logger.error(f"USPS Addresses 3.0 validation error: {str(e)}")
            self.logger.log_error('usps_v3_validation_error', str(e))
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'USPS Addresses 3.0', 
                'error': 'Unknown error',
                'error_details': error_details if error_details else ['invalid_address']
            }
    
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
                                error_details = self._analyze_address_fields(address_dict)
                                return {
                                    'valid': False, 
                                    'api_used': 'USPS', 
                                    'error': error_desc.text,
                                    'error_details': error_details if error_details else ['invalid_address']
                                }
                        
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
                    error_details = self._analyze_address_fields(address_dict)
                    return {
                        'valid': False, 
                        'api_used': 'USPS', 
                        'error': 'XML parse error',
                        'error_details': error_details if error_details else ['invalid_address']
                    }
            
        except requests.exceptions.Timeout:
            logger.warning("USPS API timeout")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'USPS', 
                'error': 'Timeout',
                'error_details': error_details if error_details else ['invalid_address']
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"USPS API request error: {str(e)}")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'USPS', 
                'error': str(e),
                'error_details': error_details if error_details else ['invalid_address']
            }
        except Exception as e:
            logger.error(f"USPS validation error: {str(e)}")
            self.logger.log_error('usps_validation_error', str(e))
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'USPS', 
                'error': 'Unknown error',
                'error_details': error_details if error_details else ['invalid_address']
            }
    
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
                    error_details = self._analyze_address_fields(address_dict)
                    return {
                        'valid': False, 
                        'api_used': 'Google Maps', 
                        'error': 'Quota exceeded',
                        'error_details': error_details if error_details else ['invalid_address']
                    }
                
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
                    # Address not found or invalid
                    error_details = self._analyze_address_fields(address_dict)
                    return {
                        'valid': False, 
                        'api_used': 'Google Maps', 
                        'error': data.get('status', 'Unknown error'),
                        'error_details': error_details if error_details else ['invalid_address']
                    }
                    
        except requests.exceptions.Timeout:
            logger.warning("Google Maps API timeout")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'Google Maps', 
                'error': 'Timeout',
                'error_details': error_details if error_details else ['invalid_address']
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Google Maps API request error: {str(e)}")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'Google Maps', 
                'error': str(e),
                'error_details': error_details if error_details else ['invalid_address']
            }
        except Exception as e:
            logger.error(f"Google Maps validation error: {str(e)}")
            self.logger.log_error('google_validation_error', str(e))
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'Google Maps', 
                'error': 'Unknown error',
                'error_details': error_details if error_details else ['invalid_address']
            }
    
    def _validate_smarty(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate using SmartyStreets API (free tier: 250/month)
        
        Uses US Street Address API with enhanced match detection.
        Returns detailed error information for invalid addresses including:
        - Non-US addresses (empty response)
        - Invalid components (street, city, pincode)
        - Missing secondary information
        - Undeliverable addresses
        """
        try:
            url = "https://us-street.api.smartystreets.com/street-address"
            params = {
                'auth-id': self.smarty_auth_id,
                'auth-token': self.smarty_auth_token,
                'street': address_dict.get('address', ''),
                'city': address_dict.get('city', ''),
                'state': address_dict.get('state', ''),
                'zipcode': address_dict.get('zip', '').replace('-', '').replace(' ', '')[:5],
                'match': 'enhanced'  # Get enhanced match information
            }
            
            response = requests.get(url, params=params, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                
                # Empty array [] means address was not found
                # This typically indicates:
                # 1. Non-US address (most common for international addresses)
                # 2. Invalid US address that doesn't exist
                # 3. Address with incorrect components
                if not data or len(data) == 0:
                    # Analyze which fields might be invalid
                    error_details = self._analyze_address_fields(address_dict)
                    
                    # Check if this might be a non-US address
                    # Non-US addresses often have different format, no state abbreviation, or non-US ZIP
                    is_likely_non_us = self._is_likely_non_us_address(address_dict)
                    
                    if is_likely_non_us:
                        return {
                            'valid': False,
                            'api_used': 'SmartyStreets',
                            'error': 'Non-US address detected. Only US addresses are supported.',
                            'error_details': ['non_us_address'] + error_details,
                            'corrected_address': address_dict,
                            'corrections': []
                        }
                    else:
                        return {
                            'valid': False,
                            'api_used': 'SmartyStreets',
                            'error': 'Address not found in USPS database',
                            'error_details': error_details if error_details else ['invalid_address'],
                            'corrected_address': address_dict,
                            'corrections': []
                        }
                
                # Process the first result
                result = data[0]
                components = result.get('components', {})
                metadata = result.get('metadata', {})
                analysis = result.get('analysis', {})
                
                # Check DPV (Delivery Point Validation) status
                dpv_match_code = analysis.get('dpv_match_code', '')
                dpv_footnotes = analysis.get('dpv_footnotes', '')
                enhanced_match = analysis.get('enhanced_match', '')
                precision = metadata.get('precision', '')
                
                # CRITICAL: Check for invalid/non-US addresses
                # Smarty returns results with precision='Unknown' and enhanced_match='none' for:
                # 1. Non-US addresses (e.g., Indian addresses)
                # 2. Invalid addresses that don't exist
                # These should be treated as INVALID
                if precision == 'Unknown' or enhanced_match == 'none':
                    # Check if this is likely a non-US address
                    is_likely_non_us = self._is_likely_non_us_address(address_dict)
                    error_details = self._analyze_address_fields(address_dict)
                    
                    if is_likely_non_us:
                        return {
                            'valid': False,
                            'api_used': 'SmartyStreets',
                            'error': 'Non-US address detected. Only US addresses are supported.',
                            'error_details': ['non_us_address'] + error_details,
                            'corrected_address': address_dict,
                            'corrections': []
                        }
                    else:
                        return {
                            'valid': False,
                            'api_used': 'SmartyStreets',
                            'error': 'Address not found or invalid',
                            'error_details': error_details if error_details else ['invalid_address'],
                            'corrected_address': address_dict,
                            'corrections': []
                        }
                
                # Analyze deliverability and match quality
                # dpv_match_code values:
                # Y = Confirmed (entire address is deliverable)
                # N = Not Confirmed (address is not deliverable)
                # S = Confirmed by dropping secondary (apt/suite dropped)
                # D = Confirmed but missing secondary (apt/suite needed)
                
                # Check for non-deliverable or problematic addresses
                if dpv_match_code == 'N':
                    # Address is not DPV confirmed (not deliverable)
                    error_details = self._analyze_smarty_dpv_footnotes(dpv_footnotes, address_dict)
                    
                    return {
                        'valid': False,
                        'api_used': 'SmartyStreets',
                        'error': 'Address is not deliverable by USPS',
                        'error_details': error_details if error_details else ['invalid_address'],
                        'corrected_address': address_dict,
                        'corrections': []
                    }
                
                # Check enhanced_match for specific issues
                if enhanced_match == 'unknown-secondary':
                    # Secondary information (apt/suite) is not recognized
                    error_details = ['invalid_secondary']
                    return {
                        'valid': False,
                        'api_used': 'SmartyStreets',
                        'error': 'Apartment/Suite number is not recognized',
                        'error_details': error_details,
                        'corrected_address': address_dict,
                        'corrections': []
                    }
                
                # Address is valid - extract corrected/standardized data
                corrected = address_dict.copy()
                corrections = []
                
                # Extract delivery line
                delivery_line_1 = result.get('delivery_line_1', '')
                if delivery_line_1:
                    if delivery_line_1.upper() != address_dict.get('address', '').upper():
                        corrections.append('Address standardized')
                    corrected['address'] = delivery_line_1
                
                # Extract secondary (address2) if present
                delivery_line_2 = result.get('delivery_line_2', '')
                if delivery_line_2:
                    corrected['address2'] = delivery_line_2
                
                # Extract city
                city = components.get('city_name', '')
                if city:
                    if city.upper() != address_dict.get('city', '').upper():
                        corrections.append('City corrected')
                    corrected['city'] = city
                
                # Extract state
                state = components.get('state_abbreviation', '')
                if state:
                    if state.upper() != address_dict.get('state', '').upper():
                        corrections.append('State corrected')
                    corrected['state'] = state.upper()
                
                # Extract ZIP+4
                zipcode = components.get('zipcode', '')
                zipcode_plus4 = components.get('plus4_code', '')
                if zipcode:
                    if zipcode_plus4:
                        new_zip = f"{zipcode}-{zipcode_plus4}"
                    else:
                        new_zip = zipcode
                    
                    if new_zip != address_dict.get('zip', ''):
                        corrections.append('ZIP code standardized')
                    corrected['zip'] = new_zip
                
                # Add warning if secondary is missing but required
                warnings = []
                if dpv_match_code == 'D' or enhanced_match == 'missing-secondary':
                    warnings.append('Secondary address (apt/suite) may be required for delivery')
                
                return {
                    'valid': True,
                    'corrected_address': corrected,
                    'corrections': corrections,
                    'warnings': warnings,
                    'api_used': 'SmartyStreets',
                    'fallback_used': False,
                    'metadata': {
                        'dpv_match_code': dpv_match_code,
                        'enhanced_match': enhanced_match,
                        'precision': metadata.get('precision', ''),
                        'rdi': metadata.get('rdi', '')
                    }
                }
                    
            elif response.status_code == 401:
                logger.warning("SmartyStreets API authentication failed")
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'SmartyStreets', 
                    'error': 'Authentication failed - check API credentials',
                    'error_details': error_details if error_details else ['api_auth_error']
                }
            elif response.status_code == 402:
                logger.warning("SmartyStreets API quota exceeded")
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'SmartyStreets', 
                    'error': 'API quota exceeded',
                    'error_details': error_details if error_details else ['api_quota_exceeded']
                }
                
        except requests.exceptions.Timeout:
            logger.warning("SmartyStreets API timeout")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'SmartyStreets', 
                'error': 'Request timeout',
                'error_details': error_details if error_details else ['api_timeout']
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"SmartyStreets API request error: {str(e)}")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'SmartyStreets', 
                'error': f'Network error: {str(e)}',
                'error_details': error_details if error_details else ['api_network_error']
            }
        except Exception as e:
            logger.error(f"SmartyStreets validation error: {str(e)}")
            self.logger.log_error('smarty_validation_error', str(e))
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'SmartyStreets', 
                'error': f'Validation error: {str(e)}',
                'error_details': error_details if error_details else ['validation_error']
            }
    
    def _is_likely_non_us_address(self, address_dict: Dict[str, Any]) -> bool:
        """
        Detect if an address is likely a non-US address based on patterns.
        
        Indicators of non-US addresses:
        - State is not a valid US state code
        - ZIP code doesn't match US format (5 or 9 digits)
        - Common international keywords in address
        """
        # Check state - US states are 2-letter codes
        state = address_dict.get('state', '').strip().upper()
        us_states = {
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
            'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
        }
        
        # If state is provided and not a US state, likely non-US
        if state and state not in us_states and len(state) == 2:
            return True
        
        # If state is longer than 2 characters, likely non-US (full province name)
        if state and len(state) > 2:
            return True
        
        # Check ZIP code format - US ZIP is 5 or 9 digits (with optional hyphen)
        zip_code = address_dict.get('zip', '').strip()
        if zip_code:
            # Remove hyphens and spaces
            zip_digits = re.sub(r'[^0-9]', '', zip_code)
            # US ZIP is exactly 5 or 9 digits
            if len(zip_digits) not in [5, 9]:
                return True
            # Check if ZIP contains letters (non-US postal codes often have letters)
            if re.search(r'[A-Za-z]', zip_code):
                return True
        
        # Check for common international keywords in address or city
        international_keywords = [
            'province', 'postal code', 'postcode', 'canada', 'mexico',
            'india', 'uk', 'england', 'australia', 'germany', 'france'
        ]
        
        address_text = ' '.join([
            address_dict.get('address', ''),
            address_dict.get('city', ''),
            address_dict.get('state', '')
        ]).lower()
        
        for keyword in international_keywords:
            if keyword in address_text:
                return True
        
        return False
    
    def _analyze_smarty_dpv_footnotes(self, dpv_footnotes: str, address_dict: Dict[str, Any]) -> List[str]:
        """
        Analyze Smarty DPV footnotes to determine specific validation errors.
        
        Common DPV footnotes:
        - AA: Address matched to ZIP+4 file
        - A1: Address not matched to ZIP+4 file
        - BB: Entire address matched to ZIP+4 file
        - CC: Primary number matched, secondary not matched
        - N1: Secondary number missing
        - M1: Primary number missing
        - M3: Primary number invalid
        - P1: PO Box/RR/HC Box number missing
        - P3: PO Box/RR/HC Box number invalid
        - F1: Military or diplomatic address
        - G1: General delivery address
        - U1: Unique ZIP code
        - RR: Confirmed address with private mailbox (PMB)
        """
        error_details = []
        
        if not dpv_footnotes:
            # No specific footnotes, analyze address fields generically
            return self._analyze_address_fields(address_dict)
        
        # Check for specific error patterns
        if 'M1' in dpv_footnotes or 'M3' in dpv_footnotes:
            # Primary number (street number) missing or invalid
            error_details.append('invalid_street')
        
        if 'N1' in dpv_footnotes:
            # Secondary number (apt/suite) missing
            error_details.append('missing_secondary')
        
        if 'CC' in dpv_footnotes:
            # Secondary number doesn't match
            error_details.append('invalid_secondary')
        
        if 'P1' in dpv_footnotes or 'P3' in dpv_footnotes:
            # PO Box number issue
            error_details.append('invalid_po_box')
        
        if 'A1' in dpv_footnotes:
            # Address not in ZIP+4 file
            error_details.append('invalid_address')
        
        # If no specific error detected, do generic analysis
        if not error_details:
            error_details = self._analyze_address_fields(address_dict)
        
        return error_details
    
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
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'Lob', 
                    'error': 'Authentication failed',
                    'error_details': error_details if error_details else ['invalid_address']
                }
            elif response.status_code == 429:
                logger.warning("Lob API rate limit exceeded")
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'Lob', 
                    'error': 'Rate limit exceeded',
                    'error_details': error_details if error_details else ['invalid_address']
                }
            else:
                # Other error status codes
                error_details = self._analyze_address_fields(address_dict)
                return {
                    'valid': False, 
                    'api_used': 'Lob', 
                    'error': f'API error: {response.status_code}',
                    'error_details': error_details if error_details else ['invalid_address']
                }
                
        except requests.exceptions.Timeout:
            logger.warning("Lob API timeout")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'Lob', 
                'error': 'Timeout',
                'error_details': error_details if error_details else ['invalid_address']
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Lob API request error: {str(e)}")
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'Lob', 
                'error': str(e),
                'error_details': error_details if error_details else ['invalid_address']
            }
        except Exception as e:
            logger.error(f"Lob validation error: {str(e)}")
            self.logger.log_error('lob_validation_error', str(e))
            error_details = self._analyze_address_fields(address_dict)
            return {
                'valid': False, 
                'api_used': 'Lob', 
                'error': 'Unknown error',
                'error_details': error_details if error_details else ['invalid_address']
            }
    
    def _basic_validation(self, address_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Basic validation using regex patterns (fallback)"""
        corrections = []
        corrected = address_dict.copy()
        error_details = []
        
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
                else:
                    error_details.append('invalid_pincode')
        else:
            error_details.append('invalid_pincode')
        
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
        
        if not is_valid:
            if not corrected.get('address'):
                error_details.append('invalid_street')
            if not corrected.get('city'):
                error_details.append('invalid_city')
            if not corrected.get('zip'):
                error_details.append('invalid_pincode')
            if not error_details:
                error_details.append('invalid_address')
        
        return {
            'valid': is_valid,
            'corrected_address': corrected,
            'corrections': corrections,
            'api_used': 'Basic',
            'fallback_used': True,
            'error_details': error_details if not is_valid else []
        }
