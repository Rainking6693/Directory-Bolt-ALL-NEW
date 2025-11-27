"""
Dr. MAMR Attribution Tracker (Integration #70)

Multi-agent attribution tracking with Shapley value computation.
Based on arXiv:2511.02303 Dr. MAMR paper.

Features:
- Shapley value computation for causal influence
- Free-rider detection
- Restart token issuance
- GRPO reward computation
- Performance tracking across agents
"""

from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import json
import asyncio
import logging

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


class ShapleyCalculator:
    """Compute Shapley values for agent contributions using coalition sampling."""

    def __init__(self, num_samples: int = 10):
        self.num_samples = num_samples

    async def compute_shapley_values(
        self,
        agents: List[str],
        task: str,
        result_quality: float,
        agent_outputs: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Compute Shapley values via coalition sampling.

        Shapley value = average marginal contribution across all coalitions.
        For efficiency, sample random coalitions instead of exhaustive enumeration.
        """
        shapley_values = {agent: 0.0 for agent in agents}

        if len(agents) == 1:
            # Single agent gets all credit
            return {agents[0]: 1.0}

        # Sample coalitions
        for _ in range(self.num_samples):
            # Random permutation of agents
            permutation = np.random.permutation(agents).tolist()

            # Compute marginal contributions
            for i, agent in enumerate(permutation):
                # Coalition without this agent
                coalition_without = set(permutation[:i])
                # Coalition with this agent
                coalition_with = set(permutation[:i+1])

                # Estimate value difference (marginal contribution)
                value_without = self._estimate_coalition_value(
                    coalition_without, result_quality, agent_outputs
                )
                value_with = self._estimate_coalition_value(
                    coalition_with, result_quality, agent_outputs
                )

                marginal_contribution = value_with - value_without
                shapley_values[agent] += marginal_contribution

        # Average over samples
        shapley_values = {
            agent: value / self.num_samples
            for agent, value in shapley_values.items()
        }

        # Normalize to sum to 1.0
        total = sum(shapley_values.values())
        if total > 0:
            shapley_values = {
                agent: value / total
                for agent, value in shapley_values.items()
            }

        return shapley_values

    def _estimate_coalition_value(
        self,
        coalition: set,
        result_quality: float,
        agent_outputs: Dict[str, Any]
    ) -> float:
        """
        Estimate value of a coalition.
        Heuristic: proportional to result quality and coalition size.
        """
        if not coalition:
            return 0.0

        # Simple heuristic: value = quality * coalition_contribution
        coalition_contribution = sum(
            self._get_agent_output_quality(agent, agent_outputs)
            for agent in coalition
        ) / len(coalition)

        return result_quality * coalition_contribution

    def _get_agent_output_quality(self, agent: str, agent_outputs: Dict[str, Any]) -> float:
        """Get quality score for an agent's output (0.0-1.0)."""
        if agent not in agent_outputs:
            return 0.5  # Default

        output = agent_outputs[agent]
        # Extract quality from output metadata
        if isinstance(output, dict) and "quality" in output:
            return output["quality"]

        return 0.7  # Default good quality


class RestartTokenManager:
    """
    Manage restart tokens for deliberation reset.
    Issues tokens when quality drops below threshold.
    """

    def __init__(self, quality_threshold: float = 0.3):
        self.quality_threshold = quality_threshold
        self.restart_history: List[Dict] = []

    async def check_restart_needed(
        self,
        task: str,
        agents: List[str],
        quality_score: float,
        recent_quality_history: List[float]
    ) -> bool:
        """
        Check if restart token should be issued.

        Restart if:
        1. Quality drops below threshold
        2. Quality declining for 3+ consecutive steps
        3. Quality variance is very high (unstable)
        """
        # Check threshold
        if quality_score < self.quality_threshold:
            await self._issue_restart_token(task, agents, quality_score, "quality_threshold")
            return True

        # Check declining trend
        if len(recent_quality_history) >= 3:
            if all(recent_quality_history[i] > recent_quality_history[i+1]
                   for i in range(len(recent_quality_history)-1)):
                await self._issue_restart_token(task, agents, quality_score, "declining_trend")
                return True

        # Check high variance (unstable)
        if len(recent_quality_history) >= 5:
            variance = np.var(recent_quality_history)
            if variance > 0.2:  # High variance threshold
                await self._issue_restart_token(task, agents, quality_score, "high_variance")
                return True

        return False

    async def _issue_restart_token(
        self,
        task: str,
        agents: List[str],
        quality_score: float,
        reason: str
    ) -> None:
        """Issue restart token."""
        restart_event = {
            "timestamp": datetime.now().isoformat(),
            "task": task[:100],
            "agents": agents,
            "quality_score": quality_score,
            "reason": reason
        }
        self.restart_history.append(restart_event)

        logger.warning(
            f"[RESTART TOKEN] Issued for task '{task[:50]}...' "
            f"(quality={quality_score:.2f}, reason={reason})"
        )


class AttributionTracker:
    """
    Attribution tracker for multi-agent collaboration.
    Tracks causal influence, issues restart tokens, computes GRPO rewards.
    """

    def __init__(
        self,
        storage_dir: Path = Path("data/attribution"),
        free_rider_threshold: float = 0.15
    ):
        self.shapley_calculator = ShapleyCalculator(num_samples=10)
        self.restart_manager = RestartTokenManager(quality_threshold=0.3)
        self.free_rider_threshold = free_rider_threshold

        # Historical data
        self.agent_contributions: Dict[str, List[float]] = defaultdict(list)
        self.collaboration_history: List[Dict] = []

        # Storage
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[AttributionTracker] Initialized (storage={storage_dir})")

    async def track_collaboration(
        self,
        task: str,
        agents: List[str],
        agent_outputs: Dict[str, Any],
        result_quality: float
    ) -> Dict[str, float]:
        """
        Track multi-agent collaboration and compute causal influence.

        Args:
            task: Task description
            agents: List of agent names involved
            agent_outputs: Dict of agent name -> output
            result_quality: Overall result quality (0.0-1.0)

        Returns:
            Shapley values for each agent
        """
        # Compute Shapley values
        shapley_values = await self.shapley_calculator.compute_shapley_values(
            agents, task, result_quality, agent_outputs
        )

        # Update historical contributions
        for agent, value in shapley_values.items():
            self.agent_contributions[agent].append(value)

        # Store collaboration event
        collaboration_event = {
            "timestamp": datetime.now().isoformat(),
            "task": task[:100],
            "agents": agents,
            "shapley_values": shapley_values,
            "result_quality": result_quality
        }
        self.collaboration_history.append(collaboration_event)

        # Check if restart needed
        recent_quality = [
            event["result_quality"]
            for event in self.collaboration_history[-5:]
        ]
        restart_needed = await self.restart_manager.check_restart_needed(
            task, agents, result_quality, recent_quality
        )

        if restart_needed:
            collaboration_event["restart_issued"] = True

        # Persist
        await self.save()

        logger.debug(
            f"[Attribution] Tracked collaboration: {len(agents)} agents, "
            f"quality={result_quality:.2f}, top contributor: "
            f"{max(shapley_values.items(), key=lambda x: x[1])[0]}"
        )

        return shapley_values

    async def get_recent_collaborations(self, hours: int = 24) -> List[Dict]:
        """Get collaborations from last N hours."""
        cutoff = datetime.now() - timedelta(hours=hours)

        recent = []
        for event in self.collaboration_history:
            timestamp = datetime.fromisoformat(event["timestamp"])
            if timestamp >= cutoff:
                recent.append(event)

        return recent

    async def compute_metrics(self) -> Dict[str, Any]:
        """Compute overall attribution metrics."""
        if not self.collaboration_history:
            return {"status": "no_data"}

        recent_24h = await self.get_recent_collaborations(hours=24)

        return {
            "total_collaborations": len(self.collaboration_history),
            "recent_24h": len(recent_24h),
            "unique_agents": len(self.agent_contributions),
            "avg_quality": np.mean([e["result_quality"] for e in self.collaboration_history]),
            "restart_tokens_issued": len(self.restart_manager.restart_history),
        }

    async def detect_free_riders(
        self,
        min_samples: int = 10
    ) -> List[str]:
        """
        Detect agents with consistently low contributions (free-riders).

        Args:
            min_samples: Minimum number of collaborations to evaluate

        Returns:
            List of agent names identified as free-riders
        """
        free_riders = []
        for agent, values in self.agent_contributions.items():
            if len(values) >= min_samples:
                avg_contribution = np.mean(values)
                if avg_contribution < self.free_rider_threshold:
                    free_riders.append(agent)
                    logger.warning(
                        f"[FREE-RIDER DETECTED] Agent '{agent}' has low avg contribution: {avg_contribution:.3f}"
                    )

        return free_riders

    async def get_agent_stats(self, agent_name: str) -> Dict[str, Any]:
        """Get statistics for a specific agent."""
        if agent_name not in self.agent_contributions:
            return {"status": "no_data"}

        values = self.agent_contributions[agent_name]
        return {
            "agent_name": agent_name,
            "collaboration_count": len(values),
            "avg_contribution": np.mean(values),
            "std_contribution": np.std(values),
            "min_contribution": np.min(values),
            "max_contribution": np.max(values),
            "contribution_trend": "improving" if self._is_improving(values) else "declining"
        }

    def _is_improving(self, values: List[float]) -> bool:
        """Check if contribution is improving over time."""
        if len(values) < 10:
            return True  # Not enough data

        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]

        return np.mean(second_half) > np.mean(first_half)

    def get_top_contributors(self, k: int = 5) -> List[Tuple[str, float]]:
        """Get top K contributing agents by average Shapley value."""
        if not self.agent_contributions:
            return []

        avg_contributions = {
            agent: np.mean(values)
            for agent, values in self.agent_contributions.items()
        }
        return sorted(
            avg_contributions.items(),
            key=lambda x: x[1],
            reverse=True
        )[:k]

    def compute_grpo_step_rewards(
        self,
        agent_name: str,
        step_quality: float,
        collaboration_shapley: float
    ) -> float:
        """
        Compute Group Relative Policy Optimization (GRPO) step-level reward.

        Reward = step_quality * collaboration_shapley
        (Agent gets higher reward if step quality is good AND they contributed significantly)
        """
        reward = step_quality * collaboration_shapley
        return reward

    async def save(self) -> None:
        """Persist attribution data to disk."""
        attribution_file = self.storage_dir / "attribution_history.json"

        data = {
            "agent_contributions": {
                agent: {
                    "values": values[-100:],  # Last 100 samples
                    "avg": float(np.mean(values)),
                    "count": len(values)
                }
                for agent, values in self.agent_contributions.items()
            },
            "recent_collaborations": self.collaboration_history[-50:],  # Last 50
            "restart_history": self.restart_manager.restart_history[-20:]  # Last 20
        }

        with open(attribution_file, 'w') as f:
            json.dump(data, f, indent=2)

    async def load(self) -> None:
        """Load attribution data from disk."""
        attribution_file = self.storage_dir / "attribution_history.json"

        if attribution_file.exists():
            with open(attribution_file, 'r') as f:
                data = json.load(f)

                # Restore agent contributions
                for agent, agent_data in data.get("agent_contributions", {}).items():
                    self.agent_contributions[agent] = agent_data["values"]

                # Restore collaboration history
                self.collaboration_history = data.get("recent_collaborations", [])
                self.restart_manager.restart_history = data.get("restart_history", [])

            logger.info("[AttributionTracker] Loaded from disk")
