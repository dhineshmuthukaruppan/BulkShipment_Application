# 🚀 Quick Backend Deployment - Easiest Method

## Your Email: dhineshmuthukaruppan@gmail.com

## Method 1: One-Click Blueprint Deployment (RECOMMENDED) ⭐

This is the **easiest** method - Render will set everything up automatically!

### Steps:

1. **Visit this link** (it will open automatically):
   ```
   https://dashboard.render.com/blueprints/new
   ```

2. **Sign in** with: `dhineshmuthukaruppan@gmail.com`

3. **Connect your GitHub repository**:
   - Click "Connect account" if needed
   - Select repository: `BulkShipment_Application`
   - Click "Connect"

4. **Render will automatically detect `render.yaml`** and:
   - ✅ Create PostgreSQL database
   - ✅ Create web service
   - ✅ Configure all environment variables
   - ✅ Deploy your backend

5. **Click "Apply"** and wait 5-10 minutes for deployment

6. **Your backend will be live at**:
   ```
   https://bulk-shipping-backend.onrender.com
   ```

7. **Test it**:
   ```
   https://bulk-shipping-backend.onrender.com/api/
   ```

---

## Method 2: Manual Service Creation

If Method 1 doesn't work, use this:

1. Go to: https://dashboard.render.com
2. Sign in with: `dhineshmuthukaruppan@gmail.com`
3. Click **"New +"** → **"PostgreSQL"**
   - Name: `bulk-shipping-db`
   - Plan: **Free**
   - Click **"Create Database"**
4. Click **"New +"** → **"Web Service"**
   - Connect GitHub: Select `BulkShipment_Application`
   - Root Directory: `backend` ⚠️ **IMPORTANT!**
   - Name: `bulk-shipping-backend`
   - Environment: `Python 3`
   - Build Command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - Start Command: `python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
   - Plan: **Free**
5. In **Environment** tab, add:
   - `SECRET_KEY`: (click "Generate" or use a random string)
   - `DEBUG`: `False`
   - `ALLOWED_HOSTS`: `bulk-shipping-backend.onrender.com,*.onrender.com`
   - `CORS_ALLOWED_ORIGINS`: `https://bulkshipment.vercel.app,https://bulkshipment-q99gehhfn-dhineshmuthukaruppan-9911s-projects.vercel.app`
6. In **Connections** tab, connect the PostgreSQL database
7. Click **"Create Web Service"**

---

## ✅ After Deployment

Your backend API will be available at:
- **Base URL**: `https://bulk-shipping-backend.onrender.com`
- **API Endpoints**: `https://bulk-shipping-backend.onrender.com/api/`
- **Admin Panel**: `https://bulk-shipping-backend.onrender.com/admin/`

**Note**: Free tier services sleep after 15 minutes of inactivity. First request after sleep takes ~30 seconds.

---

## 🔧 Troubleshooting

**Deployment fails?**
- Check the **Logs** tab in Render dashboard
- Ensure `backend/requirements.txt` has all dependencies
- Verify `backend/Procfile` exists (it should!)

**Database connection errors?**
- Make sure PostgreSQL database is created first
- Check database is connected in service **Connections** tab
- Verify environment variables are set correctly

**CORS errors?**
- Check `CORS_ALLOWED_ORIGINS` environment variable includes your frontend URL
- Restart the service after changing environment variables
