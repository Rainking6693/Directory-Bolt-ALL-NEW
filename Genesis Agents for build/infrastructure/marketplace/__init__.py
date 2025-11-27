"""
Marketplace Infrastructure
==========================

Provides agent marketplace functionality including:
- Agent registration and capability tracking
- Transaction ledger for agent-to-agent payments
- Discovery service for agent search and load balancing
- Redis/PostgreSQL backends for persistent storage
- Thread-safe wrappers for concurrent access
- Prometheus metrics for observability

Integration points:
- x402 protocol for payment settlement
- Distributed deployments (Redis)
- ACID transactions (PostgreSQL)
- Production monitoring (Prometheus)
"""

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
from .discovery_service import AgentDiscoveryService

# Optional backend imports (graceful degradation if dependencies missing)
try:
    from .backends import RedisAgentRegistry, PostgresTransactionLedger
    HAS_BACKENDS = True
except ImportError:
    HAS_BACKENDS = False

try:
    from .thread_safe import ThreadSafeAgentRegistry, ThreadSafeTransactionLedger
    HAS_THREAD_SAFE = True
except ImportError:
    HAS_THREAD_SAFE = False

try:
    from .metrics import (
        InstrumentedAgentRegistry,
        InstrumentedTransactionLedger,
        InstrumentedDiscoveryService,
    )
    HAS_METRICS = True
except ImportError:
    HAS_METRICS = False

__all__ = [
    # Core Registry
    "AgentRegistry",
    "AgentProfile",
    "AgentPricing",
    "AgentAvailability",
    "ReputationSnapshot",
    "AvailabilityStatus",
    "AgentAlreadyRegisteredError",
    "AgentNotFoundError",
    # Core Ledger
    "TransactionLedger",
    "TransactionRecord",
    "TransactionStatus",
    "TransactionNotFoundError",
    "InvalidTransactionStateError",
    # Core Discovery
    "AgentDiscoveryService",
]

# Add optional exports if available
if HAS_BACKENDS:
    __all__.extend([
        "RedisAgentRegistry",
        "PostgresTransactionLedger",
    ])

if HAS_THREAD_SAFE:
    __all__.extend([
        "ThreadSafeAgentRegistry",
        "ThreadSafeTransactionLedger",
    ])

if HAS_METRICS:
    __all__.extend([
        "InstrumentedAgentRegistry",
        "InstrumentedTransactionLedger",
        "InstrumentedDiscoveryService",
    ])

