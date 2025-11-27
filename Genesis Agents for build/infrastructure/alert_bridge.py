"""
Alert Bridge
=============

Thin helper that forwards BusinessMonitor alerts to an external webhook so we
can wire monitoring into tools like PagerDuty, OpsGenie, or custom dashboards.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


class AlertBridge:
    """Posts alert payloads to an external HTTP endpoint if configured."""

    def __init__(self) -> None:
        self.webhook = os.getenv("EXTERNAL_ALERT_WEBHOOK")
        self.timeout = float(os.getenv("EXTERNAL_ALERT_TIMEOUT", "5"))

    def dispatch(self, event_type: str, payload: Dict[str, Any]) -> None:
        if not self.webhook:
            return
        body = {"event_type": event_type, "payload": payload}
        try:
            httpx.post(self.webhook, json=body, timeout=self.timeout)
        except Exception as exc:  # pragma: no cover - network errors only logged
            logger.warning("AlertBridge failed to dispatch %s: %s", event_type, exc)
