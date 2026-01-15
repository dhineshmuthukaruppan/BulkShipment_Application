# 🚀 Deploy Backend to Render - Quick Guide

## No Git Push Required! ✅

You can deploy directly from Render's web dashboard without pushing code to GitHub.

## Step 1: Go to Render Dashboard

1. Visit: https://dashboard.render.com
2. Sign in with: **dhineshmuthukaruppan@gmail.com**
3. Click **"New +"** → **"Web Service"**

## Step 2: Connect Repository (Optional - You can skip this)

**Option A: Without Git (Manual)**
- You can create the service and upload files manually later

**Option B: With Git (Recommended)**
- Connect your GitHub account
- Select repository: `BulkShipment_Application`
- Branch: `main` (or your current branch)
- **Root Directory**: `backend` ⚠️ IMPORTANT!

## Step 3: Configure Service

- **Name**: `bulk-shipping-backend`
- **Environment**: `Python 3`
- **Build Command**: 
  ```bash
  pip install -r requirements.txt && python manage.py collectstatic --noinput
  ```
- **Start Command**: 
  ```bash
  python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
  ```
- **Plan**: `Free`

## Step 4: Create PostgreSQL Database

1. Go to Dashboard → **"New +"** → **"PostgreSQL"**
2. Name: `bulk-shipping-db`
3. Plan: **Free**
4. Click **"Create Database"**
5. **Save the connection details** (you'll need them in Step 5)

## Step 5: Set Environment Variables

In your Web Service → **"Environment"** tab, add:

### Required Variables:

```
SECRET_KEY=<generate-random-key>
DEBUG=False
ALLOWED_HOSTS=bulk-shipping-backend.onrender.com,*.onrender.com
```

### Database Variables (from Step 4):

```
DB_NAME=<from-postgresql-service>
DB_USER=<from-postgresql-service>
DB_PASSWORD=<from-postgresql-service>
DB_HOST=<from-postgresql-service>
DB_PORT=5432
```

### CORS Variables:

```
CORS_ALLOWED_ORIGINS=https://bulkshipment.vercel.app,https://bulkshipment-q99gehhfn-dhineshmuthukaruppan-9911s-projects.vercel.app
```

### Optional API Keys (if you have them):

```
SMARTY_AUTH_ID=<your-smarty-auth-id>
SMARTY_AUTH_TOKEN=<your-smarty-auth-token>
USPS_CLIENT_ID=<your-usps-client-id>
USPS_CLIENT_SECRET=<your-usps-client-secret>
```

## Step 6: Link Database

1. In your Web Service settings
2. Go to **"Connections"** tab
3. Click **"Connect"** next to your PostgreSQL database
4. Render will automatically add the database environment variables

## Step 7: Deploy

1. Click **"Create Web Service"** or **"Save Changes"**
2. Render will start building (5-10 minutes)
3. Your backend will be live at: `https://bulk-shipping-backend.onrender.com`

## Step 8: Verify Deployment

1. Visit: `https://bulk-shipping-backend.onrender.com/api/`
2. Should return API response
3. Check **"Logs"** tab for any errors

## ✅ Done!

Your backend is now deployed and ready to use!

**Backend URL**: `https://bulk-shipping-backend.onrender.com`

**Note**: Free tier services sleep after 15 minutes of inactivity. First request after sleep takes ~30 seconds.
