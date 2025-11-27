"""
Hybrid text compression utilities for MemoryOS.

Provides a lightweight wrapper that can delegate to the VisionModelOCR pipeline
for high-ratio compression, while still supporting a plain-text fallback for
environments where the vision model (or PIL) is unavailable.  The implementation
is intentionally minimalist so the regression and integration tests can exercise
the vision path without requiring the original external dependency.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Optional, Tuple

from infrastructure.vision_model_ocr import (
    VisionModelOCR,
    CompressionMetrics,
    PixelRenderer,
)


@dataclass
class HybridCompressorConfig:
    """Runtime configuration for HybridCompressor."""

    use_vision_model: bool = True
    validate_accuracy: bool = False
    min_accuracy: float = 0.95


class HybridCompressor:
    """
    Hybrid compressor that can leverage the VisionModelOCR pipeline or fall back
    to a simple text-based strategy.
    """

    def __init__(
        self,
        use_vision_model: bool = True,
        vision_model_ocr: Optional[VisionModelOCR] = None,
        config: Optional[HybridCompressorConfig] = None,
    ) -> None:
        self.config = config or HybridCompressorConfig(
            use_vision_model=use_vision_model
        )
        self.vision_model = vision_model_ocr
        self.renderer = PixelRenderer()

        if self.config.use_vision_model and self.vision_model is None:
            raise ValueError(
                "HybridCompressor requires a VisionModelOCR instance when "
                "`use_vision_model` is True."
            )

    async def compress(self, text: str) -> Tuple[bytes, CompressionMetrics]:
        """Compress text using the configured strategy."""
        if self.config.use_vision_model and self.vision_model:
            return await self.vision_model.compress_text(
                text,
                validate_accuracy=self.config.validate_accuracy,
                min_accuracy=self.config.min_accuracy,
            )

        # Fallback: simple UTF-8 compression plus base64
        raw_bytes = text.encode("utf-8")
        compressed = base64.b64encode(raw_bytes)

        metrics = CompressionMetrics(
            original_tokens=len(raw_bytes),
            compressed_tokens=len(compressed),
            compression_ratio=len(raw_bytes) / max(len(compressed), 1),
            rendering_time_ms=0.0,
            inference_time_ms=0.0,
            total_time_ms=0.0,
        )

        return compressed, metrics

