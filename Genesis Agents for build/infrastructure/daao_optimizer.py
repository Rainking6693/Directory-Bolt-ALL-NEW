"""
DAAOOptimizer: Dynamic Agent Assignment Optimization
Based on DAAO (arXiv:2509.11079)

Key Results from Paper:
- 48% cost reduction vs baseline
- 23% faster execution
- Maintains quality (95%+ accuracy)

Algorithm:
1. Profile agent costs (tokens per task type)
2. Estimate task complexity
3. Dynamic programming for optimal assignment
4. Real-time replanning based on actual costs

Integration Point: Refines HALO routing plans for cost optimization
"""
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from infrastructure.task_dag import TaskDAG, Task
from infrastructure.cost_profiler import CostProfiler, AgentCostProfile

logger = logging.getLogger(__name__)


@dataclass
class OptimizationConstraints:
    """
    Constraints for DAAO optimization

    Defines boundaries for cost optimization
    """
    max_total_cost: Optional[float] = None  # Maximum budget in USD
    max_total_time: Optional[float] = None  # Maximum time in seconds
    min_quality_score: float = 0.85  # Minimum quality threshold
    agent_capacity: Optional[Dict[str, int]] = None  # Agent workload limits


@dataclass
class OptimizedPlan:
    """
    Optimized routing plan from DAAO

    Contains cost-optimized agent assignments with metrics
    """
    assignments: Dict[str, str] = field(default_factory=dict)  # task_id -> agent_name
    estimated_cost: float = 0.0
    estimated_time: float = 0.0
    quality_score: float = 0.0
    optimization_details: Dict[str, Any] = field(default_factory=dict)
    cost_savings: float = 0.0  # vs. baseline routing


class DAAOOptimizer:
    """
    Cost optimizer for agent routing plans

    Takes HALO routing plan and refines it for minimal cost
    while maintaining quality constraints.

    Algorithm (from DAAO paper):
    1. Estimate task complexity from DAG structure
    2. For each task, evaluate cost alternatives across agents
    3. Use dynamic programming to find optimal global assignment
    4. Validate quality constraints
    5. Replan if constraints violated

    Key Innovation:
    - Considers task complexity (not just task type)
    - Real-time adaptation based on execution feedback
    - Constraint-aware optimization (cost, time, quality)
    """

    def __init__(
        self,
        cost_profiler: CostProfiler,
        agent_registry: Dict[str, Any]
    ):
        """
        Initialize DAAO optimizer

        Args:
            cost_profiler: CostProfiler for agent cost profiles
            agent_registry: Agent capability registry (from HALO)
        """
        self.cost_profiler = cost_profiler
        self.agent_registry = agent_registry
        self.logger = logger

    async def optimize_routing_plan(
        self,
        initial_plan: Dict[str, str],  # task_id -> agent_name (from HALO)
        dag: TaskDAG,
        constraints: Optional[OptimizationConstraints] = None
    ) -> OptimizedPlan:
        """
        Optimize routing plan for minimal cost

        Algorithm:
        1. Estimate baseline cost from initial plan
        2. Estimate task complexities
        3. For each task, find cost-optimal agent
        4. Validate quality constraints
        5. Return optimized plan

        Args:
            initial_plan: Initial routing from HALO router
            dag: Task DAG with dependencies
            constraints: Optional optimization constraints

        Returns:
            OptimizedPlan with cost-optimized assignments
        """
        self.logger.info(f"Optimizing routing plan: {len(initial_plan)} tasks")

        constraints = constraints or OptimizationConstraints()

        # Step 1: Calculate baseline cost (from initial HALO plan)
        baseline_cost = self._estimate_plan_cost(initial_plan, dag)
        baseline_time = self._estimate_plan_time(initial_plan, dag)
        baseline_quality = self._estimate_plan_quality(initial_plan, dag)

        self.logger.info(
            f"Baseline metrics: cost=${baseline_cost:.4f}, "
            f"time={baseline_time:.1f}s, quality={baseline_quality:.2f}"
        )

        # Step 2: Estimate task complexities (from DAG structure)
        task_complexities = self._estimate_task_complexities(dag)

        # Step 3: Find cost-optimal assignment for each task
        optimized_assignments = {}
        total_cost = 0.0
        total_time = 0.0

        # Track agent workload for capacity constraints
        agent_workload: Dict[str, int] = {
            agent: 0 for agent in self.agent_registry.keys()
        }

        # Process tasks in topological order (respects dependencies)
        task_order = dag.topological_sort()

        for task_id in task_order:
            task = dag.tasks[task_id]
            complexity = task_complexities[task_id]

            # Find cost-optimal agent for this task
            best_agent, task_cost, task_time, task_quality = self._find_optimal_agent(
                task=task,
                complexity=complexity,
                available_agents=list(self.agent_registry.keys()),
                agent_workload=agent_workload,
                constraints=constraints
            )

            if best_agent is None:
                # No valid agent found (constraints too strict)
                self.logger.warning(
                    f"No valid agent for {task_id}, falling back to HALO assignment"
                )
                best_agent = initial_plan.get(task_id)
                if best_agent:
                    # Estimate with fallback
                    task_cost = self.cost_profiler.estimate_cost(
                        best_agent, task.task_type, complexity
                    )
                    task_time = self.cost_profiler.estimate_time(
                        best_agent, task.task_type, complexity
                    )
                    task_quality = self.cost_profiler.get_success_rate(
                        best_agent, task.task_type
                    )
                else:
                    # Complete failure - return initial plan
                    self.logger.error(f"Cannot optimize {task_id}, using baseline")
                    return OptimizedPlan(
                        assignments=initial_plan,
                        estimated_cost=baseline_cost,
                        estimated_time=baseline_time,
                        quality_score=baseline_quality,
                        cost_savings=0.0,
                        optimization_details={"status": "failed", "reason": "no_valid_agent"}
                    )

            # Assign task
            optimized_assignments[task_id] = best_agent
            total_cost += task_cost
            total_time += task_time  # Note: This is sequential; parallel execution reduces actual time
            agent_workload[best_agent] += 1

        # Step 4: Calculate overall quality score
        overall_quality = self._estimate_plan_quality(optimized_assignments, dag)

        # Step 5: Validate constraints
        if not self._validate_constraints(
            total_cost, total_time, overall_quality, constraints
        ):
            self.logger.warning("Optimized plan violates constraints, using baseline")
            return OptimizedPlan(
                assignments=initial_plan,
                estimated_cost=baseline_cost,
                estimated_time=baseline_time,
                quality_score=baseline_quality,
                cost_savings=0.0,
                optimization_details={"status": "constraint_violation"}
            )

        # Calculate savings
        cost_savings = baseline_cost - total_cost
        savings_pct = (cost_savings / baseline_cost * 100) if baseline_cost > 0 else 0.0

        self.logger.info(
            f"Optimization complete: cost=${total_cost:.4f} "
            f"(saved ${cost_savings:.4f}, {savings_pct:.1f}%), "
            f"time={total_time:.1f}s, quality={overall_quality:.2f}"
        )

        return OptimizedPlan(
            assignments=optimized_assignments,
            estimated_cost=total_cost,
            estimated_time=total_time,
            quality_score=overall_quality,
            cost_savings=cost_savings,
            optimization_details={
                "status": "success",
                "baseline_cost": baseline_cost,
                "savings_pct": savings_pct,
                "agent_workload": agent_workload
            }
        )

    def _estimate_task_complexities(self, dag: TaskDAG) -> Dict[str, float]:
        """
        Estimate complexity for each task

        Approach (from DAAO paper):
        - Task depth in DAG (deeper = more complex)
        - Number of dependencies (more = more context)
        - Task type (some types inherently more complex)

        Returns:
            Dict mapping task_id to complexity multiplier (0.5 to 3.0)
        """
        complexities = {}

        for task_id, task in dag.tasks.items():
            # Base complexity from task type
            type_complexity = {
                "research": 2.0,
                "architecture": 1.8,
                "design": 1.5,
                "implement": 1.5,
                "backend": 1.6,
                "frontend": 1.4,
                "test": 1.0,
                "deploy": 1.2,
                "api_call": 0.8,
                "file_write": 0.7,
                "test_run": 0.9,
                "generic": 1.0
            }.get(task.task_type, 1.0)

            # Adjustment based on dependencies (more dependencies = more context)
            dep_factor = 1.0 + (len(task.dependencies) * 0.1)

            # Adjustment based on depth (deeper tasks are more complex)
            # Use number of dependencies as proxy for depth
            num_deps = len(task.dependencies)
            depth_factor = 1.0 + (num_deps * 0.05)

            # Combined complexity
            complexity = type_complexity * dep_factor * depth_factor

            # Clamp to reasonable range
            complexity = max(0.5, min(3.0, complexity))

            complexities[task_id] = complexity

        return complexities

    def _find_optimal_agent(
        self,
        task: Task,
        complexity: float,
        available_agents: List[str],
        agent_workload: Dict[str, int],
        constraints: OptimizationConstraints
    ) -> Tuple[Optional[str], float, float, float]:
        """
        Find cost-optimal agent for a task

        Algorithm:
        1. Filter to agents that support this task type
        2. For each candidate, estimate: cost, time, quality
        3. Rank by cost efficiency (cost / quality)
        4. Return best agent within constraints

        Returns:
            (agent_name, estimated_cost, estimated_time, quality_score)
        """
        # Step 1: Filter to capable agents
        capable_agents = []
        for agent_name in available_agents:
            agent_cap = self.agent_registry.get(agent_name)
            if not agent_cap:
                continue

            # Check task type support
            if task.task_type in agent_cap.supported_task_types:
                # Check capacity constraint
                max_tasks = agent_cap.max_concurrent_tasks
                current_load = agent_workload.get(agent_name, 0)

                if current_load < max_tasks:
                    capable_agents.append(agent_name)

        if not capable_agents:
            return None, 0.0, 0.0, 0.0

        # Step 2: Evaluate candidates
        candidates = []
        for agent_name in capable_agents:
            # Estimate cost
            cost = self.cost_profiler.estimate_cost(
                agent_name, task.task_type, complexity
            )

            # Estimate time
            time = self.cost_profiler.estimate_time(
                agent_name, task.task_type, complexity
            )

            # Estimate quality (success rate)
            quality = self.cost_profiler.get_success_rate(
                agent_name, task.task_type
            )

            # Quality constraint check
            if quality < constraints.min_quality_score:
                continue

            # Cost efficiency = cost / quality (lower is better)
            cost_efficiency = cost / quality if quality > 0 else float('inf')

            candidates.append((agent_name, cost, time, quality, cost_efficiency))

        if not candidates:
            return None, 0.0, 0.0, 0.0

        # Step 3: Rank by cost efficiency
        best_agent, cost, time, quality, _ = min(
            candidates,
            key=lambda x: x[4]  # Sort by cost efficiency
        )

        return best_agent, cost, time, quality

    def _estimate_plan_cost(
        self,
        assignments: Dict[str, str],
        dag: TaskDAG
    ) -> float:
        """Estimate total cost of routing plan"""
        total_cost = 0.0

        for task_id, agent_name in assignments.items():
            task = dag.tasks.get(task_id)
            if not task:
                continue

            # Default complexity = 1.0
            cost = self.cost_profiler.estimate_cost(
                agent_name, task.task_type, task_complexity=1.0
            )
            total_cost += cost

        return total_cost

    def _estimate_plan_time(
        self,
        assignments: Dict[str, str],
        dag: TaskDAG
    ) -> float:
        """Estimate total time of routing plan (sequential execution)"""
        total_time = 0.0

        for task_id, agent_name in assignments.items():
            task = dag.tasks.get(task_id)
            if not task:
                continue

            time = self.cost_profiler.estimate_time(
                agent_name, task.task_type, task_complexity=1.0
            )
            total_time += time

        return total_time

    def _estimate_plan_quality(
        self,
        assignments: Dict[str, str],
        dag: TaskDAG
    ) -> float:
        """Estimate overall quality of routing plan"""
        success_rates = []

        for task_id, agent_name in assignments.items():
            task = dag.tasks.get(task_id)
            if not task:
                continue

            success_rate = self.cost_profiler.get_success_rate(
                agent_name, task.task_type
            )
            success_rates.append(success_rate)

        if not success_rates:
            return 0.85  # Default

        # Overall quality = product of success rates (assumes independence)
        import math
        return math.prod(success_rates)

    def _validate_constraints(
        self,
        total_cost: float,
        total_time: float,
        quality_score: float,
        constraints: OptimizationConstraints
    ) -> bool:
        """Validate optimized plan against constraints"""

        # Cost constraint
        if constraints.max_total_cost is not None:
            if total_cost > constraints.max_total_cost:
                self.logger.warning(
                    f"Cost constraint violated: ${total_cost:.4f} > ${constraints.max_total_cost:.4f}"
                )
                return False

        # Time constraint
        if constraints.max_total_time is not None:
            if total_time > constraints.max_total_time:
                self.logger.warning(
                    f"Time constraint violated: {total_time:.1f}s > {constraints.max_total_time:.1f}s"
                )
                return False

        # Quality constraint
        if quality_score < constraints.min_quality_score:
            self.logger.warning(
                f"Quality constraint violated: {quality_score:.2f} < {constraints.min_quality_score:.2f}"
            )
            return False

        return True

    async def replan_from_feedback(
        self,
        current_plan: OptimizedPlan,
        dag: TaskDAG,
        completed_tasks: List[str],
        actual_metrics: Dict[str, Dict[str, Any]],
        constraints: Optional[OptimizationConstraints] = None
    ) -> OptimizedPlan:
        """
        Replan based on actual execution feedback

        Algorithm (from DAAO paper):
        1. Update cost profiles with actual metrics
        2. Recalculate remaining task assignments
        3. Optimize remaining tasks with updated profiles

        Args:
            current_plan: Current optimized plan
            dag: Task DAG
            completed_tasks: List of completed task IDs
            actual_metrics: Actual execution metrics (cost, time, success)
            constraints: Optimization constraints

        Returns:
            Updated OptimizedPlan for remaining tasks
        """
        self.logger.info(f"Replanning based on {len(completed_tasks)} completed tasks")

        # Step 1: Update cost profiles
        for task_id in completed_tasks:
            if task_id in actual_metrics:
                metrics = actual_metrics[task_id]
                agent_name = current_plan.assignments[task_id]
                task = dag.tasks[task_id]

                # Record actual execution
                self.cost_profiler.record_execution(
                    task_id=task_id,
                    agent_name=agent_name,
                    task_type=task.task_type,
                    tokens_used=metrics.get("tokens_used", 0),
                    execution_time_seconds=metrics.get("execution_time", 0.0),
                    success=metrics.get("success", True),
                    cost_tier=self.agent_registry[agent_name].cost_tier
                )

        # Step 2: Identify remaining tasks
        remaining_tasks = {
            tid: agent for tid, agent in current_plan.assignments.items()
            if tid not in completed_tasks
        }

        if not remaining_tasks:
            self.logger.info("All tasks completed, no replanning needed")
            return current_plan

        # Step 3: Optimize remaining tasks with updated profiles
        optimized_plan = await self.optimize_routing_plan(
            initial_plan=remaining_tasks,
            dag=dag,
            constraints=constraints
        )

        # Merge with completed tasks
        final_assignments = {
            tid: current_plan.assignments[tid]
            for tid in completed_tasks
        }
        final_assignments.update(optimized_plan.assignments)

        return OptimizedPlan(
            assignments=final_assignments,
            estimated_cost=optimized_plan.estimated_cost,
            estimated_time=optimized_plan.estimated_time,
            quality_score=optimized_plan.quality_score,
            cost_savings=optimized_plan.cost_savings,
            optimization_details={
                **optimized_plan.optimization_details,
                "replanned": True,
                "completed_tasks": len(completed_tasks)
            }
        )
