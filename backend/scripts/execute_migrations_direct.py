#!/usr/bin/env python3
"""Execute migrations directly via Supabase connection string."""

import os
import sys
from pathlib import Path

# Try psycopg2
try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("Installing psycopg2-binary...")
    os.system("pip install psycopg2-binary -q")
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Connection via pooler
DB_URI = "postgresql://postgres.kolgqfjgncdwddziqloz:Chartres6693!23$@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

def execute_sql_file(sql_file: Path):
    """Execute SQL from file."""
    print(f"\nExecuting {sql_file.name}...")
    
    try:
        conn = psycopg2.connect(DB_URI)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        sql = sql_file.read_text()
        cursor.execute(sql)
        
        print(f"SUCCESS: {sql_file.name} executed!")
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def main():
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    migrations_dir = backend_dir / "db" / "migrations"
    
    migration004 = migrations_dir / "004_rate_limit_requests.sql"
    migration005 = migrations_dir / "005_find_stale_jobs_function.sql"
    
    print("Executing Database Migrations for Audit Fixes")
    print("=" * 60)
    
    success = True
    success &= execute_sql_file(migration004)
    success &= execute_sql_file(migration005)
    
    if success:
        print("\nAll migrations executed successfully!")
    else:
        print("\nSome migrations failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

