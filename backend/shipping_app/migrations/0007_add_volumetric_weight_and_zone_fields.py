# Generated migration for volumetric weight and zone fields

from django.db import migrations, models
from decimal import Decimal


def calculate_weights_and_zones(apps, schema_editor):
    """Calculate dimensional weight, billable weight, and zones for existing shipments"""
    Shipment = apps.get_model('shipping_app', 'Shipment')
    
    # Import calculator class directly (not through apps)
    # This is safe in migrations as long as the module exists
    try:
        from shipping_app.services.shipping_calculator import ShippingCalculator
        calculator = ShippingCalculator()
    except ImportError:
        # If calculator not available, set default values
        for shipment in Shipment.objects.all():
            shipment.dimensional_weight = None
            shipment.billable_weight = shipment.weight_lbs
            shipment.weight_type = 'actual'
            shipment.shipping_zone = 3
            shipment.zone_type = 'intrastate'
            shipment.is_intrastate = True
            shipment.save(update_fields=[
                'dimensional_weight', 'billable_weight', 'weight_type',
                'shipping_zone', 'zone_type', 'is_intrastate'
            ])
        return
    
    for shipment in Shipment.objects.all():
        # Calculate dimensional weight if dimensions are present
        if all([shipment.length, shipment.width, shipment.height]):
            dimensional_weight = calculator.calculate_dimensional_weight(
                shipment.length, shipment.width, shipment.height,
                shipment.shipping_provider or 'USPS'
            )
            shipment.dimensional_weight = dimensional_weight
        else:
            shipment.dimensional_weight = None
        
        # Calculate billable weight
        billable_weight, weight_type = calculator.calculate_billable_weight(
            shipment.weight_lbs, shipment.dimensional_weight
        )
        shipment.billable_weight = billable_weight
        shipment.weight_type = weight_type
        
        # Calculate shipping zone if addresses are present
        if all([shipment.from_zip, shipment.to_zip, shipment.from_state, shipment.to_state]):
            zone, zone_type, is_intrastate = calculator.calculate_shipping_zone(
                shipment.from_zip, shipment.to_zip, shipment.from_state, shipment.to_state
            )
            shipment.shipping_zone = zone
            shipment.zone_type = zone_type
            shipment.is_intrastate = is_intrastate
        else:
            # Default values
            shipment.shipping_zone = 3
            shipment.zone_type = 'intrastate'
            shipment.is_intrastate = True
        
        shipment.save(update_fields=[
            'dimensional_weight', 'billable_weight', 'weight_type',
            'shipping_zone', 'zone_type', 'is_intrastate'
        ])


def reverse_calculate_weights_and_zones(apps, schema_editor):
    """Reverse migration - set all calculated fields to None/False"""
    Shipment = apps.get_model('shipping_app', 'Shipment')
    Shipment.objects.all().update(
        dimensional_weight=None,
        billable_weight=None,
        weight_type=None,
        shipping_zone=None,
        zone_type=None,
        is_intrastate=False
    )


class Migration(migrations.Migration):

    dependencies = [
        ('shipping_app', '0006_add_process_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='shipment',
            name='dimensional_weight',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Dimensional (volumetric) weight in pounds', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='shipment',
            name='billable_weight',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Billable weight (higher of actual or dimensional) in pounds', max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='shipment',
            name='weight_type',
            field=models.CharField(blank=True, choices=[('actual', 'Actual'), ('dimensional', 'Dimensional')], help_text='Type of weight used for billing', max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='shipment',
            name='shipping_zone',
            field=models.IntegerField(blank=True, choices=[(1, 'Zone 1'), (2, 'Zone 2'), (3, 'Zone 3'), (4, 'Zone 4'), (5, 'Zone 5'), (6, 'Zone 6'), (7, 'Zone 7'), (8, 'Zone 8')], help_text='Shipping zone (1-8)', null=True),
        ),
        migrations.AddField(
            model_name='shipment',
            name='is_intrastate',
            field=models.BooleanField(default=False, help_text='Whether shipment is intrastate (same state)'),
        ),
        migrations.AddField(
            model_name='shipment',
            name='zone_type',
            field=models.CharField(blank=True, choices=[('intrastate', 'Intrastate'), ('interstate', 'Interstate')], help_text='Type of shipping zone', max_length=20, null=True),
        ),
        migrations.RunPython(calculate_weights_and_zones, reverse_calculate_weights_and_zones),
    ]
