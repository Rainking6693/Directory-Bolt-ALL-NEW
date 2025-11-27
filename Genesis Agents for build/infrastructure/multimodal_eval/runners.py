"""Evaluation runners for multimodal benchmarks."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence

from .adapters import SampleBatch
from .metrics import BaseMetric, MetricResult


@dataclass(slots=True)
class EvaluationContext:
    """Shared context for running evaluations."""

    model_name: str
    batch: SampleBatch
    extra: Mapping[str, str] | None = None


@dataclass(slots=True)
class EvaluationRecord:
    sample_id: str
    metrics: Sequence[MetricResult]
    response: str | None


@dataclass(slots=True)
class EvaluationResult:
    """Complete result for a benchmark evaluation."""

    benchmark: str
    model_name: str
    records: Sequence[EvaluationRecord]
    summary: Mapping[str, float] = field(default_factory=dict)


class EvaluationRunner(abc.ABC):
    """Base class for executing multimodal evaluations."""

    def __init__(self, metrics: Iterable[BaseMetric]) -> None:
        self.metrics = list(metrics)

    @abc.abstractmethod
    def generate_response(self, sample) -> str | None:  # noqa: ANN001 - sample is derived type
        """Produce a model response for the given sample."""

    def run(self, context: EvaluationContext) -> EvaluationResult:
        records: list[EvaluationRecord] = []
        metric_totals: dict[str, list[float]] = {}

        for sample in context.batch.samples:
            response = self.generate_response(sample)
            results = [metric.evaluate(sample, response) for metric in self.metrics]
            records.append(EvaluationRecord(sample_id=sample.sample_id, metrics=results, response=response))

            for result in results:
                metric_totals.setdefault(result.name, []).append(result.value)

        summary = {name: sum(values) / max(1, len(values)) for name, values in metric_totals.items()}
        return EvaluationResult(
            benchmark=context.batch.benchmark,
            model_name=context.model_name,
            records=records,
            summary=summary,
        )
