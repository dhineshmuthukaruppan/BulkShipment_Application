# Dynamic Pricing - Cost Breakdown - Tariff Chart Integration Documentation

## Overview

This document describes the implementation of the integrated dynamic pricing system that combines:
- **Zone-Based Dynamic Pricing**: Shipping rates vary by zones (1-8) based on origin and destination
- **Volumetric Weight Calculation**: Dimensional weight calculation with carrier-specific divisors
- **Tariff Chart Integration**: Unified rate structure shared between tariff chart display and cost calculations
- **Cost Breakdown Modal**: Detailed breakdown of shipping cost calculations

## Architecture

### Rate Structure

The system uses a **unified zone-based rate structure** (`ZONE_BASED_RATES`) that serves as the single source of truth for all pricing:

```
ZONE_BASED_RATES = {
    'USPS': {
        'Priority Mail': {
            1: {base_price: 5.00, per_oz_rate: 0.095},
            2: {base_price: 5.00, per_oz_rate: 0.097},
            ...
            8: {base_price: 5.00, per_oz_rate: 0.125}
        },
        'Ground Shipping': {...}
    },
    'UPS': {...},
    'FedEx': {...}
}
```

### Zone Classification

- **Zones 1-3**: Intrastate (same state) - Lower rates
- **Zones 4-8**: Interstate (different states) - Higher rates

Zone multipliers:
- Zone 1: 0.95 (5% discount)
- Zone 2: 0.97 (3% discount)
- Zone 3: 1.00 (base rate)
- Zone 4: 1.05 (5% premium)
- Zone 5: 1.10 (10% premium)
- Zone 6: 1.15 (15% premium)
- Zone 7: 1.20 (20% premium)
- Zone 8: 1.25 (25% premium)

### Volumetric Weight Calculation

**Dimensional Weight Formula**:
```
Dimensional Weight = (Length × Width × Height) / Divisor
```

**Carrier-Specific Divisors**:
- USPS: 166
- UPS: 139
- FedEx: 139

**Billable Weight**:
- Always uses the **higher** of actual weight or dimensional weight
- Weight type is stored as 'actual' or 'dimensional'

### Zone Calculation Algorithm

**Intrastate (Same State)**:
- Zone 1: ZIP prefix difference < 50
- Zone 2: ZIP prefix difference 50-100
- Zone 3: ZIP prefix difference > 100

**Interstate (Different States)**:
- Zone 4: ZIP prefix difference < 100
- Zone 5: ZIP prefix difference 100-200
- Zone 6: ZIP prefix difference 200-300
- Zone 7: ZIP prefix difference 300-400
- Zone 8: ZIP prefix difference > 400

**Note**: Uses first 3 digits of ZIP code as prefix. Defaults to Zone 3 if addresses are missing.

## Data Flow

### 1. Shipment Creation/Update

When a shipment is created or updated:

1. **Calculate Dimensional Weight** (if dimensions provided):
   - Uses carrier-specific divisor
   - Formula: `(length × width × height) / divisor`

2. **Calculate Billable Weight**:
   - Compares actual weight vs dimensional weight
   - Uses higher value
   - Stores weight type ('actual' or 'dimensional')

3. **Calculate Shipping Zone**:
   - Compares origin and destination states
   - Calculates ZIP prefix difference
   - Determines zone (1-8) and zone type

4. **Store Values**:
   - All calculated values stored in shipment model
   - Auto-calculated on save when dimensions/addresses change

### 2. Cost Calculation

When calculating shipping cost:

1. **Retrieve Zone-Specific Rates**:
   - Lookup rates from `ZONE_BASED_RATES` structure
   - Based on: provider, service, and zone

2. **Calculate Cost**:
   ```
   Cost = Base Price + (Billable Weight in Ounces × Per-Ounce Rate)
   ```

3. **Return Breakdown**:
   - Cost value
   - Detailed breakdown with all calculation details

### 3. Cost Breakdown Display

When user clicks "Cost Breakdown" button:

1. **Fetch Breakdown Data**:
   - Calls `calculate_shipping` API endpoint
   - Receives detailed breakdown

2. **Display in Modal**:
   - Weight Information (actual, dimensional, billable)
   - Zone Information (zone number, type)
   - Rate Details (provider, service, base price, per-oz rate)
   - Step-by-step calculation

## Database Schema

### New Shipment Fields

- `dimensional_weight` (Decimal): Dimensional weight in pounds
- `billable_weight` (Decimal): Billable weight in pounds
- `weight_type` (CharField): 'actual' or 'dimensional'
- `shipping_zone` (IntegerField): Zone number (1-8)
- `is_intrastate` (BooleanField): Whether shipment is intrastate
- `zone_type` (CharField): 'intrastate' or 'interstate'

### Auto-Calculation

These fields are automatically calculated when:
- Package dimensions change
- Package weight changes
- Addresses change (origin or destination)

Calculation happens in the model's `save()` method.

## API Endpoints

### Calculate Shipping

**Endpoint**: `POST /api/shipments/{id}/calculate_shipping/`

**Request Body**:
```json
{
  "service": "Priority Mail",
  "provider": "USPS"
}
```

**Response**:
```json
{
  "service": "Priority Mail",
  "provider": "USPS",
  "cost": 6.50,
  "formatted_cost": "$6.50",
  "breakdown": {
    "actual_weight_lbs": 2.0,
    "actual_weight_oz": 4.0,
    "dimensional_weight_lbs": 2.5,
    "billable_weight_lbs": 2.5,
    "billable_weight_oz": 40.0,
    "weight_type": "dimensional",
    "shipping_zone": 4,
    "zone_type": "interstate",
    "provider": "USPS",
    "service": "Priority Mail",
    "base_price": "5.00",
    "per_oz_rate": "0.105",
    "calculation": {
      "base_price": 5.00,
      "weight_oz": 40.0,
      "weight_cost": 4.20,
      "total": 9.20
    }
  }
}
```

### Get Tariff Chart

**Endpoint**: `GET /api/shipments/get_tariff_chart/`

**Response**: Returns zone-based rates for all providers and services (used by tariff chart modal)

## Frontend Components

### CostBreakdownModal

**Location**: `frontend/src/components/common/CostBreakdownModal.tsx`

**Props**:
- `visible`: Boolean - Modal visibility
- `onClose`: Function - Close handler
- `breakdown`: CostBreakdown - Breakdown data
- `shipmentId`: Number (optional) - Shipment ID for display

**Sections**:
1. Weight Information
2. Zone Information
3. Rate Details
4. Calculation Breakdown

### Step3Shipping Integration

**Cost Column**:
- Displays shipping cost
- "View Breakdown" button below cost
- Opens CostBreakdownModal on click

**Breakdown Flow**:
1. User clicks "View Breakdown"
2. Calls `calculateShipping` API
3. Receives breakdown data
4. Displays in modal

## Calculation Examples

### Example 1: Intrastate Shipment

**Package**:
- Dimensions: 12" × 10" × 8" = 960 cubic inches
- Actual Weight: 2 lbs 0 oz
- Carrier: USPS
- Origin: CA 90210
- Destination: CA 90001

**Calculation**:
1. Dimensional Weight: 960 / 166 = 5.78 lbs
2. Billable Weight: 5.78 lbs (dimensional, higher)
3. Zone: 1 (intrastate, ZIP diff < 50)
4. Rate: Base $5.00 + (92.48 oz × $0.095/oz) = $13.79

### Example 2: Interstate Shipment

**Package**:
- Dimensions: 24" × 18" × 5" = 2,160 cubic inches
- Actual Weight: 10 lbs 0 oz
- Carrier: UPS
- Origin: NY 10001
- Destination: CA 90210

**Calculation**:
1. Dimensional Weight: 2,160 / 139 = 15.54 lbs
2. Billable Weight: 15.54 lbs (dimensional, higher)
3. Zone: 8 (interstate, ZIP diff > 400)
4. Rate: Base $5.50 + (248.64 oz × $0.1375/oz) = $39.69

## Key Features

### 1. Unified Rate Structure

- Single source of truth for all rates
- Tariff chart and calculator always in sync
- Easy to update rates in one place

### 2. Automatic Calculations

- Dimensional weight calculated automatically
- Billable weight determined automatically
- Zone calculated automatically
- All stored in database

### 3. Detailed Breakdown

- Complete transparency in cost calculation
- Shows which weight was used
- Shows which zone was applied
- Step-by-step calculation display

### 4. Zone-Based Pricing

- Intrastate shipments get lower rates
- Interstate shipments get higher rates
- Rates increase with zone number
- Reflects real-world shipping costs

## Migration Notes

### Database Migration: 0007_add_volumetric_weight_and_zone_fields

- Adds 6 new fields to Shipment model
- Includes data migration to calculate values for existing records
- Handles edge cases (missing dimensions, missing ZIP codes)

**To Apply**:
```bash
cd backend
python manage.py migrate
```

## Testing Considerations

### Test Cases

1. **Dimensional Weight**:
   - Light packages with large dimensions (dimensional weight applies)
   - Heavy packages with small dimensions (actual weight applies)
   - Edge cases (zero dimensions, very large dimensions)

2. **Zone Calculation**:
   - Intrastate shipments (zones 1-3)
   - Interstate shipments (zones 4-8)
   - Missing ZIP codes (defaults to zone 3)
   - Invalid ZIP codes (defaults to zone 3)

3. **Cost Calculation**:
   - Zone-based rates applied correctly
   - Billable weight used in calculation
   - Breakdown data accurate

4. **Tariff Chart**:
   - Displays correct rates
   - Matches rates used in calculations
   - All providers and services shown

## Future Enhancements

1. **ZIP Code Lookup Service**: Integrate with USPS ZIP Code API for accurate zone calculation
2. **Rate Table Management**: Store rates in database for easier updates
3. **Historical Rate Tracking**: Track rate changes over time
4. **Export Functionality**: Export tariff chart as PDF/CSV
5. **Rate Comparison**: Side-by-side comparison of providers

## Files Modified

### Backend
- `backend/shipping_app/services/shipping_calculator.py` - Core calculator logic
- `backend/shipping_app/models.py` - Added weight and zone fields
- `backend/shipping_app/migrations/0007_add_volumetric_weight_and_zone_fields.py` - Database migration
- `backend/shipping_app/serializers/shipment_serializer.py` - Added new fields
- `backend/shipping_app/views.py` - Updated API endpoints

### Frontend
- `frontend/src/types/shipment.ts` - Added TypeScript types
- `frontend/src/components/common/CostBreakdownModal.tsx` - New component
- `frontend/src/components/Wizard/Step3Shipping.tsx` - Added breakdown button
- `frontend/src/services/shipmentService.ts` - Updated API service

## References

- Industry standard dimensional weight divisors (USPS: 166, UPS/FedEx: 139)
- Zone-based pricing structure (intrastate vs interstate)
- Billable weight rule (higher of actual or dimensional)
