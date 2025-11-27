"""
AgentEvolver Coverage Tracker

Measures exploration coverage across business types and industry domains.
Tracks progress toward 95% coverage goal.

Key Features:
- Track business type coverage (saas, ecommerce, etc.)
- Track domain coverage (healthcare, fintech, etc.)
- Generate coverage reports
- Identify gaps to prioritize

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 1
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    BUSINESS_TYPES,
    INDUSTRY_DOMAINS,
    BUSINESS_COVERAGE_TARGET,
)
from infrastructure.agentevolver.utils import TimeHelper

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class CoverageMetrics:
    """Coverage metrics for a category (business type or domain)."""
    category: str
    exploration_count: int = 0
    unique_ideas: int = 0
    avg_quality_score: float = 0.0
    last_explored: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "category": self.category,
            "exploration_count": self.exploration_count,
            "unique_ideas": self.unique_ideas,
            "avg_quality_score": self.avg_quality_score,
            "last_explored": self.last_explored,
        }


@dataclass
class CoverageReport:
    """Comprehensive coverage report."""
    timestamp: str
    business_type_coverage: Dict[str, CoverageMetrics]
    domain_coverage: Dict[str, CoverageMetrics]
    overall_business_type_coverage: float  # 0-1
    overall_domain_coverage: float  # 0-1
    overall_coverage: float  # 0-1
    gaps: Dict[str, List[str]]  # Unexplored types/domains

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "timestamp": self.timestamp,
            "business_type_coverage": {
                k: v.to_dict() for k, v in self.business_type_coverage.items()
            },
            "domain_coverage": {
                k: v.to_dict() for k, v in self.domain_coverage.items()
            },
            "overall_business_type_coverage": self.overall_business_type_coverage,
            "overall_domain_coverage": self.overall_domain_coverage,
            "overall_coverage": self.overall_coverage,
            "gaps": self.gaps,
        }


class CoverageTracker:
    """
    Tracks exploration coverage across business types and domains.

    Measures progress toward 95% coverage goal.
    """

    def __init__(self):
        """Initialize coverage tracker."""
        # Initialize metrics for all business types
        self.business_type_metrics: Dict[str, CoverageMetrics] = {
            btype: CoverageMetrics(category=btype)
            for btype in BUSINESS_TYPES
        }

        # Initialize metrics for all domains
        self.domain_metrics: Dict[str, CoverageMetrics] = {
            domain: CoverageMetrics(category=domain)
            for domain in INDUSTRY_DOMAINS
        }

        logger.info(
            f"CoverageTracker initialized with {len(BUSINESS_TYPES)} business types "
            f"and {len(INDUSTRY_DOMAINS)} domains"
        )

    def record_exploration(
        self,
        business_type: str,
        domain: str,
        quality_score: float = 0.0,
        idea_id: Optional[str] = None,
    ) -> None:
        """
        Record that we've explored a business type + domain combination.

        Args:
            business_type: Business type explored
            domain: Domain explored
            quality_score: Quality score of the generated idea
            idea_id: Optional ID of the generated idea
        """
        key_type = business_type.lower()
        key_domain = domain.lower()

        # Update business type metrics
        if key_type in self.business_type_metrics:
            metrics = self.business_type_metrics[key_type]
            metrics.exploration_count += 1
            metrics.unique_ideas += 1
            metrics.last_explored = TimeHelper.current_timestamp()

            # Update average quality score
            if quality_score > 0:
                old_avg = metrics.avg_quality_score
                new_avg = (
                    (old_avg * (metrics.unique_ideas - 1) + quality_score)
                    / metrics.unique_ideas
                )
                metrics.avg_quality_score = new_avg
        else:
            logger.warning(f"Unknown business type: {key_type}")

        # Update domain metrics
        if key_domain in self.domain_metrics:
            metrics = self.domain_metrics[key_domain]
            metrics.exploration_count += 1
            metrics.unique_ideas += 1
            metrics.last_explored = TimeHelper.current_timestamp()

            # Update average quality score
            if quality_score > 0:
                old_avg = metrics.avg_quality_score
                new_avg = (
                    (old_avg * (metrics.unique_ideas - 1) + quality_score)
                    / metrics.unique_ideas
                )
                metrics.avg_quality_score = new_avg
        else:
            logger.warning(f"Unknown domain: {key_domain}")

    def get_business_type_coverage(self) -> float:
        """
        Get business type coverage (0-1).

        Returns:
            Fraction of business types explored at least once
        """
        if not BUSINESS_TYPES:
            return 0.0

        explored = sum(
            1 for metrics in self.business_type_metrics.values()
            if metrics.exploration_count > 0
        )

        return explored / len(BUSINESS_TYPES)

    def get_domain_coverage(self) -> float:
        """
        Get domain coverage (0-1).

        Returns:
            Fraction of domains explored at least once
        """
        if not INDUSTRY_DOMAINS:
            return 0.0

        explored = sum(
            1 for metrics in self.domain_metrics.values()
            if metrics.exploration_count > 0
        )

        return explored / len(INDUSTRY_DOMAINS)

    def get_overall_coverage(self) -> float:
        """
        Get overall coverage (0-1).

        Returns:
            Average of business type and domain coverage
        """
        type_coverage = self.get_business_type_coverage()
        domain_coverage = self.get_domain_coverage()

        return (type_coverage + domain_coverage) / 2.0


    def get_coverage(self) -> float:
        """
        Get overall coverage (0-1).

        Alias for get_overall_coverage() for API compatibility.

        Returns:
            Overall coverage percentage (0-1)
        """
        return self.get_overall_coverage()

    def get_coverage_status(self) -> Dict[str, Any]:
        """Get current coverage status."""
        type_coverage = self.get_business_type_coverage()
        domain_coverage = self.get_domain_coverage()
        overall = self.get_overall_coverage()

        return {
            "business_type_coverage": type_coverage,
            "domain_coverage": domain_coverage,
            "overall_coverage": overall,
            "coverage_target": BUSINESS_COVERAGE_TARGET,
            "progress_to_target": overall / BUSINESS_COVERAGE_TARGET,
        }

    def get_unexplored_business_types(self) -> List[str]:
        """Get business types not yet explored."""
        return [
            key for key, metrics in self.business_type_metrics.items()
            if metrics.exploration_count == 0
        ]

    def get_unexplored_domains(self) -> List[str]:
        """Get domains not yet explored."""
        return [
            key for key, metrics in self.domain_metrics.items()
            if metrics.exploration_count == 0
        ]

    def get_underexplored_business_types(self, threshold: int = 1) -> List[str]:
        """
        Get business types explored less than threshold times.

        Args:
            threshold: Minimum exploration count

        Returns:
            List of underexplored business types
        """
        return [
            key for key, metrics in self.business_type_metrics.items()
            if 0 < metrics.exploration_count < threshold
        ]

    def get_underexplored_domains(self, threshold: int = 1) -> List[str]:
        """
        Get domains explored less than threshold times.

        Args:
            threshold: Minimum exploration count

        Returns:
            List of underexplored domains
        """
        return [
            key for key, metrics in self.domain_metrics.items()
            if 0 < metrics.exploration_count < threshold
        ]

    def get_high_quality_coverage(self, quality_threshold: float = 80.0) -> float:
        """
        Get coverage based on high-quality ideas (score > threshold).

        Args:
            quality_threshold: Minimum quality score (0-100)

        Returns:
            Fraction of types with high-quality ideas
        """
        if not BUSINESS_TYPES:
            return 0.0

        high_quality = sum(
            1 for metrics in self.business_type_metrics.values()
            if metrics.avg_quality_score >= quality_threshold
        )

        return high_quality / len(BUSINESS_TYPES)

    def generate_report(self) -> CoverageReport:
        """Generate comprehensive coverage report."""
        type_coverage = self.get_business_type_coverage()
        domain_coverage = self.get_domain_coverage()
        overall = self.get_overall_coverage()

        gaps = {
            "unexplored_business_types": self.get_unexplored_business_types(),
            "unexplored_domains": self.get_unexplored_domains(),
            "underexplored_business_types": self.get_underexplored_business_types(2),
            "underexplored_domains": self.get_underexplored_domains(2),
        }

        return CoverageReport(
            timestamp=TimeHelper.current_timestamp(),
            business_type_coverage=self.business_type_metrics,
            domain_coverage=self.domain_metrics,
            overall_business_type_coverage=type_coverage,
            overall_domain_coverage=domain_coverage,
            overall_coverage=overall,
            gaps=gaps,
        )

    def print_coverage_summary(self) -> None:
        """Print human-readable coverage summary."""
        report = self.generate_report()

        print("\n" + "=" * 80)
        print("AGENTEVOLVER COVERAGE REPORT")
        print("=" * 80)

        print(f"\nOverall Coverage: {report.overall_coverage:.1%}")
        print(f"Business Type Coverage: {report.overall_business_type_coverage:.1%}")
        print(f"Domain Coverage: {report.overall_domain_coverage:.1%}")
        print(f"Target: {BUSINESS_COVERAGE_TARGET:.1%}")

        print("\n" + "-" * 80)
        print("BUSINESS TYPES")
        print("-" * 80)

        for key, metrics in sorted(report.business_type_coverage.items()):
            status = "✓" if metrics.exploration_count > 0 else "✗"
            print(
                f"{status} {key:20} | "
                f"Explored: {metrics.exploration_count:3} | "
                f"Ideas: {metrics.unique_ideas:3} | "
                f"Avg Quality: {metrics.avg_quality_score:5.1f}/100"
            )

        print("\n" + "-" * 80)
        print("INDUSTRY DOMAINS")
        print("-" * 80)

        for key, metrics in sorted(report.domain_coverage.items()):
            status = "✓" if metrics.exploration_count > 0 else "✗"
            print(
                f"{status} {key:20} | "
                f"Explored: {metrics.exploration_count:3} | "
                f"Ideas: {metrics.unique_ideas:3} | "
                f"Avg Quality: {metrics.avg_quality_score:5.1f}/100"
            )

        print("\n" + "-" * 80)
        print("GAPS")
        print("-" * 80)

        if report.gaps["unexplored_business_types"]:
            print(
                f"Unexplored types: {', '.join(report.gaps['unexplored_business_types'])}"
            )

        if report.gaps["unexplored_domains"]:
            print(f"Unexplored domains: {', '.join(report.gaps['unexplored_domains'])}")

        if report.gaps["underexplored_business_types"]:
            print(
                f"Underexplored types: {', '.join(report.gaps['underexplored_business_types'])}"
            )

        print("\n" + "=" * 80 + "\n")


def get_coverage_tracker() -> CoverageTracker:
    """Get or create coverage tracker instance."""
    return CoverageTracker()
