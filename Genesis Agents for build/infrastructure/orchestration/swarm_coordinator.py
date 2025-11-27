"""
Swarm Coordinator - Integrates Team Optimizer with HALO Router

Version: 1.0
Last Updated: November 2, 2025

Orchestrates team-based task execution for Genesis Meta-Agent.
Integrates PSO-optimized team composition with HALO routing.

Key Features:
- Dynamic team generation using Inclusive Fitness PSO
- HALO router integration for sub-task routing
- Team performance tracking and evolution
- Business-specific team spawning
- Genotype-based cooperation optimization
"""

import asyncio
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field

from infrastructure.task_dag import Task, TaskStatus
from infrastructure.halo_router import HALORouter
from infrastructure.swarm.swarm_halo_bridge import (
    SwarmHALOBridge,
    AgentProfile,
    GENESIS_DEFAULT_PROFILES,
)
from infrastructure.inclusive_fitness_swarm import TaskRequirement

logger = logging.getLogger(__name__)


@dataclass
class TeamExecutionResult:
    """Result of team-based task execution"""
    task_id: str
    team: List[str]
    status: str  # "completed", "failed", "partial"
    individual_results: List[Dict[str, Any]] = field(default_factory=list)
    combined_output: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0
    errors: List[str] = field(default_factory=list)


class SwarmCoordinator:
    """
    Coordinates swarm-optimized teams with HALO routing.

    Workflow:
    1. Generate optimal team using PSO + Inclusive Fitness
    2. Decompose task into sub-tasks for team members
    3. Route sub-tasks via HALO router
    4. Execute team members in parallel
    5. Combine results and track performance
    """

    def __init__(
        self,
        halo_router: HALORouter,
        agent_profiles: Optional[List[AgentProfile]] = None,
        n_particles: int = 50,
        max_iterations: int = 100,
        random_seed: Optional[int] = None
    ):
        """
        Initialize Swarm Coordinator

        Args:
            halo_router: HALO router instance for task routing
            agent_profiles: Optional agent profiles (defaults to Genesis 15)
            n_particles: Number of PSO particles (default: 50)
            max_iterations: Maximum PSO iterations (default: 100)
            random_seed: Random seed for reproducibility
        """
        self.halo_router = halo_router

        # Initialize Swarm-HALO bridge
        profiles = agent_profiles or GENESIS_DEFAULT_PROFILES
        self.swarm_bridge = SwarmHALOBridge(
            agent_profiles=profiles,
            n_particles=n_particles,
            max_iterations=max_iterations,
            random_seed=random_seed
        )

        # Track active teams and performance
        self.active_teams: Dict[str, List[str]] = {}  # task_id -> team
        self.team_performance: Dict[str, float] = {}  # team_hash -> performance
        self.execution_history: List[TeamExecutionResult] = []

        logger.info(
            f"SwarmCoordinator initialized with {len(profiles)} agents, "
            f"{n_particles} particles, {max_iterations} iterations"
        )

    async def generate_optimal_team(
        self,
        task: Task,
        team_size: int = 3,
        task_requirements: Optional[Dict[str, float]] = None,
        max_retries: int = 3
    ) -> List[str]:
        """
        Generate optimal team for task using PSO with HALO validation retry

        Args:
            task: Genesis task to execute
            team_size: Desired team size
            task_requirements: Required capabilities (auto-inferred if None)
            max_retries: Maximum PSO retry attempts before HALO fallback (default: 3)

        Returns:
            List of agent names forming optimal team
        """
        # Auto-infer requirements if not provided
        if task_requirements is None:
            task_requirements = self._infer_requirements_from_task(task)

        # Convert to list of capability names for SwarmHALOBridge
        required_capabilities = list(task_requirements.keys())

        task_metadata = getattr(task, "metadata", {}) or {}
        required_security = "high" if task_metadata.get("sensitivity") == "high" else "standard"

        # Retry loop: Attempt PSO optimization with HALO validation
        for attempt in range(1, max_retries + 1):
            # Run PSO optimization via bridge
            logger.info(f"Optimizing team for task {task.task_id} (attempt {attempt}/{max_retries})")
            agent_names, fitness, explanations = self.swarm_bridge.optimize_team(
                task_id=task.task_id,
                required_capabilities=required_capabilities,
                team_size_range=(max(1, team_size - 1), team_size + 1),
                priority=1.0,
                verbose=False
            )

            # Validate with HALO router
            validation = self.halo_router.validate_team_composition(
                agent_names=agent_names,
                task_type=task_metadata.get("task_type"),
                required_capabilities=required_capabilities,
                required_security_level=required_security
            )

            if validation.is_valid:
                # Success: Team passes HALO validation
                self.active_teams[task.task_id] = agent_names
                logger.info(
                    f"Team optimized for {task.task_id}: {agent_names} "
                    f"(fitness={fitness:.3f}, attempt={attempt})"
                )

                # Log explanations
                for agent, explanation in explanations.items():
                    logger.debug(f"  {agent}: {explanation}")

                return agent_names
            else:
                # Validation failed: Log and retry
                logger.warning(
                    f"HALO validation failed (attempt {attempt}/{max_retries}): "
                    f"{', '.join(validation.reasons)}. Team: {agent_names}"
                )

                if attempt < max_retries:
                    logger.info(f"Retrying PSO optimization with different seed...")
                    # Re-initialize PSO with perturbed random seed to get different trajectory
                    new_seed = (self.swarm_bridge.pso.random_seed or 42) + attempt
                    self.swarm_bridge.reinitialize_pso(random_seed=new_seed)

        # All retries exhausted: Fall back to HALO-direct routing
        logger.error(
            f"PSO optimization failed after {max_retries} attempts. "
            f"Falling back to HALO-direct agent selection for task {task.task_id}"
        )

        # HALO fallback: Let HALO router select agents based on capabilities
        fallback_team = self._halo_fallback_team_selection(
            required_capabilities=required_capabilities,
            team_size=team_size,
            task_metadata=task_metadata
        )

        self.active_teams[task.task_id] = fallback_team
        logger.info(f"HALO fallback team for {task.task_id}: {fallback_team}")

        return fallback_team

    async def route_to_team(
        self,
        task: Task,
        team: List[str]
    ) -> Dict[str, str]:
        """
        Route task to team via HALO router

        Creates sub-tasks for each team member and coordinates execution.

        Args:
            task: Main task to execute
            team: List of agent names

        Returns:
            Dict mapping agent_name -> assigned_sub_task_id
        """
        # Decompose task into sub-tasks for team
        sub_tasks = self._decompose_for_team(task, team)

        # Route each sub-task to team member via HALO router
        assignments = {}
        for agent_name, sub_task in zip(team, sub_tasks):
            # Call HALO router for validation and routing
            try:
                routing_plan = await self.halo_router.route_tasks([sub_task])
                assigned_agent = routing_plan.assignments.get(sub_task.task_id, agent_name)

                # Verify HALO agrees with swarm decision
                if assigned_agent != agent_name:
                    logger.warning(
                        f"HALO suggested {assigned_agent}, swarm chose {agent_name}. "
                        f"Using swarm decision for team coherence."
                    )

                assignments[agent_name] = sub_task.task_id
                logger.debug(
                    f"Routed sub-task {sub_task.task_id} to {agent_name} "
                    f"(HALO validation: {assigned_agent})"
                )
            except Exception as e:
                logger.error(
                    f"HALO routing failed for {sub_task.task_id}: {e}. "
                    f"Falling back to swarm assignment."
                )
                assignments[agent_name] = sub_task.task_id

        return assignments

    async def execute_team_task(
        self,
        task: Task,
        team: List[str]
    ) -> TeamExecutionResult:
        """
        Execute task with team coordination

        Args:
            task: Task to execute
            team: List of agent names

        Returns:
            TeamExecutionResult with combined results from all team members
        """
        import time
        start_time = time.time()

        # Route to team
        assignments = await self.route_to_team(task, team)

        # Execute team members in parallel with timeout protection
        logger.info(f"Executing task {task.task_id} with team {team}")

        try:
            results = await asyncio.wait_for(
                asyncio.gather(*[
                    self._execute_agent_subtask(agent, sub_task_id)
                    for agent, sub_task_id in assignments.items()
                ], return_exceptions=True),
                timeout=300.0  # 5 minute timeout
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Team workflow timeout after 300s for task {task.task_id}"
            )
            execution_time = time.time() - start_time
            return TeamExecutionResult(
                task_id=task.task_id,
                team=team,
                status="timeout",
                individual_results=[],
                combined_output={"error": "Workflow exceeded 300s timeout"},
                execution_time=execution_time,
                errors=[f"Timeout: Team workflow did not complete within 300s"]
            )

        # Process results
        individual_results = []
        errors = []
        successful_count = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append(f"Agent {team[i]} failed: {str(result)}")
            else:
                individual_results.append(result)
                if result.get("status") == "completed":
                    successful_count += 1

        # Combine results
        combined = self._combine_team_results(individual_results)

        # Determine overall status
        if successful_count == len(team):
            status = "completed"
        elif successful_count > 0:
            status = "partial"
        else:
            status = "failed"

        execution_time = time.time() - start_time

        # Create result
        result = TeamExecutionResult(
            task_id=task.task_id,
            team=team,
            status=status,
            individual_results=individual_results,
            combined_output=combined,
            execution_time=execution_time,
            errors=errors
        )

        # Track performance
        self._track_team_performance(team, result)
        self.execution_history.append(result)

        logger.info(
            f"Task {task.task_id} completed: status={status}, "
            f"time={execution_time:.2f}s"
        )

        return result

    async def spawn_dynamic_team_for_business(
        self,
        business_type: str,
        complexity: str = "medium",
        max_retries: int = 3
    ) -> List[str]:
        """
        Dynamically spawn team for business creation with HALO validation retry

        Args:
            business_type: e.g., "ecommerce", "saas", "content_platform"
            complexity: "simple", "medium", "complex"
            max_retries: Maximum PSO retry attempts before HALO fallback (default: 3)

        Returns:
            Optimal team composition
        """
        # Map business type to requirements
        business_requirements = {
            "ecommerce": [
                "coding", "deployment", "testing", "ads", "payments"
            ],
            "saas": [
                "coding", "deployment", "testing", "security_audit",
                "data_analysis", "subscriptions"
            ],
            "content_platform": [
                "coding", "writing", "seo", "deployment", "content_strategy"
            ],
            "marketplace": [
                "coding", "deployment", "payments", "user_training", "testing"
            ],
            "analytics_dashboard": [
                "data_analysis", "coding", "deployment", "reporting"
            ]
        }

        required_capabilities = business_requirements.get(
            business_type,
            ["coding", "deployment"]  # Fallback
        )

        # Adjust team size by complexity
        team_sizes = {
            "simple": (2, 3),
            "medium": (3, 4),
            "complex": (5, 7)
        }
        team_size_range = team_sizes.get(complexity, (3, 4))

        logger.info(
            f"Spawning team for {business_type} business "
            f"(complexity={complexity})"
        )

        security_level = "high" if business_type in {"marketplace", "saas"} else "standard"

        # Retry loop: Attempt PSO optimization with HALO validation
        for attempt in range(1, max_retries + 1):
            # Generate optimal team
            agent_names, fitness, explanations = self.swarm_bridge.optimize_team(
                task_id=f"business_{business_type}",
                required_capabilities=required_capabilities,
                team_size_range=team_size_range,
                priority=1.0,
                verbose=False
            )

            # Validate with HALO router
            validation = self.halo_router.validate_team_composition(
                agent_names=agent_names,
                task_type=business_type,
                required_capabilities=required_capabilities,
                required_security_level=security_level
            )

            if validation.is_valid:
                # Success: Team passes HALO validation
                diversity = self.swarm_bridge.get_team_genotype_diversity(agent_names)
                cooperation = self.swarm_bridge.get_team_cooperation_score(agent_names)

                logger.info(
                    f"Business team spawned: {agent_names} "
                    f"(fitness={fitness:.3f}, diversity={diversity:.2f}, "
                    f"cooperation={cooperation:.2f}, attempt={attempt})"
                )

                return agent_names
            else:
                # Validation failed: Log and retry
                logger.warning(
                    f"HALO validation failed for business '{business_type}' "
                    f"(attempt {attempt}/{max_retries}): {', '.join(validation.reasons)}. "
                    f"Team: {agent_names}"
                )

                if attempt < max_retries:
                    logger.info(f"Retrying PSO optimization with different seed...")
                    # Re-initialize PSO with perturbed random seed to get different trajectory
                    new_seed = (self.swarm_bridge.pso.random_seed or 42) + attempt
                    self.swarm_bridge.reinitialize_pso(random_seed=new_seed)

        # All retries exhausted: Fall back to HALO-direct routing
        logger.error(
            f"PSO optimization failed after {max_retries} attempts for business '{business_type}'. "
            f"Falling back to HALO-direct agent selection"
        )

        # HALO fallback
        fallback_team = self._halo_fallback_team_selection(
            required_capabilities=required_capabilities,
            team_size=team_size_range[0],  # Use minimum team size
            task_metadata={"business_type": business_type}
        )

        logger.info(f"HALO fallback team for business '{business_type}': {fallback_team}")

        return fallback_team

    def get_team_performance_history(
        self,
        team: List[str]
    ) -> Dict[str, Any]:
        """
        Get historical performance for team composition

        Args:
            team: List of agent names

        Returns:
            Performance metrics for this team composition
        """
        team_hash = "_".join(sorted(team))

        # Count executions
        execution_count = sum(
            1 for result in self.execution_history
            if "_".join(sorted(result.team)) == team_hash
        )

        # Calculate average success rate
        if execution_count > 0:
            success_count = sum(
                1 for result in self.execution_history
                if "_".join(sorted(result.team)) == team_hash
                and result.status == "completed"
            )
            success_rate = success_count / execution_count
        else:
            success_rate = 0.0

        return {
            "team": team,
            "team_hash": team_hash,
            "performance": self.team_performance.get(team_hash, 0.0),
            "execution_count": execution_count,
            "success_rate": success_rate,
            "diversity": self.swarm_bridge.get_team_genotype_diversity(team),
            "cooperation": self.swarm_bridge.get_team_cooperation_score(team)
        }

    def evolve_team(
        self,
        current_team: List[str],
        performance_feedback: float
    ) -> List[str]:
        """
        Evolve team based on performance feedback

        Args:
            current_team: Current team composition
            performance_feedback: Performance score (0.0-1.0)

        Returns:
            Evolved team composition (may be same if performing well)
        """
        # If team performed well, keep it
        if performance_feedback >= 0.7:
            logger.info(
                f"Team performing well (score={performance_feedback:.2f}), "
                "keeping current composition"
            )
            return current_team

        # If team performed poorly, trigger re-optimization
        logger.info(
            f"Team underperforming (score={performance_feedback:.2f}), "
            "triggering re-optimization"
        )

        # Return current team for now (evolution logic placeholder)
        # Future: Re-run PSO with adjusted parameters
        return current_team

    # ===== PRIVATE HELPER METHODS =====

    def _halo_fallback_team_selection(
        self,
        required_capabilities: List[str],
        team_size: int,
        task_metadata: Dict[str, Any]
    ) -> List[str]:
        """
        HALO-direct fallback team selection when PSO fails

        Uses HALO router's logic-based routing to select agents
        based purely on capability matching.

        Args:
            required_capabilities: List of required capabilities
            team_size: Desired team size
            task_metadata: Task metadata for routing context

        Returns:
            List of agent names selected by HALO router
        """
        # Map capabilities to agent specialties (Genesis 15 agents)
        capability_to_agents = {
            "testing": ["qa_agent"],
            "coding": ["builder_agent", "spec_agent"],
            "deployment": ["deploy_agent"],
            "data_analysis": ["analyst_agent"],
            "security_audit": ["security_agent"],
            "writing": ["content_agent"],
            "ads": ["marketing_agent"],
            "support": ["support_agent"],
            "onboarding": ["onboarding_agent"],
            "seo": ["seo_agent"],
            "email": ["email_agent"],
            "billing": ["billing_agent"],
            "legal": ["legal_agent"],
            "maintenance": ["maintenance_agent"]
        }

        # Build team from required capabilities
        fallback_team = []
        for cap in required_capabilities:
            agents = capability_to_agents.get(cap, [])
            for agent in agents:
                if agent not in fallback_team:
                    fallback_team.append(agent)
                    if len(fallback_team) >= team_size:
                        break
            if len(fallback_team) >= team_size:
                break

        # If still not enough agents, add builder as default
        while len(fallback_team) < team_size:
            if "builder_agent" not in fallback_team:
                fallback_team.append("builder_agent")
            elif "qa_agent" not in fallback_team:
                fallback_team.append("qa_agent")
            elif "deploy_agent" not in fallback_team:
                fallback_team.append("deploy_agent")
            else:
                # Add any remaining agent
                all_agents = ["builder_agent", "qa_agent", "deploy_agent", "security_agent",
                             "analyst_agent", "spec_agent", "maintenance_agent", "support_agent",
                             "onboarding_agent", "marketing_agent", "content_agent", "seo_agent",
                             "email_agent", "billing_agent", "legal_agent"]
                for agent in all_agents:
                    if agent not in fallback_team:
                        fallback_team.append(agent)
                        break
                break  # Safety: prevent infinite loop

        logger.info(
            f"HALO fallback team selection: {fallback_team} "
            f"for capabilities {required_capabilities}"
        )

        return fallback_team[:team_size]

    def _infer_requirements_from_task(
        self,
        task: Task
    ) -> Dict[str, float]:
        """
        Infer required capabilities from task description

        Uses simple keyword matching to determine capabilities.

        Args:
            task: Task to analyze

        Returns:
            Dict of capability -> importance (0.0-1.0)
        """
        requirements = {}

        desc_lower = (task.description or "").lower()

        # Keyword mappings
        keyword_mappings = {
            "testing": ["test", "qa", "quality", "validation"],
            "coding": ["build", "create", "implement", "code", "develop"],
            "deployment": ["deploy", "launch", "release"],
            "data_analysis": ["analyze", "analytics", "metrics", "data"],
            "security_audit": ["security", "audit", "vulnerability"],
            "writing": ["content", "write", "copy"],
            "ads": ["marketing", "advertis", "campaign"],
        }

        for capability, keywords in keyword_mappings.items():
            if any(keyword in desc_lower for keyword in keywords):
                requirements[capability] = 1.0

        # Default if no matches
        if not requirements:
            requirements["coding"] = 1.0

        return requirements

    def _decompose_for_team(
        self,
        task: Task,
        team: List[str]
    ) -> List[Task]:
        """
        Decompose task into sub-tasks for team members

        Args:
            task: Main task
            team: Team members

        Returns:
            List of sub-tasks (one per team member)
        """
        sub_tasks = []

        for i, agent in enumerate(team):
            sub_task = Task(
                task_id=f"{task.task_id}_sub_{i}",
                task_type=task.task_type,
                description=f"{task.description} (assigned to {agent})",
                status=TaskStatus.PENDING,
                metadata={
                    **task.metadata,
                    "team_role": agent,
                    "parent_task_id": task.task_id
                }
            )
            sub_tasks.append(sub_task)

        return sub_tasks

    async def _execute_agent_subtask(
        self,
        agent: str,
        sub_task_id: str
    ) -> Dict[str, Any]:
        """
        Execute sub-task via agent with error handling

        Args:
            agent: Agent name
            sub_task_id: Sub-task ID

        Returns:
            Execution result dict with status field indicating success/error
        """
        try:
            # Simulate work
            await asyncio.sleep(0.1)

            # In real implementation, call actual agent execution via HALO
            # For now, return mock success
            result = {
                "agent": agent,
                "task_id": sub_task_id,
                "status": "completed",
                "output": f"Result from {agent} for {sub_task_id}"
            }
            logger.debug(f"Agent {agent} completed sub-task {sub_task_id}")
            return result
        except asyncio.CancelledError:
            # Handle cancellation gracefully
            logger.warning(f"Agent {agent} sub-task {sub_task_id} was cancelled")
            return {
                "status": "cancelled",
                "agent": agent,
                "task_id": sub_task_id,
                "error": "Task was cancelled"
            }
        except Exception as e:
            # Capture any unexpected errors
            logger.error(
                f"Agent {agent} failed executing sub-task {sub_task_id}: {e}",
                exc_info=True
            )
            return {
                "status": "error",
                "agent": agent,
                "task_id": sub_task_id,
                "error": str(e),
                "error_type": type(e).__name__
            }

    def _combine_team_results(
        self,
        results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Combine results from all team members

        Args:
            results: List of individual agent results

        Returns:
            Combined result dict
        """
        return {
            "team_size": len(results),
            "individual_results": results,
            "status": "team_completed" if results else "team_empty"
        }

    def _track_team_performance(
        self,
        team: List[str],
        result: TeamExecutionResult
    ):
        """
        Track team performance for future optimization

        Args:
            team: Team composition
            result: Execution result
        """
        team_hash = "_".join(sorted(team))

        # Calculate performance score
        if result.status == "completed":
            performance = 1.0
        elif result.status == "partial":
            performance = 0.5
        else:
            performance = 0.0

        # Update rolling average (simple exponential smoothing)
        if team_hash in self.team_performance:
            alpha = 0.3  # Smoothing factor
            self.team_performance[team_hash] = (
                alpha * performance +
                (1 - alpha) * self.team_performance[team_hash]
            )
        else:
            self.team_performance[team_hash] = performance

        logger.debug(
            f"Team {team_hash} performance updated: "
            f"{self.team_performance[team_hash]:.3f}"
        )


def create_swarm_coordinator(
    halo_router: HALORouter,
    agent_profiles: Optional[List[AgentProfile]] = None,
    n_particles: int = 50,
    max_iterations: int = 100,
    random_seed: Optional[int] = None
) -> SwarmCoordinator:
    """
    Factory function to create SwarmCoordinator

    Args:
        halo_router: HALO router instance
        agent_profiles: Optional agent profiles
        n_particles: Number of PSO particles
        max_iterations: Maximum PSO iterations
        random_seed: Random seed for reproducibility

    Returns:
        SwarmCoordinator instance
    """
    return SwarmCoordinator(
        halo_router=halo_router,
        agent_profiles=agent_profiles,
        n_particles=n_particles,
        max_iterations=max_iterations,
        random_seed=random_seed
    )
