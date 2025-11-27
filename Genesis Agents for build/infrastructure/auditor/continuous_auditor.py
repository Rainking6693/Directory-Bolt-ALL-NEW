from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any

from infrastructure.business_monitor import get_monitor

logger = logging.getLogger(__name__)


class ContinuousAuditor:
    """
    AuditLLM-inspired lightweight auditor that enforces per-agent policy checklists.
    """

    def __init__(self, policy_path: Optional[Path] = None):
        self.policy_path = policy_path or Path("data/auditor_policies.json")
        self.policies = self._load_policies()
        try:
            self.monitor = get_monitor()
        except Exception as exc:  # pragma: no cover - monitor optional
            logger.warning(f"ContinuousAuditor running without business monitor: {exc}")
            self.monitor = None

    def _load_policies(self) -> Dict[str, Dict[str, Any]]:
        if not self.policy_path.exists():
            raise FileNotFoundError(
                f"Auditor policy file missing: {self.policy_path}. "
                "Add data/auditor_policies.json or provide custom path."
            )
        with self.policy_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def evaluate(self, agent_name: str, payload: Any) -> Dict[str, Any]:
        """
        Evaluate agent output against policy checklist and return verdict.
        """
        policy = self.policies.get(agent_name) or self.policies.get("default", {})
        rules = policy.get("rules", [])
        text = self._normalize_payload(payload)
        violations = []

        for rule in rules:
            result = self._apply_rule(rule, text)
            if not result["passed"]:
                violations.append(result["message"])

        status = "violation" if violations else "ok"
        verdict = {
            "agent": agent_name,
            "status": status,
            "violations": violations,
            "rule_count": len(rules),
        }

        if self.monitor:
            self.monitor.record_policy_audit(agent_name, verdict)

        if status == "violation":
            logger.warning(
                "Auditor detected policy violation for %s: %s",
                agent_name,
                "; ".join(violations),
            )
        else:
            logger.debug("Auditor passed output for %s", agent_name)

        return verdict

    def _normalize_payload(self, payload: Any) -> str:
        if payload is None:
            return ""
        if isinstance(payload, str):
            return payload.lower()
        try:
            return json.dumps(payload, ensure_ascii=False).lower()
        except TypeError:
            return str(payload).lower()

    def _apply_rule(self, rule: Dict[str, Any], text: str) -> Dict[str, Any]:
        rule_type = rule.get("type")
        token = rule.get("token", "").lower()
        pattern = rule.get("pattern", "").lower()
        description = rule.get("description", "Policy violation")

        if rule_type == "must_include":
            passed = token in text
        elif rule_type == "must_not_contain":
            passed = token not in text
        elif rule_type == "require_reference":
            passed = pattern in text
        else:
            passed = True  # Unknown rules default to pass

        return {
            "passed": passed,
            "message": description if not passed else "",
        }
