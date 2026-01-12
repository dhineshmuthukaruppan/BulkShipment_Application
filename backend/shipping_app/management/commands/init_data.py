"""
Management command to populate initial saved addresses and packages
"""
from django.core.management.base import BaseCommand
from shipping_app.models import SavedAddress, SavedPackage


class Command(BaseCommand):
    help = 'Populate initial saved addresses and packages'

    def handle(self, *args, **options):
        # Create saved addresses
        addresses_data = [
            {
                'name': 'Print TTS - San Dimas',
                'first_name': 'Print TTS',
                'last_name': '',
                'address': '502 W Arrow Hwy, STE P',
                'address2': '',
                'city': 'San Dimas',
                'state': 'CA',
                'zip_code': '91773',
                'is_default': True
            },
            {
                'name': 'Print TTS - Claremont',
                'first_name': 'Print TTS',
                'last_name': '',
                'address': '500 W Foothill Blvd, STE P',
                'address2': '',
                'city': 'Claremont',
                'state': 'CA',
                'zip_code': '91711',
                'is_default': False
            },
            {
                'name': 'Print TTS - Ontario',
                'first_name': 'Print TTS',
                'last_name': '',
                'address': '1170 Grove Ave',
                'address2': '',
                'city': 'Ontario',
                'state': 'CA',
                'zip_code': '91764',
                'is_default': False
            },
        ]
        
        for addr_data in addresses_data:
            address, created = SavedAddress.objects.get_or_create(
                name=addr_data['name'],
                defaults=addr_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created address: {address.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Address already exists: {address.name}'))
        
        # Create saved packages
        packages_data = [
            {
                'name': 'Light Package',
                'length': 6.0,
                'width': 6.0,
                'height': 6.0,
                'weight_lbs': 1.0,
                'weight_oz': 0.0,
                'is_default': True
            },
            {
                'name': '8 Oz Item',
                'length': 4.0,
                'width': 4.0,
                'height': 4.0,
                'weight_lbs': 0.0,
                'weight_oz': 8.0,
                'is_default': False
            },
            {
                'name': 'Standard Box',
                'length': 12.0,
                'width': 12.0,
                'height': 12.0,
                'weight_lbs': 2.0,
                'weight_oz': 0.0,
                'is_default': False
            },
        ]
        
        for pkg_data in packages_data:
            package, created = SavedPackage.objects.get_or_create(
                name=pkg_data['name'],
                defaults=pkg_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created package: {package.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Package already exists: {package.name}'))
        
        self.stdout.write(self.style.SUCCESS('Initial data populated successfully!'))

