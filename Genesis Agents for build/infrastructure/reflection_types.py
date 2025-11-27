"""
Reflection Types - Shared Data Structures
Version: 1.0
Last Updated: October 15, 2025

Shared dataclasses and enums for the Reflection system to prevent circular imports.
This module contains type definitions used by both ReflectionAgent and ReflectionHarness.

Architecture:
- reflection_types.py: Shared types (THIS FILE)
- reflection_agent.py: Agent implementation (imports types)
- reflection_harness.py: Harness wrapper (imports types)

This separation ensures:
1. No circular dependencies
2. Clear dependency hierarchy
3. Easy testing and mocking
4. Type reusability across modules
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any


class QualityDimension(Enum):
    """
    Quality dimensions for code/content assessment

    These dimensions represent the key aspects of quality that
    the ReflectionAgent evaluates when reviewing content.
    """
    CORRECTNESS = "correctness"  # Does it work correctly?
    COMPLETENESS = "completeness"  # Is everything implemented?
    QUALITY = "quality"  # Is it well-written?
    SECURITY = "security"  # Is it secure?
    PERFORMANCE = "performance"  # Is it efficient?
    MAINTAINABILITY = "maintainability"  # Is it maintainable?


@dataclass
class DimensionScore:
    """
    Score for a single quality dimension

    Represents the assessment result for one aspect of quality,
    including the numeric score, feedback, issues found, and
    suggestions for improvement.
    """
    dimension: str
    score: float  # 0.0 to 1.0
    feedback: str
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class ReflectionResult:
    """
    Complete reflection result with multi-dimensional scores

    Contains the comprehensive output of a reflection operation,
    including scores across all quality dimensions, aggregated
    feedback, and metadata about the reflection process.

    This is the primary output of ReflectionAgent.reflect() and
    is consumed by ReflectionHarness to make regeneration decisions.

    Attributes:
        overall_score: Weighted average of all dimension scores (0.0-1.0)
        passes_threshold: True if overall_score >= quality_threshold
        dimension_scores: Individual scores for each quality dimension
        summary_feedback: Human-readable summary of the assessment
        critical_issues: List of critical issues that need immediate attention
        suggestions: List of suggestions for improvement
        reflection_time_seconds: Time taken to perform reflection
        timestamp: ISO 8601 timestamp of when reflection was completed
        metadata: Additional context and information
    """
    overall_score: float  # 0.0 to 1.0 (weighted average)
    passes_threshold: bool  # True if overall_score >= threshold
    dimension_scores: Dict[str, DimensionScore]
    summary_feedback: str
    critical_issues: List[str]
    suggestions: List[str]
    reflection_time_seconds: float
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)
