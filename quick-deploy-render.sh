#!/bin/bash

# Quick Deploy to Render - Automated Script
# This will deploy your backend using Render API

set -e

REPO_URL="https://github.com/dhineshmuthukaruppan/BulkShipment_Application"
BRANCH="dhines_bulk_shipping"

echo "🚀 Deploying Backend to Render"
echo "==============================="
echo ""
echo "Repository: $REPO_URL"
echo "Branch: $BRANCH"
echo ""

# Check for API key
if [ -z "$RENDER_API_KEY" ]; then
    echo "📝 Please provide your Render API Key:"
    echo "   1. Go to: https://dashboard.render.com/u/usr-d5jrihh4tr6s73b219ug/settings"
    echo "   2. Click 'API Keys' in the right sidebar"
    echo "   3. Click 'New API Key'"
    echo "   4. Copy the key"
    echo ""
    read -p "Enter your Render API Key: " RENDER_API_KEY
    echo ""
fi

if [ -z "$RENDER_API_KEY" ]; then
    echo "❌ API Key is required"
    exit 1
fi

echo "✅ API Key provided"
echo ""

# Get owner ID
echo "🔍 Getting owner information..."
OWNER_RESPONSE=$(curl -s -X GET "https://api.render.com/v1/owners" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Accept: application/json")

# Try to extract owner ID
OWNER_ID=$(echo "$OWNER_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and len(data) > 0:
        owner = data[0].get('owner', {})
        print(owner.get('id', ''))
    elif isinstance(data, dict):
        owner = data.get('owner', {})
        print(owner.get('id', ''))
except:
    pass
" 2>/dev/null)

if [ -z "$OWNER_ID" ]; then
    # Try alternative extraction
    OWNER_ID=$(echo "$OWNER_RESPONSE" | grep -oP '"id"\s*:\s*"[^"]+"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$OWNER_ID" ]; then
    echo "❌ Could not get owner ID"
    echo "Response: $OWNER_RESPONSE"
    exit 1
fi

echo "✅ Owner ID: $OWNER_ID"
echo ""

# Read and encode render.yaml
if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml not found!"
    exit 1
fi

echo "📄 Reading render.yaml..."
RENDER_YAML_CONTENT=$(cat render.yaml)

# Create blueprint using Render API
echo "🚀 Creating blueprint deployment..."
echo ""

# Use Python to properly format JSON
BLUEPRINT_JSON=$(python3 <<EOF
import json
import sys

yaml_content = """$RENDER_YAML_CONTENT"""

payload = {
    "ownerId": "$OWNER_ID",
    "blueprintSpec": yaml_content,
    "repo": "$REPO_URL",
    "branch": "$BRANCH"
}

print(json.dumps(payload))
EOF
)

BLUEPRINT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "https://api.render.com/v1/blueprints" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "$BLUEPRINT_JSON")

HTTP_CODE=$(echo "$BLUEPRINT_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$BLUEPRINT_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ Deployment failed (HTTP $HTTP_CODE)"
    echo ""
    echo "Response:"
    echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
    exit 1
fi

# Extract blueprint ID
BLUEPRINT_ID=$(echo "$RESPONSE_BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('id', data.get('blueprint', {}).get('id', '')))
except:
    pass
" 2>/dev/null)

if [ -z "$BLUEPRINT_ID" ]; then
    BLUEPRINT_ID=$(echo "$RESPONSE_BODY" | grep -oP '"id"\s*:\s*"[^"]+"' | head -1 | cut -d'"' -f4)
fi

if [ -n "$BLUEPRINT_ID" ]; then
    echo "✅ Blueprint created successfully!"
    echo "   Blueprint ID: $BLUEPRINT_ID"
    echo ""
    echo "📊 Check deployment status:"
    echo "   https://dashboard.render.com"
    echo ""
    echo "⏳ Deployment in progress..."
    echo "   This may take 5-10 minutes"
    echo ""
    echo "🔗 Your backend will be available at:"
    echo "   https://bulk-shipping-backend.onrender.com"
    echo ""
else
    echo "⚠️  Deployment initiated, but could not get blueprint ID"
    echo "   Check your dashboard: https://dashboard.render.com"
    echo ""
    echo "Response:"
    echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
fi
