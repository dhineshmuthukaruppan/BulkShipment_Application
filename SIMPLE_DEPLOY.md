# 🚀 DEPLOY `dhines_bulk_shipping` BRANCH - 3 SIMPLE STEPS

**Your Repo**: `https://github.com/dhineshmuthukaruppan/BulkShipment_Application.git`  
**Branch**: `dhines_bulk_shipping`

---

## ✅ STEP 1: Deploy Backend (Render) - 3 Minutes

1. **Open**: https://dashboard.render.com/blueprints
2. **Click**: "New Blueprint"
3. **Connect GitHub** (if not connected)
4. **Paste repo URL**: 
   ```
   https://github.com/dhineshmuthukaruppan/BulkShipment_Application.git
   ```
5. **Select branch**: `dhines_bulk_shipping` ⚠️ IMPORTANT!
6. **Click**: "Apply"

**Render will automatically**:
- Create PostgreSQL database
- Deploy Django backend
- Link everything together

7. **Wait 2-3 minutes** for deployment
8. **Go to your backend service** → "Environment" tab
9. **Add these 2 variables**:
   ```
   SMARTY_AUTH_ID = 531e22f6-aa6a-a735-2317-1a0fc6aea1d9
   SMARTY_AUTH_TOKEN = R0Ambj7XhZJ6cARZj9c9
   ```
10. **Copy your backend URL** (looks like: `https://bulk-shipping-backend-xxxx.onrender.com`)

---

## ✅ STEP 2: Deploy Frontend (Vercel) - 2 Minutes

1. **Open**: https://vercel.com/new
2. **Import Git Repository**:
   - Paste: `https://github.com/dhineshmuthukaruppan/BulkShipment_Application.git`
   - Click "Import"
3. **Configure**:
   - **Git Branch**: `dhines_bulk_shipping` ⚠️ IMPORTANT!
   - **Root Directory**: `frontend` ⚠️ IMPORTANT!
   - **Framework**: Create React App (auto)
4. **Environment Variables** → Add:
   ```
   REACT_APP_API_URL = https://your-backend-url.onrender.com/api
   ```
   (Replace with YOUR Render backend URL from Step 1)
5. **Click**: "Deploy"
6. **Wait 1-2 minutes**
7. **Copy your frontend URL** (looks like: `https://bulk-shipment-application.vercel.app`)

---

## ✅ STEP 3: Update CORS - 1 Minute

1. **Go back to Render** → Your backend service
2. **Environment** tab → Add:
   ```
   CORS_ALLOWED_ORIGINS = https://your-vercel-url.vercel.app
   CSRF_TRUSTED_ORIGINS = https://your-vercel-url.vercel.app
   ```
   (Replace with YOUR Vercel URL from Step 2)
3. **Save** → Backend auto-redeploys

---

## ✅ DONE! 🎉

Your app is now live:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-backend.onrender.com/api`

---

## 🆘 If Something Fails

**Backend errors?**
- Check "Logs" tab in Render
- Verify all environment variables are set
- Make sure database is running (green status)

**Frontend errors?**
- Check `REACT_APP_API_URL` is correct
- Make sure backend URL ends with `/api`
- Check browser console for errors

**CORS errors?**
- Verify CORS URLs match exactly (no trailing slashes)
- Make sure both URLs use `https://`

---

**That's it! Follow these 3 steps and you're deployed!** 🚀
