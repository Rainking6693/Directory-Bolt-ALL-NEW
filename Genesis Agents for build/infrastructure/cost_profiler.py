"""
CostProfiler: Agent Cost Profiling for DAAO Optimization
Based on DAAO (arXiv:2509.11079)

Key Features:
- Track token usage per agent per task type
- Track execution time per agent per task type
- Track success rate per agent per task type
- Calculate cost per completed task
- Real-time cost estimation for routing decisions

Integration Point: Provides cost profiles to DAAOOptimizer for optimal agent assignment
"""
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)


@dataclass
class TaskExecutionMetrics:
    """
    Metrics for a single task execution

    Captures complete execution profile for cost analysis
    """
    task_id: str
    agent_name: str
    task_type: str
    tokens_used: int
    execution_time_seconds: float
    success: bool
    timestamp: datetime
    cost_usd: float  # Calculated based on model pricing
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentCostProfile:
    """
    Cost profile for an agent on a specific task type

    Maintains running statistics for cost optimization
    """
    agent_name: str
    task_type: str

    # Token statistics
    total_tokens: int = 0
    avg_tokens: float = 0.0
    min_tokens: int = 0
    max_tokens: int = 0

    # Time statistics
    total_time_seconds: float = 0.0
    avg_time_seconds: float = 0.0
    min_time_seconds: float = 0.0
    max_time_seconds: float = 0.0

    # Cost statistics
    total_cost_usd: float = 0.0
    avg_cost_usd: float = 0.0
    min_cost_usd: float = 0.0
    max_cost_usd: float = 0.0

    # Success statistics
    total_executions: int = 0
    successful_executions: int = 0
    success_rate: float = 0.0

    # Cost per completed task (key metric for DAAO)
    cost_per_success: float = 0.0

    # Recent history for adaptive profiling
    recent_executions: List[TaskExecutionMetrics] = field(default_factory=list)

    def update(self, metrics: TaskExecutionMetrics) -> None:
        """
        Update profile with new execution metrics

        Maintains running statistics and recent history
        """
        self.total_executions += 1

        if metrics.success:
            self.successful_executions += 1

        # Update token statistics
        self.total_tokens += metrics.tokens_used
        self._update_stats(
            metrics.tokens_used,
            'tokens'
        )

        # Update time statistics
        self.total_time_seconds += metrics.execution_time_seconds
        self._update_stats(
            metrics.execution_time_seconds,
            'time_seconds'
        )

        # Update cost statistics
        self.total_cost_usd += metrics.cost_usd
        self._update_stats(
            metrics.cost_usd,
            'cost_usd'
        )

        # Update success rate
        self.success_rate = self.successful_executions / self.total_executions

        # Update cost per success (critical for DAAO)
        if self.successful_executions > 0:
            self.cost_per_success = self.total_cost_usd / self.successful_executions

        # Maintain recent history (last 10 executions)
        self.recent_executions.append(metrics)
        if len(self.recent_executions) > 10:
            self.recent_executions.pop(0)

    def _update_stats(self, value: float, stat_type: str) -> None:
        """Update min/max/avg for a statistic"""
        if stat_type == 'tokens':
            self.min_tokens = min(self.min_tokens, value) if self.min_tokens > 0 else value
            self.max_tokens = max(self.max_tokens, value)
            self.avg_tokens = self.total_tokens / self.total_executions
        elif stat_type == 'time_seconds':
            self.min_time_seconds = min(self.min_time_seconds, value) if self.min_time_seconds > 0 else value
            self.max_time_seconds = max(self.max_time_seconds, value)
            self.avg_time_seconds = self.total_time_seconds / self.total_executions
        elif stat_type == 'cost_usd':
            self.min_cost_usd = min(self.min_cost_usd, value) if self.min_cost_usd > 0 else value
            self.max_cost_usd = max(self.max_cost_usd, value)
            self.avg_cost_usd = self.total_cost_usd / self.total_executions

    def get_recent_avg_cost(self) -> float:
        """Get average cost from recent executions (adaptive profiling)"""
        if not self.recent_executions:
            return self.avg_cost_usd

        return statistics.mean([m.cost_usd for m in self.recent_executions])

    def get_recent_success_rate(self) -> float:
        """Get success rate from recent executions (adaptive profiling)"""
        if not self.recent_executions:
            return self.success_rate

        successes = sum(1 for m in self.recent_executions if m.success)
        return successes / len(self.recent_executions)


class CostProfiler:
    """
    Cost profiling system for agent-task combinations

    Tracks execution metrics across all agents and task types,
    providing cost estimates for DAAO optimizer routing decisions.

    Key Responsibilities:
    1. Collect metrics from completed tasks
    2. Update agent cost profiles
    3. Provide cost estimates for routing decisions
    4. Support adaptive profiling (recent history weighted)
    """

    # Model pricing (USD per 1M tokens)
    MODEL_PRICING = {
        "cheap": 0.03,      # Gemini Flash
        "medium": 3.0,      # GPT-4o, Claude Sonnet
        "expensive": 15.0   # Claude Opus
    }

    def __init__(self):
        """Initialize cost profiler"""
        # Profile storage: (agent_name, task_type) -> AgentCostProfile
        self.profiles: Dict[tuple, AgentCostProfile] = {}

        # Execution history
        self.execution_history: List[TaskExecutionMetrics] = []

        self.logger = logger
        self.logger.info("Initialized CostProfiler")

    def record_execution(
        self,
        task_id: str,
        agent_name: str,
        task_type: str,
        tokens_used: int,
        execution_time_seconds: float,
        success: bool,
        cost_tier: str = "medium",
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Record task execution metrics

        Args:
            task_id: Task identifier
            agent_name: Agent that executed the task
            task_type: Type of task (e.g., "implement", "test")
            tokens_used: Total tokens consumed
            execution_time_seconds: Execution time in seconds
            success: Whether task completed successfully
            cost_tier: Agent cost tier (cheap/medium/expensive)
            metadata: Optional additional metadata
        """
        # Calculate cost
        cost_usd = self._calculate_cost(tokens_used, cost_tier)

        # Create metrics
        metrics = TaskExecutionMetrics(
            task_id=task_id,
            agent_name=agent_name,
            task_type=task_type,
            tokens_used=tokens_used,
            execution_time_seconds=execution_time_seconds,
            success=success,
            timestamp=datetime.now(),
            cost_usd=cost_usd,
            metadata=metadata or {}
        )

        # Store in history
        self.execution_history.append(metrics)

        # Update profile
        profile_key = (agent_name, task_type)
        if profile_key not in self.profiles:
            self.profiles[profile_key] = AgentCostProfile(
                agent_name=agent_name,
                task_type=task_type
            )

        self.profiles[profile_key].update(metrics)

        self.logger.info(
            f"Recorded execution: {agent_name}/{task_type} - "
            f"{tokens_used} tokens, ${cost_usd:.4f}, "
            f"{'success' if success else 'failure'}"
        )

    def _calculate_cost(self, tokens: int, cost_tier: str) -> float:
        """Calculate cost in USD for token usage"""
        price_per_million = self.MODEL_PRICING.get(cost_tier, 3.0)
        return (tokens / 1_000_000) * price_per_million

    def get_profile(
        self,
        agent_name: str,
        task_type: str
    ) -> Optional[AgentCostProfile]:
        """
        Get cost profile for agent-task combination

        Returns:
            AgentCostProfile if exists, None otherwise
        """
        profile_key = (agent_name, task_type)
        return self.profiles.get(profile_key)

    def estimate_cost(
        self,
        agent_name: str,
        task_type: str,
        task_complexity: float = 1.0,
        use_recent: bool = True
    ) -> float:
        """
        Estimate cost for agent-task assignment

        Args:
            agent_name: Agent name
            task_type: Task type
            task_complexity: Complexity multiplier (0.5 = simple, 2.0 = complex)
            use_recent: Use recent history (adaptive profiling)

        Returns:
            Estimated cost in USD
        """
        profile = self.get_profile(agent_name, task_type)

        if profile is None:
            # No history: use default based on agent cost tier
            # This will be refined as execution data accumulates
            return 0.01 * task_complexity  # Default: $0.01 per task

        # Use recent average if adaptive profiling enabled
        if use_recent and len(profile.recent_executions) > 0:
            base_cost = profile.get_recent_avg_cost()
        else:
            base_cost = profile.avg_cost_usd

        # Adjust for task complexity
        return base_cost * task_complexity

    def estimate_time(
        self,
        agent_name: str,
        task_type: str,
        task_complexity: float = 1.0
    ) -> float:
        """
        Estimate execution time for agent-task assignment

        Args:
            agent_name: Agent name
            task_type: Task type
            task_complexity: Complexity multiplier

        Returns:
            Estimated time in seconds
        """
        profile = self.get_profile(agent_name, task_type)

        if profile is None:
            return 10.0 * task_complexity  # Default: 10 seconds

        return profile.avg_time_seconds * task_complexity

    def get_success_rate(
        self,
        agent_name: str,
        task_type: str,
        use_recent: bool = True
    ) -> float:
        """
        Get success rate for agent-task combination

        Args:
            agent_name: Agent name
            task_type: Task type
            use_recent: Use recent history (adaptive profiling)

        Returns:
            Success rate (0.0 to 1.0)
        """
        profile = self.get_profile(agent_name, task_type)

        if profile is None:
            return 0.85  # Default: 85% success rate

        if use_recent:
            return profile.get_recent_success_rate()
        else:
            return profile.success_rate

    def get_all_profiles(self) -> List[AgentCostProfile]:
        """Get all cost profiles"""
        return list(self.profiles.values())

    def get_agent_profiles(self, agent_name: str) -> List[AgentCostProfile]:
        """Get all profiles for a specific agent"""
        return [
            profile for profile in self.profiles.values()
            if profile.agent_name == agent_name
        ]

    def get_task_type_profiles(self, task_type: str) -> List[AgentCostProfile]:
        """Get all profiles for a specific task type"""
        return [
            profile for profile in self.profiles.values()
            if profile.task_type == task_type
        ]

    def get_cheapest_agent(self, task_type: str) -> Optional[str]:
        """
        Get cheapest agent for a task type

        Considers cost per success (key DAAO metric)

        Returns:
            Agent name or None if no profiles exist
        """
        task_profiles = self.get_task_type_profiles(task_type)

        if not task_profiles:
            return None

        # Filter to agents with successful executions
        successful_profiles = [
            p for p in task_profiles if p.successful_executions > 0
        ]

        if not successful_profiles:
            return None

        # Find agent with lowest cost per success
        best_profile = min(
            successful_profiles,
            key=lambda p: p.cost_per_success
        )

        return best_profile.agent_name

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get profiler statistics

        Returns:
            Summary statistics for monitoring
        """
        total_executions = len(self.execution_history)
        total_cost = sum(m.cost_usd for m in self.execution_history)
        total_successes = sum(1 for m in self.execution_history if m.success)

        return {
            "total_executions": total_executions,
            "total_cost_usd": total_cost,
            "total_successes": total_successes,
            "success_rate": total_successes / total_executions if total_executions > 0 else 0.0,
            "avg_cost_per_task": total_cost / total_executions if total_executions > 0 else 0.0,
            "total_profiles": len(self.profiles),
            "agents_tracked": len(set(p.agent_name for p in self.profiles.values())),
            "task_types_tracked": len(set(p.task_type for p in self.profiles.values()))
        }

    def reset(self) -> None:
        """Reset all profiles (for testing)"""
        self.profiles.clear()
        self.execution_history.clear()
        self.logger.info("Reset all cost profiles")
