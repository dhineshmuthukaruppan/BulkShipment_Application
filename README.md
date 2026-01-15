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

### Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.9+** (check with `python3 --version`)
- **Node.js 16+** and npm (check with `node --version` and `npm --version`)
- **Git** (for cloning the repository)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. **Create `.env` file** (Optional - for API keys):

Create a `.env` file in the `backend` directory for address validation API keys. The application will work with basic validation if no API keys are provided, but for production use, at least one API key is recommended.

```bash
# Create .env file in backend directory
touch .env  # or create manually
```

Add your API keys to the `.env` file:
```env
# SmartyStreets API (Free tier: 250 lookups/month)
# Sign up at: https://www.smartystreets.com/
SMARTY_AUTH_ID=your_smarty_auth_id
SMARTY_AUTH_TOKEN=your_smarty_auth_token

# USPS Addresses 3.0 API (OAuth-based)
# Sign up at: https://developers.usps.com/
USPS_CLIENT_ID=your_usps_client_id
USPS_CLIENT_SECRET=your_usps_client_secret
USPS_USE_TEM=False  # Set to True for testing environment

# Google Maps Geocoding API (Free tier: $200/month credit)
# Get API key at: https://console.cloud.google.com/google/maps-apis
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Lob Address Verification API (Free tier: 10,000 verifications/month)
# Sign up at: https://lob.com/
LOB_API_KEY=your_lob_api_key
```

**Note**: Address validation APIs are used in priority order: USPS Addresses 3.0 > USPS Web Tools (Legacy) > Google Maps > SmartyStreets > Lob > Basic validation. If no API keys are configured, the system will use basic validation.

5. Run migrations:
```bash
python manage.py migrate
```

This will create the SQLite database file (`db.sqlite3`) and set up all required tables.

**Note**: The application uses SQLite by default (no additional setup required). To use PostgreSQL instead, update `backend/config/settings.py`:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'shipping_db'),
        'USER': os.getenv('DB_USER', 'shipping_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}
```

Then add PostgreSQL credentials to your `.env` file:
```
DB_NAME=shipping_db
DB_USER=shipping_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

6. (Optional) Create a superuser for Django admin:
```bash
python manage.py createsuperuser
```

7. Start development server:
```bash
python manage.py runserver
```

The backend API will be available at `http://localhost:8000`

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

The frontend will automatically open in your browser at `http://localhost:3000`

### Quick Start (Both Servers)

Alternatively, you can start both servers at once using the provided script:

**From project root:**
```bash
cd backend
chmod +x start_dev.sh  # Make script executable (first time only)
./start_dev.sh
```

This will start both the Django backend and React frontend servers simultaneously.

### Application URLs

Once both servers are running:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Django Admin** (if superuser created): http://localhost:8000/admin

### CSV Template

The application includes a CSV template for bulk shipment uploads. You can find it at:
- `frontend/public/shipping_template.csv`
- `Template.csv` (in project root)

The template includes all required fields for bulk shipment creation.

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
- **Database**: SQLite (default, can be configured for PostgreSQL)

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

## What's Been Implemented

This application has been built with great attention to detail, implementing a comprehensive set of features for bulk shipping label creation:

### Core Features

**1. Bulk CSV Upload & Processing**
- Advanced CSV parser supporting 2-header row structure
- Automatic data validation and error detection
- Support for empty order_number columns with auto-generation
- Comprehensive validation warnings and error reporting
- Batch processing with detailed progress tracking

**2. Address Validation System**
- **Intelligent Fallback**: Automatic fallback chain ensures validation always completes
- **Real-time Validation**: Addresses are validated during CSV upload, manual edits, and bulk changes
- **Detailed Error Reporting**: Point-by-point error messages displayed in the status column
- **Address Correction**: Automatic correction of valid addresses with correction details
- **Basic Validation Fallback**: Works without API keys using basic validation rules
- **until the user enter the correct address, the system wont let user to approve the shipment record**

**3. Order Number Management**
- **Configurable Format**: Master settings for prefix, separator, number format, and starting number
- **Sequential Generation**: Continuous order number sequence across all shipments and users
- **Auto-generation**: Automatic generation for empty order_number columns in CSV uploads
- **Database-level Locking**: Uses `SELECT FOR UPDATE` and `@transaction.atomic` for thread-safe generation
- **Format Examples**: Supports formats like ORD-0001, ORDER-1, SHIP-00001, etc.

**4. Shipping Cost Calculation**
- **Dynamic Pricing**: Zone-based pricing with provider-specific rates
- **Volumetric Weight**: Automatic calculation of dimensional weight using carrier-specific divisors
- **Billable Weight**: Uses the higher of actual or dimensional weight
- **Zone Calculation**: Intelligent zone determination (1-8) based on ZIP code prefixes
- **Cost Breakdown**: Detailed breakdown modal showing all calculation steps
- **Multi-Provider Support**: USPS, UPS, and FedEx with unified service options

**5. Review & Edit Interface**
- **Comprehensive Table View**: Sortable, filterable, and searchable shipment table
- **Inline Editing**: Edit addresses, packages, and shipment details directly
- **Bulk Operations**: Bulk address changes, package updates, and status changes
- **Status Management**: Visual status indicators with color-coded tags
- **Validation Display**: Real-time validation status with detailed error messages
- **Address Formatting**: Properly formatted address display with contact information

**6. Master Data Management**
- **Saved Addresses**: Separate management for Ship From and Ship To addresses
- **Saved Packages**: Reusable package templates with dimensions and weight
- **Default Selection**: Mark addresses and packages as default for quick access
- **Streamlined UI**: Clean, formatted address display with action buttons
- **State Dropdown**: 2-letter state abbreviations with search by full state names
- **Auto-generated Names**: Automatic address name generation from address components

**7. Structured Logging**
- **Comprehensive Logging**: All operations logged with structured JSON format
- **Contextual Information**: Logs include user actions, API calls, errors, and system events
- **Log Levels**: INFO, WARNING, ERROR levels for different event types
- **API Integration Logging**: Detailed logging of address validation API calls
- **Purchase Tracking**: Complete purchase transaction logging

**8. User Experience Features**
- **Wizard Interface**: Step-by-step workflow (Upload → Review → Shipping → Purchase)
- **Dashboard**: Overview with statistics and charts
- **Theme Support**: Light and dark theme options
- **Responsive Design**: Works on desktop and tablet devices
- **Error Handling**: User-friendly error messages and validation feedback
- **Loading States**: Visual feedback during API calls and processing

**9. Data Validation & Error Handling**
- **Multi-level Validation**: CSV validation, address validation, and business rule validation
- **Validation Flags**: Comprehensive flag system for tracking validation issues
- **Error Recovery**: Graceful error handling with fallback mechanisms
- **Status Tracking**: Detailed status workflow (uploaded → needs_review → ready → invalid)
- **Batch Validation**: Efficient batch processing of multiple shipments

**10. Technical Implementation**
- **Django REST Framework**: Robust API with proper serialization
- **React with TypeScript**: Type-safe frontend with modern React patterns
- **Redux Toolkit**: Centralized state management
- **Ant Design**: Professional UI components
- **SQLite Database**: Lightweight database with PostgreSQL option
- **CORS Configuration**: Proper cross-origin resource sharing setup

### Attention to Detail Highlights

- **Concurrent Safety**: Order number generation uses database-level locking to prevent duplicates
- **API Resilience**: Multiple fallback APIs ensure address validation always works
- **User Feedback**: Real-time validation status updates and detailed error messages
- **Data Integrity**: Comprehensive validation at every step of the workflow
- **Performance**: Optimized queries, batch operations, and efficient data processing
- **Accessibility**: ARIA labels, keyboard navigation, and semantic HTML
- **Error Recovery**: Graceful degradation when APIs are unavailable
- **Code Quality**: Type safety, proper error handling, and structured logging

## Additional Documentation

For detailed technical documentation on the dynamic pricing implementation, see:
- `DYNAMIC_PRICING_DOCUMENTATION.md` - Complete technical documentation

## Future Enhancements

### Concurrent Order Number Generation

**Current Implementation**: The application uses `@transaction.atomic` and `SELECT FOR UPDATE` locking to prevent race conditions when generating order numbers. However, when multiple users simultaneously upload bulk shipments, there's a potential for duplicate order numbers if the transactions overlap.

**Proposed Enhancement**: Implement a more robust concurrent-safe order number generation system:

- **Database-level Sequence**: Use database sequences (PostgreSQL) or atomic counters to ensure unique order numbers
- **Distributed Locking**: Implement distributed locking mechanism for multi-instance deployments
- **Retry Logic**: Add automatic retry with exponential backoff if order number generation conflicts occur
- **Unique Constraint**: Add database-level unique constraint on order_number field to prevent duplicates at the database level
- **Conflict Detection**: Implement conflict detection and resolution when duplicate order numbers are detected
- **Audit Trail**: Log all order number generation attempts and conflicts for debugging

**Benefits**:
- Guaranteed unique order numbers even under high concurrent load
- Better scalability for multi-user environments
- Improved data integrity and reliability
- Better error handling and recovery from conflicts

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

## Troubleshooting

### Common Issues

**Backend won't start:**
- Ensure virtual environment is activated: `source venv/bin/activate`
- Check Python version: `python3 --version` (should be 3.9+)
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check if port 8000 is already in use

**Frontend won't start:**
- Check Node.js version: `node --version` (should be 16+)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check if port 3000 is already in use
- Clear npm cache: `npm cache clean --force`

**Database errors:**
- If using SQLite, ensure `db.sqlite3` file has write permissions
- Run migrations again: `python manage.py migrate`
- If switching to PostgreSQL, ensure database and user are created first

**Address validation not working:**
- Check `.env` file exists in `backend` directory
- Verify API keys are correctly set in `.env` file
- Check API key quotas/limits haven't been exceeded
- The system will fall back to basic validation if all APIs fail

**CORS errors:**
- Ensure backend is running on port 8000
- Check `CORS_ALLOWED_ORIGINS` in `backend/config/settings.py` includes `http://localhost:3000`
- Restart both servers after making CORS changes

**Module not found errors:**
- Backend: Ensure virtual environment is activated and dependencies are installed
- Frontend: Run `npm install` to install all dependencies
- Check that you're in the correct directory when running commands