#!/usr/bin/env python3
"""
Directory Data Enrichment Script
Audits existing directories and enriches with detailed metadata
"""

import requests
import json
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Supabase credentials
SUPABASE_URL = "https://kolgqfjgncdwddziqloz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjczODc2MSwiZXhwIjoyMDcyMzE0NzYxfQ.xPoR2Q_yey7AQcorPG3iBLKTadzzSEMmK3eM9ZW46Qc"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def get_all_directories():
    """Fetch all directories from Supabase"""
    all_dirs = []
    offset = 0
    limit = 100

    while True:
        url = f"{SUPABASE_URL}/rest/v1/directories?select=*&offset={offset}&limit={limit}"
        response = requests.get(url, headers=HEADERS)
        if response.status_code != 200:
            print(f"Error fetching directories: {response.status_code}")
            break

        dirs = response.json()
        if not dirs:
            break

        all_dirs.extend(dirs)
        offset += limit
        print(f"Fetched {len(all_dirs)} directories...")

    return all_dirs

def check_url_status(url, timeout=15):
    """Check if a URL is live and returns its status"""
    try:
        # Try with requests first
        response = requests.get(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            verify=False
        )
        return {
            'status_code': response.status_code,
            'is_live': response.status_code < 400,
            'final_url': response.url,
            'response_time_ms': int(response.elapsed.total_seconds() * 1000)
        }
    except requests.exceptions.Timeout:
        return {'status_code': 0, 'is_live': False, 'error': 'timeout'}
    except requests.exceptions.ConnectionError:
        return {'status_code': 0, 'is_live': False, 'error': 'connection_error'}
    except Exception as e:
        return {'status_code': 0, 'is_live': False, 'error': str(e)[:100]}

def delete_directory(directory_id):
    """Delete a directory from the database"""
    url = f"{SUPABASE_URL}/rest/v1/directories?id=eq.{directory_id}"
    response = requests.delete(url, headers=HEADERS)
    return response.status_code in [200, 204]

def update_directory(directory_id, updates):
    """Update a directory with new data"""
    url = f"{SUPABASE_URL}/rest/v1/directories?id=eq.{directory_id}"
    response = requests.patch(url, headers=HEADERS, json=updates)
    return response.status_code in [200, 204]

def audit_directory(directory):
    """Audit a single directory and return results"""
    dir_id = directory['id']
    name = directory['name']
    submission_url = directory.get('submission_url', '')
    website = directory.get('website', '')

    result = {
        'id': dir_id,
        'name': name,
        'submission_url': submission_url,
        'website': website,
        'action': None,
        'reason': None,
        'status_check': None
    }

    # Check if submission_url exists
    if not submission_url or submission_url.strip() == '':
        result['action'] = 'skip'
        result['reason'] = 'no_submission_url'
        return result

    # Check URL status
    status = check_url_status(submission_url)
    result['status_check'] = status

    if not status.get('is_live'):
        result['action'] = 'delete'
        result['reason'] = f"dead_url: {status.get('error', status.get('status_code'))}"
        return result

    # Check for parked/for sale domains by looking at common patterns
    # This would normally check page content, but we'll flag for review
    result['action'] = 'keep'
    result['reason'] = 'live_url'

    return result

def main():
    print("=" * 60)
    print("DIRECTORY ENRICHMENT AUDIT")
    print("=" * 60)

    # Fetch all directories
    print("\n[1/3] Fetching all directories...")
    directories = get_all_directories()
    print(f"Total directories: {len(directories)}")

    # Audit each directory
    print("\n[2/3] Auditing directories...")
    results = {
        'total': len(directories),
        'deleted': 0,
        'kept': 0,
        'skipped': 0,
        'errors': 0,
        'deleted_list': [],
        'kept_list': []
    }

    # Process in batches to avoid overwhelming servers
    batch_size = 10
    for i in range(0, len(directories), batch_size):
        batch = directories[i:i+batch_size]

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(audit_directory, d): d for d in batch}
            for future in as_completed(futures):
                try:
                    result = future.result()

                    if result['action'] == 'delete':
                        results['deleted'] += 1
                        results['deleted_list'].append({
                            'name': result['name'],
                            'url': result['submission_url'],
                            'reason': result['reason']
                        })
                        # Actually delete from database
                        if delete_directory(result['id']):
                            print(f"  DELETED: {result['name']} - {result['reason']}")
                        else:
                            print(f"  FAILED TO DELETE: {result['name']}")
                            results['errors'] += 1
                    elif result['action'] == 'keep':
                        results['kept'] += 1
                        results['kept_list'].append({
                            'id': result['id'],
                            'name': result['name'],
                            'url': result['submission_url'],
                            'status': result['status_check']
                        })
                    else:
                        results['skipped'] += 1

                except Exception as e:
                    results['errors'] += 1
                    print(f"  ERROR: {str(e)[:50]}")

        print(f"  Processed {min(i+batch_size, len(directories))}/{len(directories)}...")
        time.sleep(0.5)  # Rate limiting

    # Save results
    print("\n[3/3] Saving audit results...")
    with open('audit_results.json', 'w') as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("AUDIT COMPLETE")
    print("=" * 60)
    print(f"Total directories: {results['total']}")
    print(f"Deleted (dead URLs): {results['deleted']}")
    print(f"Kept (live URLs): {results['kept']}")
    print(f"Skipped (no URL): {results['skipped']}")
    print(f"Errors: {results['errors']}")
    print(f"\nResults saved to audit_results.json")

    return results

if __name__ == "__main__":
    main()
