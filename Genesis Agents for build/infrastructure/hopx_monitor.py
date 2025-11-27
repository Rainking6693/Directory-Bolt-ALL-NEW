"""
HopX Environment Monitor
========================

Tracks active HopX environments so that the dashboard, alerting layer, and
Discord integrations all have a single source of truth.  The monitor writes
compact JSONL entries to ``logs/hopx_environments/events.jsonl`` and exposes
helpers for detecting stuck environments.
"""

from __future__ import annotations

import json
import os
import time
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, Optional

logger = logging.getLogger(__name__)


@dataclass
class HopXEnvironmentRecord:
    """Serializable snapshot of a HopX environment."""

    env_id: str
    business_id: str
    template: str
    created_at: float
    last_seen_at: float
    status: str = "active"  # active, destroyed, stuck

    @property
    def lifetime_seconds(self) -> float:
        return max(0.0, self.last_seen_at - self.created_at)


class HopXMonitor:
    """Simple lifecycle tracker backed by JSON lines on disk."""

    def __init__(self, log_dir: Optional[Path] = None):
        self.log_dir = Path(log_dir or "logs/hopx_environments")
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.events_path = self.log_dir / "events.jsonl"
        self.state_path = self.log_dir / "active_environments.json"
        self._active: Dict[str, HopXEnvironmentRecord] = {}
        self._load_state()

    # ------------------------------------------------------------------ #
    # Persistence helpers
    # ------------------------------------------------------------------ #

    def _load_state(self) -> None:
        if not self.state_path.exists():
            return
        try:
            data = json.loads(self.state_path.read_text())
            for env_id, payload in data.items():
                self._active[env_id] = HopXEnvironmentRecord(**payload)
        except Exception as exc:
            logger.warning("Unable to load HopX monitor state: %s", exc)

    def _persist_state(self) -> None:
        snapshot = {env_id: asdict(record) for env_id, record in self._active.items()}
        self.state_path.write_text(json.dumps(snapshot, indent=2))

    def _append_event(self, kind: str, payload: Dict) -> None:
        event = {"timestamp": time.time(), "type": kind, **payload}
        with self.events_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event) + os.linesep)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def record_created(self, env_id: str, business_id: str, template: str) -> None:
        record = HopXEnvironmentRecord(
            env_id=env_id,
            business_id=business_id,
            template=template,
            created_at=time.time(),
            last_seen_at=time.time(),
        )
        self._active[env_id] = record
        self._persist_state()
        self._append_event(
            "environment_created",
            {"env_id": env_id, "business_id": business_id, "template": template},
        )

    def record_destroyed(self, env_id: str) -> Optional[HopXEnvironmentRecord]:
        record = self._active.pop(env_id, None)
        if record:
            record.last_seen_at = time.time()
            record.status = "destroyed"
            self._persist_state()
            self._append_event(
                "environment_destroyed",
                {
                    "env_id": env_id,
                    "business_id": record.business_id,
                    "lifetime_seconds": record.lifetime_seconds,
                },
            )
        return record

    def record_api_error(self, error_message: str) -> None:
        """Persist a HopX API error so dashboards can track failure rate."""

        self._append_event(
            "api_error",
            {"error": error_message},
        )

    def mark_heartbeat(self, env_id: str) -> None:
        record = self._active.get(env_id)
        if record:
            record.last_seen_at = time.time()
            self._persist_state()

    def active_environments(self) -> Iterable[HopXEnvironmentRecord]:
        return list(self._active.values())

    def detect_stuck(
        self, max_age_seconds: int = 3600
    ) -> Iterable[HopXEnvironmentRecord]:
        """Return environments that exceeded ``max_age_seconds``."""

        now = time.time()
        dirty = False
        for record in self._active.values():
            if record.status != "active":
                continue
            if now - record.created_at > max_age_seconds:
                record.status = "stuck"
                record.last_seen_at = now
                dirty = True
                self._append_event(
                    "environment_stuck",
                    {
                        "env_id": record.env_id,
                        "business_id": record.business_id,
                        "template": record.template,
                        "age_seconds": now - record.created_at,
                    },
                )
                yield record
        if dirty:
            self._persist_state()


