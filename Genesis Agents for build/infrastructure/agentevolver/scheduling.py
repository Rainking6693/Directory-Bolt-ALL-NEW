"""
AgentEvolver Phase 4: Scheduling

Daily job scheduling for scenario generation and ingestion.

Key Features:
- Generate 100 new scenarios per day
- Push to DreamGym/Hybrid buffer
- Archive old scenarios (keep 10,000)
- Track scheduling metrics

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 4
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    DAILY_SCENARIO_GENERATION_TARGET,
    ARCHIVE_SIZE_LIMIT,
)
from infrastructure.agentevolver.utils import TimeHelper

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class SchedulingMetrics:
    """Metrics for daily scheduling."""
    date: str
    scenarios_generated: int = 0
    scenarios_pushed: int = 0
    scenarios_archived: int = 0
    total_in_archive: int = 0
    last_run_timestamp: str = ""
    next_scheduled_run: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "date": self.date,
            "scenarios_generated": self.scenarios_generated,
            "scenarios_pushed": self.scenarios_pushed,
            "scenarios_archived": self.scenarios_archived,
            "total_in_archive": self.total_in_archive,
            "last_run_timestamp": self.last_run_timestamp,
            "next_scheduled_run": self.next_scheduled_run,
        }


class DailyScheduler:
    """
    Orchestrates daily scenario generation and ingestion.

    Runs at scheduled intervals to generate and process scenarios.
    """

    def __init__(self, daily_target: int = DAILY_SCENARIO_GENERATION_TARGET):
        """
        Initialize scheduler.

        Args:
            daily_target: Number of scenarios to generate per day
        """
        self.daily_target = daily_target
        self.metrics: Dict[str, SchedulingMetrics] = {}
        self.is_running = False

        logger.info(f"DailyScheduler initialized (daily_target={daily_target})")

    async def run_daily_generation(self) -> SchedulingMetrics:
        """
        Execute daily scenario generation job.

        Returns:
            SchedulingMetrics with results
        """
        today = datetime.utcnow().strftime("%Y-%m-%d")

        logger.info(f"Starting daily scenario generation for {today}")

        metrics = SchedulingMetrics(
            date=today,
            last_run_timestamp=TimeHelper.current_timestamp(),
        )

        try:
            # Step 1: Generate scenarios (self-questioning)
            scenarios = await self._generate_scenarios(self.daily_target)
            metrics.scenarios_generated = len(scenarios)

            logger.info(f"Generated {len(scenarios)} scenarios")

            # Step 2: Filter by quality
            filtered_scenarios = [s for s in scenarios if self._passes_quality_filter(s)]
            logger.info(f"Filtered to {len(filtered_scenarios)} high-quality scenarios")

            # Step 3: Push to buffer/DreamGym
            pushed_ids = await self._push_to_buffer(filtered_scenarios)
            metrics.scenarios_pushed = len(pushed_ids)

            logger.info(f"Pushed {len(pushed_ids)} scenarios to buffer")

            # Step 4: Archive management
            archived = await self._manage_archive()
            metrics.scenarios_archived = archived

            logger.info(f"Archived {archived} old scenarios")

            # Calculate next run
            next_run = datetime.utcnow() + timedelta(days=1)
            metrics.next_scheduled_run = next_run.isoformat()

            # Store metrics
            self.metrics[today] = metrics

        except Exception as e:
            logger.error(f"Daily generation failed: {e}", exc_info=True)

        return metrics

    async def _generate_scenarios(self, count: int) -> List[Dict[str, Any]]:
        """Generate scenarios using self-questioning."""
        from infrastructure.agentevolver.self_questioning import (
            get_self_questioning_module,
        )

        module = get_self_questioning_module()

        # Generate novel ideas (which become scenarios)
        ideas = await module.generate_novel_ideas(count=count)

        # Convert ideas to scenarios
        scenarios = [
            {
                "scenario_id": idea.idea_id,
                "task_type": idea.business_type,
                "domain": idea.domain,
                "description": idea.description,
                "problem_description": f"Build {idea.name}: {idea.description}",
                "strategy": f"Use {idea.business_type} template for {idea.domain}",
                "expected_output": f"Fully functional {idea.business_type} business",
                "quality_score": idea.novelty_score,
                "diversity_score": idea.novelty_score,
                "difficulty_level": 5,
                "outcome": {"status": "generated"},
                "created_at": TimeHelper.current_timestamp(),
            }
            for idea in ideas
        ]

        return scenarios

    def _passes_quality_filter(self, scenario: Dict[str, Any]) -> bool:
        """Check if scenario passes quality filter."""
        from infrastructure.agentevolver.quality_filter import (
            get_quality_filter,
        )

        quality_filter = get_quality_filter()

        return quality_filter.validate_scenario(scenario)

    async def _push_to_buffer(self, scenarios: List[Dict[str, Any]]) -> List[str]:
        """Push scenarios to experience buffer/DreamGym."""
        from infrastructure.agentevolver.ingestion_pipeline import (
            get_ingestion_pipeline,
        )

        pipeline = get_ingestion_pipeline()

        successful, _, trajectory_ids = await pipeline.ingest_batch(scenarios)

        logger.info(f"Pushed {successful} scenarios to trajectory pool")

        return trajectory_ids

    async def _manage_archive(self) -> int:
        """Manage scenario archive (keep last 10,000)."""
        # This is a placeholder - actual archive management would interact
        # with storage backend (JSONL file or database)

        # For now, just return 0 (no archiving needed)
        return 0

    def get_metrics(self, date: Optional[str] = None) -> Optional[SchedulingMetrics]:
        """Get metrics for a specific date."""
        if date is None:
            date = datetime.utcnow().strftime("%Y-%m-%d")

        return self.metrics.get(date)

    def get_all_metrics(self) -> List[SchedulingMetrics]:
        """Get all recorded metrics."""
        return list(self.metrics.values())

    def print_metrics(self, date: Optional[str] = None) -> None:
        """Print human-readable metrics."""
        metrics = self.get_metrics(date)

        if not metrics:
            print("No metrics available")
            return

        print("\n" + "=" * 80)
        print(f"DAILY SCHEDULING METRICS - {metrics.date}")
        print("=" * 80)

        print(f"\nGenerated: {metrics.scenarios_generated}/{self.daily_target}")
        print(f"Pushed to buffer: {metrics.scenarios_pushed}")
        print(f"Archived: {metrics.scenarios_archived}")
        print(f"Total in archive: {metrics.total_in_archive}")

        print(f"\nLast run: {metrics.last_run_timestamp}")
        print(f"Next run: {metrics.next_scheduled_run}")

        print("\n" + "=" * 80 + "\n")


def get_daily_scheduler(
    daily_target: int = DAILY_SCENARIO_GENERATION_TARGET,
) -> DailyScheduler:
    """Get or create global daily scheduler."""
    return DailyScheduler(daily_target)
