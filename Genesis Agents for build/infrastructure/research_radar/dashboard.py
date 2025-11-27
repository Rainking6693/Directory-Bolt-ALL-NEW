"""Research Radar dashboard generator."""

import logging
from pathlib import Path
from typing import Optional

from .clusterer import ResearchRadarClusterer
from .settings import ResearchRadarSettings

logger = logging.getLogger(__name__)


class ResearchRadarDashboard:
    """Dashboard generator for Research Radar."""

    def __init__(self, settings: ResearchRadarSettings):
        """Initialize dashboard generator with settings."""
        self.settings = settings

    def run(self, date_folder: str) -> Path:
        """
        Generate dashboard markdown and HTML.

        Args:
            date_folder: Date folder name (YYYYMMDD format)

        Returns:
            Path to generated markdown file
        """
        # Run clustering to get trends
        clusterer = ResearchRadarClusterer(self.settings)
        cluster_output = clusterer.run(date_folder)

        trends = cluster_output.get("trends", [])
        clusters = cluster_output.get("clusters", [])

        # Generate markdown report
        reports_dir = self.settings.reports_dir / date_folder
        reports_dir.mkdir(parents=True, exist_ok=True)
        markdown_path = reports_dir / "dashboard.md"

        markdown_content = self._generate_markdown(trends, clusters, date_folder)
        markdown_path.write_text(markdown_content, encoding="utf-8")

        # Generate HTML dashboard
        html_content = self._generate_html(trends, clusters, date_folder)
        self.settings.dashboard_path.parent.mkdir(parents=True, exist_ok=True)
        self.settings.dashboard_path.write_text(html_content, encoding="utf-8")

        logger.info(f"Generated dashboard: {markdown_path} and {self.settings.dashboard_path}")
        return markdown_path

    def _generate_markdown(self, trends: list, clusters: list, date_folder: str) -> str:
        """Generate markdown report."""
        content = f"""# Genesis Research Radar

**Date:** {date_folder}
**Total Clusters:** {len(clusters)}
**Trends Detected:** {len(trends)}

## Top Trends

"""
        for idx, trend in enumerate(trends[:10], 1):
            content += f"""### Trend #{idx}

- **Cluster ID:** {trend['cluster_id']}
- **Size:** {trend['size']} items
- **Topics:** {', '.join(trend.get('topics', []))}
- **Sample Titles:**
"""
            for title in trend.get("sample_titles", []):
                content += f"  - {title}\n"
            content += "\n"

        content += """## Summary

This dashboard shows research trends detected from automated crawling of research sources.
"""
        return content

    def _generate_html(self, trends: list, clusters: list, date_folder: str) -> str:
        """Generate HTML dashboard."""
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Genesis Research Radar - {date_folder}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; }}
        .trend {{ border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .topic {{ display: inline-block; background: #f0f0f0; padding: 5px 10px; margin: 5px; border-radius: 3px; }}
    </style>
</head>
<body>
    <h1>Genesis Research Radar</h1>
    <p><strong>Date:</strong> {date_folder}</p>
    <p><strong>Total Clusters:</strong> {len(clusters)}</p>
    <p><strong>Trends Detected:</strong> {len(trends)}</p>
    
    <h2>Top Trends</h2>
"""
        for idx, trend in enumerate(trends[:10], 1):
            topics_html = "".join(
                [f'<span class="topic">{topic}</span>' for topic in trend.get("topics", [])]
            )
            html += f"""
    <div class="trend">
        <h3>Trend #{idx}</h3>
        <p><strong>Cluster ID:</strong> {trend['cluster_id']}</p>
        <p><strong>Size:</strong> {trend['size']} items</p>
        <p><strong>Topics:</strong> {topics_html}</p>
        <p><strong>Sample Titles:</strong></p>
        <ul>
"""
            for title in trend.get("sample_titles", []):
                html += f"            <li>{title}</li>\n"
            html += "        </ul>\n    </div>\n"

        html += """
</body>
</html>
"""
        return html

