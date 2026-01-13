# Address Validation API Setup Guide

This application includes a robust address validation system with multiple API providers and automatic fallback mechanisms. The system tries APIs in priority order and falls back to the next available provider if one fails or reaches its quota limit.

## Supported APIs

### 1. USPS Address Validation API (Recommended - Free)
- **Priority**: Highest (tried first)
- **Free Tier**: Available
- **Sign Up**: https://www.usps.com/business/web-tools-apis/
- **Rate Limit**: No strict rate limit mentioned
- **Setup**:
  1. Register for a USPS Web Tools account
  2. Get your USERID (API key)
  3. Set environment variable: `USPS_API_KEY=your_userid`

### 2. Google Maps Geocoding API
- **Priority**: Second
- **Free Tier**: $200/month credit (approximately 40,000 requests)
- **Sign Up**: https://console.cloud.google.com/google/maps-apis
- **Rate Limit**: 50 requests per second
- **Setup**:
  1. Create a Google Cloud project
  2. Enable Geocoding API
  3. Create an API key
  4. Set environment variable: `GOOGLE_MAPS_API_KEY=your_api_key`

### 3. SmartyStreets API
- **Priority**: Third
- **Free Tier**: 250 lookups/month
- **Sign Up**: https://www.smartystreets.com/
- **Rate Limit**: Based on plan
- **Setup**:
  1. Create a SmartyStreets account
  2. Get your Auth ID and Auth Token
  3. Set environment variables:
     - `SMARTY_AUTH_ID=your_auth_id`
     - `SMARTY_AUTH_TOKEN=your_auth_token`

### 4. Lob Address Verification API
- **Priority**: Fourth
- **Free Tier**: 10,000 verifications/month
- **Sign Up**: https://lob.com/
- **Rate Limit**: Based on plan
- **Setup**:
  1. Create a Lob account
  2. Get your API key (base64 encoded username:password)
  3. Set environment variable: `LOB_API_KEY=your_base64_api_key`

### 5. Basic Validation (Fallback)
- **Priority**: Last (always available)
- **Free**: Yes (no API required)
- **Features**: Format validation, ZIP code formatting, state code standardization

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory with your API keys:

```env
# At least one API key is recommended for production
USPS_API_KEY=your_usps_userid
GOOGLE_MAPS_API_KEY=your_google_api_key
SMARTY_AUTH_ID=your_smarty_auth_id
SMARTY_AUTH_TOKEN=your_smarty_auth_token
LOB_API_KEY=your_lob_api_key
```

### Settings

The API keys are automatically loaded from environment variables in `backend/config/settings.py`. The system will work with any combination of API keys - it will try them in priority order and fall back to basic validation if none are available.

## How It Works

1. **Priority Order**: The system tries APIs in this order:
   - USPS (if configured)
   - Google Maps (if configured)
   - SmartyStreets (if configured)
   - Lob (if configured)
   - Basic validation (always available)

2. **Fallback Mechanism**: If an API fails (timeout, quota exceeded, authentication error), the system automatically tries the next available API.

3. **Rate Limiting**: Built-in rate limiting prevents API quota exhaustion (200ms delay between requests per API).

4. **Error Handling**: All API errors are logged and the system gracefully falls back to the next provider.

5. **Address Correction**: When an API validates an address, it may return corrections (standardized address, corrected city, etc.). These corrections are applied and logged.

## Usage

The address validator is automatically used when:
- CSV files are uploaded (addresses are validated during parsing)
- Individual shipments are created or updated
- The `/api/shipments/{id}/validate_address/` endpoint is called

## Testing Without API Keys

The system will work with basic validation if no API keys are configured. Basic validation:
- Validates ZIP code format
- Standardizes state codes
- Checks required fields
- Does not verify address deliverability

## Production Recommendations

For production use, configure at least 2-3 API providers to ensure:
- High availability (if one API is down, others can handle requests)
- Quota management (if one API reaches its limit, others can continue)
- Better address validation accuracy

## Monitoring

All address validation attempts are logged via the `ShippingLogger` service. Check logs for:
- Which API was used for each validation
- Whether fallback was triggered
- Any errors or quota issues

## Troubleshooting

### API Not Working
1. Check that the API key is correctly set in environment variables
2. Verify the API key is valid and not expired
3. Check API quota/limits in the provider's dashboard
4. Review application logs for specific error messages

### Quota Exceeded
- The system will automatically fall back to the next available API
- Consider upgrading your API plan or adding more API providers
- Monitor usage in each provider's dashboard

### All APIs Failing
- The system will fall back to basic validation
- Basic validation provides format checking but not deliverability verification
- Review logs to identify why APIs are failing
