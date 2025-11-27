"""
AgentEvolver Phase 3: Credit Assignment System

Tracks which agent actions lead to high-quality businesses and identifies bottlenecks.

Key Features:
- Track actions leading to high-quality businesses (>90)
- Identify bottlenecks (failure causes)
- Rank actions by impact
- Feed to SE-Darwin for targeted improvement

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 3
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    QUALITY_THRESHOLD_HIGH,
    QUALITY_THRESHOLD_LOW,
)
from infrastructure.agentevolver.attribution import (
    ActionContribution,
    BusinessAttribution,
)
from infrastructure.agentevolver.utils import TimeHelper, MetricsHelper

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class ActionImpactStats:
    """Statistics for impact of an action type."""
    action_type: str
    agent: str
    total_occurrences: int = 0
    successful_occurrences: int = 0  # Led to quality > 90
    failed_occurrences: int = 0  # Led to quality < 50
    avg_contribution: float = 0.0  # Average contribution score
    avg_quality_when_high: float = 0.0  # Avg quality when contributed >75
    avg_quality_when_low: float = 0.0  # Avg quality when contributed <30

    def get_success_rate(self) -> float:
        """Get success rate of this action."""
        if self.total_occurrences == 0:
            return 0.0
        return self.successful_occurrences / self.total_occurrences

    def get_failure_rate(self) -> float:
        """Get failure rate of this action."""
        if self.total_occurrences == 0:
            return 0.0
        return self.failed_occurrences / self.total_occurrences

    def get_impact_score(self) -> float:
        """
        Compute overall impact score (0-100).

        Balances success rate and average contribution.
        """
        success_component = self.get_success_rate() * 50.0
        contribution_component = self.avg_contribution * 0.5

        return success_component + contribution_component

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "action_type": self.action_type,
            "agent": self.agent,
            "total_occurrences": self.total_occurrences,
            "successful_occurrences": self.successful_occurrences,
            "failed_occurrences": self.failed_occurrences,
            "success_rate": self.get_success_rate(),
            "failure_rate": self.get_failure_rate(),
            "avg_contribution": self.avg_contribution,
            "impact_score": self.get_impact_score(),
            "avg_quality_when_high": self.avg_quality_when_high,
            "avg_quality_when_low": self.avg_quality_when_low,
        }


@dataclass
class BottleneckAnalysis:
    """Analysis of bottlenecks in business generation."""
    action_type: str
    agent: str
    failure_rate: float  # Fraction of attempts that failed
    avg_failure_quality: float  # Average quality when this action failed
    improvement_priority: float  # How much this needs improvement (0-100)
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "action_type": self.action_type,
            "agent": self.agent,
            "failure_rate": self.failure_rate,
            "avg_failure_quality": self.avg_failure_quality,
            "improvement_priority": self.improvement_priority,
            "explanation": self.explanation,
        }


class CreditAssignment:
    """
    System for tracking which actions lead to success and identifying improvements.

    Analyzes attribution data to find high-impact and low-impact actions.
    """

    def __init__(self):
        """Initialize credit assignment system."""
        self.action_stats: Dict[Tuple[str, str], ActionImpactStats] = {}
        self.business_outcomes: List[Tuple[str, float, List[ActionContribution]]] = []
        self.bottlenecks: List[BottleneckAnalysis] = []

        logger.info("CreditAssignment system initialized")

    def record_business_outcome(
        self,
        business_id: str,
        quality_score: float,
        actions: List[ActionContribution],
    ) -> None:
        """
        Record the outcome of a business generation with action attributions.

        Args:
            business_id: ID of the generated business
            quality_score: Final quality score (0-100)
            actions: List of actions with contribution scores
        """
        # Store outcome
        self.business_outcomes.append((business_id, quality_score, actions))

        # Update action stats
        for action in actions:
            key = (action.action_type.value, action.agent)

            if key not in self.action_stats:
                self.action_stats[key] = ActionImpactStats(
                    action_type=action.action_type.value,
                    agent=action.agent,
                )

            stats = self.action_stats[key]

            # Update occurrence count
            stats.total_occurrences += 1

            # Check if successful or failed
            if quality_score >= QUALITY_THRESHOLD_HIGH:
                stats.successful_occurrences += 1
                avg_quality = stats.avg_quality_when_high
                stats.avg_quality_when_high = (
                    (avg_quality * (stats.successful_occurrences - 1) + quality_score)
                    / stats.successful_occurrences
                )
            elif quality_score <= QUALITY_THRESHOLD_LOW:
                stats.failed_occurrences += 1
                avg_quality = stats.avg_quality_when_low
                stats.avg_quality_when_low = (
                    (avg_quality * (stats.failed_occurrences - 1) + quality_score)
                    / stats.failed_occurrences
                )

            # Update average contribution
            old_avg = stats.avg_contribution
            stats.avg_contribution = (
                (old_avg * (stats.total_occurrences - 1) + action.contribution_score)
                / stats.total_occurrences
            )

        # Recompute bottlenecks
        self._analyze_bottlenecks()

        logger.debug(
            f"Recorded business outcome: {business_id} "
            f"(quality={quality_score:.1f}, actions={len(actions)})"
        )

    def _analyze_bottlenecks(self) -> None:
        """Identify actions that are causing failures."""
        bottlenecks = []

        for (action_type, agent), stats in self.action_stats.items():
            if stats.total_occurrences < 3:
                # Need more data
                continue

            failure_rate = stats.get_failure_rate()

            if failure_rate > 0.3:
                # This action fails >30% of the time
                improvement_priority = failure_rate * 100.0

                explanation = (
                    f"{action_type} by {agent} fails {failure_rate:.1%} of the time, "
                    f"avg quality on failure: {stats.avg_quality_when_low:.1f}/100"
                )

                bottleneck = BottleneckAnalysis(
                    action_type=action_type,
                    agent=agent,
                    failure_rate=failure_rate,
                    avg_failure_quality=stats.avg_quality_when_low,
                    improvement_priority=improvement_priority,
                    explanation=explanation,
                )

                bottlenecks.append(bottleneck)

        # Sort by priority (highest first)
        bottlenecks.sort(key=lambda b: b.improvement_priority, reverse=True)

        self.bottlenecks = bottlenecks

    def get_high_impact_actions(
        self,
        limit: int = 10,
    ) -> List[ActionImpactStats]:
        """Get highest-impact actions."""
        stats_list = list(self.action_stats.values())
        stats_list.sort(key=lambda s: s.get_impact_score(), reverse=True)

        return stats_list[:limit]

    def get_low_impact_actions(
        self,
        limit: int = 10,
    ) -> List[ActionImpactStats]:
        """Get lowest-impact actions (targets for improvement)."""
        stats_list = list(self.action_stats.values())
        stats_list.sort(key=lambda s: s.get_impact_score())

        return stats_list[:limit]

    def get_bottlenecks(self, limit: int = 10) -> List[BottleneckAnalysis]:
        """Get most critical bottlenecks."""
        return self.bottlenecks[:limit]

    def get_success_actions(self, limit: int = 10) -> List[ActionImpactStats]:
        """Get actions with highest success rates."""
        stats_list = [
            s for s in self.action_stats.values()
            if s.total_occurrences >= 3  # Need enough data
        ]
        stats_list.sort(key=lambda s: s.get_success_rate(), reverse=True)

        return stats_list[:limit]

    def get_agent_impact(self, agent: str) -> Dict[str, float]:
        """Get impact breakdown for a specific agent."""
        agent_actions = [
            stats for (action_type, ag), stats in self.action_stats.items()
            if ag == agent
        ]

        total_impact = sum(s.get_impact_score() for s in agent_actions)

        if total_impact == 0:
            return {}

        return {
            action.action_type: (action.get_impact_score() / total_impact) * 100.0
            for action in agent_actions
        }

    def get_improvement_targets(self) -> Dict[str, List[str]]:
        """
        Get recommended improvements by agent.

        Returns:
            Dict mapping agent -> list of action types that need improvement
        """
        improvements = defaultdict(list)

        for bottleneck in self.bottlenecks:
            improvements[bottleneck.agent].append(bottleneck.action_type)

        return dict(improvements)

    def get_statistics(self) -> Dict[str, Any]:
        """Get overall credit assignment statistics."""
        if not self.business_outcomes:
            return {
                "total_businesses": 0,
                "avg_quality": 0.0,
                "high_quality_count": 0,
                "low_quality_count": 0,
                "high_quality_rate": 0.0,
            }

        qualities = [q for _, q, _ in self.business_outcomes]
        high_quality = sum(1 for q in qualities if q >= QUALITY_THRESHOLD_HIGH)
        low_quality = sum(1 for q in qualities if q <= QUALITY_THRESHOLD_LOW)

        return {
            "total_businesses": len(self.business_outcomes),
            "avg_quality": sum(qualities) / len(qualities),
            "min_quality": min(qualities),
            "max_quality": max(qualities),
            "high_quality_count": high_quality,
            "low_quality_count": low_quality,
            "high_quality_rate": high_quality / len(self.business_outcomes),
            "total_action_types": len(self.action_stats),
            "num_bottlenecks": len(self.bottlenecks),
        }

    def print_analysis(self) -> None:
        """Print human-readable analysis."""
        stats = self.get_statistics()

        print("\n" + "=" * 80)
        print("CREDIT ASSIGNMENT ANALYSIS")
        print("=" * 80)

        print(f"\nTotal Businesses: {stats['total_businesses']}")
        print(f"Average Quality: {stats.get('avg_quality', 0.0):.1f}/100")
        print(f"High Quality (>90): {stats.get('high_quality_count', 0)} ({stats.get('high_quality_rate', 0.0):.1%})")
        print(f"Low Quality (<50): {stats.get('low_quality_count', 0)}")

        print("\n" + "-" * 80)
        print("HIGH-IMPACT ACTIONS (Top 10)")
        print("-" * 80)

        for action in self.get_high_impact_actions(10):
            print(
                f"{action.action_type:30} | {action.agent:15} | "
                f"Impact: {action.get_impact_score():5.1f} | "
                f"Success: {action.get_success_rate():.1%}"
            )

        print("\n" + "-" * 80)
        print("BOTTLENECKS (Top 5)")
        print("-" * 80)

        for bottleneck in self.get_bottlenecks(5):
            print(
                f"{bottleneck.action_type:30} | {bottleneck.agent:15} | "
                f"Failure: {bottleneck.failure_rate:.1%} | "
                f"Priority: {bottleneck.improvement_priority:.1f}"
            )

        print("\n" + "=" * 80 + "\n")


def get_credit_assignment() -> CreditAssignment:
    """Get or create global credit assignment system."""
    return CreditAssignment()
