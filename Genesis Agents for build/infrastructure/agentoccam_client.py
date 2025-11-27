"""
AgentOccam Test-Time Search Integration

This module provides a lightweight implementation of the AgentOccam
test-time compute methodology. The goal is to explore multiple
reasoning branches with diverse temperatures, score each branch with
an evaluator, and return the highest-quality response while collecting
rich telemetry for downstream analytics.

The implementation is sandbox friendly: it works with synchronous or
asynchronous model/evaluator callables and degrades gracefully when a
branch fails.  It can be used directly by agents or wrapped by higher
level planners (e.g., HTDAG, TestTimeComputeOptimizer).
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Optional,
    Sequence,
    Union,
)

logger = logging.getLogger(__name__)

ModelFn = Callable[..., Union[str, Awaitable[str]]]
EvaluatorFn = Callable[..., Union[float, Awaitable[float]]]


@dataclass
class AgentOccamConfig:
    """Configuration for AgentOccam search."""

    max_branches: int = 6
    temperatures: Sequence[float] = field(
        default_factory=lambda: (0.2, 0.35, 0.5, 0.65, 0.8, 0.95)
    )
    exploration_bonus: float = 0.05
    timeout_seconds: float = 10.0
    rerank_top_k: int = 3
    baseline_weight: float = 0.1
    seed: Optional[int] = None
    trace_candidates: bool = True

    def __post_init__(self) -> None:
        if not self.temperatures:
            raise ValueError("temperatures must contain at least one value")
        if self.max_branches <= 0:
            raise ValueError("max_branches must be positive")
        if self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        # Ensure deterministic sampling when requested
        if self.seed is not None:
            random.seed(self.seed)


def _score_default(response: str) -> float:
    """
    Default heuristic score when no evaluator is provided.

    The score rewards longer, substantive answers while applying a
    small penalty for excessive verbosity to avoid run-away responses.
    """
    tokens = max(1, len(response.split()))
    unique_tokens = len(set(response.lower().split()))
    richness = unique_tokens / tokens
    length_reward = min(tokens / 40.0, 3.0)  # saturate after ~40 tokens
    return length_reward + richness


async def _maybe_await(value: Union[Any, Awaitable[Any]]) -> Any:
    """Await coroutines while accepting synchronous return values."""
    if asyncio.iscoroutine(value) or isinstance(value, Awaitable):
        return await value  # type: ignore[return-value]
    return value


class AgentOccamClient:
    """AgentOccam search coordinator."""

    def __init__(self, config: Optional[AgentOccamConfig] = None):
        self.config = config or AgentOccamConfig()

    async def run_search(
        self,
        prompt: str,
        model_fn: ModelFn,
        *,
        context: Optional[Dict[str, Any]] = None,
        evaluator_fn: Optional[EvaluatorFn] = None,
        baseline_fn: Optional[ModelFn] = None,
    ) -> Dict[str, Any]:
        """
        Execute AgentOccam test-time search.

        Args:
            prompt: The user prompt/task description.
            model_fn: Callable generating a response. It will be invoked
                with keyword arguments: ``prompt``, ``temperature`` and
                ``context`` (optional). The callable may be sync or async.
            context: Optional mutable context shared across branches.
            evaluator_fn: Optional scoring callable returning a float
                quality score. Receives ``response`` and ``context``.
            baseline_fn: Optional callable for a single-pass baseline
                response (e.g., deterministic greedy decode).

        Returns:
            Dict containing the best response, candidate diagnostics,
            and aggregate telemetry.
        """
        context = context or {}
        candidates: List[Dict[str, Any]] = []
        start_time = time.perf_counter()
        timeout_reached = False

        for branch_idx in range(min(self.config.max_branches, len(self.config.temperatures))):
            branch_start = time.perf_counter()
            temperature = self.config.temperatures[branch_idx]

            try:
                raw_response = await _maybe_await(
                    model_fn(prompt=prompt, temperature=temperature, context=context)
                )
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning(
                    "AgentOccam branch %s failed: %s", branch_idx, exc, exc_info=True
                )
                continue

            latency_ms = (time.perf_counter() - branch_start) * 1000.0
            response_text = str(raw_response)
            score = await self._score_response(
                response_text, evaluator_fn, context, branch_idx
            )
            score += self._exploration_bonus(branch_idx)

            candidate = {
                "response": response_text,
                "score": score,
                "temperature": temperature,
                "tokens": max(1, len(response_text.split())),
                "latency_ms": latency_ms,
                "branch_index": branch_idx,
            }
            candidates.append(candidate)

            if (time.perf_counter() - start_time) >= self.config.timeout_seconds:
                timeout_reached = True
                break

        baseline_candidate = None
        if baseline_fn is not None:
            try:
                baseline_start = time.perf_counter()
                baseline_response = await _maybe_await(
                    baseline_fn(prompt=prompt, context=context)
                )
                baseline_latency = (time.perf_counter() - baseline_start) * 1000.0
                baseline_score = await self._score_response(
                    baseline_response, evaluator_fn, context, branch_idx="baseline"
                )
                baseline_score -= self.config.baseline_weight
                baseline_candidate = {
                    "response": str(baseline_response),
                    "score": baseline_score,
                    "temperature": None,
                    "tokens": max(1, len(str(baseline_response).split())),
                    "latency_ms": baseline_latency,
                    "branch_index": "baseline",
                }
                candidates.append(baseline_candidate)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("Baseline evaluate failed: %s", exc, exc_info=True)

        if not candidates:
            raise RuntimeError("AgentOccam search produced no valid candidates")

        candidates.sort(key=lambda item: item["score"], reverse=True)
        best_candidate = candidates[0]
        reranked = candidates[: min(self.config.rerank_top_k, len(candidates))]

        telemetry = {
            "total_candidates": len(candidates),
            "timeout_reached": timeout_reached,
            "runtime_ms": (time.perf_counter() - start_time) * 1000.0,
            "baseline_included": baseline_candidate is not None,
        }

        result = {
            "best_response": best_candidate["response"],
            "best_score": best_candidate["score"],
            "candidates": reranked if self.config.trace_candidates else [],
            "telemetry": telemetry,
        }

        if self.config.trace_candidates:
            result["all_candidates"] = candidates

        return result

    async def _score_response(
        self,
        response: str,
        evaluator_fn: Optional[EvaluatorFn],
        context: Dict[str, Any],
        branch_idx: Union[int, str],
    ) -> float:
        """Score a response using evaluator_fn or fallback heuristic."""
        if evaluator_fn is None:
            return _score_default(response)

        try:
            return float(
                await _maybe_await(
                    evaluator_fn(response=response, context=context, branch=branch_idx)
                )
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Evaluator failure on branch %s: %s", branch_idx, exc)
            return _score_default(response)

    def _exploration_bonus(self, branch_idx: int) -> float:
        """Add diminishing exploration bonus to encourage diversity."""
        if branch_idx < 0:
            return 0.0
        return self.config.exploration_bonus / (1.0 + branch_idx)


def get_agent_occam_client(
    config: Optional[AgentOccamConfig] = None,
) -> AgentOccamClient:
    """Factory helper mirroring other integration entry-points."""
    return AgentOccamClient(config=config)


__all__ = ["AgentOccamClient", "AgentOccamConfig", "get_agent_occam_client"]
