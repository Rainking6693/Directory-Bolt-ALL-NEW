#!/usr/bin/env python3
"""
Setup script for Directory Submission Automation
Run this once to install dependencies and configure the environment
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


def run_command(cmd, description):
    """Run a shell command with status output"""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"Warning: {description} may have failed")
    return result.returncode == 0


def main():
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║     Directory Submission Automation - Setup Script        ║
    ║                                                           ║
    ║     Stack: Playwright + Gemini Flash + NopeCHA            ║
    ║     Cost: $0 (100% Free)                                  ║
    ╚═══════════════════════════════════════════════════════════╝
    """)

    base_dir = Path(__file__).parent

    # Step 1: Install Python dependencies
    print("\n[1/5] Installing Python dependencies...")
    run_command(
        f"pip install -r {base_dir / 'requirements.txt'}",
        "Installing Python packages"
    )

    # Step 2: Install Playwright browsers
    print("\n[2/5] Installing Playwright browsers...")
    run_command(
        "playwright install chromium",
        "Installing Chromium browser"
    )

    # Step 3: Create directories
    print("\n[3/5] Creating directories...")
    (base_dir / "extensions" / "nopecha").mkdir(parents=True, exist_ok=True)
    (base_dir / "screenshots").mkdir(parents=True, exist_ok=True)
    print("  Created: extensions/nopecha/")
    print("  Created: screenshots/")

    # Step 4: Check environment variables
    print("\n[4/5] Checking environment variables...")
    from dotenv import load_dotenv
    load_dotenv(base_dir.parent.parent / ".env")  # Load from project root

    env_vars = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
    }

    all_set = True
    for var, value in env_vars.items():
        if value:
            print(f"  ✓ {var} is set")
        else:
            print(f"  ✗ {var} is NOT set")
            all_set = False

    if not all_set:
        print("\n  Warning: Some environment variables are missing!")
        print("  Please set them in your .env file")

    # Step 5: NopeCHA setup instructions
    print("\n[5/5] NopeCHA Extension Setup...")
    nopecha_path = base_dir / "extensions" / "nopecha"

    if list(nopecha_path.glob("*")):
        print("  ✓ NopeCHA extension found")
    else:
        print("""
  ⚠ NopeCHA extension not found!

  To enable free CAPTCHA solving:

  1. Go to: https://nopecha.com/
  2. Click "Add to Chrome" or download the CRX file
  3. If using CRX, extract contents to:
     {nopecha_path}

  The extension folder should contain:
  - manifest.json
  - background.js
  - content scripts, etc.

  Without NopeCHA:
  - 113 directories (no CAPTCHA) will work fine
  - 96 directories (with CAPTCHA) will be skipped

  You can also use Buster extension as an alternative:
  https://github.com/nickytonline/buster
        """)

    # Summary
    print(f"""
    ╔═══════════════════════════════════════════════════════════╗
    ║                    Setup Complete!                        ║
    ╚═══════════════════════════════════════════════════════════╝

    Quick Start:

    1. Test with 5 easy directories:
       python cron_runner.py test \\
         --name "My Startup" \\
         --url "https://mystartup.com" \\
         --email "hello@mystartup.com" \\
         --description "We build amazing tools"

    2. Run full submission (all 209 directories):
       python cron_runner.py manual \\
         --name "My Startup" \\
         --url "https://mystartup.com" \\
         --email "hello@mystartup.com" \\
         --description "We build amazing tools" \\
         --parallel 3

    3. Process pending jobs from database:
       python cron_runner.py cron

    Files created:
    - {base_dir / 'directory_submitter.py'}
    - {base_dir / 'cron_runner.py'}
    - {base_dir / 'requirements.txt'}
    - {base_dir / 'README.md'}
    """)


if __name__ == "__main__":
    main()
