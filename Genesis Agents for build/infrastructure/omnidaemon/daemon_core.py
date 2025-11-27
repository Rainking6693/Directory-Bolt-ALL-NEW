"""
OmniDaemon Core - Continuous Background Orchestration Service

Manages:
- Long-horizon reasoning workspaces (IterResearch)
- Multi-agent attribution tracking (Dr. MAMR)
- Nightly model optimization (ES Training)
- Health monitoring and heartbeat
"""

from typing import Dict, List, Any, Optional
import asyncio
import json
import signal
import sys
from datetime import datetime, time as dt_time
from pathlib import Path
from dataclasses import dataclass, asdict
import logging

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class DaemonConfig:
    """Configuration for OmniDaemon."""
    # Workspace management
    max_active_workspaces: int = 10
    workspace_check_interval: int = 60  # seconds
    workspace_synthesis_threshold: int = 50

    # ES Training
    es_training_enabled: bool = True
    es_training_time: str = "02:00"  # 2 AM
    es_training_iterations: int = 10
    es_training_population: int = 8
    es_training_dry_run: bool = False

    # Attribution tracking
    attribution_enabled: bool = True
    attribution_check_interval: int = 300  # 5 minutes
    free_rider_detection_enabled: bool = True
    free_rider_threshold: float = 0.15
    weekly_audit_enabled: bool = True

    # Health monitoring
    heartbeat_interval: int = 30  # seconds
    heartbeat_file: str = "/tmp/omnidaemon_heartbeat.json"

    # Storage
    data_dir: Path = Path("data/omnidaemon")
    workspace_dir: Path = Path("data/workspaces")
    attribution_dir: Path = Path("data/attribution")

    # Logging
    log_level: str = "INFO"
    log_file: Path = Path("logs/omnidaemon.log")


class OmniDaemon:
    """
    OmniDaemon - Continuous background orchestration service.

    Integrates:
    - IterResearch Workspace Manager (#69): Long-horizon reasoning
    - Dr. MAMR Attribution Layer (#70): Multi-agent performance tracking
    - ES Training Scheduler (#68): Nightly model optimization

    Features:
    - Persistent state across restarts
    - Health monitoring with heartbeat
    - Graceful shutdown handling
    - Comprehensive logging and metrics
    """

    def __init__(self, config: Optional[DaemonConfig] = None):
        self.config = config or DaemonConfig()
        self._running = False
        self._shutdown_requested = False

        # Create directories
        self.config.data_dir.mkdir(parents=True, exist_ok=True)
        self.config.workspace_dir.mkdir(parents=True, exist_ok=True)
        self.config.attribution_dir.mkdir(parents=True, exist_ok=True)
        self.config.log_file.parent.mkdir(parents=True, exist_ok=True)

        # Initialize components (lazy loading)
        self._workspace_manager = None
        self._attribution_tracker = None
        self._es_scheduler = None

        # Metrics
        self.start_time: Optional[datetime] = None
        self.total_workspace_cycles = 0
        self.total_es_runs = 0
        self.total_attribution_checks = 0
        self.last_heartbeat: Optional[datetime] = None

        # Setup signal handlers
        self._setup_signal_handlers()

        logger.info(f"[OmniDaemon] Initialized with config: {self.config}")

    @property
    def workspace_manager(self):
        """Lazy load workspace manager."""
        if self._workspace_manager is None:
            from infrastructure.omnidaemon.workspace_manager import WorkspaceManager
            self._workspace_manager = WorkspaceManager(
                storage_dir=self.config.workspace_dir,
                max_active=self.config.max_active_workspaces,
                synthesis_threshold=self.config.workspace_synthesis_threshold
            )
        return self._workspace_manager

    @property
    def attribution_tracker(self):
        """Lazy load attribution tracker."""
        if self._attribution_tracker is None:
            from infrastructure.omnidaemon.attribution_tracker import AttributionTracker
            self._attribution_tracker = AttributionTracker(
                storage_dir=self.config.attribution_dir,
                free_rider_threshold=self.config.free_rider_threshold
            )
        return self._attribution_tracker

    @property
    def es_scheduler(self):
        """Lazy load ES training scheduler."""
        if self._es_scheduler is None:
            from infrastructure.omnidaemon.es_scheduler import ESTrainingScheduler
            self._es_scheduler = ESTrainingScheduler(
                training_time=self.config.es_training_time,
                iterations=self.config.es_training_iterations,
                population=self.config.es_training_population,
                dry_run=self.config.es_training_dry_run
            )
        return self._es_scheduler

    def _setup_signal_handlers(self):
        """Setup graceful shutdown handlers."""
        def signal_handler(signum, frame):
            logger.info(f"[OmniDaemon] Received signal {signum}, initiating graceful shutdown...")
            self._shutdown_requested = True

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    async def start(self):
        """Start the daemon."""
        if self._running:
            logger.warning("[OmniDaemon] Already running")
            return

        self._running = True
        self.start_time = datetime.now()

        logger.info("=" * 60)
        logger.info("[OmniDaemon] Starting continuous orchestration service")
        logger.info("=" * 60)
        logger.info(f"Start time: {self.start_time.isoformat()}")
        logger.info(f"Workspace check interval: {self.config.workspace_check_interval}s")
        logger.info(f"ES training: {'Enabled' if self.config.es_training_enabled else 'Disabled'} at {self.config.es_training_time}")
        logger.info(f"Attribution tracking: {'Enabled' if self.config.attribution_enabled else 'Disabled'}")
        logger.info("=" * 60)

        # Load existing state
        await self._load_state()

        # Start background tasks
        tasks = [
            asyncio.create_task(self._heartbeat_loop(), name="heartbeat"),
            asyncio.create_task(self._workspace_loop(), name="workspace"),
        ]

        if self.config.es_training_enabled:
            tasks.append(asyncio.create_task(self._es_training_loop(), name="es_training"))

        if self.config.attribution_enabled:
            tasks.append(asyncio.create_task(self._attribution_loop(), name="attribution"))

        try:
            # Run until shutdown requested
            while not self._shutdown_requested:
                await asyncio.sleep(1)

            logger.info("[OmniDaemon] Shutdown requested, cleaning up...")

            # Cancel all tasks
            for task in tasks:
                task.cancel()

            # Wait for tasks to complete
            await asyncio.gather(*tasks, return_exceptions=True)

            # Save state
            await self._save_state()

        except Exception as e:
            logger.error(f"[OmniDaemon] Fatal error: {e}", exc_info=True)
            raise

        finally:
            self._running = False
            logger.info("[OmniDaemon] Shutdown complete")

    async def _heartbeat_loop(self):
        """Heartbeat monitoring loop."""
        while not self._shutdown_requested:
            try:
                await self._update_heartbeat()
                await asyncio.sleep(self.config.heartbeat_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Heartbeat] Error: {e}", exc_info=True)
                await asyncio.sleep(self.config.heartbeat_interval)

    async def _workspace_loop(self):
        """Workspace management loop."""
        while not self._shutdown_requested:
            try:
                await self._process_workspaces()
                self.total_workspace_cycles += 1
                await asyncio.sleep(self.config.workspace_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Workspace] Error: {e}", exc_info=True)
                await asyncio.sleep(self.config.workspace_check_interval)

    async def _es_training_loop(self):
        """ES training scheduling loop."""
        while not self._shutdown_requested:
            try:
                if await self._is_training_time():
                    logger.info("[ES Training] Starting scheduled training run...")
                    await self.es_scheduler.run_training()
                    self.total_es_runs += 1
                    logger.info(f"[ES Training] Completed run #{self.total_es_runs}")

                # Check every hour
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[ES Training] Error: {e}", exc_info=True)
                await asyncio.sleep(3600)

    async def _attribution_loop(self):
        """Attribution tracking loop."""
        while not self._shutdown_requested:
            try:
                await self._check_attribution()
                self.total_attribution_checks += 1
                await asyncio.sleep(self.config.attribution_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Attribution] Error: {e}", exc_info=True)
                await asyncio.sleep(self.config.attribution_check_interval)

    async def _process_workspaces(self):
        """Process all active workspaces."""
        active_workspaces = await self.workspace_manager.get_active_workspaces()

        if not active_workspaces:
            logger.debug("[Workspace] No active workspaces")
            return

        logger.info(f"[Workspace] Processing {len(active_workspaces)} active workspaces")

        for workspace_id, workspace in active_workspaces.items():
            try:
                # Check if workspace needs synthesis
                if workspace.needs_synthesis():
                    logger.info(f"[Workspace] Synthesizing workspace '{workspace_id}'")
                    await workspace.synthesize()

                # Process pending interactions
                pending = await workspace.get_pending_interactions()
                if pending:
                    logger.info(f"[Workspace] Processing {len(pending)} interactions for '{workspace_id}'")
                    for interaction in pending:
                        await workspace.process_interaction(interaction)

            except Exception as e:
                logger.error(f"[Workspace] Error processing '{workspace_id}': {e}", exc_info=True)

    async def _check_attribution(self):
        """Check attribution and detect free-riders."""
        # Get recent collaborations
        recent = await self.attribution_tracker.get_recent_collaborations(hours=24)

        if not recent:
            logger.debug("[Attribution] No recent collaborations")
            return

        logger.info(f"[Attribution] Analyzing {len(recent)} recent collaborations")

        # Compute metrics
        metrics = await self.attribution_tracker.compute_metrics()
        logger.info(f"[Attribution] Metrics: {metrics}")

        # Detect free-riders if enabled
        if self.config.free_rider_detection_enabled:
            free_riders = await self.attribution_tracker.detect_free_riders()
            if free_riders:
                logger.warning(f"[Attribution] Free-riders detected: {free_riders}")
                await self._handle_free_riders(free_riders)

    async def _is_training_time(self) -> bool:
        """Check if it's time for ES training."""
        now = datetime.now()
        training_time = dt_time(*map(int, self.config.es_training_time.split(":")))

        # Check if current hour/minute matches training time
        return now.hour == training_time.hour and now.minute == training_time.minute

    async def _handle_free_riders(self, free_riders: List[str]):
        """Handle detected free-rider agents."""
        logger.warning(f"[OmniDaemon] Handling free-riders: {free_riders}")

        # For now, just log and track
        # Future: Could disable agents, send alerts, etc.
        for agent_name in free_riders:
            stats = await self.attribution_tracker.get_agent_stats(agent_name)
            logger.warning(
                f"[Free-Rider] {agent_name}: "
                f"avg_contribution={stats.get('avg_contribution', 0):.3f}, "
                f"collaborations={stats.get('collaboration_count', 0)}"
            )

    async def _update_heartbeat(self):
        """Update heartbeat file."""
        self.last_heartbeat = datetime.now()

        uptime = (self.last_heartbeat - self.start_time).total_seconds() if self.start_time else 0

        heartbeat = {
            "status": "running",
            "timestamp": self.last_heartbeat.isoformat(),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "uptime_seconds": uptime,
            "metrics": {
                "workspace_cycles": self.total_workspace_cycles,
                "es_training_runs": self.total_es_runs,
                "attribution_checks": self.total_attribution_checks,
                "active_workspaces": len(await self.workspace_manager.get_active_workspaces()) if self._workspace_manager else 0,
            },
            "config": asdict(self.config)
        }

        # Write to file
        with open(self.config.heartbeat_file, 'w') as f:
            json.dump(heartbeat, f, indent=2, default=str)

        logger.debug(f"[Heartbeat] Updated (uptime: {uptime:.0f}s)")

    async def _load_state(self):
        """Load persisted state."""
        state_file = self.config.data_dir / "daemon_state.json"

        if not state_file.exists():
            logger.info("[OmniDaemon] No previous state found, starting fresh")
            return

        try:
            with open(state_file, 'r') as f:
                state = json.load(f)

            self.total_workspace_cycles = state.get("total_workspace_cycles", 0)
            self.total_es_runs = state.get("total_es_runs", 0)
            self.total_attribution_checks = state.get("total_attribution_checks", 0)

            logger.info(
                f"[OmniDaemon] Loaded state: "
                f"workspace_cycles={self.total_workspace_cycles}, "
                f"es_runs={self.total_es_runs}, "
                f"attribution_checks={self.total_attribution_checks}"
            )

        except Exception as e:
            logger.error(f"[OmniDaemon] Error loading state: {e}", exc_info=True)

    async def _save_state(self):
        """Save current state."""
        state_file = self.config.data_dir / "daemon_state.json"

        state = {
            "timestamp": datetime.now().isoformat(),
            "total_workspace_cycles": self.total_workspace_cycles,
            "total_es_runs": self.total_es_runs,
            "total_attribution_checks": self.total_attribution_checks,
        }

        try:
            with open(state_file, 'w') as f:
                json.dump(state, f, indent=2)

            logger.info("[OmniDaemon] State saved successfully")

        except Exception as e:
            logger.error(f"[OmniDaemon] Error saving state: {e}", exc_info=True)

    def get_status(self) -> Dict[str, Any]:
        """Get current daemon status."""
        uptime = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0

        return {
            "running": self._running,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "uptime_seconds": uptime,
            "uptime_human": self._format_uptime(uptime),
            "metrics": {
                "workspace_cycles": self.total_workspace_cycles,
                "es_training_runs": self.total_es_runs,
                "attribution_checks": self.total_attribution_checks,
            },
            "components": {
                "workspace_manager": self._workspace_manager is not None,
                "attribution_tracker": self._attribution_tracker is not None,
                "es_scheduler": self._es_scheduler is not None,
            }
        }

    def _format_uptime(self, seconds: float) -> str:
        """Format uptime in human-readable format."""
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0:
            parts.append(f"{hours}h")
        if minutes > 0:
            parts.append(f"{minutes}m")
        parts.append(f"{secs}s")

        return " ".join(parts)


async def main():
    """Main entry point."""
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/omnidaemon.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )

    # Create daemon
    config = DaemonConfig(
        es_training_enabled=True,
        es_training_time="02:00",
        attribution_enabled=True,
    )

    daemon = OmniDaemon(config)

    # Start daemon
    await daemon.start()


if __name__ == "__main__":
    asyncio.run(main())
