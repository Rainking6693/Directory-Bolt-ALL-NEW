"""Data Access Object for Supabase operations with idempotency."""
from typing import Dict, List, Optional, Any
from datetime import datetime
from .supabase import get_supabase_client
from utils.logging import setup_logger

logger = setup_logger(__name__)


def upsert_job_result(
    job_id: str,
    directory: str,
    status: str,
    idem: str,
    payload: Optional[Dict] = None,
    response_log: Optional[Dict] = None,
    error_message: Optional[str] = None
) -> str:
    """
    Upsert a job result with idempotency.
    
    Returns:
        "duplicate_success" if already exists with success status
        "inserted" if new record created
        "updated" if existing record updated
    """
    supabase = get_supabase_client()
    
    # Check if already exists
    existing = supabase.table("job_results").select("*").eq("idempotency_key", idem).maybe_single().execute()
    
    if existing.data:
        if existing.data["status"] in ["submitted", "skipped"]:
            logger.info(f"Duplicate success for {directory}", extra={"job_id": job_id, "idem": idem})
            return "duplicate_success"
        logger.info(f"Updating existing result for {directory}", extra={"job_id": job_id})
        return "updated"
    
    # Insert new record
    data = {
        "job_id": job_id,
        "directory_name": directory,
        "status": status,
        "idempotency_key": idem,
        "payload": payload or {},
        "response_log": response_log or {},
        "error_message": error_message
    }
    
    supabase.table("job_results").insert(data).execute()
    logger.info(f"Inserted new result for {directory}", extra={"job_id": job_id, "status": status})
    return "inserted"


def set_job_status(job_id: str, status: str, error_message: Optional[str] = None):
    """Update job status."""
    supabase = get_supabase_client()
    
    data = {"status": status, "updated_at": datetime.utcnow().isoformat()}
    
    if status == "in_progress" and not error_message:
        data["started_at"] = datetime.utcnow().isoformat()
    elif status in ["completed", "failed"]:
        data["completed_at"] = datetime.utcnow().isoformat()
    
    if error_message:
        data["error_message"] = error_message
    
    supabase.table("jobs").update(data).eq("id", job_id).execute()
    logger.info(f"Job status updated", extra={"job_id": job_id, "status": status})


def record_history(job_id: str, directory: Optional[str], event: str, details: Optional[Dict] = None, worker_id: Optional[str] = None):
    """Record queue history event."""
    supabase = get_supabase_client()
    
    data = {
        "job_id": job_id,
        "directory_name": directory,
        "event": event,
        "details": details or {},
        "worker_id": worker_id
    }
    
    supabase.table("queue_history").insert(data).execute()


def get_business_profile(job_id: str) -> Dict[str, Any]:
    """Get business profile for a job."""
    supabase = get_supabase_client()
    
    result = supabase.table("jobs").select("""
        *,
        customer:customers!customer_id(
            business_name,
            email,
            phone,
            website,
            address,
            city,
            state,
            zip,
            description,
            category
        )
    """).eq("id", job_id).single().execute()
    
    if not result.data:
        raise ValueError(f"Job {job_id} not found")
    
    return result.data.get("customer", {})


def upsert_worker_heartbeat(worker_id: str, queue_name: str, status: str, current_job_id: Optional[str] = None, metadata: Optional[Dict] = None):
    """Upsert worker heartbeat."""
    supabase = get_supabase_client()
    
    data = {
        "worker_id": worker_id,
        "queue_name": queue_name,
        "status": status,
        "current_job_id": current_job_id,
        "last_heartbeat": datetime.utcnow().isoformat(),
        "metadata": metadata or {}
    }
    
    supabase.table("worker_heartbeats").upsert(data, on_conflict="worker_id").execute()


def get_directories_for_job(job_id: str) -> List[str]:
    """Get list of directories for a job from directory_submissions."""
    supabase = get_supabase_client()
    
    result = supabase.table("directory_submissions").select("directory_url").eq("submission_queue_id", job_id).eq("status", "pending").execute()
    
    # Extract directory names from URLs
    directories = []
    for row in result.data:
        url = row.get("directory_url", "")
        # Extract domain name as directory identifier
        if url:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc.replace("www.", "")
            directories.append(domain)
    
    return directories


def get_directory_info(directory_name: str) -> Optional[Dict[str, Any]]:
    """
    Get directory information by name/domain.
    
    Args:
        directory_name: Directory domain/name
    
    Returns:
        Dict with directory info or None if not found
    """
    supabase = get_supabase_client()
    
    try:
        # Try to find directory by name or URL
        result = supabase.table("directories").select("*").ilike("name", f"%{directory_name}%").limit(1).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        
        # Try by URL
        result = supabase.table("directories").select("*").ilike("url", f"%{directory_name}%").limit(1).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        
        # Return minimal directory info if not found
        return {
            'id': directory_name,
            'name': directory_name,
            'url': f"https://{directory_name}" if not directory_name.startswith('http') else directory_name
        }
    except Exception as e:
        logger.warning(f"Failed to get directory info for {directory_name}: {e}")
        return {
            'id': directory_name,
            'name': directory_name,
            'url': f"https://{directory_name}" if not directory_name.startswith('http') else directory_name
        }
