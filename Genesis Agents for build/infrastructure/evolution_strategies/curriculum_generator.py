from __future__ import annotations

from typing import Any


class AdaptiveCurriculumGenerator:
    def __init__(self, trajectory_pool: Any):
        self.trajectory_pool = trajectory_pool
        self.plan: list[dict[str, Any]] = []

    def schedule_tasks(self, num_tasks: int) -> list[dict[str, Any]]:
        plan = [{"task_id": f"task-{i}", "priority": 1.0} for i in range(num_tasks)]
        self.plan = plan
        return plan
