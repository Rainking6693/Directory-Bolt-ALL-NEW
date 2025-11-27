"""Heuristic rubric evaluation hook used during autonomous orchestration."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from infrastructure.task_dag import TaskDAG


@dataclass
class RubricCriterionScore:
    """Normalized score (0-1) for a single rubric criterion."""

    criterion_id: str
    rubric_id: str
    dimension: str
    weight: float
    status: str  # satisfied | partial | insufficient | pending
    score: Optional[float]
    evidence_excerpt: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "criterion_id": self.criterion_id,
            "rubric_id": self.rubric_id,
            "dimension": self.dimension,
            "weight": self.weight,
            "status": self.status,
            "score": self.score,
            "evidence_excerpt": self.evidence_excerpt,
        }


class RubricEvaluationHook:
    """
    Lightweight rubric evaluation that inspects task outputs and derives
    breadth/depth/ambiguity scores.  The heuristics are intentionally simple so
    they can run offline; they provide a deterministic baseline before we wire
    in an LLM-based rubric judge.
    """

    def __init__(self, min_tokens: int = 40):
        self.min_tokens = min_tokens

    def evaluate(
        self,
        dag: TaskDAG,
        execution_summary: Optional[Dict[str, Any]] = None,
        task_outputs: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate rubric coverage for a DAG.

        Args:
            dag: Task DAG containing rubric metadata.
            execution_summary: Optional execution result payload that may
                contain `artifacts` or `task_outputs`.
            task_outputs: Optional explicit mapping task_id -> output text.
        """
        outputs = self._collect_outputs(execution_summary, task_outputs)
        reports: Dict[str, Dict[str, Any]] = {}

        total_weight = 0.0
        covered_weight = 0.0
        weighted_sum = 0.0

        for task in dag.get_all_tasks():
            rubrics = (task.metadata or {}).get("rubrics")
            if not rubrics:
                continue

            task_output = outputs.get(task.task_id)
            task_report = self._score_task(task_output, rubrics.get("criteria", []))
            if not task_report:
                continue

            reports[task.task_id] = {
                "task_id": task.task_id,
                "description": task.description,
                "dimensions": rubrics.get("dimensions", []),
                "criteria": [c.to_dict() for c in task_report],
            }

            for criterion in task_report:
                total_weight += criterion.weight
                if criterion.score is not None:
                    covered_weight += criterion.weight
                    weighted_sum += criterion.score * criterion.weight

        overall = weighted_sum / covered_weight if covered_weight > 0 else None

        return {
            "overall_score": overall,
            "covered_weight": covered_weight,
            "total_weight": total_weight,
            "coverage_ratio": (covered_weight / total_weight) if total_weight else 0.0,
            "task_reports": reports,
        }

    def _collect_outputs(
        self,
        execution_summary: Optional[Dict[str, Any]],
        explicit_outputs: Optional[Dict[str, str]],
    ) -> Dict[str, str]:
        outputs: Dict[str, str] = {}
        if execution_summary:
            for key in ("task_outputs", "artifacts"):
                value = execution_summary.get(key)
                if isinstance(value, dict):
                    outputs.update(
                        {
                            str(task_id): str(content)
                            for task_id, content in value.items()
                            if isinstance(content, (str, bytes))
                        }
                    )
        if explicit_outputs:
            outputs.update({str(k): str(v) for k, v in explicit_outputs.items()})
        return outputs

    def _score_task(
        self,
        task_output: Optional[str],
        criteria: List[Dict[str, Any]],
    ) -> List[RubricCriterionScore]:
        scores: List[RubricCriterionScore] = []
        normalized_output = self._normalize_output(task_output)

        for criterion in criteria:
            score, status = self._evaluate_criterion(
                normalized_output,
                criterion.get("dimension"),
            )
            excerpt = (
                normalized_output[:280].strip() if normalized_output else None
            )
            scores.append(
                RubricCriterionScore(
                    criterion_id=criterion.get("criterion_id", ""),
                    rubric_id=criterion.get("rubric_id", ""),
                    dimension=criterion.get("dimension", ""),
                    weight=float(criterion.get("weight", 0.0)),
                    status=status,
                    score=score,
                    evidence_excerpt=excerpt,
                )
            )
        return scores

    def _normalize_output(self, output: Optional[str]) -> Optional[str]:
        if output is None:
            return None
        if isinstance(output, bytes):
            output = output.decode("utf-8", errors="replace")
        output = output.strip()
        if not output:
            return None
        return output

    def _evaluate_criterion(
        self,
        text: Optional[str],
        dimension: Optional[str],
    ) -> Tuple[Optional[float], str]:
        if not text:
            return None, "pending"

        token_count = len(text.split())
        if token_count < self.min_tokens:
            # Encourage richer responses by marking short outputs as partial.
            return 0.4, "partial"

        dimension = (dimension or "").lower()
        if dimension == "breadth":
            score = self._score_breadth(text)
        elif dimension == "depth":
            score = self._score_depth(text)
        elif dimension == "ambiguity":
            score = self._score_ambiguity(text)
        else:
            score = 0.5

        if score >= 0.85:
            status = "satisfied"
        elif score >= 0.5:
            status = "partial"
        else:
            status = "insufficient"

        return score, status

    def _score_breadth(self, text: str) -> float:
        segments = re.split(r"[\n;,]|\band\b|\bor\b", text.lower())
        meaningful = [seg.strip() for seg in segments if len(seg.strip()) >= 8]
        unique_segments = len(set(meaningful))
        return min(unique_segments / 4.0, 1.0)

    def _score_depth(self, text: str) -> float:
        lowered = text.lower()
        hits = 0
        if re.search(r"\b(because|due to|since|therefore)\b", lowered):
            hits += 1
        if re.search(r"\b(data|evidence|metrics|study|survey)\b", lowered):
            hits += 1
        if re.search(r"\b(counter|risk|failure|drawback)\b", lowered):
            hits += 1
        if re.search(r"\\d", text):
            hits += 1
        return min(hits / 3.0, 1.0)

    def _score_ambiguity(self, text: str) -> float:
        lowered = text.lower()
        hits = 0
        if re.search(r"\b(assume|assumption|hypothesis|uncertain)\b", lowered):
            hits += 1
        if re.search(r"\b(risk|mitigation|monitor|alert)\b", lowered):
            hits += 1
        if "?" in text:
            hits += 0.5
        return min(hits / 2.0, 1.0)
