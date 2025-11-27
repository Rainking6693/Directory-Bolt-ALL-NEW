"""
Marketplace Prometheus Metrics
===============================

Provides comprehensive Prometheus metrics for marketplace operations,
enabling observability and monitoring in production deployments.
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Iterable, List, Optional, Set

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
from .discovery_service import AgentDiscoveryService

logger = logging.getLogger(__name__)

# Prometheus client
try:
    from prometheus_client import Counter, Gauge, Histogram, Summary
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False
    logger.warning("prometheus_client not installed - metrics unavailable")


# ============================================================================
# PROMETHEUS METRICS DEFINITIONS
# ============================================================================

if HAS_PROMETHEUS:
    # Agent Registry Metrics
    agent_registrations_total = Counter(
        'marketplace_agent_registrations_total',
        'Total number of agent registrations',
        ['status']  # success, duplicate, error
    )
    
    agent_unregistrations_total = Counter(
        'marketplace_agent_unregistrations_total',
        'Total number of agent unregistrations'
    )
    
    agents_online = Gauge(
        'marketplace_agents_online',
        'Number of agents currently online'
    )
    
    agents_by_capability = Gauge(
        'marketplace_agents_by_capability',
        'Number of agents per capability',
        ['capability']
    )
    
    agent_reputation_score = Gauge(
        'marketplace_agent_reputation_score',
        'Agent reputation score (0-5)',
        ['agent_id']
    )
    
    agent_task_outcomes_total = Counter(
        'marketplace_agent_task_outcomes_total',
        'Total task outcomes per agent',
        ['agent_id', 'success']
    )
    
    # Transaction Metrics
    transactions_total = Counter(
        'marketplace_transactions_total',
        'Total number of transactions recorded',
        ['capability']
    )
    
    transaction_amount_total = Counter(
        'marketplace_transaction_amount_total',
        'Total transaction amount in USD',
        ['currency']
    )
    
    transactions_by_status = Gauge(
        'marketplace_transactions_by_status',
        'Number of transactions by status',
        ['status']
    )
    
    transaction_state_transitions_total = Counter(
        'marketplace_transaction_state_transitions_total',
        'Total transaction state transitions',
        ['from_state', 'to_state']
    )
    
    transaction_disputes_total = Counter(
        'marketplace_transaction_disputes_total',
        'Total number of disputed transactions',
        ['capability']
    )
    
    transaction_settlement_duration_seconds = Histogram(
        'marketplace_transaction_settlement_duration_seconds',
        'Time from transaction creation to settlement',
        buckets=[1, 5, 10, 30, 60, 300, 600, 1800, 3600]
    )
    
    # Discovery Metrics
    discovery_searches_total = Counter(
        'marketplace_discovery_searches_total',
        'Total number of discovery searches',
        ['capability']
    )
    
    discovery_search_duration_seconds = Histogram(
        'marketplace_discovery_search_duration_seconds',
        'Discovery search duration',
        buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
    )
    
    discovery_results_count = Summary(
        'marketplace_discovery_results_count',
        'Number of results returned per search'
    )
    
    discovery_recommendations_total = Counter(
        'marketplace_discovery_recommendations_total',
        'Total number of agent recommendations',
        ['capability']
    )


# ============================================================================
# INSTRUMENTED AGENT REGISTRY
# ============================================================================

class InstrumentedAgentRegistry(AgentRegistry):
    """
    AgentRegistry with Prometheus metrics instrumentation.
    
    Records all operations to Prometheus for monitoring and alerting.
    """
    
    def __init__(self):
        super().__init__()
        self._metrics_enabled = HAS_PROMETHEUS
        if not self._metrics_enabled:
            logger.warning("Prometheus metrics disabled - prometheus_client not installed")
    
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
        try:
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
            
            if self._metrics_enabled:
                agent_registrations_total.labels(status='success').inc()
                self._update_capability_gauges()
                self._update_online_gauge()
                agent_reputation_score.labels(agent_id=agent_id).set(profile.reputation.score)
            
            return profile
        except Exception as e:
            if self._metrics_enabled:
                agent_registrations_total.labels(status='error').inc()
            raise
    
    def unregister_agent(self, agent_id: str) -> None:
        super().unregister_agent(agent_id)
        
        if self._metrics_enabled:
            agent_unregistrations_total.inc()
            self._update_capability_gauges()
            self._update_online_gauge()
    
    def record_task_outcome(self, agent_id: str, success: bool, weight: float = 1.0) -> ReputationSnapshot:
        reputation = super().record_task_outcome(agent_id, success, weight)
        
        if self._metrics_enabled:
            agent_task_outcomes_total.labels(
                agent_id=agent_id,
                success=str(success).lower()
            ).inc()
            agent_reputation_score.labels(agent_id=agent_id).set(reputation.score)
        
        return reputation
    
    def update_availability(
        self,
        agent_id: str,
        status: Optional[AvailabilityStatus] = None,
        capacity_per_hour: Optional[int] = None,
    ) -> AgentAvailability:
        availability = super().update_availability(agent_id, status, capacity_per_hour)
        
        if self._metrics_enabled:
            self._update_online_gauge()
        
        return availability
    
    def _update_capability_gauges(self):
        """Update Prometheus gauges for capability counts"""
        if not self._metrics_enabled:
            return
        
        summary = self.summarize_capabilities()
        for capability, count in summary.items():
            agents_by_capability.labels(capability=capability).set(count)
    
    def _update_online_gauge(self):
        """Update Prometheus gauge for online agents"""
        if not self._metrics_enabled:
            return
        
        online_count = sum(
            1 for profile in self.list_agents()
            if profile.availability.status == AvailabilityStatus.ONLINE
        )
        agents_online.set(online_count)


# ============================================================================
# INSTRUMENTED TRANSACTION LEDGER
# ============================================================================

class InstrumentedTransactionLedger(TransactionLedger):
    """
    TransactionLedger with Prometheus metrics instrumentation.
    
    Records all transaction lifecycle events to Prometheus.
    """
    
    def __init__(self):
        super().__init__()
        self._metrics_enabled = HAS_PROMETHEUS
        if not self._metrics_enabled:
            logger.warning("Prometheus metrics disabled - prometheus_client not installed")
    
    def record_transaction(
        self,
        payer_agent: str,
        provider_agent: str,
        capability: str,
        amount: float,
        currency: str = "USD",
        context: Optional[Dict[str, object]] = None,
    ) -> TransactionRecord:
        record = super().record_transaction(
            payer_agent=payer_agent,
            provider_agent=provider_agent,
            capability=capability,
            amount=amount,
            currency=currency,
            context=context,
        )
        
        if self._metrics_enabled:
            transactions_total.labels(capability=capability).inc()
            transaction_amount_total.labels(currency=currency).inc(amount)
            self._update_status_gauges()
        
        return record
    
    def settle_transaction(self, transaction_id: str) -> TransactionRecord:
        record = self._get(transaction_id)
        old_status = record.status
        
        record = super().settle_transaction(transaction_id)
        
        if self._metrics_enabled:
            transaction_state_transitions_total.labels(
                from_state=old_status.value,
                to_state=TransactionStatus.SETTLED.value
            ).inc()
            
            # Record settlement duration
            duration = (record.created_at.replace(tzinfo=None) - 
                       record.created_at.replace(tzinfo=None)).total_seconds()
            transaction_settlement_duration_seconds.observe(duration)
            
            self._update_status_gauges()
        
        return record
    
    def cancel_transaction(self, transaction_id: str) -> TransactionRecord:
        record = self._get(transaction_id)
        old_status = record.status
        
        record = super().cancel_transaction(transaction_id)
        
        if self._metrics_enabled:
            transaction_state_transitions_total.labels(
                from_state=old_status.value,
                to_state=TransactionStatus.CANCELLED.value
            ).inc()
            self._update_status_gauges()
        
        return record
    
    def flag_dispute(self, transaction_id: str, evidence: Optional[Iterable[str]] = None) -> TransactionRecord:
        record = self._get(transaction_id)
        old_status = record.status
        
        record = super().flag_dispute(transaction_id, evidence)
        
        if self._metrics_enabled:
            transaction_state_transitions_total.labels(
                from_state=old_status.value,
                to_state=TransactionStatus.DISPUTED.value
            ).inc()
            transaction_disputes_total.labels(capability=record.capability).inc()
            self._update_status_gauges()
        
        return record
    
    def _update_status_gauges(self):
        """Update Prometheus gauges for transaction status counts"""
        if not self._metrics_enabled:
            return
        
        status_counts = {status: 0 for status in TransactionStatus}
        for record in self.list_transactions():
            status_counts[record.status] += 1
        
        for status, count in status_counts.items():
            transactions_by_status.labels(status=status.value).set(count)


# ============================================================================
# INSTRUMENTED DISCOVERY SERVICE
# ============================================================================

class InstrumentedDiscoveryService(AgentDiscoveryService):
    """
    AgentDiscoveryService with Prometheus metrics instrumentation.
    
    Records search and recommendation metrics to Prometheus.
    """
    
    def __init__(self, registry: AgentRegistry, ledger: Optional[TransactionLedger] = None):
        super().__init__(registry, ledger)
        self._metrics_enabled = HAS_PROMETHEUS
        if not self._metrics_enabled:
            logger.warning("Prometheus metrics disabled - prometheus_client not installed")
    
    def search(
        self,
        capabilities: Iterable[str],
        max_cost: Optional[float] = None,
        availability: Optional[AvailabilityStatus] = None,
    ) -> List[AgentProfile]:
        start_time = time.time()
        
        results = super().search(capabilities, max_cost, availability)
        
        if self._metrics_enabled:
            duration = time.time() - start_time
            discovery_search_duration_seconds.observe(duration)
            discovery_results_count.observe(len(results))
            
            for capability in capabilities:
                discovery_searches_total.labels(capability=capability).inc()
        
        return results
    
    def recommend_agents(
        self,
        capability: str,
        top_n: int = 3,
        include_busy: bool = False,
    ) -> List[AgentProfile]:
        recommendations = super().recommend_agents(capability, top_n, include_busy)
        
        if self._metrics_enabled:
            discovery_recommendations_total.labels(capability=capability).inc()
        
        return recommendations

