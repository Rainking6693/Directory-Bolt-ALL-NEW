"""
Research rubric utilities for Genesis orchestration.

Provides access to the Research Rubrics Benchmark (arXiv:2511.07685) dataset
and helpers that annotate HTDAG tasks with breadth/depth/ambiguity criteria
so agents can score themselves against human-authored expectations.
"""

from .research_rubric_loader import (
    RubricDimension,
    RubricCriterion,
    ResearchRubricDataset,
    apply_research_rubrics_to_dag,
)
from .rubric_evaluator import RubricEvaluationHook

__all__ = [
    "RubricDimension",
    "RubricCriterion",
    "ResearchRubricDataset",
    "apply_research_rubrics_to_dag",
    "RubricEvaluationHook",
]
