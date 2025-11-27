"""
Capability Map Middleware

Validates Capability Maps before tool execution.
Ensures agents only use tools they have the capability for.

This middleware integrates with Pre-Tool Router for capability-based validation.

Author: Shane (Backend API Specialist)
Date: 2025-11-08
Version: 1.0.0
"""

import logging
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from infrastructure.middleware.base import (
    AgentMiddleware,
    ToolCall,
    ToolResult,
    CapabilityError,
    ValidationError,
)

# Orchestration layer imports
from infrastructure.halo_router import HALORouter
from infrastructure.task_dag import TaskDAG, Task
from infrastructure.aop_validator import AOPValidator

logger = logging.getLogger(__name__)


class CapabilityMapMiddleware(AgentMiddleware):
    """
    Enforce Capability Maps at middleware level.

    This middleware validates that agents have the required capabilities
    to execute requested tools. It checks:
    - Tool-to-capability mappings
    - Agent capability profiles
    - Argument schema validation
    - Capability usage tracking

    Usage:
        middleware = CapabilityMapMiddleware(maps_dir="maps/capabilities")
        # Middleware will be called automatically by HALO router
    """

    def __init__(
        self,
        maps_dir: str = "maps/capabilities",
        halo_router: Optional[HALORouter] = None,
        aop_validator: Optional[AOPValidator] = None,
    ):
        """
        Initialize CapabilityMapMiddleware.

        Args:
            maps_dir: Directory containing capability map JSON files
            halo_router: Optional HALORouter instance for agent routing integration
            aop_validator: Optional AOPValidator instance for orchestration validation
        """
        self.maps_dir = Path(maps_dir)
        self.tool_capabilities: Dict[str, str] = {}  # tool -> required_capability
        self.agent_capabilities: Dict[str, List[str]] = {}  # agent -> [capabilities]
        self.capability_usage: Dict[str, Dict[str, int]] = {}  # agent -> {capability -> count}

        # Orchestration integration
        self.halo_router = halo_router
        self.aop_validator = aop_validator

        self._load_capability_maps()

        # Auto-register with HALO router if available
        if self.halo_router:
            self._register_with_halo()

        logger.info(
            f"CapabilityMapMiddleware initialized with "
            f"{len(self.tool_capabilities)} tool mappings, "
            f"{len(self.agent_capabilities)} agent profiles "
            f"(HALO: {'enabled' if halo_router else 'disabled'}, "
            f"AOP: {'enabled' if aop_validator else 'disabled'})"
        )

    def _load_capability_maps(self) -> None:
        """
        Load capability maps from JSON files.

        Expected structure:
        - tool_capabilities.json: {"tool_name": "required_capability"}
        - agent_capabilities.json: {"agent_name": ["capability1", "capability2"]}
        """
        # Create default maps directory if it doesn't exist
        self.maps_dir.mkdir(parents=True, exist_ok=True)

        # Load tool capabilities
        tool_map_file = self.maps_dir / "tool_capabilities.json"
        if tool_map_file.exists():
            try:
                with open(tool_map_file, "r") as f:
                    self.tool_capabilities = json.load(f)
                logger.debug(f"Loaded {len(self.tool_capabilities)} tool capabilities")
            except Exception as e:
                logger.error(f"Failed to load tool capabilities: {e}")
        else:
            # Create default tool capabilities
            self.tool_capabilities = self._get_default_tool_capabilities()
            self._save_tool_capabilities()
            logger.info("Created default tool capabilities map")

        # Load agent capabilities
        agent_map_file = self.maps_dir / "agent_capabilities.json"
        if agent_map_file.exists():
            try:
                with open(agent_map_file, "r") as f:
                    self.agent_capabilities = json.load(f)
                logger.debug(f"Loaded {len(self.agent_capabilities)} agent capability profiles")
            except Exception as e:
                logger.error(f"Failed to load agent capabilities: {e}")
        else:
            # Create default agent capabilities
            self.agent_capabilities = self._get_default_agent_capabilities()
            self._save_agent_capabilities()
            logger.info("Created default agent capabilities map")

    def _get_default_tool_capabilities(self) -> Dict[str, str]:
        """
        Get default tool-to-capability mappings.

        Returns:
            Dict mapping tool names to required capabilities
        """
        return {
            # File operations
            "Read": "file_read",
            "Write": "file_write",
            "Edit": "file_edit",
            "Glob": "file_search",
            # Code execution
            "Bash": "code_execution",
            "NotebookEdit": "notebook_edit",
            # Testing
            "pytest": "test_execution",
            "unittest": "test_execution",
            # API operations
            "WebFetch": "web_access",
            "WebSearch": "web_search",
            # LLM operations
            "ChatCompletion": "llm_inference",
            "Embedding": "llm_embedding",
            # Database operations
            "DatabaseQuery": "database_read",
            "DatabaseWrite": "database_write",
            # Deployment
            "Deploy": "deployment",
            "DockerBuild": "container_management",
        }

    def _get_default_agent_capabilities(self) -> Dict[str, List[str]]:
        """
        Get default agent capability profiles.

        Returns:
            Dict mapping agent names to their capabilities
        """
        return {
            # Design & Planning
            "spec_agent": ["file_read", "file_write", "web_search"],
            "architect_agent": ["file_read", "file_write", "web_search"],
            # Implementation
            "builder_agent": [
                "file_read",
                "file_write",
                "file_edit",
                "code_execution",
                "test_execution",
            ],
            "frontend_agent": [
                "file_read",
                "file_write",
                "file_edit",
                "code_execution",
                "web_access",
            ],
            "backend_agent": [
                "file_read",
                "file_write",
                "file_edit",
                "code_execution",
                "database_read",
                "database_write",
            ],
            # Testing & QA
            "qa_agent": [
                "file_read",
                "test_execution",
                "code_execution",
                "web_access",
            ],
            "security_agent": [
                "file_read",
                "code_execution",
                "web_access",
                "database_read",
            ],
            # Infrastructure
            "deploy_agent": [
                "file_read",
                "code_execution",
                "deployment",
                "container_management",
            ],
            "monitoring_agent": ["file_read", "database_read", "web_access"],
            # Marketing & Sales
            "marketing_agent": ["file_read", "file_write", "web_search", "llm_inference"],
            "sales_agent": ["file_read", "web_search", "llm_inference"],
            # Support
            "support_agent": ["file_read", "web_search", "llm_inference", "database_read"],
            # Analytics
            "analytics_agent": ["file_read", "database_read", "web_access"],
            # Research
            "research_agent": ["file_read", "web_search", "web_access", "llm_inference"],
            # Finance
            "finance_agent": ["file_read", "database_read", "database_write"],
            # Evolution
            "darwin_agent": [
                "file_read",
                "file_write",
                "file_edit",
                "code_execution",
                "test_execution",
                "llm_inference",
            ],
        }

    def _save_tool_capabilities(self) -> None:
        """Save tool capabilities to JSON file."""
        try:
            with open(self.maps_dir / "tool_capabilities.json", "w") as f:
                json.dump(self.tool_capabilities, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save tool capabilities: {e}")

    def _save_agent_capabilities(self) -> None:
        """Save agent capabilities to JSON file."""
        try:
            with open(self.maps_dir / "agent_capabilities.json", "w") as f:
                json.dump(self.agent_capabilities, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save agent capabilities: {e}")

    async def on_tool_call(self, call: ToolCall) -> None:
        """
        Check capability map before tool execution.

        Validation steps:
        1. Get required capability for tool
        2. Check if agent has this capability
        3. Validate argument types match schema

        Args:
            call: Tool call request

        Raises:
            CapabilityError: If capability check fails
            ValidationError: If argument validation fails
        """
        agent_name = call.agent_name
        tool_name = call.tool_name

        # Step 1: Get required capability for this tool
        required_capability = self._get_tool_capability(tool_name)

        if not required_capability:
            # No capability requirement defined = allow (permissive default)
            logger.debug(f"No capability requirement for {tool_name}, allowing")
            return

        # Step 2: Check if agent has this capability
        agent_caps = self.agent_capabilities.get(agent_name, [])

        if required_capability not in agent_caps:
            raise CapabilityError(
                f"Agent '{agent_name}' lacks capability '{required_capability}' "
                f"required for tool '{tool_name}'. "
                f"Agent capabilities: {agent_caps}"
            )

        # Step 3: Validate argument schema (basic type checking)
        self._validate_argument_schema(call, required_capability)

        logger.debug(
            f"Capability check passed: {agent_name} has '{required_capability}' for {tool_name}"
        )

    async def on_tool_result(self, result: ToolResult) -> None:
        """
        Track capability usage statistics.

        Args:
            result: Tool execution result
        """
        agent_name = result.agent_name
        tool_name = result.tool_name

        # Get capability that was used
        capability = self._get_tool_capability(tool_name)
        if not capability:
            return

        # Track usage
        self._record_capability_usage(agent_name, capability, result.success)

        logger.debug(
            f"Capability usage tracked: {agent_name} used '{capability}' "
            f"(success={result.success})"
        )

    async def on_tool_error(self, call: ToolCall, error: Exception) -> None:
        """
        Log capability errors.

        Args:
            call: Original tool call
            error: Exception that occurred
        """
        capability = self._get_tool_capability(call.tool_name)

        logger.error(
            f"[CAPABILITY ERROR] {call.agent_name} → {call.tool_name} "
            f"(capability: {capability}): {type(error).__name__}: {error}"
        )

        # Track failed usage
        if capability:
            self._record_capability_usage(call.agent_name, capability, success=False)

    def _get_tool_capability(self, tool_name: str) -> Optional[str]:
        """
        Get required capability for tool.

        Args:
            tool_name: Tool name

        Returns:
            Required capability or None if not defined
        """
        # Direct lookup
        if tool_name in self.tool_capabilities:
            return self.tool_capabilities[tool_name]

        # Prefix matching (e.g., "Bash" matches "Bash(*)")
        for tool_pattern, capability in self.tool_capabilities.items():
            if tool_name.startswith(tool_pattern.split("(")[0]):
                return capability

        return None

    def _validate_argument_schema(self, call: ToolCall, capability: str) -> None:
        """
        Validate argument types match expected schema.

        This is a basic implementation. Production systems should use
        JSON Schema validation or similar.

        Args:
            call: Tool call request
            capability: Required capability

        Raises:
            ValidationError: If validation fails
        """
        args = call.arguments

        # Basic schema definitions per capability
        schemas = {
            "file_read": {"file_path": str},
            "file_write": {"file_path": str, "content": str},
            "file_edit": {"file_path": str, "old_string": str, "new_string": str},
            "code_execution": {"command": str},
            "web_access": {"url": str},
            "database_read": {"query": str},
        }

        schema = schemas.get(capability)
        if not schema:
            # No schema defined = skip validation
            return

        # Validate required fields
        for field, expected_type in schema.items():
            if field not in args:
                raise ValidationError(
                    f"Missing required argument '{field}' for capability '{capability}'"
                )

            if not isinstance(args[field], expected_type):
                raise ValidationError(
                    f"Invalid type for argument '{field}': "
                    f"expected {expected_type.__name__}, got {type(args[field]).__name__}"
                )

    def _record_capability_usage(
        self, agent_name: str, capability: str, success: bool
    ) -> None:
        """
        Record capability usage statistics.

        Args:
            agent_name: Agent name
            capability: Capability used
            success: Whether execution succeeded
        """
        if agent_name not in self.capability_usage:
            self.capability_usage[agent_name] = {}

        if capability not in self.capability_usage[agent_name]:
            self.capability_usage[agent_name][capability] = {
                "total": 0,
                "success": 0,
                "failure": 0,
            }

        self.capability_usage[agent_name][capability]["total"] += 1
        if success:
            self.capability_usage[agent_name][capability]["success"] += 1
        else:
            self.capability_usage[agent_name][capability]["failure"] += 1

    def add_tool_capability(self, tool_name: str, capability: str) -> None:
        """
        Add or update tool capability mapping.

        Args:
            tool_name: Tool name
            capability: Required capability
        """
        self.tool_capabilities[tool_name] = capability
        self._save_tool_capabilities()
        logger.info(f"Added tool capability: {tool_name} → {capability}")

    def add_agent_capability(self, agent_name: str, capability: str) -> None:
        """
        Add capability to agent profile.

        Args:
            agent_name: Agent name
            capability: Capability to add
        """
        if agent_name not in self.agent_capabilities:
            self.agent_capabilities[agent_name] = []

        if capability not in self.agent_capabilities[agent_name]:
            self.agent_capabilities[agent_name].append(capability)
            self._save_agent_capabilities()
            logger.info(f"Added capability '{capability}' to agent '{agent_name}'")

    def remove_agent_capability(self, agent_name: str, capability: str) -> None:
        """
        Remove capability from agent profile.

        Args:
            agent_name: Agent name
            capability: Capability to remove
        """
        if agent_name in self.agent_capabilities:
            if capability in self.agent_capabilities[agent_name]:
                self.agent_capabilities[agent_name].remove(capability)
                self._save_agent_capabilities()
                logger.info(f"Removed capability '{capability}' from agent '{agent_name}'")

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get capability usage statistics.

        Returns:
            Statistics dict with usage counts per agent/capability
        """
        total_usage = sum(
            caps["total"]
            for agent_stats in self.capability_usage.values()
            for caps in agent_stats.values()
            if isinstance(caps, dict)
        )

        return {
            "total_agents": len(self.capability_usage),
            "total_usage": total_usage,
            "agent_usage": self.capability_usage,
        }

    def reset_statistics(self) -> None:
        """Reset usage statistics."""
        self.capability_usage.clear()
        logger.info("Capability usage statistics reset")

    # =========================================================================
    # ORCHESTRATION INTEGRATION METHODS
    # =========================================================================

    def _register_with_halo(self) -> None:
        """
        Auto-register capability middleware with HALO router.

        This enables HALO to use capability maps during agent routing.
        """
        if not hasattr(self.halo_router, "middleware_registry"):
            logger.warning(
                "HALO router doesn't support middleware_registry. "
                "Capability validation will be manual."
            )
            return

        # Register this middleware instance
        self.halo_router.middleware_registry.setdefault("capability", []).append(self)
        logger.info("CapabilityMapMiddleware registered with HALO router")

    def validate_with_aop(self, task: Task, agent_name: str) -> Dict[str, Any]:
        """
        Validate task assignment with AOP principles using capability maps.

        Checks:
        - Solvability: Agent has capabilities for required tools
        - Completeness: All task tools are mapped to capabilities
        - Non-redundancy: No duplicate capability checks

        Args:
            task: Task to validate
            agent_name: Agent assigned to task

        Returns:
            Validation result dict with {valid: bool, reason: str, score: float}
        """
        if not self.aop_validator:
            return {"valid": True, "reason": "No AOP validator configured", "score": 1.0}

        # Get task's required tools
        task_tools = getattr(task, "required_tools", [])
        if not task_tools:
            return {"valid": True, "reason": "No tools required", "score": 1.0}

        # Check agent capabilities
        agent_caps = self.agent_capabilities.get(agent_name, [])
        if not agent_caps:
            return {
                "valid": False,
                "reason": f"Agent {agent_name} has no capability profile",
                "score": 0.0,
            }

        # Validate each tool
        missing_capabilities = []
        for tool in task_tools:
            required_cap = self._get_tool_capability(tool)
            if required_cap and required_cap not in agent_caps:
                missing_capabilities.append(f"{tool} → {required_cap}")

        if missing_capabilities:
            return {
                "valid": False,
                "reason": f"Missing capabilities: {', '.join(missing_capabilities)}",
                "score": 0.0,
            }

        # Calculate score based on capability coverage
        score = len(agent_caps) / max(len(task_tools), 1)  # Higher is better
        return {
            "valid": True,
            "reason": f"Agent {agent_name} has all required capabilities",
            "score": min(1.0, score),
        }

    def provide_routing_feedback(
        self, agent_name: str, tool_name: str, success: bool, capability: str
    ) -> None:
        """
        Provide capability-based feedback to HALO router.

        Args:
            agent_name: Agent that used the capability
            tool_name: Tool that was executed
            success: Whether execution succeeded
            capability: Capability that was used
        """
        if not self.halo_router:
            return

        feedback = {
            "agent": agent_name,
            "tool": tool_name,
            "capability": capability,
            "success": success,
            "middleware": "capability",
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        }

        if hasattr(self.halo_router, "record_feedback"):
            self.halo_router.record_feedback(feedback)
            logger.debug(
                f"Capability feedback sent to HALO: {agent_name} used {capability} "
                f"(success={success})"
            )
        else:
            logger.warning("HALO router doesn't support record_feedback yet")

    def get_htdag_integration_metadata(self) -> Dict[str, Any]:
        """
        Get metadata for HTDAG task decomposition integration.

        Returns:
            Metadata dict with capability mappings for task planning
        """
        return {
            "middleware": "capability",
            "tool_capabilities": self.tool_capabilities,
            "agent_capabilities": self.agent_capabilities,
            "total_agents": len(self.agent_capabilities),
            "total_tools": len(self.tool_capabilities),
        }

    def suggest_agent_for_task(self, task: Task) -> Optional[str]:
        """
        Suggest best agent for task based on capability matching.

        This can be used by HALO router for intelligent agent selection.

        Args:
            task: Task to find agent for

        Returns:
            Agent name or None if no suitable agent
        """
        task_tools = getattr(task, "required_tools", [])
        if not task_tools:
            return None

        # Find agents that have all required capabilities
        required_caps = set()
        for tool in task_tools:
            cap = self._get_tool_capability(tool)
            if cap:
                required_caps.add(cap)

        # Score each agent
        agent_scores = {}
        for agent_name, agent_caps in self.agent_capabilities.items():
            agent_cap_set = set(agent_caps)
            if required_caps.issubset(agent_cap_set):
                # Agent has all required capabilities
                # Score: higher if agent has fewer extra capabilities (more specialized)
                extra_caps = len(agent_cap_set - required_caps)
                agent_scores[agent_name] = 1.0 / (1.0 + extra_caps)

        if not agent_scores:
            return None

        # Return agent with highest score (most specialized)
        best_agent = max(agent_scores.items(), key=lambda x: x[1])[0]
        logger.info(
            f"Capability-based suggestion: {best_agent} for task with tools {task_tools}"
        )
        return best_agent
