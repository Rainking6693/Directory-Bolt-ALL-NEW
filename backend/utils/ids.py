"""Idempotency key generation utilities."""
import hashlib
import json
from typing import Any, Dict


def make_idempotency_key(job_id: str, directory: str, factors: Dict[str, Any]) -> str:
    """
    Generate a deterministic idempotency key for a job+directory submission.
    
    Args:
        job_id: The job UUID
        directory: Directory name (e.g., "yelp", "google")
        factors: Business data factors (name, address, etc.)
    
    Returns:
        SHA256 hash as hex string
    """
    # Normalize factors by sorting keys
    normalized = json.dumps(factors, sort_keys=True, separators=(',', ':'))
    
    # Combine all inputs
    combined = f"{job_id}:{directory}:{normalized}"
    
    # Generate SHA256 hash
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()


def generate_worker_id() -> str:
    """Generate a unique worker ID."""
    import uuid
    return str(uuid.uuid4())
