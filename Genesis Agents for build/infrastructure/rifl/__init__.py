"""
RIFL (Rubric-Integrated Feedback Loop) utilities.

Provides lightweight rubric generation, verifier, and reward shaping logic
used by Layer 2 Darwin prompt evolution.
"""

from .rifl_pipeline import (
    RIFLRubric,
    RIFLPromptEvaluator,
)

__all__ = [
    "RIFLRubric",
    "RIFLPromptEvaluator",
]
