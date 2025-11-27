"""
Swarm Optimization Module
Version: 1.0

Provides inclusive fitness-based team optimization for Genesis multi-agent system.

Components:
- Inclusive Fitness Swarm: Hamilton's rule-based cooperation
- Particle Swarm Optimization: Team composition optimization
- HALO Integration Bridge: Integration with HALO router
"""

from infrastructure.swarm.inclusive_fitness import (
    Agent,
    AgentGenotype,
    GenotypeGroup,
    InclusiveFitnessSwarm,
    TaskRequirement,
    GENESIS_GENOTYPES,
    get_inclusive_fitness_swarm,
)

from infrastructure.swarm.team_optimizer import (
    TeamParticle,
    ParticleSwarmOptimizer,
    get_pso_optimizer,
)

from infrastructure.swarm.swarm_halo_bridge import (
    AgentProfile,
    SwarmHALOBridge,
    create_swarm_halo_bridge,
    GENESIS_DEFAULT_PROFILES,
)

__all__ = [
    # Core Swarm Classes
    "Agent",
    "AgentGenotype",
    "GenotypeGroup",
    "InclusiveFitnessSwarm",
    "ParticleSwarmOptimizer",
    "TaskRequirement",
    "TeamParticle",
    "GENESIS_GENOTYPES",
    # Factory Functions
    "get_inclusive_fitness_swarm",
    "get_pso_optimizer",
    # HALO Integration
    "AgentProfile",
    "SwarmHALOBridge",
    "create_swarm_halo_bridge",
    "GENESIS_DEFAULT_PROFILES",
]
