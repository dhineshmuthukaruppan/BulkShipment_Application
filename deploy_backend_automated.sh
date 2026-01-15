#!/bin/bash

# Automated Backend Deployment to Render
# Email: dhineshmuthukaruppan@gmail.com

set -e

echo "🚀 Automated Backend Deployment to Render"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/manage.py" ]; then
    echo -e "${RED}❌ Error: backend/manage.py not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo -e "${GREEN}✅ Project structure verified${NC}"
echo ""

# Check if Render CLI is installed
if ! command -v render &> /dev/null; then
    echo -e "${RED}❌ Render CLI not found!${NC}"
    echo "Installing Render CLI..."
    brew install render
fi

echo -e "${GREEN}✅ Render CLI found${NC}"
echo ""

# Check authentication
echo "Checking Render authentication..."
if render whoami &> /dev/null; then
    echo -e "${GREEN}✅ Already authenticated with Render${NC}"
    USER_EMAIL=$(render whoami -o text 2>/dev/null | grep -i email || echo "")
    echo "Logged in as: $USER_EMAIL"
else
    echo -e "${YELLOW}⚠️  Not authenticated. Starting login process...${NC}"
    echo ""
    echo "A browser window will open for authentication."
    echo "Please log in with: dhineshmuthukaruppan@gmail.com"
    echo ""
    read -p "Press Enter to continue with login..."
    render login
fi

echo ""
echo "📦 Preparing deployment..."

# Generate a secure SECRET_KEY if not already set
if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
    echo "Generated SECRET_KEY: ${SECRET_KEY:0:20}..."
fi

# Check if service already exists
echo "Checking for existing services..."
SERVICE_EXISTS=$(render services list -o json 2>/dev/null | grep -i "bulk-shipping-backend" || echo "")

if [ -z "$SERVICE_EXISTS" ]; then
    echo "Creating new service from render.yaml..."
    
    # Check if we need to commit changes first (for Git-based deployment)
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo "Git repository detected. Checking for uncommitted changes..."
        
        # Check if render.yaml is tracked
        if ! git ls-files --error-unmatch render.yaml &> /dev/null; then
            echo "Adding render.yaml to git..."
            git add render.yaml backend/Procfile
        fi
    fi
    
    # Try to create service using blueprint (if supported)
    echo "Attempting to create service using render.yaml blueprint..."
    echo "If this fails, you'll need to create the service via the web dashboard."
    echo ""
    echo "Alternative: Go to https://dashboard.render.com and:"
    echo "1. Click 'New +' → 'Blueprint'"
    echo "2. Connect your repository or upload render.yaml"
    echo "3. Render will create the service and database automatically"
    echo ""
    
    # Try blueprint deployment (may require web interface)
    if command -v render &> /dev/null; then
        echo "Note: Blueprint deployment typically requires the web dashboard."
        echo "Opening Render dashboard..."
        open "https://dashboard.render.com/blueprints/new" 2>/dev/null || \
        echo "Please visit: https://dashboard.render.com/blueprints/new"
    fi
else
    echo -e "${GREEN}✅ Service already exists${NC}"
    echo "Triggering new deployment..."
    
    # Get service ID
    SERVICE_ID=$(render services list -o json 2>/dev/null | grep -i "bulk-shipping-backend" -A 5 | grep '"id"' | head -1 | cut -d'"' -f4 || echo "")
    
    if [ ! -z "$SERVICE_ID" ]; then
        echo "Deploying service: $SERVICE_ID"
        render deploys create "$SERVICE_ID" --wait || echo "Deployment triggered (check dashboard for status)"
    fi
fi

echo ""
echo -e "${GREEN}✅ Deployment process initiated!${NC}"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. If service creation is needed, visit: https://dashboard.render.com"
echo "2. Go to 'New +' → 'Blueprint'"
echo "3. Connect your Git repository or upload the render.yaml file"
echo "4. Render will automatically:"
echo "   - Create the PostgreSQL database"
echo "   - Create the web service"
echo "   - Set up environment variables"
echo "   - Deploy your backend"
echo ""
echo "5. Your backend will be available at:"
echo "   https://bulk-shipping-backend.onrender.com"
echo ""
echo "6. API endpoints will be at:"
echo "   https://bulk-shipping-backend.onrender.com/api/"
echo ""
echo -e "${YELLOW}Note:${NC} Free tier services may take 30-60 seconds to wake up after inactivity."
echo ""
