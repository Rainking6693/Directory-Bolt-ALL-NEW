"""
AgentEvolver Phase 2: Hybrid Policy (80% Exploit / 20% Explore)

Implements intelligent routing between experience reuse and exploration.

Key Features:
- 80% exploit: Reuse from experience buffer
- 20% explore: Try new approaches
- Track hit rate and success metrics
- Experience transfer between agents

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 2
"""

import asyncio
import logging
import random
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    EXPLOIT_RATIO,
    EXPLORE_RATIO,
    TRAJECTORY_SIMILARITY_THRESHOLD,
)
from infrastructure.agentevolver.experience_buffer import (
    ExperienceBuffer,
    Experience,
    get_experience_buffer,
)
from infrastructure.agentevolver.utils import TimeHelper, MetricsHelper

load_genesis_env()

logger = logging.getLogger(__name__)


class PolicyAction(Enum):
    """Type of action taken by hybrid policy."""
    EXPLOIT = "exploit"  # Reuse experience
    EXPLORE = "explore"  # Try new approach


@dataclass
class PolicyDecision:
    """Decision made by hybrid policy."""
    action: PolicyAction
    task_type: str
    task_description: str
    matched_experience: Optional[Experience] = None
    similarity_score: Optional[float] = None
    rationale: str = ""


@dataclass
class HitMetrics:
    """Metrics for experience reuse success."""
    total_tasks: int = 0
    exploit_tasks: int = 0
    explore_tasks: int = 0
    successful_exploits: int = 0  # Reused experiences that worked
    successful_explores: int = 0  # New approaches that worked
    average_similarity_used: float = 0.0  # Avg similarity of used experiences

    def get_hit_rate(self) -> float:
        """Get success rate of exploit actions (0-1)."""
        if self.exploit_tasks == 0:
            return 0.0
        return self.successful_exploits / self.exploit_tasks

    def get_explore_rate(self) -> float:
        """Get success rate of explore actions (0-1)."""
        if self.explore_tasks == 0:
            return 0.0
        return self.successful_explores / self.explore_tasks

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "total_tasks": self.total_tasks,
            "exploit_tasks": self.exploit_tasks,
            "explore_tasks": self.explore_tasks,
            "successful_exploits": self.successful_exploits,
            "successful_explores": self.successful_explores,
            "hit_rate": self.get_hit_rate(),
            "explore_rate": self.get_explore_rate(),
            "average_similarity_used": self.average_similarity_used,
        }


class HybridPolicy:
    """
    Intelligent routing between experience reuse (exploit) and exploration.

    Allocates 80% of tasks to exploit (reuse from buffer),
    20% to explore (try new approaches).
    """

    def __init__(
        self,
        exploit_ratio: float = EXPLOIT_RATIO,
        explore_ratio: float = EXPLORE_RATIO,
        similarity_threshold: float = TRAJECTORY_SIMILARITY_THRESHOLD,
        experience_buffer: Optional[ExperienceBuffer] = None,
    ):
        """
        Initialize hybrid policy.

        Args:
            exploit_ratio: Fraction of tasks for exploitation (e.g., 0.80)
            explore_ratio: Fraction of tasks for exploration (e.g., 0.20)
            similarity_threshold: Min similarity to consider experience useful
            experience_buffer: Experience buffer to reuse from
        """
        assert (
            exploit_ratio + explore_ratio == 1.0
        ), "exploit_ratio + explore_ratio must equal 1.0"

        self.exploit_ratio = exploit_ratio
        self.explore_ratio = explore_ratio
        self.similarity_threshold = similarity_threshold
        self.buffer = experience_buffer or get_experience_buffer()
        self.metrics = HitMetrics()

        logger.info(
            f"HybridPolicy initialized (exploit={exploit_ratio:.0%}, "
            f"explore={explore_ratio:.0%}, similarity_threshold={similarity_threshold})"
        )

    async def decide(
        self,
        task_type: str,
        task_description: str,
    ) -> PolicyDecision:
        """
        Decide whether to exploit or explore for a given task.

        Args:
            task_type: Type of task (deployment, content, etc.)
            task_description: Description of what to do

        Returns:
            PolicyDecision with action and matched experience (if any)
        """
        self.metrics.total_tasks += 1

        # Probabilistically decide exploit vs explore
        explore_dice = random.random()

        if explore_dice < self.explore_ratio:
            # Explore: try a new approach
            decision = PolicyDecision(
                action=PolicyAction.EXPLORE,
                task_type=task_type,
                task_description=task_description,
                rationale=f"Exploration turn (dice={explore_dice:.2f} < {self.explore_ratio})",
            )
            self.metrics.explore_tasks += 1

        else:
            # Exploit: try to find similar experience
            decision = await self._find_exploit_experience(task_type, task_description)

            if decision.matched_experience is None:
                # No similar experience found, fall back to explore
                decision.action = PolicyAction.EXPLORE
                decision.rationale = "No similar experience found, exploring instead"
                self.metrics.explore_tasks += 1
            else:
                self.metrics.exploit_tasks += 1

        logger.info(
            f"Policy decision: {decision.action.value} "
            f"(task_type={task_type}, similarity={decision.similarity_score})"
        )

        return decision

    async def _find_exploit_experience(
        self,
        task_type: str,
        task_description: str,
    ) -> PolicyDecision:
        """Find a similar experience to reuse."""
        # Search for similar experiences
        similar = await self.buffer.find_similar(
            query_description=task_description,
            task_type=task_type,
            limit=1,  # Just need best match
        )

        if not similar:
            return PolicyDecision(
                action=PolicyAction.EXPLORE,
                task_type=task_type,
                task_description=task_description,
                matched_experience=None,
                similarity_score=0.0,
                rationale="No similar experiences in buffer",
            )

        experience, similarity_score = similar[0]

        if similarity_score < self.similarity_threshold:
            return PolicyDecision(
                action=PolicyAction.EXPLORE,
                task_type=task_type,
                task_description=task_description,
                matched_experience=None,
                similarity_score=similarity_score,
                rationale=f"Similarity {similarity_score:.2f} below threshold {self.similarity_threshold}",
            )

        return PolicyDecision(
            action=PolicyAction.EXPLOIT,
            task_type=task_type,
            task_description=task_description,
            matched_experience=experience,
            similarity_score=similarity_score,
            rationale=f"Found similar experience with similarity={similarity_score:.2f}",
        )

    def record_exploit_success(self, experience_id: str, success: bool) -> None:
        """
        Record success/failure of an exploit action.

        Args:
            experience_id: ID of experience that was reused
            success: Whether the reuse was successful
        """
        if success:
            self.metrics.successful_exploits += 1
        logger.debug(f"Recorded exploit {'success' if success else 'failure'}: {experience_id}")

    def record_explore_success(self, success: bool) -> None:
        """
        Record success/failure of an explore action.

        Args:
            success: Whether the exploration was successful
        """
        if success:
            self.metrics.successful_explores += 1
        logger.debug(f"Recorded explore {'success' if success else 'failure'}")

    def update_similarity_metric(self, similarity: float) -> None:
        """Update average similarity metric."""
        if self.metrics.exploit_tasks == 0:
            return

        # Running average
        old_avg = self.metrics.average_similarity_used
        new_avg = (
            (old_avg * (self.metrics.exploit_tasks - 1) + similarity)
            / self.metrics.exploit_tasks
        )
        self.metrics.average_similarity_used = new_avg

    def get_metrics(self) -> HitMetrics:
        """Get current metrics."""
        return self.metrics

    def print_metrics(self) -> None:
        """Print human-readable metrics."""
        metrics = self.metrics

        print("\n" + "=" * 80)
        print("HYBRID POLICY METRICS")
        print("=" * 80)

        print(f"\nTotal Tasks: {metrics.total_tasks}")
        print(f"Exploit Tasks: {metrics.exploit_tasks} ({metrics.exploit_tasks / max(1, metrics.total_tasks):.1%})")
        print(f"Explore Tasks: {metrics.explore_tasks} ({metrics.explore_tasks / max(1, metrics.total_tasks):.1%})")

        print(f"\nExploit Success Rate: {metrics.get_hit_rate():.1%}")
        print(f"Explore Success Rate: {metrics.get_explore_rate():.1%}")

        print(f"\nAverage Similarity (Exploits): {metrics.average_similarity_used:.3f}")

        print(f"\n✓ Successful Exploits: {metrics.successful_exploits}")
        print(f"✓ Successful Explores: {metrics.successful_explores}")

        print("\n" + "=" * 80 + "\n")


def get_hybrid_policy(
    exploit_ratio: float = EXPLOIT_RATIO,
    explore_ratio: float = EXPLORE_RATIO,
) -> HybridPolicy:
    """Get or create global hybrid policy."""
    return HybridPolicy(
        exploit_ratio=exploit_ratio,
        explore_ratio=explore_ratio,
    )
