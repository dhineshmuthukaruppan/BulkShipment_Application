# 🚀 Deploy Backend to Render - Step by Step Guide

This guide will help you deploy your Django backend to Render in just a few minutes.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com) (free tier available)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **Database**: Render will create a PostgreSQL database automatically

## Step-by-Step Deployment

### Step 1: Push Code to GitHub

Make sure your `dhines_bulk_shipping` branch is pushed to GitHub:

```bash
git add .
git commit -m "Update Render configuration with Vercel URLs"
git push origin dhines_bulk_shipping
```

### Step 2: Create Render Account & Connect GitHub

1. Go to [render.com](https://render.com)
2. Sign up or log in
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub account if not already connected
5. Select your repository: `BulkShipment_Application`
6. Select branch: `dhines_bulk_shipping`

### Step 3: Deploy Using Blueprint (Recommended)

1. **Render will detect `render.yaml`** automatically
2. Click **"Apply"** to create all services
3. Render will create:
   - ✅ Web Service (Django Backend)
   - ✅ PostgreSQL Database
   - ✅ All environment variables

### Step 4: Manual Setup (If Blueprint Doesn't Work)

If you prefer manual setup or Blueprint isn't available:

#### A. Create PostgreSQL Database

1. Go to Dashboard → **"New +"** → **"PostgreSQL"**
2. Name: `bulk-shipping-db`
3. Plan: **Free**
4. Database Name: `shipping_db`
5. User: `shipping_user`
6. Click **"Create Database"**
7. **Save the connection details** (you'll need them)

#### B. Create Web Service

1. Go to Dashboard → **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select repository: `BulkShipment_Application`
4. Select branch: `dhines_bulk_shipping`
5. Configure:
   - **Name**: `bulk-shipping-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - **Start Command**: 
     ```bash
     cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
     ```
   - **Plan**: **Free**

#### C. Set Environment Variables

In your Web Service settings, go to **"Environment"** and add:

**Required Variables:**
```
PYTHON_VERSION=3.11.0
SECRET_KEY=<generate-a-random-secret-key>
DEBUG=False
ALLOWED_HOSTS=bulk-shipping-backend.onrender.com,*.onrender.com
```

**Database Variables (from your PostgreSQL service):**
```
DB_NAME=<from-database-connection-string>
DB_USER=<from-database-connection-string>
DB_PASSWORD=<from-database-connection-string>
DB_HOST=<from-database-connection-string>
DB_PORT=5432
```

**CORS Variables:**
```
CORS_ALLOWED_ORIGINS=https://frontend-phi-three-66.vercel.app,https://frontend-o94p5b365-dhineshmuthukaruppan-9911s-projects.vercel.app
```

**Optional API Keys (if you have them):**
```
SMARTY_AUTH_ID=<your-smarty-auth-id>
SMARTY_AUTH_TOKEN=<your-smarty-auth-token>
GOOGLE_MAPS_API_KEY=<your-google-maps-key>
USPS_CLIENT_ID=<your-usps-client-id>
USPS_CLIENT_SECRET=<your-usps-client-secret>
```

### Step 5: Deploy

1. Click **"Create Web Service"** or **"Save Changes"**
2. Render will start building your application
3. Wait for deployment to complete (5-10 minutes)
4. Your backend will be live at: `https://bulk-shipping-backend.onrender.com`

### Step 6: Run Initial Data Setup (Optional)

After deployment, you can run management commands:

1. Go to your Web Service → **"Shell"**
2. Run:
   ```bash
   cd backend
   python manage.py init_data
   ```

## ✅ Verification

1. **Check Deployment Status**
   - Go to your Web Service dashboard
   - Status should be **"Live"**

2. **Test API Endpoint**
   - Visit: `https://bulk-shipping-backend.onrender.com/api/`
   - Should return API response

3. **Check Logs**
   - Go to **"Logs"** tab
   - Look for any errors

## 🔧 Troubleshooting

### Build Fails

1. **Check Build Logs**
   - Go to your service → **"Logs"** tab
   - Look for error messages

2. **Common Issues:**
   - **Missing dependencies**: Check `requirements.txt`
   - **Database connection**: Verify database environment variables
   - **Static files**: Ensure `collectstatic` runs successfully

### Database Connection Issues

1. **Verify Environment Variables**
   - Check all `DB_*` variables are set correctly
   - Ensure database service is running

2. **Check Database Status**
   - Go to PostgreSQL service dashboard
   - Status should be **"Available"**

### CORS Errors

1. **Update CORS_ALLOWED_ORIGINS**
   - Add your Vercel URL to environment variables
   - Redeploy the service

### Service Goes to Sleep (Free Tier)

- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds
- Consider upgrading to paid plan for always-on service

## 📝 Important Notes

1. **Free Tier Limitations:**
   - Services sleep after 15 min inactivity
   - 750 hours/month free
   - Database: 1 GB storage

2. **Environment Variables:**
   - Keep `SECRET_KEY` secure
   - Don't commit secrets to Git
   - Use Render's environment variable management

3. **Database Migrations:**
   - Run automatically during build
   - Can also run manually via Shell

4. **Static Files:**
   - Collected automatically during build
   - Served via WhiteNoise

## 🎯 Quick Links

- **Render Dashboard**: https://dashboard.render.com
- **Your Backend URL**: https://bulk-shipping-backend.onrender.com (after deployment)
- **Documentation**: https://render.com/docs

## ✅ After Deployment

Once deployed, update your frontend's `REACT_APP_API_URL` environment variable in Vercel to point to your Render backend URL.

---

**Your backend will be live at**: `https://bulk-shipping-backend.onrender.com`

Good luck with your deployment! 🚀
