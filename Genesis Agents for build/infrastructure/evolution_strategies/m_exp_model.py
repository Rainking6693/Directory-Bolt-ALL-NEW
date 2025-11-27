from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional


class State(Enum):
    READY = "ready"
    RUNNING = "running"
    DONE = "done"


class ExperienceModel:
    """
    Minimal stub used by DreamGym/evolution-strategy tests.
    """

    def __init__(self, *, max_rollout_steps: int = 1, model: Optional[str] = None, **kwargs: Any):
        self.max_rollout_steps = max_rollout_steps
        self.model = model or "stub-model"
        self.config = kwargs

    def simulate_step(self, state: State, **metadata: Any) -> State:
        return State.DONE

    def explain(self) -> Dict[str, Any]:
        return {"model": self.model, "max_rollout_steps": self.max_rollout_steps}
