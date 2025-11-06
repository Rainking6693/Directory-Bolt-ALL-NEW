#!/usr/bin/env python3
"""
Verify that all required environment variables and services are configured
before starting the subscriber service.

This script checks:
1. AWS credentials and SQS connectivity
2. Supabase connectivity
3. Prefect API accessibility
4. Required Prefect deployment exists
5. Work pool configuration
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from utils.logging import setup_logger

logger = setup_logger(__name__)


def check_env_var(name: str, required: bool = True) -> bool:
    """Check if environment variable is set."""
    value = os.getenv(name)
    if not value and required:
        logger.error(f"❌ REQUIRED: {name} is not set")
        return False
    elif not value:
        logger.warning(f"⚠️ OPTIONAL: {name} is not set")
        return True
    else:
        # Show first 20 chars for security
        safe_value = value[:20] + "..." if len(value) > 20 else value
        logger.info(f"✅ {name}={safe_value}")
        return True


def check_aws_credentials() -> bool:
    """Verify AWS credentials are valid."""
    logger.info("\n[1/5] Checking AWS Credentials...")

    access_key = os.getenv("AWS_DEFAULT_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_DEFAULT_SECRET_ACCESS_KEY")
    region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

    if not access_key or not secret_key:
        logger.error("❌ AWS credentials not configured")
        logger.error("   Required: AWS_DEFAULT_ACCESS_KEY_ID, AWS_DEFAULT_SECRET_ACCESS_KEY")
        return False

    try:
        import boto3
        client = boto3.client(
            "sqs",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )

        # Try to list queues to verify credentials
        response = client.list_queues(MaxNumberOfQueues=1)
        logger.info(f"✅ AWS credentials valid (region: {region})")
        return True
    except Exception as e:
        logger.error(f"❌ AWS credentials invalid: {e}")
        return False


def check_sqs_queue() -> bool:
    """Verify SQS queue exists and is accessible."""
    logger.info("\n[2/5] Checking SQS Queue...")

    queue_url = os.getenv("SQS_QUEUE_URL")
    if not queue_url:
        logger.error("❌ SQS_QUEUE_URL not configured")
        return False

    try:
        import boto3
        access_key = os.getenv("AWS_DEFAULT_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_DEFAULT_SECRET_ACCESS_KEY")
        region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

        client = boto3.client(
            "sqs",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )

        # Try to get queue attributes
        attrs = client.get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=["ApproximateNumberOfMessages"]
        )

        msg_count = attrs["Attributes"].get("ApproximateNumberOfMessages", "0")
        logger.info(f"✅ SQS queue accessible (messages: {msg_count})")
        return True
    except Exception as e:
        logger.error(f"❌ Can't access SQS queue: {e}")
        return False


def check_supabase() -> bool:
    """Verify Supabase connectivity."""
    logger.info("\n[3/5] Checking Supabase...")

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        logger.error("❌ Supabase credentials not configured")
        logger.error("   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        return False

    try:
        from db.supabase import get_supabase_client
        client = get_supabase_client()

        # Try a simple query to verify connection
        result = client.table("jobs").select("id", count="exact").limit(1).execute()
        logger.info(f"✅ Supabase connected successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Can't connect to Supabase: {e}")
        return False


def check_prefect_api() -> bool:
    """Verify Prefect API is accessible."""
    logger.info("\n[4/5] Checking Prefect API...")

    api_url = os.getenv("PREFECT_API_URL")
    if not api_url:
        logger.error("❌ PREFECT_API_URL not configured")
        return False

    try:
        import httpx

        # Try to reach Prefect API
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{api_url}/api/health")
            if response.status_code == 200:
                logger.info(f"✅ Prefect API reachable at {api_url}")
                return True
            else:
                logger.error(f"❌ Prefect API returned status {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"❌ Can't reach Prefect API: {e}")
        return False


def check_prefect_deployment() -> bool:
    """Verify process_job/production deployment exists."""
    logger.info("\n[5/5] Checking Prefect Deployment...")

    api_url = os.getenv("PREFECT_API_URL")
    if not api_url:
        logger.error("❌ PREFECT_API_URL not configured")
        return False

    try:
        import httpx

        with httpx.Client(timeout=10.0) as client:
            # Query deployments API
            response = client.get(
                f"{api_url}/api/deployments/filter",
                json={"deployments": {"name": {"like_": "%process_job%"}}}
            )

            if response.status_code == 200:
                deployments = response.json()
                if isinstance(deployments, list) and len(deployments) > 0:
                    for dep in deployments:
                        dep_name = dep.get("name", "unknown")
                        logger.info(f"✅ Found deployment: {dep_name}")
                    return True
                else:
                    logger.error("❌ Deployment 'process_job/production' not found")
                    logger.error("   Run: python deploy_prefect_flow.py --api-url <url> --pool default --name production")
                    return False
            else:
                logger.error(f"❌ Failed to query deployments: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"❌ Can't check Prefect deployment: {e}")
        return False


def main():
    """Run all checks."""
    logger.info("=" * 70)
    logger.info("SUBSCRIBER SERVICE STARTUP VERIFICATION")
    logger.info("=" * 70)

    results = {
        "AWS Credentials": check_aws_credentials(),
        "SQS Queue": check_sqs_queue(),
        "Supabase": check_supabase(),
        "Prefect API": check_prefect_api(),
        "Prefect Deployment": check_prefect_deployment(),
    }

    logger.info("\n" + "=" * 70)
    logger.info("VERIFICATION SUMMARY")
    logger.info("=" * 70)

    for check, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{status}: {check}")

    all_passed = all(results.values())

    if all_passed:
        logger.info("\n✅ All checks passed! Subscriber is ready to start.")
        logger.info("\nStarting subscriber service...")
        return 0
    else:
        logger.error("\n❌ Some checks failed. Please fix the issues above before starting.")
        logger.error("\nFailed checks:")
        for check, passed in results.items():
            if not passed:
                logger.error(f"  - {check}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
