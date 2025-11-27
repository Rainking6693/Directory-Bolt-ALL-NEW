"""
Marketplace Discovery Service
=============================

Provides capability-based search, recommendation ranking, and lightweight
load-balancing across marketplace agents.
"""

from __future__ import annotations

import itertools
import logging
import random
from collections import defaultdict, deque
from typing import Deque, Dict, Iterable, List, Optional

from .agent_registry import AgentRegistry, AgentProfile, AvailabilityStatus
from .transaction_ledger import TransactionLedger

logger = logging.getLogger(__name__)


class AgentDiscoveryService:
    """
    High-level discovery orchestrator.

    Uses the agent registry for metadata and the transaction ledger for usage
    statistics (e.g., to avoid overloading agents handling many recent tasks).
    """

    def __init__(self, registry: AgentRegistry, ledger: Optional[TransactionLedger] = None) -> None:
        self._registry = registry
        self._ledger = ledger
        self._round_robin_cursors: Dict[str, Deque[str]] = defaultdict(deque)

    # ------------------------------------------------------------------ #
    # Search
    # ------------------------------------------------------------------ #

    def search(
        self,
        capabilities: Iterable[str],
        max_cost: Optional[float] = None,
        availability: Optional[AvailabilityStatus] = None,
    ) -> List[AgentProfile]:
        """
        Filter agents by capability, cost, and availability.

        Args:
            capabilities: At least one required capability (OR semantics).
            max_cost: Optional upper bound on cost per task.
            availability: Optional availability filter.
        """
        required_caps = {cap.strip().lower() for cap in capabilities}
        if not required_caps:
            return []

        matches: List[AgentProfile] = []
        for capability in required_caps:
            for profile in self._registry.find_by_capability(capability):
                if profile in matches:
                    continue
                if max_cost is not None and profile.pricing.cost_per_task > max_cost:
                    continue
                if availability is not None and profile.availability.status != availability:
                    continue
                matches.append(profile)

        matches.sort(
            key=lambda profile: (
                profile.pricing.cost_per_task,
                -profile.reputation.score,
                profile.availability.status.value,
            )
        )
        return matches

    # ------------------------------------------------------------------ #
    # Recommendations
    # ------------------------------------------------------------------ #

    def recommend_agents(
        self,
        capability: str,
        top_n: int = 3,
        include_busy: bool = False,
    ) -> List[AgentProfile]:
        """
        Recommend agents prioritising reputation, cost, and availability.

        Uses a soft round-robin so multiple calls distribute load.
        """
        capability = capability.strip().lower()
        candidates = self._registry.rank_agents(capability=capability, sort_by="score")

        if not include_busy:
            candidates = [c for c in candidates if c.availability.status == AvailabilityStatus.ONLINE]

        if not candidates:
            return []

        cursor = self._round_robin_cursors[capability]
        if not cursor:
            cursor.extend(profile.agent_id for profile in candidates)

        selected_ids = []
        while len(selected_ids) < min(top_n, len(cursor)):
            agent_id = cursor[0]
            cursor.rotate(-1)
            selected_ids.append(agent_id)

        id_to_profile = {profile.agent_id: profile for profile in candidates}
        recommendations = [id_to_profile[agent_id] for agent_id in selected_ids if agent_id in id_to_profile]
        if len(recommendations) < top_n:
            # Fall back to highest scoring remaining agents
            for profile in candidates:
                if profile not in recommendations:
                    recommendations.append(profile)
                    if len(recommendations) >= top_n:
                        break
        return recommendations[:top_n]

    # ------------------------------------------------------------------ #
    # Load Balancing Helpers
    # ------------------------------------------------------------------ #

    def select_least_loaded(self, capability: str) -> Optional[AgentProfile]:
        """
        Select agent with lowest recent transaction volume.

        Requires the ledger. If missing, falls back to round-robin.
        """
        capability = capability.strip().lower()
        candidates = self._registry.find_by_capability(capability)
        if not candidates:
            return None

        if not self._ledger:
            # Fallback to round-robin
            recommendations = self.recommend_agents(capability, top_n=1, include_busy=True)
            return recommendations[0] if recommendations else None

        usage_counts = self._build_usage_counts(capability)
        candidates.sort(
            key=lambda profile: (
                usage_counts.get(profile.agent_id, 0),
                profile.pricing.cost_per_task,
                -profile.reputation.score,
            )
        )
        return candidates[0]

    def _build_usage_counts(self, capability: str) -> Dict[str, int]:
        usage: Dict[str, int] = defaultdict(int)
        if not self._ledger:
            return usage
        for record in self._ledger.list_transactions():
            if record.capability != capability:
                continue
            usage[record.provider_agent] += 1
        return usage

    # ------------------------------------------------------------------ #
    # Exploration utilities
    # ------------------------------------------------------------------ #

    def random_agent(self, capability: Optional[str] = None) -> Optional[AgentProfile]:
        profiles = (
            self._registry.find_by_capability(capability) if capability else self._registry.list_agents()
        )
        return random.choice(profiles) if profiles else None

    def capability_summary(self) -> Dict[str, int]:
        return self._registry.summarize_capabilities()

