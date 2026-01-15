"""
Quick test script to verify third-party address validation APIs are working
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from shipping_app.services import AddressValidator
import logging

# Configure logging to see output
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s %(asctime)s %(name)s %(message)s'
)

logger = logging.getLogger(__name__)

def test_address_validation():
    """Test address validation with a known valid address"""
    print("\n" + "="*60)
    print("Testing Address Validation API")
    print("="*60 + "\n")
    
    validator = AddressValidator()
    
    # Test with Google HQ address (known valid address)
    test_address = {
        'first_name': 'John',
        'last_name': 'Doe',
        'address': '1600 Amphitheatre Parkway',
        'city': 'Mountain View',
        'state': 'CA',
        'zip': '94043',
    }
    
    print(f"Testing address: {test_address['address']}, {test_address['city']}, {test_address['state']} {test_address['zip']}")
    print("\nCalling validator.validate()...\n")
    
    try:
        result = validator.validate(test_address)
        
        print("="*60)
        print("Validation Result:")
        print("="*60)
        print(f"Valid: {result.get('valid')}")
        print(f"API Used: {result.get('api_used')}")
        print(f"Error: {result.get('error', 'None')}")
        
        if result.get('corrected_address'):
            corrected = result['corrected_address']
            print(f"\nCorrected Address:")
            print(f"  Address: {corrected.get('address')}")
            print(f"  City: {corrected.get('city')}")
            print(f"  State: {corrected.get('state')}")
            print(f"  ZIP: {corrected.get('zip')}")
        
        if result.get('corrections'):
            print(f"\nCorrections: {result['corrections']}")
        
        print("\n" + "="*60)
        if result.get('valid'):
            print("[SUCCESS] Address validation API is working!")
        else:
            print("[FAILED] Address validation failed")
        print("="*60 + "\n")
        
        return result.get('valid')
        
    except Exception as e:
        print(f"\n[ERROR] Error testing address validation: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_address_validation()
