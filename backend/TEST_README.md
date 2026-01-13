# Test Suite Documentation

This document describes the comprehensive test suite for the Bulk Shipping Application.

## Test Coverage

The test suite includes:

### 1. Unit Tests

#### Model Tests
- **ShipmentModelTest**: Tests for Shipment model
  - Creation and field validation
  - Address formatting methods
  - Package details formatting
  - Status calculation logic
  - String representation

- **SavedAddressModelTest**: Tests for SavedAddress model
  - Creation and default settings
  - String representation

- **SavedPackageModelTest**: Tests for SavedPackage model
  - Creation and default settings
  - String representation

- **OrderNumberSettingsModelTest**: Tests for OrderNumberSettings model
  - Order number generation
  - Settings management
  - Active settings retrieval

#### Service Tests
- **CSVParserTest**: Tests for CSV parsing service
  - Simple CSV parsing
  - Handling missing fields
  - Empty CSV handling
  - Sequential order number generation

- **AddressValidatorTest**: Tests for address validation service
  - Smarty API integration (mocked)
  - Basic validation fallback
  - ZIP code formatting
  - State code formatting

- **ShippingCalculatorTest**: Tests for shipping cost calculation
  - Cost calculation with different weights
  - Service list generation

#### Serializer Tests
- **SerializerTest**: Tests for DRF serializers
  - Shipment serialization
  - Serializer updates

### 2. Integration Tests

#### API Endpoint Tests
- **ShipmentAPITest**: Tests for Shipment API endpoints
  - List shipments
  - Get shipment details
  - Create shipment
  - Update shipment
  - Delete shipment
  - CSV upload
  - Address validation endpoint

- **SavedAddressAPITest**: Tests for SavedAddress API
  - List addresses
  - Create address

- **SavedPackageAPITest**: Tests for SavedPackage API
  - List packages
  - Create package

- **OrderNumberSettingsAPITest**: Tests for OrderNumberSettings API
  - Get active settings
  - Update settings

#### Workflow Tests
- **IntegrationWorkflowTest**: End-to-end workflow tests
  - Complete upload workflow (CSV → Review → Shipping)
  - Bulk update workflow
  - Order number generation workflow

## Running Tests

### Run All Tests
```bash
cd backend
python manage.py test
```

### Run Specific Test Class
```bash
python manage.py test shipping_app.tests.ShipmentModelTest
```

### Run Specific Test Method
```bash
python manage.py test shipping_app.tests.ShipmentModelTest.test_shipment_creation
```

### Run with Verbose Output
```bash
python manage.py test --verbosity=2
```

### Run with Coverage Report
```bash
# Install coverage if not installed
pip install coverage

# Run tests with coverage
coverage run --source='.' manage.py test

# Generate report
coverage report

# Generate HTML report
coverage html
```

## Test Structure

```
shipping_app/tests.py
├── Model Tests (Unit)
│   ├── ShipmentModelTest
│   ├── SavedAddressModelTest
│   ├── SavedPackageModelTest
│   └── OrderNumberSettingsModelTest
├── Service Tests (Unit)
│   ├── CSVParserTest
│   ├── AddressValidatorTest
│   └── ShippingCalculatorTest
├── API Tests (Integration)
│   ├── ShipmentAPITest
│   ├── SavedAddressAPITest
│   ├── SavedPackageAPITest
│   └── OrderNumberSettingsAPITest
├── Workflow Tests (Integration)
│   └── IntegrationWorkflowTest
└── Serializer Tests (Unit)
    └── SerializerTest
```

## Test Data

Tests use Django's TestCase which:
- Creates a test database
- Runs each test in a transaction
- Rolls back after each test
- Provides fixtures via `setUp()` methods

## Mocking External APIs

Some tests use mocking to avoid actual API calls:
- Address validation APIs (Smarty, USPS, Google) are mocked
- This ensures tests run quickly and don't consume API quotas
- Real API integration is tested separately

## Continuous Integration

To run tests in CI/CD:
```bash
python manage.py test --no-input
```

## Test Best Practices

1. **Isolation**: Each test is independent
2. **Fast**: Tests run quickly (< 1 second total)
3. **Deterministic**: Same input = same output
4. **Clear**: Test names describe what they test
5. **Comprehensive**: Cover happy paths and edge cases

## Adding New Tests

When adding new features:
1. Add unit tests for models/services
2. Add integration tests for API endpoints
3. Add workflow tests for user journeys
4. Update this documentation

## Test Statistics

- **Total Test Classes**: 12
- **Total Test Methods**: ~40+
- **Coverage Areas**: Models, Services, APIs, Workflows
- **Mock Usage**: External API calls

## Notes

- Tests use Django's test database (separate from production)
- No actual API calls are made during testing (mocked)
- All tests are designed to run in parallel
- Test data is cleaned up automatically
