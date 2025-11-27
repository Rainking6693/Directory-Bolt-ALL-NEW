"""
AgentEvolver Phase 1: Self-Questioning (Curiosity-Driven Task Generation)

Enables agents to autonomously generate novel business ideas without manual intervention.

Key Features:
- Curiosity scoring: Rank business ideas by novelty (0-100)
- Exploration frontier: Track unexplored business types/domains
- Question templates: "What if we built X for Y industry?"
- Generates 100+ novel business ideas per day

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 1
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    NOVELTY_SCORE_THRESHOLD,
    BUSINESS_TYPES,
    INDUSTRY_DOMAINS,
    CURIOSITY_GENERATION_COUNT,
)
from infrastructure.agentevolver.utils import (
    IdGenerator,
    TimeHelper,
    MetricsHelper,
    DataSerializer,
)

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class NoveltyScore:
    """Curiosity score for a business idea."""
    idea_id: str
    name: str
    description: str
    novelty_score: float  # 0-100
    business_type: str
    domain: str
    created_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "idea_id": self.idea_id,
            "name": self.name,
            "description": self.description,
            "novelty_score": self.novelty_score,
            "business_type": self.business_type,
            "domain": self.domain,
            "created_at": self.created_at,
        }


@dataclass
class ExplorationFrontier:
    """Tracks unexplored business types and domains."""
    business_types_explored: Dict[str, int] = field(default_factory=dict)
    domains_explored: Dict[str, int] = field(default_factory=dict)
    last_update: str = field(default_factory=TimeHelper.current_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "business_types_explored": self.business_types_explored,
            "domains_explored": self.domains_explored,
            "last_update": self.last_update,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExplorationFrontier":
        """Create from dictionary."""
        return cls(
            business_types_explored=data.get("business_types_explored", {}),
            domains_explored=data.get("domains_explored", {}),
            last_update=data.get("last_update", TimeHelper.current_timestamp()),
        )


class CuriosityScorer:
    """Scores business ideas based on novelty and uniqueness."""

    def __init__(self, existing_ideas: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize curiosity scorer.

        Args:
            existing_ideas: List of existing business ideas to compare against
        """
        self.existing_ideas = existing_ideas or []
        logger.info(f"CuriosityScorer initialized with {len(self.existing_ideas)} existing ideas")

    def score_novelty(self, idea: Dict[str, Any]) -> float:
        """
        Score novelty of a business idea (0-100).

        Factors:
        - Uniqueness vs existing ideas
        - Uncommon business type + domain combination
        - Novel feature combinations

        Args:
            idea: Business idea dict with name, description, etc.

        Returns:
            Novelty score (0-100)
        """
        scores = []

        # 1. Uniqueness vs existing ideas (40% weight)
        uniqueness = self._compute_uniqueness(idea)
        scores.append(uniqueness * 0.40)

        # 2. Uncommon business type + domain combination (30% weight)
        combination_novelty = self._compute_combination_novelty(
            idea.get("business_type", ""),
            idea.get("domain", "unknown"),
        )
        scores.append(combination_novelty * 0.30)

        # 3. Feature novelty (20% weight)
        feature_novelty = self._compute_feature_novelty(
            idea.get("mvp_features", [])
        )
        scores.append(feature_novelty * 0.20)

        # 4. Description uniqueness (10% weight)
        description_novelty = self._compute_description_novelty(
            idea.get("description", "")
        )
        scores.append(description_novelty * 0.10)

        novelty_score = sum(scores)
        logger.debug(f"Scored '{idea.get('name')}': novelty={novelty_score:.1f}/100")

        return novelty_score

    def _compute_uniqueness(self, idea: Dict[str, Any]) -> float:
        """Compute how unique this idea is vs existing ideas."""
        if not self.existing_ideas:
            return 100.0  # Novel if no comparisons

        idea_desc = f"{idea.get('name', '')} {idea.get('description', '')}".lower()
        max_similarity = 0.0

        for existing in self.existing_ideas:
            existing_desc = (
                f"{existing.get('name', '')} {existing.get('description', '')}"
            ).lower()

            # Simple word overlap similarity
            idea_words = set(idea_desc.split())
            existing_words = set(existing_desc.split())

            if not idea_words or not existing_words:
                continue

            intersection = len(idea_words & existing_words)
            union = len(idea_words | existing_words)
            similarity = intersection / union if union > 0 else 0.0

            max_similarity = max(max_similarity, similarity)

        # Convert to novelty score: low similarity = high novelty
        novelty = (1.0 - max_similarity) * 100.0
        return novelty

    def _compute_combination_novelty(
        self, business_type: str, domain: str
    ) -> float:
        """Compute novelty of business type + domain combination."""
        # Count how many existing ideas use this combination
        combination_count = 0

        for existing in self.existing_ideas:
            if (
                existing.get("business_type", "").lower() == business_type.lower()
                and existing.get("domain", "").lower() == domain.lower()
            ):
                combination_count += 1

        # Inverse: more existing = less novel
        if combination_count == 0:
            return 100.0  # Very novel - no existing combinations
        elif combination_count == 1:
            return 70.0  # Some existing
        elif combination_count < 5:
            return 50.0  # Multiple existing
        else:
            return 30.0  # Many existing

    def _compute_feature_novelty(self, features: List[str]) -> float:
        """Compute novelty of feature combination."""
        if not features:
            return 50.0

        # Count feature occurrences in existing ideas
        feature_frequencies = {}

        for existing in self.existing_ideas:
            for feat in existing.get("mvp_features", []):
                key = feat.lower()
                feature_frequencies[key] = feature_frequencies.get(key, 0) + 1

        # Compute novelty: rare features = high novelty
        feature_novelties = []

        for feature in features:
            key = feature.lower()
            freq = feature_frequencies.get(key, 0)

            # Inverse frequency: common = low novelty
            if freq == 0:
                feature_novelties.append(100.0)  # Rare feature
            elif freq == 1:
                feature_novelties.append(75.0)
            elif freq < 5:
                feature_novelties.append(50.0)
            else:
                feature_novelties.append(25.0)  # Common feature

        return sum(feature_novelties) / len(feature_novelties) if feature_novelties else 50.0

    def _compute_description_novelty(self, description: str) -> float:
        """Compute novelty of description text."""
        if not description:
            return 50.0

        desc_lower = description.lower()
        matching_descriptions = 0

        for existing in self.existing_ideas:
            existing_desc = existing.get("description", "").lower()
            if existing_desc and desc_lower in existing_desc or existing_desc in desc_lower:
                matching_descriptions += 1

        # Inverse: more matches = less novel
        novelty = max(0.0, 100.0 - (matching_descriptions * 10.0))
        return novelty


class ExplorationFrontierTracker:
    """Tracks and manages the exploration frontier of business types and domains."""

    def __init__(self):
        """Initialize frontier tracker."""
        self.frontier = ExplorationFrontier()
        # Initialize all business types and domains with 0 exploration
        for btype in BUSINESS_TYPES:
            self.frontier.business_types_explored[btype] = 0
        for domain in INDUSTRY_DOMAINS:
            self.frontier.domains_explored[domain] = 0
        logger.info(f"ExplorationFrontierTracker initialized")

    def record_exploration(self, business_type: str, domain: str) -> None:
        """
        Record that we've explored a business type + domain combination.

        Args:
            business_type: Business type explored
            domain: Industry domain explored
        """
        key_type = business_type.lower()
        key_domain = domain.lower()

        if key_type in self.frontier.business_types_explored:
            self.frontier.business_types_explored[key_type] += 1
        else:
            self.frontier.business_types_explored[key_type] = 1

        if key_domain in self.frontier.domains_explored:
            self.frontier.domains_explored[key_domain] += 1
        else:
            self.frontier.domains_explored[key_domain] = 1

        self.frontier.last_update = TimeHelper.current_timestamp()

    def get_coverage(self) -> float:
        """
        Get overall exploration coverage (0-1).

        Returns:
            Coverage percentage
        """
        if not BUSINESS_TYPES or not INDUSTRY_DOMAINS:
            return 0.0

        # Count types with at least 1 exploration
        types_explored = sum(1 for t in BUSINESS_TYPES if self.frontier.business_types_explored.get(t, 0) > 0)
        types_coverage = types_explored / len(BUSINESS_TYPES)

        # Count domains with at least 1 exploration
        domains_explored = sum(1 for d in INDUSTRY_DOMAINS if self.frontier.domains_explored.get(d, 0) > 0)
        domains_coverage = domains_explored / len(INDUSTRY_DOMAINS)

        # Average coverage
        return (types_coverage + domains_coverage) / 2.0

    def get_unexplored(self) -> Dict[str, List[str]]:
        """
        Get unexplored business types and domains.

        Returns:
            Dict with 'business_types' and 'domains' lists
        """
        unexplored_types = [
            t for t in BUSINESS_TYPES
            if self.frontier.business_types_explored.get(t, 0) == 0
        ]
        unexplored_domains = [
            d for d in INDUSTRY_DOMAINS
            if self.frontier.domains_explored.get(d, 0) == 0
        ]

        return {
            "business_types": unexplored_types,
            "domains": unexplored_domains,
        }

    def get_frontier_status(self) -> Dict[str, Any]:
        """Get current frontier status."""
        return {
            "coverage": self.get_coverage(),
            "unexplored": self.get_unexplored(),
            "business_types_explored": self.frontier.business_types_explored,
            "domains_explored": self.frontier.domains_explored,
            "last_update": self.frontier.last_update,
        }


class SelfQuestioningModule:
    """
    Phase 1: Self-Questioning - Curiosity-Driven Task Generation

    Autonomously generates novel business ideas without manual intervention.
    """

    def __init__(self, existing_ideas: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize self-questioning module.

        Args:
            existing_ideas: List of existing business ideas for novelty comparison
        """
        self.existing_ideas = existing_ideas or []
        self.curiosity_scorer = CuriosityScorer(self.existing_ideas)
        self.frontier_tracker = ExplorationFrontierTracker()
        self.generated_ideas: List[NoveltyScore] = []

        logger.info(
            f"SelfQuestioningModule initialized with {len(self.existing_ideas)} "
            f"existing ideas and coverage={self.frontier_tracker.get_coverage():.1%}"
        )

    async def generate_novel_ideas(
        self,
        count: int = CURIOSITY_GENERATION_COUNT,
        min_novelty: float = NOVELTY_SCORE_THRESHOLD,
    ) -> List[NoveltyScore]:
        """
        Generate novel business ideas using self-questioning.

        Args:
            count: Number of novel ideas to generate
            min_novelty: Minimum novelty score threshold (0-100)

        Returns:
            List of NoveltyScore objects for ideas meeting threshold
        """
        logger.info(f"Generating {count} novel business ideas (min_novelty={min_novelty})")

        # Import here to avoid circular dependency
        from infrastructure.business_idea_generator import get_idea_generator

        generator = get_idea_generator()

        novel_ideas = []
        attempts = 0
        max_attempts = count * 3  # Try 3x to find enough novel ideas

        while len(novel_ideas) < count and attempts < max_attempts:
            try:
                # Generate an idea
                idea = await generator.generate_idea(min_revenue_score=60.0)

                # Determine business type from idea
                business_type = idea.business_type
                domain = self._infer_domain(idea.description)

                # Score novelty
                novelty_score = self.curiosity_scorer.score_novelty({
                    "name": idea.name,
                    "description": idea.description,
                    "business_type": business_type,
                    "domain": domain,
                    "mvp_features": idea.mvp_features,
                })

                if novelty_score >= min_novelty:
                    # Create NoveltyScore record
                    score_obj = NoveltyScore(
                        idea_id=IdGenerator.idea_id(),
                        name=idea.name,
                        description=idea.description,
                        novelty_score=novelty_score,
                        business_type=business_type,
                        domain=domain,
                        created_at=TimeHelper.current_timestamp(),
                    )

                    novel_ideas.append(score_obj)
                    self.frontier_tracker.record_exploration(business_type, domain)

                    logger.info(
                        f"Generated novel idea: '{idea.name}' "
                        f"(novelty={novelty_score:.1f}, domain={domain})"
                    )

                attempts += 1

            except Exception as e:
                logger.warning(f"Failed to generate idea: {e}")
                attempts += 1
                continue

        self.generated_ideas.extend(novel_ideas)

        logger.info(
            f"Generated {len(novel_ideas)}/{count} novel ideas "
            f"in {attempts} attempts. Coverage={self.frontier_tracker.get_coverage():.1%}"
        )

        return novel_ideas

    def _infer_domain(self, description: str) -> str:
        """
        Infer industry domain from business description.

        Args:
            description: Business description

        Returns:
            Inferred domain (or 'general' if unknown)
        """
        description_lower = description.lower()

        # Simple keyword matching
        domain_keywords = {
            "healthcare": ["health", "medical", "doctor", "patient", "hospital", "clinic"],
            "fintech": ["finance", "payment", "banking", "investment", "trading", "crypto"],
            "education": ["education", "learning", "course", "student", "teacher", "school"],
            "agriculture": ["agriculture", "farming", "crop", "farm", "harvest"],
            "real_estate": ["real estate", "property", "house", "apartment", "rent"],
            "retail": ["retail", "store", "shop", "ecommerce", "shopping"],
            "manufacturing": ["manufacturing", "factory", "production", "industrial"],
            "transportation": ["transportation", "delivery", "logistics", "shipping"],
            "entertainment": ["entertainment", "music", "video", "gaming", "streaming"],
            "travel": ["travel", "tourism", "hotel", "booking", "flight"],
        }

        for domain, keywords in domain_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                return domain

        return "general"

    def get_frontier_status(self) -> Dict[str, Any]:
        """Get current frontier exploration status."""
        return self.frontier_tracker.get_frontier_status()

    def get_coverage(self) -> float:
        """Get overall exploration coverage (0-1)."""
        return self.frontier_tracker.get_coverage()

    def prioritize_unexplored(self) -> Dict[str, List[str]]:
        """
        Get unexplored business types and domains to prioritize next.

        Returns:
            Dict with unexplored types and domains
        """
        return self.frontier_tracker.get_unexplored()

    def export_generated_ideas(self) -> List[Dict[str, Any]]:
        """Export all generated ideas as dicts."""
        return [idea.to_dict() for idea in self.generated_ideas]


def get_self_questioning_module(
    existing_ideas: Optional[List[Dict[str, Any]]] = None,
) -> SelfQuestioningModule:
    """Get or create self-questioning module."""
    return SelfQuestioningModule(existing_ideas)


# Helper function for easy ID generation (used in NoveltyScore)
def idea_id_generator() -> str:
    """Generate unique idea ID."""
    return f"idea_{IdGenerator.scenario_id()}"


# Add to IdGenerator class
IdGenerator.idea_id = staticmethod(idea_id_generator)
