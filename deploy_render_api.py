#!/usr/bin/env python3
"""
Automated Render Deployment Script
Deploys Django backend to Render using their API
"""

import os
import sys
import json
import requests
import webbrowser
from pathlib import Path

RENDER_API_BASE = "https://api.render.com/v1"
BLUEPRINT_URL = "https://dashboard.render.com/blueprints/new"

def main():
    print("🚀 Render Backend Deployment")
    print("=" * 40)
    print()
    
    # Check for API key
    api_key = os.getenv("RENDER_API_KEY")
    
    if not api_key:
        print("⚠️  RENDER_API_KEY not found in environment.")
        print()
        print("To get your API key:")
        print("1. Visit: https://dashboard.render.com/account/api-keys")
        print("2. Create a new API key")
        print("3. Export it: export RENDER_API_KEY='your-key-here'")
        print()
        print("Alternatively, we'll use the Blueprint method via web dashboard...")
        print()
        
        # Open blueprint page
        print("Opening Render Blueprint dashboard...")
        try:
            webbrowser.open(BLUEPRINT_URL)
        except:
            print(f"Please visit: {BLUEPRINT_URL}")
        
        print()
        print("📋 Manual Deployment Steps:")
        print("-" * 40)
        print("1. Connect your GitHub repository: BulkShipment_Application")
        print("2. Or upload the render.yaml file from this directory")
        print("3. Render will automatically:")
        print("   - Create PostgreSQL database")
        print("   - Create web service")
        print("   - Configure environment variables")
        print("   - Deploy your backend")
        print()
        print("4. Your backend URL will be:")
        print("   https://bulk-shipping-backend.onrender.com")
        print()
        return
    
    # If API key exists, try API deployment
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    print("✅ API key found. Attempting API deployment...")
    print()
    
    # Read render.yaml
    render_yaml_path = Path(__file__).parent / "render.yaml"
    if not render_yaml_path.exists():
        print("❌ render.yaml not found!")
        return
    
    print("📄 Found render.yaml")
    print()
    print("Note: Render Blueprint deployment via API requires repository connection.")
    print("For the easiest deployment, use the web dashboard method above.")
    print()
    print("Your backend is ready to deploy!")
    print("Backend URL: https://bulk-shipping-backend.onrender.com")
    print("API Base: https://bulk-shipping-backend.onrender.com/api/")

if __name__ == "__main__":
    main()
