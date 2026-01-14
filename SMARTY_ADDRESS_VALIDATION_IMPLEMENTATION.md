# Smarty Address Validation - Complete Implementation

## Overview

Implemented comprehensive address validation using Smarty's US Street Address API with enhanced error detection, non-US address identification, and automatic status transitions.

---

## Features Implemented

### 1. Enhanced Smarty API Validation

**Location**: `backend/shipping_app/services/address_validator.py`

#### Key Enhancements:

- **Enhanced Match Mode**: Uses `match=enhanced` parameter to get detailed validation information
- **DPV (Delivery Point Validation)**: Analyzes `dpv_match_code` and `dpv_footnotes` for deliverability
- **Non-US Address Detection**: Automatically identifies non-US addresses using multiple indicators
- **Detailed Error Analysis**: Provides specific error types for each validation failure

#### DPV Match Codes:
- `Y`: Confirmed - entire address is deliverable
- `N`: Not Confirmed - address is not deliverable
- `S`: Confirmed by dropping secondary (apt/suite dropped)
- `D`: Confirmed but missing secondary (apt/suite needed)

#### DPV Footnotes Analyzed:
- `M1`, `M3`: Primary number (street number) missing/invalid
- `N1`: Secondary number (apt/suite) missing
- `CC`: Secondary number doesn't match
- `P1`, `P3`: PO Box number issues
- `A1`: Address not in ZIP+4 file

### 2. Non-US Address Detection

**Method**: `_is_likely_non_us_address()`

Detects non-US addresses based on:

1. **State Code Validation**
   - Checks if state is not in list of US states
   - Detects full province names (longer than 2 characters)

2. **ZIP Code Format**
   - US ZIP must be exactly 5 or 9 digits
   - Rejects ZIP codes with letters (common in international postal codes)

3. **International Keywords**
   - Detects terms like "province", "postal code", "Canada", "India", etc.

### 3. Error Types Returned

The system now returns detailed error types:

- `non_us_address`: Address is outside the United States
- `invalid_street`: Street address is invalid or not found
- `invalid_city`: City name is invalid
- `invalid_pincode`: ZIP code is invalid
- `invalid_secondary`: Apt/suite number is not recognized
- `missing_secondary`: Apt/suite number is missing but required
- `invalid_address`: General address validation failure

### 4. Status Transition Logic

**Location**: `backend/shipping_app/views.py`

When a user edits an address on an `invalid` shipment:

1. System detects address field changes
2. Clears `_skip_auto_status` flag
3. Model's `save()` method recalculates status
4. Status automatically transitions from `invalid` to `needs_review` if errors are fixed

### 5. UI Validation Display

**Location**: `frontend/src/components/Wizard/Step2Review.tsx`

#### Validation Issue Counts:

New validation count tracked:
```typescript
nonUsAddress: shipments.filter(s => {
  const flags = s.validation_flags || [];
  return flags.includes('non_us_address') || flags.includes('non_us_from_address');
}).length
```

#### Validation Issue Filter:

Added "Non-US Address" button in validation summary:
- Shows count of non-US addresses detected
- Styled with `danger` theme (red) to highlight issue
- Allows filtering to see only affected shipments

---

## How It Works

### Upload Flow:

1. **CSV Upload**:
   - User uploads CSV with addresses
   - Each address is validated via Smarty API

2. **Smarty API Call**:
   ```http
   GET https://us-street.api.smartystreets.com/street-address
   Parameters:
   - auth-id: {SMARTY_AUTH_ID}
   - auth-token: {SMARTY_AUTH_TOKEN}
   - street: {address}
   - city: {city}
   - state: {state}
   - zipcode: {zip}
   - match: enhanced
   ```

3. **Response Processing**:

   **A. Valid US Address** (HTTP 200 with data):
   ```json
   [
     {
       "delivery_line_1": "123 Main St",
       "components": {
         "city_name": "New York",
         "state_abbreviation": "NY",
         "zipcode": "10001"
       },
       "analysis": {
         "dpv_match_code": "Y",
         "enhanced_match": "postal-match"
       }
     }
   ]
   ```
   - Status: `ready` (if no other issues)
   - Address is standardized/corrected

   **B. Invalid US Address** (HTTP 200 with empty array):
   ```json
   []
   ```
   - Status: `invalid`
   - Error details analyzed from input fields
   - Specific error flags added (invalid_street, invalid_pincode, etc.)

   **C. Non-US Address** (HTTP 200 with empty array + detection):
   ```json
   []
   ```
   - System detects non-US patterns
   - Status: `invalid`
   - Error: "Non-US address detected. Only US addresses are supported."
   - Validation flag: `non_us_address`

4. **Database Storage**:
   - `validation_flags`: List of specific issues
   - `address_validation_error`: Human-readable error message
   - `address_validation_api_used`: "SmartyStreets"
   - `status`: Auto-calculated based on errors

### Edit/Correction Flow:

1. **User Edits Invalid Shipment**:
   - User clicks edit on shipment with `invalid` status
   - Changes address fields (to_address, to_city, to_state, to_zip)

2. **Status Recalculation**:
   - PATCH request sent to `/api/shipments/{id}/`
   - Backend detects address field changes
   - Clears `_skip_auto_status` flag
   - Model's `save()` method runs
   - Status changes to `needs_review` if errors are resolved

3. **Revalidation** (Optional):
   - User can click "Validate Address" button
   - Calls `/api/shipments/{id}/validate_address/`
   - Gets fresh validation from Smarty API
   - Updates address with corrections

---

## Validation Flags Reference

### Address-Related Flags:

| Flag | Meaning | Source |
|------|---------|--------|
| `non_us_address` | Non-US recipient address | Smarty API (empty response) + detection |
| `non_us_from_address` | Non-US sender address | Smarty API (empty response) + detection |
| `invalid_ship_to_address` | Invalid recipient street | Smarty API (DPV footnote M1/M3) |
| `invalid_ship_from_address` | Invalid sender street | Smarty API (DPV footnote M1/M3) |
| `invalid_ship_to_city` | Invalid recipient city | Field analysis |
| `invalid_ship_from_city` | Invalid sender city | Field analysis |
| `invalid_ship_to_pincode` | Invalid recipient ZIP | Field analysis |
| `invalid_ship_from_pincode` | Invalid sender ZIP | Field analysis |
| `invalid_ship_to_secondary` | Invalid apt/suite (recipient) | Smarty API (DPV footnote CC) |
| `invalid_ship_from_secondary` | Invalid apt/suite (sender) | Smarty API (DPV footnote CC) |
| `missing_ship_to_secondary` | Missing apt/suite (recipient) | Smarty API (DPV footnote N1) |
| `missing_ship_from_secondary` | Missing apt/suite (sender) | Smarty API (DPV footnote N1) |

---

## Testing Scenarios

### Test Case 1: Non-US Address (India)

**Input**:
```csv
to_address: "123 MG Road"
to_city: "Mumbai"
to_state: "MH"
to_zip: "400001"
```

**Expected Result**:
- Status: `invalid`
- Validation flag: `non_us_address`
- Error: "Non-US address detected. Only US addresses are supported."
- UI shows: "Non-US Address (1)" button

### Test Case 2: Invalid US Address

**Input**:
```csv
to_address: "999999 Fake Street"
to_city: "Nowheresville"
to_state: "XX"
to_zip: "00000"
```

**Expected Result**:
- Status: `invalid`
- Validation flags: `invalid_ship_to_address`, `invalid_ship_to_city`, `invalid_ship_to_pincode`
- Error: "Address not found in USPS database"

### Test Case 3: Valid US Address

**Input**:
```csv
to_address: "1600 Pennsylvania Ave NW"
to_city: "Washington"
to_state: "DC"
to_zip: "20500"
```

**Expected Result**:
- Status: `ready`
- Address standardized: "1600 Pennsylvania Avenue NW"
- ZIP enhanced: "20500-0001"

### Test Case 4: User Correction

**Steps**:
1. Upload CSV with invalid address (status: `invalid`)
2. Edit shipment, correct the address
3. Save changes

**Expected Result**:
- Status automatically changes to `needs_review`
- User can validate address again for confirmation

---

## API Credentials

Stored in `/backend/.env`:

```env
SMARTY_AUTH_ID=531e22f6-aa6a-a735-2317-1a0fc6aea1d9
SMARTY_AUTH_TOKEN=R0Ambj7XhZJ6cARZj9c9
```

---

## Error Handling

### 1. API Authentication Failure (HTTP 401)

```json
{
  "valid": false,
  "api_used": "SmartyStreets",
  "error": "Authentication failed - check API credentials",
  "error_details": ["api_auth_error"]
}
```

### 2. API Quota Exceeded (HTTP 402)

```json
{
  "valid": false,
  "api_used": "SmartyStreets",
  "error": "API quota exceeded",
  "error_details": ["api_quota_exceeded"]
}
```

### 3. API Timeout

```json
{
  "valid": false,
  "api_used": "SmartyStreets",
  "error": "Request timeout",
  "error_details": ["api_timeout"]
}
```

---

## User Experience

### 1. Upload CSV

User uploads CSV → System validates all addresses → Shows validation summary:
- "Invalid Ship To Pincode (5 records)"
- "Non-US Address (3 records)"
- "Invalid Ship To City (2 records)"

### 2. Filter by Issue

User clicks "Non-US Address (3)" → Table filters to show only those 3 shipments

### 3. Review & Fix

User reviews each shipment:
- Sees error message: "Non-US address detected. Only US addresses are supported."
- Decides to either:
  - Delete the shipment (not supported)
  - Correct to a valid US address

### 4. Edit & Correct

User edits shipment:
- Changes address to valid US address
- Saves
- Status automatically changes from `invalid` → `needs_review`

### 5. Validate

User clicks "Validate Address" button:
- System calls Smarty API again
- Address is corrected/standardized
- Status changes to `ready`

---

## Benefits

1. **Accurate Detection**: Smarty API provides USPS-verified address validation
2. **Clear Error Messages**: Users know exactly what's wrong
3. **Automatic Status Transitions**: No manual status management needed
4. **Non-US Detection**: Prevents wasted time on international addresses
5. **Detailed Analytics**: Track validation issues by type
6. **User-Friendly**: Filter and fix issues efficiently

---

## Next Steps

### Recommended Enhancements:

1. **Bulk Address Correction**:
   - Allow selecting multiple invalid addresses
   - Validate all at once

2. **Suggested Fixes**:
   - When address is close but not exact, show suggestions
   - "Did you mean: 123 Main St instead of 123 Main Street?"

3. **Address History**:
   - Remember previously validated addresses
   - Auto-suggest corrections based on history

4. **International Support** (Future):
   - Integrate Smarty International API for non-US addresses
   - Separate validation flow for international shipments

---

## Conclusion

The Smarty address validation integration is now **fully functional** with:

✅ Enhanced error detection
✅ Non-US address identification
✅ Detailed validation flags
✅ Automatic status transitions
✅ User-friendly filtering
✅ Clear error messages

The system perfectly detects invalid addresses, categorizes errors, and guides users to fix issues efficiently.
