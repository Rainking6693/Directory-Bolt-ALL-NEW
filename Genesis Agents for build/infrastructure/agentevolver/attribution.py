"""
AgentEvolver Phase 3: Attribution Engine (Contribution-Based Rewards)

Calculates contribution score per action using counterfactual reasoning.

Key Features:
- Compute contribution score for each agent action (0-100)
- Counterfactual reasoning: "What if we skipped this?"
- Example: domain=20%, marketing=30%, SEO=15%
- Track which actions lead to high-quality businesses

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 3
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    AGENT_BASE_WEIGHTS,
    COUNTERFACTUAL_SAMPLE_SIZE,
    ATTRIBUTION_DECAY_FACTOR,
)
from infrastructure.agentevolver.utils import TimeHelper

load_genesis_env()

logger = logging.getLogger(__name__)


class ActionType(Enum):
    """Types of actions that can be attributed."""
    DOMAIN_REGISTRATION = "domain_registration"
    SEO_OPTIMIZATION = "seo_optimization"
    MARKETING_CAMPAIGN = "marketing_campaign"
    CONTENT_CREATION = "content_creation"
    CODE_BUILD = "code_build"
    QA_TESTING = "qa_testing"
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"


@dataclass
class ActionContribution:
    """Contribution of a single action to business success."""
    action_id: str
    action_type: ActionType
    agent: str  # Which agent performed this action
    business_id: str
    timestamp: str
    contribution_score: float  # 0-100
    explanation: str
    counterfactual_delta: Optional[float] = None  # Quality delta if we skipped this

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "action_id": self.action_id,
            "action_type": self.action_type.value,
            "agent": self.agent,
            "business_id": self.business_id,
            "timestamp": self.timestamp,
            "contribution_score": self.contribution_score,
            "explanation": self.explanation,
            "counterfactual_delta": self.counterfactual_delta,
        }


@dataclass
class BusinessAttribution:
    """Attribution breakdown for a single business."""
    business_id: str
    final_quality_score: float  # Overall quality (0-100)
    action_contributions: List[ActionContribution]
    agent_contributions: Dict[str, float]  # agent_name -> contribution (0-100)
    attribution_timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "business_id": self.business_id,
            "final_quality_score": self.final_quality_score,
            "action_contributions": [ac.to_dict() for ac in self.action_contributions],
            "agent_contributions": self.agent_contributions,
            "attribution_timestamp": self.attribution_timestamp,
        }


class CounterfactualReasoner:
    """
    Uses counterfactual reasoning to estimate action contributions.

    Estimates: "What if we skipped this action? How much would quality decrease?"
    """

    def __init__(self, similar_businesses: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize counterfactual reasoner.

        Args:
            similar_businesses: Similar businesses to compare against
        """
        self.similar_businesses = similar_businesses or []

    def estimate_counterfactual_delta(
        self,
        action_type: ActionType,
        business_quality: float,
        business_features: List[str],
    ) -> float:
        """
        Estimate quality loss if we removed this action.

        Uses comparison with similar businesses that don't have this action.

        Args:
            action_type: Type of action
            business_quality: Actual quality score of business
            business_features: Features of the business

        Returns:
            Estimated quality delta (quality loss if action was skipped)
        """
        # Find similar businesses without this action
        counterfactual_businesses = []

        for biz in self.similar_businesses:
            # Check if business is similar but lacks this action
            if self._is_similar(business_features, biz.get("features", [])):
                # Check if business lacks this action type
                actions = biz.get("actions", [])
                has_action = any(
                    a.get("type") == action_type.value for a in actions
                )

                if not has_action:
                    counterfactual_businesses.append(biz)

        if not counterfactual_businesses:
            # No counterfactual examples - use base contribution weight
            return 80.0  # Default contribution when no counterfactual examples available

        # Compute average quality of counterfactual businesses
        counterfactual_qualities = [
            b.get("quality_score", 0.0) for b in counterfactual_businesses
        ]
        avg_counterfactual_quality = sum(counterfactual_qualities) / len(
            counterfactual_qualities
        ) if counterfactual_qualities else 0.0

        # Delta = actual quality - counterfactual quality
        delta = business_quality - avg_counterfactual_quality

        return max(0.0, delta)  # Can't be negative

    def _is_similar(self, features1: List[str], features2: List[str]) -> bool:
        """Check if two feature lists are similar."""
        if not features1 or not features2:
            return False

        set1 = set(features1)
        set2 = set(features2)

        if not set1 or not set2:
            return False

        # Jaccard similarity
        intersection = len(set1 & set2)
        union = len(set1 | set2)

        similarity = intersection / union if union > 0 else 0.0

        return similarity > 0.5  # 50% similarity threshold


class AttributionEngine:
    """
    Phase 3: Attribution Engine - Calculates contribution scores for actions.

    Answers: Which actions contribute most to business success?
    """

    def __init__(self):
        """Initialize attribution engine."""
        self.counterfactual_reasoner = CounterfactualReasoner()
        self.attributions: Dict[str, BusinessAttribution] = {}

        logger.info("AttributionEngine initialized")

    def compute_attribution(
        self,
        business_id: str,
        final_quality_score: float,
        actions: List[Dict[str, Any]],
    ) -> BusinessAttribution:
        """
        Compute attribution for all actions in a business generation.

        Args:
            business_id: ID of the generated business
            final_quality_score: Final quality score (0-100)
            actions: List of actions taken (each with type, agent, result)

        Returns:
            BusinessAttribution with contribution breakdown
        """
        action_contributions: List[ActionContribution] = []
        agent_scores: Dict[str, float] = {}

        # Compute contribution for each action
        for action in actions:
            contribution = self._compute_action_contribution(
                action=action,
                business_id=business_id,
                final_quality_score=final_quality_score,
                action_index=actions.index(action),
                total_actions=len(actions),
            )

            action_contributions.append(contribution)

            # Aggregate by agent
            agent = contribution.agent
            if agent not in agent_scores:
                agent_scores[agent] = 0.0

            agent_scores[agent] += contribution.contribution_score

        # Normalize agent scores to 0-100
        if agent_scores:
            max_score = max(agent_scores.values())
            if max_score > 0:
                agent_scores = {
                    agent: (score / max_score) * 100.0
                    for agent, score in agent_scores.items()
                }

        # Create attribution object
        attribution = BusinessAttribution(
            business_id=business_id,
            final_quality_score=final_quality_score,
            action_contributions=action_contributions,
            agent_contributions=agent_scores,
            attribution_timestamp=TimeHelper.current_timestamp(),
        )

        self.attributions[business_id] = attribution

        logger.info(
            f"Computed attribution for business '{business_id}': "
            f"quality={final_quality_score:.1f}, agents={len(agent_scores)}"
        )

        return attribution

    def _compute_action_contribution(
        self,
        action: Dict[str, Any],
        business_id: str,
        final_quality_score: float,
        action_index: int,
        total_actions: int,
    ) -> ActionContribution:
        """Compute contribution of a single action."""
        action_type_str = action.get("type", "unknown")
        agent = action.get("agent", "unknown")
        result = action.get("result", {})

        # Try to parse action type
        try:
            action_type = ActionType(action_type_str)
        except ValueError:
            action_type = ActionType.CODE_BUILD  # Default

        # Base contribution from agent weight
        base_weight = AGENT_BASE_WEIGHTS.get(agent, 0.05)

        # Compute counterfactual delta
        features = action.get("features", [])
        counterfactual_delta = self.counterfactual_reasoner.estimate_counterfactual_delta(
            action_type,
            final_quality_score,
            features,
        )

        # Apply decay based on position (earlier actions more important)
        decay = ATTRIBUTION_DECAY_FACTOR ** action_index
        decayed_delta = counterfactual_delta * decay

        # Final contribution score
        # Contribution = base weight (agent importance) + counterfactual delta (quality impact)
        # This gives domain agents (15%) a 15-95 contribution depending on impact
        contribution_score = min(
            (base_weight * 100.0) + (decayed_delta * 0.5),
            100.0,
        )

        # Explanation
        explanation = (
            f"{action_type_str} by {agent}: "
            f"base_weight={base_weight:.1%}, "
            f"counterfactual_delta={counterfactual_delta:.1f}, "
            f"decay={decay:.2f}"
        )

        return ActionContribution(
            action_id=action.get("id", f"action_{business_id}_{action_index}"),
            action_type=action_type,
            agent=agent,
            business_id=business_id,
            timestamp=TimeHelper.current_timestamp(),
            contribution_score=contribution_score,
            explanation=explanation,
            counterfactual_delta=counterfactual_delta,
        )

    def get_high_impact_actions(
        self,
        min_contribution: float = 50.0,
    ) -> List[ActionContribution]:
        """Get all high-impact actions across all businesses."""
        high_impact = []

        for attribution in self.attributions.values():
            for action_contrib in attribution.action_contributions:
                if action_contrib.contribution_score >= min_contribution:
                    high_impact.append(action_contrib)

        # Sort by contribution (highest first)
        high_impact.sort(key=lambda a: a.contribution_score, reverse=True)

        return high_impact

    def get_low_impact_actions(
        self,
        max_contribution: float = 30.0,
    ) -> List[ActionContribution]:
        """Get all low-impact actions (targets for improvement)."""
        low_impact = []

        for attribution in self.attributions.values():
            for action_contrib in attribution.action_contributions:
                if action_contrib.contribution_score <= max_contribution:
                    low_impact.append(action_contrib)

        # Sort by contribution (lowest first)
        low_impact.sort(key=lambda a: a.contribution_score)

        return low_impact

    def get_attribution(self, business_id: str) -> Optional[BusinessAttribution]:
        """Get attribution for a specific business."""
        return self.attributions.get(business_id)

    def export_attributions(self) -> List[Dict[str, Any]]:
        """Export all attributions as dicts."""
        return [attr.to_dict() for attr in self.attributions.values()]


def get_attribution_engine() -> AttributionEngine:
    """Get or create global attribution engine."""
    return AttributionEngine()
