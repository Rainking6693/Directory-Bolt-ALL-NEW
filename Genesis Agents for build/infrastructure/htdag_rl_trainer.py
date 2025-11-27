"""
HTDAG RL Trainer: Reinforcement Learning Training for HTDAG Planner

This module integrates AgentFlow's Flow-GRPO algorithm to train the HTDAG planner
via reinforcement learning. The goal is to improve task decomposition quality by
15-25% through online learning from task execution outcomes.

Key Components:
1. HTDAGRLEnvironment: RL environment wrapper for HTDAG
2. HTDAGRLTrainer: Training orchestrator using Flow-GRPO
3. Reward computation based on decomposition quality metrics
4. Integration with AgentFlow's training pipeline

Author: Oracle (Discovery Agent)
Date: October 27, 2025
Status: STUB IMPLEMENTATION (ready for Week 2 training)
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass, asdict
import numpy as np

from infrastructure.htdag_planner import HTDAGPlanner
from infrastructure.task_dag import TaskDAG, Task, TaskStatus

logger = logging.getLogger(__name__)


@dataclass
class HTDAGState:
    """
    RL state representation for HTDAG decomposition.

    Captures the current decomposition state including the user request,
    current DAG structure, and execution history.
    """
    user_request: str
    current_dag: Optional[TaskDAG]
    decomposition_history: List[Dict[str, Any]]
    llm_call_count: int
    execution_time: float
    step_count: int

    def to_dict(self) -> Dict:
        """Convert state to dictionary for serialization."""
        return {
            'user_request': self.user_request,
            'dag_size': len(self.current_dag) if self.current_dag else 0,
            'decomposition_history': self.decomposition_history,
            'llm_call_count': self.llm_call_count,
            'execution_time': self.execution_time,
            'step_count': self.step_count
        }


@dataclass
class HTDAGAction:
    """
    RL action representation for HTDAG decomposition.

    Represents a decomposition decision: whether to decompose further,
    which task to decompose, and what subtasks to generate.
    """
    decompose_further: bool
    task_id: str
    subtasks: List[Task]
    confidence: float

    def to_dict(self) -> Dict:
        """Convert action to dictionary for serialization."""
        return {
            'decompose_further': self.decompose_further,
            'task_id': self.task_id,
            'num_subtasks': len(self.subtasks),
            'confidence': self.confidence
        }


@dataclass
class DecompositionResult:
    """
    Result of task decomposition for reward computation.

    Contains all metrics needed to compute the reward signal.
    """
    task_completed: bool
    dag_valid: bool
    has_cycles: bool
    decomposition_depth: int
    num_subtasks: int
    parallel_tasks_found: int
    execution_time: float
    llm_calls: int
    unnecessary_steps: int

    def to_dict(self) -> Dict:
        """Convert result to dictionary."""
        return asdict(self)


class HTDAGRLEnvironment:
    """
    Reinforcement Learning environment for HTDAG training.

    Wraps HTDAG planner as an RL agent that learns optimal decomposition policies
    through interaction with a task benchmark suite.
    """

    def __init__(
        self,
        htdag_planner: HTDAGPlanner,
        benchmark_tasks: List[str],
        max_steps_per_episode: int = 50
    ):
        """
        Initialize HTDAG RL environment.

        Args:
            htdag_planner: HTDAG planner instance to train
            benchmark_tasks: List of benchmark task descriptions
            max_steps_per_episode: Maximum decomposition steps per episode
        """
        self.planner = htdag_planner
        self.benchmark_tasks = benchmark_tasks
        self.max_steps_per_episode = max_steps_per_episode

        self.current_task_idx = 0
        self.current_state: Optional[HTDAGState] = None
        self.episode_start_time = 0.0

        logger.info(
            f"Initialized HTDAG RL environment with {len(benchmark_tasks)} benchmark tasks"
        )

    def reset(self) -> HTDAGState:
        """
        Reset environment for new episode.

        Selects next benchmark task and initializes state.

        Returns:
            Initial state for new episode
        """
        # Cycle through benchmark tasks
        self.current_task_idx = (self.current_task_idx + 1) % len(self.benchmark_tasks)
        task = self.benchmark_tasks[self.current_task_idx]

        # Initialize state
        self.current_state = HTDAGState(
            user_request=task,
            current_dag=TaskDAG(),
            decomposition_history=[],
            llm_call_count=0,
            execution_time=0.0,
            step_count=0
        )

        self.episode_start_time = time.time()

        logger.debug(f"Episode reset: Task #{self.current_task_idx}: {task[:50]}...")
        return self.current_state

    async def step(self, action: HTDAGAction) -> Tuple[HTDAGState, float, bool, Dict]:
        """
        Execute one decomposition step.

        Args:
            action: Decomposition action to execute

        Returns:
            Tuple of (next_state, reward, done, info)
        """
        if self.current_state is None:
            raise RuntimeError("Environment not initialized. Call reset() first.")

        # Update state with action
        self.current_state.step_count += 1
        self.current_state.decomposition_history.append(action.to_dict())

        # Execute decomposition action
        if action.decompose_further:
            # Add subtasks to DAG
            for subtask in action.subtasks:
                self.current_state.current_dag.add_task(subtask)
                self.current_state.current_dag.add_dependency(action.task_id, subtask.task_id)

            self.current_state.llm_call_count += 1  # Track LLM usage

        # Check episode termination conditions
        done = False
        reward = 0.0

        # Condition 1: Max steps reached
        if self.current_state.step_count >= self.max_steps_per_episode:
            done = True
            reward = -1.0  # Penalty for not completing within step limit
            logger.warning(f"Episode terminated: Max steps ({self.max_steps_per_episode}) reached")

        # Condition 2: All tasks are atomic (decomposition complete)
        elif self._all_tasks_atomic():
            done = True
            result = await self._execute_dag()
            reward = self._compute_reward(result)
            logger.info(f"Episode complete: Reward={reward:.3f}, Result={result.to_dict()}")

        # Condition 3: Episode continues (intermediate step)
        else:
            reward = -0.01  # Small step penalty to encourage efficiency

        # Update execution time
        self.current_state.execution_time = time.time() - self.episode_start_time

        info = {
            'dag_size': len(self.current_state.current_dag),
            'depth': self.current_state.current_dag.max_depth() if self.current_state.current_dag else 0,
            'has_cycles': self.current_state.current_dag.has_cycle() if self.current_state.current_dag else False,
            'llm_calls': self.current_state.llm_call_count
        }

        return self.current_state, reward, done, info

    def _all_tasks_atomic(self) -> bool:
        """Check if all tasks in DAG are atomic (cannot be decomposed further)."""
        if not self.current_state or not self.current_state.current_dag:
            return False

        atomic_types = {"api_call", "file_write", "test_run"}
        return all(
            task.task_type in atomic_types
            for task in self.current_state.current_dag.tasks.values()
        )

    async def _execute_dag(self) -> DecompositionResult:
        """
        Execute DAG and collect metrics for reward computation.

        In training, this simulates DAG execution. In production, this would
        actually execute the tasks.

        Returns:
            DecompositionResult with metrics
        """
        dag = self.current_state.current_dag

        # Check basic validity
        dag_valid = len(dag) > 0 and len(dag) <= 1000
        has_cycles = dag.has_cycle()

        # Simulate task completion (in real training, would execute)
        # Success if DAG is valid and acyclic
        task_completed = dag_valid and not has_cycles

        # Compute metrics
        result = DecompositionResult(
            task_completed=task_completed,
            dag_valid=dag_valid,
            has_cycles=has_cycles,
            decomposition_depth=dag.max_depth(),
            num_subtasks=len(dag),
            parallel_tasks_found=self._count_parallel_tasks(dag),
            execution_time=self.current_state.execution_time,
            llm_calls=self.current_state.llm_call_count,
            unnecessary_steps=self._count_unnecessary_steps(dag)
        )

        return result

    def _count_parallel_tasks(self, dag: TaskDAG) -> int:
        """
        Count tasks that can execute in parallel.

        Parallel tasks have no dependencies (can start immediately).
        """
        parallel_count = sum(
            1 for task in dag.tasks.values()
            if len(task.dependencies) == 0
        )
        return parallel_count

    def _count_unnecessary_steps(self, dag: TaskDAG) -> int:
        """
        Count decomposition steps that added no value.

        Heuristic: Tasks with only 1 child are likely unnecessary intermediate nodes.
        """
        unnecessary = sum(
            1 for task in dag.tasks.values()
            if len([t for t in dag.tasks.values() if task.task_id in t.dependencies]) == 1
        )
        return unnecessary

    def _compute_reward(self, result: DecompositionResult) -> float:
        """
        Compute reward for HTDAG decomposition.

        Based on reward function from HTDAG_RL_EXPERIMENT_DESIGN.md Section 3.1.

        Args:
            result: Decomposition result metrics

        Returns:
            Reward in range [-2.0, +2.0]
        """
        reward = 0.0

        # ===== POSITIVE REWARDS =====

        # 1. Task Completion (most important)
        if result.task_completed:
            reward += 1.0
        else:
            reward -= 1.0  # Heavy penalty for failure

        # 2. Optimal Decomposition Depth (Goldilocks zone: 2-4 levels)
        depth = result.decomposition_depth
        if 2 <= depth <= 4:
            reward += 0.5
        elif depth == 1:
            reward -= 0.2  # Too shallow
        elif depth > 5:
            reward -= 0.3  # Too deep

        # 3. Parallel Task Discovery (critical for efficiency)
        parallel_ratio = result.parallel_tasks_found / max(result.num_subtasks, 1)
        if parallel_ratio >= 0.3:
            reward += 0.3
        elif parallel_ratio >= 0.2:
            reward += 0.2

        # 4. LLM Call Efficiency (cost optimization)
        llm_calls = result.llm_calls
        if llm_calls <= 10:
            reward += 0.2
        elif llm_calls <= 15:
            reward += 0.1
        else:
            reward -= 0.1

        # 5. Execution Time (speed bonus)
        exec_time = result.execution_time
        if exec_time <= 10:
            reward += 0.2
        elif exec_time <= 20:
            reward += 0.1

        # ===== NEGATIVE REWARDS =====

        # 6. Circular Dependencies (critical error)
        if result.has_cycles:
            reward -= 0.5

        # 7. Unnecessary Decomposition Steps
        unnecessary = result.unnecessary_steps
        if unnecessary > 0:
            reward -= 0.3 * min(unnecessary, 3)

        # 8. Invalid DAG Structure
        if not result.dag_valid:
            reward -= 1.0

        # Clip reward to [-2.0, +2.0]
        return max(-2.0, min(2.0, reward))


class HTDAGRLTrainer:
    """
    RL Trainer for HTDAG using AgentFlow's Flow-GRPO algorithm.

    Orchestrates training loop, checkpoint management, and evaluation.
    """

    def __init__(
        self,
        htdag_planner: HTDAGPlanner,
        benchmark_tasks: List[str],
        training_config: Optional[Dict] = None
    ):
        """
        Initialize HTDAG RL trainer.

        Args:
            htdag_planner: HTDAG planner instance to train
            benchmark_tasks: List of benchmark task descriptions
            training_config: Training hyperparameters (see TRAINING_CONFIG in design doc)
        """
        self.planner = htdag_planner
        self.benchmark_tasks = benchmark_tasks

        # Default training config (from experiment design)
        self.config = {
            'num_benchmark_tasks': 100,
            'max_steps_per_episode': 50,
            'n_epochs': 10,
            'batch_size': 32,
            'n_episodes_per_epoch': 100,
            'learning_rate': 3e-4,
            'ppo_clip_epsilon': 0.2,
            'gamma': 0.99,
            'eval_every_n_epochs': 2,
            'save_checkpoint_every': 1000,
        }
        if training_config:
            self.config.update(training_config)

        # Initialize environment
        self.env = HTDAGRLEnvironment(
            htdag_planner=htdag_planner,
            benchmark_tasks=benchmark_tasks,
            max_steps_per_episode=self.config['max_steps_per_episode']
        )

        # Training state
        self.current_epoch = 0
        self.total_episodes = 0
        self.training_history = []

        logger.info(f"Initialized HTDAG RL Trainer with config: {self.config}")

    async def train(self) -> Dict:
        """
        Execute full training loop using Flow-GRPO.

        This is a stub implementation. Full integration with AgentFlow's
        training pipeline will be completed in Week 2.

        Returns:
            Training results dictionary
        """
        logger.info("Starting HTDAG RL training...")

        # TODO (Week 2): Integrate AgentFlow's Flow-GRPO trainer
        # For now, implement basic training loop structure

        for epoch in range(self.config['n_epochs']):
            self.current_epoch = epoch

            logger.info(f"=== Epoch {epoch + 1}/{self.config['n_epochs']} ===")

            # Run training episodes
            epoch_rewards = []
            for episode in range(self.config['n_episodes_per_epoch']):
                episode_reward = await self._run_episode()
                epoch_rewards.append(episode_reward)
                self.total_episodes += 1

                if self.total_episodes % 100 == 0:
                    logger.info(
                        f"Episode {self.total_episodes}: "
                        f"Reward={episode_reward:.3f}, "
                        f"Mean Last 100={np.mean(epoch_rewards[-100:]):.3f}"
                    )

            # Epoch summary
            mean_reward = np.mean(epoch_rewards)
            self.training_history.append({
                'epoch': epoch,
                'mean_reward': mean_reward,
                'std_reward': np.std(epoch_rewards),
                'min_reward': np.min(epoch_rewards),
                'max_reward': np.max(epoch_rewards)
            })

            logger.info(
                f"Epoch {epoch + 1} complete: Mean Reward={mean_reward:.3f}"
            )

            # Evaluation
            if (epoch + 1) % self.config['eval_every_n_epochs'] == 0:
                eval_results = await self.evaluate()
                logger.info(f"Evaluation results: {eval_results}")

        logger.info("Training complete!")

        results = {
            'total_epochs': self.config['n_epochs'],
            'total_episodes': self.total_episodes,
            'training_history': self.training_history,
            'final_mean_reward': self.training_history[-1]['mean_reward']
        }

        return results

    async def _run_episode(self) -> float:
        """
        Run one training episode.

        Returns:
            Total episode reward
        """
        state = self.env.reset()
        done = False
        total_reward = 0.0

        while not done:
            # TODO (Week 2): Replace with Flow-GRPO policy
            # For now, use random action
            action = await self._sample_action(state)

            next_state, reward, done, info = await self.env.step(action)
            total_reward += reward

            state = next_state

        return total_reward

    async def _sample_action(self, state: HTDAGState) -> HTDAGAction:
        """
        Sample action from policy.

        Stub implementation - will be replaced with Flow-GRPO policy in Week 2.

        Args:
            state: Current HTDAG state

        Returns:
            Sampled action
        """
        # Random policy for stub
        decompose_further = np.random.random() > 0.5

        if decompose_further and state.current_dag:
            # Pick random task to decompose
            tasks = list(state.current_dag.tasks.values())
            if tasks:
                task = np.random.choice(tasks)
                task_id = task.task_id

                # Generate random subtasks
                num_subtasks = np.random.randint(2, 5)
                subtasks = [
                    Task(
                        task_id=f"{task_id}_sub_{i}",
                        task_type="api_call",
                        description=f"Subtask {i} of {task.description}"
                    )
                    for i in range(num_subtasks)
                ]
            else:
                task_id = "root"
                subtasks = []
        else:
            task_id = "root"
            subtasks = []

        action = HTDAGAction(
            decompose_further=decompose_further,
            task_id=task_id,
            subtasks=subtasks,
            confidence=0.5
        )

        return action

    async def evaluate(self) -> Dict:
        """
        Evaluate trained policy on validation set.

        Returns:
            Evaluation metrics
        """
        logger.info("Running evaluation...")

        # TODO (Week 2): Implement full evaluation on validation set
        eval_results = {
            'success_rate': 0.0,
            'mean_reward': 0.0,
            'mean_depth': 0.0,
            'mean_parallelism': 0.0
        }

        return eval_results

    def save_checkpoint(self, path: str):
        """Save training checkpoint."""
        checkpoint = {
            'epoch': self.current_epoch,
            'total_episodes': self.total_episodes,
            'training_history': self.training_history,
            'config': self.config
        }

        with open(path, 'w') as f:
            json.dump(checkpoint, f, indent=2)

        logger.info(f"Saved checkpoint to {path}")

    def load_checkpoint(self, path: str):
        """Load training checkpoint."""
        with open(path, 'r') as f:
            checkpoint = json.load(f)

        self.current_epoch = checkpoint['epoch']
        self.total_episodes = checkpoint['total_episodes']
        self.training_history = checkpoint['training_history']

        logger.info(f"Loaded checkpoint from {path}")


# ===== HELPER FUNCTIONS =====

def load_trained_model(model_path: str) -> Dict[str, Any]:
    """
    Load trained HTDAG model checkpoint.

    Args:
        model_path: Path to trained model checkpoint (.pkl)

    Returns:
        Model data dictionary containing:
        - model_type: Model type identifier
        - training_history: Training metrics per epoch
        - config: Training configuration
        - mean_quality_improvement: Final quality improvement metric

    Raises:
        FileNotFoundError: If model checkpoint doesn't exist
        ValueError: If model checkpoint is invalid
    """
    import pickle
    from pathlib import Path

    model_path = Path(model_path)

    if not model_path.exists():
        raise FileNotFoundError(f"Model checkpoint not found: {model_path}")

    with open(model_path, 'rb') as f:
        model_data = pickle.load(f)

    # Validate model structure
    required_keys = ['model_type', 'training_history', 'config', 'mean_quality_improvement']
    for key in required_keys:
        if key not in model_data:
            raise ValueError(f"Invalid model checkpoint: missing key '{key}'")

    logger.info(f"Loaded trained model from {model_path}")
    logger.info(f"  Model type: {model_data['model_type']}")
    logger.info(f"  Final quality: {model_data['mean_quality_improvement']:.3f}")
    logger.info(f"  Total episodes: {model_data.get('total_episodes', 'N/A')}")

    return model_data


def load_synthetic_training_dataset(dataset_path: str) -> List[Dict[str, Any]]:
    """
    Load synthetic training dataset from JSON file.

    Args:
        dataset_path: Path to synthetic_training_dataset.json

    Returns:
        List of training examples with synthetic variants
    """
    with open(dataset_path, 'r') as f:
        dataset = json.load(f)

    training_examples = dataset['training_examples']
    logger.info(f"Loaded {len(training_examples)} training examples from {dataset_path}")
    logger.info(f"Mean quality improvement: {dataset['aggregated_metrics']['mean_quality_improvement']:.3f}")

    return training_examples


def create_benchmark_tasks() -> List[str]:
    """
    Create benchmark task suite for HTDAG training.

    Based on benchmark categories from experiment design Section 2.2.

    Returns:
        List of 100 benchmark task descriptions
    """
    tasks = []

    # Simple tasks (25)
    simple_tasks = [
        "Create a landing page for a SaaS product",
        "Write API documentation for REST endpoints",
        "Deploy a static website to Vercel",
        "Set up a GitHub repository with README",
        "Configure CI/CD for Python project",
    ]
    tasks.extend(simple_tasks * 5)  # 25 tasks

    # Medium tasks (35)
    medium_tasks = [
        "Build a full-stack CRUD app with authentication",
        "Create an e-commerce checkout flow",
        "Implement a CI/CD pipeline for microservices",
        "Design a database schema for multi-tenant SaaS",
        "Set up monitoring and alerting for production app",
        "Build a REST API with rate limiting and caching",
        "Create a responsive dashboard with charts",
    ]
    tasks.extend(medium_tasks * 5)  # 35 tasks

    # Complex tasks (30)
    complex_tasks = [
        "Design and deploy a multi-tenant SaaS platform",
        "Build a real-time collaborative editor",
        "Create an ML model training pipeline with monitoring",
        "Implement a distributed task queue with Redis",
        "Design a microservices architecture with service mesh",
        "Build a data analytics pipeline with Spark",
    ]
    tasks.extend(complex_tasks * 5)  # 30 tasks

    # Edge cases (10)
    edge_cases = [
        "Handle circular dependency in task graph",
        "Decompose ambiguous user request with missing context",
        "Optimize DAG for maximum parallelism",
        "Recover from failed task execution",
        "Handle conflicting task dependencies",
    ]
    tasks.extend(edge_cases * 2)  # 10 tasks

    return tasks[:100]  # Ensure exactly 100 tasks


# ===== MAIN ENTRY POINT =====

async def main():
    """
    Main entry point for HTDAG RL training.

    Example usage:
        python infrastructure/htdag_rl_trainer.py
    """
    # Initialize HTDAG planner
    planner = HTDAGPlanner(llm_client=None)  # TODO: Add LLM client

    # Create benchmark tasks
    benchmark_tasks = create_benchmark_tasks()

    # Initialize trainer
    trainer = HTDAGRLTrainer(
        htdag_planner=planner,
        benchmark_tasks=benchmark_tasks
    )

    # Run training
    results = await trainer.train()

    # Save results
    with open('/home/genesis/genesis-rebuild/data/htdag_rl_training_results.json', 'w') as f:
        json.dump(results, f, indent=2)

    logger.info(f"Training results saved. Final mean reward: {results['final_mean_reward']:.3f}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
