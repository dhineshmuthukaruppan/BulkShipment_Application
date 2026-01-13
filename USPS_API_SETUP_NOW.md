# USPS API Setup - What to Do RIGHT NOW

## ⚠️ Important: Web Tools API is Shutting Down

The old USPS Web Tools API shuts down on **January 25, 2026**. You need to use the **NEW USPS Addresses 3.0 API**.

---

## Step-by-Step: Get Your USPS API Credentials

### 1. Go to USPS Developers Portal
**Click this link**: https://developers.usps.com/

### 2. Sign Up / Log In
- Click **"Sign Up"** or **"Log In"** (top right)
- Create a USPS Business Account if you don't have one
- Complete the registration

### 3. Register Your Application
- After logging in, go to **"My Apps"** (in the navigation)
- Click **"Add App"** or **"Create App"**
- Fill out the form:
  - App Name: "BulkShipmentApp" (or any name)
  - Description: "Address validation for bulk shipping"
  - Select the **"Addresses 3.0"** API
- Click **"Create"** or **"Save"**

### 4. Get Your Credentials
- In your app details, go to **"Credentials"** section
- You'll see:
  - **Consumer Key** (this is your `USPS_CLIENT_ID`)
  - **Consumer Secret** (this is your `USPS_CLIENT_SECRET`)
- **Copy both values** - you'll need them!

### 5. Add to Your Project
- Open or create `.env` file in `backend/` directory
- Add these lines:
  ```env
  USPS_CLIENT_ID=your_consumer_key_here
  USPS_CLIENT_SECRET=your_consumer_secret_here
  USPS_USE_TEM=True
  ```
- Replace `your_consumer_key_here` and `your_consumer_secret_here` with your actual values
- `USPS_USE_TEM=True` means you're using the Testing Environment (change to `False` for production)

### 6. Restart Your Server
- Stop your Django server (Ctrl+C)
- Start it again: `python manage.py runserver`
- Done! ✅

---

## What Changed in the Code?

The code now supports:
- ✅ **NEW**: USPS Addresses 3.0 API (OAuth-based) - **This is what you should use**
- ⚠️ **OLD**: USPS Web Tools API (still works until Jan 2026, but deprecated)

The system will automatically:
1. Try the new Addresses 3.0 API first (if you have credentials)
2. Fall back to old Web Tools API (if you only have USERID)
3. Fall back to other APIs (Google, Smarty, Lob)
4. Fall back to basic validation

---

## Testing vs Production

### Testing Environment (TEM)
- Use `USPS_USE_TEM=True` for testing
- Endpoint: `https://apis-tem.usps.com`
- Good for development and testing

### Production
- Use `USPS_USE_TEM=False` for production
- Endpoint: `https://apis.usps.com`
- Use this when you're ready to go live

---

## Quick Checklist

- [ ] Go to https://developers.usps.com/
- [ ] Sign up / Log in
- [ ] Go to "My Apps"
- [ ] Click "Add App"
- [ ] Select "Addresses 3.0" API
- [ ] Get Consumer Key and Consumer Secret
- [ ] Add to `.env` file
- [ ] Restart Django server
- [ ] Test address validation

---

## Need Help?

- **USPS API Support**: Contact them through the developers portal
- **Documentation**: https://developers.usps.com/addressesv3
- **Getting Started Guide**: https://developers.usps.com/getting-started

---

## That's It!

Once you add the credentials to your `.env` file and restart the server, address validation will automatically use the new USPS Addresses 3.0 API. 🎉
