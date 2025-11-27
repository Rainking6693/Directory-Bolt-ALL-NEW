"""Data adapters for the multimodal evaluation harness."""

from __future__ import annotations

import abc
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


@dataclass(slots=True)
class SampleArtifact:
    """Represents a single multimodal artifact (image, video, OCR text, etc.)."""

    modality: str
    uri: str
    metadata: dict[str, str]


@dataclass(slots=True)
class Sample:
    """A single benchmark sample with expected outputs."""

    sample_id: str
    prompt: str
    artifacts: Sequence[SampleArtifact]
    expected_response: str | None = None
    tags: dict[str, str] | None = None


@dataclass(slots=True)
class SampleBatch:
    """Batch of samples ready for evaluation."""

    benchmark: str
    samples: Sequence[Sample]

    def __post_init__(self) -> None:
        if not self.samples:
            raise ValueError("SampleBatch requires at least one sample")


class BaseAdapter(abc.ABC):
    """Common interface for loading multimodal evaluation samples."""

    name: str = "base"

    @abc.abstractmethod
    def load(self, limit: int | None = None) -> SampleBatch:
        """Return a batch of samples for evaluation."""

    def resolve_path(self, root: Path, relative: str) -> Path:
        path = root / relative
        if not path.exists():
            raise FileNotFoundError(f"Artifact not found: {path}")
        return path

    def filter_samples(self, samples: Iterable[Sample], tag: str, value: str) -> list[Sample]:
        return [sample for sample in samples if (sample.tags or {}).get(tag) == value]
