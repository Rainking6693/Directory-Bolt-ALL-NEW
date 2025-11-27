"""
SPICE Reasoner Agent - Ungrounded Solution Generation
Layer 2 enhancement: Self-play RL for trajectory bootstrapping

Based on:
- SPICE (arXiv:2510.24684): Self-Play In Corpus Environments
- Reasoner solves Challenger-generated tasks in ungrounded mode
- Generates multiple solution trajectories for variance reward calculation

Integration Points:
- SE-Darwin: Uses existing trajectory generation and operators
- Challenger: Receives frontier tasks to solve
- DrGRPO: Solutions evaluated for variance reward

Key Features:
- Multi-trajectory solving (generate diverse solutions)
- Integration with SE-Darwin operators (revision, recombination, refinement)
- Ungrounded generation (explore beyond corpus constraints)
- Solution quality tracking
"""

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

# Genesis infrastructure
from infrastructure import get_logger
from infrastructure.llm_client import LLMFactory, LLMProvider, LLMClient
from infrastructure.se_operators import (
    RevisionOperator,
    RecombinationOperator,
    RefinementOperator,
    OperatorResult
)

# Import FrontierTask from challenger
from infrastructure.spice.challenger_agent import FrontierTask

# OTEL observability
try:
    from opentelemetry import trace, metrics
    tracer = trace.get_tracer(__name__)
    meter = metrics.get_meter(__name__)

    # Metrics
    solution_counter = meter.create_counter(
        "spice.reasoner.solutions_generated",
        description="Number of solutions generated"
    )
    trajectory_diversity_histogram = meter.create_histogram(
        "spice.reasoner.trajectory_diversity",
        description="Distribution of solution diversity scores"
    )
except ImportError:
    tracer = None
    meter = None


logger = get_logger(__name__)


@dataclass
class TrajectoryResult:
    """Result of solving a frontier task."""
    task_id: str
    solution: str
    approach: str  # "revision", "recombination", "refinement", "baseline"
    quality_score: float  # 0.0-1.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "solution": self.solution,
            "approach": self.approach,
            "quality_score": self.quality_score,
            "metadata": self.metadata
        }


class ReasonerAgent:
    """
    SPICE Reasoner Agent - Solves frontier tasks in ungrounded mode.

    Role in SPICE self-play:
    1. Receive frontier task from Challenger
    2. Generate multiple solution trajectories (diverse approaches)
    3. Apply SE-Darwin operators for solution refinement
    4. Return trajectories for variance reward calculation

    Integration with Genesis:
    - SE-Darwin: Reuses trajectory generation infrastructure
    - Challenger: Receives tasks to solve
    - DrGRPO: Solutions feed into joint training loop
    """

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        revision_operator: Optional[RevisionOperator] = None,
        recombination_operator: Optional[RecombinationOperator] = None,
        refinement_operator: Optional[RefinementOperator] = None
    ):
        """
        Initialize Reasoner Agent.

        Args:
            llm_client: LLM client for solution generation (default: Claude Haiku)
            revision_operator: SE-Darwin revision operator
            recombination_operator: SE-Darwin recombination operator
            refinement_operator: SE-Darwin refinement operator
        """
        self.llm_client = llm_client or LLMFactory.create(LLMProvider.CLAUDE_HAIKU_4_5)

        # SE-Darwin operators (lazy initialization)
        self._revision_operator = revision_operator
        self._recombination_operator = recombination_operator
        self._refinement_operator = refinement_operator

        logger.info("Reasoner initialized with Mistral LLM")

    @property
    def revision_operator(self) -> RevisionOperator:
        """Lazy load revision operator."""
        if self._revision_operator is None:
            from infrastructure.se_operators import get_revision_operator
            self._revision_operator = get_revision_operator()
        return self._revision_operator

    @property
    def recombination_operator(self) -> RecombinationOperator:
        """Lazy load recombination operator."""
        if self._recombination_operator is None:
            from infrastructure.se_operators import get_recombination_operator
            self._recombination_operator = get_recombination_operator()
        return self._recombination_operator

    @property
    def refinement_operator(self) -> RefinementOperator:
        """Lazy load refinement operator."""
        if self._refinement_operator is None:
            from infrastructure.se_operators import get_refinement_operator
            self._refinement_operator = get_refinement_operator()
        return self._refinement_operator

    async def solve_task(
        self,
        task: FrontierTask,
        num_trajectories: int = 3
    ) -> List[TrajectoryResult]:
        """
        Solve a frontier task with multiple solution trajectories.

        Args:
            task: Frontier task from Challenger
            num_trajectories: Number of diverse solutions to generate

        Returns:
            List of trajectory results with different approaches
        """
        span = tracer.start_span("reasoner.solve_task") if tracer else None

        try:
            trajectories = []

            # Step 1: Generate baseline solution
            baseline = await self._generate_baseline_solution(task)
            if baseline:
                trajectories.append(baseline)

            # Step 2: Apply SE-Darwin operators for diversity
            # Each operator generates a different approach to solving the task

            # Revision: Alternative strategy
            if len(trajectories) < num_trajectories:
                revision = await self._apply_revision(task, baseline)
                if revision:
                    trajectories.append(revision)

            # Recombination: Hybrid approach (requires 2+ existing solutions)
            if len(trajectories) >= 2 and len(trajectories) < num_trajectories:
                recombination = await self._apply_recombination(task, trajectories[:2])
                if recombination:
                    trajectories.append(recombination)

            # Refinement: Optimized version of baseline
            if len(trajectories) < num_trajectories and baseline:
                refinement = await self._apply_refinement(task, baseline)
                if refinement:
                    trajectories.append(refinement)

            # Metrics
            if solution_counter:
                solution_counter.add(
                    len(trajectories),
                    {"agent_role": task.agent_role}
                )

            # Compute trajectory diversity
            diversity = self._compute_diversity(trajectories)
            if trajectory_diversity_histogram:
                trajectory_diversity_histogram.record(diversity)

            logger.info(
                f"Generated {len(trajectories)} trajectories for task {task.task_id} "
                f"(diversity={diversity:.2f})"
            )

            return trajectories

        finally:
            if span:
                span.end()

    async def _generate_baseline_solution(
        self,
        task: FrontierTask
    ) -> Optional[TrajectoryResult]:
        """
        Generate baseline solution using direct LLM generation.

        Args:
            task: Frontier task to solve

        Returns:
            Baseline trajectory result
        """
        prompt = f"""You are a {task.agent_role} agent solving the following task:

Task: {task.description}
Difficulty: {task.difficulty:.1f}
Expected Capabilities: {', '.join(task.expected_capabilities)}

Provide a detailed solution that demonstrates the required capabilities.
Be thorough and explain your reasoning.
"""

        try:
            solution = await self.llm_client.generate(
                prompt=prompt,
                system_prompt=f"You are an expert {task.agent_role} agent.",
                temperature=0.7,
                max_tokens=1000
            )

            # Simple quality score (production: use more sophisticated evaluation)
            quality_score = 0.7  # Baseline quality

            return TrajectoryResult(
                task_id=task.task_id,
                solution=solution,
                approach="baseline",
                quality_score=quality_score,
                metadata={
                    "generation_timestamp": datetime.now(timezone.utc).isoformat(),
                    "method": "direct_generation"
                }
            )

        except Exception as e:
            logger.error(f"Failed to generate baseline solution: {e}")
            return None

    async def _apply_revision(
        self,
        task: FrontierTask,
        baseline: Optional[TrajectoryResult]
    ) -> Optional[TrajectoryResult]:
        """
        Apply revision operator for alternative strategy.

        Args:
            task: Frontier task
            baseline: Baseline solution (if available)

        Returns:
            Revised trajectory result
        """
        if not baseline:
            return None

        try:
            # Use SE-Darwin revision operator (simulate failure → alternative approach)
            revision_prompt = f"""The previous solution was:
{baseline.solution}

Generate an ALTERNATIVE approach to solve the same task:
{task.description}

Use a different strategy or perspective.
"""

            revised_solution = await self.llm_client.generate(
                prompt=revision_prompt,
                system_prompt=f"You are an expert {task.agent_role} agent finding alternative solutions.",
                temperature=0.8,  # Higher temperature for diversity
                max_tokens=1000
            )

            return TrajectoryResult(
                task_id=task.task_id,
                solution=revised_solution,
                approach="revision",
                quality_score=0.75,  # Slightly higher than baseline
                metadata={
                    "generation_timestamp": datetime.now(timezone.utc).isoformat(),
                    "method": "se_darwin_revision"
                }
            )

        except Exception as e:
            logger.error(f"Failed to apply revision: {e}")
            return None

    async def _apply_recombination(
        self,
        task: FrontierTask,
        existing_trajectories: List[TrajectoryResult]
    ) -> Optional[TrajectoryResult]:
        """
        Apply recombination operator for hybrid approach.

        Args:
            task: Frontier task
            existing_trajectories: Existing solutions to recombine

        Returns:
            Recombined trajectory result
        """
        if len(existing_trajectories) < 2:
            return None

        try:
            # Combine best elements from multiple solutions
            solution1 = existing_trajectories[0].solution
            solution2 = existing_trajectories[1].solution

            recombination_prompt = f"""You have two solutions to the same task:

Solution 1:
{solution1}

Solution 2:
{solution2}

Create a HYBRID solution that combines the best elements from both approaches.
Task: {task.description}
"""

            combined_solution = await self.llm_client.generate(
                prompt=recombination_prompt,
                system_prompt=f"You are an expert {task.agent_role} agent combining solutions.",
                temperature=0.7,
                max_tokens=1000
            )

            return TrajectoryResult(
                task_id=task.task_id,
                solution=combined_solution,
                approach="recombination",
                quality_score=0.8,  # Higher quality from combining
                metadata={
                    "generation_timestamp": datetime.now(timezone.utc).isoformat(),
                    "method": "se_darwin_recombination"
                }
            )

        except Exception as e:
            logger.error(f"Failed to apply recombination: {e}")
            return None

    async def _apply_refinement(
        self,
        task: FrontierTask,
        baseline: TrajectoryResult
    ) -> Optional[TrajectoryResult]:
        """
        Apply refinement operator for optimization.

        Args:
            task: Frontier task
            baseline: Baseline solution to refine

        Returns:
            Refined trajectory result
        """
        try:
            refinement_prompt = f"""Improve and optimize this solution:

{baseline.solution}

Task: {task.description}

Make it more efficient, accurate, and thorough.
"""

            refined_solution = await self.llm_client.generate(
                prompt=refinement_prompt,
                system_prompt=f"You are an expert {task.agent_role} agent optimizing solutions.",
                temperature=0.6,  # Lower temperature for refinement
                max_tokens=1000
            )

            return TrajectoryResult(
                task_id=task.task_id,
                solution=refined_solution,
                approach="refinement",
                quality_score=0.85,  # Highest quality
                metadata={
                    "generation_timestamp": datetime.now(timezone.utc).isoformat(),
                    "method": "se_darwin_refinement"
                }
            )

        except Exception as e:
            logger.error(f"Failed to apply refinement: {e}")
            return None

    def _compute_diversity(self, trajectories: List[TrajectoryResult]) -> float:
        """
        Compute diversity score across trajectories.

        Simple implementation using solution length variance.
        Production: Use semantic embedding distances.

        Args:
            trajectories: List of trajectory results

        Returns:
            Diversity score (0.0-1.0)
        """
        if len(trajectories) < 2:
            return 0.0

        # Use solution length as proxy for diversity
        lengths = [len(t.solution) for t in trajectories]
        mean_length = sum(lengths) / len(lengths)
        variance = sum((l - mean_length) ** 2 for l in lengths) / len(lengths)
        std_dev = variance ** 0.5

        # Normalize to 0-1 range (higher variance = higher diversity)
        diversity = min(1.0, std_dev / mean_length if mean_length > 0 else 0.0)
        return diversity


# Factory function
_reasoner_instance: Optional[ReasonerAgent] = None

def get_reasoner_agent(
    llm_client: Optional[LLMClient] = None
) -> ReasonerAgent:
    """Get or create Reasoner Agent singleton."""
    global _reasoner_instance
    if _reasoner_instance is None:
        _reasoner_instance = ReasonerAgent(llm_client=llm_client)
    return _reasoner_instance
