"""
Rogue testing infrastructure for Genesis multi-agent system.

This module provides comprehensive test orchestration, scenario management,
and parallel execution capabilities for testing 15 Genesis agents across
2,200+ scenarios using the Rogue evaluation framework.

Components:
- scenario_loader: YAML/JSON scenario parsing and validation
- rogue_runner: Main test orchestrator with parallel execution
- cost_tracker: LLM API usage monitoring and reporting
- result_collector: Test result aggregation and analytics
"""

__version__ = "1.0.0"
__all__ = ["scenario_loader", "rogue_runner"]
