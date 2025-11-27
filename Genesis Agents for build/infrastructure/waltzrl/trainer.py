"""
WaltzRL Training Pipeline
========================

Two-stage training for collaborative multi-agent safety:

Stage 1: Feedback Agent Training
- Train feedback agent on safety datasets (BeaverTails, XSTest, etc.)
- Goal: Learn to provide nuanced safety feedback (not binary)
- Output: Fine-tuned feedback model

Stage 2: Joint Training with DIR
- Dynamic Improvement Reward (DIR) joint optimization
- Train both conversation and feedback agents together
- Goal: Safety alignment without capability degradation
- Output: Production-ready safe conversation model

Integrated from:
- infrastructure/waltzrl_rlt_trainer.py
- infrastructure/waltzrl_stage2_trainer.py
"""

import logging
import os
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class WaltzRLTrainer:
    """
    Main WaltzRL training coordinator.

    Orchestrates two-stage training pipeline:
    1. Stage 1: Feedback agent training
    2. Stage 2: Joint DIR optimization
    """

    def __init__(
        self,
        base_model: str = "mistralai/Mistral-7B-v0.1",
        output_dir: str = "./models/waltzrl",
        use_fp16: bool = True,
        use_gpu: bool = True
    ):
        """
        Initialize WaltzRL trainer.

        Args:
            base_model: HuggingFace model ID for base LLM
            output_dir: Directory to save trained models
            use_fp16: Use FP16 precision for training (faster, less memory)
            use_gpu: Use GPU for training
        """
        self.base_model = base_model
        self.output_dir = Path(output_dir)
        self.use_fp16 = use_fp16
        self.use_gpu = use_gpu

        # Create output directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        (self.output_dir / "stage1").mkdir(exist_ok=True)
        (self.output_dir / "stage2").mkdir(exist_ok=True)

        # Training state
        self.stage1_complete = False
        self.stage2_complete = False

        logger.info(f"WaltzRL Trainer initialized: {base_model}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"FP16: {use_fp16}, GPU: {use_gpu}")

    def train_stage1(
        self,
        safety_dataset_path: str,
        num_epochs: int = 3,
        batch_size: int = 4,
        learning_rate: float = 2e-5,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Stage 1: Train feedback agent on safety datasets.

        Args:
            safety_dataset_path: Path to safety training data
            num_epochs: Training epochs
            batch_size: Batch size
            learning_rate: Learning rate
            **kwargs: Additional training arguments

        Returns:
            Training metrics dict
        """
        logger.info("Starting WaltzRL Stage 1: Feedback Agent Training")

        # Import Stage1Trainer
        from .stage1_trainer import Stage1Trainer

        trainer = Stage1Trainer(
            base_model=self.base_model,
            output_dir=str(self.output_dir / "stage1"),
            use_fp16=self.use_fp16,
            use_gpu=self.use_gpu
        )

        metrics = trainer.train(
            dataset_path=safety_dataset_path,
            num_epochs=num_epochs,
            batch_size=batch_size,
            learning_rate=learning_rate,
            **kwargs
        )

        self.stage1_complete = True
        logger.info("Stage 1 training complete")

        return metrics

    def train_stage2(
        self,
        conversation_model_path: Optional[str] = None,
        feedback_model_path: Optional[str] = None,
        num_epochs: int = 3,
        batch_size: int = 2,
        learning_rate: float = 1e-5,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Stage 2: Joint training with Dynamic Improvement Reward (DIR).

        Args:
            conversation_model_path: Path to conversation model (or use base_model)
            feedback_model_path: Path to feedback model (from Stage 1)
            num_epochs: Training epochs
            batch_size: Batch size (smaller for joint training)
            learning_rate: Learning rate
            **kwargs: Additional training arguments

        Returns:
            Training metrics dict
        """
        if not self.stage1_complete and feedback_model_path is None:
            raise ValueError("Stage 1 must complete before Stage 2, or provide feedback_model_path")

        logger.info("Starting WaltzRL Stage 2: Joint DIR Training")

        # Import Stage2Trainer
        from .stage2_trainer import Stage2Trainer

        # Use Stage 1 output if no custom path provided
        if feedback_model_path is None:
            feedback_model_path = str(self.output_dir / "stage1" / "final")

        trainer = Stage2Trainer(
            conversation_model=conversation_model_path or self.base_model,
            feedback_model=feedback_model_path,
            output_dir=str(self.output_dir / "stage2"),
            use_fp16=self.use_fp16,
            use_gpu=self.use_gpu
        )

        metrics = trainer.train(
            num_epochs=num_epochs,
            batch_size=batch_size,
            learning_rate=learning_rate,
            **kwargs
        )

        self.stage2_complete = True
        logger.info("Stage 2 training complete")

        return metrics

    def full_pipeline(
        self,
        safety_dataset_path: str,
        stage1_epochs: int = 3,
        stage2_epochs: int = 3,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Run complete two-stage WaltzRL training pipeline.

        Args:
            safety_dataset_path: Path to safety training data
            stage1_epochs: Epochs for Stage 1
            stage2_epochs: Epochs for Stage 2
            **kwargs: Additional arguments

        Returns:
            Combined metrics from both stages
        """
        logger.info("Starting WaltzRL Full Pipeline (Stage 1 + Stage 2)")

        # Stage 1
        stage1_metrics = self.train_stage1(
            safety_dataset_path=safety_dataset_path,
            num_epochs=stage1_epochs,
            **kwargs
        )

        # Stage 2
        stage2_metrics = self.train_stage2(
            num_epochs=stage2_epochs,
            **kwargs
        )

        return {
            "stage1": stage1_metrics,
            "stage2": stage2_metrics,
            "output_dir": str(self.output_dir),
            "final_model": str(self.output_dir / "stage2" / "final")
        }


class Stage1Trainer:
    """Stage 1: Feedback agent training (placeholder for actual implementation)."""

    def __init__(self, base_model: str, output_dir: str, use_fp16: bool, use_gpu: bool):
        # Import actual Stage1Trainer from waltzrl_rlt_trainer.py
        logger.warning("Stage1Trainer: Using placeholder implementation")
        # In production, this would import from infrastructure/waltzrl_rlt_trainer.py

    def train(self, **kwargs):
        logger.warning("Stage1Trainer.train(): Not implemented, using placeholder")
        return {"placeholder": True}


class Stage2Trainer:
    """Stage 2: Joint DIR training (placeholder for actual implementation)."""

    def __init__(self, conversation_model: str, feedback_model: str, output_dir: str, use_fp16: bool, use_gpu: bool):
        # Import actual Stage2Trainer from waltzrl_stage2_trainer.py
        logger.warning("Stage2Trainer: Using placeholder implementation")
        # In production, this would import from infrastructure/waltzrl_stage2_trainer.py

    def train(self, **kwargs):
        logger.warning("Stage2Trainer.train(): Not implemented, using placeholder")
        return {"placeholder": True}


# For backward compatibility, expose old module names
try:
    # Try to import actual trainers if they exist
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from waltzrl_rlt_trainer import WaltzRLRLTTrainer as _Stage1Trainer
    from waltzrl_stage2_trainer import WaltzRLStage2Trainer as _Stage2Trainer
    Stage1Trainer = _Stage1Trainer
    Stage2Trainer = _Stage2Trainer
    logger.info("Loaded production WaltzRL trainers")
except ImportError:
    logger.warning("Production WaltzRL trainers not found, using placeholders")
