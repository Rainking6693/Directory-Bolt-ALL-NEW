"""FP16 (half-precision) training utilities for Genesis infrastructure.

This module wraps common PyTorch Automatic Mixed Precision (AMP) patterns so we can
train models in FP16 safely while retaining FP32 stability where it matters.

Key references (gathered via Context7 MCP lookups):
- PyTorch AMP documentation: https://pytorch.org/docs/stable/amp.html
- Precision-RL project: https://github.com/eric-haibin-lin/precision-rl
- NVIDIA Apex mixed-precision guidelines: https://github.com/NVIDIA/apex

The design mirrors the techniques used in the Precision-RL patches:
1. Centralised GradScaler management with dynamic loss scaling
2. autocast context manager for forward passes
3. Overflow detection and logging so training can adapt automatically
4. Checkpoint helpers that persist the scaler state

The wrapper degrades gracefully when CUDA/AMP are unavailable (e.g. CPU-only test
runs) by falling back to FP32 execution while keeping the same public API."""

from __future__ import annotations

import logging
from contextlib import nullcontext
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

try:  # Optional Torch dependency (matches world_model.py pattern)
    import torch
    from torch.cuda.amp import GradScaler, autocast
    from torch.nn.utils import clip_grad_norm_
    TORCH_AVAILABLE = True
except ImportError:  # pragma: no cover - executed in environments without torch
    torch = None  # type: ignore
    GradScaler = None  # type: ignore
    autocast = None  # type: ignore
    clip_grad_norm_ = None  # type: ignore
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class FP16TrainingConfig:
    """Configuration parameters for FP16 training.

    Defaults align with Precision-RL recommendations (loss scale 2^16, growth
    factor 2.0, back-off 0.5, growth interval 2000 steps)."""

    enabled: bool = True
    loss_scale: float = 65536.0
    growth_factor: float = 2.0
    backoff_factor: float = 0.5
    growth_interval: int = 2000


class FP16Trainer:
    """FP16 training wrapper with AMP and gradient scaling.

    Usage example::

        trainer = FP16Trainer(model, optimizer)
        for batch in dataloader:
            loss = trainer.training_step(batch, compute_loss_fn)
            trainer.backward_and_step(loss)

    When CUDA AMP is not available (e.g. CPU tests), the trainer automatically
    falls back to FP32 execution while preserving the same API."""

    def __init__(
        self,
        model: "torch.nn.Module",
        optimizer: "torch.optim.Optimizer",
        config: Optional[FP16TrainingConfig] = None,
    ) -> None:
        if not TORCH_AVAILABLE:
            raise RuntimeError(
                "FP16Trainer requires torch; ensure torch>=2.0.0 is installed before "
                "enabling FP16 training."
            )

        self.model = model
        self.optimizer = optimizer
        self.config = config or FP16TrainingConfig()

        # AMP currently requires CUDA for GradScaler; guard to avoid runtime errors
        self._amp_supported = torch.cuda.is_available()
        self._fp16_active = self.config.enabled and self._amp_supported

        if self.config.enabled and not self._amp_supported:
            logger.warning(
                "FP16 training requested but no CUDA device detected. Falling back to FP32."
            )

        if self._fp16_active:
            self.scaler = GradScaler(
                init_scale=self.config.loss_scale,
                growth_factor=self.config.growth_factor,
                backoff_factor=self.config.backoff_factor,
                growth_interval=self.config.growth_interval,
            )
            logger.info(
                "FP16 training enabled (loss_scale=%s, growth_interval=%s)",
                self.config.loss_scale,
                self.config.growth_interval,
            )
        else:
            self.scaler = None
            logger.info("FP16 training disabled - running in FP32 mode")

        self.training_steps = 0
        self.overflow_steps = 0

    # ------------------------------------------------------------------
    # Core training helpers
    # ------------------------------------------------------------------
    def training_step(
        self,
        batch: Any,
        compute_loss_fn: Callable[["torch.nn.Module", Any], "torch.Tensor"],
    ) -> "torch.Tensor":
        """Compute the loss for a single batch.

        The forward pass executes within an AMP autocast context when FP16 is
        active; otherwise it behaves exactly like FP32 training."""

        context_manager = (
            autocast(device_type="cuda", dtype=torch.float16)
            if self._fp16_active
            else nullcontext()
        )

        with context_manager:
            loss = compute_loss_fn(self.model, batch)

        if not isinstance(loss, torch.Tensor):
            raise TypeError("compute_loss_fn must return a torch.Tensor")

        # Ensure loss is float32 for stability (GradScaler expects float)
        return loss.float()

    def backward_and_step(self, loss: "torch.Tensor") -> bool:
        """Run backward pass and optimizer step.

        Returns ``True`` when the optimizer step is executed successfully and
        ``False`` when a gradient overflow is detected."""

        if not TORCH_AVAILABLE:
            raise RuntimeError("torch is required for backward passes")

        if loss.grad_fn is None:
            raise ValueError("Loss tensor must be differentiable")

        self.optimizer.zero_grad(set_to_none=True)

        scale_before = None

        if self._fp16_active and self.scaler is not None:
            self.scaler.scale(loss).backward()
            self.scaler.unscale_(self.optimizer)

            if clip_grad_norm_ is not None:
                clip_grad_norm_(self.model.parameters(), max_norm=1.0)

            self.scaler.step(self.optimizer)
            scale_before = self.scaler.get_scale()
            self.scaler.update()
            scale_after = self.scaler.get_scale()

            self.training_steps += 1

            if scale_after < scale_before:
                self.overflow_steps += 1
                logger.warning(
                    "Gradient overflow detected (step=%s, scale %s→%s)",
                    self.training_steps,
                    scale_before,
                    scale_after,
                )
                return False

            return True

        # FP32 fallback path
        loss.backward()
        if clip_grad_norm_ is not None:
            clip_grad_norm_(self.model.parameters(), max_norm=1.0)
        self.optimizer.step()
        self.training_steps += 1
        return True

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------
    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics for monitoring/benchmarking."""

        stats: Dict[str, Any] = {
            "training_steps": self.training_steps,
            "overflow_steps": self.overflow_steps,
            "overflow_rate": self.overflow_steps / max(self.training_steps, 1),
            "fp16_enabled": self._fp16_active,
        }

        if self._fp16_active and self.scaler is not None:
            stats["current_scale"] = self.scaler.get_scale()

        return stats

    def cast_model_to_fp16(self) -> None:
        """Convert model parameters to half precision (optional)."""

        if not self._fp16_active:
            logger.warning("Requested full FP16 casting but AMP is not active")
            return

        self.model.half()
        logger.info("Model parameters cast to torch.float16")

    # ------------------------------------------------------------------
    # Checkpoint helpers
    # ------------------------------------------------------------------
    def save_checkpoint(self, path: str) -> None:
        """Persist model/optimizer/scaler state."""

        if not TORCH_AVAILABLE:
            raise RuntimeError("torch is required to save checkpoints")

        checkpoint: Dict[str, Any] = {
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "training_steps": self.training_steps,
            "overflow_steps": self.overflow_steps,
            "fp16_active": self._fp16_active,
        }

        if self._fp16_active and self.scaler is not None:
            checkpoint["scaler_state_dict"] = self.scaler.state_dict()

        torch.save(checkpoint, path)
        logger.info("Checkpoint saved to %s", path)

    def load_checkpoint(self, path: str) -> None:
        """Restore state from a checkpoint previously saved."""

        if not TORCH_AVAILABLE:
            raise RuntimeError("torch is required to load checkpoints")

        checkpoint = torch.load(path, map_location="cuda" if self._amp_supported else "cpu")

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.training_steps = checkpoint.get("training_steps", 0)
        self.overflow_steps = checkpoint.get("overflow_steps", 0)

        if (
            self._fp16_active
            and self.scaler is not None
            and "scaler_state_dict" in checkpoint
        ):
            self.scaler.load_state_dict(checkpoint["scaler_state_dict"])

        logger.info("Checkpoint loaded from %s", path)
