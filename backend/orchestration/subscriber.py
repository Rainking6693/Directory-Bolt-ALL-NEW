"""SQS subscriber that triggers Prefect flows."""
import json
import os
import time
import threading
from typing import Dict, Optional
import boto3
from prefect.deployments import run_deployment
from utils.logging import setup_logger
from db.dao import record_history

logger = setup_logger(__name__)

# Configuration constants (can be overridden via environment)
VISIBILITY_TIMEOUT = int(os.getenv("SQS_VISIBILITY_TIMEOUT", "600"))  # 10 minutes default
MAX_MESSAGES = int(os.getenv("SQS_MAX_MESSAGES", "5"))
WAIT_TIME_SECONDS = int(os.getenv("SQS_WAIT_TIME_SECONDS", "20"))  # Long polling
MAX_CONSECUTIVE_ERRORS = int(os.getenv("SQS_MAX_CONSECUTIVE_ERRORS", "10"))
RETRY_THRESHOLD = int(os.getenv("SQS_RETRY_THRESHOLD", "3"))

# Initialize SQS client
def get_sqs_client():
    """Get SQS client with credentials from environment."""
    region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
    access_key = os.getenv("AWS_DEFAULT_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_DEFAULT_SECRET_ACCESS_KEY")
    
    if not access_key or not secret_key:
        raise ValueError("AWS credentials not configured")
    
    return boto3.client(
        "sqs",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key
    )

sqs = get_sqs_client()

QUEUE_URL = os.getenv("SQS_QUEUE_URL")
DLQ_URL = os.getenv("SQS_DLQ_URL")

# Thread-safe message processing lock
_message_lock = threading.Lock()


def process_message(message: Dict) -> bool:
    """
    Process a single SQS message by triggering a Prefect flow.
    
    Args:
        message: SQS message dict with Body, MessageId, ReceiptHandle, etc.
    
    Returns:
        True if successful, False otherwise
    """
    if not message or "Body" not in message:
        logger.error("Invalid message format: missing Body")
        return False
    
    try:
        # Validate and parse message body
        body_str = message["Body"]
        if not isinstance(body_str, str):
            logger.error("Message body is not a string")
            return False
        
        body = json.loads(body_str)
        
        # Input validation
        if "job_id" not in body:
            logger.error("Missing required field: job_id")
            return False
        
        job_id = body["job_id"]
        if not isinstance(job_id, str) or len(job_id.strip()) == 0:
            logger.error("Invalid job_id format")
            return False
        
        customer_id = body.get("customer_id")
        package_size = body.get("package_size", 50)
        priority = body.get("priority", "starter")
        
        # Validate package_size
        if not isinstance(package_size, int) or package_size < 0:
            logger.warning(f"Invalid package_size: {package_size}, defaulting to 50")
            package_size = 50
        
        # Validate priority
        valid_priorities = ["starter", "pro", "enterprise"]
        if priority not in valid_priorities:
            logger.warning(f"Invalid priority: {priority}, defaulting to starter")
            priority = "starter"
        
        logger.info(f"Processing message for job {job_id}", extra={
            "job_id": job_id,
            "customer_id": customer_id,
            "priority": priority,
            "package_size": package_size
        })
        
        # Record queue claim (sanitize receipt handle for logging)
        receipt_handle = message.get("ReceiptHandle", "")[:20] if message.get("ReceiptHandle") else ""
        try:
            record_history(job_id, None, "queue_claimed", {
                "message_id": message.get("MessageId", ""),
                "receipt_handle_preview": receipt_handle
            })
        except Exception as e:
            logger.warning(f"Failed to record queue_claimed history: {e}")
        
        # Trigger Prefect flow (thread-safe)
        with _message_lock:
            flow_run = run_deployment(
                name="process_job/production",
                parameters={
                    "job_id": job_id,
                    "customer_id": customer_id,
                    "package_size": package_size,
                    "priority": priority
                },
                timeout=0  # Don't wait for completion
            )
        
        flow_run_id = str(flow_run.id) if flow_run and hasattr(flow_run, 'id') else None
        
        logger.info(f"Triggered Prefect flow for job {job_id}", extra={
            "flow_run_id": flow_run_id
        })
        
        # Record successful trigger
        try:
            record_history(job_id, None, "flow_triggered", {
                "flow_run_id": flow_run_id
            })
        except Exception as e:
            logger.warning(f"Failed to record flow_triggered history: {e}")
        
        return True
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}", extra={
            "body_preview": str(message.get("Body", ""))[:200]  # Truncate for security
        })
        return False
    except KeyError as e:
        logger.error(f"Missing required field in message: {e}", extra={
            "body_preview": str(message.get("Body", ""))[:200]
        })
        return False
    except ValueError as e:
        logger.error(f"Invalid input value: {e}", extra={
            "message_id": message.get("MessageId", ""),
            "error": str(e)
        })
        return False
    except Exception as e:
        logger.error(f"Error processing message: {e}", extra={
            "message_id": message.get("MessageId", ""),
            "error": str(e),
            "error_type": type(e).__name__
        })
        return False


def delete_message(receipt_handle: str) -> bool:
    """
    Delete message from queue after successful processing.
    
    Args:
        receipt_handle: SQS receipt handle
    
    Returns:
        True if successful, False otherwise
    """
    if not receipt_handle or not isinstance(receipt_handle, str):
        logger.error("Invalid receipt_handle")
        return False
    
    if not QUEUE_URL:
        logger.error("QUEUE_URL not configured")
        return False
    
    try:
        sqs.delete_message(
            QueueUrl=QUEUE_URL,
            ReceiptHandle=receipt_handle
        )
        logger.info("Message deleted from queue", extra={"receipt_handle_preview": receipt_handle[:20]})
        return True
    except Exception as e:
        logger.error(f"Failed to delete message: {e}", extra={"error_type": type(e).__name__})
        return False


def send_to_dlq(message: Dict, reason: str) -> bool:
    """
    Send failed message to DLQ.
    
    Args:
        message: SQS message dict
        reason: Reason for DLQ routing
    
    Returns:
        True if successful, False otherwise
    """
    if not DLQ_URL:
        logger.warning("DLQ_URL not configured, cannot send to DLQ")
        return False
    
    if not message or "Body" not in message:
        logger.error("Invalid message format for DLQ")
        return False
    
    try:
        body = json.loads(message["Body"])
        body["_dlq_reason"] = reason
        body["_original_message_id"] = message.get("MessageId", "")
        
        sqs.send_message(
            QueueUrl=DLQ_URL,
            MessageBody=json.dumps(body)
        )
        logger.warning(f"Message sent to DLQ: {reason}", extra={
            "message_id": message.get("MessageId", ""),
            "reason": reason
        })
        return True
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse message body for DLQ: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send to DLQ: {e}", extra={"error_type": type(e).__name__})
        return False


def main_loop():
    """
    Main subscriber loop with circuit breaker pattern.
    
    Processes messages from SQS queue and triggers Prefect flows.
    Implements circuit breaker to stop on excessive errors.
    """
    if not QUEUE_URL:
        logger.error("SQS_QUEUE_URL environment variable not set")
        raise ValueError("SQS_QUEUE_URL is required")
    
    logger.info("Starting SQS subscriber", extra={
        "queue_url": QUEUE_URL[:50] + "..." if len(QUEUE_URL) > 50 else QUEUE_URL,  # Truncate for security
        "visibility_timeout": VISIBILITY_TIMEOUT,
        "max_messages": MAX_MESSAGES,
        "wait_time_seconds": WAIT_TIME_SECONDS
    })
    
    consecutive_errors = 0
    
    while True:
        try:
            # Receive messages from SQS (long polling)
            response = sqs.receive_message(
                QueueUrl=QUEUE_URL,
                MaxNumberOfMessages=MAX_MESSAGES,
                WaitTimeSeconds=WAIT_TIME_SECONDS,
                VisibilityTimeout=VISIBILITY_TIMEOUT,
                AttributeNames=["ApproximateReceiveCount"]
            )
            
            messages = response.get("Messages", [])
            
            if not messages:
                logger.debug("No messages in queue")
                consecutive_errors = 0  # Reset on successful poll
                continue
            
            logger.info(f"Received {len(messages)} messages")
            
            # Process messages (thread-safe)
            for message in messages:
                if not message or "ReceiptHandle" not in message:
                    logger.warning("Invalid message format, skipping")
                    continue
                
                # Check receive count for DLQ threshold
                attributes = message.get("Attributes", {})
                receive_count = int(attributes.get("ApproximateReceiveCount", 0))
                
                if receive_count > RETRY_THRESHOLD:
                    logger.warning(f"Message exceeded retry limit ({receive_count} attempts)")
                    send_to_dlq(message, f"exceeded_retry_limit_{receive_count}")
                    delete_message(message["ReceiptHandle"])
                    continue
                
                # Process message
                success = process_message(message)
                
                if success:
                    # Delete from queue
                    delete_message(message["ReceiptHandle"])
                    consecutive_errors = 0
                else:
                    # Leave in queue for retry (visibility timeout will expire)
                    logger.warning("Message processing failed, will retry after visibility timeout")
                    consecutive_errors += 1
            
            # Circuit breaker: stop if too many consecutive errors
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                logger.error(f"Too many consecutive errors ({consecutive_errors}), stopping subscriber")
                break
                
        except KeyboardInterrupt:
            logger.info("Subscriber stopped by user")
            break
        except ValueError as e:
            logger.error(f"Configuration error: {e}")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}", extra={"error_type": type(e).__name__})
            consecutive_errors += 1
            time.sleep(5)  # Back off on errors
            
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                logger.error(f"Too many consecutive errors ({consecutive_errors}), stopping subscriber")
                break


if __name__ == "__main__":
    if not QUEUE_URL:
        logger.error("SQS_QUEUE_URL environment variable not set")
        exit(1)
    
    if not DLQ_URL:
        logger.warning("SQS_DLQ_URL not set, DLQ functionality disabled")
    
    main_loop()
