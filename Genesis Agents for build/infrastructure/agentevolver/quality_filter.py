"""
AgentEvolver Phase 4: Quality Filter

Validates scenario quality, diversity, and feasibility.

Key Features:
- Validate minimum diversity (>70%)
- Validate difficulty level (not too easy/hard)
- Reject hallucinated or infeasible scenarios
- Track filtering statistics

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 4
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    SCENARIO_DIVERSITY_THRESHOLD,
    SCENARIO_DIFFICULTY_MIN,
    SCENARIO_DIFFICULTY_MAX,
)
from infrastructure.agentevolver.utils import MetricsHelper

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class FilteringMetrics:
    """Metrics for scenario filtering."""
    total_evaluated: int = 0
    passed_filter: int = 0
    failed_filter: int = 0
    diversity_failures: int = 0
    difficulty_failures: int = 0
    quality_failures: int = 0
    hallucination_detections: int = 0

    def get_pass_rate(self) -> float:
        """Get pass rate of filter."""
        if self.total_evaluated == 0:
            return 0.0
        return self.passed_filter / self.total_evaluated

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "total_evaluated": self.total_evaluated,
            "passed_filter": self.passed_filter,
            "failed_filter": self.failed_filter,
            "pass_rate": self.get_pass_rate(),
            "diversity_failures": self.diversity_failures,
            "difficulty_failures": self.difficulty_failures,
            "quality_failures": self.quality_failures,
            "hallucination_detections": self.hallucination_detections,
        }


class QualityFilter:
    """
    Validates scenario quality, diversity, and feasibility.

    Rejects scenarios that don't meet minimum standards.
    """

    def __init__(
        self,
        diversity_threshold: float = SCENARIO_DIVERSITY_THRESHOLD,
        difficulty_min: int = SCENARIO_DIFFICULTY_MIN,
        difficulty_max: int = SCENARIO_DIFFICULTY_MAX,
    ):
        """
        Initialize quality filter.

        Args:
            diversity_threshold: Minimum diversity score (0-1)
            difficulty_min: Minimum difficulty level (1-10)
            difficulty_max: Maximum difficulty level (1-10)
        """
        self.diversity_threshold = diversity_threshold
        self.difficulty_min = difficulty_min
        self.difficulty_max = difficulty_max
        self.metrics = FilteringMetrics()
        self.seen_descriptions: set = set()  # Track for hallucination detection

        logger.info(
            f"QualityFilter initialized (diversity_threshold={diversity_threshold}, "
            f"difficulty={difficulty_min}-{difficulty_max})"
        )

    def validate_scenario(self, scenario: Dict[str, Any]) -> bool:
        """
        Validate a scenario against all filters.

        Args:
            scenario: Scenario dict to validate

        Returns:
            True if scenario passes all filters
        """
        self.metrics.total_evaluated += 1

        # Check required fields
        required_fields = ["scenario_id", "task_type", "description", "quality_score"]
        for field in required_fields:
            if field not in scenario:
                logger.debug(f"Scenario missing field: {field}")
                self.metrics.failed_filter += 1
                self.metrics.quality_failures += 1
                return False

        # Check diversity
        if not self._check_diversity(scenario):
            self.metrics.failed_filter += 1
            self.metrics.diversity_failures += 1
            return False

        # Check difficulty
        if not self._check_difficulty(scenario):
            self.metrics.failed_filter += 1
            self.metrics.difficulty_failures += 1
            return False

        # Check for hallucinations
        if self._detect_hallucination(scenario):
            self.metrics.failed_filter += 1
            self.metrics.hallucination_detections += 1
            return False

        # Check quality score
        quality = scenario.get("quality_score", 0.0)
        if quality < 50.0:
            logger.debug(f"Scenario quality too low: {quality:.1f}")
            self.metrics.failed_filter += 1
            self.metrics.quality_failures += 1
            return False

        self.metrics.passed_filter += 1

        return True

    def _check_diversity(self, scenario: Dict[str, Any]) -> bool:
        """
        Check if scenario is sufficiently diverse.

        Args:
            scenario: Scenario to check

        Returns:
            True if diversity >= threshold
        """
        diversity = scenario.get("diversity_score", 0.0)

        if diversity < (self.diversity_threshold * 100.0):
            logger.debug(
                f"Scenario diversity too low: {diversity:.1f}% "
                f"(threshold: {self.diversity_threshold * 100.0:.1f}%)"
            )
            return False

        return True

    def _check_difficulty(self, scenario: Dict[str, Any]) -> bool:
        """
        Check if scenario difficulty is within acceptable range.

        Args:
            scenario: Scenario to check

        Returns:
            True if difficulty in range
        """
        difficulty = scenario.get("difficulty_level", 5)

        if not isinstance(difficulty, int):
            difficulty = int(difficulty)

        if difficulty < self.difficulty_min or difficulty > self.difficulty_max:
            logger.debug(
                f"Scenario difficulty out of range: {difficulty} "
                f"(range: {self.difficulty_min}-{self.difficulty_max})"
            )
            return False

        return True

    def _detect_hallucination(self, scenario: Dict[str, Any]) -> bool:
        """
        Detect if scenario is hallucinated/duplicate.

        Args:
            scenario: Scenario to check

        Returns:
            True if hallucination detected
        """
        description = scenario.get("description", "").lower()

        # Check for exact duplicates or near-duplicates
        if description in self.seen_descriptions:
            logger.debug(f"Duplicate scenario detected")
            return True

        # Check for common hallucination patterns
        hallucination_patterns = [
            "todo",  # Unfinished implementation
            "fix me",  # Broken code
            "placeholder",  # Incomplete
            "[example]",  # Template not filled
            "{{template}}",  # Template syntax
            "<?php",  # Accidental language mixing
            "import undefined",  # Broken imports
        ]

        if any(pattern in description for pattern in hallucination_patterns):
            logger.debug(f"Hallucination pattern detected: {description[:50]}")
            return True

        # Check for suspicious length patterns
        if len(description) < 10:
            logger.debug("Description too short (likely hallucination)")
            return True

        if len(description) > 5000:
            logger.debug("Description too long (likely bloated)")
            return True

        # Add to seen descriptions
        self.seen_descriptions.add(description)

        return False

    def get_metrics(self) -> FilteringMetrics:
        """Get filtering metrics."""
        return self.metrics

    def print_metrics(self) -> None:
        """Print human-readable metrics."""
        metrics = self.metrics

        print("\n" + "=" * 80)
        print("QUALITY FILTER METRICS")
        print("=" * 80)

        print(f"\nTotal Evaluated: {metrics.total_evaluated}")
        print(f"Passed: {metrics.passed_filter}")
        print(f"Failed: {metrics.failed_filter}")
        print(f"Pass Rate: {metrics.get_pass_rate():.1%}")

        print("\nFailure Breakdown:")
        print(f"  Diversity failures: {metrics.diversity_failures}")
        print(f"  Difficulty failures: {metrics.difficulty_failures}")
        print(f"  Quality failures: {metrics.quality_failures}")
        print(f"  Hallucination detections: {metrics.hallucination_detections}")

        print("\n" + "=" * 80 + "\n")


def get_quality_filter(
    diversity_threshold: float = SCENARIO_DIVERSITY_THRESHOLD,
) -> QualityFilter:
    """Get or create global quality filter."""
    return QualityFilter(diversity_threshold=diversity_threshold)
