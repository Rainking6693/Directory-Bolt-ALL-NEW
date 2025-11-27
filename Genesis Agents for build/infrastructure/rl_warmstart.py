"""
RL Warm-Start System - Bootstrap Future RL from Early Experience
Layer 2 component for Darwin self-improvement

PURPOSE: Treat successful early-experience checkpoints as initial policy for future RL tasks

Key Insight (from research):
- Don't start RL from scratch
- Use best-performing agent versions as initialization
- Dramatically faster convergence (warm-start vs cold-start)
- Preserves good behaviors while allowing further optimization

Features:
- Checkpoint management (save best-performing versions)
- Policy initialization from checkpoints
- Fine-tuning interface for RL algorithms
- Performance comparison (warm vs cold start)

Based on:
- Off-policy RL (learn from experience, not just current policy)
- Transfer learning (knowledge from early experience → RL)
- Curriculum learning (start from good initialization)
"""

import asyncio
import json
import logging
import pickle
import shutil
from collections import defaultdict
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from infrastructure import (
    get_replay_buffer,
    get_reasoning_bank,
    OutcomeTag,
    MemoryType,
    get_logger
)

logger = get_logger("rl_warmstart")


class CheckpointQuality(Enum):
    """Quality tiers for checkpoints"""
    EXCELLENT = "excellent"  # >90% success rate
    GOOD = "good"  # 70-90% success rate
    FAIR = "fair"  # 50-70% success rate
    POOR = "poor"  # <50% success rate


@dataclass
class Checkpoint:
    """Agent checkpoint for warm-starting"""
    checkpoint_id: str
    agent_name: str
    version: str
    code_path: Path
    metrics: Dict[str, float]
    success_rate: float
    quality_tier: str  # CheckpointQuality
    num_trajectories: int  # Number of successful trajectories
    creation_timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WarmStartConfig:
    """Configuration for warm-start initialization"""
    checkpoint_id: str
    agent_name: str
    source_version: str
    target_task: str
    expected_boost: float  # Expected performance improvement vs cold start
    initialization_method: str  # "copy", "fine_tune", "ensemble"


class RLWarmStartSystem:
    """
    Warm-start system for bootstrapping RL from successful early experience

    Workflow:
    1. CHECKPOINT: Save best-performing agent versions during evolution
    2. EVALUATE: Rank checkpoints by success rate and quality
    3. SELECT: Choose best checkpoint for new RL task
    4. INITIALIZE: Use checkpoint code as starting policy
    5. FINE-TUNE: Apply RL algorithm (PPO, SAC, etc.) from warm start
    6. COMPARE: Measure improvement over cold-start baseline

    Usage:
        system = RLWarmStartSystem()

        # Save checkpoint after successful evolution
        await system.save_checkpoint(
            agent_name="spec_agent",
            version="gen5_v3",
            code_path=Path("agents/evolved/spec_agent/gen5_v3.py"),
            metrics={"success_rate": 0.85}
        )

        # Later: warm-start new RL task
        checkpoint = await system.get_best_checkpoint("spec_agent")
        config = await system.create_warmstart_config(checkpoint, "new_task")
    """

    def __init__(self, checkpoints_dir: Optional[Path] = None):
        """
        Initialize warm-start system

        Args:
            checkpoints_dir: Directory for saving checkpoints
        """
        self.checkpoints_dir = checkpoints_dir or Path("checkpoints")
        self.checkpoints_dir.mkdir(exist_ok=True)

        # Checkpoint registry
        self.checkpoints: Dict[str, Checkpoint] = {}
        self._load_checkpoint_registry()

        # Performance tracking
        self.warmstart_comparisons: List[Dict[str, Any]] = []

        # Infrastructure connections
        self.replay_buffer = get_replay_buffer()
        self.reasoning_bank = get_reasoning_bank()

        logger.info(f"RLWarmStartSystem initialized")
        logger.info(f"Checkpoints directory: {self.checkpoints_dir}")
        logger.info(f"Loaded {len(self.checkpoints)} existing checkpoints")

    def _load_checkpoint_registry(self):
        """Load checkpoint registry from disk"""
        registry_path = self.checkpoints_dir / "registry.json"

        if registry_path.exists():
            try:
                data = json.loads(registry_path.read_text())
                for cp_data in data.get("checkpoints", []):
                    # Reconstruct Path objects
                    cp_data["code_path"] = Path(cp_data["code_path"])
                    checkpoint = Checkpoint(**cp_data)
                    self.checkpoints[checkpoint.checkpoint_id] = checkpoint

                logger.info(f"Loaded {len(self.checkpoints)} checkpoints from registry")

            except Exception as e:
                logger.error(f"Failed to load checkpoint registry: {e}")

    def _save_checkpoint_registry(self):
        """Save checkpoint registry to disk"""
        registry_path = self.checkpoints_dir / "registry.json"

        # Convert to serializable format
        data = {
            "checkpoints": [
                {**asdict(cp), "code_path": str(cp.code_path)}
                for cp in self.checkpoints.values()
            ],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        registry_path.write_text(json.dumps(data, indent=2))
        logger.info(f"Checkpoint registry saved: {len(self.checkpoints)} checkpoints")

    async def save_checkpoint(
        self,
        agent_name: str,
        version: str,
        code_path: Path,
        metrics: Dict[str, float],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Checkpoint:
        """
        Save agent checkpoint for future warm-starting

        Args:
            agent_name: Name of agent
            version: Version identifier (e.g., "gen5_v3")
            code_path: Path to agent code file
            metrics: Performance metrics
            metadata: Optional additional metadata

        Returns:
            Saved Checkpoint object
        """
        import uuid

        checkpoint_id = f"cp_{agent_name}_{uuid.uuid4().hex[:8]}"

        logger.info(f"💾 Saving checkpoint: {checkpoint_id}")

        # Copy code to checkpoints directory
        agent_checkpoints_dir = self.checkpoints_dir / agent_name
        agent_checkpoints_dir.mkdir(exist_ok=True)

        checkpoint_code_path = agent_checkpoints_dir / f"{checkpoint_id}.py"
        shutil.copy(code_path, checkpoint_code_path)

        # Compute success rate from trajectories or metrics
        success_rate = await self._compute_success_rate(agent_name, version, metrics)

        # Determine quality tier
        quality_tier = self._determine_quality_tier(success_rate)

        # Count trajectories
        num_trajectories = len(self.replay_buffer.query_by_agent(agent_name, limit=10000))

        # Create checkpoint object
        checkpoint = Checkpoint(
            checkpoint_id=checkpoint_id,
            agent_name=agent_name,
            version=version,
            code_path=checkpoint_code_path,
            metrics=metrics,
            success_rate=success_rate,
            quality_tier=quality_tier.value,
            num_trajectories=num_trajectories,
            creation_timestamp=datetime.now(timezone.utc).isoformat(),
            metadata=metadata or {},
        )

        # Save to registry
        self.checkpoints[checkpoint_id] = checkpoint
        self._save_checkpoint_registry()

        logger.info(f"✅ Checkpoint saved: {checkpoint_id}")
        logger.info(f"   Quality: {quality_tier.value}, Success rate: {success_rate:.1%}")

        # Store in ReasoningBank as successful strategy
        await self._store_checkpoint_strategy(checkpoint)

        return checkpoint

    async def _compute_success_rate(self, agent_name: str, version: str, metrics: Optional[Dict[str, float]] = None) -> float:
        """Compute success rate for agent version from Replay Buffer or metrics"""
        try:
            # First, check if metrics contains overall_score or success_rate
            # Use this as a proxy for success rate in test environments where Replay Buffer is empty
            if metrics:
                if "success_rate" in metrics:
                    return metrics["success_rate"]
                elif "overall_score" in metrics:
                    # Use overall_score as success rate proxy (0.8 score = 0.8 success rate)
                    return metrics["overall_score"]

            # Query recent trajectories from Replay Buffer
            trajectories = self.replay_buffer.query_by_agent(agent_name, limit=100)

            if not trajectories:
                return 0.5  # Default if no data

            # Count successes
            successes = sum(
                1 for t in trajectories
                if t.get("final_outcome") == OutcomeTag.SUCCESS.value
            )

            return successes / len(trajectories)

        except Exception as e:
            logger.warning(f"Failed to compute success rate: {e}")
            return 0.5

    def _determine_quality_tier(self, success_rate: float) -> CheckpointQuality:
        """Determine quality tier based on success rate"""
        if success_rate >= 0.9:
            return CheckpointQuality.EXCELLENT
        elif success_rate >= 0.7:
            return CheckpointQuality.GOOD
        elif success_rate >= 0.5:
            return CheckpointQuality.FAIR
        else:
            return CheckpointQuality.POOR

    async def _store_checkpoint_strategy(self, checkpoint: Checkpoint):
        """Store checkpoint as successful strategy in ReasoningBank"""
        try:
            self.reasoning_bank.store_memory(
                memory_type=MemoryType.STRATEGY,
                content={
                    "checkpoint_id": checkpoint.checkpoint_id,
                    "agent_name": checkpoint.agent_name,
                    "version": checkpoint.version,
                    "success_rate": checkpoint.success_rate,
                    "quality_tier": checkpoint.quality_tier,
                    "description": f"High-performing checkpoint for {checkpoint.agent_name} (success rate: {checkpoint.success_rate:.1%})",
                },
                metadata={
                    "metrics": checkpoint.metrics,
                    "num_trajectories": checkpoint.num_trajectories,
                },
                outcome=OutcomeTag.SUCCESS,
                tags=[checkpoint.agent_name, "checkpoint", checkpoint.quality_tier],
            )

            logger.info("Checkpoint strategy stored in ReasoningBank")

        except Exception as e:
            logger.warning(f"Failed to store checkpoint strategy: {e}")

    async def get_best_checkpoint(
        self,
        agent_name: str,
        min_quality: CheckpointQuality = CheckpointQuality.GOOD,
    ) -> Optional[Checkpoint]:
        """
        Get best checkpoint for an agent

        Args:
            agent_name: Agent to get checkpoint for
            min_quality: Minimum quality tier required

        Returns:
            Best Checkpoint, or None if none available
        """
        # Filter by agent and quality
        candidates = [
            cp for cp in self.checkpoints.values()
            if cp.agent_name == agent_name and
            self._quality_tier_rank(CheckpointQuality(cp.quality_tier)) >= self._quality_tier_rank(min_quality)
        ]

        if not candidates:
            logger.warning(f"No checkpoints found for {agent_name} with quality >= {min_quality.value}")
            return None

        # Sort by success rate
        candidates.sort(key=lambda cp: cp.success_rate, reverse=True)

        best = candidates[0]
        logger.info(f"Best checkpoint for {agent_name}: {best.checkpoint_id} (success rate: {best.success_rate:.1%})")

        return best

    def _quality_tier_rank(self, tier: CheckpointQuality) -> int:
        """Convert quality tier to numeric rank for comparison"""
        ranks = {
            CheckpointQuality.EXCELLENT: 4,
            CheckpointQuality.GOOD: 3,
            CheckpointQuality.FAIR: 2,
            CheckpointQuality.POOR: 1,
        }
        return ranks.get(tier, 0)

    async def create_warmstart_config(
        self,
        checkpoint: Checkpoint,
        target_task: str,
        initialization_method: str = "fine_tune",
    ) -> WarmStartConfig:
        """
        Create warm-start configuration for new RL task

        Args:
            checkpoint: Checkpoint to use for initialization
            target_task: Target task description
            initialization_method: How to initialize ("copy", "fine_tune", "ensemble")

        Returns:
            WarmStartConfig object
        """
        # Estimate expected boost (based on historical data)
        expected_boost = await self._estimate_warmstart_boost(checkpoint)

        config = WarmStartConfig(
            checkpoint_id=checkpoint.checkpoint_id,
            agent_name=checkpoint.agent_name,
            source_version=checkpoint.version,
            target_task=target_task,
            expected_boost=expected_boost,
            initialization_method=initialization_method,
        )

        logger.info(f"Created warm-start config:")
        logger.info(f"   Checkpoint: {checkpoint.checkpoint_id}")
        logger.info(f"   Method: {initialization_method}")
        logger.info(f"   Expected boost: +{expected_boost:.1%}")

        return config

    async def _estimate_warmstart_boost(self, checkpoint: Checkpoint) -> float:
        """Estimate performance boost from warm-starting (vs cold start)"""
        # Simple heuristic: higher quality checkpoints give bigger boost
        tier = CheckpointQuality(checkpoint.quality_tier)

        boost_map = {
            CheckpointQuality.EXCELLENT: 0.30,  # +30% expected improvement
            CheckpointQuality.GOOD: 0.20,       # +20%
            CheckpointQuality.FAIR: 0.10,       # +10%
            CheckpointQuality.POOR: 0.05,       # +5%
        }

        return boost_map.get(tier, 0.0)

    async def initialize_from_checkpoint(
        self,
        checkpoint: Checkpoint,
        target_path: Path,
    ) -> bool:
        """
        Initialize new agent from checkpoint

        Args:
            checkpoint: Checkpoint to initialize from
            target_path: Path to write initialized agent code

        Returns:
            Success boolean
        """
        logger.info(f"🚀 Initializing from checkpoint: {checkpoint.checkpoint_id}")

        try:
            # Copy checkpoint code to target
            shutil.copy(checkpoint.code_path, target_path)

            logger.info(f"✅ Initialized: {target_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize from checkpoint: {e}")
            return False

    async def compare_warmstart_vs_coldstart(
        self,
        agent_name: str,
        warmstart_checkpoint: Checkpoint,
        task: str,
        coldstart_metrics: Dict[str, float],
        warmstart_metrics: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Compare warm-start vs cold-start performance

        Args:
            agent_name: Agent name
            warmstart_checkpoint: Checkpoint used for warm-start
            task: Task description
            coldstart_metrics: Performance metrics with cold-start
            warmstart_metrics: Performance metrics with warm-start

        Returns:
            Comparison results dictionary
        """
        logger.info(f"📊 Comparing warm-start vs cold-start for {agent_name}")

        # Compute deltas
        deltas = {
            metric: warmstart_metrics.get(metric, 0) - coldstart_metrics.get(metric, 0)
            for metric in set(list(warmstart_metrics.keys()) + list(coldstart_metrics.keys()))
        }

        overall_improvement = deltas.get("overall_score", 0)

        comparison = {
            "agent_name": agent_name,
            "checkpoint_id": warmstart_checkpoint.checkpoint_id,
            "task": task,
            "coldstart_metrics": coldstart_metrics,
            "warmstart_metrics": warmstart_metrics,
            "deltas": deltas,
            "overall_improvement": overall_improvement,
            "improvement_percentage": (overall_improvement / max(coldstart_metrics.get("overall_score", 0.01), 0.01)) * 100,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        self.warmstart_comparisons.append(comparison)

        logger.info(f"Warm-start improvement: {overall_improvement:+.3f} ({comparison['improvement_percentage']:+.1f}%)")

        # Save comparison
        await self._save_comparison(comparison)

        return comparison

    async def _save_comparison(self, comparison: Dict[str, Any]):
        """Save warm-start comparison to disk"""
        comparisons_dir = self.checkpoints_dir / "comparisons"
        comparisons_dir.mkdir(exist_ok=True)

        comparison_file = comparisons_dir / f"{comparison['agent_name']}_{comparison['checkpoint_id']}.json"
        comparison_file.write_text(json.dumps(comparison, indent=2))

    def get_warmstart_statistics(self) -> Dict[str, Any]:
        """Get overall warm-start statistics"""
        if not self.warmstart_comparisons:
            return {
                "total_comparisons": 0,
                "average_improvement": 0.0,
                "success_rate": 0.0,
            }

        improvements = [c["overall_improvement"] for c in self.warmstart_comparisons]
        successes = sum(1 for imp in improvements if imp > 0)

        return {
            "total_comparisons": len(self.warmstart_comparisons),
            "average_improvement": sum(improvements) / len(improvements),
            "success_rate": successes / len(self.warmstart_comparisons),
            "best_improvement": max(improvements),
            "worst_improvement": min(improvements),
        }


# Convenience functions
_warmstart_system = None


def get_warmstart_system() -> RLWarmStartSystem:
    """Get singleton warm-start system"""
    global _warmstart_system
    if _warmstart_system is None:
        _warmstart_system = RLWarmStartSystem()
    return _warmstart_system


async def save_checkpoint(agent_name: str, version: str, code_path: Path, metrics: Dict[str, float]) -> Checkpoint:
    """
    Convenience function to save checkpoint

    Example:
        checkpoint = await save_checkpoint(
            agent_name="spec_agent",
            version="gen5_v3",
            code_path=Path("agents/evolved/spec_agent/gen5_v3.py"),
            metrics={"success_rate": 0.85}
        )
    """
    system = get_warmstart_system()
    return await system.save_checkpoint(agent_name, version, code_path, metrics)


if __name__ == "__main__":
    # Test warm-start system
    async def test_warmstart():
        system = RLWarmStartSystem()

        # Create dummy checkpoint
        dummy_code = Path("/tmp/dummy_checkpoint.py")
        dummy_code.write_text("def agent_function(): return 'checkpoint code'")

        # Save checkpoint
        checkpoint = await system.save_checkpoint(
            agent_name="test_agent",
            version="v1.0",
            code_path=dummy_code,
            metrics={"overall_score": 0.85, "success_rate": 0.80},
        )

        print(f"\n✅ Checkpoint saved:")
        print(f"ID: {checkpoint.checkpoint_id}")
        print(f"Quality: {checkpoint.quality_tier}")
        print(f"Success rate: {checkpoint.success_rate:.1%}")

        # Get best checkpoint
        best = await system.get_best_checkpoint("test_agent")
        print(f"\n🏆 Best checkpoint: {best.checkpoint_id if best else 'None'}")

        # Create warm-start config
        if best:
            config = await system.create_warmstart_config(best, "new_task")
            print(f"\n🚀 Warm-start config:")
            print(f"Expected boost: +{config.expected_boost:.1%}")

        # Cleanup
        dummy_code.unlink()

    asyncio.run(test_warmstart())
