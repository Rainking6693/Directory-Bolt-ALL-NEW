"""
AgentEvolver Phase 2: Multi-Agent Experience Sharing

Enables agents to share and transfer successful experiences across domains.

Key Features:
- Deploy Agent learns from previous deployments
- Marketing Agent reuses campaign templates
- Content Agent reuses structures
- Cross-business transfer learning tracking

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 2
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.experience_buffer import (
    ExperienceBuffer,
    Experience,
    get_experience_buffer,
)
from infrastructure.agentevolver.utils import TimeHelper, MetricsHelper

load_genesis_env()

logger = logging.getLogger(__name__)


class AgentType(Enum):
    """Types of agents in Genesis."""
    DEPLOY = "deploy"
    MARKETING = "marketing"
    CONTENT = "content"
    SEO = "seo"
    QA = "qa"
    BUILDER = "builder"
    BILLING = "billing"
    MONITOR = "monitor"
    SUPPORT = "support"
    RESEARCH = "research"


@dataclass
class AgentProfile:
    """Profile of an agent with its capabilities and transfer metrics."""
    agent_type: AgentType
    name: str
    total_tasks_completed: int = 0
    successful_transfers: int = 0  # Times another agent reused this agent's experience
    received_transfers: int = 0  # Times this agent reused another's experience
    avg_reuse_success_rate: float = 0.0  # Success rate when reusing others' experiences

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "agent_type": self.agent_type.value,
            "name": self.name,
            "total_tasks_completed": self.total_tasks_completed,
            "successful_transfers": self.successful_transfers,
            "received_transfers": self.received_transfers,
            "avg_reuse_success_rate": self.avg_reuse_success_rate,
        }


@dataclass
class TransferMetrics:
    """Metrics for experience transfer."""
    source_agent: str
    target_agent: str
    successful_transfers: int = 0
    failed_transfers: int = 0
    avg_transfer_quality_improvement: float = 0.0

    def get_success_rate(self) -> float:
        """Get success rate of transfers."""
        total = self.successful_transfers + self.failed_transfers
        if total == 0:
            return 0.0
        return self.successful_transfers / total

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "source_agent": self.source_agent,
            "target_agent": self.target_agent,
            "successful_transfers": self.successful_transfers,
            "failed_transfers": self.failed_transfers,
            "success_rate": self.get_success_rate(),
            "avg_quality_improvement": self.avg_transfer_quality_improvement,
        }


class MultiAgentSharing:
    """
    Enables experience sharing across Genesis agents.

    Agents can learn from each other's successful experiences.
    """

    def __init__(self, experience_buffer: Optional[ExperienceBuffer] = None):
        """
        Initialize multi-agent sharing.

        Args:
            experience_buffer: Experience buffer to share from
        """
        self.buffer = experience_buffer or get_experience_buffer()

        # Agent profiles
        self.agent_profiles: Dict[str, AgentProfile] = {
            agent_type.value: AgentProfile(
                agent_type=agent_type,
                name=agent_type.value,
            )
            for agent_type in AgentType
        }

        # Transfer metrics between agents
        self.transfer_metrics: Dict[Tuple[str, str], TransferMetrics] = {}

        logger.info(f"MultiAgentSharing initialized with {len(self.agent_profiles)} agent profiles")

    async def get_transferable_experiences(
        self,
        source_agent: str,
        target_agent: str,
        limit: int = 5,
    ) -> List[Experience]:
        """
        Get experiences from source agent that target agent can reuse.

        Args:
            source_agent: Agent type that performed the task
            target_agent: Agent type that wants to reuse the experience
            limit: Maximum experiences to return

        Returns:
            List of transferable experiences
        """
        # Get experiences from source agent
        experiences = self.buffer.get_by_task_type(source_agent, limit=limit * 2)

        if not experiences:
            return []

        # Filter to high-quality (> 80) to ensure transferability
        quality_threshold = 80.0
        transferable = [
            exp for exp in experiences
            if exp.quality_score >= quality_threshold
        ]

        return transferable[:limit]

    async def transfer_experience(
        self,
        source_agent: str,
        target_agent: str,
        experience: Experience,
        success: bool,
        quality_improvement: float = 0.0,
    ) -> None:
        """
        Record a transfer of experience between agents.

        Args:
            source_agent: Agent that performed the task
            target_agent: Agent that reused the experience
            experience: Experience that was transferred
            success: Whether the transfer was successful
            quality_improvement: Quality score improvement (0-100)
        """
        # Get or create transfer metrics
        key = (source_agent, target_agent)

        if key not in self.transfer_metrics:
            self.transfer_metrics[key] = TransferMetrics(
                source_agent=source_agent,
                target_agent=target_agent,
            )

        metrics = self.transfer_metrics[key]

        if success:
            metrics.successful_transfers += 1
        else:
            metrics.failed_transfers += 1

        # Update quality improvement
        if metrics.successful_transfers > 0:
            old_avg = metrics.avg_transfer_quality_improvement
            new_avg = (
                (old_avg * (metrics.successful_transfers - 1) + quality_improvement)
                / metrics.successful_transfers
            )
            metrics.avg_transfer_quality_improvement = new_avg

        # Update agent profiles
        if source_agent in self.agent_profiles:
            self.agent_profiles[source_agent].successful_transfers += 1 if success else 0

        if target_agent in self.agent_profiles:
            self.agent_profiles[target_agent].received_transfers += 1

        logger.debug(
            f"Recorded transfer: {source_agent} → {target_agent} "
            f"(experience={experience.experience_id}, success={success})"
        )

    def record_agent_task_completion(
        self,
        agent_type: str,
        success: bool,
        quality_score: float = 0.0,
    ) -> None:
        """
        Record that an agent completed a task.

        Args:
            agent_type: Type of agent
            success: Whether the task was successful
            quality_score: Quality score of the output (0-100)
        """
        if agent_type in self.agent_profiles:
            profile = self.agent_profiles[agent_type]
            if success:
                profile.total_tasks_completed += 1

            logger.debug(f"Recorded task: {agent_type} (success={success}, quality={quality_score:.1f})")

    def get_agent_profile(self, agent_type: str) -> Optional[AgentProfile]:
        """Get profile for an agent."""
        return self.agent_profiles.get(agent_type)

    def get_best_knowledge_donor(
        self,
        target_agent: str,
        limit: int = 3,
    ) -> List[Tuple[str, float]]:
        """
        Get agents with best knowledge to transfer to target agent.

        Args:
            target_agent: Target agent type
            limit: Maximum donors to return

        Returns:
            List of (agent_type, knowledge_score) tuples
        """
        knowledge_scores: Dict[str, float] = {}

        for (source, target), metrics in self.transfer_metrics.items():
            if target != target_agent:
                continue

            # Score: success rate + quality improvement
            score = (
                metrics.get_success_rate() * 50 +
                metrics.avg_transfer_quality_improvement * 0.5
            )

            knowledge_scores[source] = score

        # Sort by score (highest first)
        sorted_scores = sorted(knowledge_scores.items(), key=lambda x: x[1], reverse=True)

        return sorted_scores[:limit]

    def get_transfer_metrics(self) -> Dict[str, Any]:
        """Get overall transfer metrics."""
        total_successful = sum(m.successful_transfers for m in self.transfer_metrics.values())
        total_failed = sum(m.failed_transfers for m in self.transfer_metrics.values())
        total_transfers = total_successful + total_failed

        if total_transfers == 0:
            success_rate = 0.0
        else:
            success_rate = total_successful / total_transfers

        avg_quality_improvement = (
            sum(m.avg_transfer_quality_improvement for m in self.transfer_metrics.values())
            / len(self.transfer_metrics)
            if self.transfer_metrics
            else 0.0
        )

        return {
            "total_transfers": total_transfers,
            "successful_transfers": total_successful,
            "failed_transfers": total_failed,
            "success_rate": success_rate,
            "avg_quality_improvement": avg_quality_improvement,
            "num_agent_pairs": len(self.transfer_metrics),
        }

    def get_metrics_by_agent_pair(self) -> Dict[str, Any]:
        """Get transfer metrics broken down by agent pair."""
        return {
            f"{m.source_agent}→{m.target_agent}": m.to_dict()
            for m in self.transfer_metrics.values()
        }

    def print_metrics(self) -> None:
        """Print human-readable metrics."""
        overall = self.get_transfer_metrics()

        print("\n" + "=" * 80)
        print("MULTI-AGENT EXPERIENCE SHARING METRICS")
        print("=" * 80)

        print(f"\nTotal Transfers: {overall['total_transfers']}")
        print(f"Successful: {overall['successful_transfers']}")
        print(f"Failed: {overall['failed_transfers']}")
        print(f"Success Rate: {overall['success_rate']:.1%}")
        print(f"Avg Quality Improvement: {overall['avg_quality_improvement']:.1f}")

        print("\n" + "-" * 80)
        print("AGENT PROFILES")
        print("-" * 80)

        for agent_type, profile in sorted(self.agent_profiles.items()):
            print(
                f"{agent_type:20} | "
                f"Tasks: {profile.total_tasks_completed:3} | "
                f"Shared: {profile.successful_transfers:3} | "
                f"Received: {profile.received_transfers:3}"
            )

        print("\n" + "-" * 80)
        print("TRANSFER PATHS (Top 10)")
        print("-" * 80)

        metrics_by_pair = self.get_metrics_by_agent_pair()
        sorted_pairs = sorted(
            metrics_by_pair.items(),
            key=lambda x: x[1].get("success_rate", 0.0),
            reverse=True,
        )

        for pair, metrics in sorted_pairs[:10]:
            success_rate = metrics.get("success_rate", 0.0)
            quality_imp = metrics.get("avg_quality_improvement", 0.0)
            print(
                f"{pair:30} | "
                f"Success: {success_rate:.1%} | "
                f"Quality+: {quality_imp:+5.1f}"
            )

        print("\n" + "=" * 80 + "\n")


def get_multi_agent_sharing(
    experience_buffer: Optional[ExperienceBuffer] = None,
) -> MultiAgentSharing:
    """Get or create global multi-agent sharing instance."""
    return MultiAgentSharing(experience_buffer)
