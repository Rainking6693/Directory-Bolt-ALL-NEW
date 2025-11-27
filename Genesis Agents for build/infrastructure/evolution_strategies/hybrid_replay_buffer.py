from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, Optional


@dataclass
class HybridExperienceReplayBuffer:
    casebank: Any
    experience_model: Any
    min_quality_threshold: float = 0.1
    synthetic_generated: int = 0

    async def generate_synthetic_experiences(self, *, num_experiences: int) -> int:
        await asyncio.sleep(0)
        self.synthetic_generated += num_experiences
        return num_experiences

    def get_statistics(self) -> Dict[str, Any]:
        return {
            "synthetic_generated": self.synthetic_generated,
            "synthetic_buffer_size": self.synthetic_generated,
            "last.generated_at": datetime.utcnow().isoformat(),
        }
