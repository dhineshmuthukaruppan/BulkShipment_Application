# Bulk Shipping Label Creation Platform

A comprehensive web application for bulk shipping label creation with advanced weight calculation, zone-based pricing, and cost breakdown features.

## Table of Contents

- [Quick Start](#quick-start)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Features](#features)
  - [Core Functionality](#core-functionality)
- [Weight Calculation](#weight-calculation)
  - [Dimensional (Volumetric) Weight](#dimensional-volumetric-weight)
  - [Billable Weight](#billable-weight)
  - [Automatic Calculation](#automatic-calculation)
- [Zone Calculation](#zone-calculation)
  - [Zone Classification](#zone-classification)
- [Cost Calculation](#cost-calculation)
  - [Zone-Based Dynamic Pricing](#zone-based-dynamic-pricing)
  - [Calculation Example](#calculation-example)
  - [Cost Breakdown Feature](#cost-breakdown-feature)
- [Database Schema](#database-schema)
  - [Weight and Zone Fields](#weight-and-zone-fields)
- [API Endpoints](#api-endpoints)
  - [Calculate Shipping Cost](#calculate-shipping-cost)
  - [Get Tariff Chart](#get-tariff-chart)
- [Technology Stack](#technology-stack)
- [Shipping Services](#shipping-services)
  - [Service Options](#service-options)
- [Additional Documentation](#additional-documentation)
- [Future Enhancements](#future-enhancements)
  - [Provider-Specific Services](#provider-specific-services)
- [Key Concepts](#key-concepts)
  - [Why Dimensional Weight?](#why-dimensional-weight)
  - [Why Zone-Based Pricing?](#why-zone-based-pricing)

## Quick Start

### ⚠️ IMPORTANT: PostgreSQL is Required

This application uses **PostgreSQL**. You must install and configure PostgreSQL before running the application.

**See `SETUP_GUIDE_FOR_NEW_DEVELOPERS.md` for complete setup instructions.**

### Backend Setup

1. **Install PostgreSQL** (Required):
   ```bash
   # macOS
   brew install postgresql@14
   brew services start postgresql@14
   
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create Database and User**:
   ```bash
   # macOS
   /opt/homebrew/opt/postgresql@14/bin/createdb shipping_db
   /opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';"
   /opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;"
   
   # Ubuntu/Debian
   sudo -u postgres psql
   # Then run: CREATE DATABASE shipping_db; CREATE USER shipping_user WITH PASSWORD 'your_password'; GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
   ```

3. Navigate to backend directory:
```bash
cd backend
```

4. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

5. Install dependencies:
```bash
pip install -r requirements.txt
```

6. **Create `.env` file** (Required):
```bash
cp .env.example .env
# Edit .env with your PostgreSQL database credentials:
# DB_NAME=shipping_db
# DB_USER=shipping_user
# DB_PASSWORD=shipping_secure_pass_2026
# DB_HOST=localhost
# DB_PORT=5432
```

7. Run migrations:
```bash
python manage.py migrate
```

8. Start development server:
```bash
python manage.py runserver
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Features

### Core Functionality
- **Bulk CSV Upload**: Upload and process multiple shipments via CSV file
- **Review & Edit**: Comprehensive data review with inline editing capabilities
- **Shipping Provider Selection**: Choose from USPS, UPS, and FedEx
- **Unified Shipping Services**: Two service options (Priority Mail and Ground Shipping) available for all providers
- **Dynamic Pricing**: Zone-based pricing with volumetric weight calculations (prices calculated dynamically, not static ranges)
- **Cost Breakdown**: Detailed cost calculation transparency
- **Tariff Chart**: View complete shipping rate tables

## Weight Calculation

### Dimensional (Volumetric) Weight

The system calculates dimensional weight for packages based on their size, as carriers charge for the space a package occupies, not just its actual weight.

**Formula**:
```
Dimensional Weight (lbs) = (Length × Width × Height) / Divisor
```

**Carrier-Specific Divisors**:
- **USPS**: 166 cubic inches per pound
- **UPS**: 139 cubic inches per pound
- **FedEx**: 139 cubic inches per pound

**Example**:
- Package dimensions: 12" × 10" × 8" = 960 cubic inches
- USPS dimensional weight: 960 / 166 = **5.78 lbs**
- UPS/FedEx dimensional weight: 960 / 139 = **6.91 lbs**

### Billable Weight

The system uses the **higher** of actual weight or dimensional weight for billing:

```
Billable Weight = max(Actual Weight, Dimensional Weight)
```

**Weight Types**:
- **Actual**: When actual weight is higher (heavy, compact packages)
- **Dimensional**: When dimensional weight is higher (light, bulky packages)

**Example**:
- Actual weight: 2 lbs
- Dimensional weight: 5.78 lbs
- **Billable weight: 5.78 lbs** (dimensional weight used)

### Automatic Calculation

Weight calculations are performed automatically when:
- Package dimensions are entered or updated
- Package weight is entered or updated
- Shipping provider is changed (different divisors)

## Zone Calculation

### Zone Classification

Shipping zones (1-8) are determined based on the distance between origin and destination:

**Intrastate (Same State)**:
- **Zone 1**: ZIP prefix difference < 50 (closest)
- **Zone 2**: ZIP prefix difference 50-100
- **Zone 3**: ZIP prefix difference > 100

**Interstate (Different States)**:
- **Zone 4**: ZIP prefix difference < 100
- **Zone 5**: ZIP prefix difference 100-200
- **Zone 6**: ZIP prefix difference 200-300
- **Zone 7**: ZIP prefix difference 300-400
- **Zone 8**: ZIP prefix difference > 400 (farthest)

**Zone Calculation Method**:
- Uses first 3 digits of ZIP code as prefix
- Calculates absolute difference between origin and destination ZIP prefixes
- Determines zone based on difference thresholds
- Defaults to Zone 3 if addresses are missing

**Example**:
- Origin: CA 90210 (ZIP prefix: 902)
- Destination: CA 90001 (ZIP prefix: 900)
- Difference: |902 - 900| = 2
- **Zone: 1** (intrastate, difference < 50)

## Cost Calculation

### Zone-Based Dynamic Pricing

Shipping costs are calculated using zone-specific rates that vary by:
- **Provider** (USPS, UPS, FedEx)
- **Service** (Priority Mail, Ground Shipping)
- **Zone** (1-8)

**Rate Structure**:
```
Cost = Base Price + (Billable Weight in Ounces × Per-Ounce Rate)
```

**Zone Rate Multipliers**:
- Zone 1: 0.95 (5% discount - intrastate)
- Zone 2: 0.97 (3% discount - intrastate)
- Zone 3: 1.00 (base rate - intrastate)
- Zone 4: 1.05 (5% premium - interstate)
- Zone 5: 1.10 (10% premium - interstate)
- Zone 6: 1.15 (15% premium - interstate)
- Zone 7: 1.20 (20% premium - interstate)
- Zone 8: 1.25 (25% premium - interstate)

### Calculation Example

**Package Details**:
- Dimensions: 12" × 10" × 8" = 960 cubic inches
- Actual Weight: 2 lbs 0 oz
- Provider: USPS
- Service: Priority Mail
- Origin: CA 90210
- Destination: CA 90001

**Step-by-Step Calculation**:

1. **Dimensional Weight**:
   - 960 / 166 = 5.78 lbs

2. **Billable Weight**:
   - max(2.0, 5.78) = **5.78 lbs** (dimensional weight used)
   - Convert to ounces: 5.78 × 16 = **92.48 oz**

3. **Zone Calculation**:
   - Same state (CA to CA) = Intrastate
   - ZIP difference: |902 - 900| = 2
   - **Zone: 1**

4. **Rate Lookup**:
   - Base price: $5.00
   - Per-ounce rate (Zone 1): $0.095

5. **Final Cost**:
   - Base: $5.00
   - Weight cost: 92.48 oz × $0.095 = $8.79
   - **Total: $13.79**

### Cost Breakdown Feature

The application provides a detailed cost breakdown modal that shows:
- **Weight Information**: Actual weight, dimensional weight, billable weight, and weight type
- **Zone Information**: Zone number, zone type (intrastate/interstate)
- **Rate Details**: Provider, service, base price, and per-ounce rate
- **Calculation Steps**: Step-by-step breakdown of the final cost

Access the breakdown by clicking "View Breakdown" below the cost in Step 3 (Shipping Selection).

## Database Schema

### Weight and Zone Fields

The `Shipment` model includes the following calculated fields:

- `dimensional_weight` (Decimal): Dimensional weight in pounds
- `billable_weight` (Decimal): Billable weight in pounds (higher of actual/dimensional)
- `weight_type` (CharField): 'actual' or 'dimensional'
- `shipping_zone` (IntegerField): Zone number (1-8)
- `is_intrastate` (BooleanField): Whether shipment is intrastate
- `zone_type` (CharField): 'intrastate' or 'interstate'

**Note**: These fields are calculated dynamically and stored in the database for quick access and reporting.

## API Endpoints

### Calculate Shipping Cost

**Endpoint**: `POST /api/shipments/{id}/calculate_shipping/`

**Request**:
```json
{
  "service": "Priority Mail",
  "provider": "USPS"
}
```

**Response**:
```json
{
  "cost": 13.79,
  "formatted_cost": "$13.79",
  "breakdown": {
    "actual_weight_lbs": 2.0,
    "dimensional_weight_lbs": 5.78,
    "billable_weight_lbs": 5.78,
    "weight_type": "dimensional",
    "shipping_zone": 1,
    "zone_type": "intrastate",
    "provider": "USPS",
    "service": "Priority Mail",
    "base_price": "5.00",
    "per_oz_rate": "0.095",
    "calculation": {
      "base_price": 5.00,
      "weight_oz": 92.48,
      "weight_cost": 8.79,
      "total": 13.79
    }
  }
}
```

### Get Tariff Chart

**Endpoint**: `GET /api/shipments/get_tariff_chart/`

Returns complete zone-based rate tables for all providers and services.

## Technology Stack

- **Backend**: Django REST Framework, Python
- **Frontend**: React, TypeScript, Ant Design
- **State Management**: Redux Toolkit
- **Database**: PostgreSQL (required)

## Shipping Services

### Service Options

The application provides two unified shipping service options available for all providers:

- **Priority Mail**: Faster delivery option
- **Ground Shipping**: Economy option

**Key Points**:
- Both services are available for all providers (USPS, UPS, FedEx)
- Provider-specific tariffs are applied automatically based on the selected provider
- Pricing is **dynamic** and calculated based on:
  - Package weight (actual vs dimensional)
  - Shipping zone (1-8)
  - Provider-specific base rates and per-ounce rates
- No static price ranges are shown - actual calculated cost is displayed in the "Cost" column
- This unified approach allows easy comparison across providers while maintaining provider-specific pricing

## Additional Documentation

For detailed technical documentation on the dynamic pricing implementation, see:
- `DYNAMIC_PRICING_DOCUMENTATION.md` - Complete technical documentation

## Future Enhancements

### Provider-Specific Services

Currently, all providers use the same service names (Priority Mail and Ground Shipping) with provider-specific tariffs. Future versions could include provider-specific service options for a more realistic experience:

- **USPS**: First Class, Priority Mail Express, Parcel Select Ground
- **FedEx**: FedEx Ground, FedEx Express, FedEx Overnight
- **UPS**: UPS Ground, UPS 2nd Day Air, UPS Next Day Air

This enhancement would:
- Provide more accurate service naming that matches real-world carrier services
- Maintain the same zone-based tariff structure
- Allow users to select services that more closely match actual carrier offerings
- Improve user familiarity with carrier-specific service names

## Key Concepts

### Why Dimensional Weight?

Carriers charge for the space a package occupies, not just its weight. A large, lightweight box takes up valuable space in a truck or plane, so carriers calculate a "dimensional weight" and charge for whichever is higher - actual weight or dimensional weight.

**Why No Static Price Ranges?**

Pricing is dynamic and varies significantly based on package characteristics:
- **Small package (1 lb) in Zone 1**: Might cost $5.00
- **Large package (20 lbs) in Zone 8**: Might cost $50.00+
- **Light but bulky package**: Dimensional weight applies, increasing cost
- **Heavy but compact package**: Actual weight applies

Static price ranges (e.g., "$4.00 - $8.00") would be misleading because the actual cost depends on:
- Package weight (actual vs dimensional)
- Shipping zone (1-8, intrastate vs interstate)
- Provider-specific rates

This is why the application calculates costs dynamically and displays the actual calculated price in the "Cost" column, rather than showing misleading static price ranges.

### Why Zone-Based Pricing?

Shipping costs increase with distance. Zone-based pricing reflects this reality:
- **Intrastate** shipments (same state) are cheaper
- **Interstate** shipments (different states) cost more
- **Farther zones** (higher zone numbers) cost more

This ensures pricing accurately reflects shipping costs.
