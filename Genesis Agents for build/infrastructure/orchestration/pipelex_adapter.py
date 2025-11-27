"""
Pipelex Adapter for Genesis Orchestration
-----------------------------------------

This module provides an asynchronous adapter that lets Genesis invoke Pipelex
workflows while retaining graceful fallbacks when the full Pipelex runtime is
unavailable.  The implementation focuses on three core responsibilities:

1.  Workflow resolution and inspection (`load_workflow`)
2.  Genesis task → Pipelex variable mapping (`map_genesis_task_to_pipelex`)
3.  Workflow execution with fallback to direct agent execution (`execute_workflow`)

Compared to the initial stub, this version aligns with the expectations from
the latest integration tests (Pipelex E2E suite) and keeps backwards
compatibility with earlier adapters that accepted only `timeout_seconds`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Union

import tomllib

logger = logging.getLogger(__name__)

# Optional imports – we gracefully degrade when components are absent.
try:  # Pipelex runtime (not guaranteed to be installed in test envs)
    from pipelex.runtime.runner import Runner as PipeRunner  # type: ignore

    PIPELEX_AVAILABLE = True
except Exception:  # pragma: no cover - best effort import
    PipeRunner = None  # type: ignore
    PIPELEX_AVAILABLE = False
    logger.debug("Pipelex runtime not available; adapter will use fallback mode.")

try:  # HALO router + model registry
    from infrastructure.halo_router import HALORouter
    from infrastructure.model_registry import ModelRegistry
    from infrastructure.task_dag import Task as TaskDAGTask

    HALO_AVAILABLE = True
except Exception:  # pragma: no cover
    HALO_AVAILABLE = False
    HALORouter = ModelRegistry = TaskDAGTask = None  # type: ignore
    logger.debug("HALO router / ModelRegistry not available; routing will be stubbed.")

try:  # Observability (OTEL)
    from infrastructure.observability import (
        CorrelationContext,
        SpanType,
        get_observability_manager,
    )

    OTEL_AVAILABLE = True
except Exception:  # pragma: no cover
    OTEL_AVAILABLE = False
    CorrelationContext = SpanType = None  # type: ignore
    def get_observability_manager() -> None:  # type: ignore
        return None
    logger.debug("OTEL observability not available; metrics/tracing will be skipped.")

# Regex used to infer template variables from prompts.
VARIABLE_PATTERN = re.compile(r"{{\s*([^{}\s]+)\s*}}")

# Default workflow directory (overridable via env var or constructor argument).
DEFAULT_WORKFLOW_DIR = Path(
    os.getenv("PIPELEX_WORKFLOW_DIR", Path.cwd() / "workflows")
).resolve()


class PipelexAdapter:
    """
    Async adapter for Pipelex workflow execution in the Genesis orchestrator.

    Key features:
      • Workflow resolution + parsing (TOML → Python dict)
      • Genesis task metadata → Pipelex input variable mapping
      • Fallback execution path when Pipelex runtime is unavailable
      • Optional OTEL tracing and HALO routing integration
    """

    def __init__(
        self,
        workflow_dir: Optional[Path] = None,
        halo_router: Optional[HALORouter] = None,
        model_registry: Optional[ModelRegistry] = None,
        timeout: Optional[float] = None,
        timeout_seconds: Optional[int] = None,
    ):
        # Resolve workflow directory (allow callers to pass files directly as well).
        self.workflow_dir = Path(workflow_dir or DEFAULT_WORKFLOW_DIR).resolve()
        if not self.workflow_dir.exists():
            logger.warning(
                "PipelexAdapter workflow directory does not exist: %s", self.workflow_dir
            )

        # Timeout configuration (support legacy `timeout_seconds` parameter).
        if timeout is None and timeout_seconds is None:
            timeout = 300.0
        if timeout is None and timeout_seconds is not None:
            timeout = float(timeout_seconds)
        if timeout_seconds is None:
            timeout_seconds = int(round(timeout or 300.0))

        self.timeout: float = float(timeout or 300.0)
        self.timeout_seconds: int = int(timeout_seconds)

        # Optional dependencies (HALO + Model Registry).
        self.halo_router = halo_router
        if self.halo_router is None and HALO_AVAILABLE:
            try:
                self.halo_router = HALORouter()  # type: ignore[misc]
            except Exception as exc:  # pragma: no cover
                logger.debug("HALO router initialisation failed: %s", exc)
                self.halo_router = None

        self.model_registry = model_registry
        if self.model_registry is None and HALO_AVAILABLE:
            try:
                self.model_registry = ModelRegistry()  # type: ignore[misc]
            except Exception as exc:  # pragma: no cover
                logger.debug("Model registry initialisation failed: %s", exc)
                self.model_registry = None

        # Observability manager (optional).
        self.otel_manager = get_observability_manager() if OTEL_AVAILABLE else None
        if self.otel_manager:
            tracing_enabled = bool(
                getattr(
                    getattr(self.otel_manager, "config", None),
                    "sampling_ratio",
                    0.0,
                )
                > 0
            )
            setattr(self.otel_manager, "tracing_enabled", tracing_enabled)
            setattr(self.otel_manager, "metrics_enabled", True)
        else:
            # Provide a stub for environments without OTEL so tests can still introspect.
            self.otel_manager = SimpleNamespace(
                tracing_enabled=False,
                metrics_enabled=False,
                span=lambda *args, **kwargs: _NoopSpanContext(),
            )

        # Pipelex runner (if runtime is present).
        self.runner: Optional[PipeRunner] = None  # type: ignore[assignment]
        if PIPELEX_AVAILABLE:
            try:
                self.runner = PipeRunner()  # type: ignore[call-arg]
            except Exception as exc:  # pragma: no cover
                logger.debug("Pipelex runner initialisation failed: %s", exc)
                self.runner = None

        # Cache parsed workflows to avoid repeated IO.
        self._workflow_cache: Dict[Path, Dict[str, Any]] = {}

    # --------------------------------------------------------------------- #
    # Workflow helpers
    # --------------------------------------------------------------------- #

    def _resolve_workflow_path(self, workflow: Union[str, Path]) -> Path:
        """
        Resolve a workflow identifier to an on-disk path.

        The resolver understands both absolute paths and logical names like
        `saas_product.plx`, automatically expanding into the templates directory
        and the historical `_business` suffix used by earlier templates.
        """
        candidate = Path(workflow)
        if candidate.is_absolute() and candidate.exists():
            return candidate.resolve()

        search_names: List[str] = []
        if candidate.suffix:
            search_names.append(candidate.name)
        else:
            search_names.append(f"{candidate.name}.plx")

        # Historical suffix compatibility (e.g., saas_product -> saas_product_business).
        for name in list(search_names):
            stem = Path(name).stem
            suffix = Path(name).suffix or ".plx"
            if not stem.endswith("_business"):
                search_names.append(f"{stem}_business{suffix}")

        search_roots = [
            self.workflow_dir,
            self.workflow_dir / "templates",
        ]

        for root in search_roots:
            for name in search_names:
                path = root / name
                if path.exists():
                    return path.resolve()

        raise FileNotFoundError(f"Workflow not found: {workflow}")

    def _read_workflow_file(self, path: Path) -> Dict[str, Any]:
        with path.open("rb") as handle:
            return tomllib.load(handle)

    def _infer_variables(self, pipes: List[Dict[str, Any]]) -> List[str]:
        variables: set[str] = set()
        for pipe in pipes or []:
            for key in ("user_prompt", "system_prompt", "description"):
                value = pipe.get(key)
                if isinstance(value, str):
                    variables.update(VARIABLE_PATTERN.findall(value))
        return sorted(variables)

    # DEPRECATED: This method was used to convert pre-v0.14.3 format to a normalized structure.
    # Now that templates are in v0.14.3 format, this normalization is no longer needed.
    # Keeping it commented for reference in case legacy templates need to be supported.
    #
    # def _normalise_workflow(
    #     self, raw: Dict[str, Any], path: Path
    # ) -> Dict[str, Any]:
    #     domain = raw.get("domain") or {}
    #     pipes = raw.get("pipe") or []
    #     concepts = raw.get("concept") or []
    #
    #     steps = [
    #         pipe.get("name")
    #         for pipe in pipes
    #         if isinstance(pipe, dict) and pipe.get("name")
    #     ]
    #
    #     return {
    #         "name": domain.get("name") or path.stem.replace("_business", ""),
    #         "path": str(path),
    #         "domain": domain,
    #         "concepts": concepts,
    #         "pipes": pipes,
    #         "steps": steps,
    #         "variables": self._infer_variables(pipes),
    #     }

    async def load_workflow(
        self, workflow: Union[str, Path]
    ) -> Optional[Dict[str, Any]]:
        """
        Load and parse a Pipelex workflow (.plx) file.

        Returns the raw workflow dictionary as parsed from TOML (v0.14.3 format).
        Templates are expected to be in the correct Pipelex v0.14.3 format.

        The method caches results to avoid repeated IO during test runs.
        """
        try:
            workflow_path = self._resolve_workflow_path(workflow)
        except FileNotFoundError:
            logger.warning("Pipelex workflow not found: %s", workflow)
            return None

        if workflow_path in self._workflow_cache:
            return self._workflow_cache[workflow_path]

        # Load raw TOML - templates are now in correct v0.14.3 format
        raw = await asyncio.to_thread(self._read_workflow_file, workflow_path)

        # Add metadata for convenience
        raw["_path"] = str(workflow_path)
        raw["_name"] = workflow_path.stem.replace("_business", "")

        self._workflow_cache[workflow_path] = raw
        return raw

    # --------------------------------------------------------------------- #
    # Genesis task → Pipelex input mapping
    # --------------------------------------------------------------------- #

    def map_genesis_task_to_pipelex(
        self, genesis_task: Union[TaskDAGTask, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Convert a Genesis task (dataclass or dict) into Pipelex input variables.
        """
        metadata: Dict[str, Any] = {}
        description: Optional[str] = None
        task_type: Optional[str] = None

        if hasattr(genesis_task, "metadata"):
            metadata = getattr(genesis_task, "metadata") or {}
            description = getattr(genesis_task, "description", None)
            task_type = getattr(genesis_task, "task_type", None)
        elif isinstance(genesis_task, dict):
            metadata = genesis_task.get("metadata") or {}
            description = genesis_task.get("description")
            task_type = genesis_task.get("task_type")

        business_type = (
            metadata.get("business_type")
            or metadata.get("agent_type")
            or task_type
            or "generic"
        )

        inputs: Dict[str, Any] = {
            "business_type": business_type,
            "task_description": description or metadata.get("description", ""),
        }

        def _maybe_add(target_key: str, *source_keys: str) -> None:
            for key in source_keys:
                if key in metadata and metadata[key]:
                    inputs[target_key] = metadata[key]
                    return
                if isinstance(genesis_task, dict) and key in genesis_task and genesis_task[key]:
                    inputs[target_key] = genesis_task[key]
                    return

        _maybe_add("business_niche", "business_niche", "product_type", "niche", "target_market")
        _maybe_add("problem_space", "problem_space", "problem", "challenge")
        _maybe_add("target_audience", "target_audience", "target_users", "target_market")
        _maybe_add("expected_users", "expected_monthly_users", "expected_users")
        _maybe_add("capabilities", "capabilities")

        return inputs

    def _map_genesis_task_to_pipelex_inputs(
        self, genesis_task: Union[TaskDAGTask, Dict[str, Any]], business_type: Optional[str]
    ) -> Dict[str, Any]:
        inputs = self.map_genesis_task_to_pipelex(genesis_task)
        if business_type:
            inputs.setdefault("business_type", business_type)
        return inputs

    # --------------------------------------------------------------------- #
    # Execution helpers
    # --------------------------------------------------------------------- #

    async def _route_to_agent(self, task_description: str) -> str:
        """Route task to an agent via HALO (falls back to QA agent)."""
        if not self.halo_router or not HALO_AVAILABLE:
            return "qa_agent"

        try:
            routing_task = TaskDAGTask(  # type: ignore[misc]
                task_id=f"pipelex_{hash(task_description) & 0xFFFF}",
                task_type="pipelex",
                description=task_description,
            )
            routing_plan = await self.halo_router.route_tasks([routing_task])  # type: ignore[call-arg]
            return routing_plan.assignments.get(routing_task.task_id, "qa_agent")
        except Exception as exc:  # pragma: no cover
            logger.debug("HALO routing failed (%s); using default agent.", exc)
            return "qa_agent"

    async def _execute_workflow_internal(
        self, workflow_path: Path, inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute the workflow via Pipelex when the runtime is available.

        In environments where Pipelex is not installed, we return a structured
        stub so downstream components still receive deterministic data.
        """
        workflow_config = await self.load_workflow(workflow_path)
        if workflow_config is None:
            raise FileNotFoundError(f"Workflow file not found: {workflow_path}")

        if self.runner:
            # Best-effort execution through Pipelex runtime.
            try:  # pragma: no cover - depends on optional runtime
                result = await asyncio.to_thread(
                    self.runner.run, workflow_path, inputs
                )
                return result if isinstance(result, dict) else {"output": result}
            except Exception as exc:
                logger.debug("Pipelex runtime execution failed: %s", exc)
                raise
        raise RuntimeError("Pipelex runtime not available")

    async def _fallback_execution(
        self,
        genesis_task: Optional[Union[TaskDAGTask, Dict[str, Any]]],
        business_type: Optional[str],
        inputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute the task through the model registry when Pipelex fails.
        """
        description = None
        if hasattr(genesis_task, "description"):
            description = getattr(genesis_task, "description")
        elif isinstance(genesis_task, dict):
            description = genesis_task.get("description")

        inputs = inputs or {}
        description = description or inputs.get("task_description") or "Pipelex workflow execution"

        agent_name = await self._route_to_agent(description)

        if self.model_registry and HALO_AVAILABLE:
            try:  # pragma: no cover - depends on external system
                messages = [{"role": "user", "content": description}]
                result = await self.model_registry.chat_async(agent_name, messages)  # type: ignore[call-arg]
            except Exception as exc:
                logger.debug("Model registry fallback failed: %s", exc)
                result = {"error": str(exc)}
        else:
            result = {
                "message": "Model registry unavailable; returning stub result.",
                "inputs": inputs,
            }

        return {
            "status": "fallback",
            "used_fallback": True,
            "fallback": True,
            "agent_name": agent_name,
            "outputs": result,
        }

    async def execute_workflow(
        self,
        workflow_name: Optional[str] = None,
        *,
        workflow_path: Optional[Union[str, Path]] = None,
        inputs: Optional[Dict[str, Any]] = None,
        genesis_task: Optional[Union[TaskDAGTask, Dict[str, Any]]] = None,
        business_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute a Pipelex workflow.  Accepts either a workflow name (preferred)
        or an explicit path.  Inputs can be provided directly, or derived from a
        Genesis task.
        """
        if workflow_name is None and workflow_path is None:
            raise ValueError("workflow_name or workflow_path must be provided")

        try:
            resolved_path = self._resolve_workflow_path(
                workflow_path or workflow_name  # type: ignore[arg-type]
            )
        except FileNotFoundError as exc:
            raise ValueError("Workflow file not found") from exc

        if inputs is None and genesis_task is None:
            raise ValueError("Either inputs or genesis_task must be provided")
        if inputs is None and genesis_task is not None:
            inputs = self._map_genesis_task_to_pipelex_inputs(genesis_task, business_type)

        assert inputs is not None  # For type-checkers.

        # Optional OTEL tracing.
        span_context = None
        if self.otel_manager and OTEL_AVAILABLE:
            try:  # pragma: no cover - depends on observability stack
                span_context = self.otel_manager.span(
                    name="pipelex.execute_workflow",
                    span_type=SpanType.ORCHESTRATION,  # type: ignore[arg-type]
                    context=CorrelationContext(  # type: ignore[call-arg]
                        correlation_id=f"pipelex::{resolved_path.name}"
                    ),
                )
                span = span_context.__enter__()
                if hasattr(span, "set_attribute"):
                    span.set_attribute("workflow.path", str(resolved_path))
                    span.set_attribute("workflow.inputs", json.dumps(inputs))
                    span.set_attribute("workflow.business_type", inputs.get("business_type", "unknown"))
            except Exception as exc:
                logger.debug("Failed to initialise OTEL span: %s", exc)
                span_context = None

        try:
            outputs = await asyncio.wait_for(
                self._execute_workflow_internal(resolved_path, inputs),
                timeout=self.timeout,
            )
            return {
                "status": "completed",
                "used_fallback": False,
                "workflow_path": str(resolved_path),
                "outputs": outputs,
            }
        except FileNotFoundError as exc:
            raise ValueError("Workflow file not found") from exc
        except Exception as exc:
            logger.debug("Pipelex execution failed (%s); using fallback.", exc)
            if genesis_task is None:
                raise RuntimeError(str(exc)) from exc
            fallback = await self._fallback_execution(genesis_task, business_type, inputs)
            fallback.setdefault("workflow_path", str(resolved_path))
            fallback.setdefault("fallback_reason", str(exc))
            return fallback
        finally:
            if span_context is not None:  # pragma: no cover - depends on OTEL stack
                try:
                    span_context.__exit__(None, None, None)
                except Exception as exc:
                    logger.debug("Failed to close OTEL span: %s", exc)


async def execute_pipelex_workflow(
    workflow_name: Optional[str] = None,
    *,
    workflow_path: Optional[Union[str, Path]] = None,
    workflow_dir: Optional[Path] = None,
    inputs: Optional[Dict[str, Any]] = None,
    genesis_task: Optional[Union[TaskDAGTask, Dict[str, Any]]] = None,
    business_type: Optional[str] = None,
    timeout: Optional[float] = None,
    timeout_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Convenience wrapper around :class:`PipelexAdapter.execute_workflow`.
    """
    adapter = PipelexAdapter(
        workflow_dir=workflow_dir,
        timeout=timeout,
        timeout_seconds=timeout_seconds,
    )
    return await adapter.execute_workflow(
        workflow_name=workflow_name,
        workflow_path=workflow_path,
        inputs=inputs,
        genesis_task=genesis_task,
        business_type=business_type,
    )
class _NoopSpanContext:
    """Minimal context manager used when tracing is disabled."""

    def __enter__(self) -> SimpleNamespace:
        return SimpleNamespace(set_attribute=lambda *args, **kwargs: None)

    def __exit__(self, exc_type, exc, tb) -> None:
        return None
