"""
AgentEvolver - Autonomous Agent Self-Evolution System

This module implements the AgentEvolver system from the paper:
"Towards Efficient Self-Evolving Agent System" (2511.10395)

Key Mechanisms:
1. Self-Questioning: Curiosity-driven task generation (reduces manual dataset creation)
2. Self-Navigating: Experience reuse + hybrid policy guidance (improves exploration efficiency)
3. Self-Attributing: Differentiated rewards based on contribution (enhances sample efficiency)

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phases 1-4
"""

__version__ = "1.0.0"
__all__ = [
    "SelfQuestioningModule",
    "CoverageTracker",
    "ExperienceBuffer",
    "HybridPolicy",
    "AttributionEngine",
    "CreditAssignment",
    "CreditAssignmentModule",  # Alias for backward compatibility
    "MultiAgentSharing",
    "MultiAgentContextSharing",  # Alias for backward compatibility
    "DailyScheduler",
    "AgentEvolverScheduler",  # Alias for backward compatibility
]

# Lazy imports - only load when needed
def __getattr__(name):
    """Lazy load AgentEvolver modules on demand."""
    if name == "SelfQuestioningModule":
        from .self_questioning import SelfQuestioningModule
        return SelfQuestioningModule
    elif name == "CoverageTracker":
        from .coverage_tracker import CoverageTracker
        return CoverageTracker
    elif name == "ExperienceBuffer":
        from .experience_buffer import ExperienceBuffer
        return ExperienceBuffer
    elif name == "HybridPolicy":
        from .hybrid_policy import HybridPolicy
        return HybridPolicy
    elif name == "AttributionEngine":
        from .attribution import AttributionEngine
        return AttributionEngine
    elif name == "CreditAssignment" or name == "CreditAssignmentModule":
        from .credit_assignment import CreditAssignment
        return CreditAssignment
    elif name == "MultiAgentSharing" or name == "MultiAgentContextSharing":
        from .multi_agent_sharing import MultiAgentSharing
        return MultiAgentSharing
    elif name == "DailyScheduler" or name == "AgentEvolverScheduler":
        from .scheduling import DailyScheduler
        return DailyScheduler
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
