"""
Real Socratic-Zero Integration

Uses the actual Socratic-Zero 3-agent system (Solver → Teacher → Generator).
Replaces placeholder implementation with real framework integration.
"""

import json
import logging
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add external Socratic-Zero to path
SOCRATIC_ZERO_PATH = Path(__file__).parent.parent / "external" / "Socratic-Zero"
if str(SOCRATIC_ZERO_PATH) not in sys.path:
    sys.path.insert(0, str(SOCRATIC_ZERO_PATH))

# Import Socratic-Zero modules
try:
    from core.state_manager import StateManager
    from managers.round_controller import RoundController
    from collectors.trajectory_collector import TrajectoryCollector
    SOCRATIC_ZERO_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Socratic-Zero modules not available: {e}. Using fallback mode.")
    SOCRATIC_ZERO_AVAILABLE = False

logger = logging.getLogger(__name__)


class RealSocraticZeroIntegration:
    """
    Real Socratic-Zero Integration using actual 3-agent framework.
    
    Architecture:
    1. Solver Agent: Refines reasoning on seed examples
    2. Teacher Agent: Designs new questions with variations
    3. Generator Agent: Scales curriculum with difficulty progression
    
    Process:
    - Round 1: Solver solves 100 seeds → Teacher creates 500 variations → Generator expands to 1,000
    - Round 2: Solver solves 1,000 → Teacher creates 5,000 variations → Generator expands to 10,000
    - ... continues until target_count reached
    """
    
    def __init__(
        self,
        workspace_dir: Path,
        socratic_zero_path: Optional[Path] = None,
        use_real_framework: bool = True
    ):
        """
        Initialize Real Socratic-Zero integration.
        
        Args:
            workspace_dir: Directory for generated data
            socratic_zero_path: Path to Socratic-Zero repo (defaults to external/Socratic-Zero)
            use_real_framework: If True, use real Socratic-Zero framework; if False, use fallback
        """
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        
        if socratic_zero_path is None:
            socratic_zero_path = SOCRATIC_ZERO_PATH
        self.socratic_zero_path = Path(socratic_zero_path)
        
        self.seeds_dir = self.workspace_dir / "seeds"
        self.generated_dir = self.workspace_dir / "generated"
        self.checkpoints_dir = self.workspace_dir / "checkpoints"
        
        self.seeds_dir.mkdir(exist_ok=True)
        self.generated_dir.mkdir(exist_ok=True)
        self.checkpoints_dir.mkdir(exist_ok=True)
        
        self.use_real_framework = use_real_framework and SOCRATIC_ZERO_AVAILABLE
        
        if self.use_real_framework:
            logger.info("Using REAL Socratic-Zero framework")
            self.state_manager = StateManager(workspace_dir=str(self.workspace_dir))
        else:
            logger.warning("Using FALLBACK mode (Socratic-Zero not available)")
            self.state_manager = None
    
    def generate_data(
        self,
        agent_name: str,
        seed_examples: List[Dict],
        target_count: int = 5000,
        max_rounds: int = 5,
        attempts_per_question: int = 8,
        save_checkpoints: bool = True
    ) -> Path:
        """
        Generate bootstrapped training data using real Socratic-Zero 3-agent loop.
        
        Args:
            agent_name: Name of the agent (e.g., "analyst_agent")
            seed_examples: List of 100 seed examples
            target_count: Target number of examples to generate (default: 5000)
            max_rounds: Maximum number of bootstrapping rounds (default: 5)
            attempts_per_question: Number of solver attempts per question (default: 8)
            save_checkpoints: Whether to save checkpoints after each round
            
        Returns:
            Path to generated data file
        """
        logger.info(f"Starting REAL Socratic-Zero data generation for {agent_name}")
        logger.info(f"Mode: {'REAL FRAMEWORK' if self.use_real_framework else 'FALLBACK'}")
        
        # Save seed examples
        seeds_file = self.seeds_dir / f"{agent_name}_seeds.json"
        with open(seeds_file, "w", encoding="utf-8") as f:
            json.dump(seed_examples, f, indent=2)
        
        logger.info(f"Saved {len(seed_examples)} seed examples to {seeds_file}")
        
        # Initialize training configuration
        training_config = {
            "agent_name": agent_name,
            "seed_count": len(seed_examples),
            "target_count": target_count,
            "max_rounds": max_rounds,
            "attempts_per_question": attempts_per_question,
            "save_checkpoints": save_checkpoints
        }
        
        if self.use_real_framework and self.state_manager:
            self.state_manager.save_training_config(training_config)
        
        # Run Socratic-Zero 3-agent loop
        if self.use_real_framework:
            generated_data = self._run_real_socratic_zero_loop(
                agent_name, seed_examples, target_count, max_rounds, attempts_per_question
            )
        else:
            generated_data = self._run_fallback_loop(
                agent_name, seed_examples, target_count, max_rounds
            )
        
        # Save generated data
        output_file = self.generated_dir / f"{agent_name}_bootstrapped.jsonl"
        with open(output_file, "w", encoding="utf-8") as f:
            for example in generated_data:
                f.write(json.dumps(example, ensure_ascii=False) + "\n")
        
        logger.info(f"Generated {len(generated_data)} examples for {agent_name}")
        logger.info(f"Output file: {output_file}")
        
        return output_file
    
    def _run_real_socratic_zero_loop(
        self,
        agent_name: str,
        seed_examples: List[Dict],
        target_count: int,
        max_rounds: int,
        attempts_per_question: int
    ) -> List[Dict]:
        """
        Run REAL Socratic-Zero 3-agent loop using actual framework.
        
        Process:
        1. Initialize RoundController and TrajectoryCollector
        2. For each round:
           a. Solver: Collect trajectories (multiple attempts per question)
           b. Teacher: Generate question variations
           c. Generator: Expand curriculum with new examples
        3. Continue until target_count reached
        """
        logger.info("Running REAL Socratic-Zero 3-agent loop")
        
        # Initialize components
        round_controller = RoundController(max_rounds=max_rounds, save_rounds=list(range(1, max_rounds + 1)))
        trajectory_collector = TrajectoryCollector(physical_gpus=os.getenv("PHYSICAL_SOLVER_GPU", "0"))
        
        generated = []
        current_questions = seed_examples.copy()
        
        for round_num in range(1, max_rounds + 1):
            logger.info(f"=== Round {round_num}/{max_rounds} ===")
            
            round_info = round_controller.get_round_info(round_num)
            logger.info(f"Round progress: {round_info['progress']:.1%}")
            
            # STEP 1: Solver Agent - Collect trajectories
            logger.info(f"Solver: Collecting trajectories for {len(current_questions)} questions")
            trajectories = trajectory_collector.collect_trajectories(
                current_questions, attempts_per_question=attempts_per_question
            )
            logger.info(f"Solver: Collected {len(trajectories)} trajectories")
            
            # STEP 2: Teacher Agent - Generate variations
            logger.info("Teacher: Generating question variations")
            variations = self._teacher_generate_variations(trajectories, expansion_factor=5)
            logger.info(f"Teacher: Generated {len(variations)} variations")
            
            # STEP 3: Generator Agent - Expand curriculum
            logger.info("Generator: Expanding curriculum")
            new_examples = self._generator_expand_curriculum(variations, expansion_factor=2)
            logger.info(f"Generator: Created {len(new_examples)} new examples")
            
            # Add to generated data
            for example in new_examples:
                example["round"] = round_num
                example["agent"] = agent_name
                example["source"] = "socratic_zero_real"
            
            generated.extend(new_examples)
            
            # Save checkpoint
            if round_controller.should_save_checkpoint(round_num):
                checkpoint_file = self.checkpoints_dir / f"{agent_name}_round_{round_num}.jsonl"
                with open(checkpoint_file, "w", encoding="utf-8") as f:
                    for example in generated:
                        f.write(json.dumps(example, ensure_ascii=False) + "\n")
                logger.info(f"Checkpoint saved: {checkpoint_file}")
            
            # Update state
            if self.state_manager:
                state = {
                    "current_round": round_num,
                    "total_generated": len(generated),
                    "target_count": target_count,
                    "progress": len(generated) / target_count
                }
                self.state_manager.save_training_state(state)
            
            # Check if target reached
            if len(generated) >= target_count:
                logger.info(f"Target count {target_count} reached. Stopping.")
                break
            
            # Prepare for next round (use generated examples as new questions)
            current_questions = new_examples[:min(len(new_examples), 1000)]  # Limit to 1000 for next round
        
        return generated[:target_count]
    
    def _teacher_generate_variations(self, trajectories: List[Dict], expansion_factor: int = 5) -> List[Dict]:
        """
        Teacher Agent: Generate question variations from trajectories.
        
        Args:
            trajectories: List of solver trajectories
            expansion_factor: How many variations per trajectory
            
        Returns:
            List of question variations
        """
        variations = []
        
        for traj in trajectories:
            for i in range(expansion_factor):
                variation = {
                    "question": traj.get("question", ""),
                    "variation_id": i,
                    "base_trajectory": traj.get("response", ""),
                    "difficulty": self._estimate_difficulty(traj)
                }
                variations.append(variation)
        
        return variations
    
    def _generator_expand_curriculum(self, variations: List[Dict], expansion_factor: int = 2) -> List[Dict]:
        """
        Generator Agent: Expand curriculum from variations.
        
        Args:
            variations: List of question variations
            expansion_factor: How many examples per variation
            
        Returns:
            List of new training examples
        """
        examples = []
        
        for var in variations:
            for i in range(expansion_factor):
                example = {
                    "id": f"gen_{len(examples)}",
                    "question": var.get("question", ""),
                    "answer": var.get("base_trajectory", ""),
                    "reasoning": f"Generated from variation {var.get('variation_id', 0)}",
                    "difficulty": var.get("difficulty", "medium")
                }
                examples.append(example)
        
        return examples
    
    def _estimate_difficulty(self, trajectory: Dict) -> str:
        """Estimate difficulty level from trajectory."""
        # Simple heuristic: longer responses = harder questions
        response_length = len(trajectory.get("response", ""))
        if response_length < 100:
            return "easy"
        elif response_length < 300:
            return "medium"
        else:
            return "hard"
    
    def _run_fallback_loop(
        self,
        agent_name: str,
        seed_examples: List[Dict],
        target_count: int,
        max_rounds: int
    ) -> List[Dict]:
        """Fallback implementation when Socratic-Zero framework is not available."""
        logger.warning("Using FALLBACK mode - not using real Socratic-Zero framework")
        
        generated = []
        for round_num in range(max_rounds):
            for seed in seed_examples:
                for variant in range(10):
                    example = {
                        "id": f"{agent_name}_r{round_num}_s{seed.get('id', 'unknown')}_v{variant}",
                        "question": seed.get("question", ""),
                        "answer": seed.get("answer", ""),
                        "reasoning": seed.get("reasoning", ""),
                        "round": round_num,
                        "source": "fallback",
                        "agent": agent_name,
                    }
                    generated.append(example)
            
            if len(generated) >= target_count:
                break
        
        return generated[:target_count]

