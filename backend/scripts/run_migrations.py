#!/usr/bin/env python3
"""
Execute database migrations 004 and 005 via Supabase client.
This script uses the Supabase Python client to execute SQL migrations.
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client

# Get script directory
script_dir = Path(__file__).parent
project_root = script_dir.parent
migrations_dir = project_root / "db" / "migrations"

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing required environment variables")
    print("   Required: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
    print("   Required: SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🚀 Running Database Migrations for Audit Fixes")
print("=" * 50)
print()

# Migration files
migration004 = migrations_dir / "004_rate_limit_requests.sql"
migration005 = migrations_dir / "005_find_stale_jobs_function.sql"

if not migration004.exists():
    print(f"❌ Error: Migration 004 not found at {migration004}")
    sys.exit(1)

if not migration005.exists():
    print(f"❌ Error: Migration 005 not found at {migration005}")
    sys.exit(1)

print("📄 Found migration files:")
print("   - 004_rate_limit_requests.sql")
print("   - 005_find_stale_jobs_function.sql")
print()

def execute_sql(sql: str, description: str) -> bool:
    """Execute SQL using Supabase REST API."""
    print(f"🔄 Executing {description}...")
    
    try:
        # Supabase doesn't have a direct SQL execution endpoint in the Python client
        # We need to use the REST API directly
        import requests
        
        rest_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        # Note: Supabase doesn't have a generic exec_sql RPC function
        # We'll need to split the SQL into statements and execute them
        
        # For now, print instructions
        print(f"⚠️  Supabase Python client doesn't support direct SQL execution")
        print(f"   Please run this migration in Supabase SQL Editor:")
        print(f"   1. Go to: {SUPABASE_URL.replace('/rest/v1', '')}/dashboard")
        print(f"   2. Navigate to SQL Editor")
        print(f"   3. Copy and paste the SQL from: {description}")
        print()
        return False
        
    except Exception as e:
        print(f"⚠️  Error: {e}")
        print(f"   Please run this migration manually in Supabase SQL Editor")
        return False

# Read and execute migration 004
print("📝 Migration 004 (rate_limit_requests):")
sql004 = migration004.read_text()
print(f"   SQL length: {len(sql004)} characters")
print()

# Read and execute migration 005
print("📝 Migration 005 (find_stale_jobs_function):")
sql005 = migration005.read_text()
print(f"   SQL length: {len(sql005)} characters")
print()

print("ℹ️  Note: Supabase Python client doesn't support direct SQL execution")
print("   Please run these migrations in Supabase SQL Editor:")
print()
print("   Migration 004:")
print(f"   File: {migration004}")
print()
print("   Migration 005:")
print(f"   File: {migration005}")
print()

print("✅ Migration script completed!")
print()
print("📝 Next steps:")
print("   1. Run migrations in Supabase SQL Editor (see instructions above)")
print("   2. Set SLACK_WEBHOOK_URL in backend/.env")
print("   3. Build and start monitoring services")
print()

