"""
Research Rubrics Benchmark integration (arXiv:2511.07685).

This module loads a curated subset of the Research Rubrics dataset and exposes
helpers that attach breadth/depth/ambiguity criteria to HTDAG tasks.  The
criteria are later consumed by auditing/evaluation agents to grade task
outputs with weighted, human-authored rubrics.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Literal, Optional

from infrastructure.task_dag import TaskDAG, Task

RubricDimension = Literal["breadth", "depth", "ambiguity"]


@dataclass(frozen=True)
class RubricCriterion:
    """Single rubric criterion drawn from the benchmark dataset."""

    rubric_id: str
    criterion_id: str
    dimension: RubricDimension
    description: str
    weight: float
    evaluation_prompt: str

    def to_dict(self) -> Dict[str, str]:
        return asdict(self)


class ResearchRubricDataset:
    """
    Lightweight loader for the Research Rubrics benchmark.

    The upstream dataset contains thousands of prompts with human rubrics.
    We store a representative subset in `data/research_rubrics_sample.json`
    so the mapping logic can run offline.  The loader keeps a per-dimension
    index for O(1) lookups when annotating DAG tasks.
    """

    DEFAULT_PATH = Path("data/research_rubrics_sample.json")

    def __init__(self, dataset_path: Optional[Path] = None):
        self.path = dataset_path or Path(
            os.getenv("RESEARCH_RUBRIC_FILE", str(self.DEFAULT_PATH))
        )
        if not self.path.exists():
            raise FileNotFoundError(
                f"Research rubric dataset missing: {self.path}. "
                "Add the file or set RESEARCH_RUBRIC_FILE."
            )

        with self.path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        rubrics = payload.get("rubrics", [])
        self._by_dimension: Dict[RubricDimension, List[RubricCriterion]] = {
            "breadth": [],
            "depth": [],
            "ambiguity": [],
        }

        for rubric in rubrics:
            rubric_id = rubric["id"]
            dimension: RubricDimension = rubric["dimension"]
            for criterion in rubric.get("criteria", []):
                self._by_dimension[dimension].append(
                    RubricCriterion(
                        rubric_id=rubric_id,
                        criterion_id=criterion["id"],
                        dimension=dimension,
                        description=criterion["description"],
                        weight=float(criterion.get("weight", 0.0)),
                        evaluation_prompt=criterion["evaluation_prompt"],
                    )
                )

    def get_criteria(self, dimension: RubricDimension) -> List[RubricCriterion]:
        """Return all criteria for a dimension."""
        return list(self._by_dimension.get(dimension, []))


# Task type -> rubric dimensions heuristic mapping
TASK_TYPE_DIMENSIONS: Dict[str, List[RubricDimension]] = {
    "research": ["breadth", "depth"],
    "analytics": ["depth"],
    "analysis": ["depth"],
    "design": ["breadth"],
    "planning": ["breadth", "ambiguity"],
    "content": ["breadth"],
    "marketing": ["breadth", "ambiguity"],
    "reporting": ["depth", "ambiguity"],
    "support": ["ambiguity"],
    "qa": ["depth", "ambiguity"],
    "compliance": ["ambiguity"],
}


def _infer_dimensions(task: Task) -> List[RubricDimension]:
    if not task.task_type:
        return []

    task_type = task.task_type.lower()
    if "research" in task_type or "market" in task_type:
        return ["breadth", "depth"]
    if task_type in TASK_TYPE_DIMENSIONS:
        return TASK_TYPE_DIMENSIONS[task_type]
    return TASK_TYPE_DIMENSIONS.get(task_type.split("_")[0], [])


def apply_research_rubrics_to_dag(
    dag: TaskDAG,
    dataset: Optional[ResearchRubricDataset] = None,
    max_criteria_per_dimension: int = 2,
) -> Dict[str, List[RubricCriterion]]:
    """
    Annotate each HTDAG task with Research Rubric criteria.

    Args:
        dag: Populated TaskDAG
        dataset: Optional dataset instance (falls back to default file)
        max_criteria_per_dimension: Trim criterion count per dimension

    Returns:
        Mapping of task_id -> list of assigned RubricCriterion objects
    """
    dataset = dataset or ResearchRubricDataset()
    assignments: Dict[str, List[RubricCriterion]] = {}

    for task_id, task in dag.tasks.items():
        dimensions = _infer_dimensions(task)
        if not dimensions:
            continue

        criteria: List[RubricCriterion] = []
        for dim in dimensions:
            dim_criteria = dataset.get_criteria(dim)[:max_criteria_per_dimension]
            criteria.extend(dim_criteria)

        if not criteria:
            continue

        assignments[task_id] = criteria

        task.metadata = task.metadata or {}
        task.metadata.setdefault("rubrics", {})
        task.metadata["rubrics"]["criteria"] = [c.to_dict() for c in criteria]
        task.metadata["rubrics"]["dimensions"] = sorted(set(dimensions))

    return assignments
