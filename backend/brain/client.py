"""HTTP client for CrewAI brain service."""
import os
from typing import Dict, Any, Optional
import httpx
from utils.logging import setup_logger
from utils.retry import retry_with_backoff

logger = setup_logger(__name__)

BRAIN_URL = os.getenv("CREWAI_URL", "http://brain:8080")

# Reusable HTTP client with connection pooling
_client: Optional[httpx.Client] = None


def get_client() -> httpx.Client:
    """
    Get or create reusable HTTP client with connection pooling.
    
    Returns:
        httpx.Client instance
    """
    global _client
    if _client is None:
        _client = httpx.Client(
            timeout=30.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )
    return _client


@retry_with_backoff(max_attempts=3, base_delay=1.0)
def get_plan(directory: str, business: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get submission plan from CrewAI brain.
    
    Args:
        directory: Directory name/domain (must be non-empty string)
        business: Business profile dict with required fields
    
    Returns:
        Plan dict with actions, constraints, and idempotency factors
    
    Raises:
        ValueError: If directory or business data is invalid
        httpx.HTTPError: If HTTP request fails
    """
    # Input validation
    if not directory or not isinstance(directory, str) or len(directory.strip()) == 0:
        raise ValueError("directory must be a non-empty string")
    
    if not business or not isinstance(business, dict):
        raise ValueError("business must be a non-empty dict")
    
    logger.info(f"Requesting plan for {directory}")
    
    # Safely extract business fields with defaults
    request_data = {
        "directory": directory,
        "business": {
            "name": business.get("business_name") or business.get("name") or "",
            "phone": business.get("phone") or "",
            "address": business.get("address") or "",
            "city": business.get("city") or "",
            "state": business.get("state") or "",
            "zip": business.get("zip") or "",
            "website": business.get("website") or "",
            "email": business.get("email") or "",
            "description": business.get("description") or business.get("business_description") or "",
            "categories": [business.get("category", "")] if business.get("category") else []
        },
        "hints": {
            "lastKnownFields": {}
        }
    }
    
    try:
        client = get_client()
        response = client.post(f"{BRAIN_URL}/plan", json=request_data)
        response.raise_for_status()
        plan = response.json()
        
        if not isinstance(plan, dict):
            raise ValueError("Invalid plan response format")
        
        logger.info(f"Received plan for {directory}", extra={
            "actions": len(plan.get("plan", [])),
            "has_captcha": plan.get("constraints", {}).get("captcha") == "possible"
        })
        
        return plan
        
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP status error getting plan: {e.response.status_code}", extra={
            "status_code": e.response.status_code,
            "response_preview": str(e.response.text)[:200]
        })
        raise
    except httpx.RequestError as e:
        logger.error(f"Request error getting plan: {e}")
        raise
    except ValueError as e:
        logger.error(f"Invalid response format: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting plan: {e}", extra={"error_type": type(e).__name__})
        raise
