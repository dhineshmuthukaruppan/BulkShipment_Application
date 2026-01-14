# 🚀 Quick Deployment Guide (5 Minutes)

Deploy your Bulk Shipping Application to **FREE hosting** in 5 minutes!

---

## 📦 What You'll Deploy

- **Backend (Django)**: Render.com (Free)
- **Database (PostgreSQL)**: Render.com (Free)  
- **Frontend (React)**: Vercel.com (Free)

---

## Step 1: Deploy Backend to Render (3 minutes)

1. **Go to [render.com](https://render.com)** and sign up (free)

2. **Create PostgreSQL Database:**
   - Click "New" → "PostgreSQL"
   - Name: `bulk-shipping-db`
   - Plan: **Free**
   - Click "Create Database"
   - **Copy the connection details** (Internal Database URL)

3. **Deploy Backend:**
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `bulk-shipping-backend`
     - **Root Directory**: `backend`
     - **Environment**: Python 3
     - **Build Command**: 
       ```bash
       pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
       ```
     - **Start Command**:
       ```bash
       cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
       ```
     - **Plan**: Free

4. **Add Environment Variables:**
   Click "Environment" and add:
   ```
   SECRET_KEY=<generate-random-key>
   DEBUG=False
   ALLOWED_HOSTS=bulk-shipping-backend.onrender.com
   DB_NAME=shipping_db
   DB_USER=<from-postgres-service>
   DB_PASSWORD=<from-postgres-service>
   DB_HOST=<from-postgres-service>
   DB_PORT=5432
   SMARTY_AUTH_ID=your-smarty-id
   SMARTY_AUTH_TOKEN=your-smarty-token
   ```
   
   **Get DB credentials from your PostgreSQL service dashboard!**

5. **Deploy!** Click "Create Web Service"

6. **Copy your backend URL**: `https://bulk-shipping-backend.onrender.com`

---

## Step 2: Deploy Frontend to Vercel (2 minutes)

1. **Go to [vercel.com](https://vercel.com)** and sign up (free)

2. **Import Project:**
   - Click "Add New" → "Project"
   - Import from GitHub
   - Select your repo
   - **Root Directory**: `frontend`
   - **Framework**: Create React App

3. **Add Environment Variable:**
   - Go to "Environment Variables"
   - Add:
     ```
     REACT_APP_API_URL=https://bulk-shipping-backend.onrender.com/api
     ```
   - Replace with your actual Render backend URL

4. **Deploy!** Click "Deploy"

5. **Copy your frontend URL**: `https://your-project.vercel.app`

---

## Step 3: Update CORS (1 minute)

1. Go back to **Render** → Your Backend Service → Environment

2. Add/Update:
   ```
   CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
   CSRF_TRUSTED_ORIGINS=https://your-project.vercel.app
   ```
   (Replace with your actual Vercel URL)

3. **Redeploy** backend (automatic or manual)

---

## ✅ Done!

Your app is now live:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://bulk-shipping-backend.onrender.com/api`

---

## 🔑 Generate Secret Key

Run this to generate a secure SECRET_KEY:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## ⚠️ Important Notes

1. **Free tier limitations:**
   - Render services **spin down after 15 min inactivity** (first request may be slow)
   - PostgreSQL free tier is **90 days** (then $7/month or export data)

2. **Environment Variables:**
   - Make sure ALL variables are set correctly
   - No typos in URLs
   - Include `https://` in CORS origins

3. **Database:**
   - Get DB credentials from Render PostgreSQL dashboard
   - Don't share credentials publicly

---

## 🆘 Need Help?

Check the full guide: `FREE_DEPLOYMENT_GUIDE.md`
