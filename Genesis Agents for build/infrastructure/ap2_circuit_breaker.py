"""
AP2 Circuit Breaker
===================

Provides OPEN/HALF-OPEN/CLOSED state management for AP2 connector calls. Integrated
as a thin wrapper inside `AP2Service` to stop hammering the connector when repeated
failures occur.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitMetrics:
    state: CircuitState
    failure_count: int
    last_failure: Optional[float]
    last_success: Optional[float]


class CircuitBreaker:
    def __init__(
        self,
        *,
        failures_to_open: int = 3,
        half_open_timeout_seconds: float = 300.0,
        time_fn=time.time,
    ) -> None:
        self.failures_to_open = failures_to_open
        self.half_open_timeout_seconds = half_open_timeout_seconds
        self.time_fn = time_fn
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure: Optional[float] = None
        self.last_success: Optional[float] = None

    def allow(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            elapsed = self.time_fn() - (self.last_failure or 0)
            if elapsed >= self.half_open_timeout_seconds:
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        if self.state == CircuitState.HALF_OPEN:
            # allow a single request in half-open
            return True
        return True

    def record_success(self) -> None:
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_success = self.time_fn()

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure = self.time_fn()
        if self.failure_count >= self.failures_to_open:
            self.state = CircuitState.OPEN

    def metrics(self) -> CircuitMetrics:
        return CircuitMetrics(
            state=self.state,
            failure_count=self.failure_count,
            last_failure=self.last_failure,
            last_success=self.last_success,
        )


class AP2CircuitRegistry:
    """
    Tracks circuit breakers by agent name so each caller gets an independent breaker.
    """

    def __init__(self) -> None:
        self._circuits: Dict[str, CircuitBreaker] = {}

    def get(self, agent_name: str) -> CircuitBreaker:
        if agent_name not in self._circuits:
            self._circuits[agent_name] = CircuitBreaker()
        return self._circuits[agent_name]

    def summary(self) -> Dict[str, CircuitMetrics]:
        return {agent: breaker.metrics() for agent, breaker in self._circuits.items()}


__all__ = ["CircuitBreaker", "CircuitState", "AP2CircuitRegistry"]

