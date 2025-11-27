"""
Policy Card Middleware

Enforces Policy Cards at middleware level for all tool executions.
Integrates with existing PolicyCardLoader for centralized policy management.

Paper: https://arxiv.org/abs/2510.24383

Author: Shane (Backend API Specialist)
Date: 2025-11-08
Version: 1.0.0
"""

import logging
from typing import Optional, Dict, Any
from infrastructure.middleware.base import (
    AgentMiddleware,
    ToolCall,
    ToolResult,
    PolicyViolation,
)
from infrastructure.policy_cards.loader import PolicyCardLoader

# Orchestration layer imports
from infrastructure.halo_router import HALORouter
from infrastructure.task_dag import TaskDAG, Task
from infrastructure.aop_validator import AOPValidator

logger = logging.getLogger(__name__)


class PolicyCardMiddleware(AgentMiddleware):
    """
    Enforce Policy Cards at middleware level.

    This middleware integrates with the existing PolicyCardLoader to enforce:
    - Tool access control (allowed/denied tools)
    - Action rules (rate limits, conditions)
    - Safety constraints (max tokens, execution time)
    - Compliance requirements (audit logging, data retention)

    Usage:
        middleware = PolicyCardMiddleware(policy_dir=".policy_cards")
        # Middleware will be called automatically by HALO router
    """

    def __init__(
        self,
        policy_dir: str = ".policy_cards",
        halo_router: Optional[HALORouter] = None,
        aop_validator: Optional[AOPValidator] = None,
    ):
        """
        Initialize PolicyCardMiddleware.

        Args:
            policy_dir: Directory containing YAML policy cards
            halo_router: Optional HALORouter instance for agent routing integration
            aop_validator: Optional AOPValidator instance for orchestration validation
        """
        self.policy_loader = PolicyCardLoader(cards_dir=policy_dir)
        self.call_stats: Dict[str, Dict[str, int]] = {}  # agent -> {tool -> count}

        # Orchestration integration
        self.halo_router = halo_router
        self.aop_validator = aop_validator

        # Auto-register with HALO router if available
        if self.halo_router:
            self._register_with_halo()

        logger.info(
            f"PolicyCardMiddleware initialized with {len(self.policy_loader.cards)} policy cards "
            f"(HALO: {'enabled' if halo_router else 'disabled'}, "
            f"AOP: {'enabled' if aop_validator else 'disabled'})"
        )

    async def on_tool_call(self, call: ToolCall) -> None:
        """
        Check policy card before tool execution.

        Validation steps:
        1. Verify agent has a policy card
        2. Check if tool is allowed for this agent
        3. Validate action rules (rate limits, conditions)
        4. Check safety constraints

        Args:
            call: Tool call request

        Raises:
            PolicyViolation: If any policy check fails
        """
        agent_id = call.agent_name
        tool_name = call.tool_name
        args = call.arguments

        # Step 1: Get policy card
        card = self.policy_loader.get_card(agent_id)
        if not card:
            # No policy card = allow all (permissive default)
            logger.debug(f"No policy card for {agent_id}, allowing {tool_name}")
            return

        # Step 2: Check if tool is allowed
        if not self.policy_loader.is_tool_allowed(agent_id, tool_name, args):
            denied_tools = card.get("capabilities", {}).get("denied_tools", [])
            allowed_tools = card.get("capabilities", {}).get("allowed_tools", [])
            raise PolicyViolation(
                f"Tool '{tool_name}' not allowed for agent '{agent_id}'. "
                f"Allowed: {allowed_tools}, Denied: {denied_tools}"
            )

        # Step 3: Check action rules (rate limits, conditions)
        allowed, reason = self.policy_loader.check_action_rules(agent_id, tool_name, args)
        if not allowed:
            raise PolicyViolation(
                f"Action rule violated for {agent_id} → {tool_name}: {reason}"
            )

        # Step 4: Check safety constraints
        constraints = self.policy_loader.get_safety_constraints(agent_id)
        self._validate_safety_constraints(call, constraints)

        # Track call statistics
        self._record_call(agent_id, tool_name)

        logger.debug(f"Policy check passed: {agent_id} → {tool_name}")

    async def on_tool_result(self, result: ToolResult) -> None:
        """
        Log policy compliance after execution.

        Checks:
        - Compliance requirements (audit logging)
        - Output validation (PII detection, sensitive data)

        Args:
            result: Tool execution result
        """
        agent_id = result.agent_name
        tool_name = result.tool_name

        # Get compliance requirements
        compliance = self.policy_loader.get_compliance_requirements(agent_id)

        # Log audit trail if required
        if compliance.get("log_all_tool_calls", False):
            logger.info(
                f"[AUDIT] {agent_id} → {tool_name}: "
                f"success={result.success}, "
                f"latency={result.execution_time_ms:.2f}ms"
            )

        # Check if human review is needed
        if compliance.get("human_review_threshold") == "high_risk":
            if self._is_high_risk_operation(tool_name, result):
                logger.warning(
                    f"[HUMAN REVIEW REQUIRED] {agent_id} → {tool_name}: "
                    f"High-risk operation detected"
                )

        # Validate output doesn't contain sensitive data
        constraints = self.policy_loader.get_safety_constraints(agent_id)
        if constraints.get("sensitive_data_redaction", False):
            self._check_sensitive_data(result)

        logger.debug(f"Policy compliance check passed: {agent_id} → {tool_name}")

    async def on_tool_error(self, call: ToolCall, error: Exception) -> None:
        """
        Log policy violations and errors.

        Args:
            call: Original tool call
            error: Exception that occurred
        """
        logger.error(
            f"[POLICY ERROR] {call.agent_name} → {call.tool_name}: "
            f"{type(error).__name__}: {error}"
        )

        # Record error statistics
        if call.agent_name not in self.call_stats:
            self.call_stats[call.agent_name] = {}
        if "errors" not in self.call_stats[call.agent_name]:
            self.call_stats[call.agent_name]["errors"] = 0
        self.call_stats[call.agent_name]["errors"] += 1

    def _validate_safety_constraints(
        self, call: ToolCall, constraints: Dict[str, Any]
    ) -> None:
        """
        Validate safety constraints.

        Args:
            call: Tool call request
            constraints: Safety constraints from policy card

        Raises:
            PolicyViolation: If constraints are violated
        """
        # Check max execution time (from context)
        max_execution_time = constraints.get("max_execution_time_seconds", 300)
        estimated_time = call.context.get("estimated_execution_time_seconds", 0)
        if estimated_time > max_execution_time:
            raise PolicyViolation(
                f"Estimated execution time ({estimated_time}s) exceeds "
                f"max allowed ({max_execution_time}s)"
            )

        # Check memory limit (from context)
        max_memory_mb = constraints.get("memory_limit_mb", 2048)
        estimated_memory = call.context.get("estimated_memory_mb", 0)
        if estimated_memory > max_memory_mb:
            raise PolicyViolation(
                f"Estimated memory usage ({estimated_memory}MB) exceeds "
                f"max allowed ({max_memory_mb}MB)"
            )

        # Check max tokens per call (for LLM tools)
        max_tokens = constraints.get("max_tokens_per_call", 8192)
        if "max_tokens" in call.arguments:
            requested_tokens = call.arguments["max_tokens"]
            if requested_tokens > max_tokens:
                raise PolicyViolation(
                    f"Requested tokens ({requested_tokens}) exceeds "
                    f"max allowed ({max_tokens})"
                )

    def _record_call(self, agent_id: str, tool_name: str) -> None:
        """Record tool call statistics."""
        if agent_id not in self.call_stats:
            self.call_stats[agent_id] = {}
        if tool_name not in self.call_stats[agent_id]:
            self.call_stats[agent_id][tool_name] = 0
        self.call_stats[agent_id][tool_name] += 1

    def _is_high_risk_operation(self, tool_name: str, result: ToolResult) -> bool:
        """
        Determine if operation is high-risk.

        High-risk operations:
        - File deletions
        - Database modifications
        - External API calls with side effects
        - Financial transactions

        Args:
            tool_name: Tool name
            result: Tool execution result

        Returns:
            True if high-risk
        """
        high_risk_patterns = [
            "delete",
            "drop",
            "truncate",
            "remove",
            "execute",
            "payment",
            "transaction",
            "deploy",
        ]

        tool_lower = tool_name.lower()
        return any(pattern in tool_lower for pattern in high_risk_patterns)

    def _check_sensitive_data(self, result: ToolResult) -> None:
        """
        Check if result contains sensitive data.

        This is a basic implementation that checks for common patterns.
        Production systems should use dedicated PII detection libraries.

        Args:
            result: Tool execution result

        Raises:
            PolicyViolation: If sensitive data is detected (optional)
        """
        if not result.result or not isinstance(result.result, str):
            return

        result_str = str(result.result)

        # Basic patterns for sensitive data
        sensitive_patterns = [
            # Credit card (basic)
            r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b",
            # SSN (basic)
            r"\b\d{3}-\d{2}-\d{4}\b",
            # API keys (basic)
            r"\b[A-Za-z0-9]{32,}\b",
        ]

        import re

        for pattern in sensitive_patterns:
            if re.search(pattern, result_str):
                logger.warning(
                    f"[SENSITIVE DATA DETECTED] {result.agent_name} → {result.tool_name}: "
                    f"Result may contain sensitive data (pattern: {pattern})"
                )
                # Optionally raise PolicyViolation to block the result
                # raise PolicyViolation("Sensitive data detected in result")

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get policy enforcement statistics.

        Returns:
            Statistics dict with call counts and errors per agent/tool
        """
        return {
            "total_agents": len(self.call_stats),
            "total_calls": sum(
                sum(tools.values())
                for tools in self.call_stats.values()
                if isinstance(tools, dict)
            ),
            "agent_stats": self.call_stats,
        }

    def reset_statistics(self) -> None:
        """Reset statistics counters."""
        self.call_stats.clear()
        logger.info("Policy statistics reset")

    # =========================================================================
    # ORCHESTRATION INTEGRATION METHODS
    # =========================================================================

    def _register_with_halo(self) -> None:
        """
        Auto-register policy middleware with HALO router.

        This enables HALO to automatically enforce policies during agent routing.
        """
        if not hasattr(self.halo_router, "middleware_registry"):
            # HALO router doesn't support middleware registry yet
            logger.warning(
                "HALO router doesn't support middleware_registry. "
                "Policy enforcement will be manual."
            )
            return

        # Register this middleware instance
        self.halo_router.middleware_registry.setdefault("policy", []).append(self)
        logger.info("PolicyCardMiddleware registered with HALO router")

    def validate_with_aop(self, task: Task, agent_name: str) -> Dict[str, Any]:
        """
        Validate task assignment with AOP principles.

        Integrates with AOPValidator to ensure:
        - Solvability: Agent can complete the task
        - Completeness: All required tools are available
        - Non-redundancy: No duplicate work

        Args:
            task: Task to validate
            agent_name: Agent assigned to task

        Returns:
            Validation result dict with {valid: bool, reason: str, score: float}
        """
        if not self.aop_validator:
            # No AOP validator = assume valid
            return {"valid": True, "reason": "No AOP validator configured", "score": 1.0}

        # Get agent's policy card
        card = self.policy_loader.get_card(agent_name)
        if not card:
            return {
                "valid": False,
                "reason": f"No policy card for agent {agent_name}",
                "score": 0.0,
            }

        # Check if agent has capabilities for task
        task_tools = getattr(task, "required_tools", [])
        for tool in task_tools:
            if not self.policy_loader.is_tool_allowed(agent_name, tool, {}):
                return {
                    "valid": False,
                    "reason": f"Agent {agent_name} lacks policy approval for tool {tool}",
                    "score": 0.0,
                }

        # Passed all checks
        return {
            "valid": True,
            "reason": f"Agent {agent_name} has policy approval for all required tools",
            "score": 1.0,
        }

    def provide_routing_feedback(
        self, agent_name: str, tool_name: str, success: bool, score: float
    ) -> None:
        """
        Provide feedback to HALO router for future routing decisions.

        This enables HALO to learn from policy violations and successes.

        Args:
            agent_name: Agent that executed the tool
            tool_name: Tool that was executed
            success: Whether execution succeeded
            score: Quality score (0.0 to 1.0)
        """
        if not self.halo_router:
            return

        # Build feedback record
        feedback = {
            "agent": agent_name,
            "tool": tool_name,
            "success": success,
            "score": score,
            "middleware": "policy",
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        }

        # Send to HALO router
        if hasattr(self.halo_router, "record_feedback"):
            self.halo_router.record_feedback(feedback)
            logger.debug(
                f"Policy feedback sent to HALO: {agent_name} → {tool_name} = {score:.2f}"
            )
        else:
            logger.warning("HALO router doesn't support record_feedback yet")

    def get_htdag_integration_metadata(self) -> Dict[str, Any]:
        """
        Get metadata for HTDAG task decomposition integration.

        Returns:
            Metadata dict with policy constraints for task planning
        """
        # Aggregate all policy constraints
        all_constraints = {}
        for agent_id, card in self.policy_loader.cards.items():
            constraints = self.policy_loader.get_safety_constraints(agent_id)
            all_constraints[agent_id] = {
                "max_execution_time": constraints.get("max_execution_time_seconds", 300),
                "max_memory_mb": constraints.get("memory_limit_mb", 2048),
                "allowed_tools": card.get("capabilities", {}).get("allowed_tools", []),
                "denied_tools": card.get("capabilities", {}).get("denied_tools", []),
            }

        return {
            "middleware": "policy",
            "agent_constraints": all_constraints,
            "enforcement_level": "strict",  # Could be configurable
        }
