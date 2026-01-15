# 🚀 Deploy Current Branch to Render - Quick Steps

## Current Branch: `finalv2deploymentversion`
## Status: ✅ Ready to Deploy

---

## Method 1: Update Blueprint (Easiest)

1. **Go to Render Dashboard:**
   - Visit: https://dashboard.render.com/blueprints

2. **Click on your blueprint:**
   - Look for `bulkshippingappbackend` or similar

3. **Click "Manual sync"** (top right button)

4. **Update Branch:**
   - Change branch to: `finalv2deploymentversion`
   - Click "Sync" or "Apply"

5. **Wait for deployment** (5-10 minutes)

---

## Method 2: Deploy via Service

1. **Go to your service:**
   - Visit: https://dashboard.render.com
   - Click on `bulk-shipping-backend` service

2. **Manual Deploy:**
   - Click "Manual Deploy" button (top right)
   - Select "Deploy a specific commit"
   - Branch: `finalv2deploymentversion`
   - Click "Deploy"

3. **Wait for deployment** (5-10 minutes)

---

## Method 3: Create New Blueprint (If needed)

1. **Go to:** https://dashboard.render.com/blueprints/new

2. **Connect Repository:**
   - Select: `BulkShipment_Application`
   - Branch: `finalv2deploymentversion`

3. **Render will auto-detect `render.yaml`**

4. **Click "Apply"**

5. **Wait for deployment** (5-10 minutes)

---

## ✅ After Deployment

Your backend will be live at:
- **URL:** https://bulk-shipping-backend.onrender.com
- **API:** https://bulk-shipping-backend.onrender.com/api/

---

## 📋 Configuration Summary

- **Branch:** finalv2deploymentversion
- **Root Directory:** backend
- **Build Command:** pip install -r requirements.txt && python manage.py collectstatic --noinput || true
- **Start Command:** python manage.py migrate && python -m gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --timeout 120 --access-logfile - --error-logfile -
- **Database:** PostgreSQL (bulk-shipping-db)

---

## 🔧 Troubleshooting

If deployment fails:
1. Check the "Logs" tab in Render
2. Look for error messages
3. Common issues:
   - Port binding errors → Already fixed with $PORT
   - Gunicorn not found → Using python -m gunicorn (fixed)
   - Database connection → Check environment variables

---

**Everything is ready! Just follow Method 1 or 2 above to deploy.**
