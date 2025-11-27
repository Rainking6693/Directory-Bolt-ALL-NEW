"""
AOPValidator: Agent Orchestration Protocol Validation
Based on AOP Framework (arXiv:2410.02189)

Three-Principle Validation:
1. Solvability: Can assigned agents actually solve tasks?
2. Completeness: Are all tasks assigned?
3. Non-redundancy: No duplicate work?

Reward Model Formula (from ORCHESTRATION_DESIGN.md lines 683-732):
score = 0.4 × P(success) + 0.3 × quality + 0.2 × (1 - cost) + 0.1 × (1 - time)

Integration Point: Validates HALO routing plans against HTDAG task structure

LLM Judge Integration (NEW): Enhanced reward scoring using LLM-based evaluation
"""
import logging
import math
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from infrastructure.task_dag import TaskDAG, Task

# Optional LLM Judge integration for enhanced reward scoring
try:
    from infrastructure.llm_judge_rl import LLMJudge, AOPRewardIntegration, JudgmentCriterion
    HAS_LLM_JUDGE = True
except ImportError:
    HAS_LLM_JUDGE = False

logger = logging.getLogger(__name__)

DEFAULT_DIR_THRESHOLDS = {
    "min_reward_mean": 0.2,
    "min_positive_rate": 0.6,
    "min_safety_delta": 0.05,
    "target_unsafe_reduction": 0.35,
    "target_overrefusal_reduction": 0.35,
}


# Data structures for HALO router integration (Phase 1.4 will implement full HALO)
@dataclass
class AgentCapability:
    """Agent capabilities for routing decisions"""
    agent_name: str
    supported_task_types: List[str] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    cost_tier: str = "medium"  # "cheap", "medium", "expensive"
    success_rate: float = 0.85  # Historical success rate (0.0 to 1.0)
    avg_completion_time: float = 10.0  # Minutes


@dataclass
class RoutingPlan:
    """Routing plan from HALO router"""
    assignments: Dict[str, str] = field(default_factory=dict)  # task_id -> agent_name
    unassigned_tasks: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """Result of AOP validation"""
    passed: bool
    solvability_passed: bool
    completeness_passed: bool
    redundancy_passed: bool
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    quality_score: Optional[float] = None  # 0.0 to 1.0
    dir_validation_passed: Optional[bool] = None
    dir_report: Optional[Dict[str, Any]] = None

    @property
    def is_valid(self) -> bool:
        """Alias for passed (for backward compatibility with tests)"""
        return self.passed

    @property
    def solvability_check(self) -> bool:
        """Alias for solvability_passed (for backward compatibility with tests)"""
        return self.solvability_passed

    @property
    def completeness_check(self) -> bool:
        """Alias for completeness_passed (for backward compatibility with tests)"""
        return self.completeness_passed

    @property
    def non_redundancy_check(self) -> bool:
        """Alias for redundancy_passed (for backward compatibility with tests)"""
        return self.redundancy_passed

    def __str__(self) -> str:
        status = "PASSED" if self.passed else "FAILED"
        score_str = f" (score={self.quality_score:.2f})" if self.quality_score else ""
        return (
            f"ValidationResult: {status}{score_str}\n"
            f"  Solvability: {'✓' if self.solvability_passed else '✗'}\n"
            f"  Completeness: {'✓' if self.completeness_passed else '✗'}\n"
            f"  Non-redundancy: {'✓' if self.redundancy_passed else '✗'}\n"
            f"  DIR Validation: {'✓' if self.dir_validation_passed else '—'}\n"
            f"  Issues: {len(self.issues)}\n"
            f"  Warnings: {len(self.warnings)}"
        )


class AOPValidator:
    """
    Validation layer for routing plans

    Based on Agent-Oriented Planning (arXiv:2410.02189)
    Implements three-principle validation:
    1. Solvability: Agent capabilities match task requirements
    2. Completeness: All DAG tasks have agent assignments
    3. Non-redundancy: No duplicate work across agents

    Additionally calculates quality score using reward model formula
    """

    def __init__(self, agent_registry: Optional[Dict[str, AgentCapability]] = None, use_llm_judge: bool = False):
        """
        Initialize validator with agent registry

        Args:
            agent_registry: Dict of agent_name -> AgentCapability
            use_llm_judge: Whether to use LLM judge for enhanced reward scoring
        """
        self.agent_registry = agent_registry or {}
        self.logger = logger
        self.use_llm_judge = use_llm_judge and HAS_LLM_JUDGE

        # Initialize LLM judge if requested
        self.llm_judge_integration = None
        if self.use_llm_judge:
            try:
                judge = LLMJudge(model_name="gpt-4o")
                self.llm_judge_integration = AOPRewardIntegration(judge)
                self.logger.info("LLM judge integration enabled for enhanced reward scoring")
            except Exception as e:
                self.logger.warning(f"Failed to initialize LLM judge: {e}")
                self.use_llm_judge = False

        # Reward model weights (from ORCHESTRATION_DESIGN.md line 684)
        self.weight_success = 0.4
        self.weight_quality = 0.3
        self.weight_cost = 0.2
        self.weight_time = 0.1

    async def validate_routing_plan(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG,
        max_budget: Optional[float] = None,
        dir_report: Optional[Dict[str, Any]] = None,
        dir_thresholds: Optional[Dict[str, float]] = None
    ) -> ValidationResult:
        """
        Validate routing plan with 3 principles + budget constraint + security checks:
        1. Solvability: Can assigned agents actually solve tasks?
        2. Completeness: Are all tasks assigned?
        3. Non-redundancy: No duplicate work?
        4. Budget validation: Does plan fit within budget? (DAAO Phase 2)
        5. Security: DAG cycle detection and depth limits (Phase 3)
        6. Optional WaltzRL DIR validation for collaborative safety

        Args:
            routing_plan: Routing plan from HALO router (possibly DAAO-optimized)
            dag: Task DAG from HTDAG decomposition
            max_budget: Optional maximum budget in USD (DAAO Phase 2)
            dir_report: Optional DIR report dictionary from WaltzRL evaluations
            dir_thresholds: Optional overrides for DIR validation thresholds

        Returns:
            ValidationResult with pass/fail status and quality score
        """
        # Handle argument order flexibility (for backward compatibility with tests)
        from infrastructure.task_dag import TaskDAG
        from infrastructure.halo_router import RoutingPlan

        if isinstance(routing_plan, TaskDAG) and isinstance(dag, RoutingPlan):
            # Arguments are swapped - fix it
            routing_plan, dag = dag, routing_plan
            self.logger.debug("Auto-corrected argument order (dag, routing_plan) → (routing_plan, dag)")

        self.logger.info(f"Validating routing plan: {len(routing_plan.assignments)} assignments")

        result = ValidationResult(
            passed=True,
            solvability_passed=True,
            completeness_passed=True,
            redundancy_passed=True
        )

        # Principle 1: Solvability
        self.logger.debug("Checking solvability...")
        solvability_result = await self._check_solvability(routing_plan, dag)
        if not solvability_result["passed"]:
            result.passed = False
            result.solvability_passed = False
            result.issues.extend(solvability_result["issues"])
            self.logger.warning(f"Solvability check FAILED: {len(solvability_result['issues'])} issues")

        # Principle 2: Completeness
        self.logger.debug("Checking completeness...")
        completeness_result = self._check_completeness(routing_plan, dag)
        if not completeness_result["passed"]:
            result.passed = False
            result.completeness_passed = False
            result.issues.extend(completeness_result["issues"])
            self.logger.warning(f"Completeness check FAILED: {len(completeness_result['issues'])} issues")

        # Principle 3: Non-redundancy
        self.logger.debug("Checking non-redundancy...")
        redundancy_result = self._check_redundancy(routing_plan, dag)
        if not redundancy_result["passed"]:
            result.passed = False
            result.redundancy_passed = False
            result.warnings.extend(redundancy_result["warnings"])
            self.logger.info(f"Redundancy check flagged {len(redundancy_result['warnings'])} warnings")

        # DAAO Phase 2: Budget validation
        if max_budget is not None:
            self.logger.debug(f"Checking budget constraint (max=${max_budget:.4f})...")
            budget_result = self._check_budget(routing_plan, max_budget)
            if not budget_result["passed"]:
                result.passed = False
                result.issues.extend(budget_result["issues"])
                self.logger.warning(f"Budget constraint violated: {budget_result['issues']}")

        # Phase 3: Security checks (cycle detection, depth limits)
        self.logger.debug("Checking security constraints...")
        security_result = self._check_security(dag)
        if not security_result["passed"]:
            result.passed = False
            result.issues.extend(security_result["issues"])
            result.warnings.extend(security_result.get("warnings", []))
            self.logger.warning(f"Security check FAILED: {len(security_result['issues'])} issues")

        # Optional WaltzRL DIR validation
        if dir_report:
            thresholds = DEFAULT_DIR_THRESHOLDS.copy()
            if dir_thresholds:
                thresholds.update(dir_thresholds)

            dir_passed = True
            reward_stats = dir_report.get("reward_stats", {})
            component_averages = dir_report.get("component_averages", {})
            improvements = dir_report.get("improvements", {})

            mean_reward = reward_stats.get("mean", 0.0)
            positive_rate = reward_stats.get("positive_rate", 0.0)
            safety_delta = component_averages.get("safety_delta", 0.0)

            if mean_reward < thresholds["min_reward_mean"]:
                result.issues.append(
                    f"DIR reward mean {mean_reward:.2f} below threshold "
                    f"{thresholds['min_reward_mean']:.2f}"
                )
                dir_passed = False

            if positive_rate < thresholds["min_positive_rate"]:
                result.issues.append(
                    f"DIR positive reward rate {positive_rate:.2f} below threshold "
                    f"{thresholds['min_positive_rate']:.2f}"
                )
                dir_passed = False

            if safety_delta < thresholds["min_safety_delta"]:
                result.issues.append(
                    f"Average safety improvement {safety_delta:.3f} below threshold "
                    f"{thresholds['min_safety_delta']:.3f}"
                )
                dir_passed = False

            unsafe_reduction = improvements.get("unsafe_reduction")
            if unsafe_reduction is not None and unsafe_reduction < thresholds["target_unsafe_reduction"]:
                result.issues.append(
                    f"Unsafe reduction {unsafe_reduction:.2f} below target "
                    f"{thresholds['target_unsafe_reduction']:.2f}"
                )
                dir_passed = False

            overrefusal_reduction = improvements.get("overrefusal_reduction")
            if overrefusal_reduction is not None and overrefusal_reduction < thresholds["target_overrefusal_reduction"]:
                result.issues.append(
                    f"Over-refusal reduction {overrefusal_reduction:.2f} below target "
                    f"{thresholds['target_overrefusal_reduction']:.2f}"
                )
                dir_passed = False

            if unsafe_reduction is None or overrefusal_reduction is None:
                result.warnings.append(
                    "DIR report missing comparative metrics; unable to verify reduction targets"
                )

            result.dir_validation_passed = dir_passed
            result.dir_report = dir_report

            if not dir_passed:
                result.passed = False
                self.logger.warning("DIR validation FAILED", extra={"dir_report": dir_report})
            else:
                self.logger.info("DIR validation passed", extra={"dir_report": dir_report})

        # Calculate quality score (from ORCHESTRATION_DESIGN.md reward model)
        if result.passed:
            result.quality_score = await self._calculate_quality_score(routing_plan, dag)
            self.logger.info(f"Validation PASSED (quality_score={result.quality_score:.3f})")
        else:
            self.logger.error(f"Validation FAILED: {len(result.issues)} issues")

        return result

    async def _check_solvability(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> Dict[str, Any]:
        """
        Principle 1: Can the assigned agent actually solve this task?

        Checks:
        - Agent exists in registry (if registry is populated)
        - Agent supports the task type (if registry has capability info)
        - Agent has required skills (if specified)

        RELAXED MODE: If agent_registry is empty, validation passes automatically
        (assumes HALO has done intelligent routing)

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG with task requirements

        Returns:
            Dict with "passed" (bool) and "issues" (List[str])
        """
        issues = []

        # HIGH PRIORITY FIX: Disable "Relaxed Mode" in production
        import os
        if not self.agent_registry:
            if os.getenv("ENVIRONMENT") == "production":
                # CRITICAL: In production, require agent registry for validation
                raise RuntimeError(
                    "CRITICAL SECURITY: AOPValidator 'Relaxed Mode' is disabled in production. "
                    "Agent registry must be populated to validate routing plans. "
                    "Unvalidated plans cannot be executed in production."
                )
            else:
                # Development: Allow relaxed mode with warning
                self.logger.warning(
                    "Agent registry empty - skipping solvability validation (trust HALO routing). "
                    "This is only allowed in development. Production requires agent registry."
                )
                return {
                    "passed": True,
                    "issues": []
                }

        for task_id, agent_name in routing_plan.assignments.items():
            if task_id not in dag.tasks:
                issues.append(f"Task {task_id}: Not found in DAG")
                continue

            task = dag.tasks[task_id]
            agent_cap = self.agent_registry.get(agent_name)

            if not agent_cap:
                # RELAXED: Warn but don't fail if agent not in registry
                self.logger.warning(
                    f"Task {task_id} ({task.task_type}): "
                    f"Agent '{agent_name}' not in registry (may be dynamically loaded)"
                )
                continue  # Don't add to issues - just warn

            # Check if agent supports this task type
            if task.task_type not in agent_cap.supported_task_types:
                issues.append(
                    f"Task {task_id} (type={task.task_type}): "
                    f"Agent '{agent_name}' doesn't support this type. "
                    f"Supports: {agent_cap.supported_task_types}"
                )

            # Optional: Check required skills (if task metadata specifies them)
            required_skills = task.metadata.get("required_skills", [])
            if required_skills:
                missing_skills = set(required_skills) - set(agent_cap.skills)
                if missing_skills:
                    # RELAXED: Warn but don't fail on missing skills
                    self.logger.warning(
                        f"Task {task_id}: Agent '{agent_name}' missing skills: {missing_skills}"
                    )

        return {
            "passed": len(issues) == 0,
            "issues": issues
        }

    def _check_completeness(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> Dict[str, Any]:
        """
        Principle 2: Are all tasks in the DAG covered by agent assignments?

        Checks:
        - Every task in DAG has an agent assignment
        - No unassigned tasks

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG with all tasks

        Returns:
            Dict with "passed" (bool) and "issues" (List[str])
        """
        issues = []

        all_task_ids = set(dag.get_all_task_ids())
        assigned_task_ids = set(routing_plan.assignments.keys())

        missing_tasks = all_task_ids - assigned_task_ids

        if missing_tasks:
            issues.append(
                f"Incomplete coverage: {len(missing_tasks)} tasks unassigned: {list(missing_tasks)}"
            )

        # Also check routing_plan.unassigned_tasks field
        if routing_plan.unassigned_tasks:
            issues.append(
                f"Routing plan has {len(routing_plan.unassigned_tasks)} unassigned tasks: "
                f"{routing_plan.unassigned_tasks}"
            )

        # Check for orphaned assignments (assigned but not in DAG)
        orphaned_assignments = assigned_task_ids - all_task_ids
        if orphaned_assignments:
            issues.append(
                f"Orphaned assignments: {len(orphaned_assignments)} tasks assigned but not in DAG: "
                f"{list(orphaned_assignments)}"
            )

        return {
            "passed": len(issues) == 0,
            "issues": issues
        }

    def _check_redundancy(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> Dict[str, Any]:
        """
        Principle 3: Are multiple agents doing duplicate work?

        Checks:
        - No two tasks with same (agent, task_type, similar description)
        - Flags potential redundancy for human review

        Note: This is a heuristic check. Some duplication may be intentional
        (e.g., multiple test tasks, multiple deploy tasks). Generates warnings
        rather than hard failures.

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG with task details

        Returns:
            Dict with "passed" (bool) and "warnings" (List[str])
        """
        warnings = []

        # Group tasks by (agent, task_type)
        task_groups: Dict[tuple, List[str]] = {}

        for task_id, agent_name in routing_plan.assignments.items():
            if task_id not in dag.tasks:
                continue

            task = dag.tasks[task_id]
            key = (agent_name, task.task_type)

            if key not in task_groups:
                task_groups[key] = []
            task_groups[key].append(task_id)

        # Check for potential duplicates
        for (agent_name, task_type), task_ids in task_groups.items():
            if len(task_ids) > 1:
                # Multiple tasks of same type assigned to same agent
                # This might be okay (e.g., multiple unit test tasks)
                # But flag for review
                warnings.append(
                    f"Potential redundancy: Agent '{agent_name}' has {len(task_ids)} "
                    f"'{task_type}' tasks: {task_ids}. "
                    f"Verify these are not duplicates."
                )

                # Additional check: similar descriptions
                descriptions = [dag.tasks[tid].description for tid in task_ids]
                if self._has_similar_descriptions(descriptions):
                    warnings.append(
                        f"  → Tasks {task_ids} have similar descriptions. "
                        f"High probability of redundancy."
                    )

        # Non-redundancy warnings don't fail validation (just FYI)
        # Unless there are HIGH confidence duplicates
        high_confidence_duplicates = sum(
            1 for w in warnings if "High probability" in w
        )

        return {
            "passed": high_confidence_duplicates == 0,
            "warnings": warnings
        }

    def _has_similar_descriptions(self, descriptions: List[str]) -> bool:
        """
        Check if descriptions are suspiciously similar

        Simple heuristic: Check for exact matches or high word overlap
        """
        if len(descriptions) < 2:
            return False

        # Check exact matches
        unique_descriptions = set(descriptions)
        if len(unique_descriptions) < len(descriptions):
            return True  # Duplicate descriptions found

        # Check word overlap (simple Jaccard similarity)
        def tokenize(s: str) -> Set[str]:
            return set(s.lower().split())

        for i in range(len(descriptions)):
            for j in range(i + 1, len(descriptions)):
                words_i = tokenize(descriptions[i])
                words_j = tokenize(descriptions[j])

                if len(words_i) == 0 or len(words_j) == 0:
                    continue

                overlap = len(words_i & words_j)
                union = len(words_i | words_j)
                jaccard = overlap / union if union > 0 else 0

                if jaccard > 0.7:  # 70% word overlap = suspicious
                    return True

        return False

    def _check_budget(
        self,
        routing_plan: RoutingPlan,
        max_budget: float
    ) -> Dict[str, Any]:
        """
        DAAO Phase 2: Check if routing plan fits within budget

        Uses estimated cost from DAAO optimization metadata if available,
        otherwise issues a warning.

        Args:
            routing_plan: Routing plan (possibly DAAO-optimized)
            max_budget: Maximum allowed budget in USD

        Returns:
            Dict with "passed" (bool) and "issues" (List[str])
        """
        issues = []

        # Check if DAAO optimization metadata is available
        estimated_cost = routing_plan.metadata.get("estimated_cost")

        if estimated_cost is None:
            # No cost estimate available - cannot validate budget
            issues.append(
                f"Budget validation requested but no cost estimate available. "
                f"Enable DAAO optimization to get cost estimates."
            )
            return {"passed": False, "issues": issues}

        # Validate budget
        if estimated_cost > max_budget:
            issues.append(
                f"Estimated cost ${estimated_cost:.4f} exceeds budget ${max_budget:.4f} "
                f"(overage: ${estimated_cost - max_budget:.4f})"
            )

        return {
            "passed": len(issues) == 0,
            "issues": issues
        }

    def _check_security(self, dag: TaskDAG) -> Dict[str, Any]:
        """
        Phase 3: Security checks on DAG structure

        Checks:
        1. Cycle detection (prevents infinite loops)
        2. Depth limits (prevents stack overflow)
        3. Node count limits (prevents resource exhaustion)

        Args:
            dag: Task DAG from HTDAG decomposition

        Returns:
            Dict with "passed" (bool), "issues" (List[str]), "warnings" (List[str])
        """
        from infrastructure.security_utils import detect_dag_cycle, validate_dag_depth

        issues = []
        warnings = []

        # Build adjacency list from DAG
        adjacency_list = {}
        for task in dag.get_all_tasks():
            task_id = task.task_id
            dependencies = task.dependencies if hasattr(task, 'dependencies') else []
            adjacency_list[task_id] = dependencies if dependencies else []

        # Check 1: Cycle detection
        has_cycle, cycle_path = detect_dag_cycle(adjacency_list)
        if has_cycle:
            issues.append(
                f"DAG contains cycle: {' → '.join(cycle_path)}. "
                f"Cyclic dependencies will cause infinite loops."
            )
            self.logger.error(f"Cycle detected in DAG: {cycle_path}")

        # Check 2: Depth validation (max 10 levels by default)
        # Only check depth if no cycle (cycle causes infinite recursion)
        if not has_cycle:
            max_depth = 10
            is_depth_ok, actual_depth = validate_dag_depth(adjacency_list, max_depth)
            if not is_depth_ok:
                issues.append(
                    f"DAG depth ({actual_depth}) exceeds maximum ({max_depth}). "
                    f"Excessive depth may cause stack overflow."
                )
                self.logger.error(f"DAG depth limit exceeded: {actual_depth} > {max_depth}")
            elif actual_depth > 5:
                # Warning for moderately deep DAGs
                warnings.append(
                    f"DAG depth is {actual_depth} (approaching limit of {max_depth}). "
                    f"Consider simplifying task decomposition."
                )

        # Check 3: Node count validation (max 100 nodes by default)
        max_nodes = 100
        node_count = len(adjacency_list)
        if node_count > max_nodes:
            issues.append(
                f"DAG has {node_count} nodes, exceeds maximum ({max_nodes}). "
                f"Too many tasks may cause resource exhaustion."
            )
            self.logger.error(f"DAG node count limit exceeded: {node_count} > {max_nodes}")
        elif node_count > 50:
            # Warning for large DAGs
            warnings.append(
                f"DAG has {node_count} nodes (approaching limit of {max_nodes}). "
                f"Consider reducing task granularity."
            )

        return {
            "passed": len(issues) == 0,
            "issues": issues,
            "warnings": warnings
        }

    async def _calculate_quality_score(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> float:
        """
        Calculate routing plan quality using reward model

        Formula (from ORCHESTRATION_DESIGN.md lines 683-732):
        score = 0.4 × P(success) + 0.3 × quality + 0.2 × (1 - cost) + 0.1 × (1 - time)

        Components:
        - P(success): Probability all agents succeed (product of success rates)
        - quality: Agent-task skill match quality (average overlap)
        - cost: Normalized cost efficiency (0=free, 1=max budget)
        - time: Normalized time efficiency (0=instant, 1=deadline)

        Args:
            routing_plan: Validated routing plan
            dag: Task DAG

        Returns:
            Quality score in [0.0, 1.0]
        """

        # Component 1: Success probability (0.4 weight)
        success_prob = self._estimate_success_probability(routing_plan, dag)

        # Component 2: Quality score (0.3 weight)
        quality = self._estimate_quality_score(routing_plan, dag)

        # Component 3: Cost efficiency (0.2 weight)
        cost = self._normalize_cost(routing_plan, dag)

        # Component 4: Time efficiency (0.1 weight)
        time = self._normalize_time(routing_plan, dag)

        # Weighted formula (from ORCHESTRATION_DESIGN.md line 721)
        score = (
            self.weight_success * success_prob +
            self.weight_quality * quality +
            self.weight_cost * (1 - cost) +
            self.weight_time * (1 - time)
        )

        self.logger.debug(
            f"Quality score components: "
            f"success={success_prob:.2f}, quality={quality:.2f}, "
            f"cost={cost:.2f}, time={time:.2f} → score={score:.3f}"
        )

        return score

    def _estimate_success_probability(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> float:
        """
        Estimate probability that all agents will succeed

        Approach (from ORCHESTRATION_DESIGN.md lines 734-763):
        - P(plan success) = product of individual agent success rates
        - Uses historical success rates from agent registry
        - Conservative default: 0.7 if no history

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG

        Returns:
            Probability in [0.0, 1.0]
        """
        probabilities = []

        for task_id, agent_name in routing_plan.assignments.items():
            agent_cap = self.agent_registry.get(agent_name)

            if agent_cap and agent_cap.success_rate > 0:
                probabilities.append(agent_cap.success_rate)
            else:
                # Conservative default (from ORCHESTRATION_DESIGN.md line 754)
                probabilities.append(0.7)

        # Product of probabilities (assumes independence)
        # From ORCHESTRATION_DESIGN.md line 758
        overall_prob = math.prod(probabilities) if probabilities else 0.7

        return overall_prob

    def _estimate_quality_score(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> float:
        """
        Estimate quality of agent-task matching

        Approach (from ORCHESTRATION_DESIGN.md lines 765-794):
        - Compare required skills vs agent capabilities
        - Calculate skill overlap (Jaccard similarity)
        - Average across all assignments

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG with task requirements

        Returns:
            Quality score in [0.0, 1.0]
        """
        quality_scores = []

        for task_id, agent_name in routing_plan.assignments.items():
            if task_id not in dag.tasks:
                continue

            task = dag.tasks[task_id]
            agent_cap = self.agent_registry.get(agent_name)

            if not agent_cap:
                quality_scores.append(0.5)  # Unknown agent = medium quality
                continue

            # Check 1: Task type match
            type_match = 1.0 if task.task_type in agent_cap.supported_task_types else 0.0

            # Check 2: Skill overlap (if task specifies required skills)
            required_skills = set(task.metadata.get("required_skills", []))
            agent_skills = set(agent_cap.skills)

            if len(required_skills) == 0:
                skill_match = 1.0  # No requirements = perfect match
            else:
                overlap = len(required_skills & agent_skills)
                skill_match = overlap / len(required_skills)

            # Combined quality: 70% type match, 30% skill match
            quality = 0.7 * type_match + 0.3 * skill_match
            quality_scores.append(quality)

        # Average quality across all assignments
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.5

        return avg_quality

    def _normalize_cost(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> float:
        """
        Normalize cost to [0, 1] range

        Approach (from ORCHESTRATION_DESIGN.md lines 796-811):
        - Aggregate agent costs based on cost_tier
        - 0.0 = free, 1.0 = maximum budget

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG

        Returns:
            Normalized cost in [0.0, 1.0]
        """
        # Cost tier mapping
        cost_map = {
            "cheap": 0.2,
            "medium": 0.5,
            "expensive": 0.9
        }

        costs = []
        for agent_name in routing_plan.assignments.values():
            agent_cap = self.agent_registry.get(agent_name)
            if agent_cap:
                costs.append(cost_map.get(agent_cap.cost_tier, 0.5))
            else:
                costs.append(0.5)  # Default to medium

        # Average cost across agents
        avg_cost = sum(costs) / len(costs) if costs else 0.5

        return avg_cost

    def _normalize_time(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG
    ) -> float:
        """
        Normalize time to [0, 1] range

        Approach (from ORCHESTRATION_DESIGN.md lines 813-823):
        - Estimate based on DAG depth (parallel execution assumed)
        - 0.0 = instant, 1.0 = deadline

        Args:
            routing_plan: Routing plan with agent assignments
            dag: Task DAG

        Returns:
            Normalized time in [0.0, 1.0]
        """
        # Estimate based on DAG depth (critical path length)
        depth = dag.max_depth()

        # Assume max acceptable depth = 10 levels
        max_depth = 10
        normalized = min(depth / max_depth, 1.0)

        return normalized

    def validate_plan(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG,
        max_budget: Optional[float] = None
    ) -> ValidationResult:
        """
        Backward compatibility alias for validate_routing_plan()

        This method exists to support legacy test code that calls validate_plan()
        synchronously instead of the canonical async validate_routing_plan() method.

        Note: This is a synchronous wrapper that internally runs the async method
        using asyncio.run(). For new code, prefer using validate_routing_plan() directly.

        Args:
            routing_plan: Routing plan from HALO router
            dag: Task DAG from HTDAG decomposition
            max_budget: Optional maximum budget in USD

        Returns:
            ValidationResult with pass/fail status and quality score
        """
        import asyncio
        self.logger.debug("validate_plan() called (backward compatibility synchronous wrapper)")

        # Run the async method synchronously
        try:
            # Try to get the current event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an async context, create a new loop
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        self.validate_routing_plan(routing_plan, dag, max_budget)
                    )
                    return future.result()
            else:
                # Not in async context, safe to use asyncio.run()
                return asyncio.run(self.validate_routing_plan(routing_plan, dag, max_budget))
        except RuntimeError:
            # No event loop exists, create one
            return asyncio.run(self.validate_routing_plan(routing_plan, dag, max_budget))

    def get_all_tasks(self, dag: TaskDAG) -> List[Task]:
        """Helper: Get all tasks from DAG"""
        return list(dag.tasks.values())
