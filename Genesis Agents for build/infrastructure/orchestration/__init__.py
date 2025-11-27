"""
Orchestration layer for Genesis Meta-Agent

Integrates swarm optimization with HALO routing for team-based task execution.
"""

from infrastructure.orchestration.swarm_coordinator import (
    SwarmCoordinator,
    create_swarm_coordinator,
)

__all__ = [
    "SwarmCoordinator",
    "create_swarm_coordinator",
]
