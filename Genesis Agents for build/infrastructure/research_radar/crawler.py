"""Research Radar crawler for fetching research papers and articles."""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .settings import ResearchRadarSettings, SourceConfig

logger = logging.getLogger(__name__)


class ResearchRadarCrawler:
    """Crawler for fetching research content from multiple sources."""

    def __init__(self, settings: ResearchRadarSettings):
        """Initialize crawler with settings."""
        self.settings = settings

    def run(self, run_datetime: Optional[datetime] = None) -> Path:
        """
        Run crawler and fetch research items from all sources.

        Args:
            run_datetime: Optional datetime for this run (defaults to now)

        Returns:
            Path to the raw data file created
        """
        if run_datetime is None:
            run_datetime = datetime.now()

        run_folder = run_datetime.strftime("%Y%m%d")
        output_dir = self.settings.raw_dir / run_folder
        output_dir.mkdir(parents=True, exist_ok=True)

        all_records = []

        for source in self.settings.sources:
            if not source.enabled:
                logger.info(f"Skipping disabled source: {source.name}")
                continue

            try:
                records = self._fetch_source(source, run_datetime)
                all_records.extend(records)
                logger.info(f"Fetched {len(records)} records from {source.name}")
            except Exception as e:
                logger.error(f"Error fetching from {source.name}: {e}", exc_info=True)

        # Save raw records
        output_file = output_dir / "raw_records.jsonl"
        with open(output_file, "w", encoding="utf-8") as f:
            for record in all_records:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

        logger.info(f"Saved {len(all_records)} records to {output_file}")
        return output_file

    def _fetch_source(self, source: SourceConfig, timestamp: datetime) -> List[Dict]:
        """
        Fetch records from a specific source.

        Args:
            source: Source configuration
            timestamp: Timestamp for this fetch

        Returns:
            List of records (dicts with id, title, summary, url, published_at, source, tags)
        """
        if source.type == "api":
            return self._fetch_api(source, timestamp)
        elif source.type == "rss":
            return self._fetch_rss(source, timestamp)
        elif source.type == "scraper":
            return self._fetch_scraper(source, timestamp)
        else:
            logger.warning(f"Unknown source type: {source.type}")
            return []

    def _fetch_api(self, source: SourceConfig, timestamp: datetime) -> List[Dict]:
        """Fetch from API source."""
        # Placeholder - implement actual API fetching
        # For now, return empty list (test will mock this)
        return []

    def _fetch_rss(self, source: SourceConfig, timestamp: datetime) -> List[Dict]:
        """Fetch from RSS feed."""
        # Placeholder - implement RSS parsing
        return []

    def _fetch_scraper(self, source: SourceConfig, timestamp: datetime) -> List[Dict]:
        """Fetch using web scraper."""
        # Placeholder - implement web scraping
        return []

