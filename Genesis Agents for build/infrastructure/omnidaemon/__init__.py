"""
OmniDaemon - Continuous Background Orchestration Service

Integrates:
- IterResearch Workspace Manager (#69) - Long-horizon task management
- Dr. MAMR Attribution Layer (#70) - Multi-agent performance tracking
- ES Training Scheduler (#68) - Nightly model optimization
"""

from .daemon_core import OmniDaemon, DaemonConfig
from .workspace_manager import WorkspaceManager
from .attribution_tracker import AttributionTracker

__all__ = [
    "OmniDaemon",
    "DaemonConfig",
    "WorkspaceManager",
    "AttributionTracker",
]
