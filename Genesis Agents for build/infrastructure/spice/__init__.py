"""
SPICE (Self-Play In Corpus Environments) - Layer 2 Enhancement
Autonomous self-play RL for trajectory bootstrapping in SE-Darwin

Based on: arXiv:2510.24684 (October 2025)
Expected Impact: +9-11% evolution accuracy

Components:
- ChallengerAgent: Corpus-grounded task generation
- ReasonerAgent: Multi-trajectory solution generation
- DrGRPOOptimizer: Variance reward optimization

Integration:
- SE-Darwin: Trajectory bootstrapping
- Zenith: Curriculum generation (7K synthetic traces)
- Swarm: Adversarial team challenges
"""

from infrastructure.spice.challenger_agent import (
    ChallengerAgent,
    FrontierTask,
    GroundingEvidence,
    get_challenger_agent
)

from infrastructure.spice.reasoner_agent import (
    ReasonerAgent,
    TrajectoryResult,
    get_reasoner_agent
)

from infrastructure.spice.drgrpo_optimizer import (
    DrGRPOOptimizer,
    TrainingExample,
    TrainingBatch,
    get_drgrpo_optimizer
)

__all__ = [
    # Challenger
    "ChallengerAgent",
    "FrontierTask",
    "GroundingEvidence",
    "get_challenger_agent",
    # Reasoner
    "ReasonerAgent",
    "TrajectoryResult",
    "get_reasoner_agent",
    # Optimizer
    "DrGRPOOptimizer",
    "TrainingExample",
    "TrainingBatch",
    "get_drgrpo_optimizer",
]
