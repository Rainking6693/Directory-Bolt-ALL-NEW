"""
A2A Connector - Integration Layer for Triple-Layer Orchestration

Connects HTDAG/HALO/AOP orchestration to the A2A service for actual agent execution.

Key Features:
- HTTP client for A2A service communication
- Agent name mapping (HALO router -> A2A agents)
- Task -> Tool argument translation
- Dependency-aware execution (respects DAG topological order)
- Circuit breaker pattern for service resilience
- OTEL tracing integration
- Feature flag support for progressive rollout
- Graceful error handling with fallback

Integration Flow:
  User Request
      ↓
  [HTDAG] Decompose into DAG
      ↓
  [HALO] Route tasks to agents
      ↓
  [AOP] Validate plan
      ↓
  [DAAO] Optimize costs
      ↓
  [A2A CONNECTOR] ← THIS COMPONENT
      ↓
  [A2A Service] Execute on agents
      ↓
  [Results] Return to orchestrator

Author: Alex (Full-Stack Integration Specialist)
Date: 2025-10-19
Version: 1.0.0
"""

import asyncio
import logging
import time
import os
import re
import json
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict, deque

import aiohttp
from opentelemetry import trace
from pydantic import BaseModel, ValidationError, Field

from infrastructure.task_dag import TaskDAG, Task, TaskStatus
from infrastructure.halo_router import RoutingPlan
from infrastructure.error_handler import (
    CircuitBreaker,
    ErrorContext,
    ErrorCategory,
    ErrorSeverity,
    log_error_with_context,
    handle_orchestration_error
)
from infrastructure.observability import (
    CorrelationContext,
    MetricSnapshot
)
from infrastructure.feature_flags import is_feature_enabled
from infrastructure.security_utils import (
    sanitize_agent_name,
    sanitize_for_prompt,
    redact_credentials
)
from infrastructure.agent_auth_registry import AgentAuthRegistry, SecurityError
from infrastructure.toon_encoder import toon_or_json, decode_from_toon, calculate_token_reduction
from infrastructure.auditor import ContinuousAuditor

try:
    from infrastructure.memory.a2a_memori_bridge import build_bridge_if_enabled
except Exception:  # pragma: no cover - optional dependency
    build_bridge_if_enabled = lambda: None  # type: ignore

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# HALO Agent Name -> A2A Agent Mapping
# Based on docs/A2A_ORCHESTRATION_INTEGRATION.md lines 299-340
HALO_TO_A2A_MAPPING = {
    "spec_agent": "spec",
    "architect_agent": "spec",
    "builder_agent": "builder",
    "frontend_agent": "builder",
    "backend_agent": "builder",
    "qa_agent": "qa",
    "security_agent": "security",
    "deploy_agent": "deploy",
    "monitoring_agent": "maintenance",
    "marketing_agent": "marketing",
    "sales_agent": "marketing",
    "support_agent": "support",
    "analytics_agent": "analyst",
    "research_agent": "analyst",
    "finance_agent": "billing"
}


# Task Type -> A2A Tool Mapping
# Infers which tool to call based on task type
TASK_TYPE_TO_TOOL_MAPPING = {
    # Design & Planning
    "design": "research_market",
    "requirements": "research_market",
    "architecture": "design_architecture",
    "planning": "research_market",

    # Implementation
    "implement": "generate_backend",
    "code": "generate_backend",
    "build": "generate_backend",
    "frontend": "generate_frontend",
    "backend": "generate_backend",
    "api": "generate_backend",
    "database": "generate_database",

    # Testing
    "test": "run_tests",
    "qa": "run_tests",
    "validation": "run_tests",
    "test_run": "run_tests",

    # Security
    "security": "audit_code",
    "vulnerability_scan": "audit_code",

    # Deployment
    "deploy": "deploy_to_vercel",
    "infrastructure": "setup_ci_cd",
    "devops": "setup_ci_cd",

    # Marketing
    "marketing": "create_strategy",
    "promotion": "generate_social_content",
    "content": "write_blog_post",

    # Support
    "support": "create_kb_article",
    "customer_service": "create_kb_article",

    # Analytics
    "analytics": "track_metrics",
    "reporting": "track_metrics",

    # Finance
    "finance": "setup_billing",
    "accounting": "setup_billing",

    # Generic/Atomic
    "generic": "generate_backend",
    "api_call": "generate_backend",
    "file_write": "generate_backend"
}


class A2AResponse(BaseModel):
    """A2A service response schema for validation"""
    result: Any
    status: str = Field(default="success", pattern="^(success|failed|partial)$")
    error: Optional[str] = None
    execution_time_ms: Optional[float] = None


@dataclass
class A2AExecutionResult:
    """Result of A2A task execution"""
    task_id: str
    agent_name: str
    tool_name: str
    status: str  # success, failed, skipped
    result: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    timestamp: float = field(default_factory=time.time)


@dataclass
class A2ATaskRequest:
    """A2A task request (for FastAPI compatibility)"""
    agent: str
    task: str
    tool: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


@dataclass
class A2ATaskResponse:
    """A2A task response (for FastAPI compatibility)"""
    task_id: str
    status: str
    result: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0


class A2AError(Exception):
    """A2A execution error"""
    pass


class A2AConnector:
    """
    Connector between orchestration layer and A2A service

    Responsibilities:
    1. Translate HALO routing plan to A2A tool invocations
    2. Execute tasks in dependency-aware order (DAG topological sort)
    3. Handle errors with circuit breaker + graceful degradation
    4. Track execution metrics with OTEL
    5. Support feature flag toggling for progressive rollout
    """

    # Rate limiting constants
    MAX_REQUESTS_PER_MINUTE = 100
    MAX_REQUESTS_PER_AGENT_PER_MINUTE = 20

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        circuit_breaker: Optional[CircuitBreaker] = None,
        api_key: Optional[str] = None,
        verify_ssl: bool = True,
        auth_registry: Optional[AgentAuthRegistry] = None,
        enable_toon: bool = True
    ):
        """
        Initialize A2A connector with security features and TOON support

        Args:
            base_url: A2A service base URL (defaults to HTTPS in production)
            timeout_seconds: HTTP request timeout
            circuit_breaker: Optional circuit breaker (creates default if None)
            api_key: API key for A2A service authentication
            verify_ssl: Whether to verify SSL certificates
            auth_registry: Optional agent authentication registry for authorization
            enable_toon: Enable TOON encoding for efficient data transfer (default: True)
        """
        # MEDIUM PRIORITY FIX: Remove A2A_ALLOW_HTTP override or restrict to localhost
        allow_http = os.getenv("A2A_ALLOW_HTTP", "false").lower() == "true"
        is_localhost = False

        # Determine base URL with HTTPS enforcement
        if base_url is None:
            if os.getenv("ENVIRONMENT") == "production":
                base_url = "https://127.0.0.1:8443"
            elif allow_http:
                # MEDIUM PRIORITY FIX: Restrict HTTP to localhost only
                base_url = "http://127.0.0.1:8080"
                is_localhost = True
            else:
                # Default to HTTPS even in development (secure by default)
                base_url = "https://127.0.0.1:8443"

        # MEDIUM PRIORITY FIX: Validate HTTPS in production (strict enforcement)
        if os.getenv("ENVIRONMENT") == "production" and not base_url.startswith("https://"):
            raise ValueError("HTTPS required in production environment. A2A_ALLOW_HTTP is ignored in production.")

        # MEDIUM PRIORITY FIX: Restrict HTTP to localhost only
        if not base_url.startswith("https://"):
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            hostname = parsed.hostname or ""
            
            # Only allow HTTP for localhost/127.0.0.1
            if hostname not in ["localhost", "127.0.0.1", "0.0.0.0", "::1"]:
                raise ValueError(
                    f"HTTP is only allowed for localhost. "
                    f"Hostname '{hostname}' requires HTTPS. "
                    f"Set A2A_ALLOW_HTTP=true only for local development."
                )

        # SECURITY: Validate HTTPS in CI/sandbox (unless explicitly allowed for localhost)
        if not base_url.startswith("https://") and not is_localhost:
            # In CI or staging, require HTTPS unless A2A_ALLOW_HTTP=true AND localhost
            if os.getenv("CI") == "true" or os.getenv("ENVIRONMENT") in ["staging", "ci"]:
                raise ValueError(
                    "HTTPS required in CI/staging environment. "
                    "Set A2A_ALLOW_HTTP=true for localhost only in local development."
                )
            else:
                # In local development, warn but allow (if localhost)
                logger.warning(
                    f"Using HTTP in {os.getenv('ENVIRONMENT', 'development')} environment - "
                    f"this is insecure! Set A2A_ALLOW_HTTP=true only for localhost."
                )

        self.base_url = base_url.rstrip('/')
        self.verify_ssl = verify_ssl

        # SECURITY: API key authentication
        self.api_key = api_key or os.getenv("A2A_API_KEY")
        if not self.api_key:
            logger.warning("A2A_API_KEY not set - authentication disabled (development only)")

        # SECURITY: Agent authentication registry
        self.auth_registry = auth_registry
        if self.auth_registry:
            # Register orchestrator as agent
            self.orchestrator_id, self.orchestrator_token = auth_registry.register_agent(
                agent_name="genesis_orchestrator",
                permissions=["invoke:*", "read:*"]
            )
            logger.info(f"Orchestrator registered with auth registry: {self.orchestrator_id[:8]}...")
        else:
            self.orchestrator_id = None
            self.orchestrator_token = None

        # Circuit breaker (5 failures -> 60s timeout)
        self.circuit_breaker = circuit_breaker or CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=2
        )

        # SECURITY: Rate limiting state
        self.request_timestamps: List[datetime] = []
        self.agent_request_timestamps: Dict[str, List[datetime]] = defaultdict(list)

        # HTTP session (will be created lazily)
        self._session: Optional[aiohttp.ClientSession] = None

        # Timeout configuration
        self.timeout = aiohttp.ClientTimeout(
            total=timeout_seconds,      # Max total time
            connect=5.0,                 # Max connection time
            sock_read=10.0,              # Max socket read time
            sock_connect=5.0             # Max socket connect time
        )

        # Execution tracking
        self.execution_history: List[A2AExecutionResult] = []
        self._last_asyncthink_stats: Dict[str, Any] = {}

        # TOON encoding feature flag
        self.enable_toon = enable_toon and os.getenv("A2A_ENABLE_TOON", "true").lower() == "true"

        # TOON metrics
        self.toon_stats = {
            "requests_sent": 0,
            "toon_encoded": 0,
            "json_encoded": 0,
            "total_token_reduction": 0.0
        }

        self.memory_bridge = build_bridge_if_enabled()
        if self.memory_bridge:
            logger.info("A2A Memory Bridge enabled (Memori backend)")

        logger.info(
            f"A2AConnector initialized (base_url={base_url}, timeout={timeout_seconds}s, "
            f"auth={'enabled' if self.api_key else 'disabled'}, toon={'enabled' if self.enable_toon else 'disabled'})"
        )

        # AsyncThink (fork/join) concurrency controls
        self.enable_asyncthink = os.getenv("ENABLE_ASYNCTHINK", "true").lower() == "true"
        self.asyncthink_max_concurrency = max(1, int(os.getenv("ASYNCTHINK_MAX_CONCURRENCY", "4")))
        if self.enable_asyncthink:
            logger.info(
                "AsyncThink concurrency enabled "
                f"(max_concurrency={self.asyncthink_max_concurrency})"
            )
        try:
            self.continuous_auditor = ContinuousAuditor()
        except Exception as exc:
            logger.warning(f"Continuous auditor unavailable: {exc}")
            self.continuous_auditor = None

    async def __aenter__(self):
        """Context manager entry - create HTTP session"""
        import ssl
        ssl_context = None
        if self.verify_ssl:
            ssl_context = ssl.create_default_context()

        self._session = aiohttp.ClientSession(
            timeout=self.timeout,
            connector=aiohttp.TCPConnector(
                limit=100,              # Max connections
                limit_per_host=30,      # Max per host
                ssl=ssl_context,
                enable_cleanup_closed=True
            )
        )
        logger.debug("HTTP session created with connection pooling")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.debug("HTTP session closed")
        return False

    async def _ensure_session(self):
        """Ensure HTTP session exists (lazy initialization)"""
        # Check if session needs to be created/recreated
        needs_session = (
            self._session is None or
            (hasattr(self._session, 'closed') and
             isinstance(self._session.closed, bool) and
             self._session.closed)
        )

        if needs_session:
            import ssl
            ssl_context = None
            if self.verify_ssl:
                ssl_context = ssl.create_default_context()

            self._session = aiohttp.ClientSession(
                timeout=self.timeout,
                connector=aiohttp.TCPConnector(
                    limit=100,
                    limit_per_host=30,
                    ssl=ssl_context,
                    enable_cleanup_closed=True
                )
            )
            logger.debug("HTTP session created (lazy initialization)")

    def _check_rate_limit(self, agent_name: str) -> bool:
        """
        Check if request is within rate limits

        Args:
            agent_name: Agent name to check limits for

        Returns:
            True if within limits, False if rate limit exceeded
        """
        now = datetime.now()
        one_minute_ago = now - timedelta(minutes=1)

        # Global rate limit
        self.request_timestamps = [
            ts for ts in self.request_timestamps if ts > one_minute_ago
        ]
        if len(self.request_timestamps) >= self.MAX_REQUESTS_PER_MINUTE:
            logger.warning(f"Global rate limit exceeded: {len(self.request_timestamps)}/min")
            return False

        # Per-agent rate limit
        self.agent_request_timestamps[agent_name] = [
            ts for ts in self.agent_request_timestamps[agent_name]
            if ts > one_minute_ago
        ]
        if len(self.agent_request_timestamps[agent_name]) >= self.MAX_REQUESTS_PER_AGENT_PER_MINUTE:
            logger.warning(
                f"Agent rate limit exceeded for '{agent_name}': "
                f"{len(self.agent_request_timestamps[agent_name])}/min"
            )
            return False

        return True

    def _record_request(self, agent_name: str):
        """Record request for rate limiting"""
        now = datetime.now()
        self.request_timestamps.append(now)
        self.agent_request_timestamps[agent_name].append(now)

    async def execute_routing_plan(
        self,
        routing_plan: RoutingPlan,
        dag: TaskDAG,
        correlation_context: Optional[CorrelationContext] = None
    ) -> Dict[str, Any]:
        """
        Execute all tasks in routing plan via A2A protocol

        Algorithm:
        1. Get topological order from DAG (respects dependencies)
        2. For each task in order:
           a. Map HALO agent -> A2A agent
           b. Map task type -> A2A tool
           c. Invoke A2A service
           d. Store result for dependent tasks
        3. Return aggregated results

        Args:
            routing_plan: HALO routing assignments
            dag: HTDAG task DAG with dependencies
            correlation_context: Optional correlation context for tracing

        Returns:
            Dictionary with execution results and summary

        Raises:
            Exception: If critical errors occur (unless gracefully degraded)
        """
        ctx = correlation_context or CorrelationContext()

        with tracer.start_as_current_span("a2a.execute_routing_plan") as span:
            span.set_attribute("correlation_id", ctx.correlation_id)
            span.set_attribute("task_count", len(routing_plan.assignments))
            span.set_attribute("agent_count", len(set(routing_plan.assignments.values())))

            start_time = time.time()
            results = {}
            errors = []

            # Get execution order (topological sort)
            try:
                execution_order = dag.topological_sort()
            except Exception as e:
                error_ctx = ErrorContext(
                    error_category=ErrorCategory.DECOMPOSITION,
                    error_severity=ErrorSeverity.FATAL,
                    error_message=f"DAG topological sort failed: {str(e)}",
                    component="a2a_connector",
                    metadata={"dag_size": len(dag)}
                )
                log_error_with_context(error_ctx)

                return {
                    "status": "failed",
                    "error": "DAG has cycles or invalid structure",
                    "results": {},
                    "execution_time_ms": (time.time() - start_time) * 1000
                }

            logger.info(
                f"Executing {len(execution_order)} tasks "
                f"({'concurrent' if self.enable_asyncthink else 'sequential'})"
            )

            summary = await self._execute_tasks_with_strategy(
                execution_order=execution_order,
                routing_plan=routing_plan,
                dag=dag,
                results=results,
                errors=errors,
                correlation_context=ctx,
                span=span,
                start_time=start_time
            )

            return summary

    async def _execute_tasks_with_strategy(
        self,
        execution_order: List[str],
        routing_plan: RoutingPlan,
        dag: TaskDAG,
        results: Dict[str, A2AExecutionResult],
        errors: List[Dict[str, str]],
        correlation_context: CorrelationContext,
        span,
        start_time: float
    ) -> Dict[str, Any]:
        """Dispatch to sequential or AsyncThink execution."""
        if self.enable_asyncthink and len(execution_order) > 1:
            return await self._execute_tasks_asyncthink(
                execution_order,
                routing_plan,
                dag,
                results,
                errors,
                correlation_context,
                span,
                start_time
            )

        return await self._execute_tasks_sequential(
            execution_order,
            routing_plan,
            dag,
            results,
            errors,
            correlation_context,
            span,
            start_time
        )

    async def _execute_tasks_sequential(
        self,
        execution_order: List[str],
        routing_plan: RoutingPlan,
        dag: TaskDAG,
        results: Dict[str, A2AExecutionResult],
        errors: List[Dict[str, str]],
        correlation_context: CorrelationContext,
        span,
        start_time: float
    ) -> Dict[str, Any]:
        """Original sequential execution path."""
        for task_id in execution_order:
            await self._run_task(
                task_id=task_id,
                dag=dag,
                routing_plan=routing_plan,
                results=results,
                errors=errors,
                correlation_context=correlation_context
            )

        return self._build_summary(
            results=results,
            errors=errors,
            start_time=start_time,
            span=span,
            extra_attrs={
                "asyncthink_enabled": False,
                "asyncthink_max_parallel": 1
            }
        )

    async def _execute_tasks_asyncthink(
        self,
        execution_order: List[str],
        routing_plan: RoutingPlan,
        dag: TaskDAG,
        results: Dict[str, A2AExecutionResult],
        errors: List[Dict[str, str]],
        correlation_context: CorrelationContext,
        span,
        start_time: float
    ) -> Dict[str, Any]:
        """AsyncThink-style fork/join execution."""
        assigned_order = [tid for tid in execution_order if tid in routing_plan.assignments]
        if not assigned_order:
            logger.warning("AsyncThink enabled but routing plan is empty")
            return self._build_summary(
                results,
                errors,
                start_time,
                span,
                extra_attrs={"asyncthink_enabled": True, "asyncthink_max_parallel": 0}
            )

        assigned_set = set(assigned_order)
        dependency_counts: Dict[str, int] = {}
        for tid in assigned_order:
            task = dag.tasks.get(tid)
            if not task:
                dependency_counts[tid] = 0
                continue
            unmet = 0
            for dep in task.dependencies:
                if dep in assigned_set:
                    parent_task = dag.tasks.get(dep)
                    if parent_task and parent_task.status != TaskStatus.COMPLETED:
                        unmet += 1
            dependency_counts[tid] = unmet

        ready = deque([tid for tid, count in dependency_counts.items() if count == 0])
        if not ready:
            logger.warning("No ready tasks detected for AsyncThink, falling back to sequential execution")
            return await self._execute_tasks_sequential(
                execution_order,
                routing_plan,
                dag,
                results,
                errors,
                correlation_context,
                span,
                start_time
            )

        queue: asyncio.Queue = asyncio.Queue()
        scheduled: set[str] = set()
        for tid in ready:
            queue.put_nowait(tid)
            scheduled.add(tid)

        worker_count = min(self.asyncthink_max_concurrency, max(1, len(ready)))
        counter_lock = asyncio.Lock()
        active_workers = 0
        max_parallel = 0

        def _schedule_child(child_id: str):
            if child_id not in dependency_counts:
                return
            dependency_counts[child_id] = max(0, dependency_counts[child_id] - 1)
            if dependency_counts[child_id] == 0 and child_id not in scheduled:
                scheduled.add(child_id)
                queue.put_nowait(child_id)

        async def worker(worker_id: int):
            nonlocal active_workers, max_parallel
            while True:
                task_id = await queue.get()
                if task_id is None:
                    queue.task_done()
                    break

                task = dag.tasks.get(task_id)
                if not task:
                    logger.warning(f"Task {task_id} missing from DAG, skipping")
                    if dag.graph.has_node(task_id):
                        for child in dag.get_children(task_id):
                            _schedule_child(child)
                    queue.task_done()
                    continue

                async with counter_lock:
                    active_workers += 1
                    max_parallel = max(max_parallel, active_workers)
                try:
                    await self._run_task(
                        task_id=task_id,
                        dag=dag,
                        routing_plan=routing_plan,
                        results=results,
                        errors=errors,
                        correlation_context=correlation_context
                    )
                finally:
                    children = dag.get_children(task_id)
                    for child in children:
                        _schedule_child(child)
                    async with counter_lock:
                        active_workers -= 1
                    queue.task_done()

        workers = [asyncio.create_task(worker(i)) for i in range(worker_count)]
        await queue.join()
        for _ in workers:
            queue.put_nowait(None)
        await asyncio.gather(*workers)

        summary = self._build_summary(
            results,
            errors,
            start_time,
            span,
            extra_attrs={
                "asyncthink_enabled": True,
                "asyncthink_max_parallel": max_parallel,
                "asyncthink_workers": worker_count
            }
        )
        self._record_asyncthink_metrics(summary, max_parallel, worker_count)
        return summary

    async def _run_task(
        self,
        task_id: str,
        dag: TaskDAG,
        routing_plan: RoutingPlan,
        results: Dict[str, A2AExecutionResult],
        errors: List[Dict[str, str]],
        correlation_context: CorrelationContext
    ) -> Optional[A2AExecutionResult]:
        """Execute a single task (shared by sequential + AsyncThink paths)."""
        if task_id not in routing_plan.assignments:
            logger.debug(f"Task {task_id} not in routing plan, skipping")
            return None

        task = dag.tasks.get(task_id)
        if not task:
            logger.warning(f"Task {task_id} missing from DAG, skipping")
            return None

        if task.status == TaskStatus.COMPLETED:
            logger.debug(f"Task {task_id} already completed, skipping execution")
            return None

        agent_name = routing_plan.assignments[task_id]

        with tracer.start_as_current_span(f"a2a.task.{task_id}") as task_span:
            task_span.set_attribute("task_id", task_id)
            task_span.set_attribute("agent", agent_name)
            task_span.set_attribute("task_type", task.task_type)

            try:
                dependency_results = self._get_dependency_results(task, results)
                result = await self._execute_single_task(
                    task=task,
                    agent_name=agent_name,
                    dependency_results=dependency_results,
                    correlation_context=correlation_context
                )
                results[task_id] = result

                if result.status == "success":
                    task_span.set_attribute("status", "success")
                    dag.mark_complete(task_id)
                    self._audit_agent_output(agent_name, result.result)
                else:
                    task_span.set_attribute("status", "failed")
                    task_span.set_attribute("error", result.error or "Unknown error")
                    errors.append({"task_id": task_id, "error": result.error})

                return result

            except Exception as e:
                handle_orchestration_error(
                    e,
                    component="a2a_connector",
                    context={"task_id": task_id, "agent": agent_name}
                )
                task_span.set_attribute("status", "error")
                task_span.set_attribute("error", str(e))

                errors.append({"task_id": task_id, "error": str(e)})

                failed_result = A2AExecutionResult(
                    task_id=task_id,
                    agent_name=agent_name,
                    tool_name="unknown",
                    status="failed",
                    error=str(e)
                )
                results[task_id] = failed_result
                logger.warning(f"Task {task_id} failed, continuing with remaining tasks")
                return failed_result

    def _build_summary(
        self,
        results: Dict[str, A2AExecutionResult],
        errors: List[Dict[str, str]],
        start_time: float,
        span,
        extra_attrs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create summary payload + span attributes."""
        total_time = (time.time() - start_time) * 1000
        successful = sum(1 for r in results.values() if r.status == "success")
        failed = sum(1 for r in results.values() if r.status == "failed")

        if span:
            span.set_attribute("successful_tasks", successful)
            span.set_attribute("failed_tasks", failed)
            span.set_attribute("execution_time_ms", total_time)
            if extra_attrs:
                for key, value in extra_attrs.items():
                    span.set_attribute(key, value)

        logger.info(
            f"Execution complete: {successful}/{len(results)} tasks successful "
            f"in {total_time:.2f}ms"
        )

        return {
            "status": "completed" if failed == 0 else "partial",
            "total_tasks": len(results),
            "successful": successful,
            "failed": failed,
            "execution_time_ms": total_time,
            "results": {tid: r.result for tid, r in results.items() if r.status == "success"},
            "errors": errors if errors else None
        }

    def _record_asyncthink_metrics(
        self,
        summary: Dict[str, Any],
        max_parallel: int,
        worker_count: int
    ) -> None:
        """Emit structured metrics for AsyncThink concurrency performance."""
        total_tasks = summary.get("total_tasks", 0)
        successful = summary.get("successful", 0)
        latency_ms = float(summary.get("execution_time_ms", 0.0))
        success_rate = successful / total_tasks if total_tasks else 0.0

        self._last_asyncthink_stats = {
            "max_parallel": max_parallel,
            "workers": worker_count,
            "latency_ms": latency_ms,
            "success_rate": success_rate,
            "total_tasks": total_tasks
        }

        metrics = [
            MetricSnapshot(
                metric_name="asyncthink.max_parallel",
                value=float(max_parallel),
                unit="count",
                labels={"workers": str(worker_count)}
            ),
            MetricSnapshot(
                metric_name="asyncthink.latency_ms",
                value=latency_ms,
                unit="milliseconds",
                labels={"mode": "concurrent"}
            ),
            MetricSnapshot(
                metric_name="asyncthink.success_rate",
                value=success_rate,
                unit="ratio",
                labels={"total_tasks": str(total_tasks)}
            )
        ]

        for metric in metrics:
            logger.info(f"METRIC: {metric.to_json()}")

    async def _execute_single_task(
        self,
        task: Task,
        agent_name: str,
        dependency_results: Dict[str, Any],
        correlation_context: CorrelationContext
    ) -> A2AExecutionResult:
        """
        Execute single task via A2A service with security checks

        Args:
            task: Task to execute
            agent_name: HALO agent name
            dependency_results: Results from dependency tasks
            correlation_context: Correlation context for tracing

        Returns:
            A2AExecutionResult with execution status and result
        """
        start_time = time.time()

        # SECURITY: Check agent authorization
        if self.auth_registry:
            # Check if agent is registered
            if not self.auth_registry.is_registered(agent_name):
                raise SecurityError(f"Agent '{agent_name}' not registered in auth registry")

            # Check if orchestrator has permission
            permission = f"invoke:{agent_name}"
            if not self.auth_registry.has_permission(self.orchestrator_token, permission):
                raise SecurityError(
                    f"Orchestrator not authorized to invoke '{agent_name}' "
                    f"(missing permission: {permission})"
                )

        # Map HALO agent -> A2A agent
        a2a_agent = self._map_agent_name(agent_name)

        # Map task type -> A2A tool
        tool_name = self._map_task_to_tool(task)

        # Prepare arguments
        arguments = self._prepare_arguments(task, dependency_results)

        logger.info(f"Executing: {task.task_id} via {a2a_agent}.{tool_name}")

        # Invoke A2A service
        try:
            result = await self.invoke_agent_tool(
                agent_name=a2a_agent,
                tool_name=tool_name,
                arguments=arguments
            )

            execution_time = (time.time() - start_time) * 1000

            exec_result = A2AExecutionResult(
                task_id=task.task_id,
                agent_name=a2a_agent,
                tool_name=tool_name,
                status="success",
                result=result,
                execution_time_ms=execution_time
            )

            self.execution_history.append(exec_result)

            await self._record_memory_event(task, a2a_agent, tool_name, exec_result, arguments)
            return exec_result

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000

            exec_result = A2AExecutionResult(
                task_id=task.task_id,
                agent_name=a2a_agent,
                tool_name=tool_name,
                status="failed",
                error=str(e),
                execution_time_ms=execution_time
            )

            self.execution_history.append(exec_result)

            await self._record_memory_event(task, a2a_agent, tool_name, exec_result, arguments)
            return exec_result

    async def _record_memory_event(
        self,
        task: Task,
        agent_name: str,
        tool_name: str,
        exec_result: A2AExecutionResult,
        arguments: Dict[str, Any],
    ) -> None:
        if not self.memory_bridge:
            return

        payload = {
            "task": {
                "id": task.task_id,
                "description": task.description,
                "dependencies": task.depends_on,
            },
            "arguments": self._sanitize_arguments(arguments),
            "result": exec_result.result if exec_result.status == "success" else None,
            "error": exec_result.error,
            "execution_time_ms": exec_result.execution_time_ms,
        }
        try:
            await self.memory_bridge.record_execution(
                task_id=task.task_id,
                agent_name=agent_name,
                tool_name=tool_name,
                status=exec_result.status,
                payload=payload,
            )
        except Exception as exc:  # pragma: no cover - telemetry best effort
            logger.debug(f"Failed to store A2A memory event: {exc}")

    def _sanitize_arguments(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        sanitized: Dict[str, Any] = {}
        sensitive = {
            "api_key",
            "apikey",
            "password",
            "passwd",
            "token",
            "secret",
            "bearer",
        }

        for key, value in arguments.items():
            if key.lower() in sensitive:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str):
                sanitized[key] = redact_credentials(value)
            elif isinstance(value, dict):
                sanitized[key] = {
                    sub_key: ("[REDACTED]" if sub_key.lower() in sensitive else value[sub_key])
                    for sub_key in value
                }
            else:
                sanitized[key] = value
        return sanitized

    async def invoke_agent_tool(
        self,
        agent_name: str,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> Any:
        """
        Call A2A service endpoint to invoke agent tool with security

        POST https://127.0.0.1:8443/a2a/invoke
        {
            "tool": "agent_name.tool_name",
            "arguments": {...}
        }

        Args:
            agent_name: A2A agent name (e.g., "marketing", "builder")
            tool_name: Tool name (e.g., "create_strategy")
            arguments: Tool arguments

        Returns:
            Tool execution result

        Raises:
            Exception: If circuit breaker is open, rate limit exceeded, or HTTP request fails
        """
        # SECURITY: Rate limiting check
        if not self._check_rate_limit(agent_name):
            raise Exception(
                f"Rate limit exceeded for agent '{agent_name}' "
                f"(max {self.MAX_REQUESTS_PER_AGENT_PER_MINUTE} requests/minute)"
            )

        # Check circuit breaker
        if not self.circuit_breaker.can_attempt():
            raise Exception("Circuit breaker OPEN: A2A service unavailable")

        # SECURITY: Redact credentials for logging (not for actual request)
        safe_arguments_for_logging = {}
        SENSITIVE_KEYS = {'api_key', 'apikey', 'password', 'passwd', 'pwd', 'token',
                         'auth_token', 'access_token', 'secret', 'bearer'}

        for key, value in arguments.items():
            # Check if key itself is sensitive
            if key.lower() in SENSITIVE_KEYS:
                safe_arguments_for_logging[key] = "[REDACTED]"
            elif isinstance(value, str):
                safe_arguments_for_logging[key] = redact_credentials(value)
            elif isinstance(value, dict):
                safe_arguments_for_logging[key] = {
                    k: "[REDACTED]" if k.lower() in SENSITIVE_KEYS
                       else (redact_credentials(str(v)) if isinstance(v, str) else v)
                    for k, v in value.items()
                }
            else:
                safe_arguments_for_logging[key] = value

        # Log with redacted arguments
        logger.info(
            f"Invoking A2A: {agent_name}.{tool_name}",
            extra={
                "agent": agent_name,
                "tool": tool_name,
                "argument_count": len(arguments),
                "argument_keys": list(arguments.keys())[:5]  # First 5 keys only
                # DO NOT LOG: "arguments": arguments  # Contains credentials!
            }
        )

        url = f"{self.base_url}/a2a/invoke"
        payload = {
            "tool": f"{agent_name}.{tool_name}",
            "arguments": arguments  # Use original, unredacted arguments for actual request
        }

        # TOON: Attempt efficient encoding for arguments
        content_type = "application/json"
        payload_body = json.dumps(payload)

        if self.enable_toon:
            # Check if arguments contain tabular data suitable for TOON
            if isinstance(arguments, dict):
                for key, value in arguments.items():
                    if isinstance(value, list):
                        # Try TOON encoding for list values
                        toon_content_type, toon_encoded = toon_or_json(value)
                        if toon_content_type == "application/toon":
                            # Calculate token reduction
                            reduction = calculate_token_reduction(value)

                            # Use TOON for this field
                            arguments_with_toon = arguments.copy()
                            arguments_with_toon[key] = {"__toon__": toon_encoded}
                            payload["arguments"] = arguments_with_toon
                            payload_body = json.dumps(payload)

                            logger.debug(
                                f"TOON encoded field '{key}': {reduction:.1%} token reduction "
                                f"({len(json.dumps(value))} -> {len(toon_encoded)} chars)"
                            )

                            # Update metrics
                            self.toon_stats["toon_encoded"] += 1
                            self.toon_stats["total_token_reduction"] += reduction
                            break

        # SECURITY: Validate payload size (prevent DoS)
        if len(payload_body) > 100_000:  # 100KB limit
            raise ValueError(f"Payload too large: {len(payload_body)} bytes")

        self.toon_stats["requests_sent"] += 1
        if content_type == "application/json":
            self.toon_stats["json_encoded"] += 1

        # SECURITY: Add authentication headers
        headers = {
            "Content-Type": content_type,
            "Accept": "application/toon, application/json"  # Request TOON if available
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-Client-ID"] = "genesis-orchestrator"

        try:
            # Ensure session exists
            await self._ensure_session()

            # Use persistent session
            async with self._session.post(url, data=payload_body, headers=headers) as response:
                if response.status == 200:
                    response_content_type = response.headers.get("Content-Type", "application/json")

                    # Handle TOON-encoded responses
                    if "application/toon" in response_content_type:
                        response_text = await response.text()
                        # Decode TOON response
                        data = decode_from_toon(response_text)
                        logger.debug(f"Decoded TOON response: {len(response_text)} chars")
                    else:
                        data = await response.json()

                    # SECURITY: Validate response schema
                    try:
                        validated_response = A2AResponse(**data)
                        result = validated_response.result
                    except ValidationError as e:
                        raise ValueError(f"Invalid A2A response schema: {e}")

                    # Record success
                    self.circuit_breaker.record_success()
                    self._record_request(agent_name)

                    return result
                else:
                    error_text = await response.text()

                    # SECURITY: Redact credentials from error text
                    safe_error_text = redact_credentials(error_text)

                    # Truncate to prevent log flooding
                    if len(safe_error_text) > 500:
                        safe_error_text = safe_error_text[:500] + "... [truncated]"

                    raise Exception(
                        f"A2A service error (status={response.status}): {safe_error_text}"
                    )

        except asyncio.TimeoutError:
            # Record failure
            self.circuit_breaker.record_failure()
            raise Exception(f"A2A service timeout after {self.timeout.total}s")

        except Exception as e:
            # Record failure
            self.circuit_breaker.record_failure()

            error_ctx = ErrorContext(
                error_category=ErrorCategory.NETWORK,
                error_severity=ErrorSeverity.MEDIUM,
                error_message=f"A2A invocation failed: {str(e)}",
                component="a2a_connector",
                agent_name=agent_name,
                metadata={"tool": tool_name, "url": url}
            )
            log_error_with_context(error_ctx)

            raise

    def _map_agent_name(self, halo_agent_name: str) -> str:
        """
        Map HALO agent name to A2A agent name with security validation

        Args:
            halo_agent_name: HALO router agent name (e.g., "builder_agent")

        Returns:
            A2A agent name (e.g., "builder")

        Raises:
            ValueError: If agent name not found in mapping
            SecurityError: If agent name is invalid or not whitelisted
        """
        # SECURITY: Sanitize input first
        sanitized_halo_name = sanitize_agent_name(halo_agent_name)

        a2a_agent = HALO_TO_A2A_MAPPING.get(sanitized_halo_name)

        if not a2a_agent:
            # Fallback: strip "_agent" suffix if present
            if sanitized_halo_name.endswith("_agent"):
                a2a_agent = sanitized_halo_name[:-6]
            else:
                raise ValueError(f"Unknown HALO agent: {halo_agent_name}")

        # SECURITY: Validate output against whitelist
        ALLOWED_AGENTS = {
            "spec", "builder", "qa", "security", "deploy",
            "maintenance", "marketing", "support", "analyst", "billing"
        }

        if a2a_agent not in ALLOWED_AGENTS:
            raise SecurityError(f"Invalid A2A agent: {a2a_agent}")

        return a2a_agent

    def _map_task_to_tool(self, task: Task) -> str:
        """
        Map task type to A2A tool name with security validation

        Uses heuristics based on task type and metadata

        Args:
            task: Task to map

        Returns:
            A2A tool name

        Raises:
            SecurityError: If tool name contains dangerous patterns
        """
        # Check explicit tool hint in metadata
        if "a2a_tool" in task.metadata:
            tool_name = task.metadata["a2a_tool"]
            # SECURITY: Sanitize explicit tool name
            return self._sanitize_tool_name(tool_name)

        # Use task type mapping
        tool_name = TASK_TYPE_TO_TOOL_MAPPING.get(task.task_type)

        if not tool_name:
            # Fallback: generic tool
            logger.warning(
                f"No tool mapping for task type '{task.task_type}', "
                f"using generic 'generate_backend'"
            )
            tool_name = "generate_backend"

        return tool_name

    def _sanitize_tool_name(self, tool_name: str) -> str:
        """
        Sanitize tool name to prevent injection attacks

        Args:
            tool_name: Raw tool name (potentially user-controlled)

        Returns:
            Sanitized tool name safe for A2A invocation

        Raises:
            SecurityError: If tool name is invalid
        """
        # Remove path separators and special chars
        sanitized = re.sub(r'[/\\.]', '', tool_name)

        # Whitelist: alphanumeric, underscores only
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '', sanitized)

        # Limit length
        sanitized = sanitized[:64]

        # Validate against whitelist of known tools
        ALLOWED_TOOLS = set(TASK_TYPE_TO_TOOL_MAPPING.values())
        if sanitized not in ALLOWED_TOOLS:
            logger.warning(f"Tool name '{tool_name}' not in whitelist, using fallback")
            return "generate_backend"

        return sanitized

    def _prepare_arguments(
        self,
        task: Task,
        dependency_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Prepare tool arguments from task and dependency results with sanitization

        Args:
            task: Task to execute
            dependency_results: Results from dependency tasks

        Returns:
            Dictionary of tool arguments (sanitized)
        """
        # Start with empty arguments
        arguments = {}

        # SECURITY: Sanitize and add dependency results
        if dependency_results:
            sanitized_deps = {}
            for dep_id, result in dependency_results.items():
                if isinstance(result, dict):
                    sanitized_result = {
                        k: redact_credentials(str(v)) if isinstance(v, str) else v
                        for k, v in result.items()
                    }
                    sanitized_deps[dep_id] = sanitized_result
                else:
                    sanitized_deps[dep_id] = redact_credentials(str(result)) if isinstance(result, str) else result

            arguments["dependency_results"] = sanitized_deps

        # SECURITY: Sanitize task metadata
        if task.metadata:
            sanitized_metadata = {}
            for key, value in task.metadata.items():
                # Sanitize keys (prevent injection)
                safe_key = re.sub(r'[^a-zA-Z0-9_]', '', key)[:64]

                # Sanitize values
                if isinstance(value, str):
                    safe_value = sanitize_for_prompt(value, max_length=500)
                else:
                    safe_value = value

                sanitized_metadata[safe_key] = safe_value

            arguments["context"] = sanitized_metadata

        # SECURITY: Sanitize task description (prevent prompt injection)
        safe_description = sanitize_for_prompt(task.description, max_length=1000)
        arguments["description"] = safe_description

        # Add task_id for tracing
        arguments["task_id"] = task.task_id

        # SECURITY: Validate total payload size (prevent DoS)
        payload_json = json.dumps(arguments)
        if len(payload_json) > 100_000:  # 100KB limit
            raise ValueError(f"Argument payload too large: {len(payload_json)} bytes")

        return arguments

    def _get_dependency_results(
        self,
        task: Task,
        results: Dict[str, A2AExecutionResult]
    ) -> Dict[str, Any]:
        """
        Get results from dependency tasks

        Args:
            task: Task whose dependencies to retrieve
            results: All execution results so far

        Returns:
            Dictionary mapping dependency_id -> result
        """
        dependency_results = {}

        for dep_id in task.dependencies:
            if dep_id in results:
                exec_result = results[dep_id]
                if exec_result.status == "success":
                    dependency_results[dep_id] = exec_result.result
                else:
                    logger.warning(
                        f"Dependency {dep_id} failed for task {task.task_id}, "
                        f"passing error info"
                    )
                    dependency_results[dep_id] = {
                        "error": exec_result.error,
                        "status": "failed"
                    }

        return dependency_results

    def _audit_agent_output(self, agent_name: str, payload: Any) -> None:
        """Send agent output through the continuous auditor if enabled."""
        if not self.continuous_auditor:
            return
        try:
            self.continuous_auditor.evaluate(agent_name, payload)
        except Exception as exc:  # pragma: no cover - auditor optional
            logger.debug(f"Auditor evaluation failed for {agent_name}: {exc}")

    def get_execution_summary(self) -> Dict[str, Any]:
        """
        Get summary of execution history

        Returns:
            Dictionary with execution statistics
        """
        if not self.execution_history:
            return {
                "total_executions": 0,
                "successful": 0,
                "failed": 0,
                "average_execution_time_ms": 0.0,
                "agents_used": [],
                "tools_used": []
            }

        successful = sum(1 for r in self.execution_history if r.status == "success")
        failed = sum(1 for r in self.execution_history if r.status == "failed")
        avg_time = sum(r.execution_time_ms for r in self.execution_history) / len(self.execution_history)

        agents_used = list(set(r.agent_name for r in self.execution_history))
        tools_used = list(set(r.tool_name for r in self.execution_history))

        return {
            "total_executions": len(self.execution_history),
            "successful": successful,
            "failed": failed,
            "success_rate": successful / len(self.execution_history) if self.execution_history else 0.0,
            "average_execution_time_ms": avg_time,
            "agents_used": agents_used,
            "tools_used": tools_used
        }

    def reset_circuit_breaker(self):
        """Reset circuit breaker (for testing or manual recovery)"""
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=2
        )
        logger.info("Circuit breaker reset")

    def get_toon_statistics(self) -> Dict[str, Any]:
        """
        Get TOON encoding statistics

        Returns:
            Dictionary with TOON usage metrics:
            - requests_sent: Total A2A requests
            - toon_encoded: Requests using TOON encoding
            - json_encoded: Requests using JSON encoding
            - toon_usage_rate: % of requests using TOON
            - avg_token_reduction: Average token reduction for TOON requests
        """
        requests = self.toon_stats["requests_sent"]
        toon_count = self.toon_stats["toon_encoded"]

        return {
            "requests_sent": requests,
            "toon_encoded": toon_count,
            "json_encoded": self.toon_stats["json_encoded"],
            "toon_usage_rate": toon_count / requests if requests > 0 else 0.0,
            "avg_token_reduction": (
                self.toon_stats["total_token_reduction"] / toon_count
                if toon_count > 0 else 0.0
            )
        }
