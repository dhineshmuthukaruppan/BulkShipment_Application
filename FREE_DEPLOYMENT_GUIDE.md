# Free Deployment Guide - Bulk Shipping Application

This guide will help you deploy your application to **free hosting services**:
- **Backend (Django)**: Render.com (Free tier)
- **Database (PostgreSQL)**: Render.com (Free tier)
- **Frontend (React)**: Vercel.com (Free tier)

---

## 🚀 Quick Start (5 Minutes)

### **Option 1: Render (Backend + Database) + Vercel (Frontend)** ⭐ Recommended

#### **Step 1: Deploy Backend to Render**

1. **Sign up at [Render.com](https://render.com)** (free account)

2. **Create PostgreSQL Database:**
   - Go to Dashboard → New → PostgreSQL
   - Name: `bulk-shipping-db`
   - Plan: **Free**
   - Region: Choose closest to you
   - Click "Create Database"
   - **Save the connection details** (you'll need them)

3. **Deploy Backend Service:**
   - Go to Dashboard → New → Web Service
   - Connect your GitHub repository
   - Select branch: `dhines_bulk_shipping`
   - Name: `bulk-shipping-backend`
   - Root Directory: `backend`
   - Environment: **Python 3**
   - Build Command:
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - Start Command:
     ```bash
     cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
     ```
   - Plan: **Free**

4. **Set Environment Variables in Render:**
   - Go to your Web Service → Environment
   - Add these variables:
     ```
     SECRET_KEY=your-secret-key-here (generate a random string)
     DEBUG=False
     ALLOWED_HOSTS=bulk-shipping-backend.onrender.com
     DB_NAME=shipping_db (from PostgreSQL service)
     DB_USER=shipping_user (from PostgreSQL service)
     DB_PASSWORD=your-db-password (from PostgreSQL service)
     DB_HOST=your-db-host.onrender.com (from PostgreSQL service)
     DB_PORT=5432
     CORS_ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
     CSRF_TRUSTED_ORIGINS=https://your-frontend-url.vercel.app
     SMARTY_AUTH_ID=your-smarty-auth-id
     SMARTY_AUTH_TOKEN=your-smarty-auth-token
     ```
   - **Important**: Get DB credentials from your PostgreSQL service dashboard

5. **Deploy!** Click "Create Web Service"

---

#### **Step 2: Deploy Frontend to Vercel**

1. **Sign up at [Vercel.com](https://vercel.com)** (free account)

2. **Import Project:**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select branch: `dhines_bulk_shipping`
   - Root Directory: `frontend`
   - Framework Preset: **Create React App**

3. **Set Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add:
     ```
     REACT_APP_API_URL=https://bulk-shipping-backend.onrender.com/api
     ```
   - **Important**: Replace with your actual Render backend URL

4. **Deploy!** Click "Deploy"

5. **Update CORS in Backend:**
   - Go back to Render → Your Backend Service → Environment
   - Update `CORS_ALLOWED_ORIGINS` with your Vercel URL:
     ```
     CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
     ```
   - Update `CSRF_TRUSTED_ORIGINS`:
     ```
     CSRF_TRUSTED_ORIGINS=https://your-project.vercel.app
     ```
   - Redeploy backend

---

### **Option 2: Railway (All-in-One)** 🚂

Railway provides $5 free credit monthly (enough for small apps).

1. **Sign up at [Railway.app](https://railway.app)**

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL:**
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Railway automatically creates database

4. **Deploy Backend:**
   - Click "+ New" → "GitHub Repo"
   - Select your repo
   - Root Directory: `backend`
   - Railway auto-detects Python
   - Add environment variables (same as Render)

5. **Deploy Frontend:**
   - Click "+ New" → "GitHub Repo" (again)
   - Root Directory: `frontend`
   - Framework: React
   - Add environment variable: `REACT_APP_API_URL`

---

## 📋 Environment Variables Checklist

### **Backend (Render/Railway):**
```
✅ SECRET_KEY (generate random string)
✅ DEBUG=False
✅ ALLOWED_HOSTS=your-backend-url.onrender.com
✅ DB_NAME (from database service)
✅ DB_USER (from database service)
✅ DB_PASSWORD (from database service)
✅ DB_HOST (from database service)
✅ DB_PORT=5432
✅ CORS_ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
✅ CSRF_TRUSTED_ORIGINS=https://your-frontend-url.vercel.app
✅ SMARTY_AUTH_ID=your-smarty-id
✅ SMARTY_AUTH_TOKEN=your-smarty-token
```

### **Frontend (Vercel):**
```
✅ REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

---

## 🔧 Post-Deployment Steps

### **1. Run Database Migrations:**
After backend deploys, migrations should run automatically. If not:
- Go to Render → Your Backend Service → Shell
- Run: `python manage.py migrate`

### **2. Create Superuser (Optional):**
```bash
python manage.py createsuperuser
```

### **3. Test Your Application:**
- Frontend: `https://your-project.vercel.app`
- Backend API: `https://your-backend.onrender.com/api`

---

## 🆓 Free Tier Limits

### **Render:**
- ✅ **Web Service**: Free (spins down after 15 min inactivity)
- ✅ **PostgreSQL**: Free (90 days, then $7/month or export data)
- ⚠️ **Note**: Free services spin down after inactivity (first request may be slow)

### **Vercel:**
- ✅ **Frontend**: Free forever
- ✅ **Bandwidth**: 100GB/month
- ✅ **Builds**: Unlimited
- ✅ **No spin-down** (always available)

### **Railway:**
- ✅ **$5 free credit/month**
- ✅ **PostgreSQL**: Included
- ✅ **No spin-down** (always available)

---

## 🐛 Troubleshooting

### **Backend won't start:**
- Check environment variables are set correctly
- Check logs in Render dashboard
- Verify database connection string

### **CORS errors:**
- Make sure `CORS_ALLOWED_ORIGINS` includes your frontend URL
- Include `https://` (not `http://`)
- No trailing slashes

### **Database connection failed:**
- Verify all DB environment variables are set
- Check database is running in Render dashboard
- Ensure DB credentials are correct

### **Frontend can't connect to backend:**
- Check `REACT_APP_API_URL` is set correctly
- Verify backend URL is accessible
- Check CORS settings in backend

---

## 📝 Quick Commands

### **Generate Secret Key:**
```python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### **Test Backend Locally:**
```bash
cd backend
export SECRET_KEY=test-key
export DEBUG=True
export DB_NAME=test_db
export DB_USER=test_user
export DB_PASSWORD=test_pass
python manage.py runserver
```

---

## ✅ Deployment Checklist

- [ ] Backend deployed to Render/Railway
- [ ] PostgreSQL database created
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Frontend deployed to Vercel
- [ ] Frontend environment variable set
- [ ] CORS configured correctly
- [ ] Application tested and working

---

## 🎉 You're Done!

Your application is now live on the internet for free! 🚀

**Frontend URL**: `https://your-project.vercel.app`  
**Backend URL**: `https://your-backend.onrender.com/api`

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
