"""
IterResearch Workspace Manager (Integration #69)

Manages long-horizon reasoning workspaces for continuous background operation.
Based on arXiv:2511.07327 IterResearch paper.

Features:
- Markovian state reconstruction for 2048+ interactions
- Periodic workspace synthesis to prevent context suffocation
- Persistent storage with resume capability
- Multi-workspace management
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json
import asyncio
import logging

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class Interaction:
    """Single interaction in the reasoning chain."""
    step_number: int
    timestamp: str
    agent_name: str
    action: str
    observation: str
    reasoning: str
    quality_score: float = 0.0


@dataclass
class Insight:
    """Key insight extracted from interactions."""
    content: str
    confidence: float
    supporting_steps: List[int]
    category: str  # "strategy", "learning", "warning", "success"


class Workspace:
    """
    Single IterResearch workspace for long-horizon reasoning.
    Maintains evolving report across 2048+ interactions.
    """

    def __init__(
        self,
        workspace_id: str,
        max_interactions: int = 2048,
        synthesis_threshold: int = 50,
        storage_dir: Path = Path("data/workspaces")
    ):
        self.workspace_id = workspace_id
        self.max_interactions = max_interactions
        self.synthesis_threshold = synthesis_threshold
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Core state
        self.evolving_report: Dict[str, Any] = {
            "workspace_id": workspace_id,
            "created_at": datetime.now().isoformat(),
            "current_state": "initializing",
            "key_insights": [],
            "next_actions": [],
            "quality_trend": [],
            "agent_contributions": {}
        }
        self.interaction_history: List[Interaction] = []
        self.synthesis_count = 0
        self.active = True

    async def process_interaction(
        self,
        agent_name: str,
        action: str,
        observation: str,
        reasoning: str,
        quality_score: float = 0.0
    ) -> None:
        """Add interaction and trigger synthesis if threshold reached."""
        interaction = Interaction(
            step_number=len(self.interaction_history) + 1,
            timestamp=datetime.now().isoformat(),
            agent_name=agent_name,
            action=action,
            observation=observation,
            reasoning=reasoning,
            quality_score=quality_score
        )

        self.interaction_history.append(interaction)

        # Update agent contributions
        if agent_name not in self.evolving_report["agent_contributions"]:
            self.evolving_report["agent_contributions"][agent_name] = {
                "interaction_count": 0,
                "avg_quality": 0.0,
                "total_quality": 0.0
            }

        contrib = self.evolving_report["agent_contributions"][agent_name]
        contrib["interaction_count"] += 1
        contrib["total_quality"] += quality_score
        contrib["avg_quality"] = contrib["total_quality"] / contrib["interaction_count"]

        # Track quality trend
        self.evolving_report["quality_trend"].append({
            "step": interaction.step_number,
            "score": quality_score,
            "agent": agent_name
        })

        # Periodic synthesis
        if len(self.interaction_history) % self.synthesis_threshold == 0:
            await self.synthesize()

        # Auto-save
        await self.save()

    async def synthesize(self) -> None:
        """Periodic workspace reconstruction to prevent context suffocation."""
        self.synthesis_count += 1

        # Get recent interactions
        recent_interactions = self.interaction_history[-self.synthesis_threshold:]

        # Extract insights (simplified - production would use LLM)
        insights = self._extract_insights_heuristic(recent_interactions)

        # Update evolving report
        self.evolving_report["current_state"] = self._summarize_state(recent_interactions)
        self.evolving_report["key_insights"].extend(insights)
        self.evolving_report["next_actions"] = self._recommend_actions(insights)
        self.evolving_report["last_synthesis"] = datetime.now().isoformat()
        self.evolving_report["synthesis_count"] = self.synthesis_count

        # Keep only top 20 insights (prevent bloat)
        self.evolving_report["key_insights"] = sorted(
            self.evolving_report["key_insights"],
            key=lambda x: x["confidence"],
            reverse=True
        )[:20]

        logger.info(
            f"[Workspace {self.workspace_id}] Synthesis #{self.synthesis_count} complete: "
            f"{len(self.interaction_history)} interactions, {len(self.evolving_report['key_insights'])} insights"
        )

        # Persist
        await self.save()

    def _extract_insights_heuristic(self, interactions: List[Interaction]) -> List[Dict]:
        """Extract key learnings from interaction sequence (heuristic-based)."""
        insights = []

        if not interactions:
            return insights

        # Average quality insight
        avg_quality = sum(i.quality_score for i in interactions) / len(interactions)
        insights.append({
            "content": f"Average quality in recent steps: {avg_quality:.2f}",
            "confidence": 1.0,
            "supporting_steps": [i.step_number for i in interactions],
            "category": "learning"
        })

        # Quality trend insight
        if len(interactions) >= 5:
            first_half_quality = sum(i.quality_score for i in interactions[:len(interactions)//2]) / (len(interactions)//2)
            second_half_quality = sum(i.quality_score for i in interactions[len(interactions)//2:]) / (len(interactions) - len(interactions)//2)

            if second_half_quality > first_half_quality + 0.1:
                insights.append({
                    "content": "Quality improving over time (good progress)",
                    "confidence": 0.8,
                    "supporting_steps": [i.step_number for i in interactions[-5:]],
                    "category": "success"
                })
            elif second_half_quality < first_half_quality - 0.1:
                insights.append({
                    "content": "Quality declining (may need intervention)",
                    "confidence": 0.8,
                    "supporting_steps": [i.step_number for i in interactions[-5:]],
                    "category": "warning"
                })

        # Agent contribution insight
        agent_counts = {}
        for i in interactions:
            agent_counts[i.agent_name] = agent_counts.get(i.agent_name, 0) + 1

        if agent_counts:
            top_agent = max(agent_counts.items(), key=lambda x: x[1])
            insights.append({
                "content": f"Agent '{top_agent[0]}' most active ({top_agent[1]} interactions)",
                "confidence": 0.9,
                "supporting_steps": [i.step_number for i in interactions if i.agent_name == top_agent[0]],
                "category": "strategy"
            })

        return insights[:5]  # Max 5 insights per synthesis

    def _summarize_state(self, interactions: List[Interaction]) -> str:
        """Summarize current reasoning state."""
        if not interactions:
            return "No interactions yet"

        latest = interactions[-1]
        avg_quality = sum(i.quality_score for i in interactions) / len(interactions)
        unique_agents = len(set(i.agent_name for i in interactions))

        return f"Step {latest.step_number}: {latest.agent_name} | Avg Quality: {avg_quality:.2f} | {unique_agents} agents involved"

    def _recommend_actions(self, insights: List[Dict]) -> List[str]:
        """Recommend next actions based on insights."""
        actions = []

        # Analyze quality trend
        if len(self.evolving_report["quality_trend"]) >= 5:
            recent_quality = [q["score"] for q in self.evolving_report["quality_trend"][-5:]]
            avg_recent = sum(recent_quality) / len(recent_quality)

            if avg_recent < 0.5:
                actions.append("CRITICAL: Quality declining - consider restart or different agent")
            elif avg_recent > 0.8:
                actions.append("SUCCESS: Quality high - continue current strategy")

        # Analyze agent contributions
        if self.evolving_report["agent_contributions"]:
            top_agent = max(
                self.evolving_report["agent_contributions"].items(),
                key=lambda x: x[1]["avg_quality"]
            )
            actions.append(f"STRATEGY: Agent '{top_agent[0]}' performing best (quality: {top_agent[1]['avg_quality']:.2f})")

        return actions[:5]  # Max 5 recommendations

    def get_context(self) -> str:
        """Get compressed workspace representation for next interaction."""
        return f"""# Workspace Context (ID: {self.workspace_id})

## Current State
{self.evolving_report.get('current_state', 'N/A')}

## Key Insights ({len(self.evolving_report.get('key_insights', []))})
{chr(10).join(f"- {insight['content']} (confidence: {insight['confidence']:.2f})" for insight in self.evolving_report.get('key_insights', [])[:5])}

## Recommended Next Actions
{chr(10).join(f"- {action}" for action in self.evolving_report.get('next_actions', []))}

## Agent Performance
{chr(10).join(f"- {agent}: {data['avg_quality']:.2f} ({data['interaction_count']} interactions)" for agent, data in list(self.evolving_report.get('agent_contributions', {}).items())[:5])}

## Progress
- Total Steps: {len(self.interaction_history)}
- Synthesis Count: {self.synthesis_count}
- Last Synthesis: {self.evolving_report.get('last_synthesis', 'Never')}
"""

    def needs_synthesis(self) -> bool:
        """Check if workspace needs synthesis."""
        return len(self.interaction_history) % self.synthesis_threshold == 0

    async def get_pending_interactions(self) -> List[Any]:
        """Get pending interactions to process (placeholder)."""
        # In production, this would check a queue or database
        return []

    def get_metrics(self) -> Dict[str, Any]:
        """Get workspace metrics for monitoring."""
        if not self.interaction_history:
            return {"status": "empty"}

        return {
            "workspace_id": self.workspace_id,
            "total_interactions": len(self.interaction_history),
            "synthesis_count": self.synthesis_count,
            "avg_quality": sum(i.quality_score for i in self.interaction_history) / len(self.interaction_history),
            "unique_agents": len(set(i.agent_name for i in self.interaction_history)),
            "insights_count": len(self.evolving_report.get("key_insights", [])),
            "quality_trend": "improving" if self._is_quality_improving() else "declining",
            "context_efficiency": 1.0 - (len(self.interaction_history) / self.max_interactions),
            "active": self.active
        }

    def _is_quality_improving(self) -> bool:
        """Check if quality is improving over time."""
        if len(self.evolving_report["quality_trend"]) < 10:
            return True  # Not enough data

        first_half = [q["score"] for q in self.evolving_report["quality_trend"][:len(self.evolving_report["quality_trend"])//2]]
        second_half = [q["score"] for q in self.evolving_report["quality_trend"][len(self.evolving_report["quality_trend"])//2:]]

        return sum(second_half) / len(second_half) > sum(first_half) / len(first_half)

    async def save(self) -> None:
        """Persist workspace to disk."""
        workspace_file = self.storage_dir / f"{self.workspace_id}.json"

        # Convert to JSON-serializable format
        workspace_data = {
            "evolving_report": self.evolving_report,
            "interaction_count": len(self.interaction_history),
            "synthesis_count": self.synthesis_count,
            "active": self.active,
            "recent_interactions": [
                {
                    "step": i.step_number,
                    "agent": i.agent_name,
                    "action": i.action[:100],  # Truncate
                    "quality": i.quality_score
                }
                for i in self.interaction_history[-20:]  # Last 20
            ]
        }

        with open(workspace_file, 'w') as f:
            json.dump(workspace_data, f, indent=2)

    async def load(self) -> None:
        """Load workspace from disk."""
        workspace_file = self.storage_dir / f"{self.workspace_id}.json"

        if workspace_file.exists():
            with open(workspace_file, 'r') as f:
                workspace_data = json.load(f)
                self.evolving_report = workspace_data["evolving_report"]
                self.synthesis_count = workspace_data["synthesis_count"]
                self.active = workspace_data.get("active", True)

            logger.info(f"[Workspace {self.workspace_id}] Loaded from disk")


class WorkspaceManager:
    """
    Manager for multiple IterResearch workspaces.
    Handles workspace lifecycle and resource limits.
    """

    def __init__(
        self,
        storage_dir: Path = Path("data/workspaces"),
        max_active: int = 10,
        synthesis_threshold: int = 50
    ):
        self.storage_dir = storage_dir
        self.max_active = max_active
        self.synthesis_threshold = synthesis_threshold
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Active workspaces
        self.workspaces: Dict[str, Workspace] = {}

        logger.info(f"[WorkspaceManager] Initialized (max_active={max_active}, storage={storage_dir})")

    async def create_workspace(self, workspace_id: str) -> Workspace:
        """Create a new workspace."""
        if workspace_id in self.workspaces:
            logger.warning(f"[WorkspaceManager] Workspace '{workspace_id}' already exists")
            return self.workspaces[workspace_id]

        # Check max active limit
        if len(self.workspaces) >= self.max_active:
            await self._evict_oldest_workspace()

        workspace = Workspace(
            workspace_id=workspace_id,
            max_interactions=2048,
            synthesis_threshold=self.synthesis_threshold,
            storage_dir=self.storage_dir
        )

        self.workspaces[workspace_id] = workspace

        logger.info(f"[WorkspaceManager] Created workspace '{workspace_id}'")

        return workspace

    async def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        """Get workspace by ID."""
        if workspace_id in self.workspaces:
            return self.workspaces[workspace_id]

        # Try loading from disk
        workspace_file = self.storage_dir / f"{workspace_id}.json"
        if workspace_file.exists():
            workspace = Workspace(
                workspace_id=workspace_id,
                storage_dir=self.storage_dir
            )
            await workspace.load()
            self.workspaces[workspace_id] = workspace
            return workspace

        return None

    async def get_active_workspaces(self) -> Dict[str, Workspace]:
        """Get all active workspaces."""
        return {
            wid: workspace
            for wid, workspace in self.workspaces.items()
            if workspace.active
        }

    async def close_workspace(self, workspace_id: str) -> None:
        """Close and archive a workspace."""
        if workspace_id not in self.workspaces:
            logger.warning(f"[WorkspaceManager] Workspace '{workspace_id}' not found")
            return

        workspace = self.workspaces[workspace_id]
        workspace.active = False
        await workspace.save()

        del self.workspaces[workspace_id]

        logger.info(f"[WorkspaceManager] Closed workspace '{workspace_id}'")

    async def _evict_oldest_workspace(self) -> None:
        """Evict oldest workspace when limit reached."""
        if not self.workspaces:
            return

        # Find oldest workspace (by creation time)
        oldest_id = min(
            self.workspaces.keys(),
            key=lambda wid: self.workspaces[wid].evolving_report.get("created_at", "")
        )

        logger.info(f"[WorkspaceManager] Evicting oldest workspace '{oldest_id}' (max active reached)")

        await self.close_workspace(oldest_id)

    def get_stats(self) -> Dict[str, Any]:
        """Get manager statistics."""
        return {
            "total_active": len(self.workspaces),
            "max_active": self.max_active,
            "workspaces": [
                {
                    "id": wid,
                    "metrics": workspace.get_metrics()
                }
                for wid, workspace in self.workspaces.items()
            ]
        }
