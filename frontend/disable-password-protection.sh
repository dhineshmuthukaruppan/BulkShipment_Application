#!/bin/bash

# Script to disable password protection on Vercel deployment
# This uses the Vercel API to remove password protection

PROJECT_ID="prj_CHHhXxXKKmWEKKyio82Wb33XFLtU"
ORG_ID="team_ylO2fQT6C7Y5Q5nmQu0MFcHt"

echo "🔓 Disabling password protection on Vercel deployment..."
echo ""

# Get Vercel token from CLI
TOKEN=$(vercel whoami --token 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo "❌ Could not get Vercel token. Please run 'vercel login' first."
    echo ""
    echo "Alternatively, you can disable password protection manually:"
    echo "1. Go to https://vercel.com/dashboard"
    echo "2. Select your 'frontend' project"
    echo "3. Go to Settings → Deployment Protection"
    echo "4. Disable 'Password Protection'"
    exit 1
fi

echo "📡 Sending API request to disable password protection..."

# Disable password protection via Vercel API
RESPONSE=$(curl -s -X PATCH "https://api.vercel.com/v9/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "passwordProtection": null
  }')

if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Error: $RESPONSE"
    echo ""
    echo "Please disable password protection manually:"
    echo "1. Go to https://vercel.com/dashboard"
    echo "2. Select your 'frontend' project"
    echo "3. Go to Settings → Deployment Protection"
    echo "4. Disable 'Password Protection'"
    exit 1
else
    echo "✅ Password protection disabled successfully!"
    echo ""
    echo "Your deployment should now be publicly accessible."
fi
