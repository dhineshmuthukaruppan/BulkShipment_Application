"""
Shipping cost calculator service
"""
from decimal import Decimal
from typing import Dict, Any
from shipping_app.services.logger_service import ShippingLogger


class ShippingCalculator:
    """Calculate shipping costs based on package details and service type"""
    
    # Zone multipliers (intrastate zones have lower rates)
    ZONE_MULTIPLIERS = {
        1: Decimal('0.95'),  # Intrastate - 5% discount
        2: Decimal('0.97'),  # Intrastate - 3% discount
        3: Decimal('1.00'),  # Intrastate - base rate
        4: Decimal('1.05'),  # Interstate - 5% premium
        5: Decimal('1.10'),  # Interstate - 10% premium
        6: Decimal('1.15'),  # Interstate - 15% premium
        7: Decimal('1.20'),  # Interstate - 20% premium
        8: Decimal('1.25'),  # Interstate - 25% premium
    }
    
    # Base rates for Priority Mail and Ground Shipping (by provider)
    BASE_RATES = {
        'USPS': {
            'Priority Mail': {
                'base_price': Decimal('5.00'),
                'per_oz_rate': Decimal('0.10'),
            },
            'Ground Shipping': {
                'base_price': Decimal('2.50'),
                'per_oz_rate': Decimal('0.05'),
            }
        },
        'UPS': {
            'Priority Mail': {
                'base_price': Decimal('5.50'),
                'per_oz_rate': Decimal('0.11'),
            },
            'Ground Shipping': {
                'base_price': Decimal('3.00'),
                'per_oz_rate': Decimal('0.06'),
            }
        },
        'FedEx': {
            'Priority Mail': {
                'base_price': Decimal('6.00'),
                'per_oz_rate': Decimal('0.12'),
            },
            'Ground Shipping': {
                'base_price': Decimal('3.50'),
                'per_oz_rate': Decimal('0.07'),
            }
        }
    }
    
    # Unified zone-based rate structure (single source of truth)
    # Structure: {provider: {service: {zone: {base_price, per_oz_rate}}}}
    ZONE_BASED_RATES = {}
    
    @classmethod
    def _build_zone_based_rates(cls):
        """Build unified zone-based rate structure from base rates and multipliers"""
        if cls.ZONE_BASED_RATES:
            return cls.ZONE_BASED_RATES
        
        zone_based = {}
        for provider, services in cls.BASE_RATES.items():
            zone_based[provider] = {}
            for service_name, base_rates in services.items():
                zone_based[provider][service_name] = {}
                for zone in range(1, 9):
                    multiplier = cls.ZONE_MULTIPLIERS[zone]
                    per_oz_rate = round(base_rates['per_oz_rate'] * multiplier, 3)
                    zone_based[provider][service_name][zone] = {
                        'base_price': base_rates['base_price'],
                        'per_oz_rate': per_oz_rate,
                    }
        
        cls.ZONE_BASED_RATES = zone_based
        return zone_based
    
    # Legacy SERVICE_RATES for backward compatibility (uses USPS rates)
    @property
    def SERVICE_RATES(self):
        """Legacy property for backward compatibility"""
        return {
            'Priority Mail': {
                'base_price': self.BASE_RATES['USPS']['Priority Mail']['base_price'],
                'per_oz_rate': self.BASE_RATES['USPS']['Priority Mail']['per_oz_rate'],
            },
            'Ground Shipping': {
                'base_price': self.BASE_RATES['USPS']['Ground Shipping']['base_price'],
                'per_oz_rate': self.BASE_RATES['USPS']['Ground Shipping']['per_oz_rate'],
            }
        }
    
    def __init__(self):
        self.logger = ShippingLogger()
        # Build zone-based rates on initialization
        self._build_zone_based_rates()
    
    def calculate_dimensional_weight(self, length: Decimal, width: Decimal, 
                                     height: Decimal, carrier: str = 'USPS') -> Decimal:
        """
        Calculate dimensional (volumetric) weight based on package dimensions
        
        Args:
            length: Length in inches
            width: Width in inches
            height: Height in inches
            carrier: Shipping carrier (USPS, UPS, or FedEx)
        
        Returns:
            Dimensional weight in pounds
        """
        # Carrier-specific dimensional divisors
        divisors = {
            'USPS': 166,
            'UPS': 139,
            'FedEx': 139
        }
        divisor = divisors.get(carrier, 166)  # Default to USPS
        
        # Calculate volume in cubic inches
        volume = length * width * height
        
        # Calculate dimensional weight in pounds
        dimensional_weight = volume / Decimal(divisor)
        
        return round(dimensional_weight, 2)
    
    def calculate_billable_weight(self, actual_weight_lbs: Decimal, 
                                  dimensional_weight_lbs: Decimal = None) -> tuple:
        """
        Calculate billable weight (higher of actual or dimensional weight)
        
        Args:
            actual_weight_lbs: Actual weight in pounds
            dimensional_weight_lbs: Dimensional weight in pounds (optional)
        
        Returns:
            Tuple of (billable_weight_lbs, weight_type)
            weight_type: 'actual' or 'dimensional'
        """
        if dimensional_weight_lbs is None:
            return actual_weight_lbs, 'actual'
        
        if dimensional_weight_lbs > actual_weight_lbs:
            return dimensional_weight_lbs, 'dimensional'
        else:
            return actual_weight_lbs, 'actual'
    
    def calculate_shipping_zone(self, origin_zip: str, destination_zip: str,
                                origin_state: str, destination_state: str) -> tuple:
        """
        Calculate shipping zone based on ZIP codes and states
        
        Args:
            origin_zip: Origin ZIP code
            destination_zip: Destination ZIP code
            origin_state: Origin state (2-letter code)
            destination_state: Destination state (2-letter code)
        
        Returns:
            Tuple of (zone, zone_type, is_intrastate)
            zone: Integer 1-8
            zone_type: 'intrastate' or 'interstate'
            is_intrastate: Boolean
        """
        # Check if intrastate
        is_intrastate = (origin_state and destination_state and 
                        origin_state.upper() == destination_state.upper())
        
        # Extract ZIP code prefixes (first 3 digits)
        try:
            origin_prefix = int(origin_zip[:3]) if origin_zip and len(origin_zip) >= 3 else 0
            dest_prefix = int(destination_zip[:3]) if destination_zip and len(destination_zip) >= 3 else 0
        except (ValueError, TypeError):
            # If ZIP codes are invalid, default to zone 3
            return 3, 'intrastate' if is_intrastate else 'interstate', is_intrastate
        
        diff = abs(origin_prefix - dest_prefix)
        
        if is_intrastate:
            # Intrastate: Zones 1-3
            if diff < 50:
                zone = 1
            elif diff < 100:
                zone = 2
            else:
                zone = 3
        else:
            # Interstate: Zones 4-8
            if diff < 100:
                zone = 4
            elif diff < 200:
                zone = 5
            elif diff < 300:
                zone = 6
            elif diff < 400:
                zone = 7
            else:
                zone = 8
        
        zone_type = 'intrastate' if is_intrastate else 'interstate'
        return zone, zone_type, is_intrastate
    
    def calculate(self, weight_lbs: Decimal, weight_oz: Decimal,
                  length: Decimal = None, width: Decimal = None, height: Decimal = None,
                  provider: str = 'USPS', service: str = 'Ground Shipping',
                  origin_zip: str = None, origin_state: str = None,
                  destination_zip: str = None, destination_state: str = None) -> Dict[str, Any]:
        """
        Calculate shipping cost with zone-based rates and volumetric weight
        
        Args:
            weight_lbs: Actual weight in pounds
            weight_oz: Actual weight in ounces
            length: Package length in inches (optional)
            width: Package width in inches (optional)
            height: Package height in inches (optional)
            provider: Shipping provider (USPS, UPS, FedEx)
            service: Shipping service name (Priority Mail, Ground Shipping)
            origin_zip: Origin ZIP code (optional)
            origin_state: Origin state (optional)
            destination_zip: Destination ZIP code (optional)
            destination_state: Destination state (optional)
        
        Returns:
            Dictionary with 'cost' and 'breakdown' containing detailed calculation info
        """
        # Ensure zone-based rates are built
        zone_based_rates = self._build_zone_based_rates()
        
        # Validate provider and service
        if provider not in zone_based_rates:
            provider = 'USPS'
        if service not in zone_based_rates[provider]:
            service = 'Ground Shipping'
        
        # Calculate dimensional weight if dimensions provided
        dimensional_weight_lbs = None
        if length and width and height:
            dimensional_weight_lbs = self.calculate_dimensional_weight(
                length, width, height, provider
            )
        
        # Calculate billable weight
        billable_weight_lbs, weight_type = self.calculate_billable_weight(
            weight_lbs, dimensional_weight_lbs
        )
        
        # Convert billable weight to ounces
        billable_weight_oz = (billable_weight_lbs * 16) + weight_oz
        
        # Calculate shipping zone
        if origin_zip and destination_zip and origin_state and destination_state:
            zone, zone_type, is_intrastate = self.calculate_shipping_zone(
                origin_zip, destination_zip, origin_state, destination_state
            )
        else:
            # Default to zone 3 if addresses not provided
            zone = 3
            zone_type = 'intrastate'
            is_intrastate = True
        
        # Get zone-specific rates
        zone_rates = zone_based_rates[provider][service][zone]
        base_price = zone_rates['base_price']
        per_oz_rate = zone_rates['per_oz_rate']
        
        # Calculate cost
        weight_cost = billable_weight_oz * per_oz_rate
        cost = base_price + weight_cost
        cost = round(cost, 2)
        
        # Build breakdown
        breakdown = {
            'actual_weight_lbs': float(weight_lbs),
            'actual_weight_oz': float(weight_oz),
            'dimensional_weight_lbs': float(dimensional_weight_lbs) if dimensional_weight_lbs else None,
            'billable_weight_lbs': float(billable_weight_lbs),
            'billable_weight_oz': float(billable_weight_oz),
            'weight_type': weight_type,
            'shipping_zone': zone,
            'zone_type': zone_type,
            'provider': provider,
            'service': service,
            'base_price': str(base_price),
            'per_oz_rate': str(per_oz_rate),
            'calculation': {
                'base_price': float(base_price),
                'weight_oz': float(billable_weight_oz),
                'weight_cost': float(weight_cost),
                'total': float(cost)
            }
        }
        
        return {
            'cost': cost,
            'breakdown': breakdown
        }
    
    def get_available_services(self, weight_lbs: Decimal, weight_oz: Decimal,
                               provider: str = 'USPS', **kwargs) -> list:
        """
        Get all available shipping services with prices
        
        Args:
            weight_lbs: Weight in pounds
            weight_oz: Weight in ounces
            provider: Shipping provider (USPS, UPS, FedEx)
            **kwargs: Additional parameters for calculate() (dimensions, addresses, etc.)
        
        Returns:
            List of dicts with service name and price
        """
        services = []
        zone_based_rates = self._build_zone_based_rates()
        
        if provider not in zone_based_rates:
            provider = 'USPS'
        
        for service_name in zone_based_rates[provider].keys():
            result = self.calculate(
                weight_lbs, weight_oz,
                provider=provider, service=service_name,
                **kwargs
            )
            cost = result['cost'] if isinstance(result, dict) else result
            services.append({
                'name': service_name,
                'price': float(cost),
                'formatted_price': f"${cost:.2f}"
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
    
    def get_tariff_chart(self) -> Dict[str, Any]:
        """
        Get tariff chart data with zone-based rates for all providers and services
        
        Returns:
            Dictionary containing structured tariff data for all providers
            Only includes Priority Mail and Ground Shipping services
            Uses unified ZONE_BASED_RATES structure
        """
        # Build zone-based rates if not already built
        zone_based_rates = self._build_zone_based_rates()
        
        # Convert to format expected by frontend (string values)
        providers_data = {}
        for provider, services in zone_based_rates.items():
            providers_data[provider] = {}
            for service_name, zones in services.items():
                providers_data[provider][service_name] = {
                    'zones': {
                        zone: {
                            'base_price': str(rate['base_price']),
                            'per_oz_rate': str(rate['per_oz_rate']),
                        }
                        for zone, rate in zones.items()
                    }
                }
        
        return {
            'providers': providers_data,
            'zone_info': {
                'intrastate_zones': [1, 2, 3],
                'interstate_zones': [4, 5, 6, 7, 8]
            }
        }

