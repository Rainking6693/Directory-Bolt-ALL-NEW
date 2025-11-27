"""Evolution Strategies module for LoRA adapter optimization.

This module implements Evolution Strategies (ES) for optimizing LoRA adapters
on Llama-3.1-8B models. ES is a memory-efficient alternative to RLHF/GRPO for
model fine-tuning.

Key Components:
- model_loader: Load/save LoRA adapters (safetensors format)
- es_optimizer: Evolution Strategies optimization loop
- fitness: Fitness functions for agent task performance

References:
- ES Model Format Spec: docs/ES_MODEL_FORMAT_SPEC.md
- Integration Roadmap: INTEGRATION_ROADMAP_DEEPAGENTS_SKYVERN_ES.md (lines 875-1265)
"""

__version__ = "1.0.0"

__all__ = [
    "load_model_with_lora",
    "save_lora_adapter",
    "load_lora_params",
    "save_lora_params",
    "flatten_lora_params",
    "unflatten_lora_params",
]
