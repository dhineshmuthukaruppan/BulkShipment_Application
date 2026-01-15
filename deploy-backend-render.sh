#!/bin/bash

# Deploy Backend to Render - Quick Script
# This script helps you deploy your Django backend to Render without pushing code

set -e

echo "🚀 Backend Deployment to Render"
echo "================================"
echo ""
echo "This script will help you deploy your backend to Render."
echo "You'll need to use Render's web dashboard for the actual deployment."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/manage.py" ]; then
    echo "❌ Error: backend/manage.py not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "✅ Project structure verified"
echo ""

# Create a temporary deployment package
echo "📦 Creating deployment package..."
TEMP_DIR=$(mktemp -d)
DEPLOY_PACKAGE="$TEMP_DIR/backend-deploy.zip"

cd backend
zip -r "$DEPLOY_PACKAGE" . -x "*.pyc" "__pycache__/*" "*.sqlite3" "venv/*" ".env" "db.sqlite3" > /dev/null 2>&1
cd ..

echo "✅ Deployment package created: $DEPLOY_PACKAGE"
echo ""

echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Go to: https://dashboard.render.com"
echo "2. Sign in with: dhineshmuthukaruppan@gmail.com"
echo "3. Click 'New +' → 'Web Service'"
echo "4. Choose 'Deploy an existing image from a registry' OR 'Build and deploy from a Git repository'"
echo ""
echo "   If using Git:"
echo "   - Connect your GitHub account"
echo "   - Select repository: BulkShipment_Application"
echo "   - Branch: main (or your current branch)"
echo "   - Root Directory: backend"
echo ""
echo "   If NOT using Git (Manual Upload):"
echo "   - Use the deployment package: $DEPLOY_PACKAGE"
echo "   - Upload it manually via Render dashboard"
echo ""
echo "5. Configure the service:"
echo "   - Name: bulk-shipping-backend"
echo "   - Environment: Python 3"
echo "   - Build Command: pip install -r requirements.txt && python manage.py collectstatic --noinput"
echo "   - Start Command: gunicorn config.wsgi:application --bind 0.0.0.0:\$PORT --workers 2 --timeout 120"
echo "   - Plan: Free"
echo ""
echo "6. Add Environment Variables:"
echo "   - SECRET_KEY: (generate a random key)"
echo "   - DEBUG: False"
echo "   - ALLOWED_HOSTS: bulk-shipping-backend.onrender.com,*.onrender.com"
echo "   - DB_NAME: (from PostgreSQL service)"
echo "   - DB_USER: (from PostgreSQL service)"
echo "   - DB_PASSWORD: (from PostgreSQL service)"
echo "   - DB_HOST: (from PostgreSQL service)"
echo "   - DB_PORT: 5432"
echo "   - CORS_ALLOWED_ORIGINS: https://bulkshipment.vercel.app,https://bulkshipment-q99gehhfn-dhineshmuthukaruppan-9911s-projects.vercel.app"
echo ""
echo "7. Create PostgreSQL Database:"
echo "   - Go to 'New +' → 'PostgreSQL'"
echo "   - Name: bulk-shipping-db"
echo "   - Plan: Free"
echo ""
echo "8. Link the database to your web service"
echo ""
echo "✅ Your backend will be available at: https://bulk-shipping-backend.onrender.com"
echo ""
echo "📦 Deployment package saved at: $DEPLOY_PACKAGE"
echo "   (You can upload this manually if not using Git)"
echo ""
