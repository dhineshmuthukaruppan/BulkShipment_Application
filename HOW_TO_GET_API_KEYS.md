# How to Get API Keys for Address Validation

This guide provides step-by-step instructions for obtaining API keys from each address validation provider.

## Quick Start - You Only Need ONE API Key

**Good news**: You don't need all API keys! The system works with just one API key and will automatically fall back to basic validation if that API fails.

**Recommended order** (easiest to hardest):
1. **USPS** (Free, easiest to get) ⭐ **START HERE**
2. Google Maps (Free tier, requires credit card)
3. SmartyStreets (Free tier, 250/month)
4. Lob (Free tier, 10,000/month)

---

## 1. USPS Address Validation API (RECOMMENDED - FREE)

### Why USPS?
- ✅ **100% FREE** (no credit card required)
- ✅ Official US Postal Service data
- ✅ Most reliable for US addresses
- ✅ No rate limits mentioned

### ⚠️ Important: Two USPS API Options

USPS offers **two different APIs** for address validation:

#### Option A: USPS Web Tools API (Easier - Currently Implemented)
- **Endpoint**: `ShippingAPI.dll` (older but simpler)
- **Authentication**: USERID (simple string)
- **Status**: Currently implemented in this app
- **Easier to set up**

#### Option B: USPS Addresses 3.0 API (Newer - OAuth)
- **Endpoint**: REST API (newer version)
- **Authentication**: OAuth 2.0 (more complex)
- **Status**: Available but requires OAuth setup
- **More modern but requires OAuth tokens**

**For now, we'll use Option A (Web Tools API) as it's simpler.**

### Step-by-Step Guide for Web Tools API:

1. **Go to USPS Web Tools Portal**
   - Visit: https://www.usps.com/business/web-tools-apis/
   - This is the **older** but simpler API

2. **Create an Account**
   - Click "Sign Up" or "Register"
   - Fill out the registration form:
     - Email address
     - Password
     - Company name (can use your name)
     - Business type (select "Other" if unsure)
   - Accept terms and conditions
   - Verify your email

3. **Get Your USERID (API Key)**
   - After logging in, go to "My Account" or "API Keys"
   - Look for "Web Tools" or "Address Validation API"
   - Your **USERID** is your API key
   - It will look something like: `123ABC456DEF`

4. **Add to Your Project**
   - Create or edit `.env` file in `backend/` directory
   - Add this line:
     ```
     USPS_API_KEY=your_userid_here
     ```
   - Replace `your_userid_here` with your actual USERID

5. **Test It**
   - Restart your Django server
   - The system will automatically use USPS for address validation

### USPS API Documentation:
- **Web Tools API** (what we're using): https://www.usps.com/business/web-tools-apis/
- **Addresses 3.0 API** (newer, OAuth): https://developers.usps.com/addressesv3

### Note About Addresses 3.0 API:
If you want to use the newer Addresses 3.0 API (the one you're viewing), it requires:
- OAuth 2.0 authentication
- Getting access tokens
- More complex setup

The current implementation uses the simpler Web Tools API. If you prefer the newer API, we can update the code to support OAuth, but the Web Tools API works perfectly fine and is easier to set up.

---

## 2. Google Maps Geocoding API (Optional - Free Tier Available)

### Why Google Maps?
- ✅ $200/month free credit (~40,000 requests)
- ✅ Very accurate
- ⚠️ Requires credit card (but won't charge unless you exceed free tier)

### Step-by-Step Guide:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a Project**
   - Click "Select a project" → "New Project"
   - Enter project name (e.g., "BulkShipmentApp")
   - Click "Create"

3. **Enable Geocoding API**
   - Go to "APIs & Services" → "Library"
   - Search for "Geocoding API"
   - Click on it and press "Enable"

4. **Create API Key**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy your API key
   - (Optional) Click "Restrict Key" to limit usage

5. **Set Up Billing** (Required for free tier)
   - Go to "Billing" in the menu
   - Link a credit card (won't be charged unless you exceed $200/month)
   - Enable billing for your project

6. **Add to Your Project**
   - Add to `.env` file:
     ```
     GOOGLE_MAPS_API_KEY=your_google_api_key_here
     ```

### Google Maps API Documentation:
- https://developers.google.com/maps/documentation/geocoding

---

## 3. SmartyStreets API (Optional - Free Tier: 250/month)

### Why SmartyStreets?
- ✅ 250 free lookups per month
- ✅ No credit card required for free tier
- ✅ Good accuracy

### Step-by-Step Guide:

1. **Go to SmartyStreets**
   - Visit: https://www.smartystreets.com/

2. **Sign Up for Free Account**
   - Click "Sign Up" or "Get Started"
   - Choose "Free" plan
   - Fill out registration form
   - Verify your email

3. **Get Your Credentials**
   - After logging in, go to "Dashboard" or "API Keys"
   - You'll see:
     - **Auth ID** (looks like: `abc12345-6789-0123`)
     - **Auth Token** (looks like: `xyz98765-4321-0987`)

4. **Add to Your Project**
   - Add to `.env` file:
     ```
     SMARTY_AUTH_ID=your_auth_id_here
     SMARTY_AUTH_TOKEN=your_auth_token_here
     ```

### SmartyStreets Documentation:
- https://www.smartystreets.com/docs

---

## 4. Lob Address Verification API (Optional - Free Tier: 10,000/month)

### Why Lob?
- ✅ 10,000 free verifications per month
- ✅ Good for high volume
- ⚠️ Requires credit card

### Step-by-Step Guide:

1. **Go to Lob**
   - Visit: https://lob.com/

2. **Sign Up**
   - Click "Sign Up" or "Get Started"
   - Create an account
   - Verify your email

3. **Get Your API Key**
   - After logging in, go to "Settings" → "API Keys"
   - Your API key is base64 encoded (username:password)
   - It will look like: `dGVzdF9hYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eg==`

4. **Add to Your Project**
   - Add to `.env` file:
     ```
     LOB_API_KEY=your_lob_api_key_here
     ```

### Lob Documentation:
- https://docs.lob.com/

---

## Setting Up Your .env File

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create or edit .env file**
   ```bash
   # If file doesn't exist, create it
   touch .env
   ```

3. **Add your API keys** (at minimum, add USPS):
   ```env
   # USPS (Recommended - Free, no credit card)
   USPS_API_KEY=your_usps_userid_here

   # Google Maps (Optional - Free tier: $200/month)
   GOOGLE_MAPS_API_KEY=your_google_api_key_here

   # SmartyStreets (Optional - Free tier: 250/month)
   SMARTY_AUTH_ID=your_smarty_auth_id_here
   SMARTY_AUTH_TOKEN=your_smarty_auth_token_here

   # Lob (Optional - Free tier: 10,000/month)
   LOB_API_KEY=your_lob_api_key_here
   ```

4. **Restart your Django server**
   ```bash
   python manage.py runserver
   ```

---

## Testing Your API Keys

After setting up your API keys, test them:

1. **Start your Django server**
2. **Upload a CSV file** with addresses
3. **Check the logs** - you should see which API was used
4. **Or use the API endpoint**:
   ```bash
   POST /api/shipments/{id}/validate_address/
   ```

---

## FAQ

### Do I need all API keys?
**No!** Start with just USPS. The system will automatically try other APIs if USPS fails.

### Which API should I get first?
**USPS** - It's free, doesn't require a credit card, and is the most reliable for US addresses.

### What if I don't have any API keys?
The system will use "Basic Validation" which:
- Validates ZIP code format
- Standardizes state codes
- Checks required fields
- Does NOT verify address deliverability

### Can I use the app without API keys?
Yes, but address validation will be limited to format checking only.

### How do I know if my API key is working?
Check your Django server logs when validating an address. You'll see which API was used.

---

## Troubleshooting

### USPS API not working?
- Make sure your USERID is correct (no spaces)
- Check that you're using the Address Validation API (not other USPS APIs)
- Verify your account is activated

### Google Maps API errors?
- Make sure Geocoding API is enabled
- Check that billing is set up
- Verify API key restrictions allow your IP/domain

### API quota exceeded?
- The system will automatically try the next available API
- Check your usage in each provider's dashboard
- Consider upgrading your plan or adding more API providers

---

## Security Notes

⚠️ **Important**: Never commit your `.env` file to git! It's already in `.gitignore`.

Your `.env` file should look like this:
```env
USPS_API_KEY=123ABC456DEF
```

But in your code, it's loaded securely from environment variables.

---

## Next Steps

1. ✅ Get USPS API key (5-10 minutes)
2. ✅ Add it to `.env` file
3. ✅ Restart Django server
4. ✅ Test with a sample address
5. (Optional) Add more API keys for redundancy

That's it! Your address validation is now set up and working. 🎉
