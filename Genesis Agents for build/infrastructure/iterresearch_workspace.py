# infrastructure/iterresearch_workspace.py
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import asyncio
import json
from pathlib import Path

from infrastructure.local_llm_client import get_local_llm_client
from infrastructure.load_env import load_genesis_env

load_genesis_env()

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

class IterResearchWorkspace:
    """
    Markovian state reconstruction for long-horizon reasoning.
    Maintains evolving report across 2048+ interactions.
    Based on arXiv:2511.07327 IterResearch paper.
    """
    def __init__(
        self,
        task_id: str,
        max_interactions: int = 2048,
        synthesis_threshold: int = 50,
        storage_dir: Optional[Path] = None
    ):
        self.task_id = task_id
        self.max_interactions = max_interactions
        self.synthesis_threshold = synthesis_threshold
        self.storage_dir = storage_dir or Path("data/workspaces")
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Core state
        self.evolving_report: Dict[str, Any] = {
            "task_id": task_id,
            "created_at": datetime.now().isoformat(),
            "current_state": "initializing",
            "key_insights": [],
            "next_actions": [],
            "quality_trend": [],
            "agent_contributions": {}
        }
        self.interaction_history: List[Interaction] = []
        self.synthesis_count = 0

        # LLM client for synthesis
        self.llm_client = get_local_llm_client()

    async def add_interaction(
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
            await self._synthesize_workspace()

    async def _synthesize_workspace(self) -> None:
        """Periodic workspace reconstruction to prevent context suffocation."""
        self.synthesis_count += 1

        # Get recent interactions
        recent_interactions = self.interaction_history[-self.synthesis_threshold:]

        # Extract insights using LLM
        insights = await self._extract_insights(recent_interactions)

        # Update evolving report
        self.evolving_report["current_state"] = self._summarize_state(recent_interactions)
        self.evolving_report["key_insights"].extend(insights)
        self.evolving_report["next_actions"] = self._recommend_actions(insights)
        self.evolving_report["last_synthesis"] = datetime.now().isoformat()
        self.evolving_report["synthesis_count"] = self.synthesis_count

        # Keep only top 20 insights (prevent bloat)
        self.evolving_report["key_insights"] = sorted(
            self.evolving_report["key_insights"],
            key=lambda x: x.confidence,
            reverse=True
        )[:20]

        # Persist to disk
        await self._save_workspace()

    async def _extract_insights(self, interactions: List[Interaction]) -> List[Insight]:
        """Extract key learnings from interaction sequence using LLM."""
        # Format interactions for LLM
        interaction_text = "\n\n".join([
            f"Step {i.step_number} ({i.agent_name}):\n"
            f"Action: {i.action}\n"
            f"Observation: {i.observation}\n"
            f"Reasoning: {i.reasoning}\n"
            f"Quality: {i.quality_score:.2f}"
            for i in interactions[-10:]  # Last 10 for context
        ])

        prompt = f"""Analyze these recent interactions and extract 3-5 key insights.
Focus on: successful patterns, failure modes, strategic learnings, and quality trends.

Recent Interactions:
{interaction_text}

Extract insights in this format:
INSIGHT 1: [brief insight] (confidence: 0.0-1.0) (category: strategy/learning/warning/success)
INSIGHT 2: ...

Insights:"""

        try:
            response = await self.llm_client.complete(prompt, max_tokens=500, temperature=0.3)

            # Parse insights with robust error handling
            insights = []
            for line in response.split('\n'):
                if line.strip().startswith('INSIGHT'):
                    try:
                        # Extract content, confidence, category with safe parsing
                        parts = line.split(':', 1)
                        if len(parts) < 2:
                            continue

                        content_part = parts[1].strip()
                        # Remove parenthetical info if present
                        if '(' in content_part:
                            content = content_part.split('(')[0].strip()
                        else:
                            content = content_part

                        if content:  # Only add if non-empty
                            insights.append(Insight(
                                content=content,
                                confidence=0.7,  # Default
                                supporting_steps=[i.step_number for i in interactions[-5:]],
                                category="learning"
                            ))
                    except (IndexError, ValueError) as parse_error:
                        # Skip malformed insight lines
                        continue

            # If we got insights, return them
            if insights:
                return insights[:5]  # Max 5 insights per synthesis

            # Otherwise fall through to heuristic fallback
            raise ValueError("No valid insights parsed")

        except Exception as e:
            # Fallback: heuristic-based insights
            return [
                Insight(
                    content=f"Average quality in recent steps: {sum(i.quality_score for i in interactions) / len(interactions):.2f}",
                    confidence=1.0,
                    supporting_steps=[i.step_number for i in interactions],
                    category="learning"
                )
            ]

    def _summarize_state(self, interactions: List[Interaction]) -> str:
        """Summarize current reasoning state."""
        if not interactions:
            return "No interactions yet"

        latest = interactions[-1]
        avg_quality = sum(i.quality_score for i in interactions) / len(interactions)
        unique_agents = len(set(i.agent_name for i in interactions))

        return f"Step {latest.step_number}: {latest.agent_name} | Avg Quality: {avg_quality:.2f} | {unique_agents} agents involved"

    def _recommend_actions(self, insights: List[Insight]) -> List[str]:
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

    def get_workspace_context(self) -> str:
        """Get compressed workspace representation for next interaction."""
        return f"""# Workspace Context (Task: {self.task_id})

## Current State
{self.evolving_report.get('current_state', 'N/A')}

## Key Insights ({len(self.evolving_report.get('key_insights', []))})
{chr(10).join(f"- {insight.content if hasattr(insight, 'content') else insight.get('content', 'N/A')} (confidence: {insight.confidence if hasattr(insight, 'confidence') else insight.get('confidence', 0.0):.2f})" for insight in self.evolving_report.get('key_insights', [])[:5])}

## Recommended Next Actions
{chr(10).join(f"- {action}" for action in self.evolving_report.get('next_actions', []))}

## Agent Performance
{chr(10).join(f"- {agent}: {data['avg_quality']:.2f} ({data['interaction_count']} interactions)" for agent, data in list(self.evolving_report.get('agent_contributions', {}).items())[:5])}

## Progress
- Total Steps: {len(self.interaction_history)}
- Synthesis Count: {self.synthesis_count}
- Last Synthesis: {self.evolving_report.get('last_synthesis', 'Never')}
"""

    async def _save_workspace(self) -> None:
        """Persist workspace to disk."""
        workspace_file = self.storage_dir / f"{self.task_id}_workspace.json"

        # Convert insights to dict for JSON serialization
        serializable_report = self.evolving_report.copy()
        serializable_report["key_insights"] = [
            {
                "content": insight.content,
                "confidence": insight.confidence,
                "supporting_steps": insight.supporting_steps,
                "category": insight.category
            }
            for insight in self.evolving_report.get("key_insights", [])
        ]

        # Convert to JSON-serializable format
        workspace_data = {
            "evolving_report": serializable_report,
            "interaction_count": len(self.interaction_history),
            "synthesis_count": self.synthesis_count,
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

        # Use async I/O to avoid blocking event loop
        await asyncio.to_thread(
            lambda: workspace_file.write_text(json.dumps(workspace_data, indent=2))
        )

    async def load_workspace(self) -> None:
        """Load workspace from disk."""
        workspace_file = self.storage_dir / f"{self.task_id}_workspace.json"

        if workspace_file.exists():
            # Use async I/O to avoid blocking event loop
            content = await asyncio.to_thread(workspace_file.read_text)
            workspace_data = json.loads(content)
            self.evolving_report = workspace_data["evolving_report"]
            self.synthesis_count = workspace_data["synthesis_count"]

    def get_metrics(self) -> Dict[str, Any]:
        """Get workspace metrics for monitoring."""
        if not self.interaction_history:
            return {"status": "empty"}

        return {
            "total_interactions": len(self.interaction_history),
            "synthesis_count": self.synthesis_count,
            "avg_quality": sum(i.quality_score for i in self.interaction_history) / len(self.interaction_history),
            "unique_agents": len(set(i.agent_name for i in self.interaction_history)),
            "insights_count": len(self.evolving_report.get("key_insights", [])),
            "quality_trend": "improving" if self._is_quality_improving() else "declining",
            "context_efficiency": 1.0 - (len(self.interaction_history) / self.max_interactions)
        }

    def _is_quality_improving(self) -> bool:
        """Check if quality is improving over time."""
        if len(self.evolving_report["quality_trend"]) < 10:
            return True  # Not enough data

        first_half = [q["score"] for q in self.evolving_report["quality_trend"][:len(self.evolving_report["quality_trend"])//2]]
        second_half = [q["score"] for q in self.evolving_report["quality_trend"][len(self.evolving_report["quality_trend"])//2:]]

        return sum(second_half) / len(second_half) > sum(first_half) / len(first_half)


# Factory function for easy instantiation
def create_workspace(task_id: str) -> IterResearchWorkspace:
    """Create a new IterResearch workspace for a task."""
    return IterResearchWorkspace(task_id=task_id)
