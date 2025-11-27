"""
Benchmark Recorder Infrastructure

Records and tracks performance metrics over time for:
- Execution time trends
- Cost optimization tracking
- Failure rate monitoring
- Agent selection accuracy

Integrates with:
- Vertex AI Feature Store (production)
- Local JSON storage (development)
- MongoDB (shared memory)
"""

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkMetric:
    """Single benchmark metric snapshot"""
    timestamp: str
    version: str  # 'v1.0', 'v2.0', etc.
    git_commit: Optional[str]
    task_id: str
    task_description: str
    execution_time: float  # seconds
    success: bool
    agent_selected: Optional[str]
    cost_estimated: float
    difficulty: Optional[float] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class BenchmarkRecorder:
    """
    Record and track performance metrics over time

    Storage options:
    1. Local JSON (default, no dependencies)
    2. MongoDB (via shared memory layer)
    3. Vertex AI Feature Store (production monitoring)
    """

    def __init__(
        self,
        storage_path: str = None,
        enable_vertex_ai: bool = False,
        vertex_project_id: Optional[str] = None
    ):
        """
        Initialize benchmark recorder

        Args:
            storage_path: Local storage path (default: ./benchmarks/metrics.json)
            enable_vertex_ai: Use Vertex AI Feature Store
            vertex_project_id: GCP project ID for Vertex AI
        """
        # Local storage
        if storage_path is None:
            storage_path = os.path.join(
                os.path.dirname(__file__),
                '..',
                'benchmarks',
                'metrics.json'
            )

        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        # Thread safety for concurrent writes
        self._lock = threading.Lock()

        # Vertex AI integration
        self.enable_vertex_ai = enable_vertex_ai
        self.vertex_project_id = vertex_project_id
        self.vertex_client = None

        if self.enable_vertex_ai:
            try:
                self._init_vertex_ai()
            except Exception as e:
                logger.warning(f"Vertex AI initialization failed: {e}")
                logger.warning("Falling back to local storage only")
                self.enable_vertex_ai = False

        logger.info(f"BenchmarkRecorder initialized (storage: {self.storage_path})")

    def _init_vertex_ai(self):
        """
        Initialize Vertex AI Feature Store connection

        Requires:
        - google-cloud-aiplatform package
        - GCP credentials configured
        - Feature store created in project
        """
        try:
            from google.cloud import aiplatform

            aiplatform.init(project=self.vertex_project_id)

            # Note: Feature store must be created separately via:
            # gcloud ai feature-stores create genesis-benchmarks \
            #   --region=us-central1
            self.vertex_client = aiplatform
            logger.info(f"✅ Vertex AI Feature Store connected (project: {self.vertex_project_id})")

        except ImportError:
            raise ImportError(
                "Vertex AI integration requires: pip install google-cloud-aiplatform"
            )

    def record_execution(
        self,
        task: str,
        duration: float,
        success: bool,
        version: str,
        agent_selected: Optional[str] = None,
        cost: float = 0.0,
        difficulty: Optional[float] = None,
        metadata: Optional[Dict] = None
    ):
        """
        Record a single benchmark execution

        Args:
            task: Task description or ID
            duration: Execution time in seconds
            success: Whether task succeeded
            version: Orchestrator version (e.g., 'v1.0', 'v2.0')
            agent_selected: Agent that was selected
            cost: Estimated cost in USD
            difficulty: Task difficulty score (0.0-1.0)
            metadata: Additional metadata
        """
        metric = BenchmarkMetric(
            timestamp=datetime.now().isoformat(),
            version=version,
            git_commit=self._get_git_commit(),
            task_id=self._generate_task_id(task),
            task_description=task,
            execution_time=duration,
            success=success,
            agent_selected=agent_selected,
            cost_estimated=cost,
            difficulty=difficulty,
            metadata=metadata or {}
        )

        # Store locally
        self._store_local(metric)

        # Store in Vertex AI (if enabled)
        if self.enable_vertex_ai:
            try:
                self._store_vertex_ai(metric)
            except Exception as e:
                logger.error(f"Failed to store in Vertex AI: {e}")

        logger.info(
            f"📊 Recorded benchmark: {task[:50]}... "
            f"({duration:.3f}s, {'✅' if success else '❌'}, v{version})"
        )

    def _store_local(self, metric: BenchmarkMetric):
        """Store metric in local JSON file (thread-safe)"""
        with self._lock:
            # Load existing metrics
            if self.storage_path.exists():
                try:
                    with open(self.storage_path, 'r') as f:
                        data = json.load(f)
                except json.JSONDecodeError:
                    # File corrupted, start fresh
                    data = {'metrics': []}
            else:
                data = {'metrics': []}

            # Append new metric
            data['metrics'].append(asdict(metric))

            # Save
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=2)

    def _store_vertex_ai(self, metric: BenchmarkMetric):
        """
        Store metric in Vertex AI Feature Store

        Feature Store Schema:
        - entity_id: task_id
        - features:
          - execution_time (FLOAT)
          - success (BOOL)
          - cost (FLOAT)
          - difficulty (FLOAT)
          - version (STRING)
          - agent_selected (STRING)
        """
        if not self.vertex_client:
            return

        # Note: In production, this would write to a Feature Store
        # For now, we log the intent
        logger.info(
            f"📤 Would write to Vertex AI Feature Store: "
            f"task={metric.task_id}, time={metric.execution_time:.3f}s"
        )

        # Production implementation:
        # feature_store = aiplatform.FeatureStore('genesis-benchmarks')
        # entity = feature_store.get_entity_type('benchmark_metrics')
        # entity.write_feature_values([{
        #     'entity_id': metric.task_id,
        #     'feature_values': {
        #         'execution_time': metric.execution_time,
        #         'success': metric.success,
        #         'cost': metric.cost_estimated,
        #         'difficulty': metric.difficulty,
        #         'version': metric.version,
        #         'agent_selected': metric.agent_selected
        #     }
        # }])

    def get_historical_metrics(
        self,
        version: Optional[str] = None,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieve historical performance metrics

        Args:
            version: Filter by version (e.g., 'v1.0')
            task_id: Filter by specific task

        Returns:
            Dictionary with aggregated metrics:
            - mean: Average execution time
            - p50: Median execution time
            - p95: 95th percentile execution time
            - p99: 99th percentile execution time
            - success_rate: Percentage of successful runs
            - total_cost: Total estimated cost
        """
        # Load from local storage
        if not self.storage_path.exists():
            return {
                'count': 0,
                'mean': 0.0,
                'p50': 0.0,
                'p95': 0.0,
                'p99': 0.0,
                'success_rate': 0.0,
                'total_cost': 0.0
            }

        with open(self.storage_path, 'r') as f:
            data = json.load(f)

        metrics = data.get('metrics', [])

        # Filter by version
        if version:
            metrics = [m for m in metrics if m['version'] == version]

        # Filter by task_id
        if task_id:
            metrics = [m for m in metrics if m['task_id'] == task_id]

        if not metrics:
            return {
                'count': 0,
                'mean': 0.0,
                'p50': 0.0,
                'p95': 0.0,
                'p99': 0.0,
                'success_rate': 0.0,
                'total_cost': 0.0
            }

        # Calculate statistics
        execution_times = sorted([m['execution_time'] for m in metrics])
        successes = sum(1 for m in metrics if m['success'])
        total_cost = sum(m['cost_estimated'] for m in metrics)

        return {
            'count': len(metrics),
            'mean': sum(execution_times) / len(execution_times),
            'p50': execution_times[len(execution_times) // 2],
            'p95': execution_times[int(len(execution_times) * 0.95)],
            'p99': execution_times[int(len(execution_times) * 0.99)] if len(execution_times) > 1 else execution_times[-1],
            'success_rate': successes / len(metrics),
            'total_cost': total_cost
        }

    def compare_versions(
        self,
        v1: str,
        v2: str,
        metric: str = 'execution_time'
    ) -> Dict[str, Any]:
        """
        Compare performance between two versions

        Args:
            v1: First version (e.g., 'v1.0')
            v2: Second version (e.g., 'v2.0')
            metric: Metric to compare ('execution_time', 'success_rate', 'cost')

        Returns:
            Dictionary with comparison results:
            - v1_value: v1 metric value
            - v2_value: v2 metric value
            - improvement: Percentage improvement (positive = v2 better)
            - significant: Whether improvement is statistically significant
        """
        v1_metrics = self.get_historical_metrics(version=v1)
        v2_metrics = self.get_historical_metrics(version=v2)

        if v1_metrics['count'] == 0 or v2_metrics['count'] == 0:
            return {
                'v1_value': 0.0,
                'v2_value': 0.0,
                'improvement': 0.0,
                'significant': False,
                'error': 'Insufficient data for comparison'
            }

        # Get metric values
        if metric == 'execution_time':
            v1_value = v1_metrics['mean']
            v2_value = v2_metrics['mean']
            # Lower is better for execution time
            improvement = (v1_value - v2_value) / v1_value if v1_value > 0 else 0
        elif metric == 'success_rate':
            v1_value = v1_metrics['success_rate']
            v2_value = v2_metrics['success_rate']
            # Higher is better for success rate
            improvement = (v2_value - v1_value) / v1_value if v1_value > 0 else 0
        elif metric == 'cost':
            v1_value = v1_metrics['total_cost'] / v1_metrics['count']
            v2_value = v2_metrics['total_cost'] / v2_metrics['count']
            # Lower is better for cost
            improvement = (v1_value - v2_value) / v1_value if v1_value > 0 else 0
        else:
            return {
                'error': f'Unknown metric: {metric}'
            }

        # Simple significance test (needs >10 samples and >5% improvement)
        significant = (
            v1_metrics['count'] >= 10 and
            v2_metrics['count'] >= 10 and
            abs(improvement) > 0.05
        )

        return {
            'v1_value': v1_value,
            'v2_value': v2_value,
            'improvement': improvement,
            'improvement_percent': improvement * 100,
            'significant': significant,
            'v1_count': v1_metrics['count'],
            'v2_count': v2_metrics['count']
        }

    def generate_report(self, versions: List[str]) -> str:
        """
        Generate human-readable performance report

        Args:
            versions: List of versions to include in report

        Returns:
            Formatted report string
        """
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("GENESIS ORCHESTRATION PERFORMANCE REPORT")
        report_lines.append("=" * 80)
        report_lines.append("")

        for version in versions:
            metrics = self.get_historical_metrics(version=version)

            report_lines.append(f"Version: {version}")
            report_lines.append(f"  Sample size: {metrics['count']} executions")
            report_lines.append(f"  Avg execution time: {metrics['mean']:.3f}s")
            report_lines.append(f"  Median (p50): {metrics['p50']:.3f}s")
            report_lines.append(f"  95th percentile: {metrics['p95']:.3f}s")
            report_lines.append(f"  Success rate: {metrics['success_rate']:.1%}")
            report_lines.append(f"  Total cost: ${metrics['total_cost']:.6f}")
            report_lines.append("")

        # Compare versions if multiple
        if len(versions) >= 2:
            report_lines.append("Version Comparisons:")
            report_lines.append("")

            for i in range(len(versions) - 1):
                v1 = versions[i]
                v2 = versions[i + 1]

                time_comp = self.compare_versions(v1, v2, 'execution_time')
                success_comp = self.compare_versions(v1, v2, 'success_rate')
                cost_comp = self.compare_versions(v1, v2, 'cost')

                report_lines.append(f"{v1} → {v2}:")
                report_lines.append(f"  Execution time: {time_comp['improvement_percent']:.1f}% faster")
                report_lines.append(f"  Success rate: {success_comp['improvement_percent']:.1f}% better")
                report_lines.append(f"  Cost: {cost_comp['improvement_percent']:.1f}% cheaper")
                report_lines.append("")

        report_lines.append("=" * 80)

        return "\n".join(report_lines)

    @staticmethod
    def _generate_task_id(task: str) -> str:
        """Generate stable task ID from description"""
        import hashlib
        return hashlib.sha256(task.encode(), usedforsecurity=False).hexdigest()[:12]

    @staticmethod
    def _get_git_commit() -> Optional[str]:
        """Get current git commit hash"""
        try:
            import subprocess
            result = subprocess.run(
                ['git', 'rev-parse', '--short', 'HEAD'],
                capture_output=True,
                text=True,
                timeout=1
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
        return None

    # ========================================================================
    # TEST-REQUIRED METHODS
    # ========================================================================

    def record(self, metric: BenchmarkMetric) -> None:
        """
        Record a benchmark metric

        Args:
            metric: BenchmarkMetric to record
        """
        # Store locally
        self._store_local(metric)

        # Store in Vertex AI (if enabled)
        if self.enable_vertex_ai:
            try:
                self._store_vertex_ai(metric)
            except Exception as e:
                logger.error(f"Failed to store in Vertex AI: {e}")

        logger.info(
            f"Recorded metric: {metric.task_id} "
            f"({metric.execution_time:.3f}s, {'✅' if metric.success else '❌'}, {metric.version})"
        )

    def get_all_metrics(self) -> List[BenchmarkMetric]:
        """
        Get all recorded metrics

        Returns:
            List of all BenchmarkMetric objects
        """
        if not self.storage_path.exists():
            return []

        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)

            metrics = []
            for m in data.get('metrics', []):
                metric = BenchmarkMetric(
                    timestamp=m['timestamp'],
                    version=m['version'],
                    git_commit=m.get('git_commit'),
                    task_id=m['task_id'],
                    task_description=m['task_description'],
                    execution_time=m['execution_time'],
                    success=m['success'],
                    agent_selected=m.get('agent_selected'),
                    cost_estimated=m['cost_estimated'],
                    difficulty=m.get('difficulty'),
                    metadata=m.get('metadata', {})
                )
                metrics.append(metric)

            return metrics

        except Exception as e:
            logger.error(f"Failed to load metrics: {e}")
            return []

    def get_metrics_by_version(self, version: str) -> List[BenchmarkMetric]:
        """
        Get metrics filtered by version

        Args:
            version: Version to filter by (e.g., 'v1.0')

        Returns:
            List of metrics for specified version
        """
        all_metrics = self.get_all_metrics()
        return [m for m in all_metrics if m.version == version]

    def get_metrics_by_agent(self, agent_name: str) -> List[BenchmarkMetric]:
        """
        Get metrics filtered by agent

        Args:
            agent_name: Agent name to filter by

        Returns:
            List of metrics for specified agent
        """
        all_metrics = self.get_all_metrics()
        return [m for m in all_metrics if m.agent_selected == agent_name]

    def get_success_rate(self, version: Optional[str] = None) -> float:
        """
        Get overall success rate

        Args:
            version: Optional version to filter by

        Returns:
            Success rate (0.0 to 1.0)
        """
        if version:
            metrics = self.get_metrics_by_version(version)
        else:
            metrics = self.get_all_metrics()

        if not metrics:
            return 0.0

        successes = sum(1 for m in metrics if m.success)
        return successes / len(metrics)

    def get_average_execution_time(self, version: Optional[str] = None) -> float:
        """
        Get average execution time

        Args:
            version: Optional version to filter by

        Returns:
            Average execution time in seconds
        """
        if version:
            metrics = self.get_metrics_by_version(version)
        else:
            metrics = self.get_all_metrics()

        if not metrics:
            return 0.0

        total_time = sum(m.execution_time for m in metrics)
        return total_time / len(metrics)

    def get_total_cost(self, version: Optional[str] = None) -> float:
        """
        Get total cost across all metrics

        Args:
            version: Optional version to filter by

        Returns:
            Total cost in dollars
        """
        if version:
            metrics = self.get_metrics_by_version(version)
        else:
            metrics = self.get_all_metrics()

        return sum(m.cost_estimated for m in metrics)

    def get_recent_metrics(self, limit: int = 10) -> List[BenchmarkMetric]:
        """
        Get most recent metrics

        Args:
            limit: Maximum number of metrics to return

        Returns:
            List of most recent metrics
        """
        all_metrics = self.get_all_metrics()

        # Sort by timestamp (most recent first)
        sorted_metrics = sorted(
            all_metrics,
            key=lambda m: m.timestamp,
            reverse=True
        )

        return sorted_metrics[:limit]

    def clear(self) -> None:
        """
        Clear all recorded metrics

        This removes the storage file
        """
        if self.storage_path.exists():
            self.storage_path.unlink()
            logger.info("Cleared all metrics")
        else:
            logger.warning("No metrics to clear")

    def export_to_csv(self, csv_path: str) -> None:
        """
        Export metrics to CSV file

        Args:
            csv_path: Path to CSV file
        """
        import csv

        metrics = self.get_all_metrics()

        if not metrics:
            logger.warning("No metrics to export")
            return

        csv_file_path = Path(csv_path)
        csv_file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(csv_file_path, 'w', newline='') as f:
            fieldnames = [
                'timestamp', 'version', 'git_commit', 'task_id',
                'task_description', 'execution_time', 'success',
                'agent_selected', 'cost_estimated', 'difficulty'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)

            writer.writeheader()
            for metric in metrics:
                writer.writerow({
                    'timestamp': metric.timestamp,
                    'version': metric.version,
                    'git_commit': metric.git_commit or '',
                    'task_id': metric.task_id,
                    'task_description': metric.task_description,
                    'execution_time': metric.execution_time,
                    'success': metric.success,
                    'agent_selected': metric.agent_selected or '',
                    'cost_estimated': metric.cost_estimated,
                    'difficulty': metric.difficulty or ''
                })

        logger.info(f"Exported {len(metrics)} metrics to {csv_path}")

    def get_statistics(self, version: Optional[str] = None) -> Dict[str, Any]:
        """
        Get summary statistics

        Args:
            version: Optional version to filter by

        Returns:
            Dictionary with statistics
        """
        if version:
            metrics = self.get_metrics_by_version(version)
        else:
            metrics = self.get_all_metrics()

        if not metrics:
            return {
                "total_tasks": 0,
                "success_rate": 0.0,
                "avg_execution_time": 0.0,
                "total_cost": 0.0
            }

        execution_times = [m.execution_time for m in metrics]
        successes = sum(1 for m in metrics if m.success)
        total_cost = sum(m.cost_estimated for m in metrics)

        # Calculate percentiles
        sorted_times = sorted(execution_times)
        p50_idx = len(sorted_times) // 2
        p95_idx = int(len(sorted_times) * 0.95)
        p99_idx = int(len(sorted_times) * 0.99) if len(sorted_times) > 1 else -1

        return {
            "total_tasks": len(metrics),
            "success_rate": successes / len(metrics),
            "avg_execution_time": sum(execution_times) / len(execution_times),
            "median_execution_time": sorted_times[p50_idx],
            "p95_execution_time": sorted_times[p95_idx],
            "p99_execution_time": sorted_times[p99_idx],
            "total_cost": total_cost,
            "avg_cost": total_cost / len(metrics)
        }

    def get_execution_time_trend(self, version: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get execution time trend analysis

        Args:
            version: Optional version to filter by

        Returns:
            Dictionary with trend information or None
        """
        if version:
            metrics = self.get_metrics_by_version(version)
        else:
            metrics = self.get_all_metrics()

        if len(metrics) < 2:
            return None

        # Sort by timestamp
        sorted_metrics = sorted(metrics, key=lambda m: m.timestamp)

        # Calculate trend (simple linear regression)
        times = [m.execution_time for m in sorted_metrics]
        n = len(times)

        # Calculate average of first half vs second half
        mid = n // 2
        first_half_avg = sum(times[:mid]) / mid
        second_half_avg = sum(times[mid:]) / (n - mid)

        improvement = (first_half_avg - second_half_avg) / first_half_avg if first_half_avg > 0 else 0

        return {
            "first_half_avg": first_half_avg,
            "second_half_avg": second_half_avg,
            "improvement": improvement,
            "trend": "improving" if improvement > 0 else "degrading",
            "samples": n
        }


# Factory function
def get_benchmark_recorder(
    enable_vertex_ai: bool = False,
    vertex_project_id: Optional[str] = None
) -> BenchmarkRecorder:
    """
    Get benchmark recorder instance

    Args:
        enable_vertex_ai: Enable Vertex AI Feature Store integration
        vertex_project_id: GCP project ID (required if enable_vertex_ai=True)

    Returns:
        BenchmarkRecorder instance
    """
    return BenchmarkRecorder(
        enable_vertex_ai=enable_vertex_ai,
        vertex_project_id=vertex_project_id
    )


# Example usage
if __name__ == "__main__":
    # Initialize recorder
    recorder = get_benchmark_recorder()

    # Record some example metrics
    recorder.record_execution(
        task="Create landing page",
        duration=5.234,
        success=True,
        version="v1.0",
        agent_selected="builder_agent",
        cost=0.000123,
        difficulty=0.2
    )

    recorder.record_execution(
        task="Create landing page",
        duration=3.456,
        success=True,
        version="v2.0",
        agent_selected="builder_agent",
        cost=0.000120,
        difficulty=0.2
    )

    # Generate report
    print(recorder.generate_report(['v1.0', 'v2.0']))

    # Compare versions
    comparison = recorder.compare_versions('v1.0', 'v2.0', 'execution_time')
    print(f"\nExecution time improvement: {comparison['improvement_percent']:.1f}%")
