from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, Optional


@dataclass
class DreamGymExperience:
    task_signature: str
    difficulty: str
    synthetic: bool
    observation: str
    action: str
    reward: float
    novelty_score: float
    generated_at: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["generated_at"] = self.generated_at
        return data


class DreamGymExperienceModel:
    """
    Deterministic synthetic experience generator based on DreamGym (arXiv:2511.03773).

    The real paper trains neural generators; here we emulate the curriculum-friendly
    behaviour with a seeded pseudo-random sampler so unit tests remain deterministic.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        base_seed = seed or int(hashlib.sha256(b"dreamgym").hexdigest(), 16) % (2**32)
        self._rng = random.Random(base_seed)

    def generate_episode(
        self,
        task_signature: str,
        difficulty: str,
        policy_hint: Optional[str] = None,
    ) -> DreamGymExperience:
        signature_hash = hashlib.sha256(task_signature.encode("utf-8")).hexdigest()
        local_seed = int(signature_hash[:8], 16) ^ self._rng.randint(0, 2**32 - 1)
        rng = random.Random(local_seed)

        base_reward = 0.55 + rng.random() * 0.4  # 0.55 - 0.95
        difficulty_bonus = {"novice": 0.0, "intermediate": 0.05, "expert": 0.1}.get(difficulty, 0.02)
        reward = min(0.99, base_reward + difficulty_bonus)

        novelty = 0.7 + rng.random() * 0.25  # 0.7 - 0.95
        observation = (
            f"[{difficulty.upper()}] Synthetic state for {task_signature} "
            f"(hint={policy_hint or 'n/a'})"
        )
        action = f"optimize::{task_signature}::{difficulty}::{rng.randint(100, 999)}"

        metadata = {
            "policy_hint": policy_hint,
            "token_budget": int(512 * (1 + difficulty_bonus)),
            "rollout_steps": rng.randint(3, 8),
        }

        return DreamGymExperience(
            task_signature=task_signature,
            difficulty=difficulty,
            synthetic=True,
            observation=observation,
            action=action,
            reward=round(reward, 3),
            novelty_score=round(novelty, 3),
            generated_at=datetime.now(timezone.utc).isoformat(),
            metadata=metadata,
        )
