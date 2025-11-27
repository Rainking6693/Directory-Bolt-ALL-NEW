"""
SWARM-HALO INTEGRATION BRIDGE
Version: 1.0
Last Updated: November 2, 2025

Integration layer between Inclusive Fitness Swarm Optimizer and HALO Router.

Purpose:
- Convert HALO agent registry to Swarm Agent objects
- Use PSO to optimize team composition for complex tasks
- Provide team recommendations to HALO for multi-agent tasks

Integration Points:
1. HALO Router -> Swarm Bridge: Request optimal team for task
2. Swarm Bridge -> PSO: Optimize team composition
3. PSO -> HALO Router: Return optimized team
"""

import logging
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from infrastructure.swarm.inclusive_fitness import (
    Agent,
    GenotypeGroup,
    InclusiveFitnessSwarm,
    TaskRequirement,
    get_inclusive_fitness_swarm,
)
from infrastructure.swarm.team_optimizer import (
    ParticleSwarmOptimizer,
    get_pso_optimizer,
)

logger = logging.getLogger(__name__)


@dataclass
class AgentProfile:
    """
    Agent profile from HALO registry, compatible with Swarm Agent
    """
    name: str
    role: str
    capabilities: List[str]
    cost_tier: str  # "cheap", "medium", "expensive"
    success_rate: float = 0.0


class FitnessAuditLog:
    """
    Append-only audit log that records fitness score changes for agents.

    Each entry is hashed to make tampering evident during review.
    """

    def __init__(self, log_path: Optional[Path] = None):
        default_path = Path("logs/fitness_audit.log")
        self.log_path = log_path or default_path
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger("fitness_audit")

    def log_update(
        self,
        agent_name: str,
        old_value: float,
        new_value: float,
        source: str,
        task_id: Optional[str] = None
    ) -> None:
        timestamp = datetime.now(timezone.utc).isoformat()
        entry = f"{timestamp}|{agent_name}|{old_value:.6f}|{new_value:.6f}|{source}|{task_id or 'n/a'}"
        entry_hash = hashlib.sha256(entry.encode()).hexdigest()

        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{entry}|{entry_hash}\n")

        self.logger.info(
            "Fitness update logged for %s: %.4f -> %.4f (source=%s task=%s)",
            agent_name,
            old_value,
            new_value,
            source,
            task_id or "n/a",
        )


class SwarmHALOBridge:
    """
    Bridge between Inclusive Fitness Swarm Optimizer and HALO Router

    Converts HALO agents to Swarm agents and uses PSO for team optimization.
    """

    # Genesis 15-agent genotype mapping
    GENESIS_GENOTYPE_MAPPING = {
        "qa_agent": GenotypeGroup.ANALYSIS,
        "builder_agent": GenotypeGroup.INFRASTRUCTURE,
        "support_agent": GenotypeGroup.CUSTOMER_INTERACTION,
        "deploy_agent": GenotypeGroup.INFRASTRUCTURE,
        "marketing_agent": GenotypeGroup.CUSTOMER_INTERACTION,
        "analyst_agent": GenotypeGroup.ANALYSIS,
        "billing_agent": GenotypeGroup.FINANCE,
        "legal_agent": GenotypeGroup.FINANCE,
        "content_agent": GenotypeGroup.CONTENT,
        "seo_agent": GenotypeGroup.CONTENT,
        "email_agent": GenotypeGroup.CONTENT,
        "maintenance_agent": GenotypeGroup.INFRASTRUCTURE,
        "onboarding_agent": GenotypeGroup.CUSTOMER_INTERACTION,
        "security_agent": GenotypeGroup.ANALYSIS,
        "spec_agent": GenotypeGroup.ANALYSIS,
    }

    def __init__(
        self,
        agent_profiles: List[AgentProfile],
        n_particles: int = 20,
        max_iterations: int = 50,
        random_seed: Optional[int] = None
    ):
        """
        Initialize Swarm-HALO Bridge

        Args:
            agent_profiles: List of agent profiles from HALO registry
            n_particles: Number of PSO particles
            max_iterations: Maximum PSO iterations
            random_seed: Random seed for reproducibility
        """
        # Convert agent profiles to Swarm agents
        self.fitness_audit = FitnessAuditLog()
        self.swarm_agents = self._convert_to_swarm_agents(agent_profiles)

        # Create swarm
        self.swarm = get_inclusive_fitness_swarm(self.swarm_agents, random_seed=random_seed)

        # Create PSO optimizer
        self.pso = get_pso_optimizer(
            self.swarm,
            n_particles=n_particles,
            max_iterations=max_iterations,
            random_seed=random_seed
        )

        logger.info(
            f"SwarmHALOBridge initialized with {len(self.swarm_agents)} agents, "
            f"{n_particles} particles, {max_iterations} iterations"
        )

    def _convert_to_swarm_agents(self, profiles: List[AgentProfile]) -> List[Agent]:
        """
        Convert HALO agent profiles to Swarm Agent objects

        Args:
            profiles: List of AgentProfile objects from HALO

        Returns:
            List of Swarm Agent objects with genotypes assigned
        """
        swarm_agents = []

        for profile in profiles:
            # Assign genotype based on agent name
            genotype = self.GENESIS_GENOTYPE_MAPPING.get(
                profile.name,
                GenotypeGroup.ANALYSIS  # Default fallback
            )

            agent = Agent(
                name=profile.name,
                role=profile.role,
                genotype=genotype,
                capabilities=profile.capabilities,
                current_fitness=profile.success_rate,
                metadata={
                    "cost_tier": profile.cost_tier,
                    "success_rate": profile.success_rate
                }
            )

            self.fitness_audit.log_update(
                agent_name=profile.name,
                old_value=0.0,
                new_value=profile.success_rate,
                source="halo_registry_import",
                task_id=None
            )

            swarm_agents.append(agent)

        return swarm_agents

    def optimize_team(
        self,
        task_id: str,
        required_capabilities: List[str],
        team_size_range: Tuple[int, int],
        priority: float = 1.0,
        verbose: bool = False
    ) -> Tuple[List[str], float, Dict[str, str]]:
        """
        Optimize team composition for a task using PSO + Inclusive Fitness

        Args:
            task_id: Task identifier
            required_capabilities: Required capabilities for the task
            team_size_range: (min_size, max_size) team size constraints
            priority: Task priority multiplier
            verbose: Print optimization progress

        Returns:
            Tuple of (agent_names, fitness_score, explanations)
        """
        # Create task requirement
        task = TaskRequirement(
            task_id=task_id,
            required_capabilities=required_capabilities,
            team_size_range=team_size_range,
            priority=priority
        )

        # Run PSO optimization
        logger.info(f"Optimizing team for task {task_id} with capabilities {required_capabilities}")
        best_team, best_fitness = self.pso.optimize_team(task, verbose=verbose)

        # Extract agent names
        agent_names = [agent.name for agent in best_team]

        # Generate explanations
        explanations = self._generate_explanations(best_team, task)

        # Record fitness observations for audit purposes
        try:
            outcome = self.swarm.evaluate_team(best_team, task, simulate=True)
            for agent in best_team:
                old_value = agent.metadata.get("success_rate", agent.current_fitness or 0.0)
                new_value = outcome.individual_contributions.get(agent.name, old_value)
                agent.metadata["success_rate"] = new_value
                agent.current_fitness = new_value
                self.fitness_audit.log_update(
                    agent_name=agent.name,
                    old_value=old_value,
                    new_value=new_value,
                    source="team_execution_sample",
                    task_id=task_id
                )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Unable to record fitness audit for task %s: %s", task_id, exc)

        logger.info(
            f"Team optimized for {task_id}: {agent_names} "
            f"(fitness={best_fitness:.3f})"
        )

        return agent_names, best_fitness, explanations

    def _generate_explanations(
        self,
        team: List[Agent],
        task: TaskRequirement
    ) -> Dict[str, str]:
        """
        Generate human-readable explanations for team selection

        Args:
            team: Optimized team
            task: Task requirements

        Returns:
            Dict mapping agent_name -> explanation
        """
        explanations = {}

        for agent in team:
            # Explain why this agent was selected
            capability_match = set(agent.capabilities) & set(task.required_capabilities)

            # Get kin count (agents with same genotype)
            kin_count = sum(1 for a in team if a.genotype == agent.genotype and a.name != agent.name)

            explanation_parts = []

            if capability_match:
                explanation_parts.append(
                    f"Provides {len(capability_match)} required capabilities: {', '.join(capability_match)}"
                )

            if kin_count > 0:
                explanation_parts.append(
                    f"Cooperates with {kin_count} genetic kin ({agent.genotype.value})"
                )

            if agent.metadata.get("success_rate", 0) > 0.7:
                explanation_parts.append(
                    f"High success rate: {agent.metadata['success_rate']:.1%}"
                )

            if not explanation_parts:
                explanation_parts.append("Selected by PSO optimization")

            explanations[agent.name] = "; ".join(explanation_parts)

        return explanations

    def get_team_genotype_diversity(self, agent_names: List[str]) -> float:
        """
        Calculate genotype diversity of a team (0.0-1.0)

        Higher diversity = more varied perspectives
        Lower diversity = more kin cooperation

        Args:
            agent_names: List of agent names

        Returns:
            Diversity score (0.0 = all same genotype, 1.0 = all different)
        """
        agents = [a for a in self.swarm_agents if a.name in agent_names]
        if not agents:
            return 0.0

        genotypes = set(a.genotype for a in agents)
        diversity = len(genotypes) / len(GenotypeGroup)

        return diversity

    def get_team_cooperation_score(self, agent_names: List[str]) -> float:
        """
        Calculate team cooperation score based on kin relationships

        Higher score = more genetic kin (better cooperation)

        Args:
            agent_names: List of agent names

        Returns:
            Cooperation score (0.0-1.0)
        """
        agents = [a for a in self.swarm_agents if a.name in agent_names]
        if len(agents) < 2:
            return 1.0  # Single agent = perfect cooperation

        total_relatedness = 0.0
        pair_count = 0

        for i, agent1 in enumerate(agents):
            for agent2 in agents[i+1:]:
                relatedness = self.swarm.calculate_relatedness(agent1, agent2)
                total_relatedness += relatedness
                pair_count += 1

        if pair_count == 0:
            return 0.0

        avg_relatedness = total_relatedness / pair_count
        return avg_relatedness

    def reinitialize_pso(self, random_seed: Optional[int] = None) -> None:
        """
        Re-initialize PSO optimizer with new random seed

        Used for retry logic when team optimization needs different trajectories.

        Args:
            random_seed: New random seed (None = use current seed + 1)
        """
        if random_seed is None:
            random_seed = (self.pso.random_seed or 42) + 1

        # Get current PSO parameters
        n_particles = self.pso.n_particles
        max_iterations = self.pso.max_iterations

        # Re-create PSO optimizer with new seed (factory function only accepts 4 params)
        self.pso = get_pso_optimizer(
            self.swarm,
            n_particles=n_particles,
            max_iterations=max_iterations,
            random_seed=random_seed
        )

        logger.debug(
            f"PSO re-initialized with seed={random_seed}, "
            f"n_particles={n_particles}, max_iterations={max_iterations}"
        )


def create_swarm_halo_bridge(
    agent_profiles: List[AgentProfile],
    n_particles: int = 20,
    max_iterations: int = 50,
    random_seed: Optional[int] = None
) -> SwarmHALOBridge:
    """
    Factory function to create SwarmHALOBridge

    Args:
        agent_profiles: List of agent profiles from HALO
        n_particles: Number of PSO particles
        max_iterations: Maximum PSO iterations
        random_seed: Random seed for reproducibility

    Returns:
        SwarmHALOBridge instance
    """
    return SwarmHALOBridge(
        agent_profiles=agent_profiles,
        n_particles=n_particles,
        max_iterations=max_iterations,
        random_seed=random_seed
    )


# Genesis 15-agent default profiles (used when HALO registry unavailable)
GENESIS_DEFAULT_PROFILES = [
    AgentProfile(
        name="qa_agent",
        role="Quality Assurance",
        capabilities=["testing", "quality_assurance", "debugging", "validation"],
        cost_tier="medium",
        success_rate=0.85
    ),
    AgentProfile(
        name="builder_agent",
        role="Builder",
        capabilities=["coding", "architecture", "implementation", "refactoring"],
        cost_tier="expensive",
        success_rate=0.88
    ),
    AgentProfile(
        name="support_agent",
        role="Support",
        capabilities=["customer_service", "troubleshooting", "documentation"],
        cost_tier="cheap",
        success_rate=0.82
    ),
    AgentProfile(
        name="deploy_agent",
        role="Deployment",
        capabilities=["deployment", "ci_cd", "monitoring", "infrastructure"],
        cost_tier="medium",
        success_rate=0.90
    ),
    AgentProfile(
        name="marketing_agent",
        role="Marketing",
        capabilities=["ads", "social_media", "analytics", "growth"],
        cost_tier="medium",
        success_rate=0.80
    ),
    AgentProfile(
        name="analyst_agent",
        role="Analyst",
        capabilities=["data_analysis", "reporting", "metrics", "insights"],
        cost_tier="medium",
        success_rate=0.87
    ),
    AgentProfile(
        name="billing_agent",
        role="Billing",
        capabilities=["payments", "invoicing", "subscriptions"],
        cost_tier="cheap",
        success_rate=0.92
    ),
    AgentProfile(
        name="legal_agent",
        role="Legal",
        capabilities=["contracts", "compliance", "privacy"],
        cost_tier="expensive",
        success_rate=0.95
    ),
    AgentProfile(
        name="content_agent",
        role="Content",
        capabilities=["writing", "copywriting", "content_strategy"],
        cost_tier="cheap",
        success_rate=0.83
    ),
    AgentProfile(
        name="seo_agent",
        role="SEO",
        capabilities=["seo", "keywords", "optimization"],
        cost_tier="cheap",
        success_rate=0.81
    ),
    AgentProfile(
        name="email_agent",
        role="Email",
        capabilities=["email_marketing", "campaigns", "automation"],
        cost_tier="cheap",
        success_rate=0.84
    ),
    AgentProfile(
        name="maintenance_agent",
        role="Maintenance",
        capabilities=["monitoring", "debugging", "optimization", "uptime"],
        cost_tier="medium",
        success_rate=0.89
    ),
    AgentProfile(
        name="onboarding_agent",
        role="Onboarding",
        capabilities=["user_training", "documentation", "tutorials"],
        cost_tier="cheap",
        success_rate=0.86
    ),
    AgentProfile(
        name="security_agent",
        role="Security",
        capabilities=["security_audit", "penetration_testing", "compliance"],
        cost_tier="expensive",
        success_rate=0.93
    ),
    AgentProfile(
        name="spec_agent",
        role="Specification",
        capabilities=["requirements", "specifications", "design"],
        cost_tier="medium",
        success_rate=0.88
    ),
]
