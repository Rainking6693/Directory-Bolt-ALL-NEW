"""Research Radar clusterer for trend detection."""

import json
import logging
from pathlib import Path
from typing import Dict, List

try:
    import numpy as np
    from sklearn.cluster import DBSCAN, KMeans
except ImportError:
    DBSCAN = None  # type: ignore
    KMeans = None  # type: ignore
    np = None  # type: ignore

from .settings import ResearchRadarSettings

logger = logging.getLogger(__name__)


class ResearchRadarClusterer:
    """Clusterer for detecting trends in research content."""

    def __init__(self, settings: ResearchRadarSettings):
        """Initialize clusterer with settings."""
        self.settings = settings

    def run(self, date_folder: str) -> Dict:
        """
        Cluster research items and detect trends.

        Args:
            date_folder: Date folder name (YYYYMMDD format)

        Returns:
            Dict with clusters and trends
        """
        embeddings_dir = self.settings.embeddings_dir / date_folder
        embeddings_file = embeddings_dir / "embedded_records.jsonl"

        if not embeddings_file.exists():
            logger.error(f"Embeddings file not found: {embeddings_file}")
            return {"trends": [], "clusters": []}

        # Load embedded records
        records = []
        with open(embeddings_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))

        if not records:
            logger.warning(f"No embedded records found")
            return {"trends": [], "clusters": []}

        # Extract embeddings
        embeddings = [record["embedding"] for record in records]

        if np is None or len(embeddings) == 0:
            # Fallback: single cluster with all items
            clusters = [{"id": 0, "items": records, "size": len(records)}]
            trends = self._extract_trends(clusters)
            return {"trends": trends, "clusters": clusters}

        # Convert to numpy array
        X = np.array(embeddings)

        # Perform clustering
        if self.settings.clustering_algorithm == "dbscan" and DBSCAN:
            clusterer = DBSCAN(
                eps=0.5,
                min_samples=self.settings.min_samples,
                metric="cosine",
            )
            labels = clusterer.fit_predict(X)
        elif self.settings.clustering_algorithm == "kmeans" and KMeans:
            n_clusters = min(5, len(records) // self.settings.min_cluster_size)
            if n_clusters < 2:
                n_clusters = 2
            clusterer = KMeans(n_clusters=n_clusters, random_state=42)
            labels = clusterer.fit_predict(X)
        else:
            # Fallback: assign all to cluster 0
            labels = [0] * len(records)

        # Group records by cluster
        clusters = {}
        for idx, label in enumerate(labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(records[idx])

        # Format clusters
        cluster_list = []
        for cluster_id, items in clusters.items():
            if cluster_id == -1:  # DBSCAN noise
                continue
            cluster_list.append(
                {
                    "id": int(cluster_id),
                    "items": items,
                    "size": len(items),
                }
            )

        # Extract trends
        trends = self._extract_trends(cluster_list)

        return {"trends": trends, "clusters": cluster_list}

    def _extract_trends(self, clusters: List[Dict]) -> List[Dict]:
        """Extract trends from clusters."""
        trends = []

        for cluster in clusters:
            if cluster["size"] < self.settings.min_cluster_size:
                continue

            # Extract common tags/topics
            all_tags = []
            for item in cluster["items"]:
                tags = item.get("tags", [])
                all_tags.extend(tags)

            # Count tag frequency
            tag_counts = {}
            for tag in all_tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

            # Get top tags
            top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]

            trend = {
                "cluster_id": cluster["id"],
                "size": cluster["size"],
                "topics": [tag for tag, _ in top_tags],
                "sample_titles": [item.get("title", "") for item in cluster["items"][:3]],
            }
            trends.append(trend)

        return trends

