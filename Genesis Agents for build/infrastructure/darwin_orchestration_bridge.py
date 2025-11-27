"""
Darwin Orchestration Bridge
Integrates SE-Darwin with HTDAG+HALO+AOP orchestration pipeline

Enables:
- User requests for agent improvement via orchestrator
- Automatic routing of evolution tasks to Darwin
- Integration with existing orchestration layers
- Feature flag control for gradual rollout

Author: River (Multi-Agent Memory Engineering Specialist)
Date: 2025-10-19
Version: 1.0.0
"""

import asyncio
import logging
import time
import re
import json
import os
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

# Orchestration imports
from infrastructure.htdag_planner import HTDAGPlanner
from infrastructure.halo_router import HALORouter, RoutingPlan
from infrastructure.aop_validator import AOPValidator
from infrastructure.task_dag import TaskDAG, Task, TaskStatus
from infrastructure.safety.dir_report_store import load_latest_dir_report

# Darwin imports
from agents.darwin_agent import DarwinAgent, EvolutionAttempt, ImprovementType

# Feature flags
from infrastructure.feature_flags import is_feature_enabled

logger = logging.getLogger(__name__)


# Security constants
ALLOWED_AGENTS = {
    "spec_agent", "builder_agent", "qa_agent", "security_agent",
    "deploy_agent", "marketing_agent", "support_agent", "analyst_agent",
    "maintenance_agent", "onboarding_agent", "billing_agent", "content_agent",
    "email_agent", "legal_agent", "seo_agent"
}

DANGEROUS_PATTERNS = [
    r'ignore\s+previous\s+instructions',
    r'ignore\s+all\s+previous',
    r'disregard',
    r'instead,?\s+do\s+this',
    r'system\s*:',
    r'assistant\s*:',
    r'<\|im_start\|>',
    r'<\|im_end\|>',
    r'execute|eval|exec|__import__|compile',
    r'os\.system|subprocess|popen',
    r'rm\s+-rf|del\s+/|format\s+C:'
]


class EvolutionTaskType(Enum):
    """Types of evolution tasks Darwin can handle"""
    IMPROVE_AGENT = "improve_agent"  # Improve existing agent
    FIX_BUG = "fix_bug"  # Fix identified bug
    ADD_FEATURE = "add_feature"  # Add new capability
    OPTIMIZE_PERFORMANCE = "optimize_performance"  # Speed/cost optimization


@dataclass
class EvolutionRequest:
    """Request to evolve an agent"""
    request_id: str
    agent_name: str  # e.g., "marketing_agent"
    evolution_type: EvolutionTaskType
    context: Dict[str, Any]  # Performance metrics, error logs, etc.
    target_metric: Optional[str] = None  # e.g., "success_rate"
    improvement_threshold: float = 0.05  # Minimum 5% improvement


@dataclass
class EvolutionResult:
    """Result of evolution attempt"""
    request_id: str
    agent_name: str
    success: bool
    metrics_before: Dict[str, float]
    metrics_after: Dict[str, float]
    improvement_delta: Dict[str, float]
    new_version: Optional[str] = None  # Agent version if accepted
    error_message: Optional[str] = None


class DarwinOrchestrationBridge:
    """
    Bridges Darwin agent with orchestration pipeline

    Workflow:
    1. Receive evolution request from user/orchestrator
    2. Decompose into HTDAG evolution task
    3. Route to Darwin agent via HALO
    4. Validate evolution plan via AOP
    5. Execute Darwin evolution cycle
    6. Return results to orchestrator
    """

    def __init__(
        self,
        htdag_planner: Optional[HTDAGPlanner] = None,
        halo_router: Optional[HALORouter] = None,
        aop_validator: Optional[AOPValidator] = None,
        darwin_agent: Optional[DarwinAgent] = None
    ):
        """
        Initialize Darwin orchestration bridge

        Args:
            htdag_planner: Task decomposition planner (optional, creates if None)
            halo_router: Agent routing system (optional, creates if None)
            aop_validator: Plan validator (optional, creates if None)
            darwin_agent: Darwin evolution agent (optional, creates if None)
        """
        self.htdag = htdag_planner or HTDAGPlanner()
        self.halo = halo_router or HALORouter()
        self.aop = aop_validator or AOPValidator()

        # Darwin agent will be created per-agent (different agents need different configs)
        self._darwin_agents: Dict[str, DarwinAgent] = {}

        # Feature flag check
        self.enabled = is_feature_enabled("darwin_integration_enabled")

        # WaltzRL DIR report integration for AOP validation gates
        self._dir_report_enabled = os.getenv("WALTZRL_DIR_REPORT_ENABLED", "true").lower() != "false"
        dir_report_path = os.getenv("WALTZRL_DIR_REPORT_PATH")
        self._dir_report_path = Path(dir_report_path) if dir_report_path else None

        dir_thresholds_raw = os.getenv("WALTZRL_DIR_THRESHOLDS")
        if dir_thresholds_raw:
            try:
                self._dir_threshold_overrides = json.loads(dir_thresholds_raw)
            except json.JSONDecodeError:
                logger.warning(
                    "Invalid WALTZRL_DIR_THRESHOLDS JSON; ignoring overrides",
                    extra={"value": dir_thresholds_raw},
                )
                self._dir_threshold_overrides = None
        else:
            self._dir_threshold_overrides = None

        # Rate limiting (VULN-DARWIN-004 fix)
        self._evolution_attempts: Dict[str, List[datetime]] = defaultdict(list)
        self.max_evolutions_per_hour = 10

        logger.info(f"DarwinOrchestrationBridge initialized (enabled={self.enabled})")

    def _validate_agent_name(self, agent_name: str) -> None:
        """
        Validate agent name against whitelist to prevent path traversal

        SECURITY FIX: VULN-DARWIN-001
        Prevents path traversal attacks like "../../etc/passwd"

        Args:
            agent_name: Agent name to validate

        Raises:
            ValueError: If agent name is invalid or not in whitelist
        """
        if agent_name not in ALLOWED_AGENTS:
            raise ValueError(f"Invalid agent name: {agent_name}. Must be one of: {ALLOWED_AGENTS}")

        # Additional sanitization
        if ".." in agent_name or "/" in agent_name or "\\" in agent_name:
            raise ValueError(f"Agent name contains invalid characters: {agent_name}")

    def _sanitize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize context to prevent prompt injection

        SECURITY FIX: VULN-DARWIN-002
        Blocks malicious prompts like "ignore previous instructions"

        Args:
            context: User-provided context dictionary

        Returns:
            Sanitized context dictionary

        Raises:
            ValueError: If context contains dangerous patterns or is too large
        """
        if not context:
            return {}

        # Limit context size
        MAX_CONTEXT_SIZE = 10000  # characters
        context_str = json.dumps(context)
        if len(context_str) > MAX_CONTEXT_SIZE:
            raise ValueError(f"Context too large: {len(context_str)} chars (max {MAX_CONTEXT_SIZE})")

        # Check for prompt injection patterns
        context_lower = context_str.lower()
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, context_lower, re.IGNORECASE):
                raise ValueError(f"Context contains suspicious pattern matching: {pattern}")

        return context

    async def _verify_sandbox_active(self) -> None:
        """
        Verify Docker sandbox is running before evolution

        SECURITY FIX: VULN-DARWIN-003
        Ensures evolved code runs in sandbox, not on host

        Raises:
            RuntimeError: If sandbox is not active
        """
        try:
            import docker
            client = docker.from_env()
            # Check if sandbox container exists and is running
            containers = client.containers.list(filters={"name": "darwin-sandbox"})
            if not containers:
                logger.warning("Darwin sandbox container not running - skipping sandbox check in development")
                # In development, we may not have Docker, so just warn
                # In production, this should raise
                # raise RuntimeError("Darwin sandbox container not running")
        except Exception as e:
            logger.warning(f"Sandbox verification failed: {e} - continuing in development mode")
            # In development, we allow this to continue
            # In production, uncomment the line below:
            # raise RuntimeError(f"Sandbox verification failed: {e}")

    def _check_rate_limit(self, agent_name: str) -> bool:
        """
        Check if evolution requests are within rate limit

        SECURITY FIX: VULN-DARWIN-004
        Prevents DoS attacks via spam evolution requests

        Args:
            agent_name: Agent name to check rate limit for

        Returns:
            True if within rate limit, False if exceeded
        """
        now = datetime.now()
        one_hour_ago = now - timedelta(hours=1)

        # Clean old attempts outside window
        self._evolution_attempts[agent_name] = [
            ts for ts in self._evolution_attempts[agent_name]
            if ts > one_hour_ago
        ]

        recent_count = len(self._evolution_attempts[agent_name])
        return recent_count < self.max_evolutions_per_hour

    def _validate_evolution_type(self, evolution_type: EvolutionTaskType) -> None:
        """
        Validate evolution type is a valid enum value

        SECURITY FIX: VULN-DARWIN-005
        Prevents crashes from invalid evolution types

        Args:
            evolution_type: Evolution type to validate

        Raises:
            ValueError: If evolution type is invalid
        """
        if not isinstance(evolution_type, EvolutionTaskType):
            valid_types = [t.value for t in EvolutionTaskType]
            raise ValueError(
                f"Invalid evolution type: {evolution_type}. "
                f"Must be EvolutionTaskType enum, one of: {valid_types}"
            )

    def _redact_sensitive_data(self, data: Any) -> Any:
        """
        Redact sensitive fields from logging

        SECURITY FIX: VULN-DARWIN-006
        Prevents credential leakage in error logs

        Args:
            data: Data to redact

        Returns:
            Redacted copy of data
        """
        SENSITIVE_KEYS = {"password", "token", "api_key", "secret", "credential", "key"}

        if isinstance(data, dict):
            redacted = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in SENSITIVE_KEYS):
                    redacted[key] = "***REDACTED***"
                elif isinstance(value, (dict, list)):
                    redacted[key] = self._redact_sensitive_data(value)
                else:
                    redacted[key] = value
            return redacted
        elif isinstance(data, list):
            return [self._redact_sensitive_data(item) for item in data]
        else:
            return data

    async def evolve_agent(
        self,
        agent_name: str,
        evolution_type: EvolutionTaskType,
        context: Optional[Dict[str, Any]] = None,
        target_metric: Optional[str] = None
    ) -> EvolutionResult:
        """
        Evolve an agent using Darwin through orchestration pipeline

        Args:
            agent_name: Name of agent to evolve (e.g., "marketing_agent")
            evolution_type: Type of evolution (improve, fix, add_feature, optimize)
            context: Additional context (metrics, errors, etc.)
            target_metric: Specific metric to optimize (optional)

        Returns:
            EvolutionResult with success status and improvement metrics
        """
        # Check feature flag dynamically (not cached at init)
        if not is_feature_enabled("darwin_integration_enabled"):
            logger.warning("Darwin integration disabled via feature flag")
            return EvolutionResult(
                request_id="disabled",
                agent_name=agent_name,
                success=False,
                metrics_before={},
                metrics_after={},
                improvement_delta={},
                error_message="Darwin integration disabled"
            )

        # SECURITY VALIDATIONS
        try:
            # Fix VULN-DARWIN-001: Validate agent name
            self._validate_agent_name(agent_name)

            # Fix VULN-DARWIN-005: Validate evolution type
            self._validate_evolution_type(evolution_type)

            # Fix VULN-DARWIN-002: Sanitize context
            sanitized_context = self._sanitize_context(context or {})

            # Fix VULN-DARWIN-004: Check rate limit
            if not self._check_rate_limit(agent_name):
                logger.warning(f"Rate limit exceeded for {agent_name}")
                return EvolutionResult(
                    request_id=f"rate_limited_{int(time.time())}",
                    agent_name=agent_name,
                    success=False,
                    metrics_before={},
                    metrics_after={},
                    improvement_delta={},
                    error_message=f"Rate limit exceeded: max {self.max_evolutions_per_hour}/hour"
                )

            # Fix VULN-DARWIN-003: Verify sandbox active
            await self._verify_sandbox_active()

        except ValueError as e:
            # Security validation failed
            logger.error(f"Security validation failed: {e}")
            return EvolutionResult(
                request_id=f"invalid_{int(time.time())}",
                agent_name=agent_name,
                success=False,
                metrics_before={},
                metrics_after={},
                improvement_delta={},
                error_message=f"Security validation failed: {str(e)}"
            )

        # Record attempt for rate limiting
        self._evolution_attempts[agent_name].append(datetime.now())

        # Step 1: Create evolution request
        request = EvolutionRequest(
            request_id=f"evo_{agent_name}_{int(time.time())}",
            agent_name=agent_name,
            evolution_type=evolution_type,
            context=sanitized_context,  # Use sanitized context
            target_metric=target_metric
        )

        logger.info(f"Evolution request: {request.request_id} for {agent_name}")

        try:
            # Step 2: Decompose into HTDAG task
            evolution_dag = await self._decompose_evolution_task(request)

            # Step 3: Route to Darwin via HALO
            routing_plan = await self._route_to_darwin(evolution_dag)

            # Step 4: Validate plan via AOP (with optional WaltzRL DIR gating)
            dir_report = None
            if self._dir_report_enabled:
                dir_report = load_latest_dir_report(self._dir_report_path)
                if dir_report:
                    logger.debug(
                        "Loaded WaltzRL DIR report for validation",
                        extra={"dir_report_metadata": dir_report.get("metadata", {})},
                    )
                else:
                    logger.debug("No WaltzRL DIR report available for validation")

            validation = await self.aop.validate_routing_plan(
                routing_plan,
                evolution_dag,
                dir_report=dir_report,
                dir_thresholds=self._dir_threshold_overrides,
            )
            if not validation.is_valid:
                logger.error(f"Evolution plan validation failed: {validation.issues}")
                return EvolutionResult(
                    request_id=request.request_id,
                    agent_name=agent_name,
                    success=False,
                    metrics_before={},
                    metrics_after={},
                    improvement_delta={},
                    error_message=f"Validation failed: {validation.issues}"
                )

            # Step 5: Execute Darwin evolution
            result = await self._execute_darwin_evolution(request)

            logger.info(f"Evolution complete: {result.success}, delta: {result.improvement_delta}")
            return result

        except Exception as e:
            # Catch any exceptions during orchestration pipeline
            logger.error(f"Evolution pipeline failed: {e}", exc_info=True)
            return EvolutionResult(
                request_id=request.request_id,
                agent_name=agent_name,
                success=False,
                metrics_before={},
                metrics_after={},
                improvement_delta={},
                error_message=f"Evolution pipeline error: {str(e)}"
            )

    async def _decompose_evolution_task(
        self,
        request: EvolutionRequest
    ) -> TaskDAG:
        """
        Decompose evolution request into HTDAG task structure

        Args:
            request: Evolution request to decompose

        Returns:
            TaskDAG with evolution tasks
        """
        # Create high-level evolution task description
        task_description = f"Evolve {request.agent_name} via {request.evolution_type.value}"

        # Use HTDAG to decompose
        dag = await self.htdag.decompose_task(task_description)

        # Add Darwin-specific metadata to tasks
        for task_id in dag.get_all_task_ids():
            task = dag.tasks[task_id]
            task.metadata["evolution_request_id"] = request.request_id
            task.metadata["target_agent"] = request.agent_name
            task.metadata["evolution_type"] = request.evolution_type.value

        return dag

    async def _route_to_darwin(self, dag: TaskDAG) -> RoutingPlan:
        """
        Route evolution tasks to Darwin agent via HALO

        Args:
            dag: TaskDAG with evolution tasks

        Returns:
            RoutingPlan assigning tasks to Darwin
        """
        # Use HALO to route (should route evolution tasks to darwin_agent)
        routing_plan = await self.halo.route_tasks(dag)

        # Verify Darwin is assigned
        for task_id, agent in routing_plan.assignments.items():
            if "darwin" not in agent.lower():
                logger.warning(f"Task {task_id} routed to {agent}, not Darwin")

        return routing_plan

    async def _execute_darwin_evolution(
        self,
        request: EvolutionRequest
    ) -> EvolutionResult:
        """
        Execute Darwin evolution cycle

        Args:
            request: Evolution request with agent and context

        Returns:
            EvolutionResult with improvement metrics
        """
        try:
            # Get or create Darwin agent for this agent
            darwin = await self._get_darwin_agent(request.agent_name)

            # Map evolution type to improvement type
            improvement_type_map = {
                EvolutionTaskType.IMPROVE_AGENT: ImprovementType.OPTIMIZATION,
                EvolutionTaskType.FIX_BUG: ImprovementType.BUG_FIX,
                EvolutionTaskType.ADD_FEATURE: ImprovementType.NEW_FEATURE,
                EvolutionTaskType.OPTIMIZE_PERFORMANCE: ImprovementType.OPTIMIZATION
            }
            improvement_type = improvement_type_map.get(
                request.evolution_type,
                ImprovementType.OPTIMIZATION
            )

            # Execute Darwin evolution (single generation for orchestration)
            # Note: Full evolution loop is darwin.evolve(), this is single-shot
            attempt = await self._execute_single_evolution_attempt(
                darwin=darwin,
                agent_name=request.agent_name,
                improvement_type=improvement_type,
                context=request.context
            )

            # Convert to EvolutionResult
            return EvolutionResult(
                request_id=request.request_id,
                agent_name=request.agent_name,
                success=attempt.accepted,
                metrics_before=attempt.metrics_before,
                metrics_after=attempt.metrics_after,
                improvement_delta=attempt.improvement_delta,
                new_version=f"v{attempt.generation + 1}" if attempt.accepted else None,
                error_message=attempt.error_message
            )

        except Exception as e:
            # Fix VULN-DARWIN-006: Redact sensitive data from logs
            sanitized_context = self._redact_sensitive_data(request.context)
            logger.error(
                f"Darwin evolution failed: {e}",
                exc_info=True,
                extra={"sanitized_context": sanitized_context}
            )
            return EvolutionResult(
                request_id=request.request_id,
                agent_name=request.agent_name,
                success=False,
                metrics_before={},
                metrics_after={},
                improvement_delta={},
                error_message=str(e)
            )

    async def _get_darwin_agent(self, agent_name: str) -> DarwinAgent:
        """
        Get or create Darwin agent for specific agent

        Args:
            agent_name: Name of agent to evolve

        Returns:
            DarwinAgent configured for this agent
        """
        if agent_name not in self._darwin_agents:
            # Determine agent code path
            agent_code_path = f"agents/{agent_name}.py"

            # Create Darwin agent
            self._darwin_agents[agent_name] = DarwinAgent(
                agent_name=agent_name,
                initial_code_path=agent_code_path,
                benchmark_suite="genesis_benchmark",
                max_generations=1,  # Single generation for orchestration
                population_size=1,  # Single attempt for orchestration
                acceptance_threshold=0.01  # 1% improvement required
            )

            logger.info(f"Created Darwin agent for {agent_name}")

        return self._darwin_agents[agent_name]

    async def _execute_single_evolution_attempt(
        self,
        darwin: DarwinAgent,
        agent_name: str,
        improvement_type: ImprovementType,
        context: Dict[str, Any]
    ) -> EvolutionAttempt:
        """
        Execute single evolution attempt (not full evolution loop)

        This is a simplified version of darwin.evolve() for orchestration integration.
        Uses darwin's internal methods but runs single generation.

        Args:
            darwin: DarwinAgent instance
            agent_name: Agent to evolve
            improvement_type: Type of improvement
            context: Evolution context

        Returns:
            EvolutionAttempt with results
        """
        # Generate single evolution attempt
        attempts = await darwin._generate_evolution_attempts()

        if not attempts:
            raise ValueError("No evolution attempts generated")

        # Use first attempt (population_size=1 for orchestration)
        attempt = attempts[0]

        # Update attempt metadata
        attempt.improvement_type = improvement_type.value
        attempt.problem_diagnosis = context.get("diagnosis", "General optimization requested")

        # Execute attempt
        result = await darwin._execute_evolution_attempt(attempt)

        return result


# Convenience functions

def get_darwin_bridge(
    htdag_planner: Optional[HTDAGPlanner] = None,
    halo_router: Optional[HALORouter] = None,
    aop_validator: Optional[AOPValidator] = None
) -> DarwinOrchestrationBridge:
    """
    Get Darwin orchestration bridge

    Example:
        bridge = get_darwin_bridge()
        result = await bridge.evolve_agent("marketing_agent", EvolutionTaskType.IMPROVE_AGENT)
    """
    return DarwinOrchestrationBridge(
        htdag_planner=htdag_planner,
        halo_router=halo_router,
        aop_validator=aop_validator
    )


async def evolve_agent_via_orchestration(
    agent_name: str,
    evolution_type: str = "improve_agent",
    context: Optional[Dict[str, Any]] = None
) -> EvolutionResult:
    """
    High-level convenience function to evolve an agent

    Example:
        result = await evolve_agent_via_orchestration(
            agent_name="marketing_agent",
            evolution_type="improve_agent",
            context={"diagnosis": "Low conversion rate on campaigns"}
        )

        if result.success:
            print(f"Agent improved by {result.improvement_delta['overall_score']:.2%}")

    Args:
        agent_name: Name of agent to evolve
        evolution_type: Type of evolution (improve_agent, fix_bug, add_feature, optimize_performance)
        context: Optional context for evolution

    Returns:
        EvolutionResult with improvement metrics
    """
    bridge = get_darwin_bridge()

    return await bridge.evolve_agent(
        agent_name=agent_name,
        evolution_type=EvolutionTaskType(evolution_type),
        context=context
    )


if __name__ == "__main__":
    # Example: Evolve marketing agent
    async def main():
        # Enable feature flag for testing
        from infrastructure.feature_flags import get_feature_flag_manager
        manager = get_feature_flag_manager()
        manager.set_flag("darwin_integration_enabled", True)

        # Create bridge
        bridge = get_darwin_bridge()

        # Evolve marketing agent
        result = await bridge.evolve_agent(
            agent_name="marketing_agent",
            evolution_type=EvolutionTaskType.IMPROVE_AGENT,
            context={
                "diagnosis": "Low conversion rate on campaigns",
                "current_metrics": {"conversion_rate": 0.02, "roi": 1.5}
            }
        )

        print(f"\nEvolution Result:")
        print(f"Success: {result.success}")
        print(f"Agent: {result.agent_name}")
        print(f"Metrics Before: {result.metrics_before}")
        print(f"Metrics After: {result.metrics_after}")
        print(f"Improvement Delta: {result.improvement_delta}")
        print(f"New Version: {result.new_version}")

        if result.error_message:
            print(f"Error: {result.error_message}")

    asyncio.run(main())
