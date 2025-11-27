"""
AgentEvolver Configuration

Central configuration for all AgentEvolver components:
- Self-Questioning curiosity thresholds
- Experience buffer size limits
- Attribution computation parameters
- Integration settings

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
"""

from dataclasses import dataclass
from typing import Dict, List

# Phase 1: Self-Questioning
NOVELTY_SCORE_THRESHOLD = 70.0  # Minimum novelty score (0-100) to consider "novel"
EXPLORATION_FRONTIER_UPDATE_INTERVAL = 3600  # Update frontier every hour
CURIOSITY_GENERATION_COUNT = 100  # Generate 100 novel ideas per day
BUSINESS_COVERAGE_TARGET = 0.95  # Target 95% coverage of business types

# Business types to track
BUSINESS_TYPES = [
    "saas",
    "ecommerce",
    "content",
    "marketplace",
    "subscription",
    "automation",
    "analytics",
    "community",
    "education",
    "fintech",
]

# Industry domains to track
INDUSTRY_DOMAINS = [
    "healthcare",
    "fintech",
    "education",
    "agriculture",
    "real_estate",
    "retail",
    "manufacturing",
    "transportation",
    "entertainment",
    "travel",
]

# Phase 2: Self-Navigating (Experience Reuse)
EXPERIENCE_BUFFER_SIZE = 10000  # Store top 10,000 trajectories
EXPLOIT_RATIO = 0.80  # 80% exploit (reuse experiences)
EXPLORE_RATIO = 0.20  # 20% explore (try new approaches)
TRAJECTORY_SIMILARITY_THRESHOLD = 0.7  # Use if similarity >70%
TOP_SIMILAR_TRAJECTORIES = 5  # Return top-5 most relevant

# Experience buffer storage
EXPERIENCE_STORAGE_PATH = "data/agentevolver/experience_buffer.jsonl"
EXPERIENCE_ARCHIVE_PATH = "data/agentevolver/archive/"

# Phase 3: Self-Attributing (Credit Assignment)
ATTRIBUTION_SCORE_MIN = 0.0
ATTRIBUTION_SCORE_MAX = 100.0
QUALITY_THRESHOLD_HIGH = 90.0  # Businesses scoring >90 are "high-quality"
QUALITY_THRESHOLD_LOW = 50.0   # Businesses scoring <50 are "failures"

# Attribution weights for different agents
# These are base weights - actual contribution may vary
AGENT_BASE_WEIGHTS = {
    "domain_name_agent": 0.15,  # Domain registration importance
    "domain_agent": 0.15,       # Alias for domain_name_agent
    "seo_agent": 0.20,          # SEO impact on visibility
    "marketing_agent": 0.25,    # Marketing drives customer acquisition
    "builder_agent": 0.20,      # Technical quality
    "content_agent": 0.10,      # Content quality
    "qa_agent": 0.07,           # Quality assurance
    "deploy_agent": 0.03,       # Deployment success
    "monitor_agent": 0.02,      # Monitoring
}

# Counterfactual reasoning parameters
COUNTERFACTUAL_SAMPLE_SIZE = 10  # Compare to 10 similar businesses without this action
ATTRIBUTION_DECAY_FACTOR = 0.95  # Discount contribution of earlier steps

# Phase 4: Integration
DAILY_SCENARIO_GENERATION_TARGET = 100  # Generate 100 scenarios per day
SCENARIO_DIVERSITY_THRESHOLD = 0.70  # Reject if diversity <70%
SCENARIO_DIFFICULTY_MIN = 2  # Minimum complexity (1-10 scale)
SCENARIO_DIFFICULTY_MAX = 7  # Maximum complexity (start easy, progress to hard)
ARCHIVE_SIZE_LIMIT = 10000  # Keep last 10,000 scenarios

# Logging
LOG_LEVEL = "INFO"
LOG_FILE = "logs/agentevolver.log"

# Performance tuning
EMBEDDING_BATCH_SIZE = 32  # Batch size for TEI embeddings
SIMILARITY_SEARCH_LIMIT = 5000  # Search top-5000 for similarity (faster)
ASYNC_BATCH_SIZE = 10  # Concurrent tasks

# Integration flags
ENABLE_DREAMGYM_INTEGRATION = True  # Push scenarios to DreamGym
ENABLE_TRAJECTORY_POOL_INTEGRATION = True  # Store in TrajectoryPool
ENABLE_SE_DARWIN_INTEGRATION = True  # Feed to ES training
ENABLE_BUSINESS_MONITOR_INTEGRATION = True  # Track metrics

# Feature flags
ENABLE_SELF_QUESTIONING = True  # Generate novel business ideas
ENABLE_SELF_NAVIGATING = True  # Reuse experiences
ENABLE_SELF_ATTRIBUTING = True  # Calculate contribution scores
ENABLE_QUALITY_FILTERING = True  # Filter low-quality scenarios

@dataclass
class AgentEvolverConfig:
    """Runtime configuration for AgentEvolver."""
    # Phase 1
    novelty_threshold: float = NOVELTY_SCORE_THRESHOLD
    curiosity_generation_count: int = CURIOSITY_GENERATION_COUNT
    coverage_target: float = BUSINESS_COVERAGE_TARGET

    # Phase 2
    buffer_size: int = EXPERIENCE_BUFFER_SIZE
    exploit_ratio: float = EXPLOIT_RATIO
    explore_ratio: float = EXPLORE_RATIO
    similarity_threshold: float = TRAJECTORY_SIMILARITY_THRESHOLD

    # Phase 3
    attribution_max: float = ATTRIBUTION_SCORE_MAX
    quality_threshold_high: float = QUALITY_THRESHOLD_HIGH
    quality_threshold_low: float = QUALITY_THRESHOLD_LOW

    # Phase 4
    daily_target: int = DAILY_SCENARIO_GENERATION_TARGET
    diversity_threshold: float = SCENARIO_DIVERSITY_THRESHOLD
    archive_limit: int = ARCHIVE_SIZE_LIMIT

    # Feature flags
    enable_all_phases: bool = True

    def __post_init__(self):
        """Validate configuration after initialization."""
        assert 0.0 <= self.novelty_threshold <= 100.0, "novelty_threshold must be 0-100"
        assert 0.0 <= self.exploit_ratio <= 1.0, "exploit_ratio must be 0-1"
        assert 0.0 <= self.explore_ratio <= 1.0, "explore_ratio must be 0-1"
        assert self.exploit_ratio + self.explore_ratio == 1.0, "exploit + explore must equal 1.0"
        assert 0.0 <= self.coverage_target <= 1.0, "coverage_target must be 0-1"
        assert 0.0 <= self.similarity_threshold <= 1.0, "similarity_threshold must be 0-1"


def get_config() -> AgentEvolverConfig:
    """Get AgentEvolver configuration."""
    return AgentEvolverConfig()
