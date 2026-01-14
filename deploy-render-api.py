#!/usr/bin/env python3
"""
Deploy to Render using the Render API
This script will create and deploy your backend service to Render
"""

import requests
import json
import sys
import os

# Render API base URL
RENDER_API_BASE = "https://api.render.com/v1"

def get_api_key():
    """Get Render API key from environment or prompt user"""
    api_key = os.getenv('RENDER_API_KEY')
    if not api_key:
        print("❌ RENDER_API_KEY environment variable not set")
        print("\n📝 To get your API key:")
        print("1. Go to: https://dashboard.render.com/u/usr-d5jrihh4tr6s73b219ug/settings")
        print("2. Click on 'API Keys' in the right sidebar")
        print("3. Create a new API key")
        print("4. Export it: export RENDER_API_KEY=your_key_here")
        print("\nOr run this script with: RENDER_API_KEY=your_key python3 deploy-render-api.py")
        sys.exit(1)
    return api_key

def make_request(method, endpoint, api_key, data=None):
    """Make API request to Render"""
    url = f"{RENDER_API_BASE}{endpoint}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"❌ API Error: {e}")
        if hasattr(e.response, 'text'):
            print(f"Response: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def get_owner_id(api_key):
    """Get the owner ID (user or team)"""
    print("🔍 Getting owner information...")
    user_info = make_request("GET", "/owners", api_key)
    if user_info and len(user_info) > 0:
        owner_id = user_info[0].get('owner', {}).get('id')
        print(f"✅ Found owner: {owner_id}")
        return owner_id
    else:
        print("❌ Could not find owner ID")
        sys.exit(1)

def create_blueprint(api_key, owner_id, repo_url, branch="dhines_bulk_shipping"):
    """Create a blueprint deployment from render.yaml"""
    print(f"\n🚀 Creating blueprint deployment from {repo_url}...")
    
    # Read render.yaml
    render_yaml_path = "render.yaml"
    if not os.path.exists(render_yaml_path):
        print(f"❌ {render_yaml_path} not found!")
        sys.exit(1)
    
    with open(render_yaml_path, 'r') as f:
        blueprint_spec = f.read()
    
    data = {
        "ownerId": owner_id,
        "blueprintSpec": blueprint_spec,
        "repo": repo_url,
        "branch": branch
    }
    
    result = make_request("POST", "/blueprints", api_key, data)
    print(f"✅ Blueprint created: {result.get('id')}")
    return result

def main():
    print("🚀 Render Backend Deployment via API")
    print("=" * 50)
    
    # Get API key
    api_key = get_api_key()
    
    # Get owner ID
    owner_id = get_owner_id(api_key)
    
    # Get repository URL
    repo_url = input("\n📦 Enter your GitHub repository URL (e.g., https://github.com/username/BulkShipment_Application): ").strip()
    if not repo_url:
        print("❌ Repository URL is required")
        sys.exit(1)
    
    branch = input("🌿 Enter branch name (default: dhines_bulk_shipping): ").strip() or "dhines_bulk_shipping"
    
    # Create blueprint
    blueprint = create_blueprint(api_key, owner_id, repo_url, branch)
    
    print("\n✅ Deployment initiated!")
    print(f"📊 Check status at: https://dashboard.render.com")
    print(f"🔗 Blueprint ID: {blueprint.get('id')}")

if __name__ == "__main__":
    main()
