"""
Policy Card Loader

Loads and manages YAML policy cards for all agents.
Provides methods to check tool permissions, rate limits, and compliance rules.

Paper: https://arxiv.org/abs/2510.24383
"""

import yaml
import re
import json
from pathlib import Path
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class RateLimitTracker:
    """Track and enforce rate limits for tool calls."""

    def __init__(self):
        self.tool_call_times: Dict[str, List[float]] = {}

    def check_rate_limit(
        self, agent_id: str, tool_name: str, limit_per_hour: int
    ) -> tuple[bool, str]:
        """
        Check if tool call is within rate limit.

        Returns:
            (allowed: bool, reason: str)
        """
        if limit_per_hour <= 0:
            return True, "No rate limit"

        key = f"{agent_id}:{tool_name}"
        now = datetime.now().timestamp()
        one_hour_ago = now - 3600

        # Initialize if needed
        if key not in self.tool_call_times:
            self.tool_call_times[key] = []

        # Remove calls older than 1 hour
        self.tool_call_times[key] = [
            t for t in self.tool_call_times[key] if t > one_hour_ago
        ]

        # Check limit
        call_count = len(self.tool_call_times[key])
        if call_count >= limit_per_hour:
            return (
                False,
                f"Rate limit exceeded: {call_count}/{limit_per_hour} calls in past hour",
            )

        # Record this call
        self.tool_call_times[key].append(now)
        return True, f"OK ({call_count + 1}/{limit_per_hour})"

    def reset(self, agent_id: str = None, tool_name: str = None):
        """Reset rate limit tracker."""
        if agent_id and tool_name:
            key = f"{agent_id}:{tool_name}"
            self.tool_call_times.pop(key, None)
        else:
            self.tool_call_times.clear()


class PolicyCardLoader:
    """Load and manage policy cards for all agents."""

    def __init__(self, cards_dir: str = ".policy_cards"):
        """
        Initialize policy card loader.

        Args:
            cards_dir: Directory containing YAML policy cards
        """
        self.cards_dir = Path(cards_dir)
        self.cards: Dict[str, Dict[str, Any]] = {}
        self.rate_limiter = RateLimitTracker()
        self._load_all_cards()

    def _load_all_cards(self) -> None:
        """Load all YAML policy cards from directory."""
        if not self.cards_dir.exists():
            logger.warning(f"Policy cards directory not found: {self.cards_dir}")
            return

        for card_file in sorted(self.cards_dir.glob("*.yaml")):
            try:
                with open(card_file, "r") as f:
                    card = yaml.safe_load(f)
                    if card and "agent_id" in card:
                        self.cards[card["agent_id"]] = card
                        logger.debug(f"Loaded policy card: {card['agent_id']}")
            except Exception as e:
                logger.error(f"Failed to load policy card {card_file}: {e}")

        logger.info(f"Loaded {len(self.cards)} policy cards")

    def get_card(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """
        Get policy card for agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Policy card dict or None if not found
        """
        return self.cards.get(agent_id)

    def is_tool_allowed(
        self, agent_id: str, tool_name: str, args: Optional[dict] = None
    ) -> bool:
        """
        Check if tool is allowed for agent.

        Args:
            agent_id: Agent identifier
            tool_name: Name of tool to check
            args: Optional tool arguments (for pattern matching)

        Returns:
            True if tool is allowed, False otherwise
        """
        card = self.get_card(agent_id)
        if not card:
            logger.debug(f"No policy card for {agent_id}, allowing all tools")
            return True

        capabilities = card.get("capabilities", {})
        denied_patterns = capabilities.get("denied_tools", [])
        allowed_patterns = capabilities.get("allowed_tools", [])

        # Check denied patterns first (takes precedence)
        for pattern in denied_patterns:
            if self._pattern_matches(tool_name, pattern, args):
                logger.debug(
                    f"Tool {tool_name} DENIED for {agent_id} (matches pattern: {pattern})"
                )
                return False

        # If allowed_patterns is empty, allow by default
        if not allowed_patterns:
            logger.debug(f"No allowed patterns, allowing {tool_name} for {agent_id}")
            return True

        # Check allowed patterns
        for pattern in allowed_patterns:
            if self._pattern_matches(tool_name, pattern, args):
                logger.debug(f"Tool {tool_name} ALLOWED for {agent_id}")
                return True

        # Not in allowed list = deny
        logger.debug(f"Tool {tool_name} NOT in allowed list for {agent_id}")
        return False

    def check_action_rules(
        self, agent_id: str, tool_name: str, args: Optional[dict] = None
    ) -> tuple[bool, str]:
        """
        Check action rules for tool call.

        Args:
            agent_id: Agent identifier
            tool_name: Tool name
            args: Tool arguments

        Returns:
            (allowed: bool, reason: str)
        """
        card = self.get_card(agent_id)
        if not card:
            return True, "No policy card"

        action_rules = card.get("action_rules", [])
        for rule in action_rules:
            if self._evaluate_rule_condition(
                rule.get("condition", ""), tool_name, args
            ):
                action = rule.get("action", "allow")
                reason = rule.get("reason", "Rule matched")

                if action == "deny":
                    return False, reason

                # Check rate limit
                if rule.get("rate_limit"):
                    allowed, limit_reason = self.rate_limiter.check_rate_limit(
                        agent_id, tool_name, rule.get("rate_limit")
                    )
                    if not allowed:
                        return False, limit_reason

        return True, "All action rules passed"

    def get_safety_constraints(self, agent_id: str) -> Dict[str, Any]:
        """
        Get safety constraints for agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Safety constraints dict
        """
        card = self.get_card(agent_id)
        if not card:
            return self._default_constraints()

        return card.get("safety_constraints", self._default_constraints())

    def get_compliance_requirements(self, agent_id: str) -> Dict[str, Any]:
        """
        Get compliance requirements for agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Compliance requirements dict
        """
        card = self.get_card(agent_id)
        if not card:
            return self._default_compliance()

        return card.get("compliance", self._default_compliance())

    def list_agents(self) -> List[str]:
        """
        List all agents with policy cards.

        Returns:
            List of agent IDs
        """
        return sorted(self.cards.keys())

    def validate_card(self, card: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        Validate policy card structure.

        Args:
            card: Policy card to validate

        Returns:
            (valid: bool, errors: List[str])
        """
        errors = []

        # Required fields
        if "agent_id" not in card:
            errors.append("Missing required field: agent_id")
        if "version" not in card:
            errors.append("Missing required field: version")

        # Validate capabilities
        capabilities = card.get("capabilities", {})
        if not isinstance(capabilities.get("allowed_tools"), list):
            errors.append("capabilities.allowed_tools must be a list")
        if not isinstance(capabilities.get("denied_tools"), list):
            errors.append("capabilities.denied_tools must be a list")

        # Validate action rules
        rules = card.get("action_rules", [])
        for i, rule in enumerate(rules):
            if "condition" not in rule:
                errors.append(f"action_rules[{i}]: missing condition")
            if "action" not in rule:
                errors.append(f"action_rules[{i}]: missing action")

        return len(errors) == 0, errors

    def _pattern_matches(
        self, tool_name: str, pattern: str, args: Optional[dict] = None
    ) -> bool:
        """
        Match tool name against pattern (supports wildcards).

        Patterns:
            - "Read" - exact match
            - "Bash(*)" - prefix match with wildcard
            - "Bash(pytest:*)" - wildcard with colon separator
        """
        # Handle special pattern formats like "Bash(pytest:*)"
        if "(" in pattern:
            # Extract base tool and subpattern
            base_tool, rest = pattern.split("(", 1)
            subpattern = rest.rstrip(")")

            if not tool_name.startswith(base_tool):
                return False

            # If subpattern is "*", match any
            if subpattern == "*":
                return True

            # Check command argument if provided
            if args and "command" in args:
                command = args["command"]
                if subpattern.endswith(":*"):
                    # "pytest:*" pattern - check if command starts with prefix
                    prefix = subpattern.rstrip(":*")
                    return prefix in command
                else:
                    return subpattern in command

            return False

        # Simple wildcard matching
        regex_pattern = pattern.replace("*", ".*")
        return bool(re.match(f"^{regex_pattern}$", tool_name))

    def _evaluate_rule_condition(
        self, condition: str, tool_name: str, args: Optional[dict] = None
    ) -> bool:
        """
        Evaluate rule condition.

        Simple eval-based evaluation (MVP - replace with AST parser for production).
        """
        if not condition:
            return True

        try:
            # Build evaluation context
            context = {
                "tool": tool_name,
                "command": args.get("command", "") if args else "",
                "args": args or {},
            }

            # Safe eval with restricted builtins
            safe_dict = {
                "tool": context["tool"],
                "command": context["command"],
                "args": context["args"],
                "len": len,
                "str": str,
                "int": int,
            }

            result = eval(condition, {"__builtins__": {}}, safe_dict)
            return bool(result)
        except Exception as e:
            logger.warning(f"Failed to evaluate condition '{condition}': {e}")
            return False

    def _default_constraints(self) -> Dict[str, Any]:
        """Return default safety constraints."""
        return {
            "max_tokens_per_call": 8192,
            "max_calls_per_session": 1000,
            "max_execution_time_seconds": 300,
            "pii_detection": True,
            "sensitive_data_redaction": True,
            "memory_limit_mb": 2048,
        }

    def _default_compliance(self) -> Dict[str, Any]:
        """Return default compliance requirements."""
        return {
            "data_retention_days": 90,
            "audit_log_required": False,
            "human_review_threshold": "high_risk",
            "log_all_tool_calls": False,
        }

    def export_policy_summary(self) -> Dict[str, Any]:
        """
        Export summary of all policies for validation.

        Returns:
            Summary dict with all policies
        """
        summary = {}
        for agent_id, card in self.cards.items():
            summary[agent_id] = {
                "version": card.get("version"),
                "description": card.get("description"),
                "allowed_tools": card.get("capabilities", {}).get("allowed_tools", []),
                "denied_tools": card.get("capabilities", {}).get("denied_tools", []),
                "rules_count": len(card.get("action_rules", [])),
            }
        return summary

    def reload_cards(self) -> None:
        """Reload all policy cards from disk."""
        self.cards.clear()
        self._load_all_cards()
        logger.info("Reloaded policy cards")
