"""
ToolRM Middleware

Multi-factor quality scoring for tool executions with reflection integration.
Implements the ToolRM (Tool Reward Model) pattern for agent self-improvement.

This middleware computes quality scores based on:
- Correctness: Did the tool execute successfully?
- Latency: Was it fast enough?
- Completeness: Does the result contain expected data?
- Accuracy: Is the result valid and well-formed?

Author: Shane (Backend API Specialist)
Date: 2025-11-08
Version: 1.0.0
"""

import logging
import json
from typing import Dict, List, Optional, Any
from pathlib import Path
from infrastructure.middleware.base import (
    AgentMiddleware,
    ToolCall,
    ToolResult,
)

# Orchestration layer imports
from infrastructure.halo_router import HALORouter
from infrastructure.task_dag import TaskDAG, Task
from infrastructure.aop_validator import AOPValidator

logger = logging.getLogger(__name__)


class ToolRMMiddleware(AgentMiddleware):
    """
    Compute tool quality scores for reflection (ToolRM pattern).

    This middleware implements a multi-factor reward model that scores
    tool executions on four dimensions:
    1. Correctness (40%): Binary success/failure
    2. Latency (20%): Execution speed
    3. Completeness (20%): Result data coverage
    4. Accuracy (20%): Result data validity

    Scores are stored for:
    - Real-time quality monitoring
    - Agent self-improvement (Darwin integration)
    - Tool selection optimization (HALO routing)
    - Failure analysis and debugging

    Usage:
        middleware = ToolRMMiddleware()
        # Middleware will be called automatically by HALO router
    """

    def __init__(
        self,
        reasoning_bank_dir: str = "data/reasoning_bank",
        enable_reflection: bool = True,
        halo_router: Optional[HALORouter] = None,
        aop_validator: Optional[AOPValidator] = None,
    ):
        """
        Initialize ToolRMMiddleware.

        Args:
            reasoning_bank_dir: Directory to store reasoning traces
            enable_reflection: Enable automatic reflection on poor scores
            halo_router: Optional HALORouter instance for agent routing integration
            aop_validator: Optional AOPValidator instance for orchestration validation
        """
        self.reasoning_bank_dir = Path(reasoning_bank_dir)
        self.reasoning_bank_dir.mkdir(parents=True, exist_ok=True)

        self.enable_reflection = enable_reflection

        # Orchestration integration
        self.halo_router = halo_router
        self.aop_validator = aop_validator

        # Quality thresholds
        self.quality_thresholds = {
            "excellent": 0.9,
            "good": 0.7,
            "acceptable": 0.5,
            "poor": 0.3,
        }

        # Scoring factors (must sum to 1.0)
        self.scoring_factors = {
            "correctness": 0.4,  # Did it work?
            "latency": 0.2,  # Was it fast?
            "completeness": 0.2,  # Did it return all data?
            "accuracy": 0.2,  # Is the data valid?
        }

        # Tool execution history (in-memory cache)
        self.execution_history: List[Dict[str, Any]] = []

        # Tool quality statistics
        self.tool_stats: Dict[str, Dict[str, Any]] = {}

        # Auto-register with HALO router if available
        if self.halo_router:
            self._register_with_halo()

        logger.info(
            f"ToolRMMiddleware initialized (reflection={'enabled' if enable_reflection else 'disabled'}, "
            f"HALO: {'enabled' if halo_router else 'disabled'}, "
            f"AOP: {'enabled' if aop_validator else 'disabled'})"
        )

    async def on_tool_call(self, call: ToolCall) -> None:
        """
        Record tool call start time.

        Args:
            call: Tool call request
        """
        # Store start time in context for latency calculation
        import time

        call.context["toolrm_start_time"] = time.time()
        logger.debug(f"ToolRM: Recording start time for {call.agent_name} → {call.tool_name}")

    async def on_tool_result(self, result: ToolResult) -> None:
        """
        Score tool execution quality and store for reflection.

        This is the core ToolRM scoring logic.

        Args:
            result: Tool execution result
        """
        # Compute multi-factor quality score
        score = self._compute_quality_score(result)

        # Get quality level
        quality_level = self._get_quality_level(score)

        # Store in reasoning bank
        self._store_execution_record(result, score, quality_level)

        # Update tool statistics
        self._update_tool_stats(result.tool_name, score, result.success)

        # Log score
        logger.info(
            f"ToolRM: {result.agent_name} → {result.tool_name} = {score:.2f} ({quality_level}) "
            f"[{result.execution_time_ms:.0f}ms]"
        )

        # Trigger reflection if score is poor
        if self.enable_reflection and score < self.quality_thresholds["acceptable"]:
            await self._trigger_reflection(result, score)

    async def on_tool_error(self, call: ToolCall, error: Exception) -> None:
        """
        Record tool failure.

        Args:
            call: Original tool call
            error: Exception that occurred
        """
        # Create synthetic result for error case
        import time

        execution_time = 0.0
        if "toolrm_start_time" in call.context:
            execution_time = (time.time() - call.context["toolrm_start_time"]) * 1000

        error_result = ToolResult(
            tool_name=call.tool_name,
            agent_name=call.agent_name,
            result=None,
            execution_time_ms=execution_time,
            success=False,
            error=str(error),
        )

        # Score the failure (will get 0.0 for correctness)
        score = self._compute_quality_score(error_result)

        # Store in reasoning bank
        self._store_execution_record(error_result, score, "failure")

        # Update tool statistics
        self._update_tool_stats(call.tool_name, score, success=False)

        logger.error(
            f"ToolRM: {call.agent_name} → {call.tool_name} FAILED "
            f"(score={score:.2f}, error={type(error).__name__})"
        )

    def _compute_quality_score(self, result: ToolResult) -> float:
        """
        Multi-factor quality scoring.

        Scoring formula:
            score = (0.4 * correctness) + (0.2 * latency) + (0.2 * completeness) + (0.2 * accuracy)

        Args:
            result: Tool execution result

        Returns:
            Quality score (0.0 to 1.0)
        """
        score = 0.0

        # Factor 1: Correctness (binary)
        if result.success:
            score += self.scoring_factors["correctness"]

        # Factor 2: Latency (faster = better)
        latency_score = self._score_latency(result.execution_time_ms)
        score += self.scoring_factors["latency"] * latency_score

        # Factor 3: Completeness (result has expected data)
        completeness_score = self._score_completeness(result)
        score += self.scoring_factors["completeness"] * completeness_score

        # Factor 4: Accuracy (result validates against schema)
        accuracy_score = self._score_accuracy(result)
        score += self.scoring_factors["accuracy"] * accuracy_score

        return min(1.0, max(0.0, score))  # Clamp to [0, 1]

    def _score_latency(self, execution_time_ms: float) -> float:
        """
        Score execution latency (faster = better).

        Scoring curve:
        - <1s = 1.0
        - 1-5s = linear decay to 0.5
        - 5-10s = linear decay to 0.2
        - >10s = 0.0

        Args:
            execution_time_ms: Execution time in milliseconds

        Returns:
            Latency score (0.0 to 1.0)
        """
        time_seconds = execution_time_ms / 1000.0

        if time_seconds < 1.0:
            return 1.0
        elif time_seconds < 5.0:
            # Linear decay: 1.0 → 0.5 over 4 seconds
            return 1.0 - (0.5 * (time_seconds - 1.0) / 4.0)
        elif time_seconds < 10.0:
            # Linear decay: 0.5 → 0.2 over 5 seconds
            return 0.5 - (0.3 * (time_seconds - 5.0) / 5.0)
        else:
            return 0.0

    def _score_completeness(self, result: ToolResult) -> float:
        """
        Score result completeness (has expected fields).

        This is a heuristic-based implementation. Production systems
        should use schema-based validation.

        Args:
            result: Tool execution result

        Returns:
            Completeness score (0.0 to 1.0)
        """
        if not result.success or result.result is None:
            return 0.0

        # Convert result to string for analysis
        result_str = str(result.result)

        # Heuristics for completeness
        checks = {
            "not_empty": len(result_str) > 0,
            "not_error_message": "error" not in result_str.lower(),
            "has_content": len(result_str) > 10,  # More than trivial output
            "not_none": result.result is not None,
        }

        # Score is percentage of checks passed
        passed = sum(1 for check in checks.values() if check)
        return passed / len(checks)

    def _score_accuracy(self, result: ToolResult) -> float:
        """
        Score result accuracy (is data valid/well-formed).

        This is a heuristic-based implementation. Production systems
        should use schema validation or LLM-based verification.

        Args:
            result: Tool execution result

        Returns:
            Accuracy score (0.0 to 1.0)
        """
        if not result.success or result.result is None:
            return 0.0

        # Heuristics for accuracy
        checks = {
            "no_exception_in_result": self._check_no_exception(result.result),
            "valid_json_if_dict": self._check_valid_json(result.result),
            "no_corrupt_data": self._check_no_corrupt_data(result.result),
        }

        # Score is percentage of checks passed
        passed = sum(1 for check in checks.values() if check)
        return passed / len(checks)

    def _check_no_exception(self, result: Any) -> bool:
        """Check if result doesn't contain exception traces."""
        result_str = str(result).lower()
        exception_keywords = ["traceback", "exception", "error:", "failed"]
        return not any(keyword in result_str for keyword in exception_keywords)

    def _check_valid_json(self, result: Any) -> bool:
        """Check if result is valid JSON (if it's a dict/list)."""
        if isinstance(result, (dict, list)):
            try:
                json.dumps(result)
                return True
            except (TypeError, ValueError):
                return False
        return True  # Not JSON = pass by default

    def _check_no_corrupt_data(self, result: Any) -> bool:
        """Check for signs of data corruption."""
        result_str = str(result)
        corruption_signs = [
            "\x00",  # Null bytes
            "�",  # Replacement character
            "<?xml",  # Unexpected XML
        ]
        return not any(sign in result_str for sign in corruption_signs)

    def _get_quality_level(self, score: float) -> str:
        """
        Get quality level from score.

        Args:
            score: Quality score (0.0 to 1.0)

        Returns:
            Quality level string
        """
        if score >= self.quality_thresholds["excellent"]:
            return "excellent"
        elif score >= self.quality_thresholds["good"]:
            return "good"
        elif score >= self.quality_thresholds["acceptable"]:
            return "acceptable"
        elif score >= self.quality_thresholds["poor"]:
            return "poor"
        else:
            return "failure"

    def _store_execution_record(
        self, result: ToolResult, score: float, quality_level: str
    ) -> None:
        """
        Store execution record in reasoning bank.

        Args:
            result: Tool execution result
            score: Quality score
            quality_level: Quality level string
        """
        record = {
            "timestamp": result.timestamp.isoformat(),
            "agent": result.agent_name,
            "tool": result.tool_name,
            "success": result.success,
            "execution_time_ms": result.execution_time_ms,
            "score": score,
            "quality_level": quality_level,
            "error": result.error,
            "metadata": result.metadata,
        }

        # Add to in-memory history
        self.execution_history.append(record)

        # Persist to disk (JSON Lines format)
        log_file = self.reasoning_bank_dir / "tool_executions.jsonl"
        try:
            with open(log_file, "a") as f:
                f.write(json.dumps(record) + "\n")
        except Exception as e:
            logger.error(f"Failed to persist execution record: {e}")

    def _update_tool_stats(self, tool_name: str, score: float, success: bool) -> None:
        """
        Update tool statistics.

        Args:
            tool_name: Tool name
            score: Quality score
            success: Whether execution succeeded
        """
        if tool_name not in self.tool_stats:
            self.tool_stats[tool_name] = {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_score": 0.0,
                "avg_score": 0.0,
            }

        stats = self.tool_stats[tool_name]
        stats["total_calls"] += 1

        if success:
            stats["successful_calls"] += 1
        else:
            stats["failed_calls"] += 1

        stats["total_score"] += score
        stats["avg_score"] = stats["total_score"] / stats["total_calls"]

    async def _trigger_reflection(self, result: ToolResult, score: float) -> None:
        """
        Trigger reflection loop for poor tool performance.

        This marks the execution for future analysis by the Darwin agent
        for self-improvement.

        Args:
            result: Tool execution result
            score: Quality score
        """
        logger.warning(
            f"ToolRM: Low score ({score:.2f}) for {result.agent_name} → {result.tool_name}. "
            f"Marking for reflection..."
        )

        # Create reflection marker file
        reflection_file = self.reasoning_bank_dir / "reflection_queue.jsonl"
        reflection_record = {
            "timestamp": result.timestamp.isoformat(),
            "agent": result.agent_name,
            "tool": result.tool_name,
            "score": score,
            "execution_time_ms": result.execution_time_ms,
            "error": result.error,
            "reason": f"Score {score:.2f} below acceptable threshold {self.quality_thresholds['acceptable']}",
        }

        try:
            with open(reflection_file, "a") as f:
                f.write(json.dumps(reflection_record) + "\n")
            logger.info(f"ToolRM: Reflection queued for {result.agent_name} → {result.tool_name}")
        except Exception as e:
            logger.error(f"Failed to queue reflection: {e}")

    def get_tool_statistics(self, tool_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get tool quality statistics.

        Args:
            tool_name: Optional tool name to filter (None = all tools)

        Returns:
            Statistics dict
        """
        if tool_name:
            return self.tool_stats.get(tool_name, {})

        return {
            "total_tools": len(self.tool_stats),
            "tool_stats": self.tool_stats,
        }

    def get_recent_executions(
        self, limit: int = 100, agent_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent execution records.

        Args:
            limit: Maximum number of records to return
            agent_name: Optional agent name to filter

        Returns:
            List of execution records
        """
        if agent_name:
            filtered = [
                record
                for record in self.execution_history
                if record["agent"] == agent_name
            ]
            return filtered[-limit:]

        return self.execution_history[-limit:]

    def get_reflection_queue(self) -> List[Dict[str, Any]]:
        """
        Get pending reflection tasks.

        Returns:
            List of reflection records
        """
        reflection_file = self.reasoning_bank_dir / "reflection_queue.jsonl"

        if not reflection_file.exists():
            return []

        records = []
        try:
            with open(reflection_file, "r") as f:
                for line in f:
                    records.append(json.loads(line.strip()))
        except Exception as e:
            logger.error(f"Failed to read reflection queue: {e}")

        return records

    def clear_reflection_queue(self) -> None:
        """Clear the reflection queue."""
        reflection_file = self.reasoning_bank_dir / "reflection_queue.jsonl"

        if reflection_file.exists():
            reflection_file.unlink()
            logger.info("ToolRM: Reflection queue cleared")

    def reset_statistics(self) -> None:
        """Reset all statistics."""
        self.execution_history.clear()
        self.tool_stats.clear()
        logger.info("ToolRM: Statistics reset")

    # =========================================================================
    # ORCHESTRATION INTEGRATION METHODS
    # =========================================================================

    def _register_with_halo(self) -> None:
        """
        Auto-register ToolRM middleware with HALO router.

        This enables HALO to use quality scores for agent routing decisions.
        """
        if not hasattr(self.halo_router, "middleware_registry"):
            logger.warning(
                "HALO router doesn't support middleware_registry. "
                "Quality scoring will not affect routing."
            )
            return

        # Register this middleware instance
        self.halo_router.middleware_registry.setdefault("toolrm", []).append(self)
        logger.info("ToolRMMiddleware registered with HALO router")

    def validate_with_aop(self, task: Task, agent_name: str) -> Dict[str, Any]:
        """
        Validate task assignment using quality score history.

        Checks:
        - Solvability: Agent has good track record with required tools
        - Completeness: Agent consistently produces complete results
        - Non-redundancy: Avoid assigning to agents with poor quality history

        Args:
            task: Task to validate
            agent_name: Agent assigned to task

        Returns:
            Validation result dict with {valid: bool, reason: str, score: float}
        """
        if not self.aop_validator:
            return {"valid": True, "reason": "No AOP validator configured", "score": 1.0}

        # Get agent's historical performance
        agent_executions = [
            rec for rec in self.execution_history if rec["agent"] == agent_name
        ]

        if not agent_executions:
            # No history = neutral score
            return {
                "valid": True,
                "reason": f"No execution history for {agent_name}",
                "score": 0.5,
            }

        # Calculate average score
        total_score = sum(rec["score"] for rec in agent_executions)
        avg_score = total_score / len(agent_executions)

        # Check if average score is acceptable
        if avg_score < self.quality_thresholds["acceptable"]:
            return {
                "valid": False,
                "reason": f"Agent {agent_name} has poor quality history (avg={avg_score:.2f})",
                "score": avg_score,
            }

        return {
            "valid": True,
            "reason": f"Agent {agent_name} has good quality history (avg={avg_score:.2f})",
            "score": avg_score,
        }

    def provide_routing_feedback(
        self, agent_name: str, tool_name: str, score: float, quality_level: str
    ) -> None:
        """
        Provide quality-based feedback to HALO router.

        This enables HALO to learn from tool execution quality and adjust
        future routing decisions.

        Args:
            agent_name: Agent that executed the tool
            tool_name: Tool that was executed
            score: Quality score (0.0 to 1.0)
            quality_level: Quality level string
        """
        if not self.halo_router:
            return

        feedback = {
            "agent": agent_name,
            "tool": tool_name,
            "score": score,
            "quality_level": quality_level,
            "middleware": "toolrm",
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        }

        if hasattr(self.halo_router, "record_feedback"):
            self.halo_router.record_feedback(feedback)
            logger.debug(
                f"ToolRM feedback sent to HALO: {agent_name} → {tool_name} = {score:.2f} ({quality_level})"
            )
        else:
            logger.warning("HALO router doesn't support record_feedback yet")

    def get_htdag_integration_metadata(self) -> Dict[str, Any]:
        """
        Get metadata for HTDAG task decomposition integration.

        Returns:
            Metadata dict with quality statistics for task planning
        """
        # Calculate aggregate statistics
        total_executions = len(self.execution_history)
        if total_executions > 0:
            avg_score = sum(rec["score"] for rec in self.execution_history) / total_executions
            success_rate = sum(
                1 for rec in self.execution_history if rec["success"]
            ) / total_executions
        else:
            avg_score = 0.0
            success_rate = 0.0

        return {
            "middleware": "toolrm",
            "total_executions": total_executions,
            "avg_quality_score": avg_score,
            "success_rate": success_rate,
            "tool_stats": self.tool_stats,
            "quality_thresholds": self.quality_thresholds,
        }

    def suggest_agent_for_task(self, task: Task) -> Optional[str]:
        """
        Suggest best agent for task based on quality score history.

        Args:
            task: Task to find agent for

        Returns:
            Agent name or None if no data
        """
        task_tools = getattr(task, "required_tools", [])
        if not task_tools:
            return None

        # Calculate agent scores based on tool quality history
        agent_scores = {}
        for agent_name in set(rec["agent"] for rec in self.execution_history):
            # Filter executions for this agent and required tools
            relevant_executions = [
                rec
                for rec in self.execution_history
                if rec["agent"] == agent_name and rec["tool"] in task_tools
            ]

            if not relevant_executions:
                continue

            # Calculate average score for relevant tools
            avg_score = sum(rec["score"] for rec in relevant_executions) / len(
                relevant_executions
            )
            agent_scores[agent_name] = avg_score

        if not agent_scores:
            return None

        # Return agent with highest quality score
        best_agent = max(agent_scores.items(), key=lambda x: x[1])[0]
        logger.info(
            f"Quality-based suggestion: {best_agent} for task with tools {task_tools} "
            f"(score={agent_scores[best_agent]:.2f})"
        )
        return best_agent

    async def integrate_with_htdag(self, dag: TaskDAG) -> None:
        """
        Integrate quality scores into HTDAG task decomposition.

        This adds quality metadata to tasks for better routing decisions.

        Args:
            dag: Task DAG to annotate
        """
        for task in dag.nodes:
            task_tools = getattr(task, "required_tools", [])
            if not task_tools:
                continue

            # Find tool quality statistics
            tool_quality = {}
            for tool in task_tools:
                if tool in self.tool_stats:
                    tool_quality[tool] = {
                        "avg_score": self.tool_stats[tool]["avg_score"],
                        "success_rate": (
                            self.tool_stats[tool]["successful_calls"]
                            / self.tool_stats[tool]["total_calls"]
                        ),
                    }

            # Add metadata to task
            if not hasattr(task, "metadata"):
                task.metadata = {}
            task.metadata["tool_quality"] = tool_quality

        logger.info(f"ToolRM metadata added to {len(dag.nodes)} tasks in DAG")
