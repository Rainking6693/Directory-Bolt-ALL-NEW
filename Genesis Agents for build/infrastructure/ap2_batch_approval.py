"""
AP2 Batch Approval Manager
=========================

Implements the Phase 3.1 monthly mandate model so agents can auto-approve
recurring purchases without repeatedly interrupting the user. The manager keeps
track of:

- Monthly intent mandates per agent/user pair
- Remaining budget and warning thresholds (80% / 100%)
- Exceptional triggers (>$1K purchase, unusual spending bursts)
- Cumulative spend + reset jobs
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

@dataclass
class MandateRecord:
    agent_name: str
    user_id: str
    budget: float
    remaining: float
    created_at: datetime
    expires_at: datetime
    mandate_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    warning_sent: bool = False
    transactions: List[Tuple[datetime, float]] = field(default_factory=list)


@dataclass
class BatchApprovalDecision:
    agent_name: str
    user_id: str
    mandate_id: str
    auto_approved: bool
    manual_required: bool
    blocked: bool
    reason: Optional[str]
    remaining_budget: float
    warning_triggered: bool

    def to_dict(self) -> Dict[str, object]:
        return {
            "agent": self.agent_name,
            "user_id": self.user_id,
            "mandate_id": self.mandate_id,
            "auto_approved": self.auto_approved,
            "manual_required": self.manual_required,
            "blocked": self.blocked,
            "reason": self.reason,
            "remaining_budget": self.remaining_budget,
            "warning_triggered": self.warning_triggered,
        }


class AP2BatchApprovalManager:
    """
    Tracks monthly mandate budgets and determines whether a purchase can be
    auto-approved. It intentionally decouples mandate bookkeeping from the
    actual AP2 connector; once the manager returns `auto_approved=True`, the
    caller can proceed with the usual AP2 flow without prompting the user again.
    """

    def __init__(
        self,
        *,
        budgets: Optional[Dict[str, object]] = None,
        warning_threshold: float = 0.8,
        exception_threshold: float = 1000.0,
        unusual_amount_threshold: float = 200.0,
        unusual_count_threshold: int = 3,
        unusual_window_seconds: int = 120,
    ) -> None:
        self.budgets = budgets or {}
        self.warning_threshold = warning_threshold
        self.exception_threshold = exception_threshold
        self.unusual_amount_threshold = unusual_amount_threshold
        self.unusual_count_threshold = unusual_count_threshold
        self.unusual_window = timedelta(seconds=unusual_window_seconds)
        self.mandates: Dict[Tuple[str, str], MandateRecord] = {}

    # ------------------------------------------------------------------ #
    # mandate lifecycle
    # ------------------------------------------------------------------ #
    def create_monthly_mandates(
        self,
        user_id: str,
        agent_budgets: Optional[Dict[str, AP2BudgetConfig]] = None,
    ) -> Dict[str, MandateRecord]:
        """
        Create one mandate per agent for the next 30 days.
        """
        configs = agent_budgets or self.budgets
        created: Dict[str, MandateRecord] = {}
        for agent_name, config in configs.items():
            key = self._key(agent_name, user_id)
            limit = self._resolve_monthly_limit(agent_name, config)
            mandate = MandateRecord(
                agent_name=agent_name,
                user_id=user_id,
                budget=limit,
                remaining=limit,
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            self.mandates[key] = mandate
            created[agent_name] = mandate
        return created

    def reset_monthly_budgets(self) -> None:
        """
        Reset every tracked mandate to its original monthly limit and issue a new
        mandate identifier. Called by the "monthly budget reset job".
        """
        for record in self.mandates.values():
            record.remaining = record.budget
            record.created_at = datetime.utcnow()
            record.expires_at = record.created_at + timedelta(days=30)
            record.warning_sent = False
            record.transactions.clear()
            record.mandate_id = str(uuid.uuid4())

    # ------------------------------------------------------------------ #
    # evaluation + tracking
    # ------------------------------------------------------------------ #
    def evaluate_purchase(
        self,
        agent_name: str,
        user_id: str,
        amount: float,
    ) -> BatchApprovalDecision:
        mandate = self._get_or_create_mandate(agent_name, user_id)
        reason: Optional[str] = None
        manual_required = False
        blocked = False
        warning_triggered = False

        if amount <= 0:
            raise ValueError("Batch approval amount must be positive.")

        projected_spend = (mandate.budget - mandate.remaining) + amount
        ratio = projected_spend / mandate.budget if mandate.budget else 1.0

        if amount >= self.exception_threshold:
            manual_required = True
            reason = "over_single_transaction_limit"

        if mandate.remaining <= 0 or ratio >= 1.0:
            blocked = True
            reason = reason or "monthly_budget_exhausted"

        elif amount > mandate.remaining:
            manual_required = True
            reason = reason or "insufficient_remaining_budget"

        if not blocked and ratio >= self.warning_threshold and not mandate.warning_sent:
            warning_triggered = True
            mandate.warning_sent = True

        if not blocked and self._detect_unusual_pattern(mandate, amount):
            manual_required = True
            reason = reason or "unusual_spending_pattern"

        decision = BatchApprovalDecision(
            agent_name=agent_name,
            user_id=user_id,
            mandate_id=mandate.mandate_id,
            auto_approved=not manual_required and not blocked,
            manual_required=manual_required,
            blocked=blocked,
            reason=reason,
            remaining_budget=mandate.remaining,
            warning_triggered=warning_triggered,
        )
        return decision

    def record_purchase(
        self,
        agent_name: str,
        user_id: str,
        amount: float,
    ) -> None:
        mandate = self._get_or_create_mandate(agent_name, user_id)
        mandate.remaining = max(mandate.remaining - amount, 0.0)
        mandate.transactions.append((datetime.utcnow(), amount))

    def get_summary(self) -> Dict[str, Dict[str, float]]:
        """
        Return a lightweight summary for dashboards/telemetry.
        """
        summary: Dict[str, Dict[str, float]] = {}
        for (agent, user), record in self.mandates.items():
            summary.setdefault(agent, {})
            summary[agent][user] = record.remaining
        return summary

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    def _key(self, agent_name: str, user_id: str) -> Tuple[str, str]:
        return (agent_name, user_id)

    def _get_or_create_mandate(self, agent_name: str, user_id: str) -> MandateRecord:
        key = self._key(agent_name, user_id)
        mandate = self.mandates.get(key)
        now = datetime.utcnow()
        if not mandate or mandate.expires_at <= now:
            config = self.budgets.get(agent_name)
            limit = self._resolve_monthly_limit(agent_name, config)
            mandate = MandateRecord(
                agent_name=agent_name,
                user_id=user_id,
                budget=limit,
                remaining=limit,
                created_at=now,
                expires_at=now + timedelta(days=30),
            )
            self.mandates[key] = mandate
        return mandate

    def _resolve_monthly_limit(self, agent_name: str, config: Optional[object]) -> float:
        if config is None:
            return 500.0
        if hasattr(config, "monthly_limit"):
            return float(getattr(config, "monthly_limit"))
        if isinstance(config, dict):
            return float(config.get("monthly_limit", 500.0))
        return 500.0

    def _detect_unusual_pattern(self, mandate: MandateRecord, amount: float) -> bool:
        # Remove stale history outside the observation window
        now = datetime.utcnow()
        mandate.transactions = [
            (ts, amt)
            for ts, amt in mandate.transactions
            if now - ts <= self.unusual_window
        ]
        recent_large = [
            amt for _, amt in mandate.transactions if amt >= self.unusual_amount_threshold
        ]
        if (
            amount >= self.unusual_amount_threshold
            and len(recent_large) >= self.unusual_count_threshold - 1
        ):
            return True
        return False


__all__ = [
    "AP2BatchApprovalManager",
    "BatchApprovalDecision",
    "MandateRecord",
]

