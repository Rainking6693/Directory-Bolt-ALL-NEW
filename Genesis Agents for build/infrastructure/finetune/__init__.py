"""
Fine-tuning infrastructure for Genesis agents

Includes:
- Unsloth QLoRA 4-bit fine-tuning pipeline
- CaseBank dataset conversion
- Resource management and job scheduling
"""

from .unsloth_pipeline import (
    UnslothPipeline,
    QLoRAConfig,
    TrainingResult,
    load_model_4bit,
    get_unsloth_pipeline
)

from .casebank_to_dataset import (
    CaseBankDatasetConverter,
    load_casebank_for_agent,
    convert_to_training_format,
    split_train_val
)

__all__ = [
    'UnslothPipeline',
    'QLoRAConfig',
    'TrainingResult',
    'load_model_4bit',
    'get_unsloth_pipeline',
    'CaseBankDatasetConverter',
    'load_casebank_for_agent',
    'convert_to_training_format',
    'split_train_val',
]
