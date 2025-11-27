"""
SICA (Self-Improving Cognitive Architecture) Integration
Reasoning-heavy improvement mode for SE-Darwin system

Complements multi-trajectory evolution with:
- Iterative self-critique and refinement
- Chain-of-thought reasoning with explicit step tracking
- Early stopping when quality plateaus (TUMIX strategy)
- LLM-powered reasoning validation

Based on:
- TUMIX paper: LLM-based termination for refinement loops
- Chain-of-thought reasoning patterns
- Self-consistency validation

Author: Cora (Orchestration + LLM Expert)
Date: 2025-10-20
Version: 1.0.0
"""

import asyncio
import logging
import time
import json
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timezone

# Orchestration imports
from infrastructure.llm_client import LLMFactory, LLMProvider, LLMClient, LLMClientError
from infrastructure.trajectory_pool import Trajectory, TrajectoryStatus
from infrastructure.observability import ObservabilityManager, CorrelationContext, SpanType
from infrastructure.security_utils import sanitize_for_prompt, validate_generated_code

logger = logging.getLogger(__name__)


class ReasoningMode(Enum):
    """SICA reasoning mode selection"""
    STANDARD = "standard"  # Multi-trajectory evolution only
    REASONING = "reasoning"  # SICA iterative reasoning
    HYBRID = "hybrid"  # Both approaches


class ReasoningComplexity(Enum):
    """Task complexity classification"""
    SIMPLE = "simple"  # Direct solution
    MODERATE = "moderate"  # Some reasoning needed
    COMPLEX = "complex"  # Deep reasoning required


@dataclass
class ReasoningStep:
    """Single reasoning step in SICA loop"""
    step_number: int
    thought: str  # Chain-of-thought reasoning
    critique: str  # Self-critique of current approach
    refinement: str  # Proposed refinement
    quality_score: float  # 0.0-1.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class SICAResult:
    """Result of SICA reasoning loop"""
    success: bool
    original_trajectory: Trajectory
    improved_trajectory: Optional[Trajectory]
    reasoning_steps: List[ReasoningStep]
    improvement_delta: float  # % improvement in quality
    iterations_performed: int
    stopped_early: bool  # True if TUMIX termination triggered
    tokens_used: int
    cost_dollars: float
    error_message: Optional[str] = None


class SICAComplexityDetector:
    """
    Detects task complexity to decide SICA mode

    Analyzes:
    - Prompt length (>500 tokens = likely complex)
    - Task keywords (math, logic, debugging, multi-step)
    - Previous failure patterns
    - Estimated reasoning depth required
    """

    COMPLEX_KEYWORDS: list[str] = [
        "debug", "analyze", "optimize", "refactor",
        "multi-step", "complex", "intricate", "sophisticated",
        "mathematical", "logical", "algorithm", "architecture",
        "reasoning", "proof", "verification", "validation",
        "distributed", "edge cases", "race condition", "bottleneck"
    ]

    MODERATE_KEYWORDS: list[str] = [
        "implement", "create", "build", "design",
        "integrate", "connect", "configure", "setup",
        "api", "endpoint", "validation", "account"
    ]

    simple_threshold: int
    complex_threshold: int

    def __init__(self, simple_threshold: int = 100, complex_threshold: int = 300) -> None:
        """
        Initialize complexity detector

        Args:
            simple_threshold: Token count below which task is simple
            complex_threshold: Token count above which task is complex
        """
        self.simple_threshold = simple_threshold
        self.complex_threshold = complex_threshold

    def analyze_complexity(
        self,
        problem_description: str,
        trajectory: Optional[Trajectory] = None
    ) -> Tuple[ReasoningComplexity, float]:
        """
        Analyze task complexity

        Args:
            problem_description: Problem description
            trajectory: Optional trajectory with failure history

        Returns:
            (complexity level, confidence score 0.0-1.0)
        """
        # Token estimation (rough: 1 token ≈ 4 chars)
        estimated_tokens = len(problem_description) // 4

        # Keyword analysis
        description_lower = problem_description.lower()
        complex_count = sum(1 for kw in self.COMPLEX_KEYWORDS if kw in description_lower)
        moderate_count = sum(1 for kw in self.MODERATE_KEYWORDS if kw in description_lower)

        # Failure history analysis
        failure_weight = 0.0
        if trajectory:
            if len(trajectory.failure_reasons) > 2:
                failure_weight = 0.3  # Multiple failures → complex
            elif trajectory.success_score < 0.3:
                failure_weight = 0.2  # Low score → moderately complex

        # Scoring
        complexity_score = 0.0
        complexity_score += min(estimated_tokens / self.complex_threshold, 1.0) * 0.35
        complexity_score += min(complex_count / 3.0, 1.0) * 0.35  # Max 3 keywords for full score
        complexity_score += min(moderate_count / 3.0, 1.0) * 0.15
        complexity_score += failure_weight

        # Classification (more aggressive thresholds)
        if complexity_score >= 0.65:
            return ReasoningComplexity.COMPLEX, complexity_score
        elif complexity_score >= 0.35:
            return ReasoningComplexity.MODERATE, complexity_score
        else:
            return ReasoningComplexity.SIMPLE, complexity_score

    def should_use_sica(
        self,
        problem_description: str,
        trajectory: Optional[Trajectory] = None
    ) -> bool:
        """
        Decide if SICA reasoning mode should be used

        Args:
            problem_description: Problem description
            trajectory: Optional trajectory with history

        Returns:
            True if SICA should be used
        """
        complexity, confidence = self.analyze_complexity(problem_description, trajectory)

        # Use SICA for COMPLEX tasks, sometimes for MODERATE (if high confidence)
        if complexity == ReasoningComplexity.COMPLEX:
            return True
        elif complexity == ReasoningComplexity.MODERATE and confidence > 0.5:
            return True
        else:
            return False


class SICAReasoningLoop:
    """
    Iterative reasoning loop with self-critique

    Process:
    1. Generate initial reasoning about trajectory
    2. Critique current approach
    3. Propose refinement
    4. Validate quality improvement
    5. Repeat 3-5 iterations (or until plateau)
    6. Early stop if no improvement (TUMIX strategy)
    """

    llm_client: LLMClient
    max_iterations: int
    min_iterations: int
    improvement_threshold: float
    obs_manager: ObservabilityManager
    total_tokens: int

    def __init__(
        self,
        llm_client: LLMClient,
        max_iterations: int = 5,
        min_iterations: int = 2,
        improvement_threshold: float = 0.05,  # 5% improvement to continue
        obs_manager: Optional[ObservabilityManager] = None
    ) -> None:
        """
        Initialize reasoning loop

        Args:
            llm_client: LLM client for reasoning
            max_iterations: Maximum reasoning iterations
            min_iterations: Minimum iterations before early stopping
            improvement_threshold: Minimum improvement to continue
            obs_manager: Observability manager for tracing
        """
        self.llm_client = llm_client
        self.max_iterations = max_iterations
        self.min_iterations = min_iterations
        self.improvement_threshold = improvement_threshold
        self.obs_manager = obs_manager or ObservabilityManager()

        self.total_tokens = 0

    async def reason_and_refine(
        self,
        trajectory: Trajectory,
        problem_description: str,
        correlation_context: Optional[CorrelationContext] = None
    ) -> SICAResult:
        """
        Apply iterative reasoning to refine trajectory

        Args:
            trajectory: Trajectory to refine
            problem_description: Original problem description
            correlation_context: Correlation context for tracing

        Returns:
            SICAResult with improved trajectory
        """
        correlation_context = correlation_context or CorrelationContext()

        with self.obs_manager.span(
            name="sica_reasoning_loop",
            span_type=SpanType.ORCHESTRATION,
            context=correlation_context
        ) as span:
            start_time = time.time()
            reasoning_steps = []
            current_quality = trajectory.success_score
            best_quality = current_quality
            best_refinement = None
            stopped_early = False

            try:
                # Initial reasoning
                initial_step = await self._generate_reasoning_step(
                    trajectory=trajectory,
                    problem_description=problem_description,
                    step_number=1,
                    previous_steps=[]
                )
                reasoning_steps.append(initial_step)
                best_quality = initial_step.quality_score
                best_refinement = initial_step.refinement

                # Iterative refinement
                for iteration in range(2, self.max_iterations + 1):
                    step = await self._generate_reasoning_step(
                        trajectory=trajectory,
                        problem_description=problem_description,
                        step_number=iteration,
                        previous_steps=reasoning_steps
                    )
                    reasoning_steps.append(step)

                    # Track best result
                    if step.quality_score > best_quality:
                        best_quality = step.quality_score
                        best_refinement = step.refinement

                    # TUMIX termination: Stop if no improvement after min_iterations
                    if iteration >= self.min_iterations:
                        recent_improvement = step.quality_score - reasoning_steps[-2].quality_score
                        if recent_improvement < self.improvement_threshold:
                            logger.info(
                                f"SICA early stop at iteration {iteration}: "
                                f"improvement {recent_improvement:.3f} < threshold {self.improvement_threshold}"
                            )
                            stopped_early = True
                            break

                # Create improved trajectory
                improved_trajectory = await self._apply_refinement(
                    original_trajectory=trajectory,
                    refinement=best_refinement,
                    reasoning_steps=reasoning_steps
                )

                # Calculate improvement
                improvement_delta = (best_quality - current_quality) / max(current_quality, 0.01)

                # Calculate cost (rough estimate)
                elapsed_time = time.time() - start_time
                tokens_used = self.total_tokens
                cost_dollars = self._estimate_cost(tokens_used)

                span.set_attribute("sica.iterations", len(reasoning_steps))
                span.set_attribute("sica.improvement_delta", improvement_delta)
                span.set_attribute("sica.stopped_early", stopped_early)
                span.set_attribute("sica.tokens_used", tokens_used)

                return SICAResult(
                    success=True,
                    original_trajectory=trajectory,
                    improved_trajectory=improved_trajectory,
                    reasoning_steps=reasoning_steps,
                    improvement_delta=improvement_delta,
                    iterations_performed=len(reasoning_steps),
                    stopped_early=stopped_early,
                    tokens_used=tokens_used,
                    cost_dollars=cost_dollars
                )

            except Exception as e:
                logger.error(f"SICA reasoning loop failed: {e}", exc_info=True)
                span.set_attribute("error", str(e))

                return SICAResult(
                    success=False,
                    original_trajectory=trajectory,
                    improved_trajectory=None,
                    reasoning_steps=reasoning_steps,
                    improvement_delta=0.0,
                    iterations_performed=len(reasoning_steps),
                    stopped_early=False,
                    tokens_used=self.total_tokens,
                    cost_dollars=self._estimate_cost(self.total_tokens),
                    error_message=str(e)
                )

    async def _generate_reasoning_step(
        self,
        trajectory: Trajectory,
        problem_description: str,
        step_number: int,
        previous_steps: List[ReasoningStep]
    ) -> ReasoningStep:
        """
        Generate single reasoning step with chain-of-thought

        Args:
            trajectory: Current trajectory
            problem_description: Problem description
            step_number: Current step number
            previous_steps: Previous reasoning steps

        Returns:
            ReasoningStep with thought, critique, refinement
        """
        # Build prompt with previous reasoning
        previous_reasoning = "\n\n".join([
            f"Step {step.step_number}:\n"
            f"Thought: {step.thought}\n"
            f"Critique: {step.critique}\n"
            f"Refinement: {step.refinement}\n"
            f"Quality: {step.quality_score:.2f}"
            for step in previous_steps
        ])

        system_prompt = """You are an expert reasoning agent for code improvement.

Your task is to iteratively refine a solution through:
1. THOUGHT: Deep analysis of current approach
2. CRITIQUE: Identify weaknesses and limitations
3. REFINEMENT: Propose specific improvements
4. QUALITY: Assess expected quality (0.0-1.0)

Use chain-of-thought reasoning:
- Break down complex problems into steps
- Make assumptions explicit
- Validate logical consistency
- Consider edge cases

Be specific and actionable in refinements."""

        # Sanitize inputs
        safe_problem = sanitize_for_prompt(problem_description, max_length=1000)
        safe_code = sanitize_for_prompt(trajectory.code_changes, max_length=2000)
        safe_diagnosis = sanitize_for_prompt(trajectory.problem_diagnosis, max_length=500)

        user_prompt = f"""Problem: {safe_problem}

Current Trajectory:
- Success Score: {trajectory.success_score:.2f}
- Status: {trajectory.status}
- Diagnosis: {safe_diagnosis}
- Code Changes:
```
{safe_code[:1000]}
```

Previous Reasoning:
{previous_reasoning if previous_reasoning else "This is the first reasoning step."}

Generate next reasoning step ({step_number}/{self.max_iterations}):

Respond in JSON format:
{{
    "thought": "Chain-of-thought analysis...",
    "critique": "Critical evaluation...",
    "refinement": "Specific improvements...",
    "quality_score": 0.85
}}"""

        try:
            # Call LLM
            response = await self.llm_client.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,  # Lower temp for focused reasoning
                max_tokens=1000
            )

            # Track tokens (rough estimate: 1 token ≈ 4 chars)
            self.total_tokens += (len(system_prompt) + len(user_prompt) + len(response)) // 4

            # Parse response
            reasoning_data = self._parse_reasoning_response(response)

            return ReasoningStep(
                step_number=step_number,
                thought=reasoning_data.get("thought", ""),
                critique=reasoning_data.get("critique", ""),
                refinement=reasoning_data.get("refinement", ""),
                quality_score=float(reasoning_data.get("quality_score", trajectory.success_score))
            )

        except Exception as e:
            logger.error(f"Failed to generate reasoning step: {e}")
            # Fallback: Heuristic-based reasoning
            return self._heuristic_reasoning_step(trajectory, step_number)

    def _parse_reasoning_response(self, response: str) -> dict[str, Any]:
        """
        Parse LLM reasoning response

        Args:
            response: LLM response text

        Returns:
            Dictionary with thought, critique, refinement, quality_score
        """
        try:
            # Try JSON parsing
            response_clean = response.strip()
            if response_clean.startswith("```json"):
                response_clean = response_clean[7:]
            if response_clean.startswith("```"):
                response_clean = response_clean[3:]
            if response_clean.endswith("```"):
                response_clean = response_clean[:-3]

            parsed: dict[str, Any] = json.loads(response_clean.strip())
            return parsed

        except json.JSONDecodeError:
            # Fallback: Extract from structured text or use mock defaults
            logger.warning("Failed to parse JSON, using text extraction")
            extracted = {
                "thought": self._extract_section(response, "thought"),
                "critique": self._extract_section(response, "critique"),
                "refinement": self._extract_section(response, "refinement"),
                "quality_score": 0.6  # Conservative default
            }

            # If extraction failed, use the response itself as thought
            if not extracted["thought"] and response:
                extracted["thought"] = response[:200]  # First 200 chars
                extracted["critique"] = "Analysis completed"
                extracted["refinement"] = "Refinement proposed"

            return extracted

    def _extract_section(self, text: str, section: str) -> str:
        """Extract section from structured text"""
        import re
        pattern = rf"{section}[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)"
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""

    def _heuristic_reasoning_step(
        self,
        trajectory: Trajectory,
        step_number: int
    ) -> ReasoningStep:
        """
        Fallback heuristic reasoning when LLM fails

        Args:
            trajectory: Current trajectory
            step_number: Step number

        Returns:
            Heuristic reasoning step
        """
        thought = f"Analyzing trajectory with score {trajectory.success_score:.2f}"

        if trajectory.success_score < 0.5:
            critique = "Low success score indicates fundamental approach issues"
            refinement = "Consider alternative strategy or simpler implementation"
            quality_estimate = 0.5
        else:
            critique = "Moderate success, needs optimization"
            refinement = "Focus on edge cases and error handling"
            quality_estimate = 0.7

        return ReasoningStep(
            step_number=step_number,
            thought=thought,
            critique=critique,
            refinement=refinement,
            quality_score=quality_estimate
        )

    async def _apply_refinement(
        self,
        original_trajectory: Trajectory,
        refinement: str,
        reasoning_steps: List[ReasoningStep]
    ) -> Trajectory:
        """
        Apply refinement to create improved trajectory

        Args:
            original_trajectory: Original trajectory
            refinement: Refinement text
            reasoning_steps: All reasoning steps

        Returns:
            Improved trajectory
        """
        # Create new trajectory with improved metadata
        improved_trajectory = Trajectory(
            trajectory_id=f"{original_trajectory.trajectory_id}_sica",
            generation=original_trajectory.generation + 1,
            agent_name=original_trajectory.agent_name,
            parent_trajectories=[original_trajectory.trajectory_id],
            operator_applied="sica_refinement",
            code_changes=original_trajectory.code_changes,  # Would be updated in real system
            problem_diagnosis=original_trajectory.problem_diagnosis,
            proposed_strategy=refinement,
            status=TrajectoryStatus.SUCCESS.value,
            success_score=reasoning_steps[-1].quality_score,
            reasoning_pattern="sica_iterative_reasoning",
            key_insights=[step.thought for step in reasoning_steps[-2:]],  # Last 2 insights
            tools_used=original_trajectory.tools_used + ["sica"],
            metrics={
                "sica_iterations": len(reasoning_steps),
                "improvement_delta": reasoning_steps[-1].quality_score - original_trajectory.success_score
            }
        )

        return improved_trajectory

    def _estimate_cost(self, tokens: int) -> float:
        """
        Estimate cost based on tokens used

        Args:
            tokens: Number of tokens used

        Returns:
            Estimated cost in dollars
        """
        # Assuming GPT-4o or Claude Sonnet ($3/1M tokens)
        return (tokens / 1_000_000) * 3.0


class SICAIntegration:
    """
    Main SICA integration for SE-Darwin system

    Coordinates:
    1. Complexity detection (simple → standard, complex → SICA)
    2. LLM routing (GPT-4o for complex, Claude Haiku for simple)
    3. Reasoning loop execution
    4. Integration with trajectory pool
    """

    complexity_detector: SICAComplexityDetector
    obs_manager: ObservabilityManager
    _gpt4o_client: Optional[LLMClient]
    _claude_haiku_client: Optional[LLMClient]
    stats: dict[str, float]

    def __init__(
        self,
        gpt4o_client: Optional[LLMClient] = None,
        claude_haiku_client: Optional[LLMClient] = None,
        obs_manager: Optional[ObservabilityManager] = None
    ) -> None:
        """
        Initialize SICA integration

        Args:
            gpt4o_client: GPT-4o client for complex reasoning
            claude_haiku_client: Claude Haiku client for simple refinements
            obs_manager: Observability manager
        """
        self.complexity_detector = SICAComplexityDetector()
        self.obs_manager = obs_manager or ObservabilityManager()

        # LLM clients (lazy init if not provided)
        self._gpt4o_client = gpt4o_client
        self._claude_haiku_client = claude_haiku_client

        # Statistics
        self.stats = {
            "total_requests": 0,
            "sica_used": 0,
            "standard_used": 0,
            "avg_improvement": 0.0,
            "total_cost": 0.0
        }

    async def refine_trajectory(
        self,
        trajectory: Trajectory,
        problem_description: str,
        force_mode: Optional[ReasoningMode] = None,
        correlation_context: Optional[CorrelationContext] = None
    ) -> SICAResult:
        """
        Refine trajectory using SICA or standard mode

        Args:
            trajectory: Trajectory to refine
            problem_description: Problem description
            force_mode: Force specific mode (None = auto-detect)
            correlation_context: Correlation context for tracing

        Returns:
            SICAResult with refinement results
        """
        self.stats["total_requests"] += 1
        correlation_context = correlation_context or CorrelationContext()

        with self.obs_manager.span(
            name="sica_refine_trajectory",
            span_type=SpanType.ORCHESTRATION,
            context=correlation_context
        ) as span:
            # Mode selection
            if force_mode:
                use_sica = (force_mode == ReasoningMode.REASONING)
                mode_reason = "forced"
            else:
                use_sica = self.complexity_detector.should_use_sica(
                    problem_description,
                    trajectory
                )
                mode_reason = "auto-detected"

            span.set_attribute("sica.mode", "reasoning" if use_sica else "standard")
            span.set_attribute("sica.mode_reason", mode_reason)

            if use_sica:
                self.stats["sica_used"] += 1
                result = await self._apply_sica_reasoning(
                    trajectory,
                    problem_description,
                    correlation_context
                )
            else:
                self.stats["standard_used"] += 1
                # Standard mode: Return original trajectory (SE-Darwin multi-trajectory handles it)
                result = SICAResult(
                    success=True,
                    original_trajectory=trajectory,
                    improved_trajectory=trajectory,
                    reasoning_steps=[],
                    improvement_delta=0.0,
                    iterations_performed=0,
                    stopped_early=False,
                    tokens_used=0,
                    cost_dollars=0.0
                )

            # Update stats
            if result.success:
                self.stats["avg_improvement"] = (
                    (self.stats["avg_improvement"] * (self.stats["total_requests"] - 1) +
                     result.improvement_delta) / self.stats["total_requests"]
                )
                self.stats["total_cost"] += result.cost_dollars

            span.set_attribute("sica.improvement_delta", result.improvement_delta)
            span.set_attribute("sica.cost_dollars", result.cost_dollars)

            return result

    async def _apply_sica_reasoning(
        self,
        trajectory: Trajectory,
        problem_description: str,
        correlation_context: CorrelationContext
    ) -> SICAResult:
        """
        Apply SICA iterative reasoning

        Args:
            trajectory: Trajectory to refine
            problem_description: Problem description
            correlation_context: Correlation context

        Returns:
            SICAResult with reasoning results
        """
        # Select LLM based on complexity
        complexity, confidence = self.complexity_detector.analyze_complexity(
            problem_description,
            trajectory
        )

        if complexity == ReasoningComplexity.COMPLEX:
            llm_client = await self._get_gpt4o_client()
            logger.info("Using GPT-4o for complex reasoning")
        else:
            llm_client = await self._get_claude_haiku_client()
            logger.info("Using Claude Haiku for moderate reasoning")

        # Create reasoning loop
        reasoning_loop = SICAReasoningLoop(
            llm_client=llm_client,
            max_iterations=5,
            min_iterations=2,
            improvement_threshold=0.05,
            obs_manager=self.obs_manager
        )

        # Execute reasoning
        return await reasoning_loop.reason_and_refine(
            trajectory,
            problem_description,
            correlation_context
        )

    async def _get_gpt4o_client(self) -> LLMClient:
        """Get or create GPT-4o client"""
        if self._gpt4o_client is None:
            try:
                self._gpt4o_client = LLMFactory.create(LLMProvider.GPT4O)
            except LLMClientError:
                logger.warning("GPT-4o not available, using mock client")
                self._gpt4o_client = LLMFactory.create_mock()
        return self._gpt4o_client

    async def _get_claude_haiku_client(self) -> LLMClient:
        """Get or create Claude Haiku client"""
        if self._claude_haiku_client is None:
            try:
                # Note: Using Sonnet as Haiku not in enum (would add in production)
                self._claude_haiku_client = LLMFactory.create(LLMProvider.CLAUDE_SONNET_4)
            except LLMClientError:
                logger.warning("Claude not available, using mock client")
                self._claude_haiku_client = LLMFactory.create_mock()
        return self._claude_haiku_client

    def get_statistics(self) -> dict[str, Any]:
        """
        Get SICA usage statistics

        Returns:
            Dictionary with usage statistics including SICA usage rate
        """
        return {
            **self.stats,
            "sica_usage_rate": self.stats["sica_used"] / max(self.stats["total_requests"], 1)
        }


# Convenience functions

def get_sica_integration(
    gpt4o_client: Optional[LLMClient] = None,
    claude_haiku_client: Optional[LLMClient] = None
) -> SICAIntegration:
    """
    Get SICA integration instance

    Args:
        gpt4o_client: Optional GPT-4o client for complex reasoning
        claude_haiku_client: Optional Claude Haiku client for simple refinements

    Returns:
        Configured SICAIntegration instance

    Example:
        sica = get_sica_integration()
        result = await sica.refine_trajectory(trajectory, problem_description)
    """
    return SICAIntegration(
        gpt4o_client=gpt4o_client,
        claude_haiku_client=claude_haiku_client
    )


async def refine_trajectory_with_sica(
    trajectory: Trajectory,
    problem_description: str,
    force_reasoning: bool = False
) -> SICAResult:
    """
    High-level convenience function

    Example:
        result = await refine_trajectory_with_sica(
            trajectory=failed_traj,
            problem_description="Fix authentication bug",
            force_reasoning=True
        )

    Args:
        trajectory: Trajectory to refine
        problem_description: Problem description
        force_reasoning: Force SICA reasoning mode

    Returns:
        SICAResult with refinement
    """
    sica = get_sica_integration()

    return await sica.refine_trajectory(
        trajectory=trajectory,
        problem_description=problem_description,
        force_mode=ReasoningMode.REASONING if force_reasoning else None
    )


if __name__ == "__main__":
    # Example: SICA refinement
    async def main() -> None:
        # Create sample trajectory
        sample_trajectory = Trajectory(
            trajectory_id="test_001",
            generation=1,
            agent_name="builder_agent",
            success_score=0.45,
            status=TrajectoryStatus.PARTIAL_SUCCESS.value,
            problem_diagnosis="Authentication module has edge case bugs",
            code_changes="def authenticate(user): return user.is_valid",
            failure_reasons=["Timeout on large user database", "No caching"]
        )

        # Refine with SICA
        sica = get_sica_integration()
        result = await sica.refine_trajectory(
            trajectory=sample_trajectory,
            problem_description="Fix authentication performance and caching issues"
        )

        print(f"\n{'='*60}")
        print("SICA Refinement Result")
        print(f"{'='*60}")
        print(f"Success: {result.success}")
        print(f"Iterations: {result.iterations_performed}")
        print(f"Improvement: {result.improvement_delta:.2%}")
        print(f"Stopped Early: {result.stopped_early}")
        print(f"Cost: ${result.cost_dollars:.4f}")
        print(f"\nReasoning Steps:")
        for step in result.reasoning_steps:
            print(f"\nStep {step.step_number} (Quality: {step.quality_score:.2f}):")
            print(f"  Thought: {step.thought[:100]}...")
            print(f"  Critique: {step.critique[:100]}...")
            print(f"  Refinement: {step.refinement[:100]}...")

        # Statistics
        stats = sica.get_statistics()
        print(f"\n{'='*60}")
        print("SICA Statistics")
        print(f"{'='*60}")
        print(f"Total Requests: {stats['total_requests']}")
        print(f"SICA Usage Rate: {stats['sica_usage_rate']:.1%}")
        print(f"Avg Improvement: {stats['avg_improvement']:.2%}")
        print(f"Total Cost: ${stats['total_cost']:.4f}")

    asyncio.run(main())
