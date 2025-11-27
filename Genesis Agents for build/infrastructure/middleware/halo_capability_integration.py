"""
HALO Router + Capability Maps Integration

Extends HALORouter with capability-based routing and pre-tool validation.
This module acts as a wrapper around existing HALO functionality.
"""

import logging
from typing import Dict, List, Optional, Any

from infrastructure.halo_router import HALORouter, RoutingPlan
from infrastructure.task_dag import Task, TaskDAG
from infrastructure.middleware.pre_tool_router import PreToolRouter, ToolRoutingDecision
from infrastructure.middleware.dependency_resolver import DependencyResolver, DependencyResolutionResult

logger = logging.getLogger(__name__)


class HALOCapabilityBridge:
    """
    Bridge between HALO router and capability middleware

    Responsibilities:
    1. Extend HALO routing with capability-based tool selection
    2. Integrate dependency resolution with task DAG
    3. Validate tool calls before execution
    4. Provide capability-aware routing explanations
    """

    def __init__(
        self,
        halo_router: Optional[HALORouter] = None,
        capabilities_dir: str = "maps/capabilities",
    ):
        """
        Initialize HALO Capability Bridge

        Args:
            halo_router: Existing HALORouter instance (creates new if None)
            capabilities_dir: Directory with capability maps
        """
        self.halo = halo_router or HALORouter()
        self.tool_router = PreToolRouter(capabilities_dir=capabilities_dir)
        self.dep_resolver = DependencyResolver(capabilities_dir=capabilities_dir)

    def route_dag_with_capabilities(
        self,
        dag: TaskDAG,
        execution_context: Dict[str, Any],
    ) -> RoutingPlan:
        """
        Route a task DAG with capability-aware routing

        Args:
            dag: Task DAG to route
            execution_context: Execution context (resources, state, etc)

        Returns:
            RoutingPlan with agent assignments
        """
        logger.info(f"Routing DAG with {len(dag.nodes)} tasks using capability maps")

        # Step 1: Resolve dependencies
        tasks_dict = {node.task_id: self._task_to_dict(node) for node in dag.nodes}
        dep_result = self.dep_resolver.resolve(tasks_dict)

        if not dep_result.is_valid:
            logger.error(f"Dependency resolution failed: {dep_result.errors}")
            # Fall back to standard HALO routing
            return self.halo.route_dag(dag)

        logger.info(f"Dependencies resolved: order={len(dep_result.execution_order)}, critical_path_len={len(dep_result.critical_path)}")

        # Step 2: Route using HALO
        base_routing = self.halo.route_dag(dag)

        # Step 3: Validate each tool call with capability checks
        enhanced_assignments = {}
        validation_failures = []

        for task_id, agent_name in base_routing.assignments.items():
            task = next((n for n in dag.nodes if n.task_id == task_id), None)
            if not task:
                continue

            # Validate tool call for this task
            validation = self._validate_task_tools(
                task,
                agent_name,
                execution_context,
            )

            if not validation["valid"]:
                logger.warning(
                    f"Task {task_id} validation failed for agent {agent_name}: "
                    f"{validation['reason']}"
                )

                # Try to find fallback agent
                fallback = self._find_fallback_agent(task, agent_name, execution_context)
                if fallback:
                    logger.info(f"Using fallback agent {fallback} for task {task_id}")
                    enhanced_assignments[task_id] = fallback
                    base_routing.explanations[task_id] = f"Fallback due to: {validation['reason']}"
                else:
                    validation_failures.append(task_id)

            else:
                enhanced_assignments[task_id] = agent_name

        # Update routing with capability-aware assignments
        base_routing.assignments = enhanced_assignments

        # Step 4: Add capability metadata
        base_routing.metadata["dep_resolution"] = {
            "execution_order": dep_result.execution_order,
            "critical_path": dep_result.critical_path,
            "task_levels": dep_result.task_levels,
            "blocked_tasks": dep_result.blocked_tasks,
        }

        base_routing.metadata["validation_failures"] = validation_failures

        logger.info(
            f"Routing complete: {len(enhanced_assignments)} tasks assigned, "
            f"{len(validation_failures)} failures"
        )

        return base_routing

    def validate_tool_before_execution(
        self,
        agent_id: str,
        task_type: str,
        tool_name: str,
        tool_args: Dict[str, Any],
        execution_context: Dict[str, Any],
    ) -> ToolRoutingDecision:
        """
        Validate tool call before execution

        Args:
            agent_id: ID of agent making call
            task_type: Type of task
            tool_name: Name of tool
            tool_args: Arguments for tool
            execution_context: Current execution context

        Returns:
            ToolRoutingDecision with validation result
        """
        decision = self.tool_router.route_tool_call(
            agent_id=agent_id,
            task_type=task_type,
            tool_name=tool_name,
            args=tool_args,
            context=execution_context,
        )

        if not decision.is_allowed():
            logger.warning(
                f"Tool call denied: agent={agent_id}, tool={tool_name}, "
                f"reason={decision.reason}"
            )
        else:
            logger.debug(
                f"Tool call allowed: agent={agent_id}, tool={tool_name}, "
                f"score={decision.score:.2f}"
            )

        return decision

    def _validate_task_tools(
        self,
        task: Task,
        agent_name: str,
        execution_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate all tools required for a task

        Returns:
            {"valid": bool, "reason": str}
        """
        required_tools = getattr(task, "required_tools", [])

        if not required_tools:
            # No specific tools required
            return {"valid": True, "reason": ""}

        for tool_name in required_tools:
            decision = self.tool_router.route_tool_call(
                agent_id=agent_name,
                task_type=task.task_type if hasattr(task, "task_type") else "unknown",
                tool_name=tool_name,
                args={},
                context=execution_context,
            )

            if not decision.is_allowed():
                return {
                    "valid": False,
                    "reason": f"Tool {tool_name} not available: {decision.reason}",
                }

        return {"valid": True, "reason": ""}

    def _find_fallback_agent(
        self,
        task: Task,
        current_agent: str,
        execution_context: Dict[str, Any],
    ) -> Optional[str]:
        """
        Find a fallback agent for a task

        Returns:
            Agent name or None
        """
        # Get current agent's fallback agents
        current_agent_data = self.tool_router.agent_capabilities.get(current_agent, {})
        fallback_agents = current_agent_data.get("fallback_agents", [])

        # Try each fallback agent
        for fallback in fallback_agents:
            validation = self._validate_task_tools(task, fallback, execution_context)
            if validation["valid"]:
                return fallback

        # Default fallback
        return self._get_default_fallback_agent()

    def _get_default_fallback_agent(self) -> Optional[str]:
        """Get default fallback agent (orchestration or support)"""
        if "orchestration_agent" in self.halo.agent_registry:
            return "orchestration_agent"
        if "support_agent" in self.halo.agent_registry:
            return "support_agent"
        # Last resort: any available agent
        return next(iter(self.halo.agent_registry.keys())) if self.halo.agent_registry else None

    def _task_to_dict(self, task: Task) -> Dict[str, Any]:
        """Convert Task object to dictionary for dependency resolver"""
        return {
            "task_id": task.task_id,
            "task_type": getattr(task, "task_type", "unknown"),
            "agent_id": getattr(task, "agent_id", None),
            "dependencies": getattr(task, "dependencies", {}),
            "priority": getattr(task, "priority", "medium"),
        }

    def get_routing_explanation(self, routing_plan: RoutingPlan) -> str:
        """Generate human-readable routing explanation"""
        explanation = "HALO Capability-Aware Routing Plan\n"
        explanation += "=" * 50 + "\n\n"

        for task_id, agent_name in routing_plan.assignments.items():
            explanation += f"Task: {task_id}\n"
            explanation += f"  Agent: {agent_name}\n"

            if task_id in routing_plan.explanations:
                explanation += f"  Reason: {routing_plan.explanations[task_id]}\n"

            if "dep_resolution" in routing_plan.metadata:
                dep_meta = routing_plan.metadata["dep_resolution"]
                if task_id in dep_meta.get("blocked_tasks", {}):
                    blocked = dep_meta["blocked_tasks"][task_id]
                    explanation += f"  Blocked by: {blocked}\n"

            explanation += "\n"

        if routing_plan.metadata.get("validation_failures"):
            explanation += f"\nValidation Failures: {routing_plan.metadata['validation_failures']}\n"

        return explanation

    def get_execution_plan(self, routing_plan: RoutingPlan) -> str:
        """Generate execution plan with dependencies"""
        if "dep_resolution" not in routing_plan.metadata:
            return "No dependency metadata available"

        dep_meta = routing_plan.metadata["dep_resolution"]
        execution_order = dep_meta.get("execution_order", [])
        critical_path = dep_meta.get("critical_path", [])
        task_levels = dep_meta.get("task_levels", {})

        plan = "Execution Plan\n"
        plan += "=" * 50 + "\n\n"

        plan += "Execution Order:\n"
        for i, task in enumerate(execution_order, 1):
            level = task_levels.get(task, 0)
            plan += f"  {i}. {task} (level {level})\n"

        plan += f"\nCritical Path ({len(critical_path)} tasks):\n"
        for task in critical_path:
            plan += f"  → {task}\n"

        return plan

    def execute_with_llm(
        self,
        agent_name: str,
        prompt: str,
        fallback_to_cloud: bool = True,
        prefer_local: bool = False,
        **kwargs
    ) -> Optional[str]:
        """
        Execute task using best available LLM with cost optimization

        Delegates to underlying HALORouter instance

        Args:
            agent_name: Agent to execute task (qa_agent, support_agent, etc.)
            prompt: Task prompt/description
            fallback_to_cloud: Allow fallback to cloud LLMs if local fails
            prefer_local: Prefer local LLM for cost savings
            **kwargs: Additional arguments for model inference

        Returns:
            Generated response string or None if failed
        """
        return self.halo.execute_with_llm(
            agent_name=agent_name,
            prompt=prompt,
            fallback_to_cloud=fallback_to_cloud,
            prefer_local=prefer_local,
            **kwargs
        )

    @property
    def use_vertex_ai(self) -> bool:
        """Check if Vertex AI is enabled"""
        return getattr(self.halo, 'use_vertex_ai', False)

    @property
    def vertex_router(self):
        """Get Vertex AI router if available"""
        return getattr(self.halo, 'vertex_router', None)

    @property
    def agent_registry(self) -> Dict[str, Any]:
        """Get agent registry from underlying HALO router"""
        return self.halo.agent_registry
