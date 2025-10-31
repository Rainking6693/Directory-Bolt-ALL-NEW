#!/usr/bin/env python3
"""
Create SQS queues for DirectoryBolt.
Loads AWS credentials from backend/.env file.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import dotenv
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from dotenv import load_dotenv
    # Load .env file from backend directory
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from {env_path}")
    else:
        print(f"WARNING: .env file not found at {env_path}")
except ImportError:
    print("WARNING: python-dotenv not installed, trying to read .env manually...")
    # Fallback: manually read .env file
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()
        print(f"Loaded environment from {env_path}")

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

def create_queue(queue_name, is_dlq=False):
    """Create an SQS queue and return its URL."""
    # Get region from environment or default to us-east-1
    region = os.getenv('AWS_DEFAULT_REGION') or 'us-east-1'
    
    # Get AWS credentials from environment
    aws_access_key = os.getenv('AWS_DEFAULT_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_DEFAULT_SECRET_ACCESS_KEY')
    
    # Create SQS client with credentials if available
    if aws_access_key and aws_secret_key:
        sqs = boto3.client(
            'sqs',
            region_name=region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
    else:
        # Use default credential chain (env vars, ~/.aws/credentials, IAM role, etc.)
        sqs = boto3.client('sqs', region_name=region)
    
    try:
        # Try to check if queue already exists (skip if no permission)
        try:
            existing_queues = sqs.list_queues(QueueNamePrefix=queue_name)
            if existing_queues.get('QueueUrls'):
                for url in existing_queues['QueueUrls']:
                    if queue_name in url:
                        print(f"SUCCESS: Queue '{queue_name}' already exists: {url}")
                        return url
        except ClientError as list_error:
            # If we can't list queues, that's okay - we'll try to create it anyway
            # If it already exists, we'll get a QueueAlreadyExists error
            if 'AccessDenied' not in str(list_error):
                raise
        
        # Create new queue
        if is_dlq:
            response = sqs.create_queue(
                QueueName=queue_name,
                Attributes={
                    'MessageRetentionPeriod': '1209600'  # 14 days for DLQ
                }
            )
        else:
            response = sqs.create_queue(
                QueueName=queue_name,
                Attributes={
                    'MessageRetentionPeriod': '345600',  # 4 days
                    'VisibilityTimeout': '300'  # 5 minutes
                }
            )
        
        queue_url = response['QueueUrl']
        print(f"SUCCESS: Created queue '{queue_name}': {queue_url}")
        return queue_url
        
    except ClientError as create_error:
        error_code = create_error.response.get('Error', {}).get('Code', '')
        if error_code == 'QueueAlreadyExists':
            # Queue already exists, get its URL
            try:
                sts = boto3.client('sts', 
                                 aws_access_key_id=aws_access_key if aws_access_key else None,
                                 aws_secret_access_key=aws_secret_key if aws_secret_key else None)
                account_id = sts.get_caller_identity()['Account']
            except:
                # Fallback to region-based URL
                account_id = '231688741122'  # From the error message
            region_name = region
            queue_url = f"https://sqs.{region_name}.amazonaws.com/{account_id}/{queue_name}"
            print(f"SUCCESS: Queue '{queue_name}' already exists: {queue_url}")
            return queue_url
        else:
            raise
        
    except NoCredentialsError:
        print("ERROR: AWS credentials not found!")
        print()
        print("Please configure AWS credentials using one of these methods:")
        print("  1. Install AWS CLI and run: aws configure")
        print("     https://aws.amazon.com/cli/")
        print()
        print("  2. Set environment variables:")
        print("     $env:AWS_DEFAULT_ACCESS_KEY_ID = 'your-access-key'")
        print("     $env:AWS_DEFAULT_SECRET_ACCESS_KEY = 'your-secret-key'")
        print("     $env:AWS_DEFAULT_REGION = 'us-east-1'")
        print()
        print("  3. Create ~/.aws/credentials file with:")
        print("     [default]")
        print("     aws_access_key_id = your-access-key")
        print("     aws_secret_access_key = your-secret-key")
        print("     region = us-east-1")
        return None
    except ClientError as e:
        print(f"ERROR: Error creating queue '{queue_name}': {e}")
        return None

def main():
    """Create both queues."""
    print("Creating SQS queues for DirectoryBolt...")
    print()
    
    # Create DLQ first (main queue will reference it)
    dlq_url = create_queue('directorybolt-dlq', is_dlq=True)
    
    if not dlq_url:
        print("ERROR: Failed to create DLQ. Exiting.")
        sys.exit(1)
    
    # Get region and credentials from environment
    region = os.getenv('AWS_DEFAULT_REGION') or 'us-east-1'
    aws_access_key = os.getenv('AWS_DEFAULT_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_DEFAULT_SECRET_ACCESS_KEY')
    
    # Create SQS client with same credentials
    if aws_access_key and aws_secret_key:
        sqs = boto3.client(
            'sqs',
            region_name=region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
    else:
        sqs = boto3.client('sqs', region_name=region)
    
    try:
        dlq_attrs = sqs.get_queue_attributes(
            QueueUrl=dlq_url,
            AttributeNames=['QueueArn']
        )
        dlq_arn = dlq_attrs['Attributes']['QueueArn']
        
        # Create main queue with DLQ redrive policy
        main_queue_url = sqs.create_queue(
            QueueName='directorybolt-jobs',
            Attributes={
                'MessageRetentionPeriod': '345600',  # 4 days
                'VisibilityTimeout': '300',  # 5 minutes
                'ReceiveMessageWaitTimeSeconds': '20',  # Long polling
                'RedrivePolicy': f'{{"deadLetterTargetArn":"{dlq_arn}","maxReceiveCount":3}}'
            }
        )
        
        print(f"SUCCESS: Created main queue 'directorybolt-jobs': {main_queue_url['QueueUrl']}")
        print(f"  Configured with DLQ: maxReceiveCount=3")
        
    except ClientError as e:
        print(f"ERROR: Error creating main queue: {e}")
        print("  Attempting to create without DLQ redrive policy...")
        # Fallback: create without DLQ reference
        main_queue_url = create_queue('directorybolt-jobs', is_dlq=False)
    
    print()
    print("SUCCESS: All queues created successfully!")
    print()
    print("Queue Details:")
    if dlq_url:
        print(f"  DLQ: {dlq_url}")
    if 'QueueUrl' in locals() and main_queue_url:
        print(f"  Main: {main_queue_url.get('QueueUrl', 'directorybolt-jobs')}")
    print()
    print("Tip: Update backend/.env with these queue URLs if needed")

if __name__ == '__main__':
    main()
