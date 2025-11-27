"""
Visual QA Alignment Pilot (AligNet Adapter)
==========================================

Provides a lightweight evaluation harness for measuring how an aligned visual
model (e.g., AligNet) improves upon a base vision model on odd-one-out tasks.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass
class OddOneOutSample:
    """Single odd-one-out evaluation sample."""

    sample_id: str
    candidates: Sequence[str]
    correct_index: int


@dataclass
class ModelPrediction:
    """Prediction scores for an odd-one-out sample."""

    scores: Sequence[float]

    @property
    def predicted_index(self) -> int:
        if not self.scores:
            return -1
        max_score = max(self.scores)
        return self.scores.index(max_score)

    @property
    def confidence(self) -> float:
        total = float(sum(self.scores))
        if total <= 0.0:
            return 0.0
        return float(max(self.scores) / total)

    @property
    def uncertainty(self) -> float:
        if len(self.scores) < 2:
            return 0.0
        sorted_scores = sorted(self.scores, reverse=True)
        top = sorted_scores[0]
        runner_up = sorted_scores[1]
        if top <= 0.0:
            return 1.0
        return runner_up / top


class AlignmentModel(Protocol):
    """Protocol for vision models participating in the alignment evaluation."""

    def predict(self, sample: OddOneOutSample) -> ModelPrediction:
        ...


@dataclass
class AlignmentReport:
    """Aggregate metrics comparing the base and aligned models."""

    base_false_positives: int
    base_false_negatives: int
    aligned_false_positives: int
    aligned_false_negatives: int
    false_positive_reduction: float
    false_negative_reduction: float
    average_uncertainty: float


class VisualQAAlignmentPilot:
    """
    Evaluate and deploy an aligned vision model for visual QA workloads.
    """

    def __init__(
        self,
        *,
        base_model: AlignmentModel,
        aligned_model: AlignmentModel,
        escalation_threshold: float = 0.35,
    ) -> None:
        self.base_model = base_model
        self.aligned_model = aligned_model
        self.escalation_threshold = escalation_threshold

    # ------------------------------------------------------------------ #
    # evaluation
    # ------------------------------------------------------------------ #
    def run_evaluation(self, dataset: Sequence[OddOneOutSample]) -> AlignmentReport:
        base_fp = base_fn = aligned_fp = aligned_fn = 0
        uncertainty_sum = 0.0

        for sample in dataset:
            base_pred = self.base_model.predict(sample)
            aligned_pred = self.aligned_model.predict(sample)

            fp, fn = self._error_counts(base_pred.predicted_index, sample.correct_index)
            base_fp += fp
            base_fn += fn

            afp, afn = self._error_counts(aligned_pred.predicted_index, sample.correct_index)
            aligned_fp += afp
            aligned_fn += afn

            uncertainty_sum += aligned_pred.uncertainty

        count = max(len(dataset), 1)
        avg_uncertainty = uncertainty_sum / count

        fp_reduction = self._relative_reduction(base_fp, aligned_fp)
        fn_reduction = self._relative_reduction(base_fn, aligned_fn)

        return AlignmentReport(
            base_false_positives=base_fp,
            base_false_negatives=base_fn,
            aligned_false_positives=aligned_fp,
            aligned_false_negatives=aligned_fn,
            false_positive_reduction=fp_reduction,
            false_negative_reduction=fn_reduction,
            average_uncertainty=avg_uncertainty,
        )

    def score_sample(self, sample: OddOneOutSample) -> dict:
        """
        Score a single sample and surface escalation guidance.
        """
        base_prediction = self.base_model.predict(sample)
        aligned_prediction = self.aligned_model.predict(sample)
        uncertainty = aligned_prediction.uncertainty
        escalate = uncertainty >= self.escalation_threshold
        return {
            "sample_id": sample.sample_id,
            "prediction": aligned_prediction.predicted_index,
            "confidence": aligned_prediction.confidence,
            "uncertainty": uncertainty,
            "escalate": escalate,
            "base_prediction": base_prediction.predicted_index,
        }

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _error_counts(predicted_index: int, truth_index: int) -> tuple[int, int]:
        if predicted_index == truth_index:
            return (0, 0)
        # Wrong candidate flagged: simultaneously a false positive and false negative.
        return (1, 1)

    @staticmethod
    def _relative_reduction(base_count: int, aligned_count: int) -> float:
        if base_count == 0:
            return 0.0
        reduction = (base_count - aligned_count) / base_count
        return max(min(reduction, 1.0), -1.0)

    def should_escalate(self, uncertainty: float) -> bool:
        return uncertainty >= self.escalation_threshold


__all__ = [
    "AlignmentModel",
    "AlignmentReport",
    "ModelPrediction",
    "OddOneOutSample",
    "VisualQAAlignmentPilot",
]

