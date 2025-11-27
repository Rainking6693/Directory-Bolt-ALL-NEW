"""
WaltzRL - Collaborative Multi-Agent Safety Framework
====================================================

Two-stage reinforcement learning for safety alignment without capability degradation.

Research: arXiv:2510.08240v1 (Meta Superintelligence Labs + Johns Hopkins)
Results: 89% unsafe reduction, 78% over-refusal reduction

Architecture:
- Conversation Agent: Generates responses with safety awareness
- Feedback Agent: Provides nuanced safety feedback (not binary blocking)
- Dynamic Improvement Reward (DIR): Joint training objective
- Stage 1: Train feedback agent on safety datasets
- Stage 2: Joint training with DIR optimization

Components:
- conversation_agent: Main LLM wrapped with safety awareness
- feedback_agent: Evaluates safety without over-refusing
- safety_wrapper: Integration layer for Genesis agents
- trainer: RL training pipeline (Stage 1 + Stage 2)
"""

from .conversation_agent import WaltzRLConversationAgent
from .feedback_agent import WaltzRLFeedbackAgent
from .safety_wrapper import WaltzRLSafetyWrapper
from .trainer import WaltzRLTrainer, Stage1Trainer, Stage2Trainer

__all__ = [
    "WaltzRLConversationAgent",
    "WaltzRLFeedbackAgent",
    "WaltzRLSafetyWrapper",
    "WaltzRLTrainer",
    "Stage1Trainer",
    "Stage2Trainer",
]

__version__ = "1.0.0"
