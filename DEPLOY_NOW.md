# 🚀 DEPLOY YOUR APP IN 10 MINUTES - FOLLOW THESE EXACT STEPS

Your repo: `https://github.com/dhineshmuthukaruppan/BulkShipment_Application.git`

---

## ✅ STEP 1: Deploy Backend + Database to Render (5 minutes)

### 1.1 Go to Render.com
- Open: https://render.com
- Click **"Get Started for Free"** or **"Sign Up"**
- Sign up with GitHub (easiest)

### 1.2 Create PostgreSQL Database
1. Click **"New +"** button (top right)
2. Click **"PostgreSQL"**
3. Fill in:
   - **Name**: `bulk-shipping-db`
   - **Database**: `shipping_db`
   - **User**: `shipping_user`
   - **Region**: Choose closest to you
   - **Plan**: **Free**
4. Click **"Create Database"**
5. **WAIT** for it to finish (30 seconds)
6. **COPY** these values from the database dashboard:
   - **Internal Database URL** (looks like: `postgresql://user:pass@host:5432/dbname`)
   - Or copy: Host, Port, Database, User, Password separately

### 1.3 Deploy Backend Service
1. Click **"New +"** → **"Web Service"**
2. Click **"Connect account"** → Connect GitHub
3. Select repository: **`dhineshmuthukaruppan/BulkShipment_Application`**
4. Fill in:
   - **Name**: `bulk-shipping-backend`
   - **Region**: Same as database
   - **Branch**: `dhines_bulk_shipping`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: 
     ```
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - **Start Command**:
     ```
     gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
     ```
   - **Plan**: **Free**

5. Scroll down to **"Environment Variables"** → Click **"Add Environment Variable"**

6. Add these **ONE BY ONE** (click "Add" after each):
   ```
   SECRET_KEY = <generate-random-string>
   DEBUG = False
   ALLOWED_HOSTS = bulk-shipping-backend.onrender.com
   DB_NAME = shipping_db
   DB_USER = <from-database-dashboard>
   DB_PASSWORD = <from-database-dashboard>
   DB_HOST = <from-database-dashboard>
   DB_PORT = 5432
   SMARTY_AUTH_ID = 531e22f6-aa6a-a735-2317-1a0fc6aea1d9
   SMARTY_AUTH_TOKEN = R0Ambj7XhZJ6cARZj9c9
   ```

   **To generate SECRET_KEY**, run this in your terminal:
   ```bash
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   ```

7. Click **"Create Web Service"**
8. **WAIT** for deployment (2-3 minutes)
9. **COPY** your backend URL (looks like: `https://bulk-shipping-backend.onrender.com`)

---

## ✅ STEP 2: Deploy Frontend to Vercel (3 minutes)

### 2.1 Go to Vercel.com
- Open: https://vercel.com
- Click **"Sign Up"**
- Sign up with GitHub (easiest)

### 2.2 Import Your Project
1. Click **"Add New..."** → **"Project"**
2. Find your repo: **`dhineshmuthukaruppan/BulkShipment_Application`**
3. Click **"Import"**
4. Fill in:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend` (IMPORTANT!)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `build` (auto-filled)

5. Click **"Environment Variables"** → **"Add"**
   - **Name**: `REACT_APP_API_URL`
   - **Value**: `https://bulk-shipping-backend.onrender.com/api`
     (Replace with YOUR actual Render backend URL from Step 1.3)

6. Click **"Deploy"**
7. **WAIT** for deployment (1-2 minutes)
8. **COPY** your frontend URL (looks like: `https://bulk-shipping-application.vercel.app`)

---

## ✅ STEP 3: Update CORS in Backend (2 minutes)

1. Go back to **Render.com** → Your backend service
2. Click **"Environment"** tab
3. Add/Update these variables:
   ```
   CORS_ALLOWED_ORIGINS = https://your-frontend-url.vercel.app
   CSRF_TRUSTED_ORIGINS = https://your-frontend-url.vercel.app
   ```
   (Replace with YOUR actual Vercel URL from Step 2.2)

4. Click **"Save Changes"**
5. Backend will **auto-redeploy** (wait 1-2 minutes)

---

## ✅ DONE! Your App is Live! 🎉

- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://bulk-shipping-backend.onrender.com/api`

---

## 🆘 TROUBLESHOOTING

### Backend won't start?
- Check all environment variables are set
- Check database credentials are correct
- Look at "Logs" tab in Render

### Frontend can't connect?
- Check `REACT_APP_API_URL` is correct
- Check CORS settings in backend
- Make sure backend URL has `/api` at the end

### Database connection failed?
- Verify all DB environment variables match database dashboard
- Check database is running (green status in Render)

---

## 📝 QUICK CHECKLIST

- [ ] Render account created
- [ ] PostgreSQL database created
- [ ] Database credentials copied
- [ ] Backend service deployed
- [ ] All environment variables set
- [ ] Backend URL copied
- [ ] Vercel account created
- [ ] Frontend deployed
- [ ] Frontend URL copied
- [ ] CORS updated in backend
- [ ] App tested and working!

---

**Follow these steps exactly and your app will be live in 10 minutes!** 🚀
