#!/usr/bin/env python3
"""
Comprehensive Directory Audit Script
Checks URL validity and categorizes directories for action
"""

import requests
import json
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib3
import re
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

SUPABASE_URL = "https://kolgqfjgncdwddziqloz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjczODc2MSwiZXhwIjoyMDcyMzE0NzYxfQ.xPoR2Q_yey7AQcorPG3iBLKTadzzSEMmK3eM9ZW46Qc"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Known non-directory sites (news sites, blogs, etc. that don't accept submissions)
NON_DIRECTORY_SITES = [
    'time.com', 'huffpost.com', 'huffingtonpost.com', 'theguardian.com',
    'techcrunch.com', 'forbes.com', 'businessinsider.com', 'nytimes.com',
    'washingtonpost.com', 'bbc.com', 'cnn.com', 'reuters.com', 'bloomberg.com',
    'wired.com', 'mashable.com', 'theverge.com', 'engadget.com', 'zdnet.com',
    'venturebeat.com', 'thenextweb.com', 'gizmodo.com', 'lifehacker.com',
    'inc.com', 'fastcompany.com', 'entrepreneur.com'
]

# Sites that require non-automatable verification
NON_AUTOMATABLE_SITES = [
    'google.com/business',  # Requires phone/mail verification
    'bing.com/places',  # Similar verification
    'apple.com/maps',  # Requires Apple ID verification
]

def get_all_directories():
    """Fetch all directories"""
    all_dirs = []
    offset = 0
    limit = 100

    while True:
        url = f"{SUPABASE_URL}/rest/v1/directories?select=*&offset={offset}&limit={limit}"
        response = requests.get(url, headers=HEADERS)
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            break
        dirs = response.json()
        if not dirs:
            break
        all_dirs.extend(dirs)
        offset += limit

    return all_dirs

def check_url(url, timeout=10):
    """Check URL status"""
    if not url or url.strip() == '' or url == 'None':
        return {'is_live': False, 'status_code': 0, 'error': 'empty_url'}

    try:
        response = requests.get(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'},
            verify=False
        )
        return {
            'is_live': response.status_code < 400,
            'status_code': response.status_code,
            'final_url': response.url,
            'response_time_ms': int(response.elapsed.total_seconds() * 1000)
        }
    except requests.exceptions.Timeout:
        return {'is_live': False, 'status_code': 0, 'error': 'timeout'}
    except Exception as e:
        return {'is_live': False, 'status_code': 0, 'error': str(e)[:50]}

def analyze_directory(d):
    """Analyze a single directory"""
    name = d['name']
    submission_url = d.get('submission_url')
    website = d.get('website', '')

    result = {
        'id': d['id'],
        'name': name,
        'submission_url': submission_url,
        'website': website,
        'category': d.get('category'),
        'domain_authority': d.get('domain_authority'),
        'action': 'keep',
        'reason': 'valid'
    }

    # Check for empty/None submission URL
    if not submission_url or submission_url == 'None' or submission_url.strip() == '':
        result['action'] = 'delete'
        result['reason'] = 'no_submission_url'
        return result

    # Check for news sites (not real directories)
    for site in NON_DIRECTORY_SITES:
        if site in submission_url.lower():
            result['action'] = 'delete'
            result['reason'] = f'news_site_not_directory: {site}'
            return result

    # Check for non-automatable sites
    for site in NON_AUTOMATABLE_SITES:
        if site in submission_url.lower():
            result['action'] = 'delete'
            result['reason'] = f'non_automatable: {site}'
            return result

    # Check if URL looks like a fake "/submit" append
    if submission_url.endswith('/submit') or submission_url.endswith('/submit/'):
        # Many of these are just the website + /submit which doesn't exist
        base_domain = submission_url.replace('/submit/', '').replace('/submit', '')
        if base_domain == website or base_domain == website.rstrip('/'):
            result['needs_url_check'] = True

    # URL status check
    status = check_url(submission_url)
    result['url_status'] = status

    if not status.get('is_live'):
        result['action'] = 'delete'
        result['reason'] = f"dead_url: {status.get('error', status.get('status_code', 'unknown'))}"
        return result

    return result

def delete_directory(dir_id):
    """Delete a directory"""
    url = f"{SUPABASE_URL}/rest/v1/directories?id=eq.{dir_id}"
    response = requests.delete(url, headers=HEADERS)
    return response.status_code in [200, 204, 404]

def main():
    print("=" * 70)
    print("COMPREHENSIVE DIRECTORY AUDIT")
    print("=" * 70)

    # Get all directories
    print("\nFetching all directories...")
    directories = get_all_directories()
    print(f"Total directories: {len(directories)}")

    # Results tracking
    to_delete = []
    to_keep = []
    processed = 0

    print("\nAnalyzing directories...")

    # Process in batches
    batch_size = 20
    for i in range(0, len(directories), batch_size):
        batch = directories[i:i+batch_size]

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(analyze_directory, d): d for d in batch}
            for future in as_completed(futures):
                try:
                    result = future.result()
                    processed += 1

                    if result['action'] == 'delete':
                        to_delete.append(result)
                        print(f"  [{processed}/{len(directories)}] DELETE: {result['name']} - {result['reason']}")
                    else:
                        to_keep.append(result)

                except Exception as e:
                    print(f"  ERROR: {str(e)[:50]}")

        # Progress update every batch
        if (i + batch_size) % 100 == 0 or i + batch_size >= len(directories):
            print(f"\n  Progress: {min(i+batch_size, len(directories))}/{len(directories)} | Delete: {len(to_delete)} | Keep: {len(to_keep)}")

        time.sleep(0.3)  # Rate limiting

    # Save analysis before deletion
    print("\nSaving analysis results...")
    with open('audit_analysis.json', 'w') as f:
        json.dump({
            'total': len(directories),
            'to_delete': len(to_delete),
            'to_keep': len(to_keep),
            'delete_list': to_delete,
            'keep_list': to_keep
        }, f, indent=2)

    print(f"\nAnalysis complete. Results saved to audit_analysis.json")
    print(f"  - Total: {len(directories)}")
    print(f"  - To Delete: {len(to_delete)}")
    print(f"  - To Keep: {len(to_keep)}")

    return {'to_delete': to_delete, 'to_keep': to_keep}

if __name__ == "__main__":
    main()
