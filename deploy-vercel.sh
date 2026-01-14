#!/bin/bash

# Vercel Deployment Script for Bulk Shipment Application
# This script helps you deploy the frontend to Vercel

set -e

echo "🚀 Vercel Deployment Script"
echo "============================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed."
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI installed!"
else
    echo "✅ Vercel CLI is already installed"
fi

echo ""
echo "📁 Navigating to frontend directory..."
cd frontend

echo ""
echo "🔍 Checking if you're logged in to Vercel..."
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel..."
    vercel login
else
    echo "✅ Already logged in to Vercel"
    vercel whoami
fi

echo ""
echo "📋 Current environment variables:"
echo "   REACT_APP_API_URL: ${REACT_APP_API_URL:-https://bulk-shipping-backend.onrender.com}"
echo ""

read -p "Do you want to set/update environment variables? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔧 Setting environment variables..."
    
    read -p "Enter REACT_APP_API_URL (default: https://bulk-shipping-backend.onrender.com): " api_url
    api_url=${api_url:-https://bulk-shipping-backend.onrender.com}
    
    vercel env add REACT_APP_API_URL production <<< "$api_url" || true
    vercel env add REACT_APP_API_URL preview <<< "$api_url" || true
    vercel env add REACT_APP_API_URL development <<< "$api_url" || true
    
    vercel env add CI production <<< "false" || true
    vercel env add CI preview <<< "false" || true
    vercel env add CI development <<< "false" || true
    
    vercel env add GENERATE_SOURCEMAP production <<< "false" || true
    vercel env add GENERATE_SOURCEMAP preview <<< "false" || true
    vercel env add GENERATE_SOURCEMAP development <<< "false" || true
    
    vercel env add DISABLE_ESLINT_PLUGIN production <<< "true" || true
    vercel env add DISABLE_ESLINT_PLUGIN preview <<< "true" || true
    vercel env add DISABLE_ESLINT_PLUGIN development <<< "true" || true
    
    echo "✅ Environment variables set!"
fi

echo ""
read -p "Deploy to production? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Deploying to production..."
    vercel --prod
else
    echo ""
    echo "🚀 Deploying to preview..."
    vercel
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Update your backend CORS settings to include your Vercel domain"
echo "   2. Test your application at the provided URL"
echo "   3. Check the deployment logs if you encounter any issues"
echo ""
echo "📚 For more information, see VERCEL_DEPLOYMENT_GUIDE.md"
