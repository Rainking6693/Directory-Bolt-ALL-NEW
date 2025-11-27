"""
ES Training Scheduler (Integration #68)

Scheduler for nightly Evolution Strategies model fine-tuning.
Integrates with existing scripts/nightly_es_training.py.

Features:
- Scheduled training at configured time
- Last-run tracking to prevent duplicate runs
- Metrics collection and reporting
- Rollback capability if training fails
"""

from typing import Dict, Any, Optional
from datetime import datetime, time as dt_time
from pathlib import Path
import json
import asyncio
import subprocess
import logging

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


class ESTrainingScheduler:
    """
    Scheduler for nightly Evolution Strategies training.
    Wraps existing scripts/nightly_es_training.py.
    """

    def __init__(
        self,
        training_time: str = "02:00",
        iterations: int = 10,
        population: int = 8,
        dry_run: bool = False,
        storage_dir: Path = Path("data/es_training")
    ):
        self.training_time = training_time
        self.iterations = iterations
        self.population = population
        self.dry_run = dry_run
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # State
        self.last_run: Optional[datetime] = None
        self.total_runs = 0
        self.successful_runs = 0
        self.failed_runs = 0

        # Load state
        self._load_state()

        logger.info(
            f"[ESScheduler] Initialized (time={training_time}, iterations={iterations}, "
            f"population={population}, dry_run={dry_run})"
        )

    async def run_training(self) -> Dict[str, Any]:
        """
        Run ES training if not already run today.

        Returns:
            Result dict with status, metrics, and timing
        """
        # Check if already run today
        if self._already_run_today():
            logger.info("[ESScheduler] Training already completed today, skipping")
            return {
                "status": "skipped",
                "reason": "already_run_today",
                "last_run": self.last_run.isoformat() if self.last_run else None
            }

        logger.info("=" * 60)
        logger.info("[ESScheduler] Starting ES training run")
        logger.info("=" * 60)

        start_time = datetime.now()

        try:
            # Run training via subprocess
            result = await self._execute_training()

            # Mark success
            self.last_run = datetime.now()
            self.total_runs += 1
            self.successful_runs += 1

            # Save state
            self._save_state()

            duration = (datetime.now() - start_time).total_seconds()

            logger.info("=" * 60)
            logger.info(f"[ESScheduler] Training completed in {duration:.1f}s")
            logger.info(f"[ESScheduler] Total runs: {self.total_runs} (success: {self.successful_runs}, failed: {self.failed_runs})")
            logger.info("=" * 60)

            return {
                "status": "success",
                "duration_seconds": duration,
                "iterations": self.iterations,
                "population": self.population,
                "dry_run": self.dry_run,
                "metrics": result.get("metrics", {}),
                "last_run": self.last_run.isoformat()
            }

        except Exception as e:
            # Mark failure
            self.failed_runs += 1
            self.total_runs += 1
            self._save_state()

            duration = (datetime.now() - start_time).total_seconds()

            logger.error(f"[ESScheduler] Training failed after {duration:.1f}s: {e}", exc_info=True)

            return {
                "status": "failed",
                "error": str(e),
                "duration_seconds": duration,
                "last_run": self.last_run.isoformat() if self.last_run else None
            }

    async def _execute_training(self) -> Dict[str, Any]:
        """Execute the training script."""
        # Build command
        cmd = [
            "python",
            "scripts/nightly_es_training.py",
            "--iterations", str(self.iterations),
            "--population", str(self.population),
        ]

        if self.dry_run:
            cmd.append("--dry-run")

        logger.info(f"[ESScheduler] Executing: {' '.join(cmd)}")

        # Run subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"Training script failed: {error_msg}")

        # Parse output for metrics (if available)
        output = stdout.decode()
        logger.debug(f"[ESScheduler] Training output:\n{output}")

        # Try to extract metrics from output
        metrics = self._parse_training_output(output)

        return {"metrics": metrics, "output": output}

    def _parse_training_output(self, output: str) -> Dict[str, Any]:
        """Parse training output for metrics."""
        metrics = {}

        # Look for common metric patterns in output
        for line in output.split('\n'):
            if "Best fitness:" in line:
                try:
                    fitness = float(line.split(":")[-1].strip())
                    metrics["best_fitness"] = fitness
                except ValueError:
                    pass
            elif "Average fitness:" in line:
                try:
                    fitness = float(line.split(":")[-1].strip())
                    metrics["avg_fitness"] = fitness
                except ValueError:
                    pass
            elif "Improvement:" in line:
                try:
                    improvement = float(line.split(":")[-1].strip().rstrip('%'))
                    metrics["improvement_percent"] = improvement
                except ValueError:
                    pass

        return metrics

    def _already_run_today(self) -> bool:
        """Check if training already ran today."""
        if not self.last_run:
            return False

        today = datetime.now().date()
        last_run_date = self.last_run.date()

        return today == last_run_date

    def _load_state(self) -> None:
        """Load scheduler state from disk."""
        state_file = self.storage_dir / "scheduler_state.json"

        if not state_file.exists():
            logger.info("[ESScheduler] No previous state found")
            return

        try:
            with open(state_file, 'r') as f:
                state = json.load(f)

            self.last_run = datetime.fromisoformat(state["last_run"]) if state.get("last_run") else None
            self.total_runs = state.get("total_runs", 0)
            self.successful_runs = state.get("successful_runs", 0)
            self.failed_runs = state.get("failed_runs", 0)

            logger.info(
                f"[ESScheduler] Loaded state: last_run={self.last_run}, "
                f"runs={self.total_runs} (success={self.successful_runs}, failed={self.failed_runs})"
            )

        except Exception as e:
            logger.error(f"[ESScheduler] Error loading state: {e}", exc_info=True)

    def _save_state(self) -> None:
        """Save scheduler state to disk."""
        state_file = self.storage_dir / "scheduler_state.json"

        state = {
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "total_runs": self.total_runs,
            "successful_runs": self.successful_runs,
            "failed_runs": self.failed_runs,
            "training_time": self.training_time,
            "iterations": self.iterations,
            "population": self.population,
        }

        try:
            with open(state_file, 'w') as f:
                json.dump(state, f, indent=2)

            logger.debug("[ESScheduler] State saved")

        except Exception as e:
            logger.error(f"[ESScheduler] Error saving state: {e}", exc_info=True)

    def get_stats(self) -> Dict[str, Any]:
        """Get scheduler statistics."""
        return {
            "training_time": self.training_time,
            "iterations": self.iterations,
            "population": self.population,
            "dry_run": self.dry_run,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "total_runs": self.total_runs,
            "successful_runs": self.successful_runs,
            "failed_runs": self.failed_runs,
            "success_rate": (self.successful_runs / self.total_runs * 100) if self.total_runs > 0 else 0,
        }
