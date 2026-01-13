#!/usr/bin/env python
"""
Quick test script to verify Smarty API credentials
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from shipping_app.services.address_validator import AddressValidator

def test_smarty_api():
    """Test Smarty API with sample address"""
    print("Testing Smarty API connection...")
    print("-" * 50)
    
    validator = AddressValidator()
    
    # Test address
    test_address = {
        'address': '1600 Pennsylvania Avenue NW',
        'city': 'Washington',
        'state': 'DC',
        'zip': '20500'
    }
    
    print(f"Testing address: {test_address['address']}, {test_address['city']}, {test_address['state']} {test_address['zip']}")
    print("-" * 50)
    
    result = validator.validate(test_address)
    
    print(f"✅ API Used: {result.get('api_used', 'Unknown')}")
    print(f"✅ Valid: {result.get('valid', False)}")
    print(f"✅ Fallback Used: {result.get('fallback_used', False)}")
    
    if result.get('error'):
        print(f"❌ Error: {result.get('error')}")
    
    if result.get('corrections'):
        print(f"📝 Corrections: {', '.join(result.get('corrections', []))}")
    
    if result.get('corrected_address'):
        corrected = result.get('corrected_address', {})
        print(f"\n📮 Corrected Address:")
        print(f"   {corrected.get('address', '')}")
        print(f"   {corrected.get('city', '')}, {corrected.get('state', '')} {corrected.get('zip', '')}")
    
    print("-" * 50)
    
    if result.get('api_used') == 'SmartyStreets' and result.get('valid'):
        print("🎉 SUCCESS! Smarty API is working correctly!")
        return True
    elif result.get('api_used') == 'SmartyStreets' and not result.get('valid'):
        print("⚠️  Smarty API connected but address validation failed")
        print(f"   Error: {result.get('error', 'Unknown error')}")
        return False
    else:
        print(f"⚠️  Smarty API was not used. Used: {result.get('api_used')}")
        print("   This might mean:")
        print("   - Smarty credentials are not configured correctly")
        print("   - Another API (USPS/Google) was used instead")
        print("   - Fallback to basic validation")
        return False

if __name__ == '__main__':
    try:
        success = test_smarty_api()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
