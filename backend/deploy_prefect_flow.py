#!/usr/bin/env python3
"""
Deploy Prefect flow to cloud or self-hosted Prefect server.

This script registers the process_job flow as a deployment that can be triggered
by the SQS subscriber service.

Usage:
    python deploy_prefect_flow.py [--api-url URL] [--api-key KEY] [--pool POOL]

Environment Variables:
    PREFECT_API_URL - Prefect server/cloud URL (required)
    PREFECT_API_KEY - Prefect API key for authentication (optional)
    PREFECT_WORK_POOL - Work pool name (default: "default")
"""

import os
import sys
import argparse
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from prefect import flow
from prefect.deployments import Deployment


def deploy_flow():
    """Deploy the process_job flow to Prefect."""

    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Deploy Prefect flow")
    parser.add_argument("--api-url", help="Prefect API URL")
    parser.add_argument("--api-key", help="Prefect API key")
    parser.add_argument("--pool", default="default", help="Work pool name (default: default)")
    parser.add_argument("--name", default="production", help="Deployment name suffix (default: production)")

    args = parser.parse_args()

    # Get configuration from environment or args
    api_url = args.api_url or os.getenv("PREFECT_API_URL")
    api_key = args.api_key or os.getenv("PREFECT_API_KEY")
    work_pool = args.pool or os.getenv("PREFECT_WORK_POOL", "default")
    deployment_name_suffix = args.name

    if not api_url:
        print("ERROR: PREFECT_API_URL not provided")
        print("Usage: python deploy_prefect_flow.py --api-url <url> [--api-key <key>] [--pool <pool>]")
        print("Or set PREFECT_API_URL environment variable")
        sys.exit(1)

    print(f"Deploying process_job flow...")
    print(f"  API URL: {api_url}")
    print(f"  Work Pool: {work_pool}")
    print(f"  Deployment Name: process_job/{deployment_name_suffix}")

    # Import the flow
    try:
        from orchestration.flows import process_job
        print("✅ Successfully imported process_job flow")
    except ImportError as e:
        print(f"ERROR: Failed to import process_job flow: {e}")
        sys.exit(1)

    # Create deployment
    try:
        deployment = Deployment.build_from_flow(
            flow=process_job,
            name=f"{deployment_name_suffix}",
            work_pool_name=work_pool,
            tags=["production", "autobolt"],
            parameters={}  # Default parameters (overridden at runtime)
        )

        print(f"✅ Deployment object created")
        print(f"   - Flow: {process_job.name}")
        print(f"   - Deployment Name: {deployment.name}")
        print(f"   - Work Pool: {work_pool}")

    except Exception as e:
        print(f"ERROR: Failed to create deployment: {e}")
        sys.exit(1)

    # Deploy to server
    try:
        deployment_id = deployment.apply()
        print(f"✅ Deployment applied successfully!")
        print(f"   Deployment ID: {deployment_id}")
        print(f"\nDeployment is now ready for use.")
        print(f"Subscriber will trigger: process_job/{deployment_name_suffix}")

    except Exception as e:
        print(f"ERROR: Failed to deploy: {e}")
        print(f"\nTroubleshooting:")
        print(f"  1. Verify PREFECT_API_URL is correct: {api_url}")
        print(f"  2. If using Prefect Cloud, verify PREFECT_API_KEY is valid")
        print(f"  3. Ensure work pool '{work_pool}' exists in Prefect")
        print(f"  4. Check Prefect server logs for errors")
        sys.exit(1)


if __name__ == "__main__":
    deploy_flow()
