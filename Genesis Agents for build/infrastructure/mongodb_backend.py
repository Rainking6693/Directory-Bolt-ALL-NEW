"""
MongoDB Backend for Genesis Memory Store

Provides persistent storage for agent memories with:
- CRUD operations with atomic updates
- Full-text search capabilities
- Index management for performance
- Connection pooling and error handling
- OTEL observability integration

Schema:
- Database: genesis_memory
- Collections: consensus_memory, persona_libraries, whiteboard_methods
- Document structure: {entry_id, namespace, key, value, metadata}

Performance Targets:
- Put: <50ms P95
- Get: <30ms P95
- Search: <100ms P95
"""

import asyncio
import os
import time
import yaml
from typing import Any, Dict, List, Optional, Tuple

from pymongo import MongoClient, ASCENDING, TEXT
from pymongo.errors import (
    ConnectionFailure,
    DuplicateKeyError,
    OperationFailure,
    ServerSelectionTimeoutError,
)
from pymongo.collection import Collection

from infrastructure.logging_config import get_logger
from infrastructure.memory_store import MemoryEntry, MemoryMetadata
from infrastructure.observability import get_observability_manager, SpanType

logger = get_logger(__name__)
obs_manager = get_observability_manager()


class MongoDBBackend:
    """
    MongoDB backend for persistent memory storage

    Implements the same interface as InMemoryBackend with persistent storage.
    All agents share the same MongoDB instance for true cross-agent memory.
    """

    def __init__(
        self,
        connection_uri: Optional[str] = None,
        database_name: str = "genesis_memory",
        config_path: str = "/home/genesis/genesis-rebuild/config/mongodb_config.yml",
        environment: str = "development"
    ):
        """
        Initialize MongoDB backend

        Args:
            connection_uri: MongoDB connection string (overrides config)
            database_name: Database name (overrides config)
            config_path: Path to mongodb_config.yml
            environment: Environment (development/staging/production)
        """
        self.environment = environment
        self.config = self._load_config(config_path, environment)

        # Connection string priority: parameter > env var > config
        self.connection_uri = (
            connection_uri
            or os.getenv("MONGODB_URI")
            or self.config["connection"]["uri"]
        )

        self.database_name = database_name or self.config["connection"]["database"]

        # Initialize MongoDB client
        self.client: Optional[MongoClient] = None
        self.db = None
        self._lock = asyncio.Lock()
        self._connected = False

        # Collection names
        self.collections_config = self.config["collections"]

        logger.info(
            f"MongoDBBackend initialized for environment: {environment}",
            extra={
                "database": self.database_name,
                "environment": environment
            }
        )

    def _load_config(self, config_path: str, environment: str) -> Dict[str, Any]:
        """Load MongoDB configuration from YAML"""
        try:
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)

            if environment not in config:
                raise ValueError(f"Environment '{environment}' not found in config")

            return config[environment]

        except FileNotFoundError:
            logger.warning(
                f"Config file not found: {config_path}, using defaults",
                extra={"config_path": config_path}
            )
            # Return minimal default config
            return {
                "connection": {
                    "uri": "mongodb://localhost:27017/",
                    "database": "genesis_memory_dev",
                    "max_pool_size": 10,
                    "connect_timeout_ms": 5000
                },
                "collections": {
                    "consensus_memory": {"name": "consensus_memory"},
                    "persona_libraries": {"name": "persona_libraries"},
                    "whiteboard_methods": {"name": "whiteboard_methods"}
                }
            }

    async def connect(self) -> None:
        """
        Connect to MongoDB and setup collections

        Creates indexes for performance.
        """
        if self._connected:
            return

        with obs_manager.span(
            "mongodb.connect",
            SpanType.EXECUTION,
            attributes={"database": self.database_name}
        ) as span:
            try:
                # Create MongoDB client
                self.client = MongoClient(
                    self.connection_uri,
                    maxPoolSize=self.config["connection"].get("max_pool_size", 10),
                    minPoolSize=self.config["connection"].get("min_pool_size", 2),
                    connectTimeoutMS=self.config["connection"].get("connect_timeout_ms", 5000),
                    serverSelectionTimeoutMS=self.config["connection"].get(
                        "server_selection_timeout_ms", 5000
                    ),
                    socketTimeoutMS=self.config["connection"].get("socket_timeout_ms", 10000),
                )

                # Select database
                self.db = self.client[self.database_name]

                # Test connection
                self.client.admin.command("ping")

                # Setup collections and indexes
                await self._setup_collections()

                self._connected = True
                span.set_attribute("connected", True)

                logger.info(
                    f"MongoDB connected: {self.database_name}",
                    extra={"database": self.database_name}
                )

            except (ConnectionFailure, ServerSelectionTimeoutError) as e:
                span.set_attribute("connected", False)
                logger.error(
                    f"MongoDB connection failed: {e}",
                    exc_info=True,
                    extra={"database": self.database_name, "error": str(e)}
                )
                raise

    async def _setup_collections(self) -> None:
        """Setup collections with indexes"""
        for coll_key, coll_config in self.collections_config.items():
            collection_name = coll_config["name"]
            collection = self.db[collection_name]

            # Create compound unique index on (namespace, key)
            collection.create_index(
                [
                    ("namespace", ASCENDING),
                    ("key", ASCENDING)
                ],
                unique=True,
                name="namespace_key_unique"
            )

            # Create indexes for metadata fields
            collection.create_index([("metadata.tags", ASCENDING)], name="tags_idx")
            collection.create_index([("metadata.last_accessed", ASCENDING)], name="last_accessed_idx")
            collection.create_index([("metadata.created_at", ASCENDING)], name="created_at_idx")

            # Create text index for full-text search on value
            try:
                collection.create_index([("value", TEXT), ("key", TEXT)], name="fulltext_search")
            except OperationFailure:
                # Text index might already exist
                pass

            logger.debug(
                f"Collection setup complete: {collection_name}",
                extra={"collection": collection_name}
            )

    def _get_collection(self, namespace: Tuple[str, str]) -> Collection:
        """
        Get appropriate collection based on namespace type

        Args:
            namespace: (namespace_type, namespace_id) tuple

        Returns:
            MongoDB Collection object
        """
        namespace_type = namespace[0]

        # Map namespace types to collections
        collection_map = {
            "agent": "persona_libraries",
            "business": "consensus_memory",
            "system": "consensus_memory"
        }

        # Default to whiteboard for unknown types
        coll_key = collection_map.get(namespace_type, "whiteboard_methods")
        coll_name = self.collections_config[coll_key]["name"]

        return self.db[coll_name]

    async def put(
        self,
        namespace: Tuple[str, str],
        key: str,
        value: Dict[str, Any],
        metadata: Optional[MemoryMetadata] = None
    ) -> MemoryEntry:
        """
        Store memory entry in MongoDB

        Uses upsert for atomic update/insert.

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key
            value: Memory value (dict)
            metadata: Optional metadata

        Returns:
            MemoryEntry object
        """
        if not self._connected:
            await self.connect()

        with obs_manager.timed_operation(
            "mongodb.put",
            SpanType.EXECUTION
        ) as span:
            entry = MemoryEntry(
                namespace=namespace,
                key=key,
                value=value,
                metadata=metadata or MemoryMetadata()
            )

            collection = self._get_collection(namespace)

            try:
                # Upsert document
                result = collection.update_one(
                    {
                        "namespace": list(namespace),
                        "key": key
                    },
                    {
                        "$set": entry.to_dict()
                    },
                    upsert=True
                )

                span.set_attribute("upserted", result.upserted_id is not None)
                span.set_attribute("modified", result.modified_count)

                logger.debug(
                    f"MongoDB put: {namespace}/{key}",
                    extra={
                        "namespace": namespace,
                        "key": key,
                        "upserted": result.upserted_id is not None
                    }
                )

                return entry

            except DuplicateKeyError as e:
                logger.error(
                    f"Duplicate key error: {namespace}/{key}",
                    exc_info=True,
                    extra={"namespace": namespace, "key": key}
                )
                raise

    async def get(
        self,
        namespace: Tuple[str, str],
        key: str
    ) -> Optional[MemoryEntry]:
        """
        Retrieve memory entry from MongoDB

        Updates access metadata atomically.

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key

        Returns:
            MemoryEntry if found, None otherwise
        """
        if not self._connected:
            await self.connect()

        with obs_manager.timed_operation(
            "mongodb.get",
            SpanType.EXECUTION
        ) as span:
            collection = self._get_collection(namespace)

            try:
                # Find and update access metadata atomically
                result = collection.find_one_and_update(
                    {
                        "namespace": list(namespace),
                        "key": key
                    },
                    {
                        "$set": {
                            "metadata.last_accessed": MemoryMetadata().last_accessed
                        },
                        "$inc": {
                            "metadata.access_count": 1
                        }
                    },
                    return_document=True  # Return updated document
                )

                if result:
                    entry = MemoryEntry.from_dict(result)
                    span.set_attribute("found", True)
                    span.set_attribute("access_count", entry.metadata.access_count)

                    logger.debug(
                        f"MongoDB get: {namespace}/{key} (access_count={entry.metadata.access_count})",
                        extra={
                            "namespace": namespace,
                            "key": key,
                            "access_count": entry.metadata.access_count
                        }
                    )

                    return entry
                else:
                    span.set_attribute("found", False)
                    logger.debug(
                        f"MongoDB get miss: {namespace}/{key}",
                        extra={"namespace": namespace, "key": key}
                    )
                    return None

            except Exception as e:
                logger.error(
                    f"MongoDB get error: {e}",
                    exc_info=True,
                    extra={"namespace": namespace, "key": key}
                )
                raise

    async def search(
        self,
        namespace: Tuple[str, str],
        query: str,
        limit: int = 10
    ) -> List[MemoryEntry]:
        """
        Search memories using MongoDB full-text search

        Args:
            namespace: (namespace_type, namespace_id) tuple
            query: Search query string
            limit: Maximum results to return

        Returns:
            List of matching MemoryEntry objects
        """
        if not self._connected:
            await self.connect()

        with obs_manager.timed_operation(
            "mongodb.search",
            SpanType.EXECUTION
        ) as span:
            namespace_type, namespace_id = namespace
            collection = self._get_collection((namespace_type, namespace_id if namespace_id != "*" else namespace_id))

            # Build namespace filter (support wildcard namespace_id)
            namespace_filter: Dict[str, Any] = {}
            if namespace_type != "*":
                namespace_filter["namespace.0"] = namespace_type
            if namespace_id != "*":
                namespace_filter["namespace.1"] = namespace_id

            try:
                query_text = (query or "").strip()
                if query_text and query_text != "*":
                    mongo_filter = {
                        **namespace_filter,
                        "$text": {"$search": query_text}
                    }
                    projection = {"score": {"$meta": "textScore"}}
                    cursor = collection.find(mongo_filter, projection).sort(
                        [("score", {"$meta": "textScore"})]
                    ).limit(limit)
                else:
                    mongo_filter = namespace_filter if namespace_filter else {}
                    cursor = collection.find(mongo_filter).limit(limit)

                entries = [MemoryEntry.from_dict(doc) for doc in cursor]

                span.set_attribute("results_found", len(entries))
                span.set_attribute("query", query_text or "*")

                logger.debug(
                    f"MongoDB search: {namespace} query='{query_text or '*'}' found={len(entries)}",
                    extra={
                        "namespace": namespace,
                        "query": query_text or "*",
                        "results_count": len(entries)
                    }
                )

                return entries

            except Exception as e:
                logger.error(
                    f"MongoDB search error: {e}",
                    exc_info=True,
                    extra={"namespace": namespace, "query": query}
                )
                # Fallback to regex search if text search fails
                return await self._fallback_search(namespace, query or "*", limit)

    async def _fallback_search(
        self,
        namespace: Tuple[str, str],
        query: str,
        limit: int
    ) -> List[MemoryEntry]:
        """Fallback to regex search if text search fails"""
        collection = self._get_collection(namespace)

        namespace_type, namespace_id = namespace
        namespace_filter: Dict[str, Any] = {}
        if namespace_type != "*":
            namespace_filter["namespace.0"] = namespace_type
        if namespace_id != "*":
            namespace_filter["namespace.1"] = namespace_id

        regex_filter = {
            **namespace_filter,
            "$or": [
                {"key": {"$regex": query, "$options": "i"}},
                {"value": {"$regex": query, "$options": "i"}}
            ],
        }

        results = collection.find(regex_filter).limit(limit)

        return [MemoryEntry.from_dict(doc) for doc in results]

    async def delete(
        self,
        namespace: Tuple[str, str],
        key: str
    ) -> bool:
        """
        Delete memory entry from MongoDB

        Args:
            namespace: (namespace_type, namespace_id) tuple
            key: Memory key

        Returns:
            True if deleted, False if not found
        """
        if not self._connected:
            await self.connect()

        with obs_manager.timed_operation(
            "mongodb.delete",
            SpanType.EXECUTION
        ):
            collection = self._get_collection(namespace)

            result = collection.delete_one(
                {
                    "namespace": list(namespace),
                    "key": key
                }
            )

            deleted = result.deleted_count > 0

            logger.info(
                f"MongoDB delete: {namespace}/{key} (deleted={deleted})",
                extra={"namespace": namespace, "key": key, "deleted": deleted}
            )

            return deleted

    async def list_keys(
        self,
        namespace: Tuple[str, str]
    ) -> List[str]:
        """
        List all keys in namespace

        Args:
            namespace: (namespace_type, namespace_id) tuple

        Returns:
            List of keys
        """
        if not self._connected:
            await self.connect()

        collection = self._get_collection(namespace)

        # Project only the 'key' field
        results = collection.find(
            {"namespace": list(namespace)},
            {"key": 1, "_id": 0}
        )

        keys = [doc["key"] for doc in results]

        logger.debug(
            f"MongoDB list_keys: {namespace} (count={len(keys)})",
            extra={"namespace": namespace, "count": len(keys)}
        )

        return keys

    async def clear_namespace(
        self,
        namespace: Tuple[str, str]
    ) -> int:
        """
        Clear all memories in namespace

        Args:
            namespace: (namespace_type, namespace_id) tuple

        Returns:
            Number of entries cleared
        """
        if not self._connected:
            await self.connect()

        collection = self._get_collection(namespace)

        result = collection.delete_many(
            {"namespace": list(namespace)}
        )

        count = result.deleted_count

        logger.info(
            f"MongoDB clear_namespace: {namespace} ({count} entries)",
            extra={"namespace": namespace, "count": count}
        )

        return count

    async def close(self) -> None:
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            self._connected = False
            logger.info("MongoDB connection closed")


# Export public API
__all__ = ["MongoDBBackend"]
