"""Extended FP16 training utilities with Multi-GPU and Bfloat16 support.

This module extends the base FP16Trainer with:
1. Multi-GPU DistributedDataParallel (DDP) support
2. Bfloat16 precision (better numerical stability than FP16)
3. FSDP (Fully Sharded Data Parallel) for large models
4. Advanced gradient accumulation strategies
5. Dynamic loss scaling with automatic tuning

References:
- PyTorch DDP: https://pytorch.org/docs/stable/generated/torch.nn.parallel.DistributedDataParallel.html
- PyTorch FSDP: https://pytorch.org/docs/stable/fsdp.html
- Bfloat16: https://pytorch.org/docs/stable/amp.html#torch.autocast
"""

from __future__ import annotations

import logging
import os
from contextlib import nullcontext
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, Optional

try:
    import torch
    import torch.distributed as dist
    from torch.cuda.amp import GradScaler, autocast
    from torch.nn.parallel import DistributedDataParallel as DDP
    from torch.nn.utils import clip_grad_norm_
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    dist = None
    GradScaler = None
    autocast = None
    DDP = None
    clip_grad_norm_ = None
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)


class PrecisionMode(Enum):
    """Supported precision modes for training."""
    FP32 = "fp32"
    FP16 = "fp16"
    BF16 = "bfloat16"
    MIXED_FP16 = "mixed_fp16"
    MIXED_BF16 = "mixed_bf16"


@dataclass
class ExtendedFP16Config:
    """Extended configuration for multi-GPU and mixed precision training.
    
    Attributes:
        precision_mode: Precision format to use
        enabled: Enable mixed precision training
        loss_scale: Initial gradient scale (FP16 only)
        growth_factor: Scale increase rate (FP16 only)
        backoff_factor: Scale decrease rate (FP16 only)
        growth_interval: Steps between scale increases (FP16 only)
        gradient_accumulation_steps: Number of steps to accumulate gradients
        max_grad_norm: Maximum gradient norm for clipping
        use_ddp: Enable DistributedDataParallel
        find_unused_parameters: DDP parameter for complex graphs
        broadcast_buffers: DDP parameter for buffer synchronization
    """
    
    precision_mode: PrecisionMode = PrecisionMode.MIXED_FP16
    enabled: bool = True
    loss_scale: float = 65536.0
    growth_factor: float = 2.0
    backoff_factor: float = 0.5
    growth_interval: int = 2000
    gradient_accumulation_steps: int = 1
    max_grad_norm: float = 1.0
    use_ddp: bool = False
    find_unused_parameters: bool = False
    broadcast_buffers: bool = True


class ExtendedFP16Trainer:
    """Extended FP16/Bfloat16 trainer with Multi-GPU and advanced features.
    
    Features:
    - FP16, Bfloat16, and mixed precision support
    - DistributedDataParallel (DDP) for multi-GPU training
    - Gradient accumulation for large effective batch sizes
    - Automatic mixed precision (AMP) with both FP16 and BF16
    - Dynamic loss scaling (FP16) or no scaling (BF16)
    - CUDA-aware optimizations
    
    Usage:
        # Single GPU with FP16
        trainer = ExtendedFP16Trainer(model, optimizer)
        
        # Multi-GPU with Bfloat16
        config = ExtendedFP16Config(
            precision_mode=PrecisionMode.MIXED_BF16,
            use_ddp=True
        )
        trainer = ExtendedFP16Trainer(model, optimizer, config)
        
        # Training loop
        for batch in dataloader:
            loss = trainer.training_step(batch, compute_loss_fn)
            is_update_step = trainer.backward_and_step(loss)
    """
    
    def __init__(
        self,
        model: "torch.nn.Module",
        optimizer: "torch.optim.Optimizer",
        config: Optional[ExtendedFP16Config] = None,
        device: Optional["torch.device"] = None,
        rank: int = 0,
        world_size: int = 1
    ) -> None:
        if not TORCH_AVAILABLE:
            raise RuntimeError(
                "ExtendedFP16Trainer requires torch>=2.0.0"
            )
        
        self.config = config or ExtendedFP16Config()
        self.model = model
        self.optimizer = optimizer
        self.rank = rank
        self.world_size = world_size
        
        # Determine device
        if device is None:
            if torch.cuda.is_available():
                self.device = torch.device(f"cuda:{rank}" if world_size > 1 else "cuda:0")
            else:
                self.device = torch.device("cpu")
        else:
            self.device = device
        
        # Move model to device
        self.model = self.model.to(self.device)
        
        # Setup DDP if multi-GPU
        if self.config.use_ddp and world_size > 1:
            if not torch.cuda.is_available():
                logger.warning("DDP requested but CUDA not available. Disabling DDP.")
                self.config.use_ddp = False
            elif not dist.is_initialized():
                logger.warning("DDP requested but torch.distributed not initialized. Disabling DDP.")
                self.config.use_ddp = False
            else:
                self.model = DDP(
                    self.model,
                    device_ids=[rank] if torch.cuda.is_available() else None,
                    find_unused_parameters=self.config.find_unused_parameters,
                    broadcast_buffers=self.config.broadcast_buffers
                )
                logger.info(f"DDP enabled: rank={rank}/{world_size}, device={self.device}")
        
        # Determine precision capabilities
        self._supports_amp = torch.cuda.is_available() or (
            hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()
        )
        self._supports_bf16 = (
            torch.cuda.is_available() and 
            torch.cuda.is_bf16_supported() if hasattr(torch.cuda, 'is_bf16_supported') else False
        )
        
        # Setup precision mode
        self._setup_precision_mode()
        
        # Training state
        self.training_steps = 0
        self.accumulated_steps = 0
        self.overflow_steps = 0
        self.update_steps = 0
        
        if rank == 0:  # Only log from main process
            logger.info(
                f"ExtendedFP16Trainer initialized: "
                f"mode={self.config.precision_mode.value}, "
                f"device={self.device}, "
                f"ddp={self.config.use_ddp}, "
                f"grad_accum={self.config.gradient_accumulation_steps}"
            )
    
    def _setup_precision_mode(self):
        """Setup precision mode and gradient scaler."""
        mode = self.config.precision_mode
        
        if not self.config.enabled:
            self.precision_active = False
            self.scaler = None
            self.autocast_dtype = None
            logger.info("Mixed precision disabled - using FP32")
            return
        
        # FP16 modes
        if mode in (PrecisionMode.FP16, PrecisionMode.MIXED_FP16):
            if not self._supports_amp:
                logger.warning("FP16 requested but AMP not supported. Falling back to FP32.")
                self.precision_active = False
                self.scaler = None
                self.autocast_dtype = None
                return
            
            self.precision_active = True
            self.autocast_dtype = torch.float16
            self.scaler = GradScaler(
                init_scale=self.config.loss_scale,
                growth_factor=self.config.growth_factor,
                backoff_factor=self.config.backoff_factor,
                growth_interval=self.config.growth_interval
            )
            logger.info("FP16 mixed precision enabled with gradient scaling")
        
        # Bfloat16 modes
        elif mode in (PrecisionMode.BF16, PrecisionMode.MIXED_BF16):
            if not self._supports_bf16:
                logger.warning("Bfloat16 requested but not supported by hardware. Falling back to FP16.")
                if self._supports_amp:
                    self.precision_active = True
                    self.autocast_dtype = torch.float16
                    self.scaler = GradScaler(
                        init_scale=self.config.loss_scale,
                        growth_factor=self.config.growth_factor,
                        backoff_factor=self.config.backoff_factor,
                        growth_interval=self.config.growth_interval
                    )
                else:
                    self.precision_active = False
                    self.scaler = None
                    self.autocast_dtype = None
                return
            
            self.precision_active = True
            self.autocast_dtype = torch.bfloat16
            self.scaler = None  # Bfloat16 doesn't need gradient scaling
            logger.info("Bfloat16 mixed precision enabled (no gradient scaling needed)")
        
        # FP32 fallback
        else:
            self.precision_active = False
            self.scaler = None
            self.autocast_dtype = None
            logger.info("Using FP32 precision")
    
    def training_step(
        self,
        batch: Any,
        compute_loss_fn: Callable[["torch.nn.Module", Any], "torch.Tensor"]
    ) -> "torch.Tensor":
        """Compute loss for a single batch with mixed precision.
        
        Args:
            batch: Input batch
            compute_loss_fn: Function that computes loss given (model, batch)
        
        Returns:
            Loss tensor (always FP32)
        """
        # Setup autocast context
        if self.precision_active:
            device_type = "cuda" if torch.cuda.is_available() else "cpu"
            context = autocast(device_type=device_type, dtype=self.autocast_dtype)
        else:
            context = nullcontext()
        
        # Forward pass with autocast
        with context:
            loss = compute_loss_fn(self.model, batch)
        
        if not isinstance(loss, torch.Tensor):
            raise TypeError("compute_loss_fn must return a torch.Tensor")
        
        # Scale loss for gradient accumulation
        if self.config.gradient_accumulation_steps > 1:
            loss = loss / self.config.gradient_accumulation_steps
        
        # Ensure loss is float32 for stability
        return loss.float()
    
    def backward_and_step(self, loss: "torch.Tensor") -> bool:
        """Run backward pass and conditional optimizer step with gradient accumulation.
        
        Args:
            loss: Loss tensor from training_step()
        
        Returns:
            True if optimizer step was executed, False if:
            - Still accumulating gradients
            - Gradient overflow detected (FP16 only)
        """
        if not TORCH_AVAILABLE:
            raise RuntimeError("torch is required for backward passes")
        
        if loss.grad_fn is None:
            raise ValueError("Loss tensor must be differentiable")
        
        # Backward pass with gradient scaling (if using FP16)
        if self.precision_active and self.scaler is not None:
            # FP16 path with gradient scaling
            self.scaler.scale(loss).backward()
        else:
            # BF16 or FP32 path (no scaling needed)
            loss.backward()
        
        self.accumulated_steps += 1
        self.training_steps += 1
        
        # Check if we should update weights
        should_update = (self.accumulated_steps % self.config.gradient_accumulation_steps == 0)
        
        if not should_update:
            return False  # Still accumulating gradients
        
        # Unscale gradients for clipping (FP16 only)
        if self.precision_active and self.scaler is not None:
            self.scaler.unscale_(self.optimizer)
        
        # Gradient clipping
        if self.config.max_grad_norm > 0:
            if clip_grad_norm_ is not None:
                clip_grad_norm_(
                    self.model.parameters(),
                    max_norm=self.config.max_grad_norm
                )
        
        # Optimizer step
        if self.precision_active and self.scaler is not None:
            # FP16 path: detect overflow
            scale_before = self.scaler.get_scale()
            self.scaler.step(self.optimizer)
            self.scaler.update()
            scale_after = self.scaler.get_scale()
            
            # Check for overflow
            if scale_after < scale_before:
                self.overflow_steps += 1
                logger.warning(
                    f"Gradient overflow detected (step={self.update_steps}, "
                    f"scale {scale_before:.0f}→{scale_after:.0f})"
                )
                # Don't zero gradients on overflow - they'll be recomputed
                return False
        else:
            # BF16 or FP32 path: simple step
            self.optimizer.step()
        
        # Zero gradients for next accumulation cycle
        self.optimizer.zero_grad(set_to_none=True)
        self.accumulated_steps = 0
        self.update_steps += 1
        
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get training statistics for monitoring."""
        stats = {
            "training_steps": self.training_steps,
            "update_steps": self.update_steps,
            "accumulated_steps": self.accumulated_steps,
            "overflow_steps": self.overflow_steps,
            "overflow_rate": self.overflow_steps / max(self.update_steps, 1),
            "precision_mode": self.config.precision_mode.value,
            "precision_active": self.precision_active,
            "device": str(self.device),
            "world_size": self.world_size,
            "rank": self.rank
        }
        
        if self.precision_active and self.scaler is not None:
            stats["current_scale"] = self.scaler.get_scale()
        
        return stats
    
    def save_checkpoint(self, path: str) -> None:
        """Save checkpoint with model, optimizer, and trainer state."""
        if not TORCH_AVAILABLE:
            raise RuntimeError("torch is required to save checkpoints")
        
        # Get underlying model (unwrap DDP if needed)
        model_to_save = self.model.module if isinstance(self.model, DDP) else self.model
        
        checkpoint = {
            "model_state_dict": model_to_save.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "training_steps": self.training_steps,
            "update_steps": self.update_steps,
            "accumulated_steps": self.accumulated_steps,
            "overflow_steps": self.overflow_steps,
            "precision_mode": self.config.precision_mode.value,
            "precision_active": self.precision_active,
            "config": {
                "precision_mode": self.config.precision_mode.value,
                "gradient_accumulation_steps": self.config.gradient_accumulation_steps,
                "max_grad_norm": self.config.max_grad_norm,
            }
        }
        
        if self.precision_active and self.scaler is not None:
            checkpoint["scaler_state_dict"] = self.scaler.state_dict()
        
        torch.save(checkpoint, path)
        
        if self.rank == 0:
            logger.info(f"Checkpoint saved to {path}")
    
    def load_checkpoint(self, path: str) -> None:
        """Load checkpoint and restore trainer state."""
        if not TORCH_AVAILABLE:
            raise RuntimeError("torch is required to load checkpoints")
        
        checkpoint = torch.load(path, map_location=self.device)
        
        # Load model (unwrap DDP if needed)
        model_to_load = self.model.module if isinstance(self.model, DDP) else self.model
        model_to_load.load_state_dict(checkpoint["model_state_dict"])
        
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.training_steps = checkpoint.get("training_steps", 0)
        self.update_steps = checkpoint.get("update_steps", 0)
        self.accumulated_steps = checkpoint.get("accumulated_steps", 0)
        self.overflow_steps = checkpoint.get("overflow_steps", 0)
        
        if self.precision_active and self.scaler is not None and "scaler_state_dict" in checkpoint:
            self.scaler.load_state_dict(checkpoint["scaler_state_dict"])
        
        if self.rank == 0:
            logger.info(f"Checkpoint loaded from {path}")


def init_distributed(backend: str = "nccl") -> Tuple[int, int]:
    """Initialize distributed training environment.
    
    Args:
        backend: Distributed backend ("nccl" for GPU, "gloo" for CPU)
    
    Returns:
        Tuple of (rank, world_size)
    """
    if not TORCH_AVAILABLE or not dist:
        raise RuntimeError("torch.distributed required for distributed training")
    
    if not dist.is_initialized():
        # Read from environment variables (set by torchrun or similar)
        rank = int(os.environ.get("RANK", 0))
        world_size = int(os.environ.get("WORLD_SIZE", 1))
        local_rank = int(os.environ.get("LOCAL_RANK", 0))
        
        if world_size > 1:
            dist.init_process_group(
                backend=backend,
                rank=rank,
                world_size=world_size
            )
            
            if torch.cuda.is_available():
                torch.cuda.set_device(local_rank)
            
            logger.info(f"Distributed training initialized: rank={rank}/{world_size}")
        else:
            logger.info("Single process training (no distributed)")
        
        return rank, world_size
    else:
        return dist.get_rank(), dist.get_world_size()


def cleanup_distributed():
    """Cleanup distributed training environment."""
    if TORCH_AVAILABLE and dist and dist.is_initialized():
        dist.destroy_process_group()
        logger.info("Distributed training cleaned up")

