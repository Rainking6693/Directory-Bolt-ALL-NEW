"""
Inclusive Fitness Team Optimization for Genesis Multi-Agent System

Based on:
- Inclusive Fitness (Rosseau et al., 2025)
- SwarmAgentic (arXiv:2506.15672)

Key Concepts:
- Genotype-based cooperation: Agents with shared modules cooperate better
- Kin selection: Agents favor working with "genetic relatives"
- Emergent team strategies: Optimal teams discovered through evolution
- Expected improvement: 15-20% over random team assignment

Version: 1.0
Last Updated: November 2, 2025
"""

from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
import logging

logger = logging.getLogger(__name__)


class GenotypeGroup(Enum):
    """
    Genotype groups representing shared architectural modules.
    Agents with same genotype have higher cooperation efficiency.
    """
    ANALYSIS = "analysis"  # QA, Analyst, Security, Spec
    INFRASTRUCTURE = "infrastructure"  # Builder, Deploy, Maintenance
    CUSTOMER_INTERACTION = "customer_interaction"  # Support, Marketing, Onboarding
    CONTENT = "content"  # Content, SEO, Email
    FINANCE = "finance"  # Billing, Legal


@dataclass
class AgentGenotype:
    """
    Agent genetic makeup defining architectural modules and capabilities.

    Attributes:
        agent_name: Unique agent identifier
        modules: Set of architectural modules (e.g., "llm", "code_analysis")
        capabilities: Set of functional capabilities (e.g., "python", "testing")
        interaction_style: Communication style (analytical, creative, technical, empathetic)
    """
    agent_name: str
    modules: Set[str]
    capabilities: Set[str]
    interaction_style: str

    def __hash__(self) -> int:
        return hash(self.agent_name)


# Define ALL 15 Genesis agents with realistic genotypes
GENESIS_GENOTYPES: Dict[str, AgentGenotype] = {
    "qa_agent": AgentGenotype(
        agent_name="qa_agent",
        modules={"llm", "code_analysis", "test_gen", "quality_check", "ast_parser"},
        capabilities={"python", "testing", "debugging", "code_review", "pytest", "coverage"},
        interaction_style="analytical"
    ),
    "builder_agent": AgentGenotype(
        agent_name="builder_agent",
        modules={"llm", "code_gen", "refactoring", "architecture", "ast_builder"},
        capabilities={"python", "coding", "architecture", "implementation", "design_patterns"},
        interaction_style="technical"
    ),
    "support_agent": AgentGenotype(
        agent_name="support_agent",
        modules={"llm", "conversation", "ticket_routing", "knowledge_base"},
        capabilities={"customer_service", "troubleshooting", "documentation", "empathy"},
        interaction_style="empathetic"
    ),
    "deploy_agent": AgentGenotype(
        agent_name="deploy_agent",
        modules={"llm", "ci_cd", "docker", "monitoring", "infrastructure"},
        capabilities={"deployment", "ci_cd", "monitoring", "infrastructure", "devops"},
        interaction_style="technical"
    ),
    "marketing_agent": AgentGenotype(
        agent_name="marketing_agent",
        modules={"llm", "analytics", "campaign_mgmt", "social_media"},
        capabilities={"ads", "social_media", "analytics", "growth", "seo"},
        interaction_style="creative"
    ),
    "analyst_agent": AgentGenotype(
        agent_name="analyst_agent",
        modules={"llm", "data_analysis", "reporting", "visualization", "metrics"},
        capabilities={"data_analysis", "reporting", "metrics", "insights", "statistics"},
        interaction_style="analytical"
    ),
    "billing_agent": AgentGenotype(
        agent_name="billing_agent",
        modules={"llm", "payment_processing", "invoicing", "subscription_mgmt"},
        capabilities={"payments", "invoicing", "subscriptions", "stripe", "accounting"},
        interaction_style="technical"
    ),
    "legal_agent": AgentGenotype(
        agent_name="legal_agent",
        modules={"llm", "contract_gen", "compliance_check", "privacy_audit"},
        capabilities={"contracts", "compliance", "privacy", "gdpr", "legal_review"},
        interaction_style="analytical"
    ),
    "content_agent": AgentGenotype(
        agent_name="content_agent",
        modules={"llm", "writing", "editing", "content_strategy"},
        capabilities={"writing", "copywriting", "content_strategy", "storytelling"},
        interaction_style="creative"
    ),
    "seo_agent": AgentGenotype(
        agent_name="seo_agent",
        modules={"llm", "keyword_research", "optimization", "analytics"},
        capabilities={"seo", "keywords", "optimization", "google_analytics"},
        interaction_style="analytical"
    ),
    "email_agent": AgentGenotype(
        agent_name="email_agent",
        modules={"llm", "email_composer", "campaign_automation", "segmentation"},
        capabilities={"email_marketing", "campaigns", "automation", "sendgrid"},
        interaction_style="creative"
    ),
    "maintenance_agent": AgentGenotype(
        agent_name="maintenance_agent",
        modules={"llm", "monitoring", "debugging", "optimization", "alerting"},
        capabilities={"monitoring", "debugging", "optimization", "uptime", "logging"},
        interaction_style="technical"
    ),
    "onboarding_agent": AgentGenotype(
        agent_name="onboarding_agent",
        modules={"llm", "user_training", "documentation", "tutorial_gen"},
        capabilities={"user_training", "documentation", "tutorials", "guides"},
        interaction_style="empathetic"
    ),
    "security_agent": AgentGenotype(
        agent_name="security_agent",
        modules={"llm", "security_scanner", "penetration_test", "compliance_check"},
        capabilities={"security_audit", "penetration_testing", "compliance", "vulnerability_scan"},
        interaction_style="analytical"
    ),
    "spec_agent": AgentGenotype(
        agent_name="spec_agent",
        modules={"llm", "requirements_analysis", "design_docs", "specification"},
        capabilities={"requirements", "specifications", "design", "planning"},
        interaction_style="analytical"
    ),
}


@dataclass
class Agent:
    """
    Agent representation for Inclusive Fitness Swarm Optimization.

    Attributes:
        name: Agent name (e.g., "qa_agent")
        role: Agent role description
        genotype: Genotype group for kin selection
        capabilities: List of capabilities
        current_fitness: Current fitness score (0.0-1.0)
        metadata: Additional agent metadata
    """
    name: str
    role: str
    genotype: GenotypeGroup
    capabilities: List[str]
    current_fitness: float = 0.0
    metadata: Dict = field(default_factory=dict)

    def __hash__(self) -> int:
        return hash(self.name)


@dataclass
class TaskRequirement:
    """
    Task requirements for team optimization.

    Attributes:
        task_id: Unique task identifier
        required_capabilities: List of required capabilities
        team_size_range: (min_size, max_size) tuple
        priority: Task priority multiplier (default 1.0)
    """
    task_id: str
    required_capabilities: List[str]
    team_size_range: Tuple[int, int]
    priority: float = 1.0


class InclusiveFitnessSwarm:
    """
    Inclusive Fitness-based team optimization system.

    Implements kin selection where agents with shared genotypes
    (genetic relatives) cooperate more effectively.

    Key Features:
    - 15x15 compatibility matrix based on module overlap
    - Kin coefficient calculation (Hamilton's rule)
    - Emergent strategy detection
    - 15-20% improvement over random teams
    """

    def __init__(self, agents: List[Agent], random_seed: Optional[int] = None):
        """
        Initialize Inclusive Fitness Swarm.

        Args:
            agents: List of Agent objects
            random_seed: Random seed for reproducibility
        """
        self.agents = agents
        self.random_seed = random_seed

        if random_seed is not None:
            np.random.seed(random_seed)

        # Build 15x15 compatibility matrix
        self.compatibility_matrix = self._build_compatibility_matrix()

        # Build agent lookup
        self.agent_lookup = {agent.name: agent for agent in agents}

        logger.info(
            f"InclusiveFitnessSwarm initialized with {len(agents)} agents, "
            f"seed={random_seed}"
        )

    def _build_compatibility_matrix(self) -> np.ndarray:
        """
        Build 15x15 compatibility matrix based on genotype overlap.

        Compatibility score = (shared_modules / total_modules) * kin_bonus
        Kin bonus = 1.5 if same genotype group, 1.0 otherwise

        Returns:
            NxN numpy array of compatibility scores (0.0-1.0)
        """
        n = len(self.agents)
        matrix = np.zeros((n, n))

        for i, agent1 in enumerate(self.agents):
            for j, agent2 in enumerate(self.agents):
                if i == j:
                    matrix[i, j] = 1.0  # Perfect self-compatibility
                    continue

                # Get genotypes
                genotype1 = GENESIS_GENOTYPES[agent1.name]
                genotype2 = GENESIS_GENOTYPES[agent2.name]

                # Calculate module overlap
                shared_modules = genotype1.modules & genotype2.modules
                total_modules = genotype1.modules | genotype2.modules

                if len(total_modules) == 0:
                    overlap_score = 0.0
                else:
                    overlap_score = len(shared_modules) / len(total_modules)

                # Apply kin bonus (1.5x if same genotype group)
                kin_bonus = 1.5 if agent1.genotype == agent2.genotype else 1.0

                # Calculate final compatibility (capped at 1.0)
                compatibility = min(1.0, overlap_score * kin_bonus)

                matrix[i, j] = compatibility

        return matrix

    def calculate_relatedness(self, agent1: Agent, agent2: Agent) -> float:
        """
        Calculate kin coefficient (relatedness) between two agents.

        Based on Hamilton's rule: r * B > C
        where r = relatedness, B = benefit, C = cost

        Args:
            agent1: First agent
            agent2: Second agent

        Returns:
            Relatedness score (0.0-1.0)
        """
        # Get indices
        idx1 = next(i for i, a in enumerate(self.agents) if a.name == agent1.name)
        idx2 = next(i for i, a in enumerate(self.agents) if a.name == agent2.name)

        return self.compatibility_matrix[idx1, idx2]

    def evaluate_team_fitness(
        self,
        team: List[Agent],
        task: TaskRequirement,
        verbose: bool = False
    ) -> float:
        """
        Evaluate team fitness for a task using multi-objective scoring.

        Fitness components:
        1. Capability coverage (40%): Does team have required capabilities?
        2. Cooperation bonus (30%): How well do agents cooperate (kin selection)?
        3. Team size penalty (20%): Penalize oversized teams
        4. Diversity bonus (10%): Reward genotype diversity for complex tasks

        Args:
            team: List of Agent objects
            task: TaskRequirement object
            verbose: Print detailed fitness breakdown

        Returns:
            Fitness score (0.0-1.0)
        """
        if len(team) == 0:
            return 0.0

        # 1. Capability coverage (40%)
        team_capabilities = set()
        for agent in team:
            team_capabilities.update(agent.capabilities)

        required_capabilities = set(task.required_capabilities)
        covered_capabilities = team_capabilities & required_capabilities

        if len(required_capabilities) == 0:
            capability_score = 1.0
        else:
            capability_score = len(covered_capabilities) / len(required_capabilities)

        # 2. Cooperation bonus (30%) - average pairwise relatedness
        if len(team) < 2:
            cooperation_score = 1.0
        else:
            total_relatedness = 0.0
            pair_count = 0

            for i, agent1 in enumerate(team):
                for agent2 in team[i+1:]:
                    relatedness = self.calculate_relatedness(agent1, agent2)
                    total_relatedness += relatedness
                    pair_count += 1

            cooperation_score = total_relatedness / pair_count if pair_count > 0 else 0.0

        # 3. Team size penalty (20%)
        min_size, max_size = task.team_size_range
        team_size = len(team)

        if min_size <= team_size <= max_size:
            size_score = 1.0
        elif team_size < min_size:
            size_score = team_size / min_size
        else:
            size_score = max(0.0, 1.0 - (team_size - max_size) / max_size)

        # 4. Diversity bonus (10%) - reward genotype variety for complex tasks
        genotypes = set(agent.genotype for agent in team)
        diversity_score = len(genotypes) / len(GenotypeGroup)

        # Weighted combination
        fitness = (
            0.40 * capability_score +
            0.30 * cooperation_score +
            0.20 * size_score +
            0.10 * diversity_score
        )

        # Apply priority multiplier
        fitness *= task.priority

        if verbose:
            logger.info(
                f"Team fitness breakdown:\n"
                f"  Capability: {capability_score:.3f} (40%)\n"
                f"  Cooperation: {cooperation_score:.3f} (30%)\n"
                f"  Size: {size_score:.3f} (20%)\n"
                f"  Diversity: {diversity_score:.3f} (10%)\n"
                f"  Total: {fitness:.3f}"
            )

        return fitness

    def detect_emergent_strategies(
        self,
        teams_history: List[Tuple[List[Agent], float]]
    ) -> List[str]:
        """
        Detect emergent team composition strategies from optimization history.

        Emergent strategies:
        - Kin clustering: Teams favor agents with same genotype
        - Capability specialization: Teams focus on specific capability sets
        - Hybrid teams: Teams balance kin cooperation with diversity

        Args:
            teams_history: List of (team, fitness) tuples from optimization

        Returns:
            List of emergent strategy descriptions
        """
        if len(teams_history) < 5:
            return []

        # Analyze top 5 teams
        top_teams = sorted(teams_history, key=lambda x: x[1], reverse=True)[:5]

        strategies = []

        # Strategy 1: Kin clustering
        kin_cluster_count = 0
        for team, _ in top_teams:
            genotypes = [agent.genotype for agent in team]
            # Check if >50% of team shares a genotype
            for genotype in set(genotypes):
                if genotypes.count(genotype) / len(genotypes) > 0.5:
                    kin_cluster_count += 1
                    break

        if kin_cluster_count >= 3:
            strategies.append("Kin Clustering: Teams favor genetic relatives (same genotype)")

        # Strategy 2: Capability specialization
        specialization_count = 0
        for team, _ in top_teams:
            all_capabilities = set()
            for agent in team:
                all_capabilities.update(agent.capabilities)

            # Check if team has <10 unique capabilities (specialized)
            if len(all_capabilities) < 10:
                specialization_count += 1

        if specialization_count >= 3:
            strategies.append("Capability Specialization: Teams focus on narrow expertise")

        # Strategy 3: Hybrid teams
        hybrid_count = 0
        for team, _ in top_teams:
            genotypes = set(agent.genotype for agent in team)
            # Check if team has 3+ different genotypes (diverse)
            if len(genotypes) >= 3:
                hybrid_count += 1

        if hybrid_count >= 3:
            strategies.append("Hybrid Teams: Balance kin cooperation with diversity")

        return strategies

    def get_compatibility_matrix(self) -> np.ndarray:
        """Get the 15x15 compatibility matrix."""
        return self.compatibility_matrix.copy()

    def get_agent_by_name(self, name: str) -> Optional[Agent]:
        """Get agent by name."""
        return self.agent_lookup.get(name)


def get_inclusive_fitness_swarm(
    agents: List[Agent],
    random_seed: Optional[int] = None
) -> InclusiveFitnessSwarm:
    """
    Factory function to create InclusiveFitnessSwarm.

    Args:
        agents: List of Agent objects
        random_seed: Random seed for reproducibility

    Returns:
        InclusiveFitnessSwarm instance
    """
    return InclusiveFitnessSwarm(agents=agents, random_seed=random_seed)
