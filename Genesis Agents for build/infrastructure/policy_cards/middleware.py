"""
Policy Enforcement Middleware

Enforces policy checks before tool execution, including:
- Tool permission validation
- Rate limiting
- PII detection and redaction
- Safety constraint checks
- Compliance logging

Paper: https://arxiv.org/abs/2510.24383
"""

import re
import logging
import time
import json
from typing import Dict, Optional, Any, List
from datetime import datetime
from pathlib import Path

from .loader import PolicyCardLoader

logger = logging.getLogger(__name__)


class PIIDetector:
    """Detect and redact Personally Identifiable Information."""

    # PII patterns
    PII_PATTERNS = {
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",  # Social Security Number
        "credit_card": r"\b\d{16}\b",  # 16-digit credit card
        "credit_card_formatted": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
        "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "phone": r"\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b",
        "passport": r"\b[A-Z]{2}\d{6,9}\b",
        "ip_address": r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b",
    }

    # Redaction replacements
    REDACTIONS = {
        "ssn": "[SSN-REDACTED]",
        "credit_card": "[CC-REDACTED]",
        "credit_card_formatted": "[CC-REDACTED]",
        "email": "[EMAIL-REDACTED]",
        "phone": "[PHONE-REDACTED]",
        "passport": "[PASSPORT-REDACTED]",
        "ip_address": "[IP-REDACTED]",
    }

    def detect_pii(self, text: str) -> Dict[str, List[str]]:
        """
        Detect PII in text.

        Args:
            text: Text to scan for PII

        Returns:
            Dict of PII type to list of matches
        """
        if not isinstance(text, str):
            text = str(text)

        found = {}
        for pii_type, pattern in self.PII_PATTERNS.items():
            matches = re.findall(pattern, text)
            if matches:
                found[pii_type] = matches

        return found

    def redact_pii(self, text: str) -> str:
        """
        Redact all PII in text.

        Args:
            text: Text to redact

        Returns:
            Text with PII redacted
        """
        if not isinstance(text, str):
            return text

        redacted = text
        for pii_type, pattern in self.PII_PATTERNS.items():
            replacement = self.REDACTIONS.get(pii_type, "[REDACTED]")
            redacted = re.sub(pattern, replacement, redacted)

        return redacted

    def redact_dict(self, data: dict) -> dict:
        """
        Redact all PII in dictionary (values only).

        Args:
            data: Dictionary to redact

        Returns:
            Dictionary with PII redacted
        """
        redacted = {}
        for key, value in data.items():
            if isinstance(value, str):
                redacted[key] = self.redact_pii(value)
            elif isinstance(value, dict):
                redacted[key] = self.redact_dict(value)
            elif isinstance(value, list):
                redacted[key] = [
                    self.redact_pii(v) if isinstance(v, str) else v for v in value
                ]
            else:
                redacted[key] = value
        return redacted


class ComplianceLogger:
    """Log tool calls for compliance auditing."""

    def __init__(self, log_dir: str = "logs/policy_compliance"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def log_tool_call(
        self,
        agent_id: str,
        tool_name: str,
        args: dict,
        decision: str,
        reason: str,
        pii_detected: bool = False,
    ) -> None:
        """
        Log tool call for compliance.

        Args:
            agent_id: Agent making the call
            tool_name: Tool being called
            args: Tool arguments
            decision: "ALLOW" or "DENY"
            reason: Reason for decision
            pii_detected: Whether PII was detected
        """
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent_id": agent_id,
            "tool_name": tool_name,
            "args_summary": str(args)[:200],  # Truncate for logging
            "decision": decision,
            "reason": reason,
            "pii_detected": pii_detected,
        }

        # Write to daily log file
        log_file = (
            self.log_dir
            / f"compliance_{datetime.now().strftime('%Y-%m-%d')}.jsonl"
        )
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")


class PolicyEnforcer:
    """Main policy enforcement engine."""

    def __init__(self, cards_dir: str = ".policy_cards"):
        """
        Initialize policy enforcer.

        Args:
            cards_dir: Directory containing policy cards
        """
        self.loader = PolicyCardLoader(cards_dir)
        self.pii_detector = PIIDetector()
        self.compliance_logger = ComplianceLogger()
        self.call_history: List[Dict[str, Any]] = []

    def check_tool_call(
        self, agent_id: str, tool_name: str, args: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Check tool call against policy BEFORE execution.

        Args:
            agent_id: Agent making the call
            tool_name: Tool being called
            args: Tool arguments

        Returns:
            {
                "allowed": bool,
                "reason": str,
                "modified_args": dict,
                "pii_detected": bool,
                "pii_types": List[str],
            }
        """
        if args is None:
            args = {}

        result = {
            "allowed": True,
            "reason": "Passed all checks",
            "modified_args": args.copy(),
            "pii_detected": False,
            "pii_types": [],
        }

        # Record call (ALWAYS track, regardless of policy card existence)
        self.call_history.append(
            {
                "timestamp": time.time(),
                "agent_id": agent_id,
                "tool_name": tool_name,
                "allowed": True,  # Will update if denied
            }
        )

        # 1. Check if agent has policy card
        card = self.loader.get_card(agent_id)
        if not card:
            logger.debug(f"No policy card for {agent_id}, allowing call")
            return result

        # 2. Check tool permission
        if not self.loader.is_tool_allowed(agent_id, tool_name, args):
            result["allowed"] = False
            result["reason"] = f"Tool {tool_name} denied by policy card"
            # Update call history
            self.call_history[-1]["allowed"] = False
            self.compliance_logger.log_tool_call(
                agent_id, tool_name, args, "DENY", result["reason"]
            )
            return result

        # 3. Check action rules
        rules_ok, rules_reason = self.loader.check_action_rules(
            agent_id, tool_name, args
        )
        if not rules_ok:
            result["allowed"] = False
            result["reason"] = rules_reason
            # Update call history
            self.call_history[-1]["allowed"] = False
            self.compliance_logger.log_tool_call(
                agent_id, tool_name, args, "DENY", result["reason"]
            )
            return result

        # 4. Check PII detection
        safety_constraints = self.loader.get_safety_constraints(agent_id)
        if safety_constraints.get("pii_detection"):
            pii_found = self.pii_detector.detect_pii(str(args))
            if pii_found:
                result["pii_detected"] = True
                result["pii_types"] = list(pii_found.keys())
                logger.warning(
                    f"PII detected in {agent_id} call: {list(pii_found.keys())}"
                )

                # Redact if enabled
                if safety_constraints.get("sensitive_data_redaction"):
                    result["modified_args"] = self.pii_detector.redact_dict(args)
                    logger.debug("PII redacted in arguments")

        # 5. Log for compliance
        compliance_reqs = self.loader.get_compliance_requirements(agent_id)
        if compliance_reqs.get("log_all_tool_calls"):
            self.compliance_logger.log_tool_call(
                agent_id,
                tool_name,
                args,
                "ALLOW" if result["allowed"] else "DENY",
                result["reason"],
                result["pii_detected"],
            )

        return result

    def validate_output(
        self, agent_id: str, output: str, max_length: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Validate tool output against policy.

        Args:
            agent_id: Agent that generated output
            output: Output to validate
            max_length: Maximum allowed output length

        Returns:
            {
                "valid": bool,
                "reason": str,
                "pii_detected": bool,
                "redacted_output": str,
            }
        """
        result = {
            "valid": True,
            "reason": "Output valid",
            "pii_detected": False,
            "redacted_output": output,
        }

        safety_constraints = self.loader.get_safety_constraints(agent_id)

        # Check PII in output
        if safety_constraints.get("pii_detection"):
            pii_found = self.pii_detector.detect_pii(output)
            if pii_found:
                result["pii_detected"] = True
                logger.warning(f"PII detected in {agent_id} output: {list(pii_found.keys())}")

                if safety_constraints.get("sensitive_data_redaction"):
                    result["redacted_output"] = self.pii_detector.redact_pii(output)

        # Check output length
        if max_length and len(output) > max_length:
            result["valid"] = False
            result["reason"] = f"Output exceeds max length: {len(output)} > {max_length}"

        return result

    def get_agent_stats(self, agent_id: str) -> Dict[str, Any]:
        """
        Get policy enforcement stats for agent.

        Args:
            agent_id: Agent to get stats for

        Returns:
            Stats dict
        """
        agent_calls = [c for c in self.call_history if c["agent_id"] == agent_id]

        if not agent_calls:
            return {
                "agent_id": agent_id,
                "total_calls": 0,
                "allowed_calls": 0,
                "denied_calls": 0,
                "allow_rate": 0.0,
            }

        allowed = sum(1 for c in agent_calls if c["allowed"])
        denied = len(agent_calls) - allowed

        return {
            "agent_id": agent_id,
            "total_calls": len(agent_calls),
            "allowed_calls": allowed,
            "denied_calls": denied,
            "allow_rate": allowed / len(agent_calls) if agent_calls else 0.0,
        }

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get enforcement stats for all agents."""
        agents = set(c["agent_id"] for c in self.call_history)
        return {agent_id: self.get_agent_stats(agent_id) for agent_id in agents}

    def reset_history(self, agent_id: Optional[str] = None) -> None:
        """
        Reset call history.

        Args:
            agent_id: Optional - reset only for specific agent
        """
        if agent_id:
            self.call_history = [
                c for c in self.call_history if c["agent_id"] != agent_id
            ]
        else:
            self.call_history.clear()

    def export_report(self, output_file: str) -> None:
        """
        Export compliance report.

        Args:
            output_file: File path to write report
        """
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_agents": len(self.loader.list_agents()),
            "total_calls": len(self.call_history),
            "agents": self.get_all_stats(),
            "policy_summary": self.loader.export_policy_summary(),
        }

        with open(output_file, "w") as f:
            json.dump(report, f, indent=2)

        logger.info(f"Compliance report exported to {output_file}")
