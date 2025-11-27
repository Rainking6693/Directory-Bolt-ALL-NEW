"""
DeepEyesV2 Tool Reliability - Baseline Metrics Collection

Measures current tool invocation success rates for all 21 Genesis agents.
Categorizes failures (timeout, API error, wrong tool, invalid params) and
calculates baseline success rate per agent.

Phase 1 of DeepEyesV2: Establish performance baselines before enhancement.

Author: Shane (Backend Specialist)
Date: 2025-11-18
Integration: DeepEyesV2 Phase 1
"""

import asyncio
import json
import logging
import traceback
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from enum import Enum

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


class ToolFailureType(Enum):
    """Categories of tool invocation failures"""
    TIMEOUT = "timeout"
    API_ERROR = "api_error"
    WRONG_TOOL = "wrong_tool"
    INVALID_PARAMS = "invalid_params"
    PARSING_ERROR = "parsing_error"
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    UNKNOWN = "unknown"


@dataclass
class ToolInvocation:
    """A single tool invocation attempt"""
    agent_name: str
    tool_name: str
    task_description: str
    parameters: Dict[str, Any]
    success: bool
    status_code: Optional[int] = None
    error_message: Optional[str] = None
    failure_type: Optional[ToolFailureType] = None
    stack_trace: Optional[str] = None
    latency_ms: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    result: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, serializing enums"""
        data = asdict(self)
        if self.failure_type:
            data["failure_type"] = self.failure_type.value
        return data


@dataclass
class AgentToolMetrics:
    """Metrics for a single agent's tool usage"""
    agent_name: str
    total_invocations: int = 0
    successful_invocations: int = 0
    failed_invocations: int = 0
    failure_breakdown: Dict[str, int] = field(default_factory=dict)
    average_latency_ms: float = 0.0
    success_rate: float = 0.0
    tools_used: Set[str] = field(default_factory=set)
    errors_by_tool: Dict[str, List[str]] = field(default_factory=dict)

    def calculate_success_rate(self) -> None:
        """Calculate success rate from invocation counts"""
        if self.total_invocations > 0:
            self.success_rate = self.successful_invocations / self.total_invocations
        else:
            self.success_rate = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, serializing sets"""
        data = asdict(self)
        data["tools_used"] = list(self.tools_used)
        # Keep errors_by_tool as dict but convert lists to lists (safe)
        return data


class BaselineMetricsCollector:
    """
    Collects and analyzes tool invocation metrics across all Genesis agents.

    Features:
    - Track success/failure for each tool invocation
    - Categorize failures by type (timeout, API error, etc.)
    - Calculate baseline success rates per agent
    - Store detailed logs with stack traces for debugging
    - Generate reports for dashboard visualization

    Usage:
        collector = BaselineMetricsCollector()

        # Record invocation
        await collector.record_invocation(
            agent_name="builder_agent",
            tool_name="code_executor",
            task="Execute Python code",
            parameters={"code": "print('hello')"},
            success=True,
            latency_ms=45.2
        )

        # Get metrics
        metrics = collector.get_metrics()
        report = collector.generate_report()
    """

    def __init__(
        self,
        metrics_dir: str = "data/tool_reliability",
        agents: Optional[List[str]] = None,
    ):
        """
        Initialize baseline metrics collector.

        Args:
            metrics_dir: Directory to store metrics JSON files
            agents: List of agent names to track (defaults to all 21)
        """
        self.metrics_dir = Path(metrics_dir)
        self.metrics_dir.mkdir(parents=True, exist_ok=True)

        # All 21 Genesis agents
        self.all_agents = agents or [
            "spec_agent",
            "architect_agent",
            "builder_agent",
            "frontend_agent",
            "backend_agent",
            "qa_agent",
            "security_agent",
            "deploy_agent",
            "monitoring_agent",
            "maintenance_agent",
            "marketing_agent",
            "sales_agent",
            "support_agent",
            "analytics_agent",
            "finance_agent",
            "content_agent",
            "legal_agent",
            "analyst_agent",
            "research_agent",
            "darwin_agent",
            "domain_name_agent",
        ]

        # Initialize metrics storage
        self.invocations: List[ToolInvocation] = []
        self.agent_metrics: Dict[str, AgentToolMetrics] = {
            agent: AgentToolMetrics(agent_name=agent) for agent in self.all_agents
        }

        logger.info(f"BaselineMetricsCollector initialized with {len(self.all_agents)} agents")

    async def record_invocation(
        self,
        agent_name: str,
        tool_name: str,
        task: str,
        parameters: Dict[str, Any],
        success: bool,
        status_code: Optional[int] = None,
        error_message: Optional[str] = None,
        failure_type: Optional[ToolFailureType] = None,
        latency_ms: float = 0.0,
        result: Optional[Dict[str, Any]] = None,
    ) -> ToolInvocation:
        """
        Record a tool invocation attempt.

        Args:
            agent_name: Name of agent making invocation
            tool_name: Name of tool being invoked
            task: Description of task being performed
            parameters: Tool parameters
            success: Whether invocation succeeded
            status_code: HTTP status code (if applicable)
            error_message: Error message (if failed)
            failure_type: Category of failure (if applicable)
            latency_ms: Execution time in milliseconds
            result: Tool result (if successful)

        Returns:
            Recorded ToolInvocation object
        """
        invocation = ToolInvocation(
            agent_name=agent_name,
            tool_name=tool_name,
            task_description=task,
            parameters=parameters,
            success=success,
            status_code=status_code,
            error_message=error_message,
            failure_type=failure_type,
            latency_ms=latency_ms,
            result=result,
        )

        # If failed, capture stack trace
        if not success and error_message:
            invocation.stack_trace = traceback.format_exc()

        # Store invocation
        self.invocations.append(invocation)

        # Update agent metrics
        if agent_name in self.agent_metrics:
            metrics = self.agent_metrics[agent_name]
            metrics.total_invocations += 1
            metrics.tools_used.add(tool_name)

            if success:
                metrics.successful_invocations += 1
            else:
                metrics.failed_invocations += 1
                if failure_type:
                    metrics.failure_breakdown[failure_type.value] = (
                        metrics.failure_breakdown.get(failure_type.value, 0) + 1
                    )
                if tool_name not in metrics.errors_by_tool:
                    metrics.errors_by_tool[tool_name] = []
                if error_message:
                    metrics.errors_by_tool[tool_name].append(error_message)

            # Update average latency (running average)
            if metrics.total_invocations > 1:
                metrics.average_latency_ms = (
                    (metrics.average_latency_ms * (metrics.total_invocations - 1) + latency_ms)
                    / metrics.total_invocations
                )
            else:
                metrics.average_latency_ms = latency_ms

            metrics.calculate_success_rate()

            logger.debug(
                f"Recorded {agent_name}.{tool_name}: "
                f"success={success}, latency={latency_ms:.1f}ms"
            )

        return invocation

    def get_metrics(self) -> Dict[str, AgentToolMetrics]:
        """
        Get current metrics for all agents.

        Returns:
            Dictionary mapping agent names to metrics
        """
        return self.agent_metrics.copy()

    def get_agent_metrics(self, agent_name: str) -> Optional[AgentToolMetrics]:
        """
        Get metrics for a specific agent.

        Args:
            agent_name: Agent to get metrics for

        Returns:
            AgentToolMetrics or None if agent not found
        """
        return self.agent_metrics.get(agent_name)

    def get_invocations(
        self,
        agent_name: Optional[str] = None,
        tool_name: Optional[str] = None,
        success_only: bool = False,
    ) -> List[ToolInvocation]:
        """
        Get invocation history with optional filtering.

        Args:
            agent_name: Filter by agent (optional)
            tool_name: Filter by tool (optional)
            success_only: Only return successful invocations

        Returns:
            Filtered list of invocations
        """
        results = self.invocations

        if agent_name:
            results = [i for i in results if i.agent_name == agent_name]

        if tool_name:
            results = [i for i in results if i.tool_name == tool_name]

        if success_only:
            results = [i for i in results if i.success]

        return results

    def generate_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive baseline metrics report.

        Returns:
            Dictionary containing:
            - summary: Overall statistics
            - by_agent: Per-agent breakdown
            - failure_analysis: Common failure patterns
            - recommendations: Suggested improvements
        """
        total_invocations = len(self.invocations)
        successful = sum(1 for i in self.invocations if i.success)
        failed = total_invocations - successful

        # Failure distribution
        failure_distribution: Dict[str, int] = {}
        for invocation in self.invocations:
            if not invocation.success and invocation.failure_type:
                failure_distribution[invocation.failure_type.value] = (
                    failure_distribution.get(invocation.failure_type.value, 0) + 1
                )

        # Tool success rates
        tool_metrics: Dict[str, Dict[str, Any]] = {}
        for invocation in self.invocations:
            tool_key = invocation.tool_name
            if tool_key not in tool_metrics:
                tool_metrics[tool_key] = {
                    "total": 0,
                    "successful": 0,
                    "failed": 0,
                    "success_rate": 0.0,
                }
            tool_metrics[tool_key]["total"] += 1
            if invocation.success:
                tool_metrics[tool_key]["successful"] += 1
            else:
                tool_metrics[tool_key]["failed"] += 1

        # Calculate tool success rates
        for tool_key, metrics in tool_metrics.items():
            if metrics["total"] > 0:
                metrics["success_rate"] = metrics["successful"] / metrics["total"]

        # Agent breakdown
        agent_breakdown = {
            agent: asdict(self.agent_metrics[agent]) for agent in self.all_agents
        }

        # Find agents needing most improvement
        agents_by_success = sorted(
            self.agent_metrics.items(),
            key=lambda x: x[1].success_rate,
        )

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_invocations": total_invocations,
                "successful": successful,
                "failed": failed,
                "overall_success_rate": successful / total_invocations if total_invocations > 0 else 0.0,
                "average_latency_ms": (
                    sum(i.latency_ms for i in self.invocations) / total_invocations
                    if total_invocations > 0
                    else 0.0
                ),
            },
            "failure_distribution": failure_distribution,
            "tool_metrics": tool_metrics,
            "agent_breakdown": agent_breakdown,
            "agents_needing_improvement": [
                {
                    "agent": name,
                    "success_rate": metrics.success_rate,
                    "total_invocations": metrics.total_invocations,
                    "failed": metrics.failed_invocations,
                }
                for name, metrics in agents_by_success[:5]  # Top 5 worst performers
            ],
        }

        return report

    async def save_report(self, filename: str = "baseline_metrics.json") -> Path:
        """
        Save metrics report to file.

        Args:
            filename: Output filename

        Returns:
            Path to saved file
        """
        report = self.generate_report()
        output_path = self.metrics_dir / filename

        with output_path.open("w") as f:
            json.dump(report, f, indent=2, default=str)

        logger.info(f"Saved baseline metrics report to {output_path}")
        return output_path

    async def save_invocations(self, filename: str = "invocations.jsonl") -> Path:
        """
        Save detailed invocations to JSONL file for training data.

        Args:
            filename: Output filename

        Returns:
            Path to saved file
        """
        output_path = self.metrics_dir / filename

        with output_path.open("w") as f:
            for invocation in self.invocations:
                json.dump(invocation.to_dict(), f)
                f.write("\n")

        logger.info(f"Saved {len(self.invocations)} invocations to {output_path}")
        return output_path

    def reset_metrics(self) -> None:
        """Reset all collected metrics"""
        self.invocations = []
        self.agent_metrics = {
            agent: AgentToolMetrics(agent_name=agent) for agent in self.all_agents
        }
        logger.info("Metrics reset")


# Global singleton instance
_collector_instance: Optional[BaselineMetricsCollector] = None


def get_baseline_metrics_collector() -> BaselineMetricsCollector:
    """
    Get or create singleton BaselineMetricsCollector instance.

    Returns:
        BaselineMetricsCollector instance
    """
    global _collector_instance
    if _collector_instance is None:
        _collector_instance = BaselineMetricsCollector()
    return _collector_instance
