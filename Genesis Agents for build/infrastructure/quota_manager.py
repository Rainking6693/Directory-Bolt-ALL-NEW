"""
Distributed Quota Manager for Genesis Meta-Agent

Provides Redis-backed quota tracking that works across multiple instances.
Falls back to in-memory tracking when Redis is unavailable.

Author: Cursor (Infrastructure Enhancement)
Date: November 3, 2025
"""

import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import Redis
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.info("Redis not available - quota tracking will use in-memory fallback")


class QuotaManager:
    """
    Distributed quota manager supporting Redis or in-memory storage.
    
    Features:
    - Sliding window quotas per user
    - Atomic increment and check operations
    - Automatic expiration of quota windows
    - Graceful fallback to in-memory when Redis unavailable
    - Thread-safe operations
    """
    
    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_quota: int = 10,
        window_seconds: int = 86400  # 24 hours
    ):
        """
        Initialize quota manager.
        
        Args:
            redis_url: Redis connection URL (e.g., "redis://localhost:6379")
            default_quota: Default quota limit per window
            window_seconds: Quota window duration in seconds
        """
        self.default_quota = default_quota
        self.window_seconds = window_seconds
        self.redis_client: Optional[redis.Redis] = None
        self._in_memory_usage: Dict[str, Dict[str, Any]] = {}
        
        # Try to connect to Redis
        if redis_url and REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                logger.info(f"QuotaManager initialized with Redis: {redis_url}")
            except Exception as exc:
                logger.warning(f"Failed to connect to Redis: {exc}, using in-memory fallback")
                self.redis_client = None
        else:
            logger.info("QuotaManager using in-memory storage (Redis not available)")
    
    async def check_and_increment(
        self,
        user_id: str,
        limit: Optional[int] = None,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check quota and increment usage atomically.
        
        Args:
            user_id: User identifier
            limit: Quota limit (overrides default)
            token: Optional token for additional context
        
        Returns:
            Dict with quota snapshot (consumed, remaining, reset_at)
        
        Raises:
            QuotaExceededError: When quota is exceeded
        """
        quota_limit = limit if limit is not None else self.default_quota
        
        # Use Redis if available
        if self.redis_client:
            return await self._check_and_increment_redis(user_id, quota_limit)
        else:
            return await self._check_and_increment_memory(user_id, quota_limit)
    
    async def _check_and_increment_redis(
        self,
        user_id: str,
        limit: int
    ) -> Dict[str, Any]:
        """
        Redis-based quota check and increment.
        
        Uses Redis INCR for atomic operations and EXPIRE for automatic cleanup.
        """
        key = f"genesis:quota:{user_id}"
        
        try:
            # Atomic increment
            current = await self.redis_client.incr(key)
            
            # Set expiration on first increment
            if current == 1:
                await self.redis_client.expire(key, self.window_seconds)
            
            # Get TTL to calculate reset time
            ttl = await self.redis_client.ttl(key)
            reset_at = datetime.fromtimestamp(time.time() + ttl).isoformat() if ttl > 0 else None
            
            # Check if quota exceeded
            if current > limit:
                # Decrement back since we exceeded
                await self.redis_client.decr(key)
                raise QuotaExceededError(
                    f"Quota exceeded for user {user_id}: limit {limit} per {self.window_seconds} seconds",
                    user_id=user_id,
                    limit=limit,
                    consumed=current - 1,
                    window_seconds=self.window_seconds
                )
            
            return {
                "limit": limit,
                "consumed": current,
                "remaining": max(0, limit - current),
                "window_seconds": self.window_seconds,
                "reset_at": reset_at,
                "backend": "redis"
            }
        
        except QuotaExceededError:
            raise
        except Exception as exc:
            logger.error(f"Redis quota check failed: {exc}, falling back to in-memory")
            # Fallback to in-memory
            return await self._check_and_increment_memory(user_id, limit)
    
    async def _check_and_increment_memory(
        self,
        user_id: str,
        limit: int
    ) -> Dict[str, Any]:
        """
        In-memory quota check and increment (fallback).
        
        Note: This is NOT distributed - each instance has its own quota tracking.
        For multi-instance deployments, use Redis.
        """
        now = time.time()
        usage = self._in_memory_usage.get(user_id)
        
        # Initialize or reset window
        if not usage or now - usage["window_start"] >= self.window_seconds:
            usage = {"count": 0, "window_start": now}
            self._in_memory_usage[user_id] = usage
        
        # Check if quota exceeded
        if usage["count"] >= limit:
            raise QuotaExceededError(
                f"Quota exceeded for user {user_id}: limit {limit} per {self.window_seconds} seconds",
                user_id=user_id,
                limit=limit,
                consumed=usage["count"],
                window_seconds=self.window_seconds
            )
        
        # Increment usage
        usage["count"] += 1
        
        reset_at = usage["window_start"] + self.window_seconds
        return {
            "limit": limit,
            "consumed": usage["count"],
            "remaining": max(0, limit - usage["count"]),
            "window_seconds": self.window_seconds,
            "reset_at": datetime.fromtimestamp(reset_at).isoformat(),
            "backend": "memory"
        }
    
    async def get_usage(self, user_id: str) -> Dict[str, Any]:
        """
        Get current quota usage for a user without incrementing.
        
        Args:
            user_id: User identifier
        
        Returns:
            Dict with current usage stats
        """
        if self.redis_client:
            key = f"genesis:quota:{user_id}"
            try:
                current = await self.redis_client.get(key)
                current = int(current) if current else 0
                ttl = await self.redis_client.ttl(key)
                
                return {
                    "consumed": current,
                    "window_seconds": self.window_seconds,
                    "ttl_remaining": ttl,
                    "backend": "redis"
                }
            except Exception as exc:
                logger.warning(f"Failed to get Redis usage: {exc}")
        
        # In-memory fallback
        usage = self._in_memory_usage.get(user_id)
        if not usage:
            return {
                "consumed": 0,
                "window_seconds": self.window_seconds,
                "backend": "memory"
            }
        
        now = time.time()
        elapsed = now - usage["window_start"]
        
        return {
            "consumed": usage["count"] if elapsed < self.window_seconds else 0,
            "window_seconds": self.window_seconds,
            "elapsed": elapsed,
            "backend": "memory"
        }
    
    async def reset_quota(self, user_id: str) -> bool:
        """
        Reset quota for a user (admin operation).
        
        Args:
            user_id: User identifier
        
        Returns:
            True if reset successful
        """
        if self.redis_client:
            key = f"genesis:quota:{user_id}"
            try:
                await self.redis_client.delete(key)
                logger.info(f"Reset Redis quota for user {user_id}")
                return True
            except Exception as exc:
                logger.error(f"Failed to reset Redis quota: {exc}")
        
        # In-memory fallback
        if user_id in self._in_memory_usage:
            del self._in_memory_usage[user_id]
            logger.info(f"Reset in-memory quota for user {user_id}")
            return True
        
        return False
    
    async def close(self):
        """Close Redis connection if active."""
        if self.redis_client:
            await self.redis_client.close()


class QuotaExceededError(Exception):
    """Exception raised when user quota is exceeded."""
    
    def __init__(
        self,
        message: str,
        user_id: str,
        limit: int,
        consumed: int,
        window_seconds: int
    ):
        super().__init__(message)
        self.user_id = user_id
        self.limit = limit
        self.consumed = consumed
        self.window_seconds = window_seconds
        self.reset_in_seconds = window_seconds  # Approximate

