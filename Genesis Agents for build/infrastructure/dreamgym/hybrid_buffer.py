from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List, Sequence

from infrastructure.dreamgym.experience_model import DreamGymExperience


class HybridReplayBuffer:
    """
    Stores real + synthetic experiences with configurable sampling ratios.
    """

    def __init__(
        self,
        max_real: int = 512,
        max_synthetic: int = 512,
    ) -> None:
        self.real: Deque[DreamGymExperience] = deque(maxlen=max_real)
        self.synthetic: Deque[DreamGymExperience] = deque(maxlen=max_synthetic)

    def add(self, experience: DreamGymExperience, source: str) -> None:
        if source == "real":
            self.real.append(experience)
        else:
            self.synthetic.append(experience)

    def sample(self, batch_size: int, synthetic_ratio: float = 0.5) -> List[DreamGymExperience]:
        synthetic_count = min(len(self.synthetic), int(batch_size * synthetic_ratio))
        real_count = min(len(self.real), batch_size - synthetic_count)

        samples: List[DreamGymExperience] = []
        samples.extend(list(self.synthetic)[-synthetic_count:])
        samples.extend(list(self.real)[-real_count:])
        return samples

    def stats(self) -> Dict[str, int]:
        return {"real": len(self.real), "synthetic": len(self.synthetic)}
