#!/bin/bash

# Deploy Backend to Render - Direct Service Creation
# This creates services directly via Render API

set -e

REPO_URL="https://github.com/dhineshmuthukaruppan/BulkShipment_Application"
BRANCH="dhines_bulk_shipping"
OWNER_ID="tea-d5jrihh4tr6s73b219p0"
API_KEY="${RENDER_API_KEY:-rnd_sMJ3dnLqGZjnWEWICqh6a7jwKD70}"

echo "🚀 Deploying Backend to Render (Direct Method)"
echo "=============================================="
echo ""

# Step 1: Create PostgreSQL Database
echo "📦 Step 1: Creating PostgreSQL Database..."
DB_RESPONSE=$(curl -s -X POST "https://api.render.com/v1/databases" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"bulk-shipping-db\",
    \"plan\": \"free\",
    \"databaseName\": \"shipping_db\",
    \"databaseUser\": \"shipping_user\",
    \"ownerId\": \"$OWNER_ID\"
  }")

DB_ID=$(echo "$DB_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('database', {}).get('id', data.get('id', '')))
except Exception as e:
    print('')
" 2>/dev/null)

if [ -z "$DB_ID" ]; then
    # Check if database already exists
    echo "⚠️  Database might already exist, checking existing databases..."
    EXISTING_DBS=$(curl -s -X GET "https://api.render.com/v1/databases?ownerId=$OWNER_ID" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Accept: application/json")
    
    DB_ID=$(echo "$EXISTING_DBS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        for db in data:
            if db.get('name') == 'bulk-shipping-db':
                print(db.get('id', ''))
                break
except:
    pass
" 2>/dev/null)
    
    if [ -z "$DB_ID" ]; then
        echo "❌ Could not create or find database"
        echo "Response: $DB_RESPONSE"
        exit 1
    else
        echo "✅ Using existing database: $DB_ID"
    fi
else
    echo "✅ Database created: $DB_ID"
fi

echo ""

# Step 2: Get database connection details
echo "🔍 Step 2: Getting database connection details..."
DB_INFO=$(curl -s -X GET "https://api.render.com/v1/databases/$DB_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json")

DB_HOST=$(echo "$DB_INFO" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    db = data.get('database', data)
    print(db.get('host', ''))
except:
    pass
" 2>/dev/null)

DB_PORT=$(echo "$DB_INFO" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    db = data.get('database', data)
    print(db.get('port', '5432'))
except:
    pass
" 2>/dev/null)

echo "✅ Database Host: $DB_HOST"
echo ""

# Step 3: Create Web Service
echo "🚀 Step 3: Creating Web Service..."
SERVICE_RESPONSE=$(curl -s -X POST "https://api.render.com/v1/services" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"bulk-shipping-backend\",
    \"type\": \"web_service\",
    \"ownerId\": \"$OWNER_ID\",
    \"repo\": \"$REPO_URL\",
    \"branch\": \"$BRANCH\",
    \"rootDir\": \"backend\",
    \"env\": \"python\",
    \"plan\": \"free\",
    \"buildCommand\": \"pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate\",
    \"startCommand\": \"cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:\\\$PORT --workers 2 --timeout 120\",
    \"envVars\": [
      {
        \"key\": \"PYTHON_VERSION\",
        \"value\": \"3.11.0\"
      },
      {
        \"key\": \"SECRET_KEY\",
        \"generateValue\": true
      },
      {
        \"key\": \"DEBUG\",
        \"value\": \"False\"
      },
      {
        \"key\": \"ALLOWED_HOSTS\",
        \"value\": \"bulk-shipping-backend.onrender.com,*.onrender.com\"
      },
      {
        \"key\": \"DB_NAME\",
        \"value\": \"shipping_db\"
      },
      {
        \"key\": \"DB_USER\",
        \"value\": \"shipping_user\"
      },
      {
        \"key\": \"DB_PASSWORD\",
        \"fromDatabase\": {
          \"name\": \"bulk-shipping-db\",
          \"property\": \"password\"
        }
      },
      {
        \"key\": \"DB_HOST\",
        \"fromDatabase\": {
          \"name\": \"bulk-shipping-db\",
          \"property\": \"host\"
        }
      },
      {
        \"key\": \"DB_PORT\",
        \"fromDatabase\": {
          \"name\": \"bulk-shipping-db\",
          \"property\": \"port\"
        }
      },
      {
        \"key\": \"CORS_ALLOWED_ORIGINS\",
        \"value\": \"https://frontend-phi-three-66.vercel.app,https://frontend-o94p5b365-dhineshmuthukaruppan-9911s-projects.vercel.app,https://frontend-h31p0mom3-dhineshmuthukaruppan-9911s-projects.vercel.app\"
      }
    ]
  }")

SERVICE_ID=$(echo "$SERVICE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('service', {}).get('id', data.get('id', '')))
except Exception as e:
    print('')
" 2>/dev/null)

if [ -z "$SERVICE_ID" ]; then
    # Check if service already exists
    echo "⚠️  Service might already exist, checking existing services..."
    EXISTING_SERVICES=$(curl -s -X GET "https://api.render.com/v1/services?ownerId=$OWNER_ID" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Accept: application/json")
    
    SERVICE_ID=$(echo "$EXISTING_SERVICES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        for svc in data:
            if svc.get('name') == 'bulk-shipping-backend':
                print(svc.get('id', ''))
                break
except:
    pass
" 2>/dev/null)
    
    if [ -z "$SERVICE_ID" ]; then
        echo "❌ Could not create service"
        echo "Response: $SERVICE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SERVICE_RESPONSE"
        exit 1
    else
        echo "✅ Using existing service: $SERVICE_ID"
    fi
else
    echo "✅ Service created: $SERVICE_ID"
fi

echo ""
echo "✅ Deployment initiated successfully!"
echo ""
echo "📊 Check deployment status:"
echo "   https://dashboard.render.com"
echo ""
echo "⏳ Your backend is being deployed..."
echo "   This may take 5-10 minutes"
echo ""
echo "🔗 Your backend will be available at:"
echo "   https://bulk-shipping-backend.onrender.com"
echo ""
