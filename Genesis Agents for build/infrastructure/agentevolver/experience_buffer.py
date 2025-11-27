"""
AgentEvolver Phase 2: Experience Buffer (Experience Reuse)

Stores and retrieves successful agent trajectories for experience reuse.

Key Features:
- Index trajectories by task type
- Store state-action sequences with quality scores
- Semantic similarity search (using TEI embeddings)
- Store 10,000 top trajectories

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
Integration: AgentEvolver Phase 2
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path

from infrastructure.load_env import load_genesis_env
from infrastructure.agentevolver.config import (
    EXPERIENCE_BUFFER_SIZE,
    EXPERIENCE_STORAGE_PATH,
    TOP_SIMILAR_TRAJECTORIES,
)
from infrastructure.agentevolver.utils import (
    EmbeddingClient,
    SimilarityComputer,
    DataSerializer,
    IdGenerator,
    TimeHelper,
)

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class Experience:
    """A stored experience (successful trajectory)."""
    experience_id: str
    task_type: str  # deployment, content_generation, seo, etc.
    description: str  # Task description
    state: Dict[str, Any]  # Initial state
    actions: List[Dict[str, Any]]  # Sequence of actions taken
    outcome: Dict[str, Any]  # Final outcome
    quality_score: float  # 0-100
    embedding: Optional[List[float]] = None  # Semantic embedding
    created_at: str = field(default_factory=TimeHelper.current_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Experience":
        """Create from dictionary."""
        return cls(
            experience_id=data.get("experience_id", ""),
            task_type=data.get("task_type", ""),
            description=data.get("description", ""),
            state=data.get("state", {}),
            actions=data.get("actions", []),
            outcome=data.get("outcome", {}),
            quality_score=data.get("quality_score", 0.0),
            embedding=data.get("embedding"),
            created_at=data.get("created_at", TimeHelper.current_timestamp()),
        )


class ExperienceBuffer:
    """
    Stores and retrieves successful agent experiences for reuse.

    Maintains top 10,000 trajectories sorted by quality.
    """

    def __init__(self, max_size: int = EXPERIENCE_BUFFER_SIZE):
        """
        Initialize experience buffer.

        Args:
            max_size: Maximum number of experiences to store
        """
        self.max_size = max_size
        self.experiences: Dict[str, Experience] = {}
        self.task_type_index: Dict[str, List[str]] = {}  # task_type -> [exp_ids]
        self.embedding_client = EmbeddingClient()
        self.similarity_computer = SimilarityComputer()
        self.storage_path = Path(EXPERIENCE_STORAGE_PATH)

        # Create storage directory
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        self._load_from_storage()

        logger.info(
            f"ExperienceBuffer initialized with {len(self.experiences)} "
            f"experiences (max_size={max_size})"
        )

    def add_experience(self, experience: Experience) -> None:
        """
        Add an experience to the buffer.

        If buffer is full, remove lowest-quality experience.

        Args:
            experience: Experience to add
        """
        # Check if buffer is full
        if len(self.experiences) >= self.max_size:
            # Remove lowest quality experience
            min_id = min(
                self.experiences.keys(),
                key=lambda k: self.experiences[k].quality_score,
            )
            self._remove_experience(min_id)

        # Add experience
        self.experiences[experience.experience_id] = experience

        # Update task type index
        if experience.task_type not in self.task_type_index:
            self.task_type_index[experience.task_type] = []
        self.task_type_index[experience.task_type].append(experience.experience_id)

        logger.debug(
            f"Added experience '{experience.experience_id}' "
            f"(task_type={experience.task_type}, quality={experience.quality_score:.1f})"
        )

        # Auto-save
        self._save_to_storage()

    def _remove_experience(self, experience_id: str) -> None:
        """Remove an experience from the buffer."""
        if experience_id not in self.experiences:
            return

        experience = self.experiences.pop(experience_id)

        # Update task type index
        if experience.task_type in self.task_type_index:
            self.task_type_index[experience.task_type].remove(experience_id)
            if not self.task_type_index[experience.task_type]:
                del self.task_type_index[experience.task_type]

    def get_experience(self, experience_id: str) -> Optional[Experience]:
        """Get a specific experience by ID."""
        return self.experiences.get(experience_id)

    def get_by_task_type(self, task_type: str, limit: int = 10) -> List[Experience]:
        """
        Get experiences for a specific task type.

        Args:
            task_type: Type of task
            limit: Maximum number to return

        Returns:
            List of experiences sorted by quality (highest first)
        """
        exp_ids = self.task_type_index.get(task_type, [])
        exps = [self.experiences[eid] for eid in exp_ids if eid in self.experiences]

        # Sort by quality (highest first)
        exps.sort(key=lambda e: e.quality_score, reverse=True)

        return exps[:limit]

    async def find_similar(
        self,
        query_description: str,
        task_type: Optional[str] = None,
        limit: int = TOP_SIMILAR_TRAJECTORIES,
    ) -> List[Tuple[Experience, float]]:
        """
        Find similar experiences using semantic search.

        Args:
            query_description: Description of task to find matches for
            task_type: Optional filter by task type
            limit: Maximum number of results

        Returns:
            List of (Experience, similarity_score) tuples
        """
        if not self.experiences:
            return []

        # Get embedding for query
        query_embedding = await self.embedding_client.embed_text(query_description)

        # Compute similarities
        similarities: List[Tuple[str, float]] = []

        for exp_id, experience in self.experiences.items():
            # Filter by task type if specified
            if task_type and experience.task_type != task_type:
                continue

            # Compute similarity
            if query_embedding and experience.embedding:
                similarity = self.similarity_computer.cosine_similarity(
                    query_embedding,
                    experience.embedding,
                )
            else:
                # Fallback to text similarity
                similarity = self.similarity_computer.text_similarity(
                    query_description,
                    experience.description,
                )

            similarities.append((exp_id, similarity))

        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x[1], reverse=True)

        # Return top-K with their scores
        results = []
        for exp_id, similarity in similarities[:limit]:
            experience = self.experiences[exp_id]
            results.append((experience, similarity))

        return results

    async def enrich_with_embeddings(self) -> None:
        """
        Add embeddings to all experiences that don't have them.

        Uses batch embedding for efficiency.
        """
        # Find experiences without embeddings
        to_embed = [
            (exp_id, exp)
            for exp_id, exp in self.experiences.items()
            if exp.embedding is None
        ]

        if not to_embed:
            logger.info("All experiences already have embeddings")
            return

        logger.info(f"Enriching {len(to_embed)} experiences with embeddings...")

        # Batch embed descriptions
        descriptions = [exp.description for _, exp in to_embed]
        embeddings = await self.embedding_client.embed_batch(descriptions)

        # Update experiences
        for (exp_id, experience), embedding in zip(to_embed, embeddings):
            if embedding:
                experience.embedding = embedding

        self._save_to_storage()
        logger.info(f"Enriched {len(to_embed)} experiences with embeddings")

    def get_statistics(self) -> Dict[str, Any]:
        """Get buffer statistics."""
        if not self.experiences:
            return {
                "total_experiences": 0,
                "buffer_utilization": 0.0,
                "avg_quality": 0.0,
                "task_type_distribution": {},
            }

        qualities = [exp.quality_score for exp in self.experiences.values()]
        avg_quality = sum(qualities) / len(qualities) if qualities else 0.0

        # Count by task type
        task_distribution = {}
        for task_type, ids in self.task_type_index.items():
            task_distribution[task_type] = len(ids)

        return {
            "total_experiences": len(self.experiences),
            "buffer_utilization": len(self.experiences) / self.max_size,
            "avg_quality": avg_quality,
            "min_quality": min(qualities) if qualities else 0.0,
            "max_quality": max(qualities) if qualities else 0.0,
            "task_type_distribution": task_distribution,
        }

    def _save_to_storage(self) -> None:
        """Save buffer to disk."""
        try:
            data = {
                "timestamp": TimeHelper.current_timestamp(),
                "experiences": [exp.to_dict() for exp in self.experiences.values()],
            }

            serializer = DataSerializer()
            json_str = serializer.to_json(data)

            self.storage_path.write_text(json_str)
            logger.debug(f"Saved {len(self.experiences)} experiences to {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to save buffer: {e}")

    def _load_from_storage(self) -> None:
        """Load buffer from disk."""
        try:
            if not self.storage_path.exists():
                logger.info(f"Storage file doesn't exist yet: {self.storage_path}")
                return

            json_str = self.storage_path.read_text()
            serializer = DataSerializer()
            data = serializer.from_json(json_str)

            experiences_data = data.get("experiences", [])

            for exp_data in experiences_data:
                experience = Experience.from_dict(exp_data)
                self.experiences[experience.experience_id] = experience

                # Update index
                if experience.task_type not in self.task_type_index:
                    self.task_type_index[experience.task_type] = []
                self.task_type_index[experience.task_type].append(experience.experience_id)

            logger.info(f"Loaded {len(self.experiences)} experiences from storage")

        except Exception as e:
            logger.warning(f"Failed to load buffer from storage: {e}")

    def clear(self) -> None:
        """Clear all experiences."""
        self.experiences.clear()
        self.task_type_index.clear()
        self._save_to_storage()
        logger.info("Cleared experience buffer")


def create_experience_from_trajectory(
    task_type: str,
    description: str,
    state: Dict[str, Any],
    actions: List[Dict[str, Any]],
    outcome: Dict[str, Any],
    quality_score: float,
) -> Experience:
    """
    Create an Experience from trajectory data.

    Args:
        task_type: Type of task
        description: Task description
        state: Initial state
        actions: Sequence of actions
        outcome: Final outcome
        quality_score: Quality score (0-100)

    Returns:
        Experience object
    """
    return Experience(
        experience_id=IdGenerator.experience_id(),
        task_type=task_type,
        description=description,
        state=state,
        actions=actions,
        outcome=outcome,
        quality_score=quality_score,
    )


def get_experience_buffer(
    max_size: int = EXPERIENCE_BUFFER_SIZE,
) -> ExperienceBuffer:
    """Get or create global experience buffer."""
    return ExperienceBuffer(max_size)
