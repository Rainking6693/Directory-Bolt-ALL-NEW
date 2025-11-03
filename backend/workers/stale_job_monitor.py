#!/usr/bin/env python3
"""
Stale Job Monitor - Detects and recovers jobs stuck in 'in_progress' status.

This service runs every 2 minutes and:
1. Finds jobs with no worker heartbeat for >10 minutes
2. Requeues them to SQS for retry
3. Updates job status to 'pending'
4. Logs all actions for audit trail

Critical for preventing revenue loss from stuck jobs.
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Monkey patch httpx.Client to accept proxy parameter (for gotrue compatibility)
import httpx
_original_init = httpx.Client.__init__
def _patched_init(self, *args, **kwargs):
    kwargs.pop('proxy', None)  # Remove proxy if present
    return _original_init(self, *args, **kwargs)
httpx.Client.__init__ = _patched_init

import boto3
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/stale_job_monitor.log')
    ]
)
logger = logging.getLogger(__name__)

# Environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL')
AWS_REGION = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
AWS_ACCESS_KEY_ID = os.getenv('AWS_DEFAULT_ACCESS_KEY_ID') or os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_DEFAULT_SECRET_ACCESS_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')
STALE_THRESHOLD_MINUTES = int(os.getenv('STALE_THRESHOLD_MINUTES', '10'))
CHECK_INTERVAL_SECONDS = int(os.getenv('CHECK_INTERVAL_SECONDS', '120'))

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Initialize SQS client with explicit credentials
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    sqs = boto3.client(
        'sqs',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )
else:
    logger.warning("AWS credentials not found in environment variables, using default credential chain")
    sqs = boto3.client('sqs', region_name=AWS_REGION)


def find_stale_jobs(threshold_minutes: int = 10) -> List[Dict[str, Any]]:
    """
    Find jobs that are stuck in 'in_progress' with no recent worker heartbeat.
    
    Args:
        threshold_minutes: Minutes without heartbeat to consider stale
        
    Returns:
        List of stale job records
    """
    try:
        threshold_time = datetime.utcnow() - timedelta(minutes=threshold_minutes)
        
        # Query jobs with no recent heartbeat
        response = supabase.rpc(
            'find_stale_jobs',
            {'threshold_minutes': threshold_minutes}
        ).execute()
        
        stale_jobs = response.data if response.data else []
        
        if stale_jobs:
            logger.warning(f"Found {len(stale_jobs)} stale jobs")
            for job in stale_jobs:
                logger.warning(
                    f"Stale job detected: job_id={job['id']}, "
                    f"customer_id={job['customer_id']}, "
                    f"last_heartbeat={job.get('last_heartbeat', 'never')}"
                )
        
        return stale_jobs
        
    except Exception as e:
        logger.error(f"Error finding stale jobs: {e}", exc_info=True)
        return []


def requeue_job(job: Dict[str, Any]) -> bool:
    """
    Requeue a stale job to SQS for retry.
    
    Args:
        job: Job record from database
        
    Returns:
        True if successfully requeued, False otherwise
    """
    try:
        job_id = job['id']
        customer_id = job['customer_id']
        package_size = job.get('package_size', 'starter')
        priority = job.get('priority', 3)
        
        # Create SQS message
        message_body = {
            'job_id': job_id,
            'customer_id': customer_id,
            'package_size': package_size,
            'priority': priority,
            'retry_attempt': 1,  # Track retries in message metadata
            'requeued_by': 'stale_job_monitor',
            'requeued_at': datetime.utcnow().isoformat()
        }
        
        # Send to SQS
        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message_body),
            MessageAttributes={
                'priority': {
                    'StringValue': str(priority),
                    'DataType': 'Number'
                },
                'retry': {
                    'StringValue': 'true',
                    'DataType': 'String'
                }
            }
        )
        
        message_id = response.get('MessageId')
        logger.info(
            f"Requeued job to SQS: job_id={job_id}, "
            f"message_id={message_id}"
        )
        
        # Update job status to pending
        supabase.table('jobs').update({
            'status': 'pending',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', job_id).execute()
        
        # Record in queue_history (using actual schema)
        try:
            supabase.table('queue_history').insert({
                'customer_id': customer_id,
                'status_from': 'in_progress',
                'status_to': 'pending',
                'metadata': {
                    'job_id': job_id,
                    'event': 'requeued_stale',
                    'reason': 'stale_job_detected',
                    'threshold_minutes': STALE_THRESHOLD_MINUTES,
                    'message_id': message_id,
                    'retry_attempt': message_body['retry_attempt'],
                    'requeued_by': 'stale_job_monitor'
                }
            }).execute()
        except Exception as history_error:
            # Log but don't fail if history insert fails
            logger.warning(f"Failed to record in queue_history: {history_error}")
        
        logger.info(f"Updated job status to pending: job_id={job_id}")
        return True
        
    except Exception as e:
        logger.error(
            f"Error requeuing job {job.get('id')}: {e}",
            exc_info=True
        )
        return False


def monitor_loop():
    """
    Main monitoring loop - runs continuously checking for stale jobs.
    """
    logger.info(
        f"Starting stale job monitor: "
        f"threshold={STALE_THRESHOLD_MINUTES}min, "
        f"interval={CHECK_INTERVAL_SECONDS}s"
    )
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            logger.info(f"Starting check iteration #{iteration}")
            
            # Find stale jobs
            stale_jobs = find_stale_jobs(STALE_THRESHOLD_MINUTES)
            
            if not stale_jobs:
                logger.info("No stale jobs found")
            else:
                # Requeue each stale job
                success_count = 0
                fail_count = 0
                
                for job in stale_jobs:
                    if requeue_job(job):
                        success_count += 1
                    else:
                        fail_count += 1
                
                logger.info(
                    f"Requeue results: {success_count} succeeded, "
                    f"{fail_count} failed"
                )
            
            # Wait before next check
            logger.info(f"Sleeping for {CHECK_INTERVAL_SECONDS} seconds")
            time.sleep(CHECK_INTERVAL_SECONDS)
            
        except KeyboardInterrupt:
            logger.info("Received shutdown signal, exiting gracefully")
            break
            
        except Exception as e:
            logger.error(
                f"Error in monitor loop iteration #{iteration}: {e}",
                exc_info=True
            )
            # Continue running even if one iteration fails
            time.sleep(CHECK_INTERVAL_SECONDS)


def health_check() -> Dict[str, Any]:
    """
    Perform health check of the monitor service.
    
    Returns:
        Health status dictionary
    """
    try:
        # Check Supabase connection
        supabase.table('jobs').select('id').limit(1).execute()
        supabase_healthy = True
    except Exception as e:
        logger.error(f"Supabase health check failed: {e}")
        supabase_healthy = False
    
    try:
        # Check SQS connection
        sqs.get_queue_attributes(
            QueueUrl=SQS_QUEUE_URL,
            AttributeNames=['ApproximateNumberOfMessages']
        )
        sqs_healthy = True
    except Exception as e:
        logger.error(f"SQS health check failed: {e}")
        sqs_healthy = False
    
    healthy = supabase_healthy and sqs_healthy
    
    return {
        'service': 'stale_job_monitor',
        'healthy': healthy,
        'supabase': supabase_healthy,
        'sqs': sqs_healthy,
        'threshold_minutes': STALE_THRESHOLD_MINUTES,
        'check_interval_seconds': CHECK_INTERVAL_SECONDS,
        'timestamp': datetime.utcnow().isoformat()
    }


if __name__ == '__main__':
    # Validate environment variables
    required_vars = [
        'SUPABASE_URL',
        'SQS_QUEUE_URL'
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    # Check for service key (either name)
    if not (os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')):
        missing_vars.append('SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY')
    
    if missing_vars:
        logger.error(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )
        sys.exit(1)
    
    # Run health check
    health = health_check()
    logger.info(f"Health check: {json.dumps(health, indent=2)}")
    
    if not health['healthy']:
        logger.error("Health check failed, exiting")
        sys.exit(1)
    
    # Start monitoring
    try:
        monitor_loop()
    except Exception as e:
        logger.error(f"Fatal error in monitor: {e}", exc_info=True)
        sys.exit(1)

