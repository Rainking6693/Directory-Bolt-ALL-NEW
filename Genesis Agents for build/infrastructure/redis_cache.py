"""
Redis Caching Layer for Genesis Memory Store

Implements cache-aside pattern with intelligent TTL management:
- Hot memories (accessed <1 hour ago): 1 hour TTL
- Warm memories (accessed 1-24 hours ago): 24 hour TTL
- Cold memories (not accessed recently): Not cached

Performance targets:
- Cache hit: <10ms P95
- Cache miss + populate: <50ms P95 (MongoDB read + Redis write)
- Cache hit rate: >80% for hot memories

Architecture:
┌──────────────┐
│ GenesisMemory│
│    Store     │
└──────┬───────┘
       │
       ▼
┌──────────────┐    Hit     ┌──────────┐
│   Redis      │◄──────────►│  Client  │
│   Cache      │            └──────────┘
└──────┬───────┘
       │ Miss
       ▼
┌──────────────┐
│   MongoDB    │
│   Backend    │
└──────────────┘
"""

import asyncio
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import redis.asyncio as aioredis
from redis.exceptions import ConnectionError, TimeoutError, RedisError

from infrastructure.logging_config import get_logger
from infrastructure.memory_store import MemoryEntry
from infrastructure.observability import get_observability_manager, SpanType

logger = get_logger(__name__)
obs_manager = get_observability_manager()


class RedisCacheLayer:
    """
    Fast memory cache using Redis

    Implements cache-aside pattern with automatic TTL management
    based on access patterns.
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl_seconds: int = 3600,  # 1 hour
        hot_ttl_seconds: int = 3600,       # 1 hour
        warm_ttl_seconds: int = 86400,     # 24 hours
        max_connections: int = 10
    ):
        """
        Initialize Redis cache layer

        Args:
            redis_url: Redis connection string (defaults to env var or localhost)
            default_ttl_seconds: Default TTL for cached entries
            hot_ttl_seconds: TTL for hot memories (accessed <1h ago)
            warm_ttl_seconds: TTL for warm memories (accessed 1-24h ago)
            max_connections: Maximum Redis connection pool size
        """
        self.redis_url = (
            redis_url
            or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        )

        self.default_ttl = default_ttl_seconds
        self.hot_ttl = hot_ttl_seconds
        self.warm_ttl = warm_ttl_seconds

        self.redis: Optional[aioredis.Redis] = None
        self._connected = False
        self.max_connections = max_connections

        # Cache statistics
        self.stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "evictions": 0
        }

        logger.info(
            "RedisCacheLayer initialized",
            extra={
                "redis_url": self.redis_url,
                "default_ttl": self.default_ttl,
                "hot_ttl": self.hot_ttl,
                "warm_ttl": self.warm_ttl
            }
        )

    async def connect(self) -> None:
        """Connect to Redis"""
        if self._connected:
            return

        with obs_manager.span(
            "redis.connect",
            SpanType.EXECUTION,
            attributes={"redis_url": self.redis_url}
        ) as span:
            try:
                self.redis = await aioredis.from_url(
                    self.redis_url,
                    max_connections=self.max_connections,
                    decode_responses=False,  # We'll handle JSON encoding
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True
                )

                # Test connection
                await self.redis.ping()

                self._connected = True
                span.set_attribute("connected", True)

                logger.info(
                    "Redis connected",
                    extra={"redis_url": self.redis_url}
                )

            except (ConnectionError, TimeoutError) as e:
                span.set_attribute("connected", False)
                logger.error(
                    f"Redis connection failed: {e}",
                    exc_info=True,
                    extra={"redis_url": self.redis_url, "error": str(e)}
                )
                # Don't raise - degrade gracefully
                self._connected = False

    def _make_cache_key(self, namespace: Tuple[str, str], key: str) -> str:
        """
        Generate cache key from namespace and key

        Format: genesis:memory:{namespace_type}:{namespace_id}:{key}
        """
        namespace_type, namespace_id = namespace
        return f"genesis:memory:{namespace_type}:{namespace_id}:{key}"

    def _calculate_ttl(self, entry: MemoryEntry) -> int:
        """
        Calculate TTL based on access pattern

        Hot (accessed <1h ago): 1 hour TTL
        Warm (accessed 1-24h ago): 24 hour TTL
        Cold (accessed >24h ago): Use default TTL
        """
        try:
            last_accessed = datetime.fromisoformat(entry.metadata.last_accessed)
            # Ensure timezone awareness to prevent naive vs aware datetime comparison crash
            if last_accessed.tzinfo is None:
                last_accessed = last_accessed.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            time_since_access = now - last_accessed

            if time_since_access < timedelta(hours=1):
                return self.hot_ttl
            elif time_since_access < timedelta(hours=24):
                return self.warm_ttl
            else:
                return self.default_ttl

        except Exception:
            # Fallback to default TTL if parsing fails
            return self.default_ttl

    async def get(
        self,
        namespace: Tuple[str, str],
        key: str
    ) -> Optional[MemoryEntry]:
        """
        Get entry from cache

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key

        Returns:
            MemoryEntry if found in cache, None otherwise
        """
        if not self._connected:
            await self.connect()

        if not self._connected:
            # Redis unavailable - return None (cache miss)
            return None

        with obs_manager.timed_operation(
            "redis.get",
            SpanType.EXECUTION
        ) as span:
            cache_key = self._make_cache_key(namespace, key)

            try:
                cached_data = await self.redis.get(cache_key)

                if cached_data:
                    # Cache hit
                    entry_dict = json.loads(cached_data)
                    entry = MemoryEntry.from_dict(entry_dict)

                    self.stats["hits"] += 1
                    span.set_attribute("cache_hit", True)

                    obs_manager.record_metric(
                        metric_name="redis.cache.hit",
                        value=1,
                        unit="count",
                        labels={"namespace_type": namespace[0]}
                    )

                    logger.debug(
                        f"Redis cache hit: {namespace}/{key}",
                        extra={
                            "namespace": namespace,
                            "key": key,
                            "cache_key": cache_key
                        }
                    )

                    return entry
                else:
                    # Cache miss
                    self.stats["misses"] += 1
                    span.set_attribute("cache_hit", False)

                    obs_manager.record_metric(
                        metric_name="redis.cache.miss",
                        value=1,
                        unit="count",
                        labels={"namespace_type": namespace[0]}
                    )

                    logger.debug(
                        f"Redis cache miss: {namespace}/{key}",
                        extra={"namespace": namespace, "key": key}
                    )

                    return None

            except (ConnectionError, TimeoutError, RedisError) as e:
                self.stats["errors"] += 1
                logger.warning(
                    f"Redis get error (degrading gracefully): {e}",
                    extra={"namespace": namespace, "key": key, "error": str(e)}
                )
                return None

    async def set(
        self,
        namespace: Tuple[str, str],
        key: str,
        entry: MemoryEntry,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set entry in cache

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key
            entry: MemoryEntry to cache
            ttl: Optional TTL override (seconds)

        Returns:
            True if successful, False otherwise
        """
        if not self._connected:
            await self.connect()

        if not self._connected:
            # Redis unavailable - fail silently
            return False

        with obs_manager.timed_operation(
            "redis.set",
            SpanType.EXECUTION
        ) as span:
            cache_key = self._make_cache_key(namespace, key)

            # Calculate TTL
            effective_ttl = ttl or self._calculate_ttl(entry)

            try:
                # Serialize entry
                entry_json = json.dumps(entry.to_dict())

                # Set with TTL
                await self.redis.setex(
                    cache_key,
                    effective_ttl,
                    entry_json
                )

                span.set_attribute("ttl_seconds", effective_ttl)
                span.set_attribute("success", True)

                logger.debug(
                    f"Redis cache set: {namespace}/{key} (TTL={effective_ttl}s)",
                    extra={
                        "namespace": namespace,
                        "key": key,
                        "ttl_seconds": effective_ttl
                    }
                )

                return True

            except (ConnectionError, TimeoutError, RedisError) as e:
                self.stats["errors"] += 1
                span.set_attribute("success", False)

                logger.warning(
                    f"Redis set error (degrading gracefully): {e}",
                    extra={"namespace": namespace, "key": key, "error": str(e)}
                )
                return False

    async def delete(
        self,
        namespace: Tuple[str, str],
        key: str
    ) -> bool:
        """
        Delete entry from cache

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key

        Returns:
            True if deleted, False otherwise
        """
        if not self._connected:
            await self.connect()

        if not self._connected:
            return False

        cache_key = self._make_cache_key(namespace, key)

        try:
            deleted_count = await self.redis.delete(cache_key)
            self.stats["evictions"] += deleted_count

            logger.debug(
                f"Redis cache delete: {namespace}/{key}",
                extra={"namespace": namespace, "key": key, "deleted": deleted_count > 0}
            )

            return deleted_count > 0

        except (ConnectionError, TimeoutError, RedisError) as e:
            logger.warning(
                f"Redis delete error: {e}",
                extra={"namespace": namespace, "key": key, "error": str(e)}
            )
            return False

    async def clear_namespace(
        self,
        namespace: Tuple[str, str]
    ) -> int:
        """
        Clear all cache entries for namespace

        Args:
            namespace: (namespace_type, namespace_id) tuple

        Returns:
            Number of entries cleared
        """
        if not self._connected:
            await self.connect()

        if not self._connected:
            return 0

        namespace_type, namespace_id = namespace
        pattern = f"genesis:memory:{namespace_type}:{namespace_id}:*"

        try:
            # Find all keys matching pattern
            keys = []
            async for key in self.redis.scan_iter(match=pattern, count=100):
                keys.append(key)

            if keys:
                # Delete all keys
                deleted_count = await self.redis.delete(*keys)
                self.stats["evictions"] += deleted_count

                logger.info(
                    f"Redis cache cleared: {namespace} ({deleted_count} entries)",
                    extra={"namespace": namespace, "count": deleted_count}
                )

                return deleted_count

            return 0

        except (ConnectionError, TimeoutError, RedisError) as e:
            logger.warning(
                f"Redis clear_namespace error: {e}",
                extra={"namespace": namespace, "error": str(e)}
            )
            return 0

    async def get_or_fetch(
        self,
        namespace: Tuple[str, str],
        key: str,
        fetch_fn: callable
    ) -> Optional[MemoryEntry]:
        """
        Cache-aside pattern: Check cache, fetch if miss, populate cache

        This is the primary method for using the cache layer.

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key
            fetch_fn: Async callable to fetch from backend if cache miss

        Returns:
            MemoryEntry if found (cache or backend), None otherwise
        """
        with obs_manager.timed_operation(
            "redis.get_or_fetch",
            SpanType.EXECUTION
        ):
            # Try cache first
            cached_entry = await self.get(namespace, key)

            if cached_entry:
                # Cache hit - return immediately
                return cached_entry

            # Cache miss - fetch from backend
            entry = await fetch_fn()

            if entry:
                # Populate cache for future requests
                await self.set(namespace, key, entry)

            return entry

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Dictionary with cache stats (hits, misses, hit rate, etc.)
        """
        total_requests = self.stats["hits"] + self.stats["misses"]
        hit_rate = self.stats["hits"] / total_requests if total_requests > 0 else 0.0

        return {
            "hits": self.stats["hits"],
            "misses": self.stats["misses"],
            "errors": self.stats["errors"],
            "evictions": self.stats["evictions"],
            "total_requests": total_requests,
            "hit_rate": hit_rate,
            "hit_rate_percentage": hit_rate * 100
        }

    def reset_stats(self) -> None:
        """Reset cache statistics"""
        self.stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "evictions": 0
        }

    async def close(self) -> None:
        """Close Redis connection"""
        if self.redis:
            await self.redis.aclose()
            self._connected = False
            logger.info("Redis connection closed")


# Export public API
__all__ = ["RedisCacheLayer"]
