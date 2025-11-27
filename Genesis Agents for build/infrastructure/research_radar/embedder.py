"""Research Radar embedder for generating embeddings from research content."""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore

from .settings import ResearchRadarSettings

logger = logging.getLogger(__name__)


class ResearchRadarEmbedder:
    """Embedder for generating vector embeddings from research content."""

    def __init__(self, settings: ResearchRadarSettings):
        """Initialize embedder with settings."""
        self.settings = settings
        self.model = None
        if SentenceTransformer:
            try:
                self.model = SentenceTransformer(self.settings.embedding_model)
            except Exception as e:
                logger.warning(f"Failed to load embedding model: {e}")

    def run(self, date_folder: str) -> bool:
        """
        Generate embeddings for all records in the given date folder.

        Args:
            date_folder: Date folder name (YYYYMMDD format)

        Returns:
            True if embeddings were generated successfully
        """
        raw_dir = self.settings.raw_dir / date_folder
        raw_file = raw_dir / "raw_records.jsonl"

        if not raw_file.exists():
            logger.error(f"Raw records file not found: {raw_file}")
            return False

        # Load records
        records = []
        with open(raw_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))

        if not records:
            logger.warning(f"No records found in {raw_file}")
            return False

        # Generate embeddings
        embeddings_dir = self.settings.embeddings_dir / date_folder
        embeddings_dir.mkdir(parents=True, exist_ok=True)

        embedded_records = []
        for record in records:
            # Create text for embedding (title + summary)
            text = f"{record.get('title', '')} {record.get('summary', '')}".strip()

            if self.model:
                embedding = self.model.encode(text, convert_to_numpy=True).tolist()
            else:
                # Fallback: dummy embedding
                embedding = [0.0] * 384

            embedded_record = {
                **record,
                "embedding": embedding,
                "text": text,
            }
            embedded_records.append(embedded_record)

        # Save embedded records
        embeddings_file = embeddings_dir / "embedded_records.jsonl"
        with open(embeddings_file, "w", encoding="utf-8") as f:
            for record in embedded_records:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

        logger.info(f"Generated embeddings for {len(embedded_records)} records")
        return True

