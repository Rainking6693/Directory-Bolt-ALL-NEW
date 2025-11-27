"""
Team Assembler for Genesis Autonomous Business Generation

Assembles optimal agent teams using capability matching and task requirements.
Uses simple capability-based selection (Inclusive Fitness Swarm integration is optional).

Process:
1. Analyze component requirements
2. Load capability maps for all agents
3. Score agents by capability match
4. Select top N agents for the team
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import yaml

from infrastructure.component_library import COMPONENT_LIBRARY

logger = logging.getLogger(__name__)


class TeamAssembler:
    """
    Assembles optimal agent teams for building businesses.
    
    Analyzes component requirements and selects agents with matching capabilities.
    """
    
    def __init__(self, capability_maps_dir: str = "maps/capabilities"):
        """
        Initialize team assembler.
        
        Args:
            capability_maps_dir: Directory containing agent capability YAML files
        """
        self.capability_maps_dir = Path(capability_maps_dir)
        self.capability_maps = self._load_capability_maps()
        logger.info(f"TeamAssembler initialized with {len(self.capability_maps)} agents")
    
    def _load_capability_maps(self) -> Dict[str, Dict[str, Any]]:
        """Load all agent capability maps from YAML files."""
        maps = {}
        
        if not self.capability_maps_dir.exists():
            logger.warning(f"Capability maps directory not found: {self.capability_maps_dir}")
            return maps
        
        for yaml_file in self.capability_maps_dir.glob("*.yaml"):
            try:
                with open(yaml_file, 'r') as f:
                    data = yaml.safe_load(f)
                    agent_id = data.get("agent_id")
                    if agent_id:
                        maps[agent_id] = data
            except Exception as e:
                logger.warning(f"Failed to load capability map {yaml_file}: {e}")
        
        logger.info(f"Loaded capability maps for {len(maps)} agents")
        return maps
    
    def assemble_optimal_team(
        self,
        components: List[str],
        business_type: str,
        team_size: int = 5
    ) -> List[str]:
        """
        Assemble optimal team of agents for building components.
        
        Args:
            components: List of component names to build
            business_type: Type of business (ecommerce, saas, content)
            team_size: Target team size (default: 5)
        
        Returns:
            List of agent IDs optimized for the task
        """
        logger.info(f"Assembling team for {len(components)} components ({business_type})")
        
        # Step 1: Determine required capabilities
        required_caps = self._get_required_capabilities(components)
        logger.info(f"Required capabilities: {required_caps}")
        
        # Step 2: Score all agents by capability match
        agent_scores = {}
        for agent_id, cap_map in self.capability_maps.items():
            score = self._score_agent_for_task(
                agent_capabilities=cap_map.get("capabilities", []),
                required_capabilities=required_caps,
                business_type=business_type
            )
            agent_scores[agent_id] = score
        
        # Step 3: Select top N agents
        sorted_agents = sorted(
            agent_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        team = [agent_id for agent_id, score in sorted_agents[:team_size]]
        
        logger.info(f"✅ Assembled team: {team}")
        logger.debug(f"Agent scores: {dict(sorted_agents[:team_size])}")
        
        return team
    
    def _get_required_capabilities(self, components: List[str]) -> List[str]:
        """Extract all required capabilities from components."""
        capabilities = set()
        
        for comp_name in components:
            comp_info = COMPONENT_LIBRARY.get(comp_name)
            if comp_info:
                required = comp_info.get("capabilities_required", [])
                capabilities.update(required)
        
        return sorted(list(capabilities))
    
    def _score_agent_for_task(
        self,
        agent_capabilities: List[str],
        required_capabilities: List[str],
        business_type: str
    ) -> float:
        """
        Score an agent's fit for a task (0-100).
        
        Args:
            agent_capabilities: Agent's capability list
            required_capabilities: Required capabilities for task
            business_type: Type of business
        
        Returns:
            Score from 0-100 (higher = better fit)
        """
        if not required_capabilities:
            return 50.0  # Neutral score if no requirements
        
        # Calculate capability match percentage
        matches = sum(1 for cap in required_capabilities if cap in agent_capabilities)
        match_percentage = (matches / len(required_capabilities)) * 100
        
        # Bonus for having extra relevant capabilities
        extra_bonus = min(len(agent_capabilities) - matches, 5) * 2  # Up to +10
        
        total_score = min(match_percentage + extra_bonus, 100)
        
        return total_score
    
    def get_team_coverage_report(
        self,
        team: List[str],
        required_capabilities: List[str]
    ) -> Dict[str, Any]:
        """
        Generate a coverage report for a team.
        
        Args:
            team: List of agent IDs
            required_capabilities: Required capabilities
        
        Returns:
            Report dict with coverage stats
        """
        team_capabilities = set()
        
        for agent_id in team:
            cap_map = self.capability_maps.get(agent_id, {})
            caps = cap_map.get("capabilities", [])
            team_capabilities.update(caps)
        
        covered = [cap for cap in required_capabilities if cap in team_capabilities]
        missing = [cap for cap in required_capabilities if cap not in team_capabilities]
        
        coverage_percentage = (len(covered) / len(required_capabilities) * 100) if required_capabilities else 100
        
        return {
            "team_size": len(team),
            "total_capabilities": len(team_capabilities),
            "required_capabilities": len(required_capabilities),
            "covered_capabilities": len(covered),
            "missing_capabilities": len(missing),
            "coverage_percentage": coverage_percentage,
            "covered": covered,
            "missing": missing
        }


# Singleton
_assembler: Optional[TeamAssembler] = None


def get_team_assembler() -> TeamAssembler:
    """Get or create the global team assembler."""
    global _assembler
    if _assembler is None:
        _assembler = TeamAssembler()
    return _assembler


if __name__ == "__main__":
    # Test the assembler
    assembler = TeamAssembler()
    
    print("\n" + "="*80)
    print(" "*28 + "Testing Team Assembler" + " "*30)
    print("="*80 + "\n")
    
    # Test with SaaS components
    test_components = [
        "dashboard_ui",
        "rest_api",
        "user_auth",
        "stripe_billing",
        "analytics_dashboard",
        "usage_analytics"
    ]
    
    print(f"Components to build: {test_components}\n")
    
    # Assemble team
    team = assembler.assemble_optimal_team(
        components=test_components,
        business_type="saas",
        team_size=5
    )
    
    print(f"✅ Selected Team ({len(team)} agents):")
    for i, agent_id in enumerate(team, 1):
        cap_map = assembler.capability_maps.get(agent_id, {})
        capabilities = cap_map.get("capabilities", [])
        print(f"  {i}. {agent_id:20s} - {len(capabilities)} capabilities")
    
    # Get coverage report
    required_caps = assembler._get_required_capabilities(test_components)
    report = assembler.get_team_coverage_report(team, required_caps)
    
    print(f"\n📊 Team Coverage Report:")
    print(f"  Required Capabilities: {report['required_capabilities']}")
    print(f"  Covered: {report['covered_capabilities']} ({report['coverage_percentage']:.1f}%)")
    print(f"  Missing: {report['missing_capabilities']}")
    
    if report['missing']:
        print(f"\n  Missing capabilities: {', '.join(report['missing'])}")
    
    print(f"\n  Team has {report['total_capabilities']} total capabilities")

