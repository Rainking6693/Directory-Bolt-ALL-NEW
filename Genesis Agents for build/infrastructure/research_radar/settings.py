"""Research Radar settings and configuration."""

from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class SourceConfig:
    """Configuration for a research source."""

    name: str
    type: str  # "api", "rss", "scraper"
    url: str
    enabled: bool = True
    params: dict = None  # noqa: ANN001

    def __post_init__(self):
        """Initialize default params."""
        if self.params is None:
            self.params = {}


@dataclass
class ResearchRadarSettings:
    """Settings for Research Radar pipeline."""

    root: Path
    raw_dir: Path
    embeddings_dir: Path
    reports_dir: Path
    logs_dir: Path
    cache_dir: Path
    dashboard_path: Path
    sources: List[SourceConfig]
    embedding_model: str = "all-MiniLM-L6-v2"
    clustering_algorithm: str = "dbscan"  # "dbscan" or "kmeans"
    min_cluster_size: int = 3
    min_samples: int = 2

    def __post_init__(self):
        """Create directories if they don't exist."""
        for dir_path in [
            self.root,
            self.raw_dir,
            self.embeddings_dir,
            self.reports_dir,
            self.logs_dir,
            self.cache_dir,
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

