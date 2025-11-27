"""LoRA Model Loader for Evolution Strategies.

This module provides load/save operations for LoRA adapters in Evolution Strategies
optimization. Implements the specification from docs/ES_MODEL_FORMAT_SPEC.md.

Key Features:
- Load base model + LoRA adapter
- Save LoRA adapter (safetensors format)
- Flatten/unflatten parameters for ES optimizer
- VRAM optimization (gradient checkpointing, Flash Attention 2)

Target Model: Llama-3.1-8B-Instruct
File Format: SafeTensors (.safetensors)
VRAM Budget: <8GB with optimizations

Author: Cora (AI/Agent Orchestration Specialist)
Date: November 8, 2025
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

# Optional dependencies (graceful degradation)
try:
    import torch
    from transformers import LlamaForCausalLM, AutoTokenizer, BitsAndBytesConfig
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    torch = None
    LlamaForCausalLM = None
    AutoTokenizer = None
    BitsAndBytesConfig = None
    TRANSFORMERS_AVAILABLE = False

try:
    from peft import PeftModel, LoraConfig, get_peft_model
    PEFT_AVAILABLE = True
except ImportError:
    PeftModel = None
    LoraConfig = None
    get_peft_model = None
    PEFT_AVAILABLE = False

try:
    from safetensors import safe_open
    from safetensors.torch import save_file
    SAFETENSORS_AVAILABLE = True
except ImportError:
    safe_open = None
    save_file = None
    SAFETENSORS_AVAILABLE = False

logger = logging.getLogger(__name__)


# =============================================================================
# LOAD/SAVE BASE MODEL + LORA ADAPTER
# =============================================================================

def load_model_with_lora(
    base_model_path: str = "meta-llama/Llama-3.1-8B-Instruct",
    lora_adapter_path: str = "models/lora_adapters/current/adapter.safetensors",
    device: str = "cuda",
    use_4bit: bool = False,
    enable_flash_attention: bool = True,
    enable_gradient_checkpointing: bool = True,
) -> Tuple[LlamaForCausalLM, PeftModel]:
    """
    Load base Llama-3.1-8B model and apply LoRA adapter.

    This function implements the loading strategy from ES_MODEL_FORMAT_SPEC.md
    with VRAM optimizations to fit in 8GB.

    Args:
        base_model_path: Path or HuggingFace model ID for base Llama model
        lora_adapter_path: Path to LoRA adapter (.safetensors or directory)
        device: Device to load on ("cuda" or "cpu")
        use_4bit: If True, quantize base model to 4-bit (7.4GB → 3.7GB)
        enable_flash_attention: If True, use Flash Attention 2 (-0.3GB, +2x speed)
        enable_gradient_checkpointing: If True, enable gradient checkpointing (-1GB)

    Returns:
        Tuple of (base_model, peft_model)

    Raises:
        ImportError: If transformers or peft not installed
        FileNotFoundError: If adapter path doesn't exist

    VRAM Budget:
        - FP16 base model: 7.4 GB
        - LoRA adapter: 0.1 GB
        - Activations: 1.5 GB → 0.5 GB (gradient checkpointing)
        - Flash Attention: -0.3 GB
        - Total: 7.9 GB (fits in 8GB)

        - With 4-bit quantization: 4.9 GB (aggressive optimization)

    Example:
        >>> base_model, peft_model = load_model_with_lora(
        ...     lora_adapter_path="models/lora_adapters/current/adapter.safetensors",
        ...     use_4bit=False,
        ... )
        >>> # Use peft_model for inference
        >>> output = peft_model.generate(input_ids)
    """
    if not TRANSFORMERS_AVAILABLE:
        raise ImportError(
            "transformers not installed. Install with: pip install transformers>=4.36.0"
        )

    if not PEFT_AVAILABLE:
        raise ImportError(
            "peft not installed. Install with: pip install peft>=0.7.0"
        )

    # Validate adapter path
    if not os.path.exists(lora_adapter_path):
        raise FileNotFoundError(
            f"LoRA adapter not found: {lora_adapter_path}\n"
            f"Create adapter first or check path."
        )

    logger.info(f"Loading base model: {base_model_path}")

    # Configure quantization (optional)
    model_kwargs = {
        "device_map": "auto",
    }

    if use_4bit:
        # 4-bit quantization: 7.4GB → 3.7GB
        logger.info("Using 4-bit quantization (50% VRAM reduction)")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",  # NormalFloat4 (best for LLMs)
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,  # Nested quantization
        )
        model_kwargs["quantization_config"] = bnb_config
    else:
        # FP16: 7.4GB
        model_kwargs["torch_dtype"] = torch.float16

    # Configure Flash Attention 2 (optional)
    if enable_flash_attention:
        logger.info("Using Flash Attention 2 (-0.3GB VRAM, +2x speed)")
        model_kwargs["attn_implementation"] = "flash_attention_2"

    # Load base model
    base_model = LlamaForCausalLM.from_pretrained(
        base_model_path,
        **model_kwargs
    )

    # Enable gradient checkpointing (optional)
    if enable_gradient_checkpointing:
        logger.info("Enabling gradient checkpointing (-1GB VRAM)")
        base_model.gradient_checkpointing_enable()

    logger.info(f"Loading LoRA adapter: {lora_adapter_path}")

    # Load LoRA adapter
    # PEFT automatically detects safetensors vs .pth format
    peft_model = PeftModel.from_pretrained(
        base_model,
        lora_adapter_path,
        is_trainable=False,  # Inference mode (no gradients for base model)
    )

    # Log VRAM usage
    if torch.cuda.is_available():
        vram_allocated = torch.cuda.memory_allocated() / 1e9
        vram_reserved = torch.cuda.memory_reserved() / 1e9
        logger.info(
            f"VRAM: {vram_allocated:.2f}GB allocated, {vram_reserved:.2f}GB reserved"
        )

    logger.info("Model loaded successfully")
    return base_model, peft_model


def save_lora_adapter(
    peft_model: PeftModel,
    save_path: str,
    use_safetensors: bool = True,
) -> None:
    """
    Save LoRA adapter to disk.

    Args:
        peft_model: PEFT model with LoRA adapter
        save_path: Path to save adapter (file or directory)
        use_safetensors: If True, save as .safetensors (recommended)

    Example:
        >>> save_lora_adapter(
        ...     peft_model=peft_model,
        ...     save_path="models/lora_adapters/archive/adapter_iter_0042.safetensors",
        ...     use_safetensors=True,
        ... )
    """
    if not PEFT_AVAILABLE:
        raise ImportError(
            "peft not installed. Install with: pip install peft>=0.7.0"
        )

    # Create parent directory if not exists
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)

    # Save adapter
    peft_model.save_pretrained(
        save_path,
        safe_serialization=use_safetensors,
    )

    # Log file size
    if os.path.exists(save_path):
        size_mb = os.path.getsize(save_path) / 1e6
        logger.info(f"LoRA adapter saved to: {save_path} ({size_mb:.1f} MB)")
    else:
        # Directory mode (PEFT saves to directory)
        total_size = sum(
            f.stat().st_size for f in Path(save_path).rglob("*") if f.is_file()
        )
        size_mb = total_size / 1e6
        logger.info(f"LoRA adapter saved to: {save_path}/ ({size_mb:.1f} MB)")


# =============================================================================
# LOAD/SAVE LORA PARAMETERS (FOR ES OPTIMIZER)
# =============================================================================

def load_lora_params(adapter_path: str) -> Dict[str, np.ndarray]:
    """
    Load LoRA adapter parameters as NumPy arrays for ES optimizer.

    This function loads LoRA adapter weights from safetensors or .pth format
    and returns them as NumPy arrays suitable for Evolution Strategies optimization.

    Args:
        adapter_path: Path to LoRA adapter (.safetensors or .pth file)

    Returns:
        Dictionary of parameter name -> NumPy array

    Raises:
        FileNotFoundError: If adapter path doesn't exist
        ImportError: If safetensors not installed

    Example:
        >>> params = load_lora_params("models/lora_adapters/current/adapter.safetensors")
        >>> print(f"Loaded {len(params)} parameter tensors")
        Loaded 256 parameter tensors
    """
    if not os.path.exists(adapter_path):
        raise FileNotFoundError(f"LoRA adapter not found: {adapter_path}")

    params = {}

    # Try safetensors first (recommended)
    if adapter_path.endswith(".safetensors") and SAFETENSORS_AVAILABLE:
        logger.debug(f"Loading safetensors: {adapter_path}")
        with safe_open(adapter_path, framework="pt", device="cpu") as f:
            for key in f.keys():
                tensor = f.get_tensor(key)
                params[key] = tensor.cpu().numpy()

    # Fallback to PyTorch .pth format
    elif adapter_path.endswith(".pth") and torch is not None:
        logger.debug(f"Loading PyTorch checkpoint: {adapter_path}")
        checkpoint = torch.load(adapter_path, map_location="cpu")

        # Extract LoRA state dict
        if "lora_state_dict" in checkpoint:
            state_dict = checkpoint["lora_state_dict"]
        else:
            state_dict = checkpoint

        # Convert to NumPy
        for key, tensor in state_dict.items():
            params[key] = tensor.cpu().numpy()

    else:
        raise ValueError(
            f"Unsupported adapter format: {adapter_path}\n"
            f"Use .safetensors (recommended) or .pth format"
        )

    logger.info(
        f"Loaded {len(params)} parameter tensors "
        f"({sum(p.nbytes for p in params.values()) / 1e6:.1f} MB)"
    )

    return params


def save_lora_params(
    params: Dict[str, np.ndarray],
    adapter_path: str,
    use_safetensors: bool = True,
) -> None:
    """
    Save NumPy parameter arrays as LoRA adapter.

    This function saves NumPy arrays (typically from ES optimizer) back to
    LoRA adapter format (safetensors or .pth).

    Args:
        params: Dictionary of parameter name -> NumPy array
        adapter_path: Path to save adapter
        use_safetensors: If True, save as .safetensors (recommended)

    Example:
        >>> save_lora_params(
        ...     params=perturbed_params,
        ...     adapter_path="models/lora_adapters/perturbations/perturbation_007.safetensors",
        ... )
    """
    # Create parent directory
    Path(adapter_path).parent.mkdir(parents=True, exist_ok=True)

    # Convert NumPy to PyTorch tensors
    if torch is None:
        raise ImportError("torch not installed. Install with: pip install torch>=2.0.0")

    tensors = {key: torch.from_numpy(val) for key, val in params.items()}

    # Save based on format
    if use_safetensors and SAFETENSORS_AVAILABLE:
        # Save as safetensors (recommended)
        save_file(tensors, adapter_path)
    else:
        # Save as .pth (fallback)
        checkpoint = {
            "lora_state_dict": tensors,
            "lora_config": {
                "r": 8,  # Default rank
                "lora_alpha": 128,
                "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
                "lora_dropout": 0.05,
                "bias": "none",
                "task_type": "CAUSAL_LM",
            },
        }
        torch.save(checkpoint, adapter_path)

    # Log file size
    size_mb = os.path.getsize(adapter_path) / 1e6
    logger.info(f"LoRA parameters saved to: {adapter_path} ({size_mb:.1f} MB)")


# =============================================================================
# FLATTEN/UNFLATTEN FOR ES OPTIMIZER
# =============================================================================

def flatten_lora_params(params: Dict[str, np.ndarray]) -> np.ndarray:
    """
    Flatten LoRA parameter dictionary to 1D array for ES optimizer.

    ES optimizer requires a flat 1D array of parameters. This function
    flattens the parameter dictionary in deterministic order.

    Args:
        params: Dictionary of parameter name -> NumPy array

    Returns:
        Flattened 1D NumPy array

    Example:
        >>> params = load_lora_params("adapter.safetensors")
        >>> flat_params = flatten_lora_params(params)
        >>> print(f"Flattened to {len(flat_params):,} parameters")
        Flattened to 5,242,880 parameters
    """
    if not params:
        return np.array([])

    flat_params = []

    # Sort keys for deterministic order
    for key in sorted(params.keys()):
        flat_params.append(params[key].flatten())

    return np.concatenate(flat_params)


def unflatten_lora_params(
    flat_params: np.ndarray,
    param_shapes: Dict[str, Tuple[int, ...]],
) -> Dict[str, np.ndarray]:
    """
    Unflatten 1D array back to LoRA parameter dictionary.

    Inverse of flatten_lora_params(). Used to reconstruct parameter dictionary
    from ES optimizer's flat parameter vector.

    Args:
        flat_params: Flattened 1D NumPy array
        param_shapes: Dictionary of parameter name -> shape tuple

    Returns:
        Dictionary of parameter name -> NumPy array

    Example:
        >>> param_shapes = {key: val.shape for key, val in params.items()}
        >>> reconstructed = unflatten_lora_params(flat_params, param_shapes)
        >>> assert reconstructed.keys() == params.keys()
    """
    params = {}
    offset = 0

    # Unflatten in same sorted order as flatten
    for key in sorted(param_shapes.keys()):
        shape = param_shapes[key]
        size = np.prod(shape)
        params[key] = flat_params[offset : offset + size].reshape(shape)
        offset += size

    return params


def get_param_shapes(params: Dict[str, np.ndarray]) -> Dict[str, Tuple[int, ...]]:
    """
    Extract parameter shapes from parameter dictionary.

    Helper function to get shapes for unflatten_lora_params().

    Args:
        params: Dictionary of parameter name -> NumPy array

    Returns:
        Dictionary of parameter name -> shape tuple

    Example:
        >>> param_shapes = get_param_shapes(params)
        >>> print(param_shapes["lora_A.layers.0.self_attn.q_proj.weight"])
        (8, 4096)
    """
    return {key: val.shape for key, val in params.items()}


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def validate_vram_budget(
    model: LlamaForCausalLM,
    max_vram_gb: float = 8.0,
) -> Dict[str, float]:
    """
    Validate that model fits in VRAM budget.

    Args:
        model: Loaded model to check
        max_vram_gb: Maximum VRAM budget in GB

    Returns:
        Dictionary with VRAM usage statistics

    Raises:
        RuntimeError: If VRAM usage exceeds budget

    Example:
        >>> stats = validate_vram_budget(base_model, max_vram_gb=8.0)
        >>> print(f"VRAM usage: {stats['allocated_gb']:.2f}GB")
    """
    if not torch.cuda.is_available():
        logger.warning("CUDA not available, skipping VRAM validation")
        return {"allocated_gb": 0.0, "reserved_gb": 0.0}

    # Get VRAM stats
    allocated_bytes = torch.cuda.memory_allocated()
    reserved_bytes = torch.cuda.memory_reserved()
    max_allocated_bytes = torch.cuda.max_memory_allocated()

    allocated_gb = allocated_bytes / 1e9
    reserved_gb = reserved_bytes / 1e9
    max_allocated_gb = max_allocated_bytes / 1e9

    stats = {
        "allocated_gb": allocated_gb,
        "reserved_gb": reserved_gb,
        "max_allocated_gb": max_allocated_gb,
    }

    logger.info(
        f"VRAM usage: {allocated_gb:.2f}GB allocated, "
        f"{reserved_gb:.2f}GB reserved, "
        f"{max_allocated_gb:.2f}GB peak"
    )

    # Check budget
    if max_allocated_gb > max_vram_gb:
        raise RuntimeError(
            f"VRAM usage ({max_allocated_gb:.2f}GB) exceeds budget ({max_vram_gb}GB)\n"
            f"Enable 4-bit quantization or reduce batch size"
        )

    return stats


def create_lora_config(
    r: int = 8,
    lora_alpha: int = 128,
    target_modules: list = None,
    lora_dropout: float = 0.05,
) -> LoraConfig:
    """
    Create LoRA configuration for PEFT.

    Args:
        r: LoRA rank (default: 8)
        lora_alpha: LoRA scaling factor (default: 128 = 16*r)
        target_modules: List of modules to adapt (default: attention projections)
        lora_dropout: Dropout rate (default: 0.05)

    Returns:
        LoraConfig object

    Example:
        >>> lora_config = create_lora_config(r=8, lora_alpha=128)
        >>> peft_model = get_peft_model(base_model, lora_config)
    """
    if not PEFT_AVAILABLE:
        raise ImportError("peft not installed. Install with: pip install peft>=0.7.0")

    if target_modules is None:
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj"]

    return LoraConfig(
        r=r,
        lora_alpha=lora_alpha,
        target_modules=target_modules,
        lora_dropout=lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        inference_mode=False,
    )


# =============================================================================
# MODULE EXPORTS
# =============================================================================

__all__ = [
    # Load/save model + adapter
    "load_model_with_lora",
    "save_lora_adapter",
    # Load/save parameters (ES optimizer)
    "load_lora_params",
    "save_lora_params",
    # Flatten/unflatten
    "flatten_lora_params",
    "unflatten_lora_params",
    "get_param_shapes",
    # Utilities
    "validate_vram_budget",
    "create_lora_config",
]
