"""
Integration tests for critical backend flows.

Tests:
1. End-to-end job processing
2. Idempotency and duplicate prevention
3. Retry logic and DLQ handling
4. Worker failure recovery
5. Concurrent job processing
"""
import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any
import boto3
from supabase import create_client
import os

# Import modules to test
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from orchestration.flows import process_job
from orchestration.tasks import submit_directory, mark_in_progress, finalize_job
from db.dao import (
    upsert_job_result, 
    set_job_status, 
    get_business_profile,
    record_history
)
from utils.ids import make_idempotency_key
from workers.submission_runner import run_plan

# Test configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:54321")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")
SQS_DLQ_URL = os.getenv("SQS_DLQ_URL")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
sqs = boto3.client('sqs', region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))


@pytest.fixture
def test_customer():
    """Create a test customer."""
    customer_data = {
        "customer_id": f"TEST-{int(time.time())}",
        "business_name": "Test Business Inc",
        "email": "test@example.com",
        "phone": "555-0100",
        "address": "123 Test St",
        "city": "Test City",
        "state": "CA",
        "zip": "90001",
        "website": "https://testbusiness.com",
        "description": "A test business for integration testing",
        "category": "Technology",
        "package_type": "pro",
        "status": "active"
    }
    
    result = supabase.table("customers").insert(customer_data).execute()
    customer = result.data[0]
    
    yield customer
    
    # Cleanup
    supabase.table("customers").delete().eq("id", customer["id"]).execute()


@pytest.fixture
def test_job(test_customer):
    """Create a test job."""
    job_data = {
        "customer_id": test_customer["id"],
        "package_size": 10,
        "priority_level": "pro",
        "status": "pending"
    }
    
    result = supabase.table("jobs").insert(job_data).execute()
    job = result.data[0]
    
    yield job
    
    # Cleanup
    supabase.table("jobs").delete().eq("id", job["id"]).execute()


class TestEndToEndJobProcessing:
    """Test complete job processing flow."""
    
    @pytest.mark.asyncio
    async def test_successful_job_completion(self, test_job, test_customer):
        """Test: Job goes from pending → in_progress → completed."""
        job_id = test_job["id"]
        customer_id = test_customer["id"]
        
        # Process job
        result = await process_job(
            job_id=job_id,
            customer_id=customer_id,
            package_size=10,
            priority="pro"
        )
        
        # Verify result
        assert result["status"] == "completed"
        assert result["total_directories"] == 10
        assert result["successful"] > 0
        
        # Verify job status in database
        job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        assert job.data["status"] == "completed"
        
        # Verify job_results created
        results = supabase.table("job_results").select("*").eq("job_id", job_id).execute()
        assert len(results.data) == 10
        
        # Verify queue_history logged
        history = supabase.table("queue_history").select("*").eq("job_id", job_id).execute()
        assert len(history.data) > 0
        assert any(h["event"] == "job_started" for h in history.data)
        assert any(h["event"] == "job_completed" for h in history.data)
    
    @pytest.mark.asyncio
    async def test_job_with_failures(self, test_job, test_customer):
        """Test: Job completes even if some directories fail."""
        job_id = test_job["id"]
        customer_id = test_customer["id"]
        
        # Mock some directories to fail
        # (This would require mocking the CrewAI service or Playwright)
        
        result = await process_job(
            job_id=job_id,
            customer_id=customer_id,
            package_size=10,
            priority="pro"
        )
        
        # Verify partial success
        assert result["status"] in ["completed", "partial"]
        assert result["failed"] > 0
        assert result["successful"] > 0
        
        # Verify failed submissions logged
        failed_results = supabase.table("job_results") \
            .select("*") \
            .eq("job_id", job_id) \
            .eq("status", "failed") \
            .execute()
        
        assert len(failed_results.data) > 0
        assert all(r["error_message"] is not None for r in failed_results.data)


class TestIdempotency:
    """Test idempotency and duplicate prevention."""
    
    def test_idempotency_key_generation(self):
        """Test: Same inputs generate same idempotency key."""
        job_id = "test-job-123"
        directory = "yelp"
        factors = {"name": "Test Business", "dir": "yelp"}
        
        key1 = make_idempotency_key(job_id, directory, factors)
        key2 = make_idempotency_key(job_id, directory, factors)
        
        assert key1 == key2
        assert len(key1) == 64  # SHA256 hex length
    
    def test_idempotency_key_uniqueness(self):
        """Test: Different inputs generate different keys."""
        job_id = "test-job-123"
        directory = "yelp"
        
        key1 = make_idempotency_key(job_id, directory, {"name": "Business A"})
        key2 = make_idempotency_key(job_id, directory, {"name": "Business B"})
        
        assert key1 != key2
    
    def test_duplicate_submission_prevention(self, test_job):
        """Test: Duplicate submissions are prevented."""
        job_id = test_job["id"]
        directory = "yelp"
        idem_key = make_idempotency_key(job_id, directory, {"test": "data"})
        
        # First submission
        result1 = upsert_job_result(
            job_id=job_id,
            directory=directory,
            status="submitted",
            idem=idem_key,
            payload={"test": "data"}
        )
        assert result1 == "inserted"
        
        # Second submission (duplicate)
        result2 = upsert_job_result(
            job_id=job_id,
            directory=directory,
            status="submitted",
            idem=idem_key,
            payload={"test": "data"}
        )
        assert result2 == "duplicate_success"
        
        # Verify only one record in database
        results = supabase.table("job_results") \
            .select("*") \
            .eq("idempotency_key", idem_key) \
            .execute()
        
        assert len(results.data) == 1


class TestRetryLogic:
    """Test retry logic and DLQ handling."""
    
    @pytest.mark.asyncio
    async def test_task_retry_on_failure(self, test_job, test_customer):
        """Test: Failed tasks are retried 3 times."""
        job_id = test_job["id"]
        directory = "test-directory-fail"
        
        # This will fail because directory doesn't exist
        with pytest.raises(Exception):
            await submit_directory(
                job_id=job_id,
                directory=directory,
                priority="pro"
            )
        
        # Verify retry attempts logged in queue_history
        history = supabase.table("queue_history") \
            .select("*") \
            .eq("job_id", job_id) \
            .eq("directory_name", directory) \
            .execute()
        
        # Should have multiple retry events
        retry_events = [h for h in history.data if "retry" in h["event"].lower()]
        assert len(retry_events) >= 1
    
    def test_dlq_message_after_max_retries(self, test_job):
        """Test: Messages move to DLQ after 3 failures."""
        # Send a message that will fail
        message = {
            "job_id": test_job["id"],
            "customer_id": test_job["customer_id"],
            "package_size": 1,
            "priority": "starter",
            "force_fail": True  # Special flag to force failure
        }
        
        # Send to main queue
        sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
        # Wait for processing and retries (3 attempts × 30s = 90s)
        time.sleep(120)
        
        # Check DLQ for message
        dlq_messages = sqs.receive_message(
            QueueUrl=SQS_DLQ_URL,
            MaxNumberOfMessages=10
        )
        
        # Verify message in DLQ
        assert "Messages" in dlq_messages
        assert len(dlq_messages["Messages"]) > 0
        
        # Cleanup DLQ
        for msg in dlq_messages.get("Messages", []):
            sqs.delete_message(
                QueueUrl=SQS_DLQ_URL,
                ReceiptHandle=msg["ReceiptHandle"]
            )


class TestWorkerFailureRecovery:
    """Test worker failure and job recovery."""
    
    def test_stale_job_detection(self, test_job):
        """Test: Jobs with no heartbeat are detected as stale."""
        job_id = test_job["id"]
        
        # Mark job as in_progress
        set_job_status(job_id, "in_progress")
        
        # Create a stale worker heartbeat (>10 minutes old)
        old_time = datetime.utcnow() - timedelta(minutes=15)
        supabase.table("worker_heartbeats").insert({
            "worker_id": "test-worker-stale",
            "queue_name": "default",
            "status": "running",
            "current_job_id": job_id,
            "last_heartbeat": old_time.isoformat()
        }).execute()
        
        # Query stale workers view
        stale = supabase.table("stale_workers").select("*").execute()
        
        # Verify job detected as stale
        assert len(stale.data) > 0
        assert any(w["current_job_id"] == job_id for w in stale.data)
        
        # Cleanup
        supabase.table("worker_heartbeats") \
            .delete() \
            .eq("worker_id", "test-worker-stale") \
            .execute()
    
    @pytest.mark.asyncio
    async def test_job_requeue_after_worker_crash(self, test_job):
        """Test: Stale jobs are automatically requeued."""
        job_id = test_job["id"]
        
        # Mark job as in_progress with stale heartbeat
        set_job_status(job_id, "in_progress")
        
        old_time = datetime.utcnow() - timedelta(minutes=15)
        supabase.table("worker_heartbeats").insert({
            "worker_id": "test-worker-crash",
            "queue_name": "default",
            "status": "running",
            "current_job_id": job_id,
            "last_heartbeat": old_time.isoformat()
        }).execute()
        
        # Run stale job monitor (would be done by background service)
        from workers.stale_job_monitor import find_stale_jobs, requeue_job
        
        stale_jobs = find_stale_jobs()
        assert len(stale_jobs) > 0
        
        # Requeue the job
        success = requeue_job(stale_jobs[0])
        assert success
        
        # Verify job status changed to pending
        job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        assert job.data["status"] == "pending"
        
        # Verify message in SQS queue
        messages = sqs.receive_message(
            QueueUrl=SQS_QUEUE_URL,
            MaxNumberOfMessages=10
        )
        
        assert "Messages" in messages
        requeued_msg = next(
            (m for m in messages["Messages"] 
             if json.loads(m["Body"])["job_id"] == job_id),
            None
        )
        assert requeued_msg is not None
        
        # Cleanup
        if requeued_msg:
            sqs.delete_message(
                QueueUrl=SQS_QUEUE_URL,
                ReceiptHandle=requeued_msg["ReceiptHandle"]
            )


class TestConcurrency:
    """Test concurrent operations."""
    
    @pytest.mark.asyncio
    async def test_concurrent_job_processing(self, test_customer):
        """Test: Multiple jobs can be processed concurrently."""
        # Create 5 test jobs
        jobs = []
        for i in range(5):
            job_data = {
                "customer_id": test_customer["id"],
                "package_size": 5,
                "priority_level": "pro",
                "status": "pending"
            }
            result = supabase.table("jobs").insert(job_data).execute()
            jobs.append(result.data[0])
        
        # Process all jobs concurrently
        tasks = [
            process_job(
                job_id=job["id"],
                customer_id=test_customer["id"],
                package_size=5,
                priority="pro"
            )
            for job in jobs
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all completed
        assert len(results) == 5
        assert all(isinstance(r, dict) for r in results)
        assert all(r["status"] in ["completed", "partial"] for r in results)
        
        # Cleanup
        for job in jobs:
            supabase.table("jobs").delete().eq("id", job["id"]).execute()
    
    def test_concurrent_status_updates(self, test_job):
        """Test: Concurrent status updates don't corrupt data."""
        job_id = test_job["id"]
        
        # Simulate concurrent updates
        import threading
        
        def update_status(status):
            set_job_status(job_id, status)
        
        threads = [
            threading.Thread(target=update_status, args=("in_progress",)),
            threading.Thread(target=update_status, args=("completed",)),
            threading.Thread(target=update_status, args=("failed",))
        ]
        
        for t in threads:
            t.start()
        
        for t in threads:
            t.join()
        
        # Verify job has a valid status (last write wins)
        job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        assert job.data["status"] in ["in_progress", "completed", "failed"]


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

