"""
SPICE Challenger Agent - Corpus-Grounded Task Generation
Layer 2 enhancement: Self-play RL for trajectory bootstrapping

Based on:
- SPICE (arXiv:2510.24684): Self-Play In Corpus Environments
- Corpus-grounded task generation prevents hallucination
- Variance rewards for frontier tasks (high diversity = better evolution)

Integration Points:
- SE-Darwin: Generates frontier tasks for trajectory generation
- Zenith: Curriculum-based prompt evolution (7K synthetic traces)
- Swarm: Adversarial team challenges for robustness

Key Features:
- Corpus-grounded task generation (uses Genesis benchmarks + external datasets)
- Difficulty curriculum (0.0-1.0) for progressive learning
- Grounding validation (reject hallucinated tasks)
- Multi-agent task generation (team challenges)
"""

import asyncio
import hashlib
import json
import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Genesis infrastructure
from infrastructure import get_logger
from infrastructure.llm_client import LLMFactory, LLMProvider, LLMClient
from infrastructure.security_utils import sanitize_agent_name, redact_credentials

# OTEL observability
try:
    from opentelemetry import trace, metrics
    tracer = trace.get_tracer(__name__)
    meter = metrics.get_meter(__name__)

    # Metrics
    task_counter = meter.create_counter(
        "spice.challenger.tasks_generated",
        description="Number of frontier tasks generated"
    )
    grounding_score_histogram = meter.create_histogram(
        "spice.challenger.grounding_score",
        description="Distribution of grounding scores (0.0-1.0)"
    )
except ImportError:
    tracer = None
    meter = None


logger = get_logger(__name__)


@dataclass
class GroundingEvidence:
    """Evidence from corpus supporting task generation."""
    corpus_source: str  # "genesis_benchmarks", "nemotron_cc_math", etc.
    reference_task: str  # Original task from corpus
    similarity_score: float  # 0.0-1.0 semantic similarity
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FrontierTask:
    """Generated frontier task for evolution."""
    task_id: str
    description: str
    difficulty: float  # 0.0-1.0
    agent_role: str  # "QA", "Support", "Analyst", etc.
    grounding_evidence: List[GroundingEvidence]
    expected_capabilities: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "description": self.description,
            "difficulty": self.difficulty,
            "agent_role": self.agent_role,
            "grounding_evidence": [
                {
                    "corpus_source": e.corpus_source,
                    "reference_task": e.reference_task,
                    "similarity_score": e.similarity_score,
                    "metadata": e.metadata
                }
                for e in self.grounding_evidence
            ],
            "expected_capabilities": self.expected_capabilities,
            "metadata": self.metadata
        }


class ChallengerAgent:
    """
    SPICE Challenger Agent - Generates corpus-grounded frontier tasks.

    Role in SPICE self-play:
    1. Sample from corpus (Genesis benchmarks, Nemotron-CC-Math, etc.)
    2. Generate task variations with difficulty control
    3. Validate grounding (reject hallucinated tasks)
    4. Return frontier tasks for Reasoner agent to solve

    Integration with Genesis:
    - SE-Darwin: Provides frontier tasks for trajectory generation
    - Zenith: Generates curriculum for prompt evolution
    - Swarm: Creates adversarial team challenges
    """

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        corpus_dir: Optional[Path] = None,
        grounding_threshold: float = 0.7
    ):
        """
        Initialize Challenger Agent.

        Args:
            llm_client: LLM client for task generation (default: Claude Haiku for SPICE)
            corpus_dir: Directory containing benchmark corpora
            grounding_threshold: Minimum similarity for grounding validation (0.0-1.0)
        """
        self.llm_client = llm_client or LLMFactory.create(LLMProvider.CLAUDE_HAIKU_4_5)
        self.corpus_dir = corpus_dir or Path("/home/genesis/genesis-rebuild/benchmarks/scenarios")
        self.grounding_threshold = grounding_threshold

        # Load Genesis benchmark corpus
        self.corpus = self._load_corpus()
        logger.info(
            f"Challenger initialized with {len(self.corpus)} corpus examples "
            f"(grounding threshold={grounding_threshold})"
        )

    def _load_corpus(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Load benchmark corpus from Genesis scenarios.

        Returns:
            Dictionary mapping agent_role → list of benchmark scenarios
        """
        corpus = {}

        if not self.corpus_dir.exists():
            logger.warning(f"Corpus directory not found: {self.corpus_dir}")
            return corpus

        # Load all agent benchmark scenarios
        for scenario_file in self.corpus_dir.glob("*_agent_scenarios.json"):
            agent_role = scenario_file.stem.replace("_agent_scenarios", "").upper()

            try:
                with open(scenario_file, "r") as f:
                    scenarios = json.load(f)
                    corpus[agent_role] = scenarios
                    logger.info(f"Loaded {len(scenarios)} scenarios for {agent_role} agent")
            except Exception as e:
                logger.error(f"Failed to load {scenario_file}: {e}")

        return corpus

    async def generate_frontier_task(
        self,
        agent_role: str,
        difficulty_level: float,
        num_variations: int = 1,
        corpus_source: str = "genesis_benchmarks"
    ) -> List[FrontierTask]:
        """
        Generate frontier tasks for an agent role at a specific difficulty.

        Args:
            agent_role: Target agent role ("QA", "Support", "Analyst", etc.)
            difficulty_level: Task difficulty (0.0=easy, 1.0=expert)
            num_variations: Number of task variations to generate
            corpus_source: Corpus to sample from ("genesis_benchmarks", etc.)

        Returns:
            List of generated frontier tasks with grounding evidence
        """
        span = tracer.start_span("challenger.generate_frontier_task") if tracer else None

        try:
            # Step 1: Sample from corpus based on difficulty
            base_tasks = self._sample_from_corpus(
                agent_role=agent_role,
                difficulty_level=difficulty_level,
                num_samples=num_variations
            )

            if not base_tasks:
                logger.warning(
                    f"No corpus examples found for {agent_role} at difficulty {difficulty_level}"
                )
                return []

            # Step 2: Generate task variations using LLM
            frontier_tasks = []
            for base_task in base_tasks:
                variation = await self._generate_variation(
                    base_task=base_task,
                    agent_role=agent_role,
                    difficulty_level=difficulty_level
                )

                if variation:
                    # Step 3: Validate grounding
                    grounding_score = self._compute_grounding_score(
                        base_task=base_task,
                        variation=variation
                    )

                    if grounding_score >= self.grounding_threshold:
                        # Create frontier task with grounding evidence
                        task = FrontierTask(
                            task_id=self._generate_task_id(agent_role, difficulty_level),
                            description=variation["description"],
                            difficulty=difficulty_level,
                            agent_role=agent_role,
                            grounding_evidence=[
                                GroundingEvidence(
                                    corpus_source=corpus_source,
                                    reference_task=base_task["description"],
                                    similarity_score=grounding_score,
                                    metadata={"scenario_id": base_task.get("scenario_id")}
                                )
                            ],
                            expected_capabilities=variation.get("capabilities", []),
                            metadata={
                                "generation_timestamp": datetime.now(timezone.utc).isoformat(),
                                "corpus_source": corpus_source
                            }
                        )
                        frontier_tasks.append(task)

                        # Metrics
                        if task_counter:
                            task_counter.add(1, {"agent_role": agent_role})
                        if grounding_score_histogram:
                            grounding_score_histogram.record(grounding_score)
                    else:
                        logger.warning(
                            f"Rejected hallucinated task (grounding={grounding_score:.2f} < "
                            f"{self.grounding_threshold})"
                        )

            logger.info(
                f"Generated {len(frontier_tasks)}/{num_variations} frontier tasks for {agent_role} "
                f"at difficulty {difficulty_level}"
            )
            return frontier_tasks

        finally:
            if span:
                span.end()

    def _sample_from_corpus(
        self,
        agent_role: str,
        difficulty_level: float,
        num_samples: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Sample benchmark scenarios from corpus based on difficulty.

        Args:
            agent_role: Target agent role
            difficulty_level: Desired difficulty (0.0-1.0)
            num_samples: Number of samples to return

        Returns:
            List of corpus examples near the target difficulty
        """
        if agent_role not in self.corpus:
            logger.warning(f"No corpus available for {agent_role}")
            return []

        scenarios = self.corpus[agent_role]

        # Filter by difficulty (map 0.0-1.0 to scenario categories)
        if difficulty_level < 0.3:
            category = "basic_functionality"
        elif difficulty_level < 0.6:
            category = "edge_cases"
        elif difficulty_level < 0.8:
            category = "integration"
        else:
            category = "performance"

        # Sample scenarios matching category
        matching = [s for s in scenarios if s.get("category") == category]
        if not matching:
            # Fallback to any scenarios
            matching = scenarios

        # Randomly sample
        return random.sample(matching, min(num_samples, len(matching)))

    async def _generate_variation(
        self,
        base_task: Dict[str, Any],
        agent_role: str,
        difficulty_level: float
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a task variation using LLM.

        Args:
            base_task: Original corpus task
            agent_role: Target agent role
            difficulty_level: Target difficulty

        Returns:
            Generated variation with description and capabilities
        """
        prompt = f"""You are a task generation expert creating frontier tasks for AI agent training.

Base Task (from corpus):
{base_task.get('description', 'N/A')}

Category: {base_task.get('category', 'N/A')}
Agent Role: {agent_role}
Target Difficulty: {difficulty_level:.1f} (0.0=easy, 1.0=expert)

Generate a NEW task that:
1. Is SIMILAR to the base task (preserve core intent)
2. Has the target difficulty level
3. Tests the same capabilities but with different inputs/context
4. Is realistic and grounded (no hallucinated scenarios)

Output JSON format:
{{
  "description": "New task description...",
  "capabilities": ["capability1", "capability2", ...]
}}
"""

        try:
            response = await self.llm_client.generate(
                prompt=prompt,
                system_prompt="You are an expert at generating realistic training tasks.",
                temperature=0.7,  # Higher temperature for diversity
                max_tokens=500
            )

            # Parse JSON response
            variation = json.loads(response)
            return variation

        except Exception as e:
            logger.error(f"Failed to generate variation: {e}")
            return None

    def _compute_grounding_score(
        self,
        base_task: Dict[str, Any],
        variation: Dict[str, Any]
    ) -> float:
        """
        Compute semantic similarity between base task and variation.

        Simple implementation using keyword overlap.
        Production: Use sentence embeddings (e.g., SentenceTransformers).

        Args:
            base_task: Original corpus task
            variation: Generated variation

        Returns:
            Similarity score (0.0-1.0)
        """
        base_text = base_task.get("description", "").lower()
        variation_text = variation.get("description", "").lower()

        # Extract keywords (simple tokenization)
        base_words = set(base_text.split())
        variation_words = set(variation_text.split())

        # Jaccard similarity
        if not base_words or not variation_words:
            return 0.0

        intersection = base_words & variation_words
        union = base_words | variation_words

        similarity = len(intersection) / len(union)
        return similarity

    def _generate_task_id(self, agent_role: str, difficulty: float) -> str:
        """Generate unique task ID."""
        timestamp = datetime.now(timezone.utc).isoformat()
        data = f"{agent_role}_{difficulty}_{timestamp}"
        return hashlib.md5(data.encode()).hexdigest()[:16]


# Factory function
_challenger_instance: Optional[ChallengerAgent] = None

def get_challenger_agent(
    llm_client: Optional[LLMClient] = None,
    corpus_dir: Optional[Path] = None,
    grounding_threshold: float = 0.7
) -> ChallengerAgent:
    """Get or create Challenger Agent singleton."""
    global _challenger_instance
    if _challenger_instance is None:
        _challenger_instance = ChallengerAgent(
            llm_client=llm_client,
            corpus_dir=corpus_dir,
            grounding_threshold=grounding_threshold
        )
    return _challenger_instance
