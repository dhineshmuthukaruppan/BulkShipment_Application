#!/usr/bin/env python
"""
Test Smarty API validation with real credentials
"""
import os
import sys
import django
import requests

# Setup Django environment
sys.path.insert(0, '/Users/ganeshmuthukaruppan/Documents/web_development/BulkShipment_Application/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from shipping_app.services.address_validator import AddressValidator

# Test credentials
SMARTY_AUTH_ID = '531e22f6-aa6a-a735-2317-1a0fc6aea1d9'
SMARTY_AUTH_TOKEN = 'R0Ambj7XhZJ6cARZj9c9'

def test_smarty_api_direct():
    """Test Smarty API directly with HTTP request"""
    print("\n" + "="*80)
    print("TEST 1: Direct Smarty API Call")
    print("="*80)
    
    url = "https://us-street.api.smartystreets.com/street-address"
    
    # Test with valid US address
    print("\n[Test 1a] Valid US Address: 1600 Pennsylvania Ave NW, Washington, DC, 20500")
    params = {
        'auth-id': SMARTY_AUTH_ID,
        'auth-token': SMARTY_AUTH_TOKEN,
        'street': '1600 Pennsylvania Ave NW',
        'city': 'Washington',
        'state': 'DC',
        'zipcode': '20500',
        'match': 'enhanced'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"✅ API Working! Found {len(data)} result(s)")
                print(f"Standardized Address: {data[0].get('delivery_line_1', 'N/A')}")
                print(f"City: {data[0].get('components', {}).get('city_name', 'N/A')}")
                print(f"ZIP+4: {data[0].get('components', {}).get('zipcode', 'N/A')}-{data[0].get('components', {}).get('plus4_code', 'N/A')}")
                print(f"DPV Match: {data[0].get('analysis', {}).get('dpv_match_code', 'N/A')}")
            else:
                print("❌ Empty response - address not found")
        elif response.status_code == 401:
            print("❌ Authentication failed - Invalid API credentials")
            print(f"Response: {response.text}")
        elif response.status_code == 402:
            print("❌ Payment required - API quota exceeded")
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # Test with non-US address (Indian address)
    print("\n[Test 1b] Non-US Address: 123 MG Road, Bengaluru, KA, 560001")
    params = {
        'auth-id': SMARTY_AUTH_ID,
        'auth-token': SMARTY_AUTH_TOKEN,
        'street': '123 MG Road',
        'city': 'Bengaluru',
        'state': 'KA',
        'zipcode': '560001',
        'match': 'enhanced'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"⚠️ Unexpected: Found {len(data)} result(s) for non-US address")
                print(f"Response: {data}")
            else:
                print("✅ Correct! Empty response for non-US address (address not found)")
        elif response.status_code == 401:
            print("❌ Authentication failed")
        else:
            print(f"❌ API Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # Test with invalid US address
    print("\n[Test 1c] Invalid US Address: 999999 Fake Street, Nowheresville, XX, 00000")
    params = {
        'auth-id': SMARTY_AUTH_ID,
        'auth-token': SMARTY_AUTH_TOKEN,
        'street': '999999 Fake Street',
        'city': 'Nowheresville',
        'state': 'XX',
        'zipcode': '00000',
        'match': 'enhanced'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"⚠️ Unexpected: Found result for invalid address")
            else:
                print("✅ Correct! Empty response for invalid address")
        else:
            print(f"Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def test_address_validator_service():
    """Test our AddressValidator service"""
    print("\n" + "="*80)
    print("TEST 2: AddressValidator Service")
    print("="*80)
    
    validator = AddressValidator()
    
    # Test 1: Valid US address
    print("\n[Test 2a] Valid US Address")
    address1 = {
        'address': '1600 Pennsylvania Ave NW',
        'city': 'Washington',
        'state': 'DC',
        'zip': '20500'
    }
    result1 = validator.validate(address1)
    print(f"Valid: {result1.get('valid')}")
    print(f"API Used: {result1.get('api_used')}")
    if result1.get('valid'):
        print(f"✅ Standardized Address: {result1.get('corrected_address', {}).get('address')}")
    else:
        print(f"❌ Error: {result1.get('error')}")
        print(f"Error Details: {result1.get('error_details')}")
    
    # Test 2: Non-US address (Indian)
    print("\n[Test 2b] Non-US Address (India)")
    address2 = {
        'address': '123 MG Road',
        'city': 'Bengaluru',
        'state': 'KA',
        'zip': '560001'
    }
    result2 = validator.validate(address2)
    print(f"Valid: {result2.get('valid')}")
    print(f"API Used: {result2.get('api_used')}")
    print(f"Error: {result2.get('error')}")
    print(f"Error Details: {result2.get('error_details')}")
    
    if 'non_us_address' in result2.get('error_details', []):
        print("✅ Correctly detected as non-US address")
    else:
        print("❌ Failed to detect as non-US address")
    
    # Test 3: Invalid US address
    print("\n[Test 2c] Invalid US Address")
    address3 = {
        'address': '999999 Fake Street',
        'city': 'Nowheresville',
        'state': 'CA',
        'zip': '00000'
    }
    result3 = validator.validate(address3)
    print(f"Valid: {result3.get('valid')}")
    print(f"API Used: {result3.get('api_used')}")
    print(f"Error: {result3.get('error')}")
    print(f"Error Details: {result3.get('error_details')}")


def test_status_calculation():
    """Test status calculation with validation flags"""
    print("\n" + "="*80)
    print("TEST 3: Status Calculation Logic")
    print("="*80)
    
    from shipping_app.models import Shipment
    
    # Create test shipment with non_us_address flag
    print("\n[Test 3a] Shipment with non_us_address flag")
    shipment = Shipment(
        to_first_name='Test',
        to_last_name='User',
        to_address='123 MG Road',
        to_city='Bengaluru',
        to_state='KA',
        to_zip='560001',
        validation_flags=['non_us_address']
    )
    
    calculated_status = shipment.calculate_status()
    print(f"Validation Flags: {shipment.validation_flags}")
    print(f"Calculated Status: {calculated_status}")
    
    if calculated_status == 'invalid':
        print("✅ Correct! Status is 'invalid' for non-US address")
    else:
        print(f"❌ Wrong! Status should be 'invalid' but got '{calculated_status}'")
    
    # Test with valid shipment
    print("\n[Test 3b] Valid shipment")
    shipment2 = Shipment(
        to_first_name='Test',
        to_last_name='User',
        to_address='123 Main St',
        to_city='New York',
        to_state='NY',
        to_zip='10001',
        validation_flags=[]
    )
    
    calculated_status2 = shipment2.calculate_status()
    print(f"Validation Flags: {shipment2.validation_flags}")
    print(f"Calculated Status: {calculated_status2}")
    
    if calculated_status2 == 'needs_review':
        print("✅ Correct! Status is 'needs_review' for valid address")
    else:
        print(f"Status: {calculated_status2}")


if __name__ == '__main__':
    print("\n" + "="*80)
    print("SMARTY API VALIDATION TEST SUITE")
    print("="*80)
    print(f"\nAuth ID: {SMARTY_AUTH_ID}")
    print(f"Auth Token: {SMARTY_AUTH_TOKEN[:20]}...")
    
    test_smarty_api_direct()
    test_address_validator_service()
    test_status_calculation()
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETE")
    print("="*80)
