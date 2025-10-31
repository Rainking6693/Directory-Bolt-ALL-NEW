"""Retry utilities with exponential backoff and jitter."""
import random
import time
from functools import wraps
from typing import Callable, Type, Tuple


def exponential_backoff_with_jitter(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True
) -> float:
    """
    Calculate exponential backoff delay with optional jitter.
    
    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap in seconds
        jitter: Whether to add random jitter
    
    Returns:
        Delay in seconds
    """
    # Exponential: base * 2^attempt
    delay = min(base_delay * (2 ** attempt), max_delay)
    
    # Add jitter (±25%)
    if jitter:
        jitter_range = delay * 0.25
        delay += random.uniform(-jitter_range, jitter_range)
    
    return max(0, delay)


def retry_with_backoff(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,)
):
    """
    Decorator for retrying functions with exponential backoff.
    
    Args:
        max_attempts: Maximum number of attempts
        base_delay: Base delay between retries
        max_delay: Maximum delay cap
        exceptions: Tuple of exception types to catch and retry
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_attempts - 1:
                        delay = exponential_backoff_with_jitter(attempt, base_delay, max_delay)
                        time.sleep(delay)
                    else:
                        # Last attempt failed
                        raise last_exception
            
            # Should never reach here
            raise last_exception
        
        return wrapper
    return decorator
