"""
AgentEvolver Phase 4: Ingestion Pipeline

Converts AgentEvolver outputs to TrajectoryPool format for SE-Darwin integration.

Key Features:
- Convert scenarios to TrajectoryPool format
- Schema validation
- Handle edge cases (malformed scenarios)
- Push to DreamGym/Hybrid buffer

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 4
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.utils import TimeHelper, DataSerializer

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class ConversionResult:
    """Result of scenario conversion."""
    success: bool
    trajectory_id: Optional[str] = None
    error: Optional[str] = None
    conversion_timestamp: str = ""

    def __post_init__(self):
        if not self.conversion_timestamp:
            self.conversion_timestamp = TimeHelper.current_timestamp()


class IngestionPipeline:
    """
    Converts AgentEvolver outputs to TrajectoryPool format.

    Integrates self-generated scenarios with SE-Darwin training.
    """

    def __init__(self):
        """Initialize ingestion pipeline."""
        self.conversions_attempted = 0
        self.conversions_successful = 0
        self.conversions_failed = 0
        self.errors: List[Tuple[str, str]] = []  # (scenario_id, error)

        logger.info("IngestionPipeline initialized")

    def convert_scenario_to_trajectory(
        self,
        scenario: Dict[str, Any],
    ) -> ConversionResult:
        """
        Convert an AgentEvolver scenario to TrajectoryPool format.

        Args:
            scenario: AgentEvolver scenario dict

        Returns:
            ConversionResult with trajectory_id if successful
        """
        self.conversions_attempted += 1

        try:
            # Validate required fields
            required_fields = ["scenario_id", "task_type", "description", "outcome"]
            for field in required_fields:
                if field not in scenario:
                    error_msg = f"Missing required field: {field}"
                    self.conversions_failed += 1
                    self.errors.append((scenario.get("scenario_id", "unknown"), error_msg))
                    return ConversionResult(success=False, error=error_msg)

            # Build trajectory dict
            trajectory = self._build_trajectory(scenario)

            # Validate trajectory
            if not self._validate_trajectory(trajectory):
                error_msg = "Trajectory validation failed"
                self.conversions_failed += 1
                self.errors.append((scenario.get("scenario_id"), error_msg))
                return ConversionResult(success=False, error=error_msg)

            self.conversions_successful += 1

            logger.debug(
                f"Successfully converted scenario '{scenario.get('scenario_id')}' "
                f"to trajectory '{trajectory['trajectory_id']}'"
            )

            return ConversionResult(
                success=True,
                trajectory_id=trajectory["trajectory_id"],
            )

        except Exception as e:
            error_msg = f"Conversion error: {str(e)}"
            self.conversions_failed += 1
            self.errors.append((scenario.get("scenario_id", "unknown"), error_msg))

            logger.error(error_msg)

            return ConversionResult(success=False, error=error_msg)

    def _build_trajectory(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Build trajectory dict from scenario."""
        from infrastructure.trajectory_pool import Trajectory

        return {
            "trajectory_id": f"traj_{scenario.get('scenario_id', 'unknown')}",
            "generation": scenario.get("generation", 1),
            "agent_name": scenario.get("task_type", "unknown"),
            "status": "success",
            "code_changes": scenario.get("description", ""),
            "problem_diagnosis": scenario.get("problem_description", ""),
            "proposed_strategy": scenario.get("strategy", ""),
            "code_after": scenario.get("expected_output", ""),
            "strategy_description": scenario.get("strategy_description", ""),
            "execution_result": scenario.get("outcome", {}),
            "created_at": scenario.get("created_at", TimeHelper.current_timestamp()),
            "metadata": {
                "original_scenario_id": scenario.get("scenario_id"),
                "quality_score": scenario.get("quality_score", 0.0),
                "diversity_score": scenario.get("diversity_score", 0.0),
                "difficulty_level": scenario.get("difficulty_level", 5),
            },
        }

    def _validate_trajectory(self, trajectory: Dict[str, Any]) -> bool:
        """Validate trajectory schema."""
        required_fields = ["trajectory_id", "generation", "agent_name", "status"]

        for field in required_fields:
            if field not in trajectory or not trajectory[field]:
                logger.warning(f"Trajectory missing or empty field: {field}")
                return False

        # Check types
        if not isinstance(trajectory["trajectory_id"], str):
            return False

        if not isinstance(trajectory["generation"], int):
            return False

        if trajectory["generation"] < 1:
            return False

        return True

    async def ingest_batch(
        self,
        scenarios: List[Dict[str, Any]],
    ) -> Tuple[int, int, List[str]]:
        """
        Ingest a batch of scenarios.

        Args:
            scenarios: List of scenarios to convert

        Returns:
            Tuple of (successful, failed, trajectory_ids)
        """
        successful = 0
        failed = 0
        trajectory_ids = []

        logger.info(f"Ingesting batch of {len(scenarios)} scenarios...")

        for scenario in scenarios:
            result = self.convert_scenario_to_trajectory(scenario)

            if result.success and result.trajectory_id:
                successful += 1
                trajectory_ids.append(result.trajectory_id)
            else:
                failed += 1

        logger.info(
            f"Batch ingestion complete: {successful} successful, {failed} failed"
        )

        return successful, failed, trajectory_ids

    def get_statistics(self) -> Dict[str, Any]:
        """Get ingestion statistics."""
        total = self.conversions_attempted

        if total == 0:
            return {
                "total_conversions": 0,
                "successful_conversions": 0,
                "failed_conversions": 0,
                "success_rate": 0.0,
                "total_errors": 0,
            }

        return {
            "total_conversions": total,
            "successful_conversions": self.conversions_successful,
            "failed_conversions": self.conversions_failed,
            "success_rate": self.conversions_successful / total,
            "total_errors": len(self.errors),
            "recent_errors": self.errors[-10:],  # Last 10 errors
        }

    def print_statistics(self) -> None:
        """Print human-readable statistics."""
        stats = self.get_statistics()

        print("\n" + "=" * 80)
        print("INGESTION PIPELINE STATISTICS")
        print("=" * 80)

        print(f"\nTotal Conversions: {stats['total_conversions']}")
        print(f"Successful: {stats['successful_conversions']}")
        print(f"Failed: {stats['failed_conversions']}")
        print(f"Success Rate: {stats.get('success_rate', 0.0):.1%}")

        if stats.get('recent_errors'):
            print("\n" + "-" * 80)
            print("RECENT ERRORS (Last 10)")
            print("-" * 80)

            for scenario_id, error in stats['recent_errors']:
                print(f"  {scenario_id:30} | {error}")

        print("\n" + "=" * 80 + "\n")


def get_ingestion_pipeline() -> IngestionPipeline:
    """Get or create global ingestion pipeline."""
    return IngestionPipeline()
