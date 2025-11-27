"""
Agent Marketplace Registry
==========================

Provides in-memory registration, pricing, availability, and reputation tracking
for Genesis marketplace agents. Designed to be storage-agnostic so it can be
wrapped with persistent backends later (Redis, Postgres, etc.).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Iterable, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Agent ID validation pattern: alphanumeric, underscore, hyphen only
AGENT_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')


class AvailabilityStatus(str, Enum):
    """Simple availability signal used by the discovery service."""

    ONLINE = "online"
    BUSY = "busy"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"


@dataclass
class AgentPricing:
    """Cost metadata for an agent."""

    cost_per_task: float
    currency: str = "USD"
    billing_notes: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


@dataclass
class AgentAvailability:
    """Operational availability and capacity metadata."""

    status: AvailabilityStatus
    capacity_per_hour: int
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def touch(self, status: Optional[AvailabilityStatus] = None, capacity: Optional[int] = None) -> None:
        if status is not None:
            self.status = status
        if capacity is not None:
            self.capacity_per_hour = capacity
        self.last_updated = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, object]:
        return {
            "status": self.status.value,
            "capacity_per_hour": self.capacity_per_hour,
            "last_updated": self.last_updated.isoformat(),
        }


@dataclass
class ReputationSnapshot:
    """Aggregated reputation metrics."""

    score: float = 0.0  # canonical reputation score (weighted average)
    total_feedback: int = 0
    successful_tasks: int = 0
    failed_tasks: int = 0

    def register_outcome(self, success: bool, weight: float = 1.0) -> None:
        self.total_feedback += 1
        if success:
            self.successful_tasks += 1
            self.score = self._recalculate(self.score, weight, positive=True)
        else:
            self.failed_tasks += 1
            self.score = self._recalculate(self.score, weight, positive=False)

    def apply_adjustment(self, delta: float) -> None:
        self.score = max(0.0, self.score + delta)

    @staticmethod
    def _recalculate(current: float, weight: float, positive: bool) -> float:
        direction = 1.0 if positive else -1.0
        return max(0.0, min(5.0, current + (direction * weight)))

    def to_dict(self) -> Dict[str, object]:
        return {
            "score": round(self.score, 2),
            "total_feedback": self.total_feedback,
            "successful_tasks": self.successful_tasks,
            "failed_tasks": self.failed_tasks,
        }


@dataclass
class AgentProfile:
    """Primary registration record for an agent."""

    agent_id: str
    name: str
    capabilities: Set[str]
    pricing: AgentPricing
    availability: AgentAvailability
    reputation: ReputationSnapshot = field(default_factory=ReputationSnapshot)
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "capabilities": sorted(self.capabilities),
            "pricing": self.pricing.to_dict(),
            "availability": self.availability.to_dict(),
            "reputation": self.reputation.to_dict(),
            "metadata": self.metadata.copy(),
        }


class AgentAlreadyRegisteredError(ValueError):
    """Raised when attempting to double-register an agent."""


class AgentNotFoundError(KeyError):
    """Raised when retrieving or mutating a missing agent."""


class AgentRegistry:
    """
    In-memory agent registry.

    Responsibilities:
    - Register and update agent capabilities, pricing, and availability.
    - Track reputation scores based on task outcomes or manual adjustments.
    - Provide views used by the discovery service (filtering, sorting).
    """

    def __init__(self) -> None:
        self._agents: Dict[str, AgentProfile] = {}

    # ------------------------------------------------------------------ #
    # Registration operations
    # ------------------------------------------------------------------ #

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
        # Validate agent_id format
        if not AGENT_ID_PATTERN.match(agent_id):
            raise ValueError(f"Invalid agent_id format: '{agent_id}'. Must contain only alphanumeric, underscore, or hyphen characters.")
        
        if agent_id in self._agents:
            raise AgentAlreadyRegisteredError(f"Agent '{agent_id}' is already registered.")
        
        # Validate cost
        if cost_per_task < 0:
            raise ValueError(f"Cost per task must be non-negative, got {cost_per_task}")
        
        # Validate capacity
        if capacity_per_hour <= 0:
            raise ValueError(f"Capacity per hour must be positive, got {capacity_per_hour}")

        profile = AgentProfile(
            agent_id=agent_id,
            name=name,
            capabilities={cap.strip().lower() for cap in capabilities},
            pricing=AgentPricing(cost_per_task=cost_per_task, currency=currency),
            availability=AgentAvailability(status=availability, capacity_per_hour=capacity_per_hour),
            metadata=metadata or {},
        )
        self._agents[agent_id] = profile
        logger.debug("Registered agent %s with capabilities %s", agent_id, profile.capabilities)
        return profile

    def unregister_agent(self, agent_id: str) -> None:
        if agent_id not in self._agents:
            raise AgentNotFoundError(agent_id)
        del self._agents[agent_id]
        logger.debug("Unregistered agent %s", agent_id)

    # ------------------------------------------------------------------ #
    # Updates
    # ------------------------------------------------------------------ #

    def update_pricing(self, agent_id: str, cost_per_task: float, currency: Optional[str] = None) -> AgentPricing:
        profile = self._get_profile(agent_id)
        profile.pricing.cost_per_task = cost_per_task
        if currency:
            profile.pricing.currency = currency
        logger.debug("Updated pricing for %s to %.2f %s", agent_id, cost_per_task, profile.pricing.currency)
        return profile.pricing

    def update_availability(
        self,
        agent_id: str,
        status: Optional[AvailabilityStatus] = None,
        capacity_per_hour: Optional[int] = None,
    ) -> AgentAvailability:
        profile = self._get_profile(agent_id)
        profile.availability.touch(status=status, capacity=capacity_per_hour)
        logger.debug(
            "Updated availability for %s → %s (%s/h)",
            agent_id,
            profile.availability.status,
            profile.availability.capacity_per_hour,
        )
        return profile.availability

    def update_capabilities(self, agent_id: str, new_capabilities: Iterable[str]) -> Set[str]:
        profile = self._get_profile(agent_id)
        profile.capabilities = {cap.strip().lower() for cap in new_capabilities}
        logger.debug("Updated capabilities for %s → %s", agent_id, profile.capabilities)
        return profile.capabilities

    def adjust_reputation(self, agent_id: str, delta: float) -> ReputationSnapshot:
        profile = self._get_profile(agent_id)
        profile.reputation.apply_adjustment(delta)
        logger.debug("Adjusted reputation for %s by %.2f → %.2f", agent_id, delta, profile.reputation.score)
        return profile.reputation

    def record_task_outcome(self, agent_id: str, success: bool, weight: float = 1.0) -> ReputationSnapshot:
        profile = self._get_profile(agent_id)
        profile.reputation.register_outcome(success=success, weight=weight)
        logger.debug(
            "Recorded task outcome for %s success=%s score=%.2f",
            agent_id,
            success,
            profile.reputation.score,
        )
        return profile.reputation

    # ------------------------------------------------------------------ #
    # Queries
    # ------------------------------------------------------------------ #

    def get_agent(self, agent_id: str) -> AgentProfile:
        return self._get_profile(agent_id)

    def list_agents(self) -> List[AgentProfile]:
        return list(self._agents.values())

    def find_by_capability(self, capability: str) -> List[AgentProfile]:
        capability = capability.lower().strip()
        return [profile for profile in self._agents.values() if capability in profile.capabilities]

    def summarize_capabilities(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for profile in self._agents.values():
            for capability in profile.capabilities:
                counts[capability] = counts.get(capability, 0) + 1
        return counts

    def rank_agents(
        self,
        capability: Optional[str] = None,
        limit: Optional[int] = None,
        sort_by: str = "score",
    ) -> List[AgentProfile]:
        candidates = self.find_by_capability(capability) if capability else self.list_agents()

        def sort_key(profile: AgentProfile) -> Tuple:
            if sort_by == "cost":
                return (profile.pricing.cost_per_task, -profile.reputation.score)
            if sort_by == "availability":
                status_rank = {
                    AvailabilityStatus.ONLINE: 0,
                    AvailabilityStatus.BUSY: 1,
                    AvailabilityStatus.MAINTENANCE: 2,
                    AvailabilityStatus.OFFLINE: 3,
                }
                return (
                    status_rank.get(profile.availability.status, 4),
                    -profile.availability.capacity_per_hour,
                    -profile.reputation.score,
                )
            return (-profile.reputation.score, profile.pricing.cost_per_task)

        ranked = sorted(candidates, key=sort_key)
        return ranked[:limit] if limit is not None else ranked

    # ------------------------------------------------------------------ #
    # Utilities
    # ------------------------------------------------------------------ #

    def _get_profile(self, agent_id: str) -> AgentProfile:
        try:
            return self._agents[agent_id]
        except KeyError as exc:  # pragma: no cover - defensive
            raise AgentNotFoundError(agent_id) from exc

