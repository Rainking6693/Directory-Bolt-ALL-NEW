"""
Particle Swarm Optimization (PSO) for Team Composition

Based on:
- SwarmAgentic (arXiv:2506.15672) - 261.8% improvement over manual design
- Inclusive Fitness (Rosseau et al., 2025) - Genotype-based cooperation

PSO Algorithm:
1. Initialize N particles (team compositions)
2. Evaluate fitness using Inclusive Fitness scoring
3. Update particle velocities toward personal best and global best
4. Apply discrete updates (agent selection is binary, not continuous)
5. Converge to optimal team composition

Key Innovation: Discrete PSO for agent selection (not traditional continuous PSO)

Enhancement: Restart mechanisms for escaping local optima
- Stagnation detection monitors fitness improvement over time
- Partial particle reset reinitializes worst performers
- Restart tokens issued when stagnation detected

Version: 1.1
Last Updated: November 12, 2025
"""

import os
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass, field
import numpy as np
import logging

from infrastructure.swarm.inclusive_fitness import (
    Agent,
    TaskRequirement,
    InclusiveFitnessSwarm,
)

logger = logging.getLogger(__name__)


@dataclass
class TeamParticle:
    """
    Particle representing a team composition in PSO.

    Attributes:
        position: Binary vector (1=agent selected, 0=not selected)
        velocity: Continuous velocity for position updates
        fitness: Current fitness score
        best_position: Personal best position
        best_fitness: Personal best fitness
    """
    position: np.ndarray
    velocity: np.ndarray
    fitness: float = 0.0
    best_position: np.ndarray = field(default=None)
    best_fitness: float = 0.0

    def __post_init__(self):
        if self.best_position is None:
            self.best_position = self.position.copy()


MAX_ALLOWED_ITERATIONS = 1000


class ParticleSwarmOptimizer:
    """
    Discrete Particle Swarm Optimization for team composition.

    Optimizes team selection using PSO with discrete agent selection.

    PSO Parameters:
    - w (inertia): 0.7 (balance exploration/exploitation)
    - c1 (cognitive): 1.5 (personal best attraction)
    - c2 (social): 1.5 (global best attraction)

    Convergence Criteria:
    - Max iterations reached
    - Fitness plateau (no improvement for 10 iterations)
    - Excellent fitness (>0.95)
    """

    def __init__(
        self,
        swarm: InclusiveFitnessSwarm,
        n_particles: int = 20,
        max_iterations: int = 100,
        w: float = 0.7,
        c1: float = 1.5,
        c2: float = 1.5,
        random_seed: Optional[int] = None
    ):
        """
        Initialize Particle Swarm Optimizer.

        Args:
            swarm: InclusiveFitnessSwarm instance
            n_particles: Number of particles (team candidates)
            max_iterations: Maximum iterations
            w: Inertia weight (0.0-1.0)
            c1: Cognitive parameter (personal best)
            c2: Social parameter (global best)
            random_seed: Random seed for reproducibility
        """
        self.swarm = swarm
        self.n_particles = n_particles
        if max_iterations < 1 or max_iterations > MAX_ALLOWED_ITERATIONS:
            raise ValueError(
                f"max_iterations must be between 1 and {MAX_ALLOWED_ITERATIONS}, got {max_iterations}"
            )

        self.max_iterations = max_iterations
        self.w = w
        self.c1 = c1
        self.c2 = c2
        self.random_seed = random_seed

        if random_seed is not None:
            np.random.seed(random_seed)

        # Number of agents
        self.n_agents = len(swarm.agents)

        # Global best
        self.global_best_position: Optional[np.ndarray] = None
        self.global_best_fitness: float = 0.0

        # Optimization history
        self.fitness_history: List[float] = []
        self.teams_history: List[Tuple[List[Agent], float]] = []

        # Restart mechanism configuration (loaded from environment with validation)
        restart_patience = int(os.getenv('PSO_RESTART_PATIENCE', '10'))
        self.restart_patience = max(1, min(restart_patience, 100))  # Clamp to [1, 100]

        restart_fraction = float(os.getenv('PSO_RESTART_FRACTION', '0.3'))
        self.restart_fraction = max(0.1, min(restart_fraction, 0.9))  # Clamp to [0.1, 0.9]

        stagnation_threshold = float(os.getenv('PSO_STAGNATION_THRESHOLD', '0.001'))
        self.stagnation_threshold = max(0.0001, min(stagnation_threshold, 0.1))  # Clamp to [0.0001, 0.1]

        self.best_fitness_history: List[float] = []
        self.stagnation_count = 0

        logger.info(
            f"ParticleSwarmOptimizer initialized: "
            f"n_particles={n_particles}, max_iter={max_iterations}, "
            f"w={w}, c1={c1}, c2={c2}, n_agents={self.n_agents}, "
            f"restart_patience={self.restart_patience}, "
            f"restart_fraction={self.restart_fraction}, "
            f"stagnation_threshold={self.stagnation_threshold}"
        )

    def _initialize_particles(self, task: TaskRequirement) -> List[TeamParticle]:
        """
        Initialize particles with random team compositions.

        Args:
            task: TaskRequirement object

        Returns:
            List of TeamParticle objects
        """
        particles = []
        min_size, max_size = task.team_size_range
        max_size = min(max_size, self.n_agents)

        for _ in range(self.n_particles):
            # Random team size
            team_size = np.random.randint(min_size, max_size + 1)

            # Random agent selection (binary vector)
            position = np.zeros(self.n_agents)
            selected_indices = np.random.choice(
                self.n_agents,
                size=team_size,
                replace=False
            )
            position[selected_indices] = 1.0

            # Random velocity
            velocity = np.random.uniform(-1.0, 1.0, size=self.n_agents)

            particle = TeamParticle(
                position=position,
                velocity=velocity,
                fitness=0.0,
                best_position=position.copy(),
                best_fitness=0.0
            )

            particles.append(particle)

        return particles

    def _validate_task_requirement(self, task: TaskRequirement) -> None:
        min_size, max_size = task.team_size_range
        available_agents = self.n_agents

        if min_size < 1:
            raise ValueError(f"Team size minimum must be at least 1 (got {min_size})")
        if max_size < min_size:
            raise ValueError(
                f"Team size maximum ({max_size}) must be greater than or equal to minimum ({min_size})"
            )
        if max_size > available_agents:
            raise ValueError(
                f"Requested maximum team size ({max_size}) exceeds available agents ({available_agents})"
            )
        if len(task.required_capabilities) > 100:
            raise ValueError("Too many required capabilities specified (max 100)")

    def _decode_team(self, position: np.ndarray) -> List[Agent]:
        """
        Decode binary position vector to team of agents.

        Args:
            position: Binary vector (1=selected, 0=not selected)

        Returns:
            List of Agent objects
        """
        selected_indices = np.where(position > 0.5)[0]
        team = [self.swarm.agents[i] for i in selected_indices]
        return team

    def _evaluate_particle(
        self,
        particle: TeamParticle,
        task: TaskRequirement
    ) -> float:
        """
        Evaluate particle fitness.

        Args:
            particle: TeamParticle object
            task: TaskRequirement object

        Returns:
            Fitness score (0.0-1.0)
        """
        team = self._decode_team(particle.position)
        fitness = self.swarm.evaluate_team_fitness(team, task, verbose=False)
        return fitness

    def _update_velocity(
        self,
        particle: TeamParticle,
        iteration: int
    ) -> np.ndarray:
        """
        Update particle velocity using PSO formula.

        v_new = w*v + c1*r1*(p_best - x) + c2*r2*(g_best - x)

        Args:
            particle: TeamParticle object
            iteration: Current iteration number

        Returns:
            Updated velocity
        """
        # Random coefficients
        r1 = np.random.random(self.n_agents)
        r2 = np.random.random(self.n_agents)

        # PSO velocity update
        cognitive = self.c1 * r1 * (particle.best_position - particle.position)
        social = self.c2 * r2 * (self.global_best_position - particle.position)

        velocity = self.w * particle.velocity + cognitive + social

        # Velocity clamping (-4 to +4)
        velocity = np.clip(velocity, -4.0, 4.0)

        return velocity

    def _update_position(
        self,
        particle: TeamParticle,
        task: TaskRequirement
    ) -> np.ndarray:
        """
        Update particle position using sigmoid transfer function.

        Discrete PSO: Use sigmoid to convert continuous velocity to
        probability of agent selection.

        Args:
            particle: TeamParticle object
            task: TaskRequirement object

        Returns:
            Updated position (binary vector)
        """
        # Sigmoid transfer function
        sigmoid = 1.0 / (1.0 + np.exp(-particle.velocity))

        # Probabilistic selection
        random_vals = np.random.random(self.n_agents)
        new_position = (random_vals < sigmoid).astype(float)

        # Enforce team size constraints
        min_size, max_size = task.team_size_range
        team_size = int(new_position.sum())

        if team_size < min_size:
            # Add random agents
            available_indices = np.where(new_position == 0)[0]
            n_to_add = min_size - team_size
            if len(available_indices) >= n_to_add:
                add_indices = np.random.choice(
                    available_indices,
                    size=n_to_add,
                    replace=False
                )
                new_position[add_indices] = 1.0

        elif team_size > max_size:
            # Remove random agents
            selected_indices = np.where(new_position == 1)[0]
            n_to_remove = team_size - max_size
            remove_indices = np.random.choice(
                selected_indices,
                size=n_to_remove,
                replace=False
            )
            new_position[remove_indices] = 0.0

        return new_position

    def _check_convergence(self, iteration: int) -> bool:
        """
        Check convergence criteria.

        Convergence conditions:
        1. Max iterations reached
        2. Fitness plateau (no improvement for 10 iterations)
        3. Excellent fitness (>0.95)

        Args:
            iteration: Current iteration number

        Returns:
            True if converged, False otherwise
        """
        # Condition 1: Max iterations
        if iteration >= self.max_iterations:
            logger.info(f"Converged: Max iterations ({self.max_iterations}) reached")
            return True

        # Condition 2: Fitness plateau
        if len(self.fitness_history) >= 10:
            recent_fitness = self.fitness_history[-10:]
            if max(recent_fitness) - min(recent_fitness) < 0.001:
                logger.info(f"Converged: Fitness plateau detected (iteration {iteration})")
                return True

        # Condition 3: Excellent fitness
        if self.global_best_fitness > 0.95:
            logger.info(
                f"Converged: Excellent fitness ({self.global_best_fitness:.3f}) "
                f"reached at iteration {iteration}"
            )
            return True

        return False

    def _check_stagnation(self, current_best_fitness: float) -> bool:
        """
        Check if optimization has stagnated (no significant improvement).

        Stagnation is detected when fitness improvement over the last N iterations
        falls below a threshold, where N is determined by restart_patience.

        Args:
            current_best_fitness: Current best fitness value

        Returns:
            True if stagnation detected, False otherwise
        """
        # Add current fitness to history
        self.best_fitness_history.append(current_best_fitness)

        # Need at least restart_patience iterations to detect stagnation
        if len(self.best_fitness_history) < self.restart_patience:
            return False

        # Get recent fitness values (last N iterations)
        recent_fitness = self.best_fitness_history[-self.restart_patience:]

        # Calculate improvement (max - min over window)
        improvement = max(recent_fitness) - min(recent_fitness)

        # Check if improvement is below threshold
        if improvement < self.stagnation_threshold:
            self.stagnation_count += 1
            logger.warning(
                f"⚠️  Stagnation detected (count={self.stagnation_count}): "
                f"improvement={improvement:.6f} < threshold={self.stagnation_threshold}"
            )
            return True

        # Reset stagnation count if improvement is sufficient
        self.stagnation_count = 0
        return False

    def _issue_restart_token(
        self,
        particles: List[TeamParticle],
        task: TaskRequirement
    ) -> List[TeamParticle]:
        """
        Issue restart token by resetting worst-performing particles.

        Partial restart strategy:
        1. Sort particles by fitness (worst first)
        2. Reset worst restart_fraction of particles
        3. Reinitialize position randomly
        4. Reset velocity
        5. Reset personal best

        Args:
            particles: List of TeamParticle objects
            task: TaskRequirement for team size constraints

        Returns:
            List of particles with worst performers reset
        """
        # Calculate number of particles to reset
        num_reset = max(1, int(len(particles) * self.restart_fraction))

        # Sort particles by fitness (worst first)
        sorted_particles = sorted(particles, key=lambda p: p.fitness)

        # Get worst performers
        worst_particles = sorted_particles[:num_reset]

        logger.info(
            f"🔄 Issuing restart token: resetting {num_reset}/{len(particles)} particles"
        )

        # Reset worst performers
        min_size, max_size = task.team_size_range
        max_size = min(max_size, self.n_agents)

        for particle in worst_particles:
            # Random team size
            team_size = np.random.randint(min_size, max_size + 1)

            # Random agent selection (binary vector)
            new_position = np.zeros(self.n_agents)
            selected_indices = np.random.choice(
                self.n_agents,
                size=team_size,
                replace=False
            )
            new_position[selected_indices] = 1.0

            # Random velocity
            new_velocity = np.random.uniform(-1.0, 1.0, size=self.n_agents)

            # Reset particle
            particle.position = new_position
            particle.velocity = new_velocity
            particle.best_position = new_position.copy()
            particle.best_fitness = 0.0
            particle.fitness = 0.0

        logger.info(
            f"✅ Restart token issued: {num_reset} particles reinitialized"
        )

        return particles

    def optimize_team(
        self,
        task: TaskRequirement,
        verbose: bool = False
    ) -> Tuple[List[Agent], float]:
        """
        Optimize team composition using PSO.

        Args:
            task: TaskRequirement object
            verbose: Print optimization progress

        Returns:
            Tuple of (best_team, best_fitness)
        """
        self._validate_task_requirement(task)

        logger.info(f"Starting PSO optimization for task {task.task_id}")

        # Initialize particles
        particles = self._initialize_particles(task)

        # Evaluate initial particles
        for particle in particles:
            fitness = self._evaluate_particle(particle, task)
            particle.fitness = fitness
            particle.best_fitness = fitness

            # Update global best
            if fitness > self.global_best_fitness:
                self.global_best_fitness = fitness
                self.global_best_position = particle.position.copy()

        # PSO main loop
        for iteration in range(self.max_iterations):
            for particle in particles:
                # Update velocity
                particle.velocity = self._update_velocity(particle, iteration)

                # Update position
                particle.position = self._update_position(particle, task)

                # Evaluate new position
                fitness = self._evaluate_particle(particle, task)
                particle.fitness = fitness

                # Update personal best
                if fitness > particle.best_fitness:
                    particle.best_fitness = fitness
                    particle.best_position = particle.position.copy()

                # Update global best
                if fitness > self.global_best_fitness:
                    self.global_best_fitness = fitness
                    self.global_best_position = particle.position.copy()

            # Track history
            self.fitness_history.append(self.global_best_fitness)

            # Track team history
            best_team = self._decode_team(self.global_best_position)
            self.teams_history.append((best_team, self.global_best_fitness))

            # Check for stagnation and issue restart token if needed
            if self._check_stagnation(self.global_best_fitness):
                particles = self._issue_restart_token(particles, task)
                # Re-evaluate reset particles
                for particle in particles:
                    if particle.fitness == 0.0:  # Particle was reset
                        fitness = self._evaluate_particle(particle, task)
                        particle.fitness = fitness
                        particle.best_fitness = fitness
                        # Update global best if reset particle found better solution
                        if fitness > self.global_best_fitness:
                            self.global_best_fitness = fitness
                            self.global_best_position = particle.position.copy()

            if verbose and (iteration % 10 == 0 or iteration == self.max_iterations - 1):
                logger.info(
                    f"Iteration {iteration}: best_fitness={self.global_best_fitness:.3f}, "
                    f"team_size={len(best_team)}"
                )

            # Check convergence
            if self._check_convergence(iteration):
                break

        # Decode best team
        best_team = self._decode_team(self.global_best_position)

        logger.info(
            f"PSO optimization completed: "
            f"best_fitness={self.global_best_fitness:.3f}, "
            f"team_size={len(best_team)}, "
            f"iterations={len(self.fitness_history)}"
        )

        return best_team, self.global_best_fitness

    def get_optimization_stats(self) -> Dict:
        """
        Get optimization statistics.

        Returns:
            Dict with stats (iterations, convergence, emergent strategies)
        """
        return {
            "iterations": len(self.fitness_history),
            "final_fitness": self.global_best_fitness,
            "convergence_iteration": len(self.fitness_history),
            "fitness_history": self.fitness_history.copy(),
        }

    def detect_emergent_strategies(self) -> List[str]:
        """
        Detect emergent strategies from optimization history.

        Returns:
            List of emergent strategy descriptions
        """
        return self.swarm.detect_emergent_strategies(self.teams_history)


def get_pso_optimizer(
    swarm: InclusiveFitnessSwarm,
    n_particles: int = 20,
    max_iterations: int = 100,
    random_seed: Optional[int] = None
) -> ParticleSwarmOptimizer:
    """
    Factory function to create ParticleSwarmOptimizer.

    Args:
        swarm: InclusiveFitnessSwarm instance
        n_particles: Number of particles
        max_iterations: Maximum iterations
        random_seed: Random seed for reproducibility

    Returns:
        ParticleSwarmOptimizer instance
    """
    return ParticleSwarmOptimizer(
        swarm=swarm,
        n_particles=n_particles,
        max_iterations=max_iterations,
        random_seed=random_seed
    )
