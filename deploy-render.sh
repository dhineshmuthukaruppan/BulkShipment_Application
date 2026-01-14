#!/bin/bash

# Deploy Backend to Render using Render API
# This script will deploy your backend using the render.yaml blueprint

set -e

echo "🚀 Render Backend Deployment"
echo "============================="
echo ""

# Check for API key
if [ -z "$RENDER_API_KEY" ]; then
    echo "❌ RENDER_API_KEY environment variable not set"
    echo ""
    echo "📝 To get your API key:"
    echo "1. Go to: https://dashboard.render.com/u/usr-d5jrihh4tr6s73b219ug/settings"
    echo "2. Click on 'API Keys' in the right sidebar"
    echo "3. Click 'New API Key'"
    echo "4. Copy the key"
    echo ""
    echo "Then run:"
    echo "  export RENDER_API_KEY=your_key_here"
    echo "  ./deploy-render.sh"
    echo ""
    exit 1
fi

echo "✅ API Key found"
echo ""

# Get repository URL
if [ -z "$GITHUB_REPO_URL" ]; then
    echo "📦 Enter your GitHub repository URL:"
    echo "   Example: https://github.com/username/BulkShipment_Application"
    read -p "Repository URL: " GITHUB_REPO_URL
fi

if [ -z "$GITHUB_REPO_URL" ]; then
    echo "❌ Repository URL is required"
    exit 1
fi

BRANCH="${GITHUB_BRANCH:-dhines_bulk_shipping}"

echo "🌿 Branch: $BRANCH"
echo ""

# Read render.yaml
if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml not found!"
    exit 1
fi

echo "📄 Reading render.yaml..."
BLUEPRINT_SPEC=$(cat render.yaml | base64)

# Get owner ID
echo "🔍 Getting owner information..."
OWNER_RESPONSE=$(curl -s -X GET "https://api.render.com/v1/owners" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Accept: application/json")

OWNER_ID=$(echo "$OWNER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$OWNER_ID" ]; then
    echo "❌ Could not get owner ID. Response:"
    echo "$OWNER_RESPONSE"
    exit 1
fi

echo "✅ Owner ID: $OWNER_ID"
echo ""

# Create blueprint
echo "🚀 Creating blueprint deployment..."
echo "   Repository: $GITHUB_REPO_URL"
echo "   Branch: $BRANCH"
echo ""

BLUEPRINT_RESPONSE=$(curl -s -X POST "https://api.render.com/v1/blueprints" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{
    \"ownerId\": \"$OWNER_ID\",
    \"blueprintSpec\": $(cat render.yaml | jq -Rs .),
    \"repo\": \"$GITHUB_REPO_URL\",
    \"branch\": \"$BRANCH\"
  }")

# Check if jq is available, if not use alternative method
if command -v jq &> /dev/null; then
    BLUEPRINT_ID=$(echo "$BLUEPRINT_RESPONSE" | jq -r '.id // .blueprint.id // empty')
    ERROR=$(echo "$BLUEPRINT_RESPONSE" | jq -r '.error.message // .message // empty')
else
    BLUEPRINT_ID=$(echo "$BLUEPRINT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    ERROR=$(echo "$BLUEPRINT_RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -n "$ERROR" ]; then
    echo "❌ Error creating blueprint: $ERROR"
    echo ""
    echo "Full response:"
    echo "$BLUEPRINT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BLUEPRINT_RESPONSE"
    exit 1
fi

if [ -z "$BLUEPRINT_ID" ]; then
    echo "❌ Could not create blueprint. Response:"
    echo "$BLUEPRINT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BLUEPRINT_RESPONSE"
    exit 1
fi

echo "✅ Blueprint created successfully!"
echo "   Blueprint ID: $BLUEPRINT_ID"
echo ""
echo "📊 Deployment Status:"
echo "   Dashboard: https://dashboard.render.com"
echo ""
echo "⏳ Your backend is being deployed..."
echo "   This may take 5-10 minutes"
echo ""
echo "🔗 Your backend will be available at:"
echo "   https://bulk-shipping-backend.onrender.com"
echo ""
