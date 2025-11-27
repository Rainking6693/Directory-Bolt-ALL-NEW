"""
SPICE DrGRPO Optimizer - Dynamic Reward Group Preference Optimization
Layer 2 enhancement: Joint training for Challenger + Reasoner agents

Based on:
- SPICE (arXiv:2510.24684): Self-Play In Corpus Environments
- DrGRPO: Dynamic Reward Group Preference Optimization
- Variance rewards for frontier tasks (high diversity = better evolution)

Integration Points:
- Challenger: Receives reward signal for task generation quality
- Reasoner: Receives reward signal for solution diversity
- Mistral API: Fine-tuning for both agents

Key Features:
- Variance reward computation (std_dev / mean of solution lengths)
- Joint training loop (both agents improve together)
- Mistral API integration for fine-tuning
- Training data generation and archiving
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Genesis infrastructure
from infrastructure import get_logger
from infrastructure.llm_client import LLMFactory, LLMProvider, LLMClient

# SPICE components
from infrastructure.spice.challenger_agent import ChallengerAgent, FrontierTask
from infrastructure.spice.reasoner_agent import ReasonerAgent, TrajectoryResult

# OTEL observability
try:
    from opentelemetry import trace, metrics
    tracer = trace.get_tracer(__name__)
    meter = metrics.get_meter(__name__)

    # Metrics
    reward_histogram = meter.create_histogram(
        "spice.drgrpo.variance_reward",
        description="Distribution of variance rewards"
    )
    training_step_counter = meter.create_counter(
        "spice.drgrpo.training_steps",
        description="Number of training steps completed"
    )
except ImportError:
    tracer = None
    meter = None


logger = get_logger(__name__)


@dataclass
class TrainingExample:
    """Training example for fine-tuning."""
    input_text: str
    output_text: str
    reward: float
    agent_type: str  # "challenger" or "reasoner"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to Mistral fine-tuning format."""
        return {
            "messages": [
                {"role": "user", "content": self.input_text},
                {"role": "assistant", "content": self.output_text}
            ],
            "reward": self.reward,
            "metadata": self.metadata
        }


@dataclass
class TrainingBatch:
    """Batch of training examples."""
    challenger_examples: List[TrainingExample]
    reasoner_examples: List[TrainingExample]
    avg_variance_reward: float
    batch_id: str
    timestamp: str


class DrGRPOOptimizer:
    """
    Dynamic Reward Group Preference Optimization for SPICE self-play.

    Training Loop:
    1. Challenger generates frontier task
    2. Reasoner solves with multiple trajectories
    3. Compute variance reward (high diversity = good)
    4. Create training examples for both agents
    5. Fine-tune via Mistral API (Stage 1: gather data, Stage 2: fine-tune)

    Integration with Genesis:
    - Uses Mistral API for fine-tuning (confirmed by user)
    - Saves training data for future fine-tuning jobs
    - Tracks performance improvements over time
    """

    def __init__(
        self,
        challenger: Optional[ChallengerAgent] = None,
        reasoner: Optional[ReasonerAgent] = None,
        output_dir: Optional[Path] = None,
        reward_weight: float = 1.0
    ):
        """
        Initialize DrGRPO Optimizer.

        Args:
            challenger: Challenger agent
            reasoner: Reasoner agent
            output_dir: Directory for saving training data
            reward_weight: Weight for variance reward (default: 1.0)
        """
        from infrastructure.spice.challenger_agent import get_challenger_agent
        from infrastructure.spice.reasoner_agent import get_reasoner_agent

        self.challenger = challenger or get_challenger_agent()
        self.reasoner = reasoner or get_reasoner_agent()
        self.output_dir = output_dir or Path("/home/genesis/genesis-rebuild/data/spice_training")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.reward_weight = reward_weight

        self.training_examples: List[TrainingExample] = []
        self.training_history: List[TrainingBatch] = []

        logger.info(
            f"DrGRPO initialized (output_dir={self.output_dir}, "
            f"reward_weight={reward_weight})"
        )

    async def train_step(
        self,
        agent_role: str,
        difficulty_level: float,
        num_tasks: int = 1,
        num_trajectories: int = 3
    ) -> TrainingBatch:
        """
        Execute one SPICE self-play training step.

        Args:
            agent_role: Target agent role ("QA", "Support", etc.)
            difficulty_level: Task difficulty (0.0-1.0)
            num_tasks: Number of tasks to generate
            num_trajectories: Solutions per task

        Returns:
            Training batch with examples for both agents
        """
        span = tracer.start_span("drgrpo.train_step") if tracer else None

        try:
            challenger_examples = []
            reasoner_examples = []
            variance_rewards = []

            # Step 1: Challenger generates frontier tasks
            frontier_tasks = await self.challenger.generate_frontier_task(
                agent_role=agent_role,
                difficulty_level=difficulty_level,
                num_variations=num_tasks
            )

            logger.info(f"Generated {len(frontier_tasks)} frontier tasks")

            # Step 2: For each task, Reasoner generates solutions
            for task in frontier_tasks:
                trajectories = await self.reasoner.solve_task(
                    task=task,
                    num_trajectories=num_trajectories
                )

                if not trajectories:
                    logger.warning(f"No trajectories generated for task {task.task_id}")
                    continue

                # Step 3: Compute variance reward
                variance_reward = self.compute_variance_reward(
                    task=task,
                    trajectories=trajectories
                )
                variance_rewards.append(variance_reward)

                # Metrics
                if reward_histogram:
                    reward_histogram.record(variance_reward)

                logger.info(
                    f"Task {task.task_id}: {len(trajectories)} trajectories, "
                    f"variance_reward={variance_reward:.3f}"
                )

                # Step 4: Create training examples

                # Challenger example (reward for generating diverse task)
                challenger_example = self._create_challenger_example(
                    task=task,
                    variance_reward=variance_reward
                )
                challenger_examples.append(challenger_example)

                # Reasoner examples (reward for diverse solutions)
                for trajectory in trajectories:
                    reasoner_example = self._create_reasoner_example(
                        task=task,
                        trajectory=trajectory,
                        variance_reward=variance_reward
                    )
                    reasoner_examples.append(reasoner_example)

            # Step 5: Create training batch
            avg_variance_reward = (
                sum(variance_rewards) / len(variance_rewards)
                if variance_rewards else 0.0
            )

            batch = TrainingBatch(
                challenger_examples=challenger_examples,
                reasoner_examples=reasoner_examples,
                avg_variance_reward=avg_variance_reward,
                batch_id=self._generate_batch_id(agent_role, difficulty_level),
                timestamp=datetime.now(timezone.utc).isoformat()
            )

            # Step 6: Save training data
            self._save_training_batch(batch)

            # Step 7: Track history
            self.training_examples.extend(challenger_examples)
            self.training_examples.extend(reasoner_examples)
            self.training_history.append(batch)

            # Metrics
            if training_step_counter:
                training_step_counter.add(1, {"agent_role": agent_role})

            logger.info(
                f"Training step complete: {len(challenger_examples)} challenger examples, "
                f"{len(reasoner_examples)} reasoner examples, "
                f"avg_variance_reward={avg_variance_reward:.3f}"
            )

            return batch

        finally:
            if span:
                span.end()

    def compute_variance_reward(
        self,
        task: FrontierTask,
        trajectories: List[TrajectoryResult]
    ) -> float:
        """
        Compute variance reward for a set of trajectories.

        Formula (from SPICE paper):
            variance_reward = (std_dev / mean) * difficulty * grounding_score

        High variance = diverse reasoning = good for evolution.

        Args:
            task: Frontier task
            trajectories: Solution trajectories

        Returns:
            Variance reward (0.0-inf, typically 0.0-2.0)
        """
        if len(trajectories) < 2:
            return 0.0

        # Step 1: Extract solution metrics (using length as proxy for complexity)
        solution_lengths = [len(t.solution) for t in trajectories]

        # Step 2: Compute variance
        mean_length = sum(solution_lengths) / len(solution_lengths)
        variance = sum((l - mean_length) ** 2 for l in solution_lengths) / len(solution_lengths)
        std_dev = variance ** 0.5

        # Step 3: Normalize by mean (coefficient of variation)
        if mean_length == 0:
            cv = 0.0
        else:
            cv = std_dev / mean_length

        # Step 4: Weight by difficulty (harder tasks → higher reward)
        difficulty_weight = task.difficulty

        # Step 5: Weight by grounding (well-grounded tasks → higher reward)
        grounding_score = (
            task.grounding_evidence[0].similarity_score
            if task.grounding_evidence else 0.5
        )

        # Final reward
        variance_reward = cv * difficulty_weight * grounding_score * self.reward_weight

        return variance_reward

    def _create_challenger_example(
        self,
        task: FrontierTask,
        variance_reward: float
    ) -> TrainingExample:
        """
        Create training example for Challenger agent.

        Input: Base task from corpus
        Output: Generated frontier task
        Reward: Variance reward (high = task led to diverse solutions)
        """
        # Extract base task from grounding evidence
        base_task = (
            task.grounding_evidence[0].reference_task
            if task.grounding_evidence else "N/A"
        )

        input_text = f"""Generate a frontier task for {task.agent_role} agent:

Base Task: {base_task}
Difficulty: {task.difficulty:.1f}
"""

        output_text = f"""{task.description}

Expected Capabilities: {', '.join(task.expected_capabilities)}
"""

        return TrainingExample(
            input_text=input_text,
            output_text=output_text,
            reward=variance_reward,
            agent_type="challenger",
            metadata={
                "task_id": task.task_id,
                "agent_role": task.agent_role,
                "difficulty": task.difficulty
            }
        )

    def _create_reasoner_example(
        self,
        task: FrontierTask,
        trajectory: TrajectoryResult,
        variance_reward: float
    ) -> TrainingExample:
        """
        Create training example for Reasoner agent.

        Input: Frontier task
        Output: Solution trajectory
        Reward: Variance reward (high = solution contributed to diversity)
        """
        input_text = f"""Solve this task:

Task: {task.description}
Agent Role: {task.agent_role}
Difficulty: {task.difficulty:.1f}
"""

        output_text = trajectory.solution

        return TrainingExample(
            input_text=input_text,
            output_text=output_text,
            reward=variance_reward * trajectory.quality_score,  # Weight by quality
            agent_type="reasoner",
            metadata={
                "task_id": task.task_id,
                "trajectory_approach": trajectory.approach,
                "quality_score": trajectory.quality_score
            }
        )

    def _save_training_batch(self, batch: TrainingBatch) -> None:
        """Save training batch to disk for future fine-tuning."""
        # Save challenger examples
        challenger_file = self.output_dir / f"challenger_{batch.batch_id}.jsonl"
        with open(challenger_file, "w") as f:
            for example in batch.challenger_examples:
                f.write(json.dumps(example.to_dict()) + "\n")

        # Save reasoner examples
        reasoner_file = self.output_dir / f"reasoner_{batch.batch_id}.jsonl"
        with open(reasoner_file, "w") as f:
            for example in batch.reasoner_examples:
                f.write(json.dumps(example.to_dict()) + "\n")

        # Save batch metadata
        metadata_file = self.output_dir / f"metadata_{batch.batch_id}.json"
        with open(metadata_file, "w") as f:
            json.dump({
                "batch_id": batch.batch_id,
                "timestamp": batch.timestamp,
                "avg_variance_reward": batch.avg_variance_reward,
                "num_challenger_examples": len(batch.challenger_examples),
                "num_reasoner_examples": len(batch.reasoner_examples)
            }, f, indent=2)

        logger.info(
            f"Saved training batch {batch.batch_id} to {self.output_dir} "
            f"({len(batch.challenger_examples) + len(batch.reasoner_examples)} examples)"
        )

    def _generate_batch_id(self, agent_role: str, difficulty: float) -> str:
        """Generate unique batch ID."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        return f"{agent_role.lower()}_{int(difficulty * 10)}_{timestamp}"

    async def fine_tune_agents(
        self,
        min_examples: int = 100,
        mistral_api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fine-tune Challenger and Reasoner agents via Mistral API.

        NOTE: This is a placeholder for Mistral API integration.
        Production: Use Mistral fine-tuning API when ready.

        Args:
            min_examples: Minimum training examples required
            mistral_api_key: Mistral API key (default: from environment)

        Returns:
            Fine-tuning job status
        """
        challenger_count = sum(
            1 for ex in self.training_examples if ex.agent_type == "challenger"
        )
        reasoner_count = sum(
            1 for ex in self.training_examples if ex.agent_type == "reasoner"
        )

        logger.info(
            f"Fine-tuning check: {challenger_count} challenger examples, "
            f"{reasoner_count} reasoner examples (min={min_examples})"
        )

        if challenger_count < min_examples or reasoner_count < min_examples:
            logger.warning(
                f"Not enough examples for fine-tuning. "
                f"Need {min_examples}, have {challenger_count}/{reasoner_count}"
            )
            return {
                "status": "insufficient_data",
                "challenger_count": challenger_count,
                "reasoner_count": reasoner_count,
                "min_required": min_examples
            }

        # TODO: Integrate with Mistral fine-tuning API
        # For now, just save training data
        logger.info(
            f"Training data ready for Mistral fine-tuning: "
            f"{self.output_dir}"
        )

        return {
            "status": "data_ready",
            "challenger_count": challenger_count,
            "reasoner_count": reasoner_count,
            "output_dir": str(self.output_dir)
        }


# Factory function
_drgrpo_instance: Optional[DrGRPOOptimizer] = None

def get_drgrpo_optimizer(
    challenger: Optional[ChallengerAgent] = None,
    reasoner: Optional[ReasonerAgent] = None,
    output_dir: Optional[Path] = None
) -> DrGRPOOptimizer:
    """Get or create DrGRPO Optimizer singleton."""
    global _drgrpo_instance
    if _drgrpo_instance is None:
        _drgrpo_instance = DrGRPOOptimizer(
            challenger=challenger,
            reasoner=reasoner,
            output_dir=output_dir
        )
    return _drgrpo_instance
