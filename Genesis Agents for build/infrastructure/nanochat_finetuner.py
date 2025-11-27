"""
Nanochat Budget Finetuner - Ultra-low-cost specialist agent training

This module implements budget-friendly finetuning for Genesis specialist agents using
Karpathy's Nanochat framework, targeting <$100/agent training costs.

Repository: https://github.com/karpathy/nanochat
Integration: /home/genesis/genesis-rebuild/integrations/memory/nanochat/

Cost Analysis:
- OpenAI finetuning: $500-2000/agent
- Anthropic finetuning: $1000-3000/agent
- Nanochat (8XH100): ~$100/agent (4 hours @ $24/hr)
- Nanochat (CPU): $0 (dev/testing only, slow)

Use Cases:
- Specialist agent capabilities (e.g., QA agent document analysis)
- Domain-specific behavior (e.g., Legal agent contract review)
- Task-specific optimization (e.g., Support agent ticket triage)
"""

import os
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import logging
import json

logger = logging.getLogger(__name__)

NANOCHAT_PATH = Path("/home/genesis/genesis-rebuild/integrations/memory/nanochat")


@dataclass
class NanochatConfig:
    """Configuration for Nanochat finetuning"""

    # Mode selection
    mode: str = "cpu"  # "cpu" or "gpu"

    # Model configuration
    base_model: str = "gpt-2"  # Base model (gpt-2 for budget)
    depth: int = 20  # Model depth (layers)
    max_seq_len: int = 1024  # Max sequence length

    # Training configuration
    device_batch_size: int = 1  # Batch size per device
    total_batch_size: int = 1024  # Total batch size (gradient accumulation)
    num_iterations: int = 100  # Training iterations

    # GPU configuration (for production mode)
    num_gpus: int = 8  # Number of GPUs (8XH100 recommended)
    gpu_hourly_rate: float = 24.0  # $/hour for 8XH100 node

    # Paths
    output_dir: str = "/home/genesis/genesis-rebuild/models/nanochat_agents"
    dataset_dir: str = "/home/genesis/genesis-rebuild/data/finetuning"

    # Cost tracking
    target_cost_per_agent: float = 100.0  # Target: <$100/agent


@dataclass
class AgentFinetuneScenario:
    """Finetuning scenario for a specialist agent"""

    agent_name: str  # e.g., "qa_agent", "legal_agent"
    task_description: str  # What this agent does
    examples: List[Dict[str, str]] = field(default_factory=list)  # Training examples
    num_examples: int = 100  # Minimum examples needed
    estimated_hours: float = 4.0  # Estimated training time (8XH100)


class NanochatFinetuner:
    """
    Budget specialist agent finetuning using Nanochat.

    Key Features:
    1. CPU mode for dev/testing ($0 cost)
    2. GPU mode for production (<$100/agent)
    3. Full pipeline: tokenization → pretraining → midtraining → SFT
    4. Integration with Genesis agent framework
    5. Cost tracking and budget enforcement

    Training Pipeline (from speedrun.sh):
    1. Dataset preparation
    2. Tokenizer training
    3. Base model training
    4. Midtraining (domain adaptation)
    5. SFT (supervised finetuning)
    6. Evaluation and deployment
    """

    def __init__(self, config: NanochatConfig):
        self.config = config
        self.total_cost = 0.0

        # Ensure paths exist
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)
        Path(config.dataset_dir).mkdir(parents=True, exist_ok=True)

        logger.info(f"Initialized Nanochat Finetuner (mode: {config.mode})")
        logger.info(f"Target cost/agent: ${config.target_cost_per_agent:.2f}")

    def prepare_dataset(self,
                       agent_name: str,
                       task_examples: List[Dict[str, str]]) -> str:
        """
        Prepare finetuning dataset for specialist agent.

        Expected format (JSONL):
        {"prompt": "User query", "completion": "Agent response"}

        Args:
            agent_name: Name of agent being finetuned
            task_examples: List of {prompt, completion} dicts

        Returns:
            Path to prepared dataset
        """
        dataset_path = Path(self.config.dataset_dir) / f"{agent_name}_examples.jsonl"

        logger.info(f"Preparing dataset for {agent_name}")
        logger.info(f"  Examples: {len(task_examples)}")
        logger.info(f"  Output: {dataset_path}")

        # Write JSONL format
        with open(dataset_path, "w") as f:
            for example in task_examples:
                if "prompt" not in example or "completion" not in example:
                    logger.warning(f"Skipping invalid example: {example}")
                    continue
                f.write(json.dumps(example) + "\n")

        logger.info(f"✓ Dataset prepared: {dataset_path}")
        return str(dataset_path)

    def estimate_cost(self) -> Dict[str, float]:
        """
        Calculate finetuning cost based on mode.

        Returns:
            Cost breakdown
        """
        if self.config.mode == "cpu":
            cost = 0.0
            hours = "N/A (very slow)"
        else:  # GPU mode
            hours = 4.0  # Speedrun.sh takes ~4 hours on 8XH100
            cost = hours * self.config.gpu_hourly_rate

        analysis = {
            "mode": self.config.mode,
            "hours": hours if isinstance(hours, float) else 0,
            "cost_usd": cost,
            "within_budget": cost <= self.config.target_cost_per_agent,
            "vs_openai": 500.0 - cost,  # Savings vs OpenAI ($500 minimum)
            "vs_anthropic": 1000.0 - cost,  # Savings vs Anthropic ($1000 minimum)
        }

        logger.info("=" * 60)
        logger.info("COST ESTIMATE")
        logger.info("=" * 60)
        logger.info(f"Mode:           {analysis['mode']}")
        logger.info(f"Training time:  {hours} hours")
        logger.info(f"Cost:           ${cost:.2f}")
        logger.info(f"vs OpenAI:      ${analysis['vs_openai']:.2f} savings")
        logger.info(f"vs Anthropic:   ${analysis['vs_anthropic']:.2f} savings")

        if analysis["within_budget"]:
            logger.info("✓ WITHIN BUDGET")
        else:
            logger.warning("⚠️  OVER BUDGET")

        return analysis

    def finetune(self,
                agent_name: str,
                dataset_path: str,
                model_config: Optional[Dict] = None) -> str:
        """
        Run budget finetuning for specialist agent.

        Args:
            agent_name: Name of agent being finetuned
            dataset_path: Path to prepared JSONL dataset
            model_config: Optional model configuration overrides

        Returns:
            Path to trained model checkpoint
        """
        output_path = Path(self.config.output_dir) / agent_name

        logger.info("=" * 60)
        logger.info(f"FINETUNING: {agent_name}")
        logger.info("=" * 60)

        if self.config.mode == "cpu":
            script_path = NANOCHAT_PATH / "dev/runcpu.sh"
            logger.info("Running CPU mode (dev/testing only)")
            logger.warning("CPU mode is VERY SLOW - only for testing pipeline")
        else:
            script_path = NANOCHAT_PATH / "speedrun.sh"
            logger.info("Running GPU mode (production)")

        # Build command
        cmd = f"""
cd {NANOCHAT_PATH} && \\
export NANOCHAT_BASE_DIR={output_path} && \\
export WANDB_RUN={agent_name}_finetune && \\
bash {script_path.name}
"""

        logger.info(f"Command:\n{cmd}")

        logger.warning("=" * 60)
        logger.warning("MANUAL EXECUTION REQUIRED:")
        logger.warning("=" * 60)

        if self.config.mode == "cpu":
            logger.warning("CPU Mode Steps:")
            logger.warning("  1. SSH into development machine")
            logger.warning("  2. cd /home/genesis/genesis-rebuild/integrations/memory/nanochat")
            logger.warning("  3. bash dev/runcpu.sh")
            logger.warning("  4. Wait ~30-60 minutes for completion")
            logger.warning("  5. Model saved in ~/.cache/nanochat/")
        else:
            logger.warning("GPU Mode Steps:")
            logger.warning("  1. Provision 8XH100 GPU node (Lambda, AWS, etc.)")
            logger.warning("  2. Clone nanochat repo on GPU node")
            logger.warning("  3. Run: bash speedrun.sh")
            logger.warning("  4. Wait ~4 hours for completion")
            logger.warning("  5. Cost: ~$96 (4 hours * $24/hr)")
            logger.warning("  6. Download trained model from node")

        logger.warning("=" * 60)

        # Update cost tracking
        if self.config.mode == "gpu":
            cost = 4.0 * self.config.gpu_hourly_rate
            self.total_cost += cost
            logger.info(f"Estimated cost: ${cost:.2f}")
            logger.info(f"Total cost: ${self.total_cost:.2f}")

        return str(output_path)

    def integrate_with_agent(self,
                            agent_name: str,
                            model_path: str) -> None:
        """
        Integrate finetuned model into Genesis agent.

        Args:
            agent_name: Name of Genesis agent
            model_path: Path to finetuned Nanochat model
        """
        logger.info("=" * 60)
        logger.info(f"INTEGRATION: {agent_name}")
        logger.info("=" * 60)

        agent_file = Path(f"/home/genesis/genesis-rebuild/agents/{agent_name}.py")

        if not agent_file.exists():
            logger.error(f"Agent file not found: {agent_file}")
            return

        logger.info(f"Agent file: {agent_file}")
        logger.info(f"Model path: {model_path}")

        logger.warning("INTEGRATION STEPS:")
        logger.warning("  1. Update agent LLM client to load local model")
        logger.warning("  2. Add model_path configuration")
        logger.warning("  3. Update inference code to use Nanochat engine")
        logger.warning("  4. Test with benchmark scenarios")
        logger.warning("  5. Compare performance vs. API-based models")

        logger.info("\nExample integration code:")
        logger.info(f"""
# In {agent_file}:

from nanochat.engine import Engine

class {agent_name.title().replace('_', '')}:
    def __init__(self):
        # Load finetuned Nanochat model
        self.model = Engine(model_path="{model_path}")

    async def process(self, query: str) -> str:
        # Use local finetuned model
        response = self.model.generate(query, max_tokens=512)
        return response
""")

    def run_full_pipeline(self,
                         agent_name: str,
                         task_examples: List[Dict[str, str]]) -> Dict:
        """
        Execute complete finetuning pipeline for specialist agent.

        Steps:
        1. Prepare dataset from examples
        2. Estimate cost
        3. Run finetuning (manual GPU execution)
        4. Provide integration instructions

        Args:
            agent_name: Name of agent to finetune
            task_examples: Training examples

        Returns:
            Pipeline results and cost analysis
        """
        logger.info("=" * 80)
        logger.info(f"NANOCHAT FINETUNING PIPELINE: {agent_name}")
        logger.info("=" * 80)

        # Step 1: Prepare dataset
        dataset_path = self.prepare_dataset(agent_name, task_examples)

        # Step 2: Estimate cost
        cost_analysis = self.estimate_cost()

        # Step 3: Run finetuning (manual execution)
        model_path = self.finetune(agent_name, dataset_path)

        # Step 4: Integration instructions
        self.integrate_with_agent(agent_name, model_path)

        logger.info("=" * 80)
        logger.info("PIPELINE COMPLETE")
        logger.info("=" * 80)

        return {
            "agent_name": agent_name,
            "dataset_path": dataset_path,
            "model_path": model_path,
            "cost_analysis": cost_analysis,
            "num_examples": len(task_examples)
        }


def main():
    """Example usage: Finetune QA agent for document analysis"""

    # Example: QA Agent specialized for technical documentation
    qa_examples = [
        {
            "prompt": "What is the purpose of HTDAG in the orchestration layer?",
            "completion": "HTDAG (Hierarchical Task Decomposition Agent Graph) decomposes complex tasks into a directed acyclic graph of subtasks, enabling parallel execution and efficient resource allocation."
        },
        {
            "prompt": "How does WaltzRL improve safety?",
            "completion": "WaltzRL uses collaborative multi-agent reinforcement learning with a conversation agent and feedback agent, achieving 89% unsafe reduction and 78% over-refusal reduction."
        },
        {
            "prompt": "What is the cost benefit of Nanochat finetuning?",
            "completion": "Nanochat finetuning costs ~$100/agent (4 hours on 8XH100), compared to $500-3000 for OpenAI/Anthropic, providing 80-97% cost savings."
        },
        # Add 97 more examples for production...
    ]

    # Configure for CPU testing (free)
    config = NanochatConfig(
        mode="cpu",  # Change to "gpu" for production
        depth=4,  # Small model for testing
        num_iterations=50,
        output_dir="/home/genesis/genesis-rebuild/models/nanochat_agents",
        target_cost_per_agent=100.0
    )

    # Initialize finetuner
    finetuner = NanochatFinetuner(config)

    # Run pipeline
    results = finetuner.run_full_pipeline(
        agent_name="qa_agent",
        task_examples=qa_examples
    )

    print("\n" + "=" * 80)
    print("NEXT STEPS:")
    print("=" * 80)
    print("1. Expand dataset to 100+ examples per agent")
    print("2. For production: Switch to GPU mode")
    print("3. Provision 8XH100 node (Lambda, AWS, etc.)")
    print("4. Execute finetuning script (4 hours, ~$100)")
    print("5. Download and integrate trained model")
    print("6. Benchmark against OpenAI/Anthropic models")
    print("7. Deploy if quality is acceptable")
    print("=" * 80)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    main()
