#!/usr/bin/env python
"""
Test Smarty API connection with the provided credentials
"""
import os
import sys
import django
import requests

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings

def test_smarty_direct():
    """Test Smarty API directly with credentials"""
    print("=" * 60)
    print("Testing Smarty API Connection")
    print("=" * 60)
    
    # Get credentials from settings
    auth_id = getattr(settings, 'SMARTY_AUTH_ID', '')
    auth_token = getattr(settings, 'SMARTY_AUTH_TOKEN', '')
    
    print(f"\n📋 Credentials Check:")
    print(f"   Auth ID: {auth_id[:20]}..." if auth_id else "   Auth ID: NOT FOUND")
    print(f"   Auth Token: {auth_token[:10]}..." if auth_token else "   Auth Token: NOT FOUND")
    
    if not auth_id or not auth_token:
        print("\n❌ ERROR: Credentials not found in settings!")
        print("   Make sure .env file exists and has SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN")
        return False
    
    # Test address
    test_address = {
        'street': '1600 Pennsylvania Avenue NW',
        'city': 'Washington',
        'state': 'DC',
        'zipcode': '20500'
    }
    
    print(f"\n📍 Testing Address:")
    print(f"   {test_address['street']}")
    print(f"   {test_address['city']}, {test_address['state']} {test_address['zipcode']}")
    print("\n" + "-" * 60)
    
    try:
        url = "https://us-street.api.smartystreets.com/street-address"
        params = {
            'auth-id': auth_id,
            'auth-token': auth_token,
            'street': test_address['street'],
            'city': test_address['city'],
            'state': test_address['state'],
            'zipcode': test_address['zipcode']
        }
        
        print("🔌 Connecting to Smarty API...")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                result = data[0]
                print("\n✅ SUCCESS! Smarty API is working!")
                print("\n📮 Validated Address:")
                print(f"   {result.get('delivery_line_1', 'N/A')}")
                if result.get('delivery_line_2'):
                    print(f"   {result.get('delivery_line_2')}")
                components = result.get('components', {})
                print(f"   {components.get('city_name', 'N/A')}, {components.get('state_abbreviation', 'N/A')} {components.get('zipcode', 'N/A')}")
                return True
            else:
                print("\n⚠️  API responded but no address found")
                print(f"   Response: {response.text[:200]}")
                return False
        elif response.status_code == 401:
            print("\n❌ AUTHENTICATION FAILED")
            print("   Check your Auth ID and Auth Token")
            print(f"   Response: {response.text[:200]}")
            return False
        elif response.status_code == 402:
            print("\n⚠️  QUOTA EXCEEDED")
            print("   You've reached your free tier limit (250/month)")
            return False
        else:
            print(f"\n❌ API ERROR: Status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print("\n❌ TIMEOUT: API request took too long")
        return False
    except requests.exceptions.RequestException as e:
        print(f"\n❌ REQUEST ERROR: {str(e)}")
        return False
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_via_validator():
    """Test using the AddressValidator class"""
    print("\n" + "=" * 60)
    print("Testing via AddressValidator Class")
    print("=" * 60)
    
    try:
        from shipping_app.services.address_validator import AddressValidator
        
        validator = AddressValidator()
        
        test_address = {
            'address': '1600 Pennsylvania Avenue NW',
            'city': 'Washington',
            'state': 'DC',
            'zip': '20500'
        }
        
        print(f"\n📍 Testing Address: {test_address['address']}, {test_address['city']}, {test_address['state']} {test_address['zip']}")
        print("-" * 60)
        
        result = validator.validate(test_address)
        
        print(f"\n📊 Results:")
        print(f"   API Used: {result.get('api_used', 'Unknown')}")
        print(f"   Valid: {result.get('valid', False)}")
        print(f"   Fallback Used: {result.get('fallback_used', False)}")
        
        if result.get('error'):
            print(f"   Error: {result.get('error')}")
        
        if result.get('corrections'):
            print(f"   Corrections: {', '.join(result.get('corrections', []))}")
        
        if result.get('corrected_address'):
            corrected = result.get('corrected_address', {})
            print(f"\n📮 Corrected Address:")
            print(f"   {corrected.get('address', '')}")
            print(f"   {corrected.get('city', '')}, {corrected.get('state', '')} {corrected.get('zip', '')}")
        
        if result.get('api_used') == 'SmartyStreets' and result.get('valid'):
            print("\n✅ SUCCESS! AddressValidator is using Smarty API correctly!")
            return True
        else:
            print(f"\n⚠️  Smarty API was not used. Used: {result.get('api_used')}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("\n🧪 Smarty API Connection Test\n")
    
    # Test 1: Direct API call
    direct_success = test_smarty_direct()
    
    # Test 2: Via AddressValidator
    validator_success = test_via_validator()
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Direct API Test: {'✅ PASSED' if direct_success else '❌ FAILED'}")
    print(f"Validator Test: {'✅ PASSED' if validator_success else '❌ FAILED'}")
    
    if direct_success and validator_success:
        print("\n🎉 All tests passed! Smarty API is working correctly!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the errors above.")
        sys.exit(1)
