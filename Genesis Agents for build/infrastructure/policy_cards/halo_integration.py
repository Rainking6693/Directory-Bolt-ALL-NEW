"""
HALO Router - Policy Card Integration

Integrates policy enforcement into HALO routing decisions.
Checks tool permissions and constraints before assigning agents to tasks.

Paper: https://arxiv.org/abs/2510.24383 (Policy Cards)
       https://arxiv.org/abs/2505.13516 (HALO)
"""

import logging
from typing import Dict, Optional, Any, List, Tuple
from .middleware import PolicyEnforcer

logger = logging.getLogger(__name__)


class PolicyAwareHALORouter:
    """
    HALO Router with Policy Card enforcement.

    Wraps existing HALO router and adds policy checks before routing.
    """

    def __init__(self, halo_router: Any, policy_enforcer: Optional[PolicyEnforcer] = None):
        """
        Initialize policy-aware router.

        Args:
            halo_router: Existing HALORouter instance
            policy_enforcer: Optional PolicyEnforcer (creates new if not provided)
        """
        self.halo_router = halo_router
        self.policy_enforcer = policy_enforcer or PolicyEnforcer()

        # Expose HALO router attributes for compatibility
        self.use_vertex_ai = getattr(self.halo_router, 'use_vertex_ai', False)
        self.vertex_router = getattr(self.halo_router, 'vertex_router', None)

    def route_task_with_policy_check(
        self, task: Any, excluded_agents: Optional[List[str]] = None
    ) -> Tuple[Optional[str], str, Dict[str, Any]]:
        """
        Route task to agent, checking policies first.

        Args:
            task: Task to route
            excluded_agents: List of agents to exclude from routing

        Returns:
            (agent_id: Optional[str], explanation: str, metadata: dict)
            where metadata contains policy check results
        """
        # Get initial routing from HALO
        initial_agent, initial_explanation, initial_metadata = self._get_halo_routing(
            task, excluded_agents
        )

        if not initial_agent:
            return (
                None,
                "No agent available (HALO routing failed)",
                {"policy_checked": False},
            )

        # Check policy for agent + task tools
        policy_result, policy_passed = self._check_agent_policy(
            initial_agent, task
        )

        if policy_passed:
            # All checks passed
            metadata = {
                "policy_checked": True,
                "policy_result": policy_result,
                "policy_passed": True,
                "halo_recommendation": initial_agent,
                "halo_explanation": initial_explanation,
            }
            return initial_agent, "Policy checks passed", metadata

        # Policy failed - find fallback agent
        logger.warning(
            f"Policy check failed for {initial_agent}: {policy_result['reason']}"
        )

        fallback_agent, fallback_explanation = self._find_policy_compliant_agent(
            task, excluded_agents or []
        )

        if fallback_agent:
            metadata = {
                "policy_checked": True,
                "policy_result": policy_result,
                "policy_passed": False,
                "halo_recommendation": initial_agent,
                "halo_explanation": initial_explanation,
                "fallback_used": True,
                "fallback_agent": fallback_agent,
                "fallback_explanation": fallback_explanation,
            }
            return (
                fallback_agent,
                f"HALO agent failed policy check. Using fallback: {fallback_explanation}",
                metadata,
            )

        # No fallback available
        metadata = {
            "policy_checked": True,
            "policy_result": policy_result,
            "policy_passed": False,
            "halo_recommendation": initial_agent,
            "halo_explanation": initial_explanation,
            "fallback_used": False,
            "error": "No policy-compliant agent available",
        }
        return None, "No policy-compliant agent available", metadata

    def validate_agent_capabilities(
        self, agent_id: str, required_tools: List[str]
    ) -> Tuple[bool, List[str], Dict[str, str]]:
        """
        Validate agent can use required tools per policy.

        Args:
            agent_id: Agent to validate
            required_tools: Tools the task requires

        Returns:
            (valid: bool, denied_tools: List[str], denials: Dict[tool -> reason])
        """
        denied_tools = []
        denials = {}

        for tool in required_tools:
            # Check tool permission
            if not self.policy_enforcer.loader.is_tool_allowed(agent_id, tool):
                denied_tools.append(tool)
                denials[tool] = f"Tool {tool} denied by policy"

        valid = len(denied_tools) == 0
        return valid, denied_tools, denials

    def get_agent_policy_profile(self, agent_id: str) -> Dict[str, Any]:
        """
        Get agent's policy profile.

        Args:
            agent_id: Agent to profile

        Returns:
            Policy profile dict
        """
        card = self.policy_enforcer.loader.get_card(agent_id)
        if not card:
            return {"agent_id": agent_id, "policy_card": None, "has_restrictions": False}

        capabilities = card.get("capabilities", {})
        safety = card.get("safety_constraints", {})
        compliance = card.get("compliance", {})

        return {
            "agent_id": agent_id,
            "policy_card": card,
            "allowed_tools": capabilities.get("allowed_tools", []),
            "denied_tools": capabilities.get("denied_tools", []),
            "safety_constraints": safety,
            "compliance_requirements": compliance,
            "has_restrictions": (
                len(capabilities.get("denied_tools", [])) > 0
                or len(capabilities.get("allowed_tools", [])) > 0
            ),
        }

    def _get_halo_routing(
        self, task: Any, excluded_agents: Optional[List[str]] = None
    ) -> Tuple[Optional[str], str, Dict[str, Any]]:
        """
        Get routing decision from wrapped HALO router.

        Args:
            task: Task to route
            excluded_agents: Agents to exclude

        Returns:
            (agent_id, explanation, metadata)
        """
        try:
            # Call HALO router's route_task method
            if hasattr(self.halo_router, "route_task"):
                agent, explanation = self.halo_router.route_task(
                    task, excluded_agents
                )
                return agent, explanation, {}
            elif hasattr(self.halo_router, "select_best_agent"):
                agent = self.halo_router.select_best_agent(task, excluded_agents)
                return agent, "Selected by HALO", {}
            else:
                logger.error("HALO router has no routing methods")
                return None, "HALO router error", {}
        except Exception as e:
            logger.error(f"HALO routing failed: {e}")
            return None, str(e), {}

    def _check_agent_policy(
        self, agent_id: str, task: Any
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Check if agent can handle task per policy.

        Args:
            agent_id: Agent to check
            task: Task to perform

        Returns:
            (policy_result: dict, passed: bool)
        """
        # Extract required tools from task
        required_tools = self._extract_task_tools(task)

        if not required_tools:
            # No specific tools required - assume pass
            return {"tools_checked": [], "passed": True}, True

        # Check each tool
        all_allowed = True
        denied_tools = []

        for tool in required_tools:
            if not self.policy_enforcer.loader.is_tool_allowed(agent_id, tool):
                all_allowed = False
                denied_tools.append(tool)

        policy_result = {
            "agent_id": agent_id,
            "tools_checked": required_tools,
            "denied_tools": denied_tools,
            "passed": all_allowed,
            "reason": f"Policy check {'passed' if all_allowed else f'failed: {denied_tools} tools denied'}",
        }

        return policy_result, all_allowed

    def _find_policy_compliant_agent(
        self, task: Any, excluded_agents: List[str]
    ) -> Tuple[Optional[str], str]:
        """
        Find an agent that can handle task within policy constraints.

        Args:
            task: Task to perform
            excluded_agents: Agents to exclude from search

        Returns:
            (agent_id: Optional[str], explanation: str)
        """
        required_tools = self._extract_task_tools(task)
        if not required_tools:
            return None, "No tools identified in task"

        # Get all agents
        all_agents = self.policy_enforcer.loader.list_agents()

        # Try each agent in order
        for agent_id in all_agents:
            if agent_id in excluded_agents:
                continue

            # Check if all tools are allowed
            all_allowed = all(
                self.policy_enforcer.loader.is_tool_allowed(agent_id, tool)
                for tool in required_tools
            )

            if all_allowed:
                return agent_id, f"Agent {agent_id} can handle required tools"

        return None, f"No agent can handle tools: {required_tools}"

    def _extract_task_tools(self, task: Any) -> List[str]:
        """
        Extract required tools from task.

        Args:
            task: Task object

        Returns:
            List of tool names
        """
        tools = []

        # Try different task attributes
        if hasattr(task, "required_tools"):
            tools = task.required_tools
        elif hasattr(task, "tools"):
            tools = task.tools
        elif isinstance(task, dict):
            tools = task.get("required_tools", task.get("tools", []))

        # Ensure list
        if isinstance(tools, str):
            tools = [tools]

        return tools if tools else []

    def get_routing_statistics(self) -> Dict[str, Any]:
        """
        Get routing statistics including policy checks.

        Returns:
            Statistics dict
        """
        return {
            "policy_enforcer_stats": self.policy_enforcer.get_all_stats(),
            "agents_with_policies": self.policy_enforcer.loader.list_agents(),
            "call_history_length": len(self.policy_enforcer.call_history),
        }

    # Passthrough methods to underlying HALO router
    def execute_with_llm(
        self,
        agent_name: str,
        prompt: str,
        fallback_to_local: bool = True,
        **kwargs
    ) -> Optional[str]:
        """
        Passthrough to HALORouter.execute_with_llm()

        Execute task using best available LLM (Vertex AI or local)

        Args:
            agent_name: Agent to execute task
            prompt: Task prompt/description
            fallback_to_local: Allow fallback to local LLM if Vertex fails
            **kwargs: Additional arguments for model inference

        Returns:
            Generated response string or None if failed
        """
        return self.halo_router.execute_with_llm(
            agent_name=agent_name,
            prompt=prompt,
            fallback_to_local=fallback_to_local,
            **kwargs
        )
