"""
Thread-Safe Marketplace Components
===================================

Provides thread-safe wrappers for marketplace infrastructure,
enabling safe concurrent access in multi-threaded deployments.
"""

from __future__ import annotations

import logging
from threading import RLock
from typing import Dict, Iterable, List, Optional, Set, Tuple

from .agent_registry import (
    AgentRegistry,
    AgentProfile,
    AgentPricing,
    AgentAvailability,
    ReputationSnapshot,
    AvailabilityStatus,
)
from .transaction_ledger import (
    TransactionLedger,
    TransactionRecord,
    TransactionStatus,
)

logger = logging.getLogger(__name__)


# ============================================================================
# THREAD-SAFE AGENT REGISTRY
# ============================================================================

class ThreadSafeAgentRegistry(AgentRegistry):
    """
    Thread-safe wrapper for AgentRegistry.
    
    Uses reentrant locks (RLock) to allow the same thread to acquire
    the lock multiple times, which is useful for methods that call
    other methods on the same instance.
    
    All public methods are protected by locks to ensure atomic operations.
    """
    
    def __init__(self):
        super().__init__()
        self._lock = RLock()
    
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
        with self._lock:
            return super().register_agent(
                agent_id=agent_id,
                name=name,
                capabilities=capabilities,
                cost_per_task=cost_per_task,
                currency=currency,
                capacity_per_hour=capacity_per_hour,
                availability=availability,
                metadata=metadata,
            )
    
    def unregister_agent(self, agent_id: str) -> None:
        with self._lock:
            super().unregister_agent(agent_id)
    
    def update_pricing(self, agent_id: str, cost_per_task: float, currency: Optional[str] = None) -> AgentPricing:
        with self._lock:
            return super().update_pricing(agent_id, cost_per_task, currency)
    
    def update_availability(
        self,
        agent_id: str,
        status: Optional[AvailabilityStatus] = None,
        capacity_per_hour: Optional[int] = None,
    ) -> AgentAvailability:
        with self._lock:
            return super().update_availability(agent_id, status, capacity_per_hour)
    
    def update_capabilities(self, agent_id: str, new_capabilities: Iterable[str]) -> Set[str]:
        with self._lock:
            return super().update_capabilities(agent_id, new_capabilities)
    
    def adjust_reputation(self, agent_id: str, delta: float) -> ReputationSnapshot:
        with self._lock:
            return super().adjust_reputation(agent_id, delta)
    
    def record_task_outcome(self, agent_id: str, success: bool, weight: float = 1.0) -> ReputationSnapshot:
        with self._lock:
            return super().record_task_outcome(agent_id, success, weight)
    
    def get_agent(self, agent_id: str) -> AgentProfile:
        with self._lock:
            return super().get_agent(agent_id)
    
    def list_agents(self) -> List[AgentProfile]:
        with self._lock:
            return super().list_agents()
    
    def find_by_capability(self, capability: str) -> List[AgentProfile]:
        with self._lock:
            return super().find_by_capability(capability)
    
    def summarize_capabilities(self) -> Dict[str, int]:
        with self._lock:
            return super().summarize_capabilities()
    
    def rank_agents(
        self,
        capability: Optional[str] = None,
        limit: Optional[int] = None,
        sort_by: str = "score",
    ) -> List[AgentProfile]:
        with self._lock:
            return super().rank_agents(capability, limit, sort_by)


# ============================================================================
# THREAD-SAFE TRANSACTION LEDGER
# ============================================================================

class ThreadSafeTransactionLedger(TransactionLedger):
    """
    Thread-safe wrapper for TransactionLedger.
    
    Uses reentrant locks (RLock) to protect all transaction operations.
    Ensures ACID-like properties for in-memory transactions.
    """
    
    def __init__(self):
        super().__init__()
        self._lock = RLock()
    
    def record_transaction(
        self,
        payer_agent: str,
        provider_agent: str,
        capability: str,
        amount: float,
        currency: str = "USD",
        context: Optional[Dict[str, object]] = None,
    ) -> TransactionRecord:
        with self._lock:
            return super().record_transaction(
                payer_agent=payer_agent,
                provider_agent=provider_agent,
                capability=capability,
                amount=amount,
                currency=currency,
                context=context,
            )
    
    def settle_transaction(self, transaction_id: str) -> TransactionRecord:
        with self._lock:
            return super().settle_transaction(transaction_id)
    
    def cancel_transaction(self, transaction_id: str) -> TransactionRecord:
        with self._lock:
            return super().cancel_transaction(transaction_id)
    
    def flag_dispute(self, transaction_id: str, evidence: Optional[Iterable[str]] = None) -> TransactionRecord:
        with self._lock:
            return super().flag_dispute(transaction_id, evidence)
    
    def get_transaction(self, transaction_id: str) -> TransactionRecord:
        with self._lock:
            return super().get_transaction(transaction_id)
    
    def list_transactions(self) -> List[TransactionRecord]:
        with self._lock:
            return super().list_transactions()
    
    def list_for_agent(self, agent_id: str, role: Optional[str] = None) -> List[TransactionRecord]:
        with self._lock:
            return super().list_for_agent(agent_id, role)
    
    def list_open_disputes(self) -> List[TransactionRecord]:
        with self._lock:
            return super().list_open_disputes()
    
    def prepare_settlement_payload(self, transaction_id: str) -> Dict[str, object]:
        with self._lock:
            return super().prepare_settlement_payload(transaction_id)
    
    def export_history(self) -> List[Dict[str, object]]:
        with self._lock:
            return super().export_history()

