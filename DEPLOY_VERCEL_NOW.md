# 🚀 Deploy to Vercel - Quick Start

## Fastest Way to Deploy (5 minutes)

### Method 1: Via Vercel Dashboard (Easiest)

1. **Push to GitHub** (if not already done)
   ```bash
   git push origin main
   ```

2. **Go to Vercel**
   - Visit: https://vercel.com/new
   - Click "Import Project"
   - Select your repository

3. **Configure**
   - **Root Directory**: `frontend` ⚠️ IMPORTANT!
   - **Framework**: Create React App (auto-detected)
   - Click "Deploy"

4. **Add Environment Variables** (after first deploy)
   - Go to Project Settings → Environment Variables
   - Add:
     ```
     REACT_APP_API_URL = https://bulk-shipping-backend.onrender.com
     CI = false
     GENERATE_SOURCEMAP = false
     DISABLE_ESLINT_PLUGIN = true
     ```
   - Redeploy

5. **Done!** Your app is live at `https://your-project.vercel.app`

### Method 2: Via CLI (Advanced)

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend
cd frontend

# Login
vercel login

# Deploy
vercel --prod
```

Or use the automated script:
```bash
./deploy-vercel.sh
```

## ⚠️ Important Notes

1. **Root Directory**: Must be set to `frontend` in Vercel settings
2. **Backend CORS**: After deployment, update your Django backend's `CORS_ALLOWED_ORIGINS` to include your Vercel URL
3. **Environment Variables**: Set them in Vercel dashboard under Project Settings

## 🔧 Backend CORS Update

After getting your Vercel URL, update `backend/config/settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "https://your-project.vercel.app",  # Add your Vercel URL here
    "https://bulk-shipping-backend.onrender.com",
]
```

Then redeploy your backend.

## ✅ That's It!

Your frontend is now on Vercel. For detailed instructions, see `VERCEL_DEPLOYMENT_GUIDE.md`
