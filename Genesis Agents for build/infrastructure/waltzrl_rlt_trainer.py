"""
WaltzRL RLT Trainer - Cost-effective training using Reinforcement-Learned Teachers

This module implements budget-friendly training for WaltzRL safety agents using the
Sakana AI RLT (Reinforcement-Learned Teachers) approach, targeting <$10k training costs
vs. $100k baseline approaches.

Research: https://arxiv.org/abs/2506.08388 (Sakana AI, 2025)
Integration: /home/genesis/genesis-rebuild/integrations/evolution/RLT/

Cost Analysis:
- Baseline training (full RL): ~$100,000 (8XH100 for multiple days)
- RLT teacher approach: ~$10,000 (90% cost reduction)
- Target: Train WaltzRL feedback agents efficiently for Genesis safety layer
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

# Add RLT to path
RLT_PATH = Path("/home/genesis/genesis-rebuild/integrations/evolution/RLT")
sys.path.insert(0, str(RLT_PATH))

logger = logging.getLogger(__name__)


@dataclass
class RLTTrainingConfig:
    """Configuration for RLT training pipeline"""

    # Model configuration
    base_model: str = "Qwen/Qwen2.5-7B-Instruct"  # Default from RLT
    model_size: str = "7B"  # 7B or 32B

    # Training phases
    sft_warmup_steps: int = 1000  # Supervised warm-up
    rl_training_steps: int = 5000  # RL phase

    # Hardware configuration
    num_gpus: int = 8  # 8XH100 recommended
    num_vllm_gpus: int = 4  # For vLLM inference
    num_training_gpus: int = 4  # For training

    # Cost tracking
    gpu_hourly_rate: float = 24.0  # $24/hr for 8XH100 node (Lambda)
    target_cost: float = 10_000.0  # Target: <$10k

    # Paths
    dataset_path: str = "bespokelabs/Bespoke-Stratos-17k"  # Default RLT dataset
    output_dir: str = "/home/genesis/genesis-rebuild/models/waltzrl_rlt"

    # WaltzRL-specific
    safety_dataset_path: Optional[str] = None  # Custom safety dataset
    conversation_agent_path: str = "/home/genesis/genesis-rebuild/infrastructure/safety/waltzrl_conversation_agent.py"
    feedback_agent_path: str = "/home/genesis/genesis-rebuild/infrastructure/safety/waltzrl_feedback_agent.py"


class WaltzRLRLTTrainer:
    """
    Cost-effective training for WaltzRL feedback agents using RLT teacher approach.

    Key Features:
    1. Two-phase training: SFT warmup → RL refinement
    2. Teacher-student distillation (reduces training cost by 90%)
    3. vLLM-accelerated generation (fast inference during training)
    4. Cost tracking and budget enforcement
    5. Integration with Genesis WaltzRL safety layer

    Training Pipeline:
    1. SFT Warmup: Train on safety dialogues with RLT format
    2. RL Phase: Reinforce safe behaviors using reward model
    3. Distillation: Transfer to feedback agent for production
    4. Validation: Test on WaltzRL benchmarks (89% unsafe reduction target)
    """

    def __init__(self, config: RLTTrainingConfig):
        self.config = config
        self.total_cost = 0.0
        self.training_start_time = None
        self.training_end_time = None

        # Ensure output directory exists
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)

        logger.info(f"Initialized WaltzRL RLT Trainer")
        logger.info(f"Target cost: ${config.target_cost:,.0f}")
        logger.info(f"Base model: {config.base_model}")

    def prepare_safety_dataset(self,
                               custom_path: Optional[str] = None) -> str:
        """
        Prepare safety-focused dataset for WaltzRL training.

        Format expected by RLT:
        - question: User query (potentially unsafe)
        - solution: Safe response
        - reasoning_trace: CoT reasoning for safety decision

        Args:
            custom_path: Path to custom safety dataset (HuggingFace format)

        Returns:
            Dataset path/identifier
        """
        if custom_path:
            logger.info(f"Using custom safety dataset: {custom_path}")
            return custom_path

        # Default: Use RLT's bespoke dataset for initial trials
        logger.info(f"Using default RLT dataset: {self.config.dataset_path}")
        logger.warning("RECOMMENDATION: Create WaltzRL-specific safety dataset")
        logger.warning("  - Include unsafe queries from Meta/Johns Hopkins benchmarks")
        logger.warning("  - Add reasoning traces for safety decisions")
        logger.warning("  - Format: {'question', 'solution', 'reasoning_trace'}")

        return self.config.dataset_path

    def run_sft_warmup(self,
                       dataset_path: str,
                       output_dir: Optional[str] = None) -> str:
        """
        Phase 1: Supervised warm-up with RLT format.

        This phase trains the base model to follow the RLT reasoning format
        using supervised learning on safety dialogues.

        Args:
            dataset_path: Path to prepared dataset
            output_dir: Where to save warmed-up model

        Returns:
            Path to warmed-up model checkpoint
        """
        if output_dir is None:
            output_dir = f"{self.config.output_dir}/pre_rl_model"

        logger.info("=" * 60)
        logger.info("PHASE 1: SFT WARMUP")
        logger.info("=" * 60)

        # Command to run RLT SFT warmup
        # Reference: RLT README line 69-71
        cmd = f"""
cd {RLT_PATH} && \\
./launch.sh {self.config.num_gpus} \\
cfgs/run_cfg/teacher_sft.yaml \\
dataset_id_or_path={dataset_path} \\
output_dir={output_dir} \\
model_name_or_path={self.config.base_model}
"""

        logger.info(f"SFT Warmup Command:\n{cmd}")
        logger.warning("MANUAL EXECUTION REQUIRED:")
        logger.warning("  1. Activate RLT conda environment")
        logger.warning("  2. Run the command above")
        logger.warning("  3. Monitor W&B for training progress")
        logger.warning("  4. Wait for checkpoint to be saved")

        # Estimate cost (SFT is faster than RL)
        estimated_hours = 4.0  # ~4 hours for SFT on 8XH100
        estimated_cost = estimated_hours * self.config.gpu_hourly_rate
        self.total_cost += estimated_cost

        logger.info(f"Estimated SFT cost: ${estimated_cost:,.0f}")
        logger.info(f"Running total: ${self.total_cost:,.0f} / ${self.config.target_cost:,.0f}")

        return output_dir

    def run_rl_training(self,
                       pre_rl_model_path: str,
                       output_dir: Optional[str] = None) -> str:
        """
        Phase 2: RL training to create RLT teacher.

        This phase uses reinforcement learning to improve the model's
        reasoning capabilities, creating a "teacher" that can generate
        high-quality reasoning traces.

        Args:
            pre_rl_model_path: Path to SFT-warmed model
            output_dir: Where to save final RLT model

        Returns:
            Path to trained RLT teacher checkpoint
        """
        if output_dir is None:
            output_dir = f"{self.config.output_dir}/rlt_teacher"

        logger.info("=" * 60)
        logger.info("PHASE 2: RL TRAINING")
        logger.info("=" * 60)

        # Command to run RLT RL training
        # Reference: RLT README line 74-76
        cmd = f"""
cd {RLT_PATH} && \\
./launch_with_server.sh \\
{self.config.num_vllm_gpus} {self.config.num_training_gpus} \\
cfgs/run_cfg/teacher_rlt.yaml \\
model_name_or_path={pre_rl_model_path} \\
results_dir={output_dir}
"""

        logger.info(f"RL Training Command:\n{cmd}")
        logger.warning("MANUAL EXECUTION REQUIRED:")
        logger.warning("  1. Ensure vLLM is installed (see RLT README)")
        logger.warning("  2. Run the command above")
        logger.warning("  3. Monitor W&B for RL metrics")
        logger.warning("  4. Training will take multiple days")
        logger.warning("  5. Can use 'offload' arg if OOM on <8 GPUs")

        # Estimate cost (RL is expensive but still 90% cheaper than baseline)
        estimated_hours = 48.0  # ~2 days for RL on 8XH100
        estimated_cost = estimated_hours * self.config.gpu_hourly_rate
        self.total_cost += estimated_cost

        logger.info(f"Estimated RL cost: ${estimated_cost:,.0f}")
        logger.info(f"Running total: ${self.total_cost:,.0f} / ${self.config.target_cost:,.0f}")

        if self.total_cost > self.config.target_cost:
            logger.warning(f"⚠️  BUDGET EXCEEDED: ${self.total_cost:,.0f} > ${self.config.target_cost:,.0f}")
        else:
            logger.info(f"✓ Within budget: {(self.total_cost/self.config.target_cost)*100:.1f}% used")

        return output_dir

    def distill_to_student(self,
                          teacher_path: str,
                          student_config: Dict) -> str:
        """
        Phase 3: Distill RLT teacher to smaller student for production.

        The RLT teacher is expensive to run in production. We distill its
        knowledge into a smaller student model for the WaltzRL feedback agent.

        Args:
            teacher_path: Path to trained RLT teacher
            student_config: Configuration for student model

        Returns:
            Path to distilled student checkpoint
        """
        logger.info("=" * 60)
        logger.info("PHASE 3: STUDENT DISTILLATION")
        logger.info("=" * 60)

        logger.warning("Student distillation is OPTIONAL for RLT")
        logger.warning("  - Teacher can be used directly")
        logger.warning("  - Distillation reduces inference cost")
        logger.warning("  - See RLT README 'Student training notes' (line 83-86)")
        logger.warning("  - Large students (32B+) may need multiple traces")

        # Reference external distillation code
        logger.info("Distillation reference:")
        logger.info("  https://github.com/NovaSky-AI/SkyThought/tree/main/skythought/train")

        return teacher_path  # Return teacher path if no distillation

    def evaluate_cost(self) -> Dict[str, float]:
        """
        Calculate final training costs and compare to baseline.

        Returns:
            Cost breakdown and savings analysis
        """
        baseline_cost = 100_000.0  # $100k baseline
        rlt_cost = self.total_cost
        savings = baseline_cost - rlt_cost
        reduction_pct = savings / baseline_cost

        analysis = {
            "baseline_cost_usd": baseline_cost,
            "rlt_cost_usd": rlt_cost,
            "savings_usd": savings,
            "reduction_pct": reduction_pct,
            "within_budget": rlt_cost <= self.config.target_cost,
            "budget_utilization_pct": rlt_cost / self.config.target_cost
        }

        logger.info("=" * 60)
        logger.info("COST ANALYSIS")
        logger.info("=" * 60)
        logger.info(f"Baseline (full RL): ${baseline_cost:,.0f}")
        logger.info(f"RLT approach:       ${rlt_cost:,.0f}")
        logger.info(f"Savings:            ${savings:,.0f} ({reduction_pct*100:.1f}%)")
        logger.info(f"Target budget:      ${self.config.target_cost:,.0f}")
        logger.info(f"Budget utilization: {analysis['budget_utilization_pct']*100:.1f}%")

        if analysis["within_budget"]:
            logger.info("✓ WITHIN BUDGET")
        else:
            logger.warning("⚠️  OVER BUDGET")

        return analysis

    def run_full_pipeline(self,
                         custom_dataset: Optional[str] = None) -> Dict:
        """
        Execute complete RLT training pipeline for WaltzRL.

        Steps:
        1. Prepare safety dataset
        2. SFT warmup phase
        3. RL training phase
        4. (Optional) Student distillation
        5. Cost analysis

        Args:
            custom_dataset: Optional custom safety dataset path

        Returns:
            Training results and cost analysis
        """
        logger.info("=" * 80)
        logger.info("WALTZRL RLT TRAINING PIPELINE - START")
        logger.info("=" * 80)

        # Phase 1: Dataset preparation
        dataset = self.prepare_safety_dataset(custom_dataset)

        # Phase 2: SFT warmup
        pre_rl_model = self.run_sft_warmup(dataset)

        # Phase 3: RL training
        rlt_teacher = self.run_rl_training(pre_rl_model)

        # Phase 4: Cost analysis
        cost_analysis = self.evaluate_cost()

        logger.info("=" * 80)
        logger.info("WALTZRL RLT TRAINING PIPELINE - COMPLETE")
        logger.info("=" * 80)

        return {
            "dataset_path": dataset,
            "pre_rl_model_path": pre_rl_model,
            "rlt_teacher_path": rlt_teacher,
            "cost_analysis": cost_analysis
        }


def main():
    """Example usage of WaltzRL RLT Trainer"""

    # Configure training
    config = RLTTrainingConfig(
        base_model="Qwen/Qwen2.5-7B-Instruct",
        model_size="7B",
        num_gpus=8,
        target_cost=10_000.0,
        output_dir="/home/genesis/genesis-rebuild/models/waltzrl_rlt"
    )

    # Initialize trainer
    trainer = WaltzRLRLTTrainer(config)

    # Run pipeline (manual execution required for GPU steps)
    results = trainer.run_full_pipeline()

    print("\n" + "=" * 80)
    print("NEXT STEPS:")
    print("=" * 80)
    print("1. Execute SFT warmup command on 8XH100 node")
    print("2. Execute RL training command (will take ~2 days)")
    print("3. Integrate trained model into WaltzRL feedback agent")
    print("4. Validate on Meta/Johns Hopkins safety benchmarks")
    print("5. Target: 89% unsafe reduction + 78% over-refusal reduction")
    print("=" * 80)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    main()
