# 🚀 Quick Vercel Deployment Steps

## Step 1: Login to Vercel
```bash
cd frontend
vercel login
```
This will open your browser for authentication.

## Step 2: Set Environment Variables
```bash
# Set API URL (replace with your backend URL if different)
vercel env add REACT_APP_API_URL production
# Enter: https://bulk-shipping-backend.onrender.com (or your backend URL)

vercel env add REACT_APP_API_URL preview
# Enter: https://bulk-shipping-backend.onrender.com

vercel env add REACT_APP_API_URL development
# Enter: https://bulk-shipping-backend.onrender.com

# Set build optimization variables
vercel env add CI production
# Enter: false

vercel env add GENERATE_SOURCEMAP production
# Enter: false

vercel env add DISABLE_ESLINT_PLUGIN production
# Enter: true
```

## Step 3: Deploy to Production
```bash
cd frontend
vercel --prod
```

## Step 4: Update Backend CORS
After deployment, you'll get a Vercel URL (e.g., `https://your-project.vercel.app`).
Update `backend/config/settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-project.vercel.app",  # Add your Vercel URL here
]
```

Then redeploy your backend.

## Alternative: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. **Important**: Set Root Directory to `frontend`
4. Add environment variables in Project Settings
5. Click Deploy

---

**Your app will be live at: `https://your-project.vercel.app`**
