"""
Marketplace Transaction Ledger
==============================

Tracks marketplace transactions between agents and provides helper utilities
for settlement preparation (future x402 protocol integration) and dispute
lifecycles.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


class TransactionStatus(str, Enum):
    """Lifecycle status for marketplace transactions."""

    PENDING = "pending"
    SETTLED = "settled"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"


@dataclass
class TransactionRecord:
    """
    Immutable snapshot representing a transaction.

    - `context` can capture arbitrary metadata (task id, tool, etc.)
    - `evidence` stores references for dispute resolution
    """

    transaction_id: str
    created_at: datetime
    payer_agent: str
    provider_agent: str
    capability: str
    amount: float
    currency: str
    status: TransactionStatus = TransactionStatus.PENDING
    context: Dict[str, object] = field(default_factory=dict)
    evidence: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, object]:
        payload = asdict(self)
        payload["status"] = self.status.value
        payload["created_at"] = self.created_at.isoformat()
        return payload

    def supports_dispute(self) -> bool:
        return self.status in {TransactionStatus.PENDING, TransactionStatus.SETTLED}


class TransactionNotFoundError(KeyError):
    """Raised when referencing a missing transaction."""


class InvalidTransactionStateError(RuntimeError):
    """Raised when a state transition is invalid."""


class TransactionLedger:
    """
    In-memory ledger for agent marketplace transactions.

    Supports:
    - Recording new transactions
    - Transitioning to settled/disputed/cancelled
    - Preparing settlement payloads for x402 protocol
    - Exporting histories for audit or reporting
    """

    def __init__(self) -> None:
        self._transactions: Dict[str, TransactionRecord] = {}

    # ------------------------------------------------------------------ #
    # Recording
    # ------------------------------------------------------------------ #

    def record_transaction(
        self,
        payer_agent: str,
        provider_agent: str,
        capability: str,
        amount: float,
        currency: str = "USD",
        context: Optional[Dict[str, object]] = None,
    ) -> TransactionRecord:
        # Validate amount
        if amount <= 0:
            raise ValueError(f"Transaction amount must be positive, got {amount}")
        
        transaction_id = uuid.uuid4().hex
        record = TransactionRecord(
            transaction_id=transaction_id,
            created_at=datetime.now(timezone.utc),
            payer_agent=payer_agent,
            provider_agent=provider_agent,
            capability=capability,
            amount=amount,
            currency=currency,
            context=context or {},
        )
        self._transactions[transaction_id] = record
        logger.debug(
            "Recorded transaction %s %s→%s %.2f %s",
            transaction_id,
            payer_agent,
            provider_agent,
            amount,
            currency,
        )
        return record

    # ------------------------------------------------------------------ #
    # State transitions
    # ------------------------------------------------------------------ #

    def settle_transaction(self, transaction_id: str) -> TransactionRecord:
        record = self._get(transaction_id)
        if record.status != TransactionStatus.PENDING:
            raise InvalidTransactionStateError(f"Cannot settle transaction {transaction_id} state={record.status}")
        record.status = TransactionStatus.SETTLED
        logger.debug("Settled transaction %s", transaction_id)
        return record

    def cancel_transaction(self, transaction_id: str) -> TransactionRecord:
        record = self._get(transaction_id)
        if record.status != TransactionStatus.PENDING:
            raise InvalidTransactionStateError(f"Cannot cancel transaction {transaction_id} state={record.status}")
        record.status = TransactionStatus.CANCELLED
        logger.debug("Cancelled transaction %s", transaction_id)
        return record

    def flag_dispute(self, transaction_id: str, evidence: Optional[Iterable[str]] = None) -> TransactionRecord:
        record = self._get(transaction_id)
        if not record.supports_dispute():
            raise InvalidTransactionStateError(f"Cannot dispute transaction {transaction_id} state={record.status}")
        record.status = TransactionStatus.DISPUTED
        if evidence:
            record.evidence.extend(str(item) for item in evidence)
        logger.warning("Transaction %s flagged as disputed (%d evidence items)", transaction_id, len(record.evidence))
        return record

    # ------------------------------------------------------------------ #
    # Queries
    # ------------------------------------------------------------------ #

    def get_transaction(self, transaction_id: str) -> TransactionRecord:
        return self._get(transaction_id)

    def list_transactions(self) -> List[TransactionRecord]:
        return list(self._transactions.values())

    def list_for_agent(self, agent_id: str, role: Optional[str] = None) -> List[TransactionRecord]:
        records = []
        for record in self._transactions.values():
            matches = (
                agent_id in {record.payer_agent, record.provider_agent}
                if role is None
                else (record.payer_agent == agent_id if role == "payer" else record.provider_agent == agent_id)
            )
            if matches:
                records.append(record)
        return sorted(records, key=lambda rec: rec.created_at)

    def list_open_disputes(self) -> List[TransactionRecord]:
        return [record for record in self._transactions.values() if record.status == TransactionStatus.DISPUTED]

    # ------------------------------------------------------------------ #
    # Export helpers
    # ------------------------------------------------------------------ #

    def prepare_settlement_payload(self, transaction_id: str) -> Dict[str, object]:
        """
        Prepare payload for x402 protocol hand-off.

        x402 is a hypothetical protocol; we return a dictionary matching the
        expected schema (timestamped, signed fields can be added later).
        """
        record = self._get(transaction_id)
        if record.status not in {TransactionStatus.PENDING, TransactionStatus.SETTLED}:
            raise InvalidTransactionStateError(
                f"Cannot create settlement payload for transaction {transaction_id} state={record.status}"
            )

        payload = {
            "transaction_id": record.transaction_id,
            "payer": record.payer_agent,
            "provider": record.provider_agent,
            "capability": record.capability,
            "amount": record.amount,
            "currency": record.currency,
            "created_at": record.created_at.isoformat(),
            "status": record.status.value,
            "context": record.context.copy(),
        }
        logger.debug("Prepared settlement payload for %s", transaction_id)
        return payload

    def export_history(self) -> List[Dict[str, object]]:
        return [record.to_dict() for record in self.list_transactions()]

    # ------------------------------------------------------------------ #
    # Internal
    # ------------------------------------------------------------------ #

    def _get(self, transaction_id: str) -> TransactionRecord:
        try:
            return self._transactions[transaction_id]
        except KeyError as exc:  # pragma: no cover - defensive logging
            logger.error("Transaction %s not found", transaction_id)
            raise TransactionNotFoundError(transaction_id) from exc

