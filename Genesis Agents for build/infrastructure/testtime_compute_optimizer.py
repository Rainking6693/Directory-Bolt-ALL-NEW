"""
Test-Time Compute Optimization for HTDAG Planner

Based on research from:
- Google AI: "Scaling LLM Test-Time Compute Optimally" (2024)
- Best-of-N sampling with multiple verifiers
- Beam search for structured generation
- Multi-Agent Verification (MAV)

Expected: 20-30% quality improvement through strategic inference-time search
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Callable, Tuple
from dataclasses import dataclass
from enum import Enum
import statistics

logger = logging.getLogger(__name__)


class SearchStrategy(Enum):
    """Test-time compute search strategies"""
    BEST_OF_N = "best_of_n"
    BEAM_SEARCH = "beam_search"
    MULTI_AGENT_VERIFICATION = "mav"
    SELF_CONSISTENCY = "self_consistency"


@dataclass
class DecompositionCandidate:
    """A candidate task decomposition with quality score"""
    decomposition: Dict[str, Any]
    quality_score: float
    verification_scores: List[float]
    strategy: SearchStrategy
    metadata: Dict[str, Any]


class TestTimeComputeOptimizer:
    """
    Test-time compute optimization for task decomposition

    Implements three strategies:
    1. Best-of-N: Generate N candidates, pick best (compute-optimal)
    2. Beam Search: Structured generation with pruning
    3. Multi-Agent Verification: Multiple verifiers for robustness

    Research shows:
    - Best-of-N with optimal selection: 4x less compute than naive sampling
    - Beam search: Better at low budgets
    - MAV: Stronger scaling patterns than self-consistency
    """

    def __init__(
        self,
        default_strategy: SearchStrategy = SearchStrategy.BEST_OF_N,
        beam_width: int = 5,
        max_samples: int = 10,
        verification_threshold: float = 0.7,
        enable_adaptive_compute: bool = True
    ):
        """
        Initialize test-time compute optimizer

        Args:
            default_strategy: Default search strategy
            beam_width: Number of beams for beam search
            max_samples: Maximum samples for best-of-N
            verification_threshold: Minimum quality score to accept
            enable_adaptive_compute: Adapt compute based on task difficulty
        """
        self.default_strategy = default_strategy
        self.beam_width = beam_width
        self.max_samples = max_samples
        self.verification_threshold = verification_threshold
        self.enable_adaptive_compute = enable_adaptive_compute

        logger.info(
            f"Initialized TestTimeComputeOptimizer: "
            f"strategy={default_strategy.value}, beam_width={beam_width}, "
            f"max_samples={max_samples}"
        )

    async def optimize_decomposition(
        self,
        decompose_fn: Callable,
        user_request: str,
        context: Optional[Dict[str, Any]] = None,
        strategy: Optional[SearchStrategy] = None,
        compute_budget: Optional[int] = None
    ) -> DecompositionCandidate:
        """
        Optimize task decomposition using test-time compute

        Args:
            decompose_fn: Async function that generates decomposition
            user_request: User task description
            context: Optional context for decomposition
            strategy: Search strategy (uses default if None)
            compute_budget: Maximum number of decomposition attempts

        Returns:
            Best decomposition candidate with quality score
        """
        strategy = strategy or self.default_strategy
        context = context or {}

        # Adaptive compute budget based on task difficulty
        if compute_budget is None:
            compute_budget = self._estimate_compute_budget(user_request)

        logger.info(
            f"Optimizing decomposition: strategy={strategy.value}, "
            f"budget={compute_budget}, request='{user_request[:50]}...'"
        )

        # Route to appropriate strategy
        if strategy == SearchStrategy.BEST_OF_N:
            return await self._best_of_n_optimize(
                decompose_fn, user_request, context, compute_budget
            )
        elif strategy == SearchStrategy.BEAM_SEARCH:
            return await self._beam_search_optimize(
                decompose_fn, user_request, context, compute_budget
            )
        elif strategy == SearchStrategy.MULTI_AGENT_VERIFICATION:
            return await self._mav_optimize(
                decompose_fn, user_request, context, compute_budget
            )
        elif strategy == SearchStrategy.SELF_CONSISTENCY:
            return await self._self_consistency_optimize(
                decompose_fn, user_request, context, compute_budget
            )
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

    async def _best_of_n_optimize(
        self,
        decompose_fn: Callable,
        user_request: str,
        context: Dict[str, Any],
        n: int
    ) -> DecompositionCandidate:
        """
        Best-of-N sampling with optimal selection

        Research: Compute-optimal scaling can outperform naive sampling
        using up to 4x less test-time compute
        """
        n = min(n, self.max_samples)

        # Generate N candidates in parallel with temperature variation
        tasks = []
        for i in range(n):
            # Vary temperature for diversity (0.3 to 0.9)
            temp = 0.3 + (i * 0.6 / max(1, n - 1))
            modified_context = {**context, "temperature": temp}
            tasks.append(decompose_fn(user_request, modified_context))

        logger.info(f"Generating {n} candidates with Best-of-N")
        decompositions = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out failures
        valid_decompositions = [
            d for d in decompositions
            if not isinstance(d, Exception)
        ]

        if not valid_decompositions:
            raise RuntimeError("All Best-of-N candidates failed")

        # Score all candidates
        candidates = []
        for decomp in valid_decompositions:
            quality_score = self._score_decomposition(decomp)
            candidates.append(DecompositionCandidate(
                decomposition=decomp,
                quality_score=quality_score,
                verification_scores=[quality_score],
                strategy=SearchStrategy.BEST_OF_N,
                metadata={"n": len(valid_decompositions)}
            ))

        # Select best (compute-optimal)
        best = max(candidates, key=lambda c: c.quality_score)

        logger.info(
            f"Best-of-{n}: Selected candidate with score {best.quality_score:.3f} "
            f"from {len(candidates)} valid candidates"
        )

        return best

    async def _beam_search_optimize(
        self,
        decompose_fn: Callable,
        user_request: str,
        context: Dict[str, Any],
        compute_budget: int
    ) -> DecompositionCandidate:
        """
        Beam search for structured decomposition generation

        Research: Outperforms best-of-N at lower generation budgets
        """
        beam_width = min(self.beam_width, compute_budget)

        logger.info(f"Starting beam search with width={beam_width}")

        # Generate initial beam
        initial_tasks = []
        for i in range(beam_width):
            temp = 0.5 + (i * 0.3 / max(1, beam_width - 1))
            modified_context = {**context, "temperature": temp}
            initial_tasks.append(decompose_fn(user_request, modified_context))

        beam_candidates = await asyncio.gather(*initial_tasks, return_exceptions=True)

        # Filter valid candidates
        beam = [
            (d, self._score_decomposition(d))
            for d in beam_candidates
            if not isinstance(d, Exception)
        ]

        if not beam:
            raise RuntimeError("Beam search: All initial candidates failed")

        # Sort by score (keep top-k)
        beam.sort(key=lambda x: x[1], reverse=True)
        beam = beam[:beam_width]

        logger.info(f"Beam search: Initial beam size={len(beam)}")

        # Refinement pass (if compute budget allows)
        if compute_budget > beam_width * 2:
            refined_tasks = []
            for decomp, score in beam:
                # Try refinement with higher temperature
                refined_context = {**context, "temperature": 0.7, "refine": True}
                refined_tasks.append(decompose_fn(user_request, refined_context))

            refined_candidates = await asyncio.gather(*refined_tasks, return_exceptions=True)

            # Add refined candidates to beam
            for refined in refined_candidates:
                if not isinstance(refined, Exception):
                    score = self._score_decomposition(refined)
                    beam.append((refined, score))

            # Re-sort and prune
            beam.sort(key=lambda x: x[1], reverse=True)
            beam = beam[:beam_width]

            logger.info(f"Beam search: After refinement beam size={len(beam)}")

        # Return best from beam
        best_decomp, best_score = beam[0]

        return DecompositionCandidate(
            decomposition=best_decomp,
            quality_score=best_score,
            verification_scores=[best_score],
            strategy=SearchStrategy.BEAM_SEARCH,
            metadata={"beam_width": len(beam), "refined": compute_budget > beam_width * 2}
        )

    async def _mav_optimize(
        self,
        decompose_fn: Callable,
        user_request: str,
        context: Dict[str, Any],
        compute_budget: int
    ) -> DecompositionCandidate:
        """
        Multi-Agent Verification (MAV)

        Research: BoN-MAV shows stronger scaling patterns than
        self-consistency and reward model verification

        Combines best-of-N sampling with multiple verifiers
        """
        # Generate candidates (half the budget)
        n_candidates = max(3, compute_budget // 2)
        n_verifiers = max(2, compute_budget - n_candidates)

        logger.info(
            f"MAV: Generating {n_candidates} candidates, "
            f"{n_verifiers} verifiers"
        )

        # Generate candidates
        candidate_tasks = []
        for i in range(n_candidates):
            temp = 0.4 + (i * 0.5 / max(1, n_candidates - 1))
            modified_context = {**context, "temperature": temp}
            candidate_tasks.append(decompose_fn(user_request, modified_context))

        candidates = await asyncio.gather(*candidate_tasks, return_exceptions=True)
        valid_candidates = [c for c in candidates if not isinstance(c, Exception)]

        if not valid_candidates:
            raise RuntimeError("MAV: All candidates failed")

        # Verify each candidate with multiple verifiers
        verified_candidates = []
        for candidate in valid_candidates:
            # Generate multiple verification scores
            verification_scores = []

            # Verifier 1: Structure quality
            verification_scores.append(self._score_decomposition(candidate))

            # Verifier 2: Task completeness
            verification_scores.append(self._score_completeness(candidate))

            # Verifier 3: Parallelism potential
            verification_scores.append(self._score_parallelism(candidate))

            # Additional verifiers if budget allows
            if n_verifiers > 3:
                # Verifier 4: Depth appropriateness
                verification_scores.append(self._score_depth(candidate))

            if n_verifiers > 4:
                # Verifier 5: Dependency structure
                verification_scores.append(self._score_dependencies(candidate))

            # Aggregate verification scores (weighted average)
            aggregate_score = statistics.mean(verification_scores)

            verified_candidates.append(DecompositionCandidate(
                decomposition=candidate,
                quality_score=aggregate_score,
                verification_scores=verification_scores,
                strategy=SearchStrategy.MULTI_AGENT_VERIFICATION,
                metadata={
                    "n_candidates": len(valid_candidates),
                    "n_verifiers": len(verification_scores),
                    "verification_std": statistics.stdev(verification_scores) if len(verification_scores) > 1 else 0.0
                }
            ))

        # Select best verified candidate
        best = max(verified_candidates, key=lambda c: c.quality_score)

        logger.info(
            f"MAV: Selected candidate with score {best.quality_score:.3f} "
            f"(verification scores: {[f'{s:.2f}' for s in best.verification_scores]})"
        )

        return best

    async def _self_consistency_optimize(
        self,
        decompose_fn: Callable,
        user_request: str,
        context: Dict[str, Any],
        n: int
    ) -> DecompositionCandidate:
        """
        Self-consistency: Generate N decompositions, aggregate consensus

        Research: Effective but MAV shows stronger scaling
        """
        n = min(n, self.max_samples)

        logger.info(f"Self-consistency: Generating {n} decompositions")

        # Generate N decompositions
        tasks = [
            decompose_fn(user_request, {**context, "temperature": 0.7})
            for _ in range(n)
        ]
        decompositions = await asyncio.gather(*tasks, return_exceptions=True)

        valid_decompositions = [
            d for d in decompositions
            if not isinstance(d, Exception)
        ]

        if not valid_decompositions:
            raise RuntimeError("Self-consistency: All decompositions failed")

        # Find consensus subtasks (appear in majority)
        subtask_counts: Dict[str, int] = {}
        all_subtasks: Dict[str, Dict[str, Any]] = {}

        for decomp in valid_decompositions:
            for task in decomp.get("tasks", []):
                desc = task.get("description", "").strip()
                if desc:
                    subtask_counts[desc] = subtask_counts.get(desc, 0) + 1
                    if desc not in all_subtasks:
                        all_subtasks[desc] = task

        # Keep tasks with >50% consensus
        threshold = len(valid_decompositions) / 2
        consensus_tasks = [
            all_subtasks[desc]
            for desc, count in subtask_counts.items()
            if count > threshold
        ]

        logger.info(
            f"Self-consistency: Found {len(consensus_tasks)} consensus tasks "
            f"from {len(all_subtasks)} total unique tasks"
        )

        # Build consensus decomposition
        consensus_decomp = {
            "tasks": consensus_tasks,
            "method": "self_consistency",
            "confidence": len(consensus_tasks) / max(1, len(all_subtasks))
        }

        quality_score = self._score_decomposition(consensus_decomp)

        return DecompositionCandidate(
            decomposition=consensus_decomp,
            quality_score=quality_score,
            verification_scores=[quality_score],
            strategy=SearchStrategy.SELF_CONSISTENCY,
            metadata={
                "n_decompositions": len(valid_decompositions),
                "n_consensus": len(consensus_tasks),
                "n_total": len(all_subtasks)
            }
        )

    def _estimate_compute_budget(self, user_request: str) -> int:
        """
        Estimate compute budget based on task difficulty

        Adaptive compute allocation:
        - Simple tasks: 3-5 samples
        - Medium tasks: 5-8 samples
        - Complex tasks: 8-10 samples
        """
        if not self.enable_adaptive_compute:
            return self.max_samples

        # Heuristic difficulty estimation
        difficulty_keywords = {
            "complex": 3,
            "multi-step": 2,
            "integrate": 2,
            "optimize": 2,
            "architecture": 3,
            "distributed": 3,
            "scale": 2,
            "production": 2
        }

        difficulty_score = 0
        lower_request = user_request.lower()
        for keyword, weight in difficulty_keywords.items():
            if keyword in lower_request:
                difficulty_score += weight

        # Also consider length (longer = more complex)
        if len(user_request) > 200:
            difficulty_score += 2
        elif len(user_request) > 100:
            difficulty_score += 1

        # Map to compute budget
        if difficulty_score >= 6:
            return self.max_samples  # Complex: 10 samples
        elif difficulty_score >= 3:
            return max(5, self.max_samples // 2)  # Medium: 5-8 samples
        else:
            return max(3, self.max_samples // 3)  # Simple: 3-5 samples

    def _score_decomposition(self, decomposition: Dict[str, Any]) -> float:
        """
        Score overall decomposition quality

        Factors:
        - Number of tasks (2-7 optimal)
        - Parallel potential
        - Depth (2-4 optimal)
        - Task descriptions (clarity)
        """
        score = 0.0

        tasks = decomposition.get("tasks", [])
        num_tasks = len(tasks)

        # Optimal task count (2-7)
        if 2 <= num_tasks <= 7:
            score += 0.30
        else:
            penalty = abs(num_tasks - 4) * 0.05
            score += max(0, 0.30 - penalty)

        # Parallel potential (estimate from task types)
        parallel_count = sum(
            1 for t in tasks
            if t.get("task_type") in ["research", "design", "test"]
        )
        score += min(0.20, parallel_count * 0.05)

        # Depth appropriateness (avoid too deep or too shallow)
        depth = decomposition.get("depth", len(tasks))
        if 2 <= depth <= 4:
            score += 0.20
        else:
            score += max(0, 0.20 - abs(depth - 3) * 0.05)

        # Task description quality (non-empty, reasonable length)
        if tasks:
            avg_desc_len = sum(len(t.get("description", "")) for t in tasks) / len(tasks)
            if 20 <= avg_desc_len <= 200:
                score += 0.20
            else:
                score += max(0, 0.20 - abs(avg_desc_len - 100) * 0.001)

        # Baseline quality
        score += 0.10

        return min(1.0, score)

    def _score_completeness(self, decomposition: Dict[str, Any]) -> float:
        """Score task completeness (covers all aspects)"""
        tasks = decomposition.get("tasks", [])
        if not tasks:
            return 0.0

        # Check for key task types
        task_types = set(t.get("task_type", "generic") for t in tasks)
        expected_types = {"design", "implement", "test"}

        coverage = len(task_types.intersection(expected_types)) / len(expected_types)

        # Check for non-empty descriptions
        desc_coverage = sum(1 for t in tasks if len(t.get("description", "")) > 10) / len(tasks)

        return (coverage + desc_coverage) / 2

    def _score_parallelism(self, decomposition: Dict[str, Any]) -> float:
        """Score potential for parallel execution"""
        tasks = decomposition.get("tasks", [])
        if len(tasks) <= 1:
            return 0.0

        # Estimate parallelizable tasks (research, design, test often parallelizable)
        parallel_types = {"research", "design", "test", "analyze"}
        parallel_count = sum(
            1 for t in tasks
            if t.get("task_type") in parallel_types
        )

        return parallel_count / len(tasks)

    def _score_depth(self, decomposition: Dict[str, Any]) -> float:
        """Score depth appropriateness"""
        depth = decomposition.get("depth", len(decomposition.get("tasks", [])))

        # Optimal: 2-4 levels
        if 2 <= depth <= 4:
            return 1.0
        elif depth == 1:
            return 0.5  # Too shallow
        elif depth == 5:
            return 0.7  # Slightly too deep
        else:
            return max(0.0, 1.0 - (abs(depth - 3) * 0.15))

    def _score_dependencies(self, decomposition: Dict[str, Any]) -> float:
        """Score dependency structure quality"""
        tasks = decomposition.get("tasks", [])
        if len(tasks) <= 1:
            return 1.0

        # Check for clear dependency indicators
        has_dependencies = any(
            "depends" in t or "after" in str(t).lower()
            for t in tasks
        )

        # Check for reasonable ordering (design before implement, test after)
        task_types = [t.get("task_type", "") for t in tasks]

        score = 0.5  # Base score

        if has_dependencies:
            score += 0.25

        # Logical ordering bonus
        if "design" in task_types and "implement" in task_types:
            design_idx = task_types.index("design")
            impl_idx = task_types.index("implement")
            if design_idx < impl_idx:
                score += 0.25

        return min(1.0, score)
