# Vercel Deployment Guide - Bulk Shipment Application

## 🚀 Quick Deploy to Vercel

This guide will help you deploy the frontend of the Bulk Shipment Application to Vercel in minutes.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free tier available)
2. **GitHub/GitLab/Bitbucket Account**: Your code should be in a Git repository
3. **Backend API**: Your Django backend should be deployed (currently on Render at `https://bulk-shipping-backend.onrender.com`)

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Go to Vercel Dashboard**
   - Visit [vercel.com/new](https://vercel.com/new)
   - Sign in with GitHub/GitLab/Bitbucket

3. **Import Your Project**
   - Click "Import Project"
   - Select your repository
   - Vercel will auto-detect it's a React app

4. **Configure Project Settings**
   - **Root Directory**: Set to `frontend` (important!)
   - **Framework Preset**: Create React App (auto-detected)
   - **Build Command**: `CI=false DISABLE_ESLINT_PLUGIN=true npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

5. **Set Environment Variables**
   Click "Environment Variables" and add:
   ```
   REACT_APP_API_URL=https://bulk-shipping-backend.onrender.com
   CI=false
   GENERATE_SOURCEMAP=false
   DISABLE_ESLINT_PLUGIN=true
   ```

6. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (2-5 minutes)
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked for root directory, confirm it's `frontend` or `.`
   - When asked to override settings, say "No" (we have vercel.json)

5. **Set Environment Variables**
   ```bash
   vercel env add REACT_APP_API_URL
   # Enter: https://bulk-shipping-backend.onrender.com
   
   vercel env add CI
   # Enter: false
   
   vercel env add GENERATE_SOURCEMAP
   # Enter: false
   
   vercel env add DISABLE_ESLINT_PLUGIN
   # Enter: true
   ```

6. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## Configuration Details

### vercel.json
The `vercel.json` file in the `frontend` directory is already configured with:
- Build command optimization
- SPA routing (all routes redirect to index.html)
- Static asset caching headers
- Output directory configuration

### Environment Variables

**Required:**
- `REACT_APP_API_URL`: Your backend API URL (default: `https://bulk-shipping-backend.onrender.com`)

**Optional (for build optimization):**
- `CI=false`: Disables CI mode for faster builds
- `GENERATE_SOURCEMAP=false`: Reduces build size
- `DISABLE_ESLINT_PLUGIN=true`: Speeds up build process

## Post-Deployment

### 1. Update CORS Settings on Backend

After deployment, update your Django backend's CORS settings to include your Vercel domain:

```python
CORS_ALLOWED_ORIGINS = [
    "https://your-project.vercel.app",
    "https://your-project.vercel.app",
]
```

### 2. Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### 3. Environment-Specific Deployments

Vercel supports three environments:
- **Production**: `vercel --prod`
- **Preview**: Automatic for every push
- **Development**: `vercel dev`

You can set different environment variables for each environment in the Vercel dashboard.

## Troubleshooting

### Build Fails

1. **Check Node Version**
   - Vercel uses Node 18.x by default
   - If you need a specific version, create `.nvmrc` in frontend directory:
     ```
     18.17.0
     ```

2. **Check Build Logs**
   - Go to your project → Deployments → Click on failed deployment
   - Review build logs for errors

3. **Common Issues**
   - **Module not found**: Ensure all dependencies are in `package.json`
   - **TypeScript errors**: Fix type errors or temporarily disable strict mode
   - **Memory issues**: Upgrade to a paid plan or optimize build

### API Connection Issues

1. **CORS Errors**
   - Ensure backend CORS settings include your Vercel domain
   - Check `CORS_ALLOWED_ORIGINS` in Django settings

2. **API URL Not Working**
   - Verify `REACT_APP_API_URL` is set correctly in Vercel
   - Check backend is running and accessible
   - Test API endpoint directly in browser

### Routing Issues

If you see 404 errors on refresh:
- The `vercel.json` rewrite rules should handle this
- Ensure the rewrite rule `"source": "/(.*)", "destination": "/index.html"` is present

## Continuous Deployment

Vercel automatically deploys:
- **Every push to main/master**: Production deployment
- **Every pull request**: Preview deployment
- **Every push to other branches**: Preview deployment

## Performance Optimization

### Already Configured:
- ✅ Static asset caching (1 year)
- ✅ Build optimization flags
- ✅ SPA routing

### Additional Optimizations:

1. **Enable Vercel Analytics** (Optional)
   - Go to project settings
   - Enable Analytics
   - Get insights on performance

2. **Image Optimization**
   - Use Vercel's Image Optimization API
   - Update image imports to use `next/image` (if migrating to Next.js)

3. **Edge Functions** (Future)
   - Consider moving API calls to Edge Functions for better performance

## Cost

**Vercel Free Tier Includes:**
- ✅ 100GB bandwidth/month
- ✅ Unlimited deployments
- ✅ Automatic SSL certificates
- ✅ Custom domains
- ✅ Preview deployments

**Upgrade if you need:**
- More bandwidth
- Team collaboration
- Advanced analytics

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
- **Status Page**: [vercel-status.com](https://vercel-status.com)

## Quick Reference

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from frontend directory)
cd frontend
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls

# View logs
vercel logs
```

---

**Your app should now be live on Vercel! 🎉**

If you encounter any issues, check the build logs in the Vercel dashboard or refer to the troubleshooting section above.
