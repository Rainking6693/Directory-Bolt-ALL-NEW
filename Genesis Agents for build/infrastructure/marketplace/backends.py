"""
Marketplace Persistence Backends
=================================

Provides Redis and PostgreSQL backends for the marketplace infrastructure,
enabling distributed deployments and persistent storage.

Architecture:
- RedisAgentRegistry: Distributed agent registry with TTL support
- PostgresTransactionLedger: Persistent transaction storage with indexing
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Set

from .agent_registry import (
    AgentRegistry,
    AgentProfile,
    AgentPricing,
    AgentAvailability,
    ReputationSnapshot,
    AvailabilityStatus,
    AgentAlreadyRegisteredError,
    AgentNotFoundError,
)
from .transaction_ledger import (
    TransactionLedger,
    TransactionRecord,
    TransactionStatus,
    TransactionNotFoundError,
    InvalidTransactionStateError,
)

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logger.warning("redis not installed - RedisAgentRegistry unavailable")

try:
    import psycopg2
    import psycopg2.extras
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False
    logger.warning("psycopg2 not installed - PostgresTransactionLedger unavailable")


# ============================================================================
# REDIS AGENT REGISTRY
# ============================================================================

class RedisAgentRegistry(AgentRegistry):
    """
    Redis-backed agent registry for distributed deployments.
    
    Features:
    - Distributed agent storage across multiple instances
    - TTL-based expiration for inactive agents
    - Atomic operations with Redis transactions
    - Fallback to in-memory when Redis unavailable
    
    Redis Schema:
    - agent:{agent_id} -> JSON profile
    - agents:capabilities:{capability} -> Set of agent_ids
    - agents:all -> Set of all agent_ids
    """
    
    def __init__(
        self,
        redis_client: Optional[redis.Redis] = None,
        redis_url: str = "redis://localhost:6379/0",
        agent_ttl: int = 3600,  # 1 hour default TTL
    ):
        super().__init__()
        self.redis_client = redis_client
        self.redis_url = redis_url
        self.agent_ttl = agent_ttl
        self._redis_available = False
        
        if not HAS_REDIS:
            logger.warning("Redis not available - falling back to in-memory storage")
            return
        
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                self.redis_client.ping()
                self._redis_available = True
                logger.info(f"✅ Connected to Redis at {redis_url}")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e} - using in-memory storage")
    
    def register_agent(
        self,
        agent_id: str,
        name: str,
        capabilities: Iterable[str],
        cost_per_task: float,
        currency: str = "USD",
        capacity_per_hour: int = 30,
        availability: AvailabilityStatus = AvailabilityStatus.ONLINE,
        metadata: Optional[Dict[str, object]] = None,
    ) -> AgentProfile:
        # Validate using parent class
        profile = super().register_agent(
            agent_id=agent_id,
            name=name,
            capabilities=capabilities,
            cost_per_task=cost_per_task,
            currency=currency,
            capacity_per_hour=capacity_per_hour,
            availability=availability,
            metadata=metadata,
        )
        
        # Persist to Redis if available
        if self._redis_available and self.redis_client:
            try:
                pipe = self.redis_client.pipeline()
                
                # Store agent profile
                profile_key = f"agent:{agent_id}"
                pipe.set(profile_key, json.dumps(profile.to_dict()), ex=self.agent_ttl)
                
                # Add to global agent set
                pipe.sadd("agents:all", agent_id)
                
                # Add to capability indexes
                for capability in profile.capabilities:
                    pipe.sadd(f"agents:capabilities:{capability}", agent_id)
                
                pipe.execute()
                logger.debug(f"Persisted agent {agent_id} to Redis")
            except Exception as e:
                logger.error(f"Failed to persist agent {agent_id} to Redis: {e}")
        
        return profile
    
    def get_agent(self, agent_id: str) -> AgentProfile:
        # Try Redis first
        if self._redis_available and self.redis_client:
            try:
                profile_key = f"agent:{agent_id}"
                data = self.redis_client.get(profile_key)
                if data:
                    profile_dict = json.loads(data)
                    return self._dict_to_profile(profile_dict)
            except Exception as e:
                logger.warning(f"Failed to fetch agent {agent_id} from Redis: {e}")
        
        # Fall back to in-memory
        return super().get_agent(agent_id)
    
    def find_by_capability(self, capability: str) -> List[AgentProfile]:
        capability = capability.lower().strip()
        
        # Try Redis first
        if self._redis_available and self.redis_client:
            try:
                agent_ids = self.redis_client.smembers(f"agents:capabilities:{capability}")
                profiles = []
                for agent_id in agent_ids:
                    try:
                        profile = self.get_agent(agent_id)
                        profiles.append(profile)
                    except AgentNotFoundError:
                        # Remove stale reference
                        self.redis_client.srem(f"agents:capabilities:{capability}", agent_id)
                return profiles
            except Exception as e:
                logger.warning(f"Failed to query Redis for capability {capability}: {e}")
        
        # Fall back to in-memory
        return super().find_by_capability(capability)
    
    def list_agents(self) -> List[AgentProfile]:
        # Try Redis first
        if self._redis_available and self.redis_client:
            try:
                agent_ids = self.redis_client.smembers("agents:all")
                profiles = []
                for agent_id in agent_ids:
                    try:
                        profile = self.get_agent(agent_id)
                        profiles.append(profile)
                    except AgentNotFoundError:
                        # Remove stale reference
                        self.redis_client.srem("agents:all", agent_id)
                return profiles
            except Exception as e:
                logger.warning(f"Failed to list agents from Redis: {e}")
        
        # Fall back to in-memory
        return super().list_agents()
    
    def unregister_agent(self, agent_id: str) -> None:
        # Remove from in-memory
        super().unregister_agent(agent_id)
        
        # Remove from Redis
        if self._redis_available and self.redis_client:
            try:
                # Get capabilities before deletion
                profile_key = f"agent:{agent_id}"
                data = self.redis_client.get(profile_key)
                if data:
                    profile_dict = json.loads(data)
                    capabilities = profile_dict.get("capabilities", [])
                    
                    pipe = self.redis_client.pipeline()
                    pipe.delete(profile_key)
                    pipe.srem("agents:all", agent_id)
                    for capability in capabilities:
                        pipe.srem(f"agents:capabilities:{capability}", agent_id)
                    pipe.execute()
                    logger.debug(f"Removed agent {agent_id} from Redis")
            except Exception as e:
                logger.error(f"Failed to remove agent {agent_id} from Redis: {e}")
    
    def _dict_to_profile(self, data: Dict) -> AgentProfile:
        """Reconstruct AgentProfile from dictionary"""
        return AgentProfile(
            agent_id=data["agent_id"],
            name=data["name"],
            capabilities=set(data["capabilities"]),
            pricing=AgentPricing(**data["pricing"]),
            availability=AgentAvailability(
                status=AvailabilityStatus(data["availability"]["status"]),
                capacity_per_hour=data["availability"]["capacity_per_hour"],
                last_updated=datetime.fromisoformat(data["availability"]["last_updated"]),
            ),
            reputation=ReputationSnapshot(**data["reputation"]),
            metadata=data.get("metadata", {}),
        )


# ============================================================================
# POSTGRESQL TRANSACTION LEDGER
# ============================================================================

class PostgresTransactionLedger(TransactionLedger):
    """
    PostgreSQL-backed transaction ledger for persistent storage.
    
    Features:
    - Persistent transaction history
    - Indexed queries for performance
    - ACID guarantees
    - Fallback to in-memory when PostgreSQL unavailable
    
    Database Schema:
    CREATE TABLE marketplace_transactions (
        transaction_id VARCHAR(32) PRIMARY KEY,
        created_at TIMESTAMP NOT NULL,
        payer_agent VARCHAR(255) NOT NULL,
        provider_agent VARCHAR(255) NOT NULL,
        capability VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL,
        context JSONB,
        evidence JSONB,
        INDEX idx_payer (payer_agent),
        INDEX idx_provider (provider_agent),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
    );
    """
    
    def __init__(
        self,
        db_connection = None,
        db_url: str = "postgresql://localhost:5432/genesis",
    ):
        super().__init__()
        self.db_connection = db_connection
        self.db_url = db_url
        self._postgres_available = False
        
        if not HAS_POSTGRES:
            logger.warning("PostgreSQL not available - falling back to in-memory storage")
            return
        
        if self.db_connection is None:
            try:
                self.db_connection = psycopg2.connect(db_url)
                self._postgres_available = True
                self._ensure_schema()
                logger.info(f"✅ Connected to PostgreSQL")
            except Exception as e:
                logger.warning(f"PostgreSQL connection failed: {e} - using in-memory storage")
    
    def _ensure_schema(self):
        """Create table if not exists"""
        if not self._postgres_available or not self.db_connection:
            return
        
        try:
            with self.db_connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS marketplace_transactions (
                        transaction_id VARCHAR(32) PRIMARY KEY,
                        created_at TIMESTAMP NOT NULL,
                        payer_agent VARCHAR(255) NOT NULL,
                        provider_agent VARCHAR(255) NOT NULL,
                        capability VARCHAR(255) NOT NULL,
                        amount DECIMAL(10, 2) NOT NULL,
                        currency VARCHAR(10) NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        context JSONB,
                        evidence JSONB
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_payer 
                        ON marketplace_transactions(payer_agent);
                    CREATE INDEX IF NOT EXISTS idx_provider 
                        ON marketplace_transactions(provider_agent);
                    CREATE INDEX IF NOT EXISTS idx_status 
                        ON marketplace_transactions(status);
                    CREATE INDEX IF NOT EXISTS idx_created_at 
                        ON marketplace_transactions(created_at);
                """)
                self.db_connection.commit()
                logger.debug("Ensured marketplace_transactions schema")
        except Exception as e:
            logger.error(f"Failed to create schema: {e}")
            self.db_connection.rollback()
    
    def record_transaction(
        self,
        payer_agent: str,
        provider_agent: str,
        capability: str,
        amount: float,
        currency: str = "USD",
        context: Optional[Dict[str, object]] = None,
    ) -> TransactionRecord:
        # Validate and create record using parent class
        record = super().record_transaction(
            payer_agent=payer_agent,
            provider_agent=provider_agent,
            capability=capability,
            amount=amount,
            currency=currency,
            context=context,
        )
        
        # Persist to PostgreSQL
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO marketplace_transactions 
                        (transaction_id, created_at, payer_agent, provider_agent, 
                         capability, amount, currency, status, context, evidence)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        record.transaction_id,
                        record.created_at,
                        record.payer_agent,
                        record.provider_agent,
                        record.capability,
                        record.amount,
                        record.currency,
                        record.status.value,
                        json.dumps(record.context),
                        json.dumps(record.evidence),
                    ))
                    self.db_connection.commit()
                    logger.debug(f"Persisted transaction {record.transaction_id} to PostgreSQL")
            except Exception as e:
                logger.error(f"Failed to persist transaction to PostgreSQL: {e}")
                self.db_connection.rollback()
        
        return record
    
    def get_transaction(self, transaction_id: str) -> TransactionRecord:
        # Try PostgreSQL first
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                    cursor.execute("""
                        SELECT * FROM marketplace_transactions
                        WHERE transaction_id = %s
                    """, (transaction_id,))
                    row = cursor.fetchone()
                    if row:
                        return self._row_to_record(row)
            except Exception as e:
                logger.warning(f"Failed to fetch transaction from PostgreSQL: {e}")
        
        # Fall back to in-memory
        return super().get_transaction(transaction_id)
    
    def list_transactions(self) -> List[TransactionRecord]:
        # Try PostgreSQL first
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                    cursor.execute("""
                        SELECT * FROM marketplace_transactions
                        ORDER BY created_at DESC
                    """)
                    rows = cursor.fetchall()
                    return [self._row_to_record(row) for row in rows]
            except Exception as e:
                logger.warning(f"Failed to list transactions from PostgreSQL: {e}")
        
        # Fall back to in-memory
        return super().list_transactions()
    
    def list_for_agent(self, agent_id: str, role: Optional[str] = None) -> List[TransactionRecord]:
        # Try PostgreSQL first
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                    if role == "payer":
                        cursor.execute("""
                            SELECT * FROM marketplace_transactions
                            WHERE payer_agent = %s
                            ORDER BY created_at ASC
                        """, (agent_id,))
                    elif role == "provider":
                        cursor.execute("""
                            SELECT * FROM marketplace_transactions
                            WHERE provider_agent = %s
                            ORDER BY created_at ASC
                        """, (agent_id,))
                    else:
                        cursor.execute("""
                            SELECT * FROM marketplace_transactions
                            WHERE payer_agent = %s OR provider_agent = %s
                            ORDER BY created_at ASC
                        """, (agent_id, agent_id))
                    rows = cursor.fetchall()
                    return [self._row_to_record(row) for row in rows]
            except Exception as e:
                logger.warning(f"Failed to query transactions from PostgreSQL: {e}")
        
        # Fall back to in-memory
        return super().list_for_agent(agent_id, role)
    
    def settle_transaction(self, transaction_id: str) -> TransactionRecord:
        # Update in-memory
        record = super().settle_transaction(transaction_id)
        
        # Update PostgreSQL
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor() as cursor:
                    cursor.execute("""
                        UPDATE marketplace_transactions
                        SET status = %s
                        WHERE transaction_id = %s
                    """, (TransactionStatus.SETTLED.value, transaction_id))
                    self.db_connection.commit()
            except Exception as e:
                logger.error(f"Failed to update transaction in PostgreSQL: {e}")
                self.db_connection.rollback()
        
        return record
    
    def cancel_transaction(self, transaction_id: str) -> TransactionRecord:
        # Update in-memory
        record = super().cancel_transaction(transaction_id)
        
        # Update PostgreSQL
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor() as cursor:
                    cursor.execute("""
                        UPDATE marketplace_transactions
                        SET status = %s
                        WHERE transaction_id = %s
                    """, (TransactionStatus.CANCELLED.value, transaction_id))
                    self.db_connection.commit()
            except Exception as e:
                logger.error(f"Failed to update transaction in PostgreSQL: {e}")
                self.db_connection.rollback()
        
        return record
    
    def flag_dispute(self, transaction_id: str, evidence: Optional[Iterable[str]] = None) -> TransactionRecord:
        # Update in-memory
        record = super().flag_dispute(transaction_id, evidence)
        
        # Update PostgreSQL
        if self._postgres_available and self.db_connection:
            try:
                with self.db_connection.cursor() as cursor:
                    cursor.execute("""
                        UPDATE marketplace_transactions
                        SET status = %s, evidence = %s
                        WHERE transaction_id = %s
                    """, (TransactionStatus.DISPUTED.value, json.dumps(record.evidence), transaction_id))
                    self.db_connection.commit()
            except Exception as e:
                logger.error(f"Failed to update transaction in PostgreSQL: {e}")
                self.db_connection.rollback()
        
        return record
    
    def _row_to_record(self, row: Dict) -> TransactionRecord:
        """Reconstruct TransactionRecord from database row"""
        return TransactionRecord(
            transaction_id=row["transaction_id"],
            created_at=row["created_at"],
            payer_agent=row["payer_agent"],
            provider_agent=row["provider_agent"],
            capability=row["capability"],
            amount=float(row["amount"]),
            currency=row["currency"],
            status=TransactionStatus(row["status"]),
            context=json.loads(row["context"]) if row["context"] else {},
            evidence=json.loads(row["evidence"]) if row["evidence"] else [],
        )
    
    def close(self):
        """Close database connection"""
        if self.db_connection:
            self.db_connection.close()
            logger.info("Closed PostgreSQL connection")
