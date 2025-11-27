"""Reporting utilities for multimodal evaluation results."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

import json

from .runners import EvaluationResult


@dataclass(slots=True)
class ReportBundle:
    """Paths and metadata for generated reports."""

    markdown_path: Path
    html_path: Path | None = None
    assets: list[Path] | None = None
    metadata: Mapping[str, str] | None = None


class ReportGenerator:
    """Generates markdown + HTML summaries and chart data for dashboards."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_markdown(self, result: EvaluationResult) -> Path:
        lines = [
            f"# Multimodal Evaluation Report",
            "",
            f"- **Benchmark:** {result.benchmark}",
            f"- **Model:** {result.model_name}",
            "",
            "## Summary Metrics",
            "",
        ]
        for metric, value in result.summary.items():
            lines.append(f"- **{metric}**: {value:.3f}")

        lines.append("")
        lines.append("## Sample Details")
        lines.append("")
        for record in result.records:
            lines.append(f"### Sample `{record.sample_id}`")
            lines.append(f"Response: {record.response or 'N/A'}")
            for metric in record.metrics:
                lines.append(f"- {metric.name}: {metric.value:.3f}")
            lines.append("")

        markdown_path = self.output_dir / f"{result.benchmark}_{result.model_name}.md"
        markdown_path.write_text("\n".join(lines), encoding="utf-8")
        return markdown_path

    def generate_html(self, result: EvaluationResult) -> Path:
        rows = []
        for record in result.records:
            metrics_html = "<ul>" + "".join(
                f"<li><strong>{metric.name}</strong>: {metric.value:.3f}</li>"
                for metric in record.metrics
            ) + "</ul>"
            rows.append(
                "<tr>"
                f"<td>{record.sample_id}</td>"
                f"<td>{(record.response or 'N/A')}</td>"
                f"<td>{metrics_html}</td>"
                "</tr>"
            )

        summary_rows = "".join(
            f"<li><strong>{metric}</strong>: {value:.3f}</li>" for metric, value in result.summary.items()
        ) or "<li>No metrics recorded.</li>"

        html = f"""
<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <title>Multimodal Eval Report - {result.benchmark} / {result.model_name}</title>
    <style>
      body {{ font-family: 'Inter', sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 2rem; }}
      h1, h2 {{ color: #38bdf8; }}
      table {{ width: 100%; border-collapse: collapse; margin-top: 1.5rem; }}
      th, td {{ border: 1px solid rgba(148, 163, 184, 0.2); padding: 0.75rem; vertical-align: top; }}
      th {{ background-color: rgba(59, 130, 246, 0.2); text-align: left; }}
      a {{ color: #93c5fd; }}
      ul {{ margin: 0.5rem 0 0; padding-left: 1.25rem; }}
    </style>
  </head>
  <body>
    <h1>Multimodal Evaluation Report</h1>
    <p><strong>Benchmark:</strong> {result.benchmark}</p>
    <p><strong>Model:</strong> {result.model_name}</p>
    <h2>Summary Metrics</h2>
    <ul>
      {summary_rows}
    </ul>
    <h2>Sample Details</h2>
    <table>
      <thead>
        <tr>
          <th>Sample ID</th>
          <th>Response</th>
          <th>Metrics</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows) if rows else '<tr><td colspan=3>No samples evaluated.</td></tr>'}
      </tbody>
    </table>
  </body>
</html>
"""

        html_path = self.output_dir / f"{result.benchmark}_{result.model_name}.html"
        html_path.write_text(html, encoding="utf-8")
        return html_path

    def export_chart_data(self, result: EvaluationResult) -> Path:
        data = {
            "benchmark": result.benchmark,
            "model": result.model_name,
            "summary": result.summary,
            "records": [
                {
                    "sample_id": record.sample_id,
                    "response": record.response,
                    "metrics": {metric.name: metric.value for metric in record.metrics},
                }
                for record in result.records
            ],
        }
        json_path = self.output_dir / f"{result.benchmark}_{result.model_name}.json"
        json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return json_path

    def generate(self, result: EvaluationResult) -> ReportBundle:
        markdown_path = self.generate_markdown(result)
        html_path = self.generate_html(result)
        chart_path = self.export_chart_data(result)
        return ReportBundle(
            markdown_path=markdown_path,
            html_path=html_path,
            assets=[chart_path],
        )
