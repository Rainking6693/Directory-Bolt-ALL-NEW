"""
AgentEvolver Utility Functions

Shared utilities for all AgentEvolver components:
- Embedding generation with TEI client
- Similarity computation
- Data serialization
- Time-based operations

Author: Nova (Full-Stack Specialist)
Date: 2025-11-18
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import hashlib

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


class EmbeddingClient:
    """Wrapper around TEI embeddings client for AgentEvolver."""

    def __init__(self):
        """Initialize embedding client."""
        try:
            from infrastructure.tei_client import get_tei_client
            self.client = get_tei_client()
            self.available = True
        except Exception as e:
            logger.warning(f"TEI embeddings unavailable: {e}. Using fallback.")
            self.available = False
            self.client = None

    async def embed_text(self, text: str) -> Optional[List[float]]:
        """
        Embed a single text using TEI.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (or None if unavailable)
        """
        if not self.available or not self.client:
            return None

        try:
            result = await self.client.embed_single(text)
            return result
        except Exception as e:
            logger.debug(f"Failed to embed text: {e}")
            return None

    async def embed_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Embed multiple texts in parallel.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if not self.available or not self.client:
            return [None] * len(texts)

        try:
            tasks = [self.embed_text(text) for text in texts]
            results = await asyncio.gather(*tasks)
            return results
        except Exception as e:
            logger.debug(f"Failed to embed batch: {e}")
            return [None] * len(texts)


class SimilarityComputer:
    """Compute similarity between embeddings and business descriptions."""

    @staticmethod
    def cosine_similarity(vec1: Optional[List[float]], vec2: Optional[List[float]]) -> float:
        """
        Compute cosine similarity between two vectors.

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Similarity score (0-1)
        """
        if not vec1 or not vec2:
            return 0.0

        try:
            import numpy as np

            v1 = np.array(vec1)
            v2 = np.array(vec2)

            # Compute cosine similarity
            dot_product = np.dot(v1, v2)
            norm_v1 = np.linalg.norm(v1)
            norm_v2 = np.linalg.norm(v2)

            if norm_v1 == 0 or norm_v2 == 0:
                return 0.0

            return float(dot_product / (norm_v1 * norm_v2))
        except Exception as e:
            logger.debug(f"Failed to compute similarity: {e}")
            return 0.0

    @staticmethod
    def text_similarity(desc1: str, desc2: str) -> float:
        """
        Compute simple text similarity (fallback without embeddings).

        Args:
            desc1: First description
            desc2: Second description

        Returns:
            Similarity score (0-1) based on word overlap
        """
        if not desc1 or not desc2:
            return 0.0

        words1 = set(desc1.lower().split())
        words2 = set(desc2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0


class DataSerializer:
    """Serialize/deserialize AgentEvolver data."""

    @staticmethod
    def to_json(data: Any) -> str:
        """Convert data to JSON string."""
        try:
            return json.dumps(data, default=str)
        except Exception as e:
            logger.error(f"Failed to serialize to JSON: {e}")
            return "{}"

    @staticmethod
    def from_json(json_str: str) -> Dict[str, Any]:
        """Convert JSON string to data."""
        try:
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"Failed to deserialize from JSON: {e}")
            return {}

    @staticmethod
    def to_jsonl(items: List[Dict[str, Any]]) -> str:
        """Convert list of items to JSONL format."""
        lines = [DataSerializer.to_json(item) for item in items]
        return "\n".join(lines)

    @staticmethod
    def from_jsonl(jsonl_str: str) -> List[Dict[str, Any]]:
        """Convert JSONL string to list of items."""
        items = []
        for line in jsonl_str.strip().split("\n"):
            if line.strip():
                item = DataSerializer.from_json(line)
                if item:
                    items.append(item)
        return items


class IdGenerator:
    """Generate unique IDs for entities."""

    @staticmethod
    def trajectory_id() -> str:
        """Generate unique trajectory ID."""
        timestamp = datetime.utcnow().isoformat()
        hash_val = hashlib.md5(timestamp.encode()).hexdigest()[:8]
        return f"traj_{timestamp.replace(':', '-')}_{hash_val}"

    @staticmethod
    def scenario_id() -> str:
        """Generate unique scenario ID."""
        timestamp = datetime.utcnow().isoformat()
        hash_val = hashlib.md5(timestamp.encode()).hexdigest()[:8]
        return f"scenario_{timestamp.replace(':', '-')}_{hash_val}"

    @staticmethod
    def experience_id() -> str:
        """Generate unique experience ID."""
        timestamp = datetime.utcnow().isoformat()
        hash_val = hashlib.md5(timestamp.encode()).hexdigest()[:8]
        return f"exp_{timestamp.replace(':', '-')}_{hash_val}"

    @staticmethod
    def hash_content(content: str) -> str:
        """Generate hash of content."""
        return hashlib.md5(content.encode()).hexdigest()


class TimeHelper:
    """Time-based operations."""

    @staticmethod
    def current_timestamp() -> str:
        """Get current timestamp in ISO format."""
        return datetime.utcnow().isoformat()

    @staticmethod
    def timestamp_diff_seconds(ts1: str, ts2: str) -> float:
        """
        Compute difference between two timestamps in seconds.

        Args:
            ts1: First timestamp (ISO format)
            ts2: Second timestamp (ISO format)

        Returns:
            Difference in seconds
        """
        try:
            dt1 = datetime.fromisoformat(ts1)
            dt2 = datetime.fromisoformat(ts2)
            delta = abs((dt2 - dt1).total_seconds())
            return delta
        except Exception:
            return 0.0


class MetricsHelper:
    """Helper for computing metrics."""

    @staticmethod
    def compute_coverage(explored: int, total: int) -> float:
        """
        Compute coverage percentage.

        Args:
            explored: Number of items explored
            total: Total number of items

        Returns:
            Coverage percentage (0-1)
        """
        if total <= 0:
            return 0.0
        return min(explored / total, 1.0)

    @staticmethod
    def compute_success_rate(successes: int, total: int) -> float:
        """
        Compute success rate.

        Args:
            successes: Number of successes
            total: Total attempts

        Returns:
            Success rate (0-1)
        """
        if total <= 0:
            return 0.0
        return min(successes / total, 1.0)

    @staticmethod
    def compute_average_quality(qualities: List[float]) -> float:
        """
        Compute average quality score.

        Args:
            qualities: List of quality scores

        Returns:
            Average score (0-100)
        """
        if not qualities:
            return 0.0
        return sum(qualities) / len(qualities)

    @staticmethod
    def compute_diversity(descriptions: List[str]) -> float:
        """
        Compute diversity of descriptions (0-1).

        Uses simple word overlap metric.

        Args:
            descriptions: List of descriptions

        Returns:
            Diversity score (0-1)
        """
        if len(descriptions) < 2:
            return 1.0

        similarities = []
        for i in range(len(descriptions)):
            for j in range(i + 1, len(descriptions)):
                sim = SimilarityComputer.text_similarity(descriptions[i], descriptions[j])
                similarities.append(sim)

        if not similarities:
            return 1.0

        avg_similarity = sum(similarities) / len(similarities)
        # Diversity = 1 - average_similarity
        return 1.0 - avg_similarity


# Global clients
_embedding_client: Optional[EmbeddingClient] = None


def get_embedding_client() -> EmbeddingClient:
    """Get or create global embedding client."""
    global _embedding_client
    if _embedding_client is None:
        _embedding_client = EmbeddingClient()
    return _embedding_client


def get_similarity_computer() -> SimilarityComputer:
    """Get similarity computer (stateless)."""
    return SimilarityComputer()


def get_data_serializer() -> DataSerializer:
    """Get data serializer (stateless)."""
    return DataSerializer()
