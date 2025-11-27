"""
Secure checkpoint loading with safetensors + SHA256 verification.

Prevents checkpoint poisoning attacks (CVSS 7.8).

Security Benefits:
- No arbitrary code execution (pure tensor format, no pickle)
- Fast loading (memory-mapped)
- Cross-framework compatible (PyTorch, TensorFlow, JAX)
- Metadata support (checksums, versioning)
- SHA256 integrity verification

Vulnerability Mitigated:
- Checkpoint poisoning via malicious pickle in torch.load()
- Remote Code Execution (RCE) through model weights
- Data exfiltration via compromised checkpoints

Author: Sentinel (Security Agent)
Date: October 30, 2025
Version: 1.0
"""

import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any

import torch
import torch.nn as nn
from safetensors.torch import load_file, save_file

logger = logging.getLogger(__name__)


class CheckpointVerificationError(Exception):
    """Raised when checkpoint verification fails."""
    pass


class CheckpointFormatError(Exception):
    """Raised when checkpoint format is invalid."""
    pass


def compute_sha256(file_path: Path) -> str:
    """
    Compute SHA256 hash of file.

    Args:
        file_path: Path to file

    Returns:
        Hex-encoded SHA256 hash

    Raises:
        FileNotFoundError: If file doesn't exist

    Example:
        >>> hash_value = compute_sha256(Path("model.safetensors"))
        >>> print(f"SHA256: {hash_value}")
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read in chunks to handle large files
        while chunk := f.read(8192):
            sha256.update(chunk)

    return sha256.hexdigest()


def save_checkpoint_secure(
    state_dict: Dict[str, torch.Tensor],
    checkpoint_path: Path,
    metadata: Optional[Dict[str, str]] = None,
) -> str:
    """
    Save checkpoint using safetensors format with SHA256 hash.

    This function provides secure checkpoint saving with the following features:
    1. Uses safetensors format (no pickle, no arbitrary code execution)
    2. Computes SHA256 hash for integrity verification
    3. Saves hash to .sha256 file for later verification
    4. Supports optional metadata (version, created_at, etc.)

    Args:
        state_dict: Model state dictionary (tensor names → tensors)
        checkpoint_path: Path to save checkpoint (must end in .safetensors)
        metadata: Optional metadata (version, created_at, etc.)

    Returns:
        SHA256 hash of saved checkpoint

    Raises:
        ValueError: If checkpoint_path doesn't end in .safetensors
        OSError: If file cannot be written

    Example:
        >>> model = nn.Linear(10, 5)
        >>> state = model.state_dict()
        >>> hash_value = save_checkpoint_secure(
        ...     state,
        ...     Path("checkpoints/model.safetensors"),
        ...     metadata={"version": "1.0", "created_at": "2025-10-30"}
        ... )
        >>> print(f"Checkpoint saved with hash: {hash_value}")
    """
    # Validate checkpoint path
    if not str(checkpoint_path).endswith(".safetensors"):
        raise ValueError(
            f"Checkpoint path must end with .safetensors, got: {checkpoint_path}"
        )

    # Ensure directory exists
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    # Convert metadata values to strings (safetensors requirement)
    if metadata:
        metadata = {k: str(v) for k, v in metadata.items()}

    # Save using safetensors (safe, no pickle)
    save_file(state_dict, str(checkpoint_path), metadata=metadata)
    logger.info(f"Checkpoint saved: {checkpoint_path}")

    # Compute and save hash
    checkpoint_hash = compute_sha256(checkpoint_path)
    hash_path = checkpoint_path.with_suffix(".sha256")
    hash_path.write_text(checkpoint_hash)
    logger.info(f"Hash saved: {hash_path} (SHA256: {checkpoint_hash[:16]}...)")

    return checkpoint_hash


def load_checkpoint_secure(
    checkpoint_path: Path,
    expected_hash: Optional[str] = None,
    device: str = "cpu",
    verify_hash: bool = True,
) -> Dict[str, torch.Tensor]:
    """
    Load checkpoint using safetensors with SHA256 verification.

    This function provides secure checkpoint loading with the following features:
    1. Uses safetensors format (no pickle, no arbitrary code execution)
    2. Verifies SHA256 hash before loading (prevents tampering)
    3. Supports custom device placement (cpu, cuda, etc.)
    4. Optional hash verification bypass (for trusted sources)

    Args:
        checkpoint_path: Path to checkpoint file (.safetensors)
        expected_hash: Expected SHA256 hash (if None, reads from .sha256 file)
        device: Device to load tensors to (cpu, cuda, cuda:0, etc.)
        verify_hash: Whether to verify hash (default: True, RECOMMENDED)

    Returns:
        Model state dictionary (tensor names → tensors)

    Raises:
        FileNotFoundError: If checkpoint or hash file doesn't exist
        CheckpointVerificationError: If hash mismatch (checkpoint tampered)
        CheckpointFormatError: If checkpoint format is invalid

    Example:
        >>> state = load_checkpoint_secure(
        ...     Path("checkpoints/model.safetensors"),
        ...     expected_hash="abc123...",  # From trusted source
        ...     device="cuda"
        ... )
        >>> model.load_state_dict(state)

    Security Note:
        ALWAYS verify hashes in production! Only disable hash verification
        for development/testing with trusted checkpoints.
    """
    # Validate checkpoint exists
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    # Verify hash if enabled
    if verify_hash:
        # Read expected hash
        if expected_hash is None:
            hash_path = checkpoint_path.with_suffix(".sha256")
            if not hash_path.exists():
                raise CheckpointVerificationError(
                    f"Hash file not found: {hash_path}\n"
                    f"Either provide expected_hash or create {hash_path.name}"
                )
            expected_hash = hash_path.read_text().strip()

        # Verify hash
        actual_hash = compute_sha256(checkpoint_path)
        if actual_hash != expected_hash:
            raise CheckpointVerificationError(
                f"Hash mismatch! Checkpoint may be corrupted or tampered.\n"
                f"Expected: {expected_hash}\n"
                f"Actual:   {actual_hash}\n"
                f"File:     {checkpoint_path}"
            )

        logger.info(f"Hash verified: {checkpoint_path} (SHA256: {actual_hash[:16]}...)")
    else:
        logger.warning(
            f"Hash verification DISABLED for: {checkpoint_path}\n"
            f"This is INSECURE! Only use for trusted development checkpoints."
        )

    # Load using safetensors (safe, no pickle)
    try:
        state_dict = load_file(str(checkpoint_path), device=device)
        logger.info(
            f"Checkpoint loaded: {checkpoint_path} "
            f"({len(state_dict)} tensors, device: {device})"
        )
        return state_dict
    except Exception as e:
        raise CheckpointFormatError(
            f"Failed to load checkpoint: {checkpoint_path}\n"
            f"Error: {e}\n"
            f"Ensure file is valid safetensors format."
        ) from e


def migrate_pytorch_to_safetensors(
    pytorch_path: Path,
    safetensors_path: Path,
    metadata: Optional[Dict[str, str]] = None,
    weights_only: bool = True,
) -> str:
    """
    Migrate legacy PyTorch checkpoint to safetensors format.

    WARNING: This function uses torch.load() which is UNSAFE for untrusted
    checkpoints! Only use this on TRUSTED checkpoints from known sources.

    Migration Process:
    1. Load legacy .pt/.pth checkpoint using torch.load() (UNSAFE!)
    2. Convert to safetensors format (safe)
    3. Compute SHA256 hash
    4. Save hash to .sha256 file

    Args:
        pytorch_path: Path to .pt/.pth checkpoint (MUST BE TRUSTED!)
        safetensors_path: Path to save .safetensors (output)
        metadata: Optional metadata to attach
        weights_only: Use torch.load(weights_only=True) for safety (default: True)

    Returns:
        SHA256 hash of migrated checkpoint

    Raises:
        FileNotFoundError: If pytorch_path doesn't exist
        ValueError: If pytorch_path is not .pt/.pth file
        RuntimeError: If checkpoint cannot be loaded

    Example:
        >>> # Migrate trusted checkpoint from training
        >>> checkpoint_hash = migrate_pytorch_to_safetensors(
        ...     Path("checkpoints/old_model.pt"),
        ...     Path("checkpoints/model.safetensors"),
        ...     metadata={"version": "1.0", "migrated_at": "2025-10-30"}
        ... )
        >>> print(f"Migration complete! Hash: {checkpoint_hash}")

    Security Warning:
        DO NOT use this function on untrusted checkpoints! torch.load()
        can execute arbitrary code via pickle. Only use for:
        1. Your own training checkpoints
        2. Checkpoints from verified trusted sources
        3. Checkpoints from official model repositories (Hugging Face, etc.)
    """
    # Validate PyTorch path
    if not pytorch_path.exists():
        raise FileNotFoundError(f"PyTorch checkpoint not found: {pytorch_path}")

    if not str(pytorch_path).endswith((".pt", ".pth")):
        raise ValueError(
            f"PyTorch checkpoint must end with .pt or .pth, got: {pytorch_path}"
        )

    logger.warning(
        f"Loading legacy PyTorch checkpoint: {pytorch_path}\n"
        f"SECURITY WARNING: torch.load() uses pickle and can execute arbitrary code!\n"
        f"Only do this for TRUSTED checkpoints from known sources!"
    )

    # Load legacy checkpoint (UNSAFE for untrusted files!)
    try:
        if weights_only:
            # Safer: only load tensors, not arbitrary objects
            state_dict = torch.load(
                pytorch_path,
                map_location="cpu",
                weights_only=True
            )
        else:
            # Less safe: load full checkpoint (may contain objects)
            logger.warning("Loading full checkpoint (weights_only=False) - LESS SECURE!")
            checkpoint = torch.load(pytorch_path, map_location="cpu")

            # Extract state_dict from checkpoint
            if isinstance(checkpoint, dict):
                # Common formats: {"model": state_dict} or {"state_dict": state_dict}
                if "model" in checkpoint:
                    state_dict = checkpoint["model"]
                elif "state_dict" in checkpoint:
                    state_dict = checkpoint["state_dict"]
                else:
                    # Assume entire checkpoint is state_dict
                    state_dict = checkpoint
            else:
                raise RuntimeError(
                    f"Unexpected checkpoint format: {type(checkpoint)}\n"
                    f"Expected dict with 'model' or 'state_dict' key"
                )

        logger.info(f"Legacy checkpoint loaded: {len(state_dict)} tensors")
    except Exception as e:
        raise RuntimeError(
            f"Failed to load PyTorch checkpoint: {pytorch_path}\n"
            f"Error: {e}"
        ) from e

    # Save as safetensors
    checkpoint_hash = save_checkpoint_secure(state_dict, safetensors_path, metadata)
    logger.info(f"Migrated to safetensors: {safetensors_path}")

    return checkpoint_hash


def load_checkpoint_metadata(checkpoint_path: Path) -> Dict[str, Any]:
    """
    Load metadata from safetensors checkpoint without loading tensors.

    This is useful for inspecting checkpoint properties without the overhead
    of loading all tensor data into memory.

    Args:
        checkpoint_path: Path to .safetensors checkpoint

    Returns:
        Dictionary of metadata (version, created_at, etc.)

    Raises:
        FileNotFoundError: If checkpoint doesn't exist
        CheckpointFormatError: If checkpoint format is invalid

    Example:
        >>> metadata = load_checkpoint_metadata(Path("model.safetensors"))
        >>> print(f"Model version: {metadata.get('version', 'unknown')}")
    """
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    try:
        # Read safetensors header to extract metadata
        with open(checkpoint_path, "rb") as f:
            # First 8 bytes = header size (little-endian uint64)
            header_size_bytes = f.read(8)
            header_size = int.from_bytes(header_size_bytes, byteorder="little")

            # Next header_size bytes = JSON header
            header_json = f.read(header_size).decode("utf-8")
            header = json.loads(header_json)

            # Extract metadata (special __metadata__ key)
            metadata = header.get("__metadata__", {})

            logger.info(
                f"Metadata loaded from {checkpoint_path}: "
                f"{len(metadata)} keys"
            )
            return metadata
    except Exception as e:
        raise CheckpointFormatError(
            f"Failed to load metadata from: {checkpoint_path}\n"
            f"Error: {e}"
        ) from e


def verify_checkpoint_integrity(
    checkpoint_path: Path,
    expected_hash: Optional[str] = None
) -> bool:
    """
    Verify checkpoint integrity without loading it.

    Args:
        checkpoint_path: Path to checkpoint file
        expected_hash: Expected SHA256 hash (if None, reads from .sha256 file)

    Returns:
        True if hash matches, False otherwise

    Example:
        >>> is_valid = verify_checkpoint_integrity(Path("model.safetensors"))
        >>> if is_valid:
        ...     print("Checkpoint is valid and untampered")
        ... else:
        ...     print("WARNING: Checkpoint may be corrupted!")
    """
    try:
        # Read expected hash
        if expected_hash is None:
            hash_path = checkpoint_path.with_suffix(".sha256")
            if not hash_path.exists():
                logger.warning(f"Hash file not found: {hash_path}")
                return False
            expected_hash = hash_path.read_text().strip()

        # Verify hash
        actual_hash = compute_sha256(checkpoint_path)
        is_valid = actual_hash == expected_hash

        if is_valid:
            logger.info(
                f"Checkpoint integrity verified: {checkpoint_path} "
                f"(SHA256: {actual_hash[:16]}...)"
            )
        else:
            logger.error(
                f"Checkpoint integrity FAILED: {checkpoint_path}\n"
                f"Expected: {expected_hash}\n"
                f"Actual:   {actual_hash}"
            )

        return is_valid
    except Exception as e:
        logger.error(f"Integrity verification failed: {e}")
        return False


__all__ = [
    "save_checkpoint_secure",
    "load_checkpoint_secure",
    "migrate_pytorch_to_safetensors",
    "load_checkpoint_metadata",
    "verify_checkpoint_integrity",
    "compute_sha256",
    "CheckpointVerificationError",
    "CheckpointFormatError",
]
