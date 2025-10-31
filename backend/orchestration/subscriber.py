"""SQS subscriber that triggers Prefect flows."""
import json
import os
import time
import boto3
from prefect.deployments import run_deployment
from utils.logging import setup_logger
from db.dao import record_history

logger = setup_logger(__name__)

# Initialize SQS client
sqs = boto3.client(
    "sqs",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)

QUEUE_URL = os.getenv("SQS_QUEUE_URL")
DLQ_URL = os.getenv("SQS_DLQ_URL")
VISIBILITY_TIMEOUT = 600  # 10 minutes
MAX_MESSAGES = 5
WAIT_TIME_SECONDS = 20  # Long polling


def process_message(message: dict) -> bool:
    """
    Process a single SQS message by triggering a Prefect flow.
    
    Args:
        message: SQS message dict
    
    Returns:
        True if successful, False otherwise
    """
    try:
        body = json.loads(message["Body"])
        job_id = body["job_id"]
        customer_id = body.get("customer_id")
        package_size = body.get("package_size", 50)
        priority = body.get("priority", "starter")
        
        logger.info(f"Processing message for job {job_id}", extra={
            "job_id": job_id,
            "customer_id": customer_id,
            "priority": priority
        })
        
        # Record queue claim
        record_history(job_id, None, "queue_claimed", {
            "message_id": message["MessageId"],
            "receipt_handle": message["ReceiptHandle"][:20]  # Truncate for logging
        })
        
        # Trigger Prefect flow
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
        
        logger.info(f"Triggered Prefect flow for job {job_id}", extra={
            "flow_run_id": str(flow_run.id) if flow_run else None
        })
        
        # Record successful trigger
        record_history(job_id, None, "flow_triggered", {
            "flow_run_id": str(flow_run.id) if flow_run else None
        })
        
        return True
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}", extra={"body": message.get("Body")})
        return False
    except KeyError as e:
        logger.error(f"Missing required field in message: {e}", extra={"body": message.get("Body")})
        return False
    except Exception as e:
        logger.error(f"Error processing message: {e}", extra={
            "message_id": message.get("MessageId"),
            "error": str(e)
        })
        return False


def delete_message(receipt_handle: str):
    """Delete message from queue after successful processing."""
    try:
        sqs.delete_message(
            QueueUrl=QUEUE_URL,
            ReceiptHandle=receipt_handle
        )
        logger.info("Message deleted from queue", extra={"receipt_handle": receipt_handle[:20]})
    except Exception as e:
        logger.error(f"Failed to delete message: {e}")


def send_to_dlq(message: dict, reason: str):
    """Send failed message to DLQ."""
    try:
        body = json.loads(message["Body"])
        body["_dlq_reason"] = reason
        body["_original_message_id"] = message["MessageId"]
        
        sqs.send_message(
            QueueUrl=DLQ_URL,
            MessageBody=json.dumps(body)
        )
        logger.warning(f"Message sent to DLQ: {reason}", extra={
            "message_id": message["MessageId"],
            "reason": reason
        })
    except Exception as e:
        logger.error(f"Failed to send to DLQ: {e}")


def main_loop():
    """Main subscriber loop."""
    logger.info("Starting SQS subscriber", extra={
        "queue_url": QUEUE_URL,
        "visibility_timeout": VISIBILITY_TIMEOUT
    })
    
    consecutive_errors = 0
    max_consecutive_errors = 10
    
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
            
            for message in messages:
                # Check receive count for DLQ threshold
                receive_count = int(message.get("Attributes", {}).get("ApproximateReceiveCount", 0))
                
                if receive_count > 3:
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
            if consecutive_errors >= max_consecutive_errors:
                logger.error(f"Too many consecutive errors ({consecutive_errors}), stopping subscriber")
                break
                
        except KeyboardInterrupt:
            logger.info("Subscriber stopped by user")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            consecutive_errors += 1
            time.sleep(5)  # Back off on errors
            
            if consecutive_errors >= max_consecutive_errors:
                logger.error(f"Too many consecutive errors ({consecutive_errors}), stopping subscriber")
                break


if __name__ == "__main__":
    if not QUEUE_URL:
        logger.error("SQS_QUEUE_URL environment variable not set")
        exit(1)
    
    if not DLQ_URL:
        logger.warning("SQS_DLQ_URL not set, DLQ functionality disabled")
    
    main_loop()
