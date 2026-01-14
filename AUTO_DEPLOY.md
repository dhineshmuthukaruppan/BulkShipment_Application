# 🤖 AUTOMATED DEPLOYMENT - COPY & PASTE THESE EXACT STEPS

Since I can't deploy directly (need your login), here's the **EASIEST** way:

---

## 🎯 METHOD 1: Render Blueprint (AUTOMATIC - Easiest!)

### Step 1: One-Click Deploy Backend + Database

1. **Go to**: https://dashboard.render.com/blueprints
2. **Click**: "New Blueprint"
3. **Paste your repo URL**: 
   ```
   https://github.com/dhineshmuthukaruppan/BulkShipment_Application.git
   ```
4. **Select branch**: `dhines_bulk_shipping`
5. **Click**: "Apply"

Render will **automatically**:
- ✅ Create PostgreSQL database
- ✅ Deploy Django backend
- ✅ Link them together
- ✅ Use your `render.yaml` configuration

6. **After deployment** (wait 2-3 minutes):
   - Go to your backend service
   - Click "Environment" tab
   - Add these variables:
     ```
     SECRET_KEY = <generate-this>
     SMARTY_AUTH_ID = 531e22f6-aa6a-a735-2317-1a0fc6aea1d9
     SMARTY_AUTH_TOKEN = R0Ambj7XhZJ6cARZj9c9
     ```
   - **Generate SECRET_KEY** by running:
     ```bash
     python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
     ```
   - Copy your backend URL (e.g., `https://bulk-shipping-backend.onrender.com`)

---

### Step 2: Deploy Frontend to Vercel

1. **Go to**: https://vercel.com/new
2. **Import Git Repository**:
   - Paste: `https://github.com/dhineshmuthukaruppan/BulkShipment_Application.git`
   - Click "Import"
3. **Configure**:
   - **Root Directory**: `frontend` ⚠️ IMPORTANT!
   - **Framework**: Create React App (auto-detected)
4. **Environment Variables**:
   - Click "Environment Variables"
   - Add:
     ```
     REACT_APP_API_URL = https://bulk-shipping-backend.onrender.com/api
     ```
     (Use YOUR actual Render backend URL from Step 1)
5. **Click**: "Deploy"
6. **Wait** 1-2 minutes
7. **Copy** your frontend URL (e.g., `https://bulk-shipping-application.vercel.app`)

---

### Step 3: Update CORS

1. **Go back to Render** → Your backend service
2. **Environment** tab → Add:
   ```
   CORS_ALLOWED_ORIGINS = https://your-vercel-url.vercel.app
   CSRF_TRUSTED_ORIGINS = https://your-vercel-url.vercel.app
   ```
3. **Save** → Auto-redeploys

---

## 🎯 METHOD 2: Using Render Dashboard (Manual but Clear)

If Blueprint doesn't work, follow `DEPLOY_NOW.md` for step-by-step instructions.

---

## ⚡ QUICK COMMANDS (If you have CLI installed)

### Generate Secret Key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Test Backend Locally (Before Deploy):
```bash
cd backend
export SECRET_KEY=test-key-123
export DEBUG=True
export DB_NAME=test_db
export DB_USER=test_user
export DB_PASSWORD=test_pass
python manage.py runserver
```

---

## 📋 WHAT YOU NEED TO PROVIDE

After deployment, I'll need:
1. ✅ Your Render backend URL
2. ✅ Your Vercel frontend URL
3. ✅ Any errors you see

Then I can help you fix any issues!

---

## 🚀 START HERE

**EASIEST PATH**: Use Render Blueprint (Method 1, Step 1) - it does everything automatically!

**Your repo is ready**: All deployment files are created and committed.

**Just follow the steps above and you'll be live in 10 minutes!** 🎉
