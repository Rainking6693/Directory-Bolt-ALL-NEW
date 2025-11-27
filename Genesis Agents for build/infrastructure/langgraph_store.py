"""
LangGraph Store API Integration with MongoDB Backend

This module implements the LangGraph Store abstraction for Genesis multi-agent system,
providing persistent memory storage across agent sessions, businesses, and evolution cycles.

Features:
- Async MongoDB backend for production use
- Namespace-based organization (agent, business, evolution, consensus)
- Full CRUD operations (put, get, delete, search)
- Cross-session memory persistence
- TTL (Time-To-Live) policies per namespace
- <100ms target latency for put/get operations

TTL Policies:
- agent namespace: 7 days (168 hours)
- business namespace: 90 days (2160 hours)
- evolution namespace: 365 days (8760 hours)
- consensus namespace: permanent (never expires)

Usage:
    store = GenesisLangGraphStore()
    await store.setup_indexes()  # Create TTL indexes
    await store.put(("agent", "qa_agent"), "preferences", {"threshold": 0.95})
    data = await store.get(("agent", "qa_agent"), "preferences")
"""

import asyncio
import json
import os
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime, timedelta, timezone
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from langgraph.store.base import BaseStore

from infrastructure.memory.genesis_sql_memory import (
    GenesisSQLMemoryBackend,
    memori_enabled,
)

logger = logging.getLogger(__name__)

try:  # Optional dependency: compliance layer may not be available during early boot
    from infrastructure.memory.compliance_layer import MemoryComplianceLayer
except Exception:  # pragma: no cover - compliance layer is optional
    MemoryComplianceLayer = None  # type: ignore

try:  # Optional dependency: DeepSeek compression
    from infrastructure.memory.deepseek_compression import DeepSeekCompressor, CompressedMemory
except Exception:  # pragma: no cover - fallback when compression unavailable
    DeepSeekCompressor = None  # type: ignore
    CompressedMemory = None  # type: ignore


class GenesisLangGraphStore(BaseStore):
    """
    LangGraph Store implementation backed by MongoDB.

    Provides persistent memory storage for Genesis agents with namespace-based organization.
    Compatible with LangGraph's BaseStore interface for seamless integration.

    Design based on (via Context7 MCP):
    - LangGraph Store API v1.0 (Context7: /langchain-ai/langgraph)
    - MongoDB TTL best practices (Context7: /mongodb/docs/tutorial/expire-data)
    - Namespace isolation patterns (LangGraph team recommendations)

    Namespace Types:
        - ("agent", agent_name): Agent-specific configurations and learned patterns (TTL: 7 days)
        - ("business", business_id): Business-specific context and history (TTL: 90 days)
        - ("evolution", generation_id): SE-Darwin evolution logs and trajectories (TTL: 365 days)
        - ("consensus", procedure_id): Verified team procedures and best practices (TTL: permanent)

    TTL Policy Design (from Context7 research on LangGraph Store patterns):
    - agent: 7 days (short-term config, high churn rate)
    - business: 90 days (seasonal patterns, quarterly review cycles)
    - evolution: 365 days (long-term learning, annual analysis windows)
    - consensus: permanent (institutional knowledge, verified procedures)

    Attributes:
        client: AsyncIOMotorClient for MongoDB connection
        db: Database handle for genesis_memory
        _connection_pool_size: Max concurrent connections (default: 100)
        ttl_policies: TTL configuration per namespace type (seconds)
    """

    # TTL policies in seconds
    TTL_POLICIES = {
        "agent": 7 * 24 * 60 * 60,        # 7 days
        "business": 90 * 24 * 60 * 60,    # 90 days
        "evolution": 365 * 24 * 60 * 60,  # 365 days
        "consensus": None,                 # Never expires
    }

    # Valid namespace types
    VALID_NAMESPACE_TYPES = {"agent", "business", "evolution", "consensus"}

    def __init__(
        self,
        mongodb_uri: str = "mongodb://localhost:27017/",
        database_name: str = "genesis_memory",
        connection_pool_size: int = 100,
        timeout_ms: int = 5000
    ):
        """
        Initialize LangGraph Store with MongoDB backend.

        Args:
            mongodb_uri: MongoDB connection string
            database_name: Database name for memory storage
            connection_pool_size: Max concurrent connections
            timeout_ms: Operation timeout in milliseconds
        """
        self._timeout_ms = timeout_ms
        self._indexes_created = False
        self._use_sql_backend = memori_enabled()
        self.sql_backend: Optional[GenesisSQLMemoryBackend] = None

        if self._use_sql_backend:
            self.client = None
            self.db = None
            self.sql_backend = GenesisSQLMemoryBackend()
            logger.info("GenesisLangGraphStore configured with Memori SQL backend")
        else:
            self.client = AsyncIOMotorClient(
                mongodb_uri,
                maxPoolSize=connection_pool_size,
                serverSelectionTimeoutMS=timeout_ms,
                tz_aware=True  # Ensure timezone-aware datetime objects
            )
            self.db = self.client[database_name]

        self.compliance: Optional[MemoryComplianceLayer] = None

        if MemoryComplianceLayer is not None:
            try:
                self.compliance = MemoryComplianceLayer(self)
                logger.info("Memory compliance layer enabled")
            except Exception as exc:
                logger.warning("Failed to initialise memory compliance layer: %s", exc)

        self.enable_compression = (
            os.getenv("ENABLE_MEMORY_COMPRESSION", "true").lower() == "true"
            and DeepSeekCompressor is not None
        )
        self.compression_min_bytes = int(os.getenv("MEMORY_COMPRESSION_MIN_BYTES", "600"))
        self.compressor: Optional[DeepSeekCompressor] = DeepSeekCompressor() if self.enable_compression else None
        if self.enable_compression and self.compressor:
            logger.info("DeepSeek-OCR compression enabled for LangGraphStore")

        backend_label = "Memori(SQL)" if self._use_sql_backend else f"MongoDB ({database_name})"
        logger.info(f"Initialized GenesisLangGraphStore with backend: {backend_label}")

    def _validate_namespace(self, namespace: Tuple[str, ...]) -> None:
        """
        Validate namespace structure and type.

        Args:
            namespace: Namespace tuple to validate

        Raises:
            ValueError: If namespace is invalid
        """
        if not namespace or len(namespace) < 1:
            raise ValueError("Namespace must be non-empty tuple with at least one element")

        namespace_type = namespace[0]
        if namespace_type not in self.VALID_NAMESPACE_TYPES:
            raise ValueError(
                f"Invalid namespace type: {namespace_type}. "
                f"Must be one of: {', '.join(self.VALID_NAMESPACE_TYPES)}"
            )

    def _get_ttl_for_namespace(self, namespace: Tuple[str, ...]) -> Optional[int]:
        """
        Get TTL (in seconds) for a namespace type.

        Args:
            namespace: Namespace tuple

        Returns:
            TTL in seconds, or None if permanent
        """
        namespace_type = namespace[0]
        return self.TTL_POLICIES.get(namespace_type)

    async def _compress_value(
        self,
        namespace: Tuple[str, ...],
        value: Any,
        metadata: Dict[str, Any],
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        Optionally compress `value` using DeepSeek-OCR.
        """
        if not self.enable_compression or not self.compressor:
            return value, metadata

        try:
            namespace_label = list(namespace)
            if isinstance(value, str):
                original_text = value
                original_type = "text"
            else:
                original_text = json.dumps(value, ensure_ascii=False)
                original_type = "json"

            original_bytes = len(original_text.encode("utf-8"))
            if original_bytes < self.compression_min_bytes:
                return value, metadata

            compression_metadata = dict(metadata)
            compression_metadata.setdefault("namespace", namespace_label)

            compressed = await self.compressor.compress_memory(original_text, compression_metadata)
            compressed_dict = compressed.to_dict()

            metadata.setdefault("compression", {})
            metadata["compression"].update(
                {
                    "algorithm": compressed.metadata.get("algorithm", "deepseek_ocr"),
                    "ratio": compressed.compression_ratio,
                    "original_bytes": compressed.original_size,
                    "compressed_bytes": compressed.compressed_size,
                    "stored_bytes": compressed.metadata.get("stored_bytes"),
                    "saved_bytes": compressed.metadata.get("saved_bytes"),
                    "chunk_count": compressed.metadata.get("chunk_count"),
                    "timestamp": compressed.metadata.get("timestamp"),
                    "namespace": list(namespace),
                }
            )

            stored_value = {
                "__compressed__": True,
                "algorithm": compressed.metadata.get("algorithm", "deepseek_ocr"),
                "original_type": original_type,
                "payload": compressed_dict,
            }
            return stored_value, metadata
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to compress memory value: %s", exc, exc_info=True)
            return value, metadata

    async def _decompress_value(self, stored_value: Any, metadata: Dict[str, Any]) -> Any:
        """
        Decompress values stored with DeepSeek-OCR when required.
        """
        if not isinstance(stored_value, dict) or "__compressed__" not in stored_value:
            return stored_value

        if not self.enable_compression or not self.compressor or CompressedMemory is None:
            return stored_value

        try:
            payload = stored_value.get("payload", {})
            compressed = CompressedMemory.from_dict(payload)
            namespace = metadata.get("compression", {}).get("namespace") or metadata.get("namespace")

            full_text = compressed.reconstruct_full_text()
            metadata.setdefault("compression", {})
            metadata["compression"]["last_decompressed"] = datetime.now(timezone.utc).isoformat()

            if stored_value.get("original_type") == "json":
                return json.loads(full_text)
            return full_text
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to decompress memory value: %s", exc, exc_info=True)
            return stored_value

    async def setup_indexes(self) -> Dict[str, Any]:
        """
        Create TTL indexes for all namespace types.

        MongoDB TTL indexes automatically delete documents after expiration.
        This method should be called once during application startup.

        Returns:
            Dict with index creation results per namespace type

        Example:
            store = GenesisLangGraphStore()
            results = await store.setup_indexes()
            print(f"Created indexes: {results}")
        """
        if self._use_sql_backend:
            self._indexes_created = True
            logger.info("Memori backend active - SQL constraints handle TTL, skipping Mongo indexes")
            return {"status": "memori_backend"}

        if self._indexes_created:
            logger.info("Indexes already created, skipping")
            return {"status": "already_created"}

        results = {}

        for namespace_type, ttl_seconds in self.TTL_POLICIES.items():
            # Skip permanent namespaces (no TTL index needed)
            if ttl_seconds is None:
                results[namespace_type] = {"status": "permanent", "ttl": None}
                logger.info(f"Namespace '{namespace_type}' is permanent, no TTL index needed")
                continue

            # Get collection for this namespace type
            # We use a pattern collection name since actual namespaces vary
            # MongoDB TTL works at collection level, so we'll apply to all collections
            # matching this namespace type prefix

            # For now, we'll create the TTL index when collections are first accessed
            # This is more efficient than pre-creating for all possible combinations
            results[namespace_type] = {
                "status": "ttl_configured",
                "ttl_seconds": ttl_seconds,
                "ttl_days": ttl_seconds / (24 * 60 * 60)
            }
            logger.info(
                f"TTL policy configured for '{namespace_type}': "
                f"{ttl_seconds}s ({ttl_seconds / (24 * 60 * 60)} days)"
            )

        self._indexes_created = True
        logger.info("TTL index setup complete")
        return results

    async def _ensure_ttl_index(self, collection, namespace: Tuple[str, ...]) -> None:
        """
        Ensure TTL index exists for a collection.

        Creates a TTL index on the 'created_at' field if one doesn't exist.

        Args:
            collection: MongoDB collection
            namespace: Namespace tuple
        """
        if self._use_sql_backend or collection is None:
            return

        namespace_type = namespace[0]
        ttl_seconds = self._get_ttl_for_namespace(namespace)

        # Skip if permanent namespace
        if ttl_seconds is None:
            return

        # Check if TTL index exists
        existing_indexes = await collection.index_information()

        # Look for existing TTL index on created_at
        has_ttl_index = False
        for index_name, index_info in existing_indexes.items():
            if 'expireAfterSeconds' in index_info:
                has_ttl_index = True
                break

        # Create TTL index if it doesn't exist
        if not has_ttl_index:
            try:
                await collection.create_index(
                    "created_at",
                    expireAfterSeconds=ttl_seconds,
                    name=f"ttl_{namespace_type}"
                )
                logger.info(
                    f"Created TTL index for {namespace}: {ttl_seconds}s "
                    f"({ttl_seconds / (24 * 60 * 60)} days)"
                )
            except Exception as e:
                logger.warning(f"Failed to create TTL index for {namespace}: {e}")

    async def put(
        self,
        namespace: Tuple[str, ...],
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None,
        actor: Optional[str] = None,
    ) -> None:
        """
        Store data in the specified namespace with TTL support.

        Example:
            await store.put(("agent", "qa_agent"), "preferences", {"threshold": 0.95})

        Args:
            namespace: Tuple identifying the namespace (e.g., ("agent", "qa_agent"))
            key: Unique key within the namespace
            value: Data to store (must be JSON-serializable dict)
            metadata: Optional metadata for the entry

        Raises:
            ValueError: If namespace or key is empty, or namespace type is invalid
            TimeoutError: If operation exceeds timeout
        """
        if not key:
            raise ValueError("Key must be non-empty")

        # Validate namespace
        self._validate_namespace(namespace)

        metadata_copy = metadata.copy() if metadata else {}
        value_to_store: Any = value
        if self.compliance:
            value_to_store, metadata_copy = self.compliance.before_write(
                namespace,
                key,
                value_to_store,
                metadata_copy,
                actor=actor,
            )

        if isinstance(value_to_store, (str, dict)) and self.enable_compression:
            value_to_store, metadata_copy = await self._compress_value(namespace, value_to_store, metadata_copy)

        ttl_seconds = metadata_copy.get("ttl_seconds")
        if ttl_seconds is None:
            ttl_seconds = self._get_ttl_for_namespace(namespace)
            if ttl_seconds is not None:
                metadata_copy["ttl_seconds"] = ttl_seconds

        if self._use_sql_backend and self.sql_backend:
            await self.sql_backend.put(namespace, key, value_to_store, metadata_copy, ttl_seconds)
            if self.compliance:
                self.compliance.record_access(
                    namespace,
                    key,
                    actor,
                    action="write",
                    metadata=metadata_copy,
                )
            return

        collection = self._get_collection(namespace)

        # Ensure TTL index exists for this collection
        await self._ensure_ttl_index(collection, namespace)

        # Use timezone-aware UTC timestamp for MongoDB TTL
        now = datetime.now(timezone.utc)

        document = {
            "key": key,
            "namespace": list(namespace),
            "value": value_to_store,
            "metadata": metadata_copy,
            "created_at": now,
            "updated_at": now
        }

        try:
            await asyncio.wait_for(
                collection.update_one(
                    {"key": key},
                    {"$set": document},
                    upsert=True
                ),
                timeout=self._timeout_ms / 1000
            )
            logger.debug(f"Stored {namespace}:{key}")
            if self.compliance:
                self.compliance.record_access(
                    namespace,
                    key,
                    actor,
                    action="write",
                    metadata=document.get("metadata"),
                )
        except asyncio.TimeoutError:
            logger.error(f"Timeout storing {namespace}:{key}")
            raise TimeoutError(f"Put operation exceeded {self._timeout_ms}ms")

    async def get(
        self,
        namespace: Tuple[str, ...],
        key: str,
        actor: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve data from the specified namespace.

        Example:
            data = await store.get(("agent", "qa_agent"), "preferences")

        Args:
            namespace: Tuple identifying the namespace
            key: Unique key within the namespace

        Returns:
            Stored value dict, or None if not found

        Raises:
            TimeoutError: If operation exceeds timeout
        """
        if self._use_sql_backend and self.sql_backend:
            record = await self.sql_backend.get(namespace, key)
            if not record:
                logger.debug(f"Key not found: {namespace}:{key}")
                return None

            metadata = record.get("metadata", {}) or {}
            value = await self._decompress_value(record.get("value"), metadata)
            if self.compliance:
                self.compliance.record_access(
                    namespace,
                    key,
                    actor,
                    action="read",
                    metadata=metadata,
                )
            return value

        collection = self._get_collection(namespace)

        try:
            doc = await asyncio.wait_for(
                collection.find_one({"key": key}),
                timeout=self._timeout_ms / 1000
            )

            if doc:
                logger.debug(f"Retrieved {namespace}:{key}")
                if self.compliance:
                    self.compliance.record_access(
                        namespace,
                        key,
                        actor,
                        action="read",
                        metadata=doc.get("metadata"),
                    )
                value = doc.get("value")
                metadata = doc.get("metadata", {})
                value = await self._decompress_value(value, metadata)
                doc["value"] = value
                doc["metadata"] = metadata
                return value
            else:
                logger.debug(f"Key not found: {namespace}:{key}")
                return None
        except asyncio.TimeoutError:
            logger.error(f"Timeout retrieving {namespace}:{key}")
            raise TimeoutError(f"Get operation exceeded {self._timeout_ms}ms")

    async def delete(
        self,
        namespace: Tuple[str, ...],
        key: str,
        actor: Optional[str] = None,
    ) -> bool:
        """
        Delete data from the specified namespace.

        Example:
            deleted = await store.delete(("agent", "qa_agent"), "old_config")

        Args:
            namespace: Tuple identifying the namespace
            key: Unique key within the namespace

        Returns:
            True if deleted, False if key didn't exist

        Raises:
            TimeoutError: If operation exceeds timeout
        """
        if self._use_sql_backend and self.sql_backend:
            deleted = await self.sql_backend.delete(namespace, key)
            if deleted and self.compliance:
                self.compliance.record_access(
                    namespace,
                    key,
                    actor,
                    action="delete",
                )
            if not deleted:
                logger.debug(f"Key not found for deletion: {namespace}:{key}")
            return deleted

        collection = self._get_collection(namespace)

        try:
            result = await asyncio.wait_for(
                collection.delete_one({"key": key}),
                timeout=self._timeout_ms / 1000
            )

            deleted = result.deleted_count > 0
            if deleted:
                logger.debug(f"Deleted {namespace}:{key}")
                if self.compliance:
                    self.compliance.record_access(
                        namespace,
                        key,
                        actor,
                        action="delete",
                    )
            else:
                logger.debug(f"Key not found for deletion: {namespace}:{key}")
            return deleted
        except asyncio.TimeoutError:
            logger.error(f"Timeout deleting {namespace}:{key}")
            raise TimeoutError(f"Delete operation exceeded {self._timeout_ms}ms")

    async def search(
        self,
        namespace: Tuple[str, ...],
        query: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        actor: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for entries within the specified namespace.

        Example:
            # Find all preferences for qa_agent
            results = await store.search(("agent", "qa_agent"))

            # Find specific entries
            results = await store.search(
                ("agent", "qa_agent"),
                query={"value.threshold": {"$gt": 0.9}}
            )

        Args:
            namespace: Tuple identifying the namespace
            query: MongoDB query dict (optional, searches all if None)
            limit: Maximum number of results to return

        Returns:
            List of matching documents

        Raises:
            TimeoutError: If operation exceeds timeout
        """
        if self._use_sql_backend and self.sql_backend:
            records = await self.sql_backend.search(namespace, query, limit)
            formatted_results: List[Dict[str, Any]] = []
            for record in records:
                metadata = record.get("metadata", {}) or {}
                value = await self._decompress_value(record.get("value"), metadata)
                formatted_results.append(
                    {
                        "key": record.get("key"),
                        "value": value,
                        "metadata": metadata,
                        "created_at": record.get("created_at"),
                        "updated_at": record.get("updated_at"),
                    }
                )
                if self.compliance:
                    self.compliance.record_access(
                        namespace,
                        record.get("key"),
                        actor,
                        action="search",
                        metadata=metadata,
                    )
            return formatted_results

        collection = self._get_collection(namespace)

        # Build query
        search_query = query or {}
        if self.compliance:
            search_query = self.compliance.sanitize_query(search_query)

        try:
            cursor = collection.find(search_query).limit(limit)
            results = await asyncio.wait_for(
                cursor.to_list(length=limit),
                timeout=self._timeout_ms / 1000
            )

            logger.debug(f"Search in {namespace} returned {len(results)} results")
            if self.compliance:
                self.compliance.record_access(
                    namespace,
                    "*",
                    actor,
                    action="search",
                    metadata={"result_count": len(results)}
                )

            formatted_results: List[Dict[str, Any]] = []
            for doc in results:
                metadata = doc.get("metadata", {})
                value = await self._decompress_value(doc.get("value"), metadata)
                formatted_results.append(
                    {
                        "key": doc["key"],
                        "value": value,
                        "metadata": metadata,
                        "created_at": doc.get("created_at"),
                        "updated_at": doc.get("updated_at")
                    }
                )
            return formatted_results
        except asyncio.TimeoutError:
            logger.error(f"Timeout searching {namespace}")
            raise TimeoutError(f"Search operation exceeded {self._timeout_ms}ms")

    async def list_namespaces(
        self,
        prefix: Optional[Tuple[str, ...]] = None
    ) -> List[Tuple[str, ...]]:
        """
        List all namespaces, optionally filtered by prefix.

        Example:
            # List all agent namespaces
            agent_namespaces = await store.list_namespaces(("agent",))

        Args:
            prefix: Namespace prefix to filter by (optional)

        Returns:
            List of namespace tuples
        """
        if self._use_sql_backend and self.sql_backend:
            namespaces = await self.sql_backend.list_namespaces()
            if prefix:
                namespaces = [
                    ns for ns in namespaces
                    if ns[:len(prefix)] == prefix
                ]
            return namespaces

        collection_names = await self.db.list_collection_names()

        namespaces_set = set()
        for coll_name in collection_names:
            if coll_name.startswith("system."):
                continue

            # Get the collection and read the namespace from any document
            # Since all documents in a collection have the same namespace,
            # we just need to read one document to get the namespace structure
            collection = self.db[coll_name]
            try:
                sample_doc = await collection.find_one({}, {"namespace": 1})
                if sample_doc and "namespace" in sample_doc:
                    # Convert list back to tuple
                    namespace = tuple(sample_doc["namespace"])

                    # Filter by prefix if provided
                    if prefix is None or namespace[:len(prefix)] == prefix:
                        namespaces_set.add(namespace)
            except Exception as e:
                logger.warning(f"Failed to read namespace from collection {coll_name}: {e}")
                continue

        return sorted(list(namespaces_set))

    async def clear_namespace(
        self,
        namespace: Tuple[str, ...]
    ) -> int:
        """
        Delete all entries in a namespace.

        Example:
            deleted_count = await store.clear_namespace(("agent", "old_agent"))

        Args:
            namespace: Tuple identifying the namespace

        Returns:
            Number of entries deleted
        """
        if self._use_sql_backend and self.sql_backend:
            deleted = await self.sql_backend.clear_namespace(namespace)
            logger.info(f"Cleared {deleted} entries from {namespace} (Memori backend)")
            return deleted

        collection = self._get_collection(namespace)

        try:
            result = await asyncio.wait_for(
                collection.delete_many({}),
                timeout=self._timeout_ms / 1000
            )

            count = result.deleted_count
            logger.info(f"Cleared {count} entries from {namespace}")
            return count
        except asyncio.TimeoutError:
            logger.error(f"Timeout clearing {namespace}")
            raise TimeoutError(f"Clear operation exceeded {self._timeout_ms}ms")

    def _get_collection(self, namespace: Tuple[str, ...]) -> Any:
        """
        Get MongoDB collection for the specified namespace.

        Collections are named by joining namespace components with underscores.
        Example: ("agent", "qa_agent") -> "agent_qa_agent"

        Args:
            namespace: Tuple identifying the namespace

        Returns:
            MongoDB collection handle
        """
        if self._use_sql_backend or self.db is None:
            return None

        collection_name = "_".join(str(component) for component in namespace)
        return self.db[collection_name]

    async def close(self) -> None:
        """
        Close the MongoDB connection.

        Should be called during application shutdown.
        """
        if self._use_sql_backend and self.sql_backend:
            await self.sql_backend.close()
            logger.info("Closed GenesisLangGraphStore Memori connection")
            return

        if self.client:
            self.client.close()
        logger.info("Closed GenesisLangGraphStore connection")

    async def health_check(self) -> Dict[str, Any]:
        """
        Check MongoDB connection health.

        Returns:
            Dict with health status information
        """
        if self._use_sql_backend and self.sql_backend:
            status = await self.sql_backend.health_check()
            status.setdefault("backend", "memori")
            return status

        try:
            await asyncio.wait_for(
                self.client.admin.command('ping'),
                timeout=2.0
            )

            stats = await self.db.command("dbStats")

            return {
                "status": "healthy",
                "database": self.db.name,
                "collections": await self.db.list_collection_names(),
                "size_mb": stats.get("dataSize", 0) / (1024 * 1024),
                "connected": True
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "connected": False
            }

    async def abatch(self, operations: List[Dict[str, Any]]) -> List[Any]:
        """
        Execute a batch of operations asynchronously.

        Args:
            operations: List of operation dicts with 'op', 'namespace', 'key', etc.

        Returns:
            List of operation results
        """
        tasks = []
        for op in operations:
            op_type = op.get("op")
            namespace = op.get("namespace")
            key = op.get("key")

            if op_type == "put":
                tasks.append(self.put(namespace, key, op.get("value"), op.get("metadata")))
            elif op_type == "get":
                tasks.append(self.get(namespace, key))
            elif op_type == "delete":
                tasks.append(self.delete(namespace, key))
            elif op_type == "search":
                tasks.append(self.search(namespace, op.get("query"), op.get("limit", 100)))

        return await asyncio.gather(*tasks)

    def batch(self, operations: List[Dict[str, Any]]) -> List[Any]:
        """
        Execute a batch of operations synchronously.

        Args:
            operations: List of operation dicts

        Returns:
            List of operation results
        """
        # Run async batch in event loop
        return asyncio.run(self.abatch(operations))


# Singleton instance for global access
_store_instance: Optional[GenesisLangGraphStore] = None


def get_store(
    mongodb_uri: str = "mongodb://localhost:27017/",
    **kwargs
) -> GenesisLangGraphStore:
    """
    Get or create singleton GenesisLangGraphStore instance.

    Args:
        mongodb_uri: MongoDB connection string
        **kwargs: Additional arguments passed to GenesisLangGraphStore

    Returns:
        Singleton store instance
    """
    global _store_instance

    if _store_instance is None:
        _store_instance = GenesisLangGraphStore(mongodb_uri, **kwargs)

    return _store_instance
