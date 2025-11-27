"""
Unsloth QLoRA Fine-Tuning Pipeline for Genesis Agents

Based on:
- Unsloth: https://github.com/unslothai/unsloth
- NVIDIA Blog: https://developer.nvidia.com/blog/train-an-llm-on-an-nvidia-blackwell-desktop-with-unsloth-and-scale-it/

Key Features:
- QLoRA 4-bit quantization (50%+ memory reduction)
- Cheap specialist fine-tuning for 9B models
- Gemini-2-Flash, Qwen-2.5-9B, DeepSeek-R1-9B support
- Adapter export and runtime loading
- Integration with CaseBank training data

Expected Results:
- 4-bit loading reduces memory by 50%+
- 10-20% accuracy improvement on specialized tasks
- <$100 training cost per agent
"""

import logging
import os
import torch
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union

# Unsloth imports
try:
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    HAS_UNSLOTH = True
except ImportError:
    HAS_UNSLOTH = False
    FastLanguageModel = None

# HuggingFace imports
from transformers import TrainingArguments, Trainer
from datasets import Dataset
from trl import SFTTrainer

# Genesis infrastructure
from infrastructure import get_logger
from infrastructure.security_utils import redact_credentials

# OTEL observability
try:
    from opentelemetry import trace
    from opentelemetry.trace import Status, StatusCode
    tracer = trace.get_tracer(__name__)
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    tracer = None

logger = get_logger(__name__)


@dataclass
class QLoRAConfig:
    """
    QLoRA configuration for 4-bit fine-tuning.

    Based on Unsloth best practices:
    - rank=16: Good balance between capacity and speed
    - alpha=32: 2x rank (standard practice)
    - dropout=0.05: Prevent overfitting
    - target_modules: All linear layers for maximum adaptability
    """
    rank: int = 16
    alpha: int = 32
    dropout: float = 0.05
    bias: str = "none"
    target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ])
    use_gradient_checkpointing: bool = True
    random_state: int = 42
    lora_dtype: Optional[torch.dtype] = None
    use_rslora: bool = False  # Rank-stabilized LoRA


@dataclass
class TrainingResult:
    """Result of fine-tuning operation"""
    model_path: str
    adapter_path: str
    training_loss: float
    eval_loss: Optional[float]
    training_time_seconds: float
    peak_memory_mb: float
    num_parameters: int
    num_trainable_parameters: int
    metadata: Dict[str, Any] = field(default_factory=dict)


class UnslothPipeline:
    """
    Unsloth QLoRA pipeline for Genesis specialist agents.

    Workflow:
    1. Load model in 4-bit quantization
    2. Prepare QLoRA configuration
    3. Train with SFT (Supervised Fine-Tuning)
    4. Export adapter weights
    5. Merge and quantize for deployment

    Memory Efficiency:
    - 4-bit quantization: 50-75% memory reduction
    - Gradient checkpointing: Additional 30-40% reduction
    - QLoRA adapters: Only train 0.1-1% of parameters
    """

    # Supported 9B models
    SUPPORTED_MODELS = {
        "gemini-2-flash-9b": "google/gemma-2-9b-it",
        "qwen-2.5-9b": "Qwen/Qwen2.5-9B-Instruct",
        "deepseek-r1-9b": "deepseek-ai/DeepSeek-R1-Distill-Qwen-9B",
    }

    def __init__(
        self,
        output_dir: str = "/home/genesis/genesis-rebuild/models/finetuned_agents",
        enable_otel: bool = True,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize Unsloth pipeline.

        Args:
            output_dir: Directory for saving trained models
            enable_otel: Enable OpenTelemetry tracing
            cache_dir: HuggingFace cache directory
        """
        if not HAS_UNSLOTH:
            raise ImportError(
                "Unsloth not installed. Run: "
                "pip install 'unsloth[cu121] @ git+https://github.com/unslothai/unsloth.git'"
            )

        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.enable_otel = enable_otel and HAS_OTEL
        self.cache_dir = cache_dir

        logger.info(f"Unsloth pipeline initialized: output_dir={output_dir}")

    def load_model_4bit(
        self,
        model_name: str,
        use_gradient_checkpointing: bool = True,
        max_seq_length: int = 2048,
        dtype: Optional[torch.dtype] = None,
        load_in_4bit: bool = True
    ) -> Tuple[Any, Any]:
        """
        Load model with 4-bit quantization.

        Args:
            model_name: Model name (gemini-2-flash-9b, qwen-2.5-9b, deepseek-r1-9b)
            use_gradient_checkpointing: Enable gradient checkpointing
            max_seq_length: Maximum sequence length
            dtype: Data type (None for auto)
            load_in_4bit: Use 4-bit quantization

        Returns:
            Tuple of (model, tokenizer)

        Raises:
            ValueError: If model name not supported
            RuntimeError: If loading fails
        """
        if self.enable_otel and tracer:
            span = tracer.start_span("unsloth.load_model_4bit")
            span.set_attribute("model_name", model_name)
            span.set_attribute("load_in_4bit", load_in_4bit)
        else:
            span = None

        try:
            # Resolve model name
            if model_name in self.SUPPORTED_MODELS:
                hf_model_name = self.SUPPORTED_MODELS[model_name]
            else:
                hf_model_name = model_name

            logger.info(f"Loading model: {hf_model_name} (4-bit: {load_in_4bit})")

            # Load model with Unsloth
            model, tokenizer = FastLanguageModel.from_pretrained(
                model_name=hf_model_name,
                max_seq_length=max_seq_length,
                dtype=dtype,
                load_in_4bit=load_in_4bit,
                cache_dir=self.cache_dir,
            )

            # Enable gradient checkpointing
            if use_gradient_checkpointing:
                model.gradient_checkpointing_enable()
                logger.info("Gradient checkpointing enabled")

            # Log memory stats
            if torch.cuda.is_available():
                memory_allocated = torch.cuda.memory_allocated() / 1024**2  # MB
                memory_reserved = torch.cuda.memory_reserved() / 1024**2  # MB
                logger.info(
                    f"GPU memory: allocated={memory_allocated:.2f}MB, "
                    f"reserved={memory_reserved:.2f}MB"
                )

                if span:
                    span.set_attribute("memory_allocated_mb", memory_allocated)
                    span.set_attribute("memory_reserved_mb", memory_reserved)

            # Count parameters
            total_params = sum(p.numel() for p in model.parameters())
            logger.info(f"Model loaded: {total_params:,} parameters")

            if span:
                span.set_attribute("total_parameters", total_params)
                span.set_status(Status(StatusCode.OK))

            return model, tokenizer

        except Exception as e:
            logger.error(f"Model loading failed: {e}", exc_info=True)
            if span:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
            raise
        finally:
            if span:
                span.end()

    def prepare_qlora_config(
        self,
        rank: int = 16,
        alpha: int = 32,
        dropout: float = 0.05,
        **kwargs
    ) -> QLoRAConfig:
        """
        Prepare QLoRA configuration.

        Args:
            rank: LoRA rank (default 16)
            alpha: LoRA alpha (default 32 = 2*rank)
            dropout: LoRA dropout (default 0.05)
            **kwargs: Additional QLoRA parameters

        Returns:
            QLoRAConfig instance
        """
        config = QLoRAConfig(
            rank=rank,
            alpha=alpha,
            dropout=dropout,
            **kwargs
        )

        logger.info(
            f"QLoRA config: rank={config.rank}, alpha={config.alpha}, "
            f"dropout={config.dropout}, target_modules={len(config.target_modules)}"
        )

        return config

    def prepare_model_for_training(
        self,
        model: Any,
        qlora_config: QLoRAConfig
    ) -> Any:
        """
        Prepare model with QLoRA adapters.

        Args:
            model: Base model
            qlora_config: QLoRA configuration

        Returns:
            Model with QLoRA adapters attached
        """
        logger.info("Preparing model for QLoRA training")

        # Add QLoRA adapters
        model = FastLanguageModel.get_peft_model(
            model,
            r=qlora_config.rank,
            lora_alpha=qlora_config.alpha,
            lora_dropout=qlora_config.dropout,
            bias=qlora_config.bias,
            target_modules=qlora_config.target_modules,
            use_gradient_checkpointing=qlora_config.use_gradient_checkpointing,
            random_state=qlora_config.random_state,
            use_rslora=qlora_config.use_rslora,
            loftq_config=None,
        )

        # Count trainable parameters
        trainable_params = sum(
            p.numel() for p in model.parameters() if p.requires_grad
        )
        total_params = sum(p.numel() for p in model.parameters())
        trainable_ratio = trainable_params / total_params * 100

        logger.info(
            f"Trainable parameters: {trainable_params:,} / {total_params:,} "
            f"({trainable_ratio:.2f}%)"
        )

        return model

    def train(
        self,
        model: Any,
        tokenizer: Any,
        dataset: Dataset,
        qlora_config: QLoRAConfig,
        training_args: Optional[TrainingArguments] = None,
        output_dir: Optional[str] = None,
        agent_name: Optional[str] = None
    ) -> TrainingResult:
        """
        Train model with QLoRA.

        Args:
            model: Model with QLoRA adapters
            tokenizer: Tokenizer
            dataset: Training dataset
            qlora_config: QLoRA configuration
            training_args: Training arguments (uses defaults if None)
            output_dir: Output directory (uses self.output_dir if None)
            agent_name: Agent name for tracking

        Returns:
            TrainingResult with training metrics
        """
        if self.enable_otel and tracer:
            span = tracer.start_span("unsloth.train")
            if agent_name:
                span.set_attribute("agent_name", agent_name)
            span.set_attribute("dataset_size", len(dataset))
        else:
            span = None

        try:
            import time
            start_time = time.time()

            # Set output directory
            if output_dir is None:
                output_dir = self.output_dir / (agent_name or "default")
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            logger.info(f"Training started: agent={agent_name}, dataset_size={len(dataset)}")

            # Default training arguments
            if training_args is None:
                training_args = TrainingArguments(
                    output_dir=str(output_path),
                    per_device_train_batch_size=2,
                    gradient_accumulation_steps=4,
                    warmup_steps=10,
                    max_steps=100,
                    learning_rate=2e-4,
                    fp16=not torch.cuda.is_bf16_supported(),
                    bf16=torch.cuda.is_bf16_supported(),
                    logging_steps=10,
                    optim="adamw_8bit",
                    weight_decay=0.01,
                    lr_scheduler_type="linear",
                    seed=qlora_config.random_state,
                    save_strategy="steps",
                    save_steps=50,
                    eval_strategy="no",  # No eval by default
                )

            # Create trainer
            trainer = SFTTrainer(
                model=model,
                tokenizer=tokenizer,
                train_dataset=dataset,
                args=training_args,
                max_seq_length=2048,
                dataset_text_field="text",  # Assumes dataset has "text" field
                packing=False,  # Set True for efficiency on short sequences
            )

            # Train
            logger.info("Starting training loop")
            train_result = trainer.train()

            # Save model
            model.save_pretrained(str(output_path / "final_model"))
            tokenizer.save_pretrained(str(output_path / "final_model"))

            # Training metrics
            training_time = time.time() - start_time
            training_loss = train_result.training_loss

            # Memory stats
            if torch.cuda.is_available():
                peak_memory = torch.cuda.max_memory_allocated() / 1024**2  # MB
            else:
                peak_memory = 0.0

            # Parameter counts
            total_params = sum(p.numel() for p in model.parameters())
            trainable_params = sum(
                p.numel() for p in model.parameters() if p.requires_grad
            )

            result = TrainingResult(
                model_path=str(output_path / "final_model"),
                adapter_path=str(output_path / "final_model"),
                training_loss=training_loss,
                eval_loss=None,
                training_time_seconds=training_time,
                peak_memory_mb=peak_memory,
                num_parameters=total_params,
                num_trainable_parameters=trainable_params,
                metadata={
                    "agent_name": agent_name,
                    "dataset_size": len(dataset),
                    "qlora_rank": qlora_config.rank,
                    "qlora_alpha": qlora_config.alpha,
                }
            )

            logger.info(
                f"Training complete: loss={training_loss:.4f}, "
                f"time={training_time:.2f}s, peak_memory={peak_memory:.2f}MB"
            )

            if span:
                span.set_attribute("training_loss", training_loss)
                span.set_attribute("training_time_seconds", training_time)
                span.set_attribute("peak_memory_mb", peak_memory)
                span.set_status(Status(StatusCode.OK))

            return result

        except Exception as e:
            logger.error(f"Training failed: {e}", exc_info=True)
            if span:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
            raise
        finally:
            if span:
                span.end()

    def export_adapter(
        self,
        model: Any,
        output_path: str
    ) -> str:
        """
        Export QLoRA adapter weights.

        Args:
            model: Model with trained adapters
            output_path: Output path for adapter

        Returns:
            Path to exported adapter
        """
        logger.info(f"Exporting adapter to: {output_path}")

        output_path = Path(output_path)
        output_path.mkdir(parents=True, exist_ok=True)

        # Save adapter
        model.save_pretrained(str(output_path))

        logger.info(f"Adapter exported: {output_path}")
        return str(output_path)

    def merge_and_quantize(
        self,
        model: Any,
        tokenizer: Any,
        adapter_path: str,
        output_path: str,
        quantization_method: str = "q4_k_m"
    ) -> str:
        """
        Merge adapter with base model and quantize for deployment.

        Args:
            model: Base model
            tokenizer: Tokenizer
            adapter_path: Path to adapter weights
            output_path: Output path for merged model
            quantization_method: Quantization method (q4_k_m, q8_0, etc.)

        Returns:
            Path to merged and quantized model
        """
        logger.info(
            f"Merging adapter and quantizing: "
            f"adapter={adapter_path}, method={quantization_method}"
        )

        output_path = Path(output_path)
        output_path.mkdir(parents=True, exist_ok=True)

        # Merge adapter into base model
        model = FastLanguageModel.merge_and_unload(model)

        # Save merged model
        model.save_pretrained(str(output_path))
        tokenizer.save_pretrained(str(output_path))

        # Optional: Save as GGUF for llama.cpp deployment
        try:
            model.save_pretrained_gguf(
                str(output_path / "gguf"),
                tokenizer,
                quantization_method=quantization_method
            )
            logger.info(f"GGUF model saved: {output_path}/gguf")
        except Exception as e:
            logger.warning(f"GGUF export failed (optional): {e}")

        logger.info(f"Merged model saved: {output_path}")
        return str(output_path)

    def estimate_memory_usage(
        self,
        model_name: str,
        batch_size: int = 2,
        sequence_length: int = 2048,
        qlora_rank: int = 16
    ) -> Dict[str, float]:
        """
        Estimate memory usage for fine-tuning.

        Args:
            model_name: Model name
            batch_size: Training batch size
            sequence_length: Sequence length
            qlora_rank: QLoRA rank

        Returns:
            Dict with memory estimates (MB)
        """
        # Rough estimates for 9B models
        base_model_4bit = 4500  # MB for 4-bit 9B model
        gradients = 1000  # MB for gradient storage
        optimizer = 500  # MB for AdamW 8-bit
        activations = (batch_size * sequence_length * 512) / 1024**2  # MB
        qlora_adapters = (qlora_rank * 512 * 2) / 1024**2  # MB

        total = base_model_4bit + gradients + optimizer + activations + qlora_adapters

        estimates = {
            "base_model_4bit_mb": base_model_4bit,
            "gradients_mb": gradients,
            "optimizer_mb": optimizer,
            "activations_mb": activations,
            "qlora_adapters_mb": qlora_adapters,
            "total_estimated_mb": total,
            "total_estimated_gb": total / 1024
        }

        logger.info(
            f"Memory estimate: {total:.2f}MB ({total/1024:.2f}GB) for "
            f"{model_name}, batch_size={batch_size}, seq_len={sequence_length}"
        )

        return estimates


# Factory function
def get_unsloth_pipeline(
    output_dir: str = "/home/genesis/genesis-rebuild/models/finetuned_agents",
    **kwargs
) -> UnslothPipeline:
    """
    Factory function to create Unsloth pipeline.

    Args:
        output_dir: Output directory for models
        **kwargs: Additional UnslothPipeline parameters

    Returns:
        UnslothPipeline instance
    """
    return UnslothPipeline(output_dir=output_dir, **kwargs)


# Convenience function
def load_model_4bit(
    model_name: str,
    use_gradient_checkpointing: bool = True,
    **kwargs
) -> Tuple[Any, Any]:
    """
    Convenience function to load model in 4-bit.

    Args:
        model_name: Model name
        use_gradient_checkpointing: Enable gradient checkpointing
        **kwargs: Additional loading parameters

    Returns:
        Tuple of (model, tokenizer)
    """
    pipeline = get_unsloth_pipeline()
    return pipeline.load_model_4bit(
        model_name=model_name,
        use_gradient_checkpointing=use_gradient_checkpointing,
        **kwargs
    )


if __name__ == "__main__":
    # Example usage
    logger.info("Unsloth Pipeline - Example Usage")

    # Initialize pipeline
    pipeline = get_unsloth_pipeline()

    # Estimate memory
    estimates = pipeline.estimate_memory_usage(
        model_name="gemini-2-flash-9b",
        batch_size=2,
        sequence_length=2048,
        qlora_rank=16
    )

    print("\n" + "="*60)
    print("MEMORY ESTIMATES")
    print("="*60)
    for key, value in estimates.items():
        print(f"{key}: {value:.2f}")

    print("\nTo run fine-tuning:")
    print("1. Load model: model, tokenizer = pipeline.load_model_4bit('gemini-2-flash-9b')")
    print("2. Prepare QLoRA: qlora_config = pipeline.prepare_qlora_config()")
    print("3. Add adapters: model = pipeline.prepare_model_for_training(model, qlora_config)")
    print("4. Train: result = pipeline.train(model, tokenizer, dataset, qlora_config)")
