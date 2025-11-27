"""
CaseBank to Dataset Converter for Fine-Tuning

Converts Genesis CaseBank memory (JSONL format) to HuggingFace Dataset format
for Unsloth fine-tuning pipeline.

Features:
- Load cases filtered by agent
- Convert to chat format for instruction tuning
- Filter by reward quality (only high-quality examples)
- Train/val split with stratification
- Support for multiple chat templates
"""

import logging
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

from datasets import Dataset
import numpy as np

# Genesis infrastructure
from infrastructure import get_logger
from infrastructure.casebank import Case, CaseBank, get_casebank
from infrastructure.security_utils import redact_credentials

logger = get_logger(__name__)


@dataclass
class DatasetStats:
    """Statistics for converted dataset"""
    total_cases: int
    train_size: int
    val_size: int
    avg_reward: float
    min_reward: float
    max_reward: float
    avg_state_length: int
    avg_action_length: int


class CaseBankDatasetConverter:
    """
    Convert CaseBank cases to HuggingFace datasets for fine-tuning.

    Workflow:
    1. Load cases from CaseBank (filtered by agent)
    2. Filter by minimum reward threshold
    3. Convert to chat format (instruction + response)
    4. Split into train/val sets
    5. Return HuggingFace Dataset objects
    """

    def __init__(
        self,
        casebank: Optional[CaseBank] = None,
        min_reward: float = 0.7,
        chat_format: str = "default"
    ):
        """
        Initialize converter.

        Args:
            casebank: CaseBank instance (creates default if None)
            min_reward: Minimum reward threshold for inclusion
            chat_format: Chat template format (default, alpaca, chatml)
        """
        self.casebank = casebank or get_casebank()
        self.min_reward = min_reward
        self.chat_format = chat_format

        logger.info(
            f"CaseBankDatasetConverter initialized: "
            f"min_reward={min_reward}, format={chat_format}"
        )

    async def load_cases_for_agent(
        self,
        agent_name: str,
        min_reward: Optional[float] = None
    ) -> List[Case]:
        """
        Load all cases for specific agent with quality filter.

        Args:
            agent_name: Agent name to filter
            min_reward: Minimum reward threshold (uses self.min_reward if None)

        Returns:
            List of Case objects
        """
        if min_reward is None:
            min_reward = self.min_reward

        logger.info(f"Loading cases: agent={agent_name}, min_reward={min_reward}")

        # Get all cases for agent
        all_cases = await self.casebank.get_all_cases(agent_filter=agent_name)

        # Filter by reward
        filtered_cases = [
            case for case in all_cases
            if case.reward >= min_reward
        ]

        logger.info(
            f"Loaded {len(filtered_cases)}/{len(all_cases)} cases "
            f"(filtered by reward>={min_reward})"
        )

        return filtered_cases

    def convert_to_chat_format(
        self,
        cases: List[Case],
        chat_format: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        Convert cases to chat format for instruction tuning.

        Args:
            cases: List of Case objects
            chat_format: Chat template (default, alpaca, chatml)

        Returns:
            List of chat-formatted dicts
        """
        if chat_format is None:
            chat_format = self.chat_format

        logger.info(f"Converting {len(cases)} cases to {chat_format} format")

        formatted_examples = []

        for case in cases:
            if chat_format == "alpaca":
                # Alpaca format
                example = self._format_alpaca(case)
            elif chat_format == "chatml":
                # ChatML format
                example = self._format_chatml(case)
            else:
                # Default format
                example = self._format_default(case)

            formatted_examples.append(example)

        logger.info(f"Converted {len(formatted_examples)} examples")
        return formatted_examples

    def _format_default(self, case: Case) -> Dict[str, str]:
        """Format case as default instruction-response pair"""
        return {
            "text": f"### Instruction:\n{case.state}\n\n### Response:\n{case.action}",
            "instruction": case.state,
            "response": case.action,
            "reward": case.reward,
            "metadata": json.dumps(case.metadata)
        }

    def _format_alpaca(self, case: Case) -> Dict[str, str]:
        """Format case as Alpaca template"""
        prompt = (
            f"Below is an instruction that describes a task. "
            f"Write a response that appropriately completes the request.\n\n"
            f"### Instruction:\n{case.state}\n\n### Response:\n{case.action}"
        )
        return {
            "text": prompt,
            "instruction": case.state,
            "response": case.action,
            "reward": case.reward,
            "metadata": json.dumps(case.metadata)
        }

    def _format_chatml(self, case: Case) -> Dict[str, str]:
        """Format case as ChatML template"""
        prompt = (
            f"<|im_start|>user\n{case.state}<|im_end|>\n"
            f"<|im_start|>assistant\n{case.action}<|im_end|>"
        )
        return {
            "text": prompt,
            "instruction": case.state,
            "response": case.action,
            "reward": case.reward,
            "metadata": json.dumps(case.metadata)
        }

    def split_train_val(
        self,
        examples: List[Dict[str, Any]],
        val_ratio: float = 0.1,
        stratify_by_reward: bool = True,
        random_seed: int = 42
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Split examples into train and validation sets.

        Args:
            examples: List of formatted examples
            val_ratio: Validation set ratio (default 0.1)
            stratify_by_reward: Stratify split by reward bins
            random_seed: Random seed for reproducibility

        Returns:
            Tuple of (train_examples, val_examples)
        """
        logger.info(
            f"Splitting {len(examples)} examples: "
            f"val_ratio={val_ratio}, stratify={stratify_by_reward}"
        )

        np.random.seed(random_seed)

        if stratify_by_reward and len(examples) >= 10:
            # Stratified split by reward quartiles
            rewards = np.array([ex["reward"] for ex in examples])
            quartiles = np.percentile(rewards, [25, 50, 75])

            # Assign to bins
            bins = np.digitize(rewards, quartiles)

            # Split within each bin
            train_examples = []
            val_examples = []

            for bin_idx in range(4):
                bin_examples = [
                    ex for i, ex in enumerate(examples)
                    if bins[i] == bin_idx
                ]

                if not bin_examples:
                    continue

                # Shuffle and split
                np.random.shuffle(bin_examples)
                val_size = max(1, int(len(bin_examples) * val_ratio))

                val_examples.extend(bin_examples[:val_size])
                train_examples.extend(bin_examples[val_size:])

        else:
            # Simple random split
            indices = np.arange(len(examples))
            np.random.shuffle(indices)

            val_size = max(1, int(len(examples) * val_ratio))

            val_examples = [examples[i] for i in indices[:val_size]]
            train_examples = [examples[i] for i in indices[val_size:]]

        logger.info(
            f"Split complete: train={len(train_examples)}, val={len(val_examples)}"
        )

        return train_examples, val_examples

    def create_dataset(
        self,
        examples: List[Dict[str, Any]]
    ) -> Dataset:
        """
        Create HuggingFace Dataset from examples.

        Args:
            examples: List of formatted examples

        Returns:
            HuggingFace Dataset
        """
        logger.info(f"Creating HuggingFace Dataset with {len(examples)} examples")

        dataset = Dataset.from_list(examples)

        logger.info(f"Dataset created: {len(dataset)} examples, columns={dataset.column_names}")
        return dataset

    def compute_statistics(
        self,
        train_examples: List[Dict[str, Any]],
        val_examples: List[Dict[str, Any]]
    ) -> DatasetStats:
        """
        Compute dataset statistics.

        Args:
            train_examples: Training examples
            val_examples: Validation examples

        Returns:
            DatasetStats object
        """
        all_examples = train_examples + val_examples

        rewards = [ex["reward"] for ex in all_examples]
        state_lengths = [len(ex["instruction"]) for ex in all_examples]
        action_lengths = [len(ex["response"]) for ex in all_examples]

        stats = DatasetStats(
            total_cases=len(all_examples),
            train_size=len(train_examples),
            val_size=len(val_examples),
            avg_reward=float(np.mean(rewards)),
            min_reward=float(np.min(rewards)),
            max_reward=float(np.max(rewards)),
            avg_state_length=int(np.mean(state_lengths)),
            avg_action_length=int(np.mean(action_lengths))
        )

        logger.info(
            f"Dataset stats: total={stats.total_cases}, "
            f"train={stats.train_size}, val={stats.val_size}, "
            f"avg_reward={stats.avg_reward:.3f}"
        )

        return stats

    async def convert_agent_to_dataset(
        self,
        agent_name: str,
        val_ratio: float = 0.1,
        min_reward: Optional[float] = None,
        chat_format: Optional[str] = None
    ) -> Tuple[Dataset, Dataset, DatasetStats]:
        """
        Complete pipeline: load cases and convert to train/val datasets.

        Args:
            agent_name: Agent name to load cases for
            val_ratio: Validation set ratio
            min_reward: Minimum reward threshold
            chat_format: Chat template format

        Returns:
            Tuple of (train_dataset, val_dataset, stats)
        """
        logger.info(
            f"Converting CaseBank → Dataset: agent={agent_name}, "
            f"val_ratio={val_ratio}"
        )

        # Load cases
        cases = await self.load_cases_for_agent(agent_name, min_reward)

        if not cases:
            raise ValueError(f"No cases found for agent={agent_name} with min_reward={min_reward}")

        # Convert to chat format
        examples = self.convert_to_chat_format(cases, chat_format)

        # Split train/val
        train_examples, val_examples = self.split_train_val(examples, val_ratio)

        # Create datasets
        train_dataset = self.create_dataset(train_examples)
        val_dataset = self.create_dataset(val_examples)

        # Compute statistics
        stats = self.compute_statistics(train_examples, val_examples)

        logger.info(
            f"Conversion complete: train={len(train_dataset)}, "
            f"val={len(val_dataset)}"
        )

        return train_dataset, val_dataset, stats


# Convenience functions

async def load_casebank_for_agent(
    agent_name: str,
    min_reward: float = 0.7,
    casebank: Optional[CaseBank] = None
) -> List[Case]:
    """
    Convenience function to load cases for agent.

    Args:
        agent_name: Agent name
        min_reward: Minimum reward threshold
        casebank: CaseBank instance (creates default if None)

    Returns:
        List of Case objects
    """
    converter = CaseBankDatasetConverter(casebank=casebank, min_reward=min_reward)
    return await converter.load_cases_for_agent(agent_name, min_reward)


def convert_to_training_format(
    cases: List[Case],
    chat_format: str = "default"
) -> List[Dict[str, str]]:
    """
    Convenience function to convert cases to training format.

    Args:
        cases: List of Case objects
        chat_format: Chat template format

    Returns:
        List of formatted examples
    """
    converter = CaseBankDatasetConverter(chat_format=chat_format)
    return converter.convert_to_chat_format(cases, chat_format)


def split_train_val(
    examples: List[Dict[str, Any]],
    val_ratio: float = 0.1,
    stratify: bool = True
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Convenience function to split train/val.

    Args:
        examples: List of formatted examples
        val_ratio: Validation ratio
        stratify: Use stratified split

    Returns:
        Tuple of (train_examples, val_examples)
    """
    converter = CaseBankDatasetConverter()
    return converter.split_train_val(examples, val_ratio, stratify)


if __name__ == "__main__":
    import asyncio

    async def main():
        logger.info("CaseBank to Dataset Converter - Example Usage")

        # Initialize converter
        converter = CaseBankDatasetConverter(min_reward=0.7, chat_format="default")

        # Example: Convert legal_agent cases
        try:
            train_ds, val_ds, stats = await converter.convert_agent_to_dataset(
                agent_name="legal_agent",
                val_ratio=0.1
            )

            print("\n" + "="*60)
            print("DATASET CONVERSION COMPLETE")
            print("="*60)
            print(f"Total cases: {stats.total_cases}")
            print(f"Train size: {stats.train_size}")
            print(f"Val size: {stats.val_size}")
            print(f"Avg reward: {stats.avg_reward:.3f}")
            print(f"Avg instruction length: {stats.avg_state_length} chars")
            print(f"Avg response length: {stats.avg_action_length} chars")

            print("\nExample from train dataset:")
            if len(train_ds) > 0:
                print(train_ds[0]["text"][:200] + "...")

        except ValueError as e:
            logger.warning(f"No data available: {e}")
            print("\nNote: Run agents to populate CaseBank before conversion")

    asyncio.run(main())
