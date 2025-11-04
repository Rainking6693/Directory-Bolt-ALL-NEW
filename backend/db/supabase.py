"""Supabase client initialization and connection pooling."""
import os
from typing import Optional
from supabase import create_client, Client
from utils.logging import setup_logger

logger = setup_logger(__name__)

# Global client instance
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Get or create Supabase client with service role key.
    
    Returns:
        Supabase client instance
    
    Raises:
        ValueError: If required environment variables are missing
    """
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
    
    # Check both env var names (SUPABASE_URL for backend, NEXT_PUBLIC_SUPABASE_URL for frontend compatibility)
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing required environment variables: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
        )
    
    logger.info("Initializing Supabase client", extra={"url": supabase_url})
    
    _supabase_client = create_client(supabase_url, supabase_key)
    
    return _supabase_client


def reset_client():
    """Reset the global client (useful for testing)."""
    global _supabase_client
    _supabase_client = None
