"""HTTP client for CrewAI brain service."""
import os
import httpx
from typing import Dict, Any
from utils.logging import setup_logger
from utils.retry import retry_with_backoff

logger = setup_logger(__name__)

BRAIN_URL = os.getenv("CREWAI_URL", "http://brain:8080")


@retry_with_backoff(max_attempts=3, base_delay=1.0)
def get_plan(directory: str, business: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get submission plan from CrewAI brain.
    
    Args:
        directory: Directory name/domain
        business: Business profile dict
    
    Returns:
        Plan dict with actions, constraints, and idempotency factors
    """
    logger.info(f"Requesting plan for {directory}")
    
    request_data = {
        "directory": directory,
        "business": {
            "name": business.get("business_name", ""),
            "phone": business.get("phone", ""),
            "address": business.get("address", ""),
            "city": business.get("city", ""),
            "state": business.get("state", ""),
            "zip": business.get("zip", ""),
            "website": business.get("website", ""),
            "email": business.get("email", ""),
            "description": business.get("description", ""),
            "categories": [business.get("category", "")]
        },
        "hints": {
            "lastKnownFields": {}
        }
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(f"{BRAIN_URL}/plan", json=request_data)
            response.raise_for_status()
            plan = response.json()
            
            logger.info(f"Received plan for {directory}", extra={
                "actions": len(plan.get("plan", [])),
                "has_captcha": plan.get("constraints", {}).get("captcha") == "possible"
            })
            
            return plan
            
    except httpx.HTTPError as e:
        logger.error(f"HTTP error getting plan: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting plan: {e}")
        raise
