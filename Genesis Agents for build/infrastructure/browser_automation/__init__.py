"""
Genesis Browser Automation Infrastructure

Integrations:
- Integration #67: Skyvern Browser Automation (vision-based)
- Integration #74: VOIX Declarative Discovery Layer (declarative)

Hybrid Approach:
- Use VOIX when available (10-25x faster, 99%+ success rate)
- Fallback to Skyvern when VOIX not supported (universal compatibility)
"""

# Skyvern (Integration #67)
from .skyvern_client import SkyvernClient, SkyvernTask, SkyvernTaskStatus

# VOIX (Integration #74)
from .voix_detector import VoixDetector, ToolDefinition, ContextDefinition, get_voix_detector
from .voix_executor import VoixExecutor, VoixInvocationResult, get_voix_executor
from .hybrid_automation import (
    HybridBrowserAutomation,
    AutomationMode,
    AutomationResult,
    get_hybrid_automation
)

__all__ = [
    # Skyvern (#67)
    "SkyvernClient",
    "SkyvernTask",
    "SkyvernTaskStatus",

    # VOIX Detector (#74)
    "VoixDetector",
    "ToolDefinition",
    "ContextDefinition",
    "get_voix_detector",

    # VOIX Executor (#74)
    "VoixExecutor",
    "VoixInvocationResult",
    "get_voix_executor",

    # Hybrid Automation (#74)
    "HybridBrowserAutomation",
    "AutomationMode",
    "AutomationResult",
    "get_hybrid_automation",
]
