#!/usr/bin/env python3
"""
Dead Letter Queue (DLQ) Monitor - Alerts when failed jobs accumulate.

This service runs every 5 minutes and:
1. Checks DLQ message count
2. Retrieves failed messages
3. Sends Slack alerts with details
4. Logs all failures for investigation

Critical for ensuring no failed jobs go unnoticed.
"""

import os
import sys
import time
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

import boto3
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/dlq_monitor.log')
    ]
)
logger = logging.getLogger(__name__)

# Environment variables
SQS_DLQ_URL = os.getenv('SQS_DLQ_URL')
AWS_REGION = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')
CHECK_INTERVAL_SECONDS = int(os.getenv('DLQ_CHECK_INTERVAL_SECONDS', '300'))
ALERT_THRESHOLD = int(os.getenv('DLQ_ALERT_THRESHOLD', '1'))

# AWS credentials (explicit for Docker)
AWS_ACCESS_KEY_ID = os.getenv('AWS_DEFAULT_ACCESS_KEY_ID') or os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_DEFAULT_SECRET_ACCESS_KEY') or os.getenv('AWS_SECRET_ACCESS_KEY')

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


def get_dlq_depth() -> int:
    """
    Get the number of messages in the DLQ.
    
    Returns:
        Number of messages in DLQ
    """
    try:
        response = sqs.get_queue_attributes(
            QueueUrl=SQS_DLQ_URL,
            AttributeNames=[
                'ApproximateNumberOfMessages',
                'ApproximateNumberOfMessagesNotVisible'
            ]
        )
        
        attributes = response.get('Attributes', {})
        visible = int(attributes.get('ApproximateNumberOfMessages', 0))
        not_visible = int(attributes.get('ApproximateNumberOfMessagesNotVisible', 0))
        total = visible + not_visible
        
        logger.info(
            f"DLQ depth: {total} messages "
            f"(visible: {visible}, in-flight: {not_visible})"
        )
        
        return total
        
    except Exception as e:
        logger.error(f"Error getting DLQ depth: {e}", exc_info=True)
        return 0


def get_dlq_messages(max_messages: int = 10) -> List[Dict[str, Any]]:
    """
    Retrieve messages from DLQ without deleting them.
    
    Args:
        max_messages: Maximum number of messages to retrieve
        
    Returns:
        List of message dictionaries
    """
    try:
        response = sqs.receive_message(
            QueueUrl=SQS_DLQ_URL,
            MaxNumberOfMessages=min(max_messages, 10),
            AttributeNames=['All'],
            MessageAttributeNames=['All'],
            VisibilityTimeout=30,
            WaitTimeSeconds=0
        )
        
        messages = response.get('Messages', [])
        
        parsed_messages = []
        for msg in messages:
            try:
                body = json.loads(msg['Body'])
                parsed_messages.append({
                    'message_id': msg['MessageId'],
                    'receipt_handle': msg['ReceiptHandle'],
                    'body': body,
                    'attributes': msg.get('Attributes', {}),
                    'message_attributes': msg.get('MessageAttributes', {})
                })
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse message body: {msg['Body']}")
                parsed_messages.append({
                    'message_id': msg['MessageId'],
                    'receipt_handle': msg['ReceiptHandle'],
                    'body': msg['Body'],
                    'attributes': msg.get('Attributes', {}),
                    'message_attributes': msg.get('MessageAttributes', {})
                })
        
        # Make messages visible again (we're just peeking)
        for msg in messages:
            try:
                sqs.change_message_visibility(
                    QueueUrl=SQS_DLQ_URL,
                    ReceiptHandle=msg['ReceiptHandle'],
                    VisibilityTimeout=0
                )
            except Exception as e:
                logger.warning(f"Failed to reset visibility: {e}")
        
        return parsed_messages
        
    except Exception as e:
        logger.error(f"Error retrieving DLQ messages: {e}", exc_info=True)
        return []


def format_slack_message(depth: int, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format Slack alert message with DLQ details.
    
    Args:
        depth: Total number of messages in DLQ
        messages: Sample of DLQ messages
        
    Returns:
        Slack message payload
    """
    # Build message blocks
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "🚨 Dead Letter Queue Alert",
                "emoji": True
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{depth} failed job(s)* detected in the Dead Letter Queue"
            }
        },
        {
            "type": "divider"
        }
    ]
    
    # Add details for each message
    for i, msg in enumerate(messages[:5], 1):  # Limit to 5 messages
        body = msg.get('body', {})
        job_id = body.get('job_id', 'unknown')
        customer_id = body.get('customer_id', 'unknown')
        retry_attempt = body.get('retry_attempt', 0)
        
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*Message {i}:*\n"
                    f"• Job ID: `{job_id}`\n"
                    f"• Customer ID: `{customer_id}`\n"
                    f"• Retry Attempts: {retry_attempt}\n"
                    f"• Message ID: `{msg['message_id']}`"
                )
            }
        })
    
    if depth > 5:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"_...and {depth - 5} more messages_"
            }
        })
    
    blocks.extend([
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "*Action Required:*\n"
                    "1. Investigate failed jobs in AWS Console\n"
                    "2. Check worker logs for errors\n"
                    "3. Manually retry or resolve issues\n"
                    "4. Purge DLQ after resolution"
                )
            }
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"🕐 {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
                }
            ]
        }
    ])
    
    return {
        "blocks": blocks,
        "text": f"DLQ Alert: {depth} failed jobs detected"
    }


def send_slack_alert(depth: int, messages: List[Dict[str, Any]]) -> bool:
    """
    Send Slack alert about DLQ messages.
    
    Args:
        depth: Total number of messages in DLQ
        messages: Sample of DLQ messages
        
    Returns:
        True if alert sent successfully, False otherwise
    """
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL not configured, skipping alert")
        return False
    
    try:
        payload = format_slack_message(depth, messages)
        
        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"Slack alert sent successfully for {depth} DLQ messages")
            return True
        else:
            logger.error(
                f"Failed to send Slack alert: "
                f"status={response.status_code}, "
                f"response={response.text}"
            )
            return False
            
    except Exception as e:
        logger.error(f"Error sending Slack alert: {e}", exc_info=True)
        return False


def monitor_loop():
    """
    Main monitoring loop - runs continuously checking DLQ.
    """
    logger.info(
        f"Starting DLQ monitor: "
        f"interval={CHECK_INTERVAL_SECONDS}s, "
        f"alert_threshold={ALERT_THRESHOLD}"
    )
    
    iteration = 0
    last_alert_depth = 0
    
    while True:
        try:
            iteration += 1
            logger.info(f"Starting DLQ check iteration #{iteration}")
            
            # Get DLQ depth
            depth = get_dlq_depth()
            
            # Check if alert needed
            if depth >= ALERT_THRESHOLD:
                # Only alert if depth increased or first time
                if depth > last_alert_depth or last_alert_depth == 0:
                    logger.warning(
                        f"DLQ threshold exceeded: {depth} messages "
                        f"(threshold: {ALERT_THRESHOLD})"
                    )
                    
                    # Get sample messages
                    messages = get_dlq_messages(max_messages=10)
                    
                    # Send alert
                    if send_slack_alert(depth, messages):
                        last_alert_depth = depth
                    else:
                        logger.error("Failed to send Slack alert")
                else:
                    logger.info(
                        f"DLQ depth unchanged ({depth}), "
                        f"skipping duplicate alert"
                    )
            else:
                logger.info(f"DLQ depth below threshold: {depth} messages")
                last_alert_depth = 0
            
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
        # Check SQS connection
        sqs.get_queue_attributes(
            QueueUrl=SQS_DLQ_URL,
            AttributeNames=['ApproximateNumberOfMessages']
        )
        sqs_healthy = True
    except Exception as e:
        logger.error(f"SQS health check failed: {e}")
        sqs_healthy = False
    
    # Check Slack webhook (optional)
    slack_configured = bool(SLACK_WEBHOOK_URL)
    
    return {
        'service': 'dlq_monitor',
        'healthy': sqs_healthy,
        'sqs': sqs_healthy,
        'slack_configured': slack_configured,
        'check_interval_seconds': CHECK_INTERVAL_SECONDS,
        'alert_threshold': ALERT_THRESHOLD,
        'timestamp': datetime.utcnow().isoformat()
    }


if __name__ == '__main__':
    # Validate environment variables
    if not SQS_DLQ_URL:
        logger.error("Missing required environment variable: SQS_DLQ_URL")
        sys.exit(1)
    
    # Run health check
    health = health_check()
    logger.info(f"Health check: {json.dumps(health, indent=2)}")
    
    if not health['healthy']:
        logger.error("Health check failed, exiting")
        sys.exit(1)
    
    if not health['slack_configured']:
        logger.warning(
            "SLACK_WEBHOOK_URL not configured - alerts will be logged only"
        )
    
    # Start monitoring
    try:
        monitor_loop()
    except Exception as e:
        logger.error(f"Fatal error in monitor: {e}", exc_info=True)
        sys.exit(1)

