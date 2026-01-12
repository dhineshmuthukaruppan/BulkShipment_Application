"""
Shipping cost calculator service
"""
from decimal import Decimal
from typing import Dict, Any
from shipping_app.services.logger_service import ShippingLogger


class ShippingCalculator:
    """Calculate shipping costs based on package details and service type"""
    
    # Base prices and rates (from PRD Appendix C)
    SERVICE_RATES = {
        'Priority Mail': {
            'base_price': Decimal('5.00'),
            'per_oz_rate': Decimal('0.10'),
            'min_price': Decimal('4.00'),
            'max_price': Decimal('8.00')
        },
        'Ground Shipping': {
            'base_price': Decimal('2.50'),
            'per_oz_rate': Decimal('0.05'),
            'min_price': Decimal('2.00'),
            'max_price': Decimal('5.00')
        }
    }
    
    def __init__(self):
        self.logger = ShippingLogger()
    
    def calculate(self, weight_lbs: Decimal, weight_oz: Decimal, 
                  service: str = 'Ground Shipping') -> Decimal:
        """
        Calculate shipping cost based on weight and service
        
        Args:
            weight_lbs: Weight in pounds
            weight_oz: Weight in ounces
            service: Shipping service name
        
        Returns:
            Calculated shipping cost
        """
        if service not in self.SERVICE_RATES:
            service = 'Ground Shipping'
        
        rates = self.SERVICE_RATES[service]
        
        # Convert to total ounces
        total_oz = (weight_lbs * 16) + weight_oz
        
        # Calculate cost
        cost = rates['base_price'] + (total_oz * rates['per_oz_rate'])
        
        # Apply min/max constraints
        cost = max(cost, rates['min_price'])
        cost = min(cost, rates['max_price'])
        
        # Round to 2 decimal places
        cost = round(cost, 2)
        
        return cost
    
    def get_available_services(self, weight_lbs: Decimal, weight_oz: Decimal) -> list:
        """
        Get all available shipping services with prices
        
        Returns:
            List of dicts with service name and price
        """
        services = []
        for service_name in self.SERVICE_RATES.keys():
            price = self.calculate(weight_lbs, weight_oz, service_name)
            services.append({
                'name': service_name,
                'price': float(price),
                'formatted_price': f"${price:.2f}"
            })
        
        # Sort by price (cheapest first)
        services.sort(key=lambda x: x['price'])
        return services
    
    def calculate_bulk_total(self, shipments: list) -> Decimal:
        """
        Calculate total cost for multiple shipments
        
        Args:
            shipments: List of shipment objects with shipping_cost attribute
        
        Returns:
            Total cost
        """
        total = Decimal('0.00')
        for shipment in shipments:
            if hasattr(shipment, 'shipping_cost') and shipment.shipping_cost:
                total += shipment.shipping_cost
        return total

