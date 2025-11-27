from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, Optional


@dataclass
class CurriculumState:
    successes: Deque[float]
    novelty: Deque[float]
    stage: str


class DreamGymCurriculumGenerator:
    """
    Maintains adaptive curriculum state per task family as described in DreamGym.
    """

    STAGES = ("novice", "intermediate", "expert")

    def __init__(self, history: int = 20) -> None:
        self.history = history
        self._state: Dict[str, CurriculumState] = {}

    def _get_state(self, task_signature: str) -> CurriculumState:
        if task_signature not in self._state:
            self._state[task_signature] = CurriculumState(
                successes=deque(maxlen=self.history),
                novelty=deque(maxlen=self.history),
                stage="novice",
            )
        return self._state[task_signature]

    def record_outcome(
        self,
        task_signature: str,
        reward: float,
        novelty_score: float,
    ) -> None:
        state = self._get_state(task_signature)
        state.successes.append(reward)
        state.novelty.append(novelty_score)
        self._maybe_advance(state)

    def _maybe_advance(self, state: CurriculumState) -> None:
        if len(state.successes) < 3:
            return
        avg_reward = sum(state.successes) / len(state.successes)
        avg_novelty = sum(state.novelty) / len(state.novelty)

        current_index = self.STAGES.index(state.stage)
        if avg_reward > 0.85 and avg_novelty > 0.75 and current_index < len(self.STAGES) - 1:
            state.stage = self.STAGES[current_index + 1]
        elif avg_reward < 0.65 and current_index > 0:
            state.stage = self.STAGES[current_index - 1]

    def next_stage(self, task_signature: str) -> str:
        return self._get_state(task_signature).stage
