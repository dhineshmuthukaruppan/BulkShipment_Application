# 🚀 Deploy Backend to Render - RIGHT NOW

## Quick Deploy (2 Steps)

### Step 1: Get Your API Key

1. Go to: **https://dashboard.render.com/u/usr-d5jrihh4tr6s73b219ug/settings**
2. Click **"API Keys"** in the right sidebar
3. Click **"New API Key"**
4. Copy the key (you'll only see it once!)

### Step 2: Run Deployment

```bash
cd /Users/ganeshmuthukaruppan/Documents/web_development/BulkShipment_Application
export RENDER_API_KEY=your_api_key_here
./quick-deploy-render.sh
```

That's it! Your backend will be deployed automatically.

---

## What Will Happen

✅ Creates PostgreSQL database  
✅ Creates Django web service  
✅ Configures all environment variables  
✅ Deploys from `dhines_bulk_shipping` branch  
✅ Your backend will be live at: `https://bulk-shipping-backend.onrender.com`

---

## Alternative: One-Line Command

If you prefer, you can also run:

```bash
RENDER_API_KEY=your_key_here ./quick-deploy-render.sh
```

---

## After Deployment

1. Wait 5-10 minutes for build to complete
2. Check status: https://dashboard.render.com
3. Test your API: https://bulk-shipping-backend.onrender.com/api/
4. Update frontend API URL in Vercel if needed

---

**Ready to deploy? Just get your API key and run the script!** 🚀
