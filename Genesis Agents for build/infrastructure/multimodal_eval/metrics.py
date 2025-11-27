"""Metric calculators for the multimodal evaluation harness."""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from .adapters import Sample


@dataclass(slots=True)
class MetricResult:
    """Represents the outcome of a metric evaluation."""

    name: str
    value: float
    details: Mapping[str, float] | None = None
    passed: bool | None = None


@dataclass(slots=True)
class MetricSet:
    """Collection of metric results aggregated for a sample or batch."""

    sample_id: str
    results: Sequence[MetricResult]


class BaseMetric(abc.ABC):
    """Base interface for multimodal evaluation metrics."""

    name: str = "metric"

    @abc.abstractmethod
    def evaluate(self, sample: Sample, response: str | None) -> MetricResult:
        """Compute metric for given sample and model response."""


class CompositeMetric(BaseMetric):
    """Runs multiple metrics and aggregates their outputs."""

    def __init__(self, metrics: Iterable[BaseMetric]) -> None:
        self.metrics = list(metrics)

    def evaluate(self, sample: Sample, response: str | None) -> MetricResult:
        sub_results = [metric.evaluate(sample, response) for metric in self.metrics]
        average = sum(result.value for result in sub_results) / max(1, len(sub_results))
        passed = all(result.passed for result in sub_results if result.passed is not None)
        return MetricResult(
            name="composite",
            value=average,
            details={result.name: result.value for result in sub_results},
            passed=passed,
        )
