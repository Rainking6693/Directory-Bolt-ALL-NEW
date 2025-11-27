"""
Multi-Agent Group Relative Policy Optimization (M-GRPO) - Integration #79

RL-based training framework for multi-agent coordination, complementing
Genesis's existing Evolution Strategies (ES) training.

Features:
- Group-level policy optimization for agent coordination
- Collaborative task decomposition
- Information sharing rewards
- Complementary to existing ES training

Expected Impact:
- 20-30% improvement in multi-agent task performance
- 25% reduction in redundant work
- Better specialization based on group composition
"""

import asyncio
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json
from pathlib import Path

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class MGRPOConfig:
    """Configuration for M-GRPO training"""
    group_size: int = 3
    learning_rate: float = 0.001
    discount_factor: float = 0.99
    episodes_per_training: int = 10
    coordination_bonus_weight: float = 0.1
    max_task_complexity: int = 5


@dataclass
class AgentAction:
    """Agent action in M-GRPO episode"""
    agent_name: str
    action_type: str
    parameters: Dict[str, Any]
    result: Any
    reward: float
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class GroupEpisode:
    """Single M-GRPO group training episode"""
    episode_id: str
    task_description: str
    agent_group: List[str]
    actions: List[AgentAction] = field(default_factory=list)
    individual_rewards: List[float] = field(default_factory=list)
    group_bonus: float = 0.0
    group_reward: float = 0.0
    coordination_score: float = 0.0
    success: bool = False


class MGRPOTrainer:
    """
    Multi-agent Group Relative Policy Optimization trainer.

    Trains agents to coordinate via group-level RL rewards,
    complementing Genesis's existing ES training.

    Usage:
        trainer = MGRPOTrainer(agent_pool, config)
        episode = await trainer.train_episode(task)
        metrics = episode.get_metrics()
    """

    def __init__(
        self,
        agent_pool: List[Any],
        config: Optional[MGRPOConfig] = None
    ):
        """
        Initialize M-GRPO trainer.

        Args:
            agent_pool: Pool of available agents for group formation
            config: M-GRPO configuration
        """
        self.agent_pool = agent_pool
        self.config = config or MGRPOConfig()
        self.baseline_rewards: List[float] = []
        self.episode_history: List[GroupEpisode] = []
        self._training_metrics = {
            'total_episodes': 0,
            'successful_episodes': 0,
            'avg_group_reward': 0.0,
            'avg_coordination_score': 0.0
        }

    async def train_episode(self, task: Dict[str, Any]) -> GroupEpisode:
        """
        Train one M-GRPO episode with agent group.

        Args:
            task: Task definition with description, requirements, success criteria

        Returns:
            Completed group episode with metrics
        """
        episode_id = f"mgrpo-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

        # 1. Form agent group (strategic selection based on task)
        group = self._form_group(task)
        logger.info(f"Episode {episode_id}: Formed group with {len(group)} agents: {[a.__class__.__name__ for a in group]}")

        # Create episode
        episode = GroupEpisode(
            episode_id=episode_id,
            task_description=task.get('description', ''),
            agent_group=[a.__class__.__name__ for a in group]
        )

        try:
            # 2. Collaborative task decomposition
            subtasks = await self._decompose_collaboratively(task, group)
            logger.info(f"Episode {episode_id}: Decomposed into {len(subtasks)} subtasks")

            # 3. Execute subtasks with coordination
            results = []
            for agent, subtask in zip(group, subtasks):
                try:
                    result = await self._execute_subtask(agent, subtask, group, episode)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Subtask execution failed for {agent.__class__.__name__}: {e}")
                    results.append({'success': False, 'error': str(e), 'reward': 0.0})

            # 4. Calculate rewards
            individual_rewards = [r.get('reward', 0.0) for r in results]
            group_bonus = self._calculate_group_bonus(results, episode)
            group_reward = sum(individual_rewards) + group_bonus

            episode.individual_rewards = individual_rewards
            episode.group_bonus = group_bonus
            episode.group_reward = group_reward
            episode.coordination_score = self._measure_coordination(results)
            episode.success = all(r.get('success', False) for r in results)

            # 5. Update policies using group-relative advantage
            advantages = self._calculate_advantages(individual_rewards, group_reward)
            for agent, advantage in zip(group, advantages):
                await self._update_policy(agent, advantage, episode)

            # 6. Update baseline and metrics
            self.baseline_rewards.append(group_reward)
            if len(self.baseline_rewards) > 100:
                self.baseline_rewards = self.baseline_rewards[-100:]

            self._update_metrics(episode)
            self.episode_history.append(episode)

            logger.info(
                f"Episode {episode_id} complete: "
                f"Group reward={group_reward:.2f}, Bonus={group_bonus:.2f}, "
                f"Coordination={episode.coordination_score:.2f}, Success={episode.success}"
            )

        except Exception as e:
            logger.error(f"Episode {episode_id} failed: {e}")
            episode.success = False

        return episode

    def _form_group(self, task: Dict[str, Any]) -> List[Any]:
        """
        Form agent group strategically based on task requirements.

        Args:
            task: Task definition

        Returns:
            List of selected agents
        """
        # Strategic selection based on task requirements
        required_skills = task.get('required_skills', [])

        if required_skills:
            # Select agents with required skills
            selected = []
            for skill in required_skills[:self.config.group_size]:
                # Find agent with this skill
                for agent in self.agent_pool:
                    agent_skills = getattr(agent, 'capabilities', [])
                    if skill in agent_skills and agent not in selected:
                        selected.append(agent)
                        break

            # Fill remaining slots randomly
            while len(selected) < self.config.group_size:
                for agent in self.agent_pool:
                    if agent not in selected:
                        selected.append(agent)
                        break

            return selected[:self.config.group_size]
        else:
            # Random sampling
            import random
            return random.sample(
                self.agent_pool,
                min(self.config.group_size, len(self.agent_pool))
            )

    async def _decompose_collaboratively(
        self,
        task: Dict[str, Any],
        group: List[Any]
    ) -> List[Dict[str, Any]]:
        """
        Collaborative task decomposition (M-GRPO innovation).

        Instead of top-down HTDAG decomposition, agents negotiate
        task distribution based on their capabilities.

        Args:
            task: Task to decompose
            group: Agent group

        Returns:
            List of subtasks (one per agent)
        """
        # Each agent proposes subtasks they can handle
        proposals = []
        for agent in group:
            try:
                # Try to get agent's subtask proposal
                if hasattr(agent, 'propose_subtasks'):
                    proposal = await agent.propose_subtasks(task)
                else:
                    # Default: equal distribution
                    proposal = {'subtask': task.get('description', ''), 'confidence': 0.5}

                proposals.append(proposal)
            except Exception as e:
                logger.warning(f"Agent {agent.__class__.__name__} failed to propose subtasks: {e}")
                proposals.append({'subtask': task.get('description', ''), 'confidence': 0.0})

        # Merge proposals to minimize overlap and maximize coverage
        subtasks = self._merge_proposals(proposals, task)

        return subtasks

    def _merge_proposals(
        self,
        proposals: List[Dict[str, Any]],
        task: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Merge agent proposals into non-overlapping subtasks.

        Args:
            proposals: Agent subtask proposals
            task: Original task

        Returns:
            Merged subtask list
        """
        # Simple implementation: assign each agent a portion of the task
        # In production, this would use more sophisticated merging logic

        task_description = task.get('description', '')
        subtasks = []

        for i, proposal in enumerate(proposals):
            subtasks.append({
                'description': proposal.get('subtask', task_description),
                'agent_index': i,
                'confidence': proposal.get('confidence', 0.5),
                'task_type': task.get('type', 'general')
            })

        return subtasks

    async def _execute_subtask(
        self,
        agent: Any,
        subtask: Dict[str, Any],
        group: List[Any],
        episode: GroupEpisode
    ) -> Dict[str, Any]:
        """
        Execute subtask with group context.

        Args:
            agent: Agent executing subtask
            subtask: Subtask definition
            group: Full agent group (for coordination)
            episode: Current episode

        Returns:
            Execution result with reward
        """
        try:
            # Execute subtask
            if hasattr(agent, 'execute_with_group_context'):
                result = await agent.execute_with_group_context(subtask, group)
            elif hasattr(agent, 'execute'):
                result = await agent.execute(subtask)
            else:
                # Fallback: simulate execution
                result = {
                    'success': True,
                    'output': f"Simulated execution of {subtask.get('description', 'task')}",
                    'shared_context': {}
                }

            # Calculate reward
            reward = self._calculate_subtask_reward(result, subtask)

            # Record action
            action = AgentAction(
                agent_name=agent.__class__.__name__,
                action_type=subtask.get('task_type', 'general'),
                parameters=subtask,
                result=result,
                reward=reward
            )
            episode.actions.append(action)

            return {
                'success': result.get('success', True),
                'reward': reward,
                'shared_context': result.get('shared_context', {}),
                'task_type': subtask.get('task_type')
            }

        except Exception as e:
            logger.error(f"Subtask execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'reward': -1.0,
                'shared_context': {},
                'task_type': subtask.get('task_type')
            }

    def _calculate_subtask_reward(
        self,
        result: Dict[str, Any],
        subtask: Dict[str, Any]
    ) -> float:
        """Calculate reward for individual subtask execution"""
        if not result.get('success', True):
            return -1.0

        # Base reward for success
        reward = 1.0

        # Bonus for quality (if available)
        quality = result.get('quality_score', 0.0)
        if quality > 0:
            reward += quality / 100.0

        # Bonus for efficiency (if available)
        efficiency = result.get('efficiency', 1.0)
        reward *= efficiency

        return reward

    def _calculate_group_bonus(
        self,
        results: List[Dict[str, Any]],
        episode: GroupEpisode
    ) -> float:
        """
        Calculate bonus for effective coordination.

        Rewards:
        - Information sharing between agents
        - Complementary task coverage
        - Minimal redundant work

        Args:
            results: Individual agent results
            episode: Current episode

        Returns:
            Group coordination bonus
        """
        # Information sharing score
        info_sharing_count = sum(
            1 for r in results
            if r.get('shared_context') and len(r['shared_context']) > 0
        )
        info_sharing_score = info_sharing_count / max(len(results), 1)

        # Task coverage (unique task types)
        unique_tasks = len(set(r.get('task_type', 'general') for r in results))
        coverage_score = unique_tasks / max(len(results), 1)

        # Redundancy penalty (low is better)
        # Simplified: assume no redundancy if all tasks are different types
        redundancy_penalty = 1.0 - coverage_score

        # Combined bonus
        bonus = (
            info_sharing_score +
            coverage_score -
            redundancy_penalty
        ) * self.config.coordination_bonus_weight

        return max(bonus, 0.0)

    def _measure_coordination(self, results: List[Dict[str, Any]]) -> float:
        """
        Measure coordination quality (0-1 scale).

        Args:
            results: Agent execution results

        Returns:
            Coordination score
        """
        if not results:
            return 0.0

        # Factors:
        # 1. Success rate
        success_rate = sum(1 for r in results if r.get('success', False)) / len(results)

        # 2. Information sharing
        sharing_rate = sum(1 for r in results if r.get('shared_context')) / len(results)

        # 3. Task diversity
        unique_tasks = len(set(r.get('task_type', 'general') for r in results))
        diversity = unique_tasks / max(len(results), 1)

        # Weighted average
        coordination = (
            success_rate * 0.5 +
            sharing_rate * 0.3 +
            diversity * 0.2
        )

        return coordination

    def _calculate_advantages(
        self,
        individual_rewards: List[float],
        group_reward: float
    ) -> List[float]:
        """
        Calculate per-agent advantage relative to group baseline.

        Args:
            individual_rewards: Rewards for each agent
            group_reward: Total group reward

        Returns:
            List of advantages (one per agent)
        """
        # Baseline: moving average of past group rewards
        baseline = np.mean(self.baseline_rewards[-100:]) if self.baseline_rewards else 0.0

        # Group advantage over baseline
        group_advantage = group_reward - baseline

        # Distribute group advantage based on individual contributions
        total_individual = sum(individual_rewards)
        advantages = []

        for reward in individual_rewards:
            contribution_ratio = reward / max(total_individual, 1e-6)
            advantage = reward + (group_advantage * contribution_ratio)
            advantages.append(advantage)

        return advantages

    async def _update_policy(
        self,
        agent: Any,
        advantage: float,
        episode: GroupEpisode
    ) -> None:
        """
        Update agent policy based on advantage.

        Args:
            agent: Agent to update
            advantage: Calculated advantage
            episode: Episode data
        """
        try:
            if hasattr(agent, 'update_policy_mgrpo'):
                await agent.update_policy_mgrpo(advantage, episode)
            else:
                # Store advantage for future LoRA update integration
                if not hasattr(agent, '_mgrpo_advantages'):
                    agent._mgrpo_advantages = []
                agent._mgrpo_advantages.append(advantage)

                logger.debug(f"Stored M-GRPO advantage {advantage:.3f} for {agent.__class__.__name__}")

        except Exception as e:
            logger.warning(f"Policy update failed for {agent.__class__.__name__}: {e}")

    def _update_metrics(self, episode: GroupEpisode) -> None:
        """Update training metrics"""
        self._training_metrics['total_episodes'] += 1
        if episode.success:
            self._training_metrics['successful_episodes'] += 1

        # Update running averages
        n = self._training_metrics['total_episodes']
        self._training_metrics['avg_group_reward'] = (
            (self._training_metrics['avg_group_reward'] * (n - 1) + episode.group_reward) / n
        )
        self._training_metrics['avg_coordination_score'] = (
            (self._training_metrics['avg_coordination_score'] * (n - 1) + episode.coordination_score) / n
        )

    def get_metrics(self) -> Dict[str, Any]:
        """Get training metrics"""
        success_rate = (
            self._training_metrics['successful_episodes'] /
            max(self._training_metrics['total_episodes'], 1)
        )

        return {
            **self._training_metrics,
            'success_rate': success_rate,
            'baseline_reward': np.mean(self.baseline_rewards[-100:]) if self.baseline_rewards else 0.0
        }

    async def save_episode_history(self, filepath: str) -> None:
        """Save episode history to file"""
        try:
            history_data = [
                {
                    'episode_id': ep.episode_id,
                    'task': ep.task_description,
                    'agents': ep.agent_group,
                    'group_reward': ep.group_reward,
                    'coordination_score': ep.coordination_score,
                    'success': ep.success,
                    'actions_count': len(ep.actions)
                }
                for ep in self.episode_history
            ]

            # P1 FIX: Validate filepath to prevent directory traversal
            filepath_obj = Path(filepath)
            if '..' in str(filepath_obj) or filepath_obj.is_absolute() and not str(filepath_obj).startswith(str(Path.cwd())):
                raise ValueError(f"Invalid filepath: {filepath}. Path traversal or absolute paths outside cwd not allowed.")

            filepath_obj.parent.mkdir(parents=True, exist_ok=True)
            
            # P1 FIX: Better error handling with specific error types
            try:
                with open(filepath_obj, 'w') as f:
                    json.dump({
                        'episodes': history_data,
                        'metrics': self.get_metrics()
                    }, f, indent=2)
            except PermissionError as e:
                logger.error(f"Permission denied saving episode history to {filepath}: {e}")
                raise
            except OSError as e:
                logger.error(f"OS error saving episode history to {filepath}: {e}")
                raise
            except json.JSONEncodeError as e:
                logger.error(f"JSON encoding error saving episode history: {e}")
                raise

            logger.info(f"Saved M-GRPO episode history to {filepath}")

        except ValueError as e:
            # Re-raise validation errors
            logger.error(f"Invalid filepath for episode history: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to save episode history to {filepath}: {e}", exc_info=True)
            raise


# Helper function for integration with ES training
async def hybrid_es_mgrpo_training(
    agent_pool: List[Any],
    es_config: Any,
    mgrpo_config: Optional[MGRPOConfig] = None,
    es_iterations: int = 3,
    mgrpo_episodes: int = 10
) -> Dict[str, Any]:
    """
    Run hybrid ES + M-GRPO training.

    Args:
        agent_pool: Available agents
        es_config: ES training configuration
        mgrpo_config: M-GRPO configuration
        es_iterations: ES training iterations
        mgrpo_episodes: M-GRPO training episodes

    Returns:
        Combined training results
    """
    results = {
        'es_results': None,
        'mgrpo_results': None,
        'hybrid_metrics': {}
    }

    # Phase 1: ES training (individual agent optimization)
    logger.info(f"Starting Phase 1: ES training ({es_iterations} iterations)")
    # ES training would go here - using existing nightly_es_training.py
    results['es_results'] = {'status': 'ES training integration pending'}

    # Phase 2: M-GRPO coordination training
    logger.info(f"Starting Phase 2: M-GRPO training ({mgrpo_episodes} episodes)")
    trainer = MGRPOTrainer(agent_pool, mgrpo_config)

    for i in range(mgrpo_episodes):
        # Sample complex task requiring multi-agent coordination
        task = {
            'description': f'Complex multi-agent task {i+1}',
            'type': 'multi-agent',
            'required_skills': ['builder', 'qa', 'deploy'],
            'success_criteria': ['all_components_pass', 'deployed']
        }

        episode = await trainer.train_episode(task)
        logger.info(f"M-GRPO Episode {i+1}/{mgrpo_episodes}: Reward={episode.group_reward:.2f}")

    results['mgrpo_results'] = trainer.get_metrics()

    # Save results
    await trainer.save_episode_history('metrics/mgrpo_episodes.json')

    return results


# Export
__all__ = [
    'MGRPOConfig',
    'MGRPOTrainer',
    'GroupEpisode',
    'hybrid_es_mgrpo_training',
]
