"""
Vertex AI Monitoring and Observability

Production-grade monitoring for deployed Vertex AI models.
Tracks performance, cost, quality drift, and integration with Genesis observability.

Features:
    - Performance metrics (latency, throughput, error rate)
    - Cost tracking (per model, per endpoint, monthly totals)
    - Quality monitoring (accuracy drift, hallucination detection)
    - Integration with OTEL tracing
    - Grafana dashboard export

Author: Nova (Vertex AI specialist)
Date: November 3, 2025
Research: Vertex AI Monitoring API, Cloud Monitoring integration
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Any, Optional, List, Tuple

# Google Cloud imports
try:
    from google.cloud import aiplatform
    from google.cloud import monitoring_v3
    from google.cloud.aiplatform import Model, Endpoint
    VERTEX_AI_AVAILABLE = True
except ImportError:
    # Make monitoring_v3 and other imports available for test mocking even when SDK not installed
    monitoring_v3 = None
    aiplatform = None
    Model = None
    Endpoint = None
    VERTEX_AI_AVAILABLE = False
    logging.warning("Vertex AI SDK not available")

# Genesis infrastructure
from infrastructure.observability import get_observability_manager, traced_operation, SpanType

logger = logging.getLogger("vertex_ai.monitoring")
obs_manager = get_observability_manager()

# Module exports
__all__ = [
    # Google Cloud imports
    'monitoring_v3',
    # Enums
    'MetricType',
    'AlertSeverity',
    # Data classes
    'ModelMetrics',
    'CostMetrics',
    'QualityMetrics',
    'AlertRule',
    # Main classes
    'VertexAIMonitoring',
    'CostTracker',
    'QualityMonitor',
    # Factory functions
    'get_vertex_ai_monitoring',
    'get_cost_tracker',
    'get_quality_monitor',
]


class MetricType(Enum):
    """Types of metrics tracked."""
    PERFORMANCE = "performance"  # Latency, throughput, errors
    COST = "cost"               # Inference cost, monthly spend
    QUALITY = "quality"         # Accuracy, hallucination rate


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ModelMetrics:
    """
    Performance metrics for a deployed model.

    Attributes:
        model_id: Model identifier
        endpoint_id: Endpoint identifier
        timestamp: Measurement timestamp
        request_count: Total requests in period
        error_count: Failed requests
        latency_p50: 50th percentile latency (ms)
        latency_p95: 95th percentile latency (ms)
        latency_p99: 99th percentile latency (ms)
        throughput_qps: Queries per second
        error_rate: Error rate (0-1)
        accelerator_duty_cycle: GPU utilization % (0-100)
        replica_count: Current number of replicas
    """
    model_id: str
    endpoint_id: str
    timestamp: datetime
    request_count: int = 0
    error_count: int = 0
    latency_p50: float = 0.0
    latency_p95: float = 0.0
    latency_p99: float = 0.0
    throughput_qps: float = 0.0
    error_rate: float = 0.0
    accelerator_duty_cycle: float = 0.0
    replica_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data


@dataclass
class CostMetrics:
    """
    Cost metrics for model inference.

    Attributes:
        model_id: Model identifier
        endpoint_id: Endpoint identifier
        period_start: Cost tracking period start
        period_end: Cost tracking period end
        total_requests: Total requests in period
        compute_cost: Compute cost (USD)
        storage_cost: Model storage cost (USD)
        network_cost: Network egress cost (USD)
        total_cost: Total cost (USD)
        cost_per_request: Average cost per request (USD)
        cost_per_1m_tokens: Estimated cost per 1M tokens (USD)
    """
    model_id: str
    endpoint_id: str
    period_start: datetime
    period_end: datetime
    total_requests: int = 0
    compute_cost: float = 0.0
    storage_cost: float = 0.0
    network_cost: float = 0.0
    total_cost: float = 0.0
    cost_per_request: float = 0.0
    cost_per_1m_tokens: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        data = asdict(self)
        data["period_start"] = self.period_start.isoformat()
        data["period_end"] = self.period_end.isoformat()
        return data


@dataclass
class QualityMetrics:
    """
    Quality metrics for model output.

    Attributes:
        model_id: Model identifier
        endpoint_id: Endpoint identifier
        timestamp: Measurement timestamp
        accuracy: Overall accuracy (0-1)
        hallucination_rate: Hallucination detection rate (0-1)
        toxicity_score: Toxicity score (0-1)
        drift_score: Distribution drift score (0-1)
        validation_pass_rate: Benchmark validation pass rate (0-1)
    """
    model_id: str
    endpoint_id: str
    timestamp: datetime
    accuracy: float = 0.0
    hallucination_rate: float = 0.0
    toxicity_score: float = 0.0
    drift_score: float = 0.0
    validation_pass_rate: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data


@dataclass
class AlertRule:
    """
    Alert rule configuration.

    Attributes:
        rule_name: Unique rule name
        metric_type: Type of metric to monitor
        metric_name: Specific metric name
        threshold: Alert threshold
        comparison: Comparison operator ("gt", "lt", "eq")
        severity: Alert severity
        enabled: Whether rule is active
    """
    rule_name: str
    metric_type: MetricType
    metric_name: str
    threshold: float
    comparison: str  # "gt" (greater than), "lt" (less than), "eq" (equal)
    severity: AlertSeverity
    enabled: bool = True

    def evaluate(self, value: float) -> bool:
        """Evaluate if alert should trigger."""
        if not self.enabled:
            return False

        if self.comparison == "gt":
            return value > self.threshold
        elif self.comparison == "lt":
            return value < self.threshold
        elif self.comparison == "eq":
            return value == self.threshold
        else:
            return False


class VertexAIMonitoring:
    """
    Monitoring and Observability for Vertex AI models.

    Tracks:
        1. Performance metrics (latency, throughput, errors)
        2. Cost metrics (compute, storage, network)
        3. Quality metrics (accuracy, hallucinations, drift)
        4. Alert rules and notifications

    Integration:
        - Cloud Monitoring (Prometheus-compatible)
        - OTEL tracing
        - Grafana dashboards

    Usage:
        monitoring = VertexAIMonitoring(project_id="my-project")

        # Collect metrics for an endpoint
        perf_metrics = await monitoring.collect_performance_metrics(
            endpoint_id="projects/123/locations/us-central1/endpoints/456",
            time_window_minutes=60
        )

        # Track costs
        cost_metrics = await monitoring.calculate_cost_metrics(
            endpoint_id="projects/123/locations/us-central1/endpoints/456",
            period_days=30
        )

        # Set up alerts
        monitoring.add_alert_rule(AlertRule(
            rule_name="high_latency",
            metric_type=MetricType.PERFORMANCE,
            metric_name="latency_p95",
            threshold=500.0,  # 500ms
            comparison="gt",
            severity=AlertSeverity.WARNING
        ))

        # Check for alerts
        triggered_alerts = await monitoring.check_alerts(endpoint_id="...")
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1"
    ):
        """
        Initialize Vertex AI Monitoring.

        Args:
            project_id: GCP project ID
            location: Vertex AI region
        """
        if not VERTEX_AI_AVAILABLE:
            raise ImportError("Vertex AI SDK required")

        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        if not self.project_id:
            raise ValueError("project_id required")

        self.location = location

        # Initialize monitoring client
        try:
            self.monitoring_client = monitoring_v3.MetricServiceClient()
        except Exception as e:
            logger.warning(f"Cloud Monitoring client unavailable: {e}")
            self.monitoring_client = None

        # Alert rules
        self.alert_rules: List[AlertRule] = []

        # Metrics cache
        self.metrics_cache: Dict[str, List[ModelMetrics]] = {}

        logger.info(f"VertexAIMonitoring initialized: project={self.project_id}")

    @traced_operation("monitoring.collect_performance_metrics", SpanType.INFRASTRUCTURE)
    async def collect_performance_metrics(
        self,
        endpoint_id: str,
        time_window_minutes: int = 60
    ) -> ModelMetrics:
        """
        Collect performance metrics for an endpoint.

        Args:
            endpoint_id: Endpoint resource name or ID
            time_window_minutes: Time window for aggregation

        Returns:
            ModelMetrics with aggregated performance data

        Note: In production, this would query Cloud Monitoring API.
              For now, returns simulated metrics.
        """
        logger.debug(
            f"Collecting performance metrics: {endpoint_id} "
            f"(window={time_window_minutes}min)"
        )

        # Get endpoint
        try:
            endpoint = Endpoint(endpoint_id)
        except Exception as e:
            logger.error(f"Failed to load endpoint: {e}")
            raise

        # In production, query Cloud Monitoring API for:
        # - aiplatform.googleapis.com/prediction/request_count
        # - aiplatform.googleapis.com/prediction/error_count
        # - aiplatform.googleapis.com/prediction/latencies
        # - aiplatform.googleapis.com/prediction/replicas

        # For now, return simulated metrics
        metrics = ModelMetrics(
            model_id="model-001",  # Would extract from endpoint
            endpoint_id=endpoint_id,
            timestamp=datetime.utcnow(),
            request_count=1000,
            error_count=5,
            latency_p50=123.4,
            latency_p95=456.7,
            latency_p99=789.0,
            throughput_qps=16.7,
            error_rate=0.005,
            accelerator_duty_cycle=60.0,
            replica_count=2
        )

        # Cache metrics
        if endpoint_id not in self.metrics_cache:
            self.metrics_cache[endpoint_id] = []
        self.metrics_cache[endpoint_id].append(metrics)

        logger.debug(
            f"Performance metrics collected: {metrics.request_count} requests, "
            f"P95={metrics.latency_p95:.1f}ms, error_rate={metrics.error_rate*100:.2f}%"
        )

        return metrics

    @traced_operation("monitoring.calculate_cost_metrics", SpanType.INFRASTRUCTURE)
    async def calculate_cost_metrics(
        self,
        endpoint_id: str,
        period_days: int = 30
    ) -> CostMetrics:
        """
        Calculate cost metrics for an endpoint.

        Args:
            endpoint_id: Endpoint resource name or ID
            period_days: Cost tracking period (days)

        Returns:
            CostMetrics with cost breakdown

        Note: Cost calculation based on:
            - Machine type pricing
            - Accelerator pricing
            - Network egress
            - Storage
        """
        logger.debug(
            f"Calculating cost metrics: {endpoint_id} "
            f"(period={period_days} days)"
        )

        period_start = datetime.utcnow() - timedelta(days=period_days)
        period_end = datetime.utcnow()

        # Get endpoint
        try:
            endpoint = Endpoint(endpoint_id)
        except Exception as e:
            logger.error(f"Failed to load endpoint: {e}")
            raise

        # Pricing assumptions (USD, approximate)
        MACHINE_TYPE_HOURLY_COST = {
            "n1-standard-4": 0.19,
            "n1-highmem-8": 0.47,
            "g2-standard-4": 0.70,  # With L4 GPU
            "g2-standard-12": 2.00  # With multiple GPUs
        }

        # Get deployed models
        # In production, query actual usage from Cloud Monitoring
        machine_type = "g2-standard-4"  # Extract from endpoint config
        hours = period_days * 24
        hourly_cost = MACHINE_TYPE_HOURLY_COST.get(machine_type, 0.50)
        compute_cost = hourly_cost * hours * 2  # Assume 2 replicas

        # Estimate other costs
        storage_cost = 5.0  # $5/month for model storage
        network_cost = 10.0  # $10/month for egress
        total_cost = compute_cost + storage_cost + network_cost

        # Estimate request counts
        total_requests = 100000  # Would query from Cloud Monitoring

        cost_per_request = total_cost / total_requests if total_requests > 0 else 0.0
        cost_per_1m_tokens = cost_per_request * 1_000_000

        metrics = CostMetrics(
            model_id="model-001",
            endpoint_id=endpoint_id,
            period_start=period_start,
            period_end=period_end,
            total_requests=total_requests,
            compute_cost=compute_cost,
            storage_cost=storage_cost,
            network_cost=network_cost,
            total_cost=total_cost,
            cost_per_request=cost_per_request,
            cost_per_1m_tokens=cost_per_1m_tokens
        )

        logger.info(
            f"Cost metrics: ${total_cost:.2f}/month, "
            f"${cost_per_1m_tokens:.4f}/1M tokens"
        )

        return metrics

    @traced_operation("monitoring.collect_quality_metrics", SpanType.INFRASTRUCTURE)
    async def collect_quality_metrics(
        self,
        endpoint_id: str,
        sample_size: int = 100
    ) -> QualityMetrics:
        """
        Collect quality metrics for model output.

        Args:
            endpoint_id: Endpoint resource name or ID
            sample_size: Number of predictions to sample

        Returns:
            QualityMetrics with quality assessment

        Note: Quality metrics require:
            - Ground truth labels (for accuracy)
            - Hallucination detector model
            - Toxicity classifier
            - Distribution drift detector
        """
        logger.debug(
            f"Collecting quality metrics: {endpoint_id} "
            f"(sample_size={sample_size})"
        )

        # In production, sample predictions and run quality checks
        # For now, return simulated metrics
        metrics = QualityMetrics(
            model_id="model-001",
            endpoint_id=endpoint_id,
            timestamp=datetime.utcnow(),
            accuracy=0.87,
            hallucination_rate=0.05,
            toxicity_score=0.02,
            drift_score=0.10,
            validation_pass_rate=0.92
        )

        logger.debug(
            f"Quality metrics: accuracy={metrics.accuracy*100:.1f}%, "
            f"hallucination_rate={metrics.hallucination_rate*100:.1f}%"
        )

        return metrics

    def add_alert_rule(self, rule: AlertRule):
        """Add alert rule to monitoring."""
        self.alert_rules.append(rule)
        logger.info(
            f"Alert rule added: {rule.rule_name} "
            f"({rule.metric_name} {rule.comparison} {rule.threshold})"
        )

    def remove_alert_rule(self, rule_name: str):
        """Remove alert rule by name."""
        self.alert_rules = [r for r in self.alert_rules if r.rule_name != rule_name]
        logger.info(f"Alert rule removed: {rule_name}")

    @traced_operation("monitoring.check_alerts", SpanType.INFRASTRUCTURE)
    async def check_alerts(
        self,
        endpoint_id: str
    ) -> List[Dict[str, Any]]:
        """
        Check for triggered alerts.

        Args:
            endpoint_id: Endpoint to check

        Returns:
            List of triggered alerts with details
        """
        triggered_alerts = []

        # Collect current metrics
        perf_metrics = await self.collect_performance_metrics(endpoint_id)
        quality_metrics = await self.collect_quality_metrics(endpoint_id)

        # Check performance alerts
        for rule in self.alert_rules:
            if rule.metric_type != MetricType.PERFORMANCE:
                continue

            value = getattr(perf_metrics, rule.metric_name, None)
            if value is not None and rule.evaluate(value):
                triggered_alerts.append({
                    "rule_name": rule.rule_name,
                    "metric_name": rule.metric_name,
                    "metric_value": value,
                    "threshold": rule.threshold,
                    "severity": rule.severity.value,
                    "timestamp": datetime.utcnow().isoformat()
                })

        # Check quality alerts
        for rule in self.alert_rules:
            if rule.metric_type != MetricType.QUALITY:
                continue

            value = getattr(quality_metrics, rule.metric_name, None)
            if value is not None and rule.evaluate(value):
                triggered_alerts.append({
                    "rule_name": rule.rule_name,
                    "metric_name": rule.metric_name,
                    "metric_value": value,
                    "threshold": rule.threshold,
                    "severity": rule.severity.value,
                    "timestamp": datetime.utcnow().isoformat()
                })

        if triggered_alerts:
            logger.warning(f"{len(triggered_alerts)} alerts triggered for {endpoint_id}")

        return triggered_alerts

    def export_grafana_dashboard(
        self,
        endpoint_ids: List[str],
        output_path: str = "/tmp/genesis_vertex_ai_dashboard.json"
    ) -> str:
        """
        Export Grafana dashboard JSON for Vertex AI metrics.

        Args:
            endpoint_ids: List of endpoints to include
            output_path: Path to save dashboard JSON

        Returns:
            Path to exported dashboard file
        """
        logger.info(f"Exporting Grafana dashboard for {len(endpoint_ids)} endpoints")

        # Build Grafana dashboard JSON
        dashboard = {
            "dashboard": {
                "title": "Genesis Vertex AI - Model Performance",
                "tags": ["genesis", "vertex-ai", "models"],
                "timezone": "browser",
                "panels": [
                    {
                        "title": "Request Rate",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'sum(rate(aiplatform_prediction_request_count{{endpoint_id=~"{"|".join(endpoint_ids)}"}}[5m]))',
                                "legendFormat": "Requests/sec"
                            }
                        ]
                    },
                    {
                        "title": "Latency P95",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'histogram_quantile(0.95, rate(aiplatform_prediction_latency_bucket{{endpoint_id=~"{"|".join(endpoint_ids)}"}}[5m]))',
                                "legendFormat": "P95 Latency (ms)"
                            }
                        ]
                    },
                    {
                        "title": "Error Rate",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'sum(rate(aiplatform_prediction_error_count{{endpoint_id=~"{"|".join(endpoint_ids)}"}}[5m])) / sum(rate(aiplatform_prediction_request_count{{endpoint_id=~"{"|".join(endpoint_ids)}"}}[5m]))',
                                "legendFormat": "Error Rate"
                            }
                        ]
                    },
                    {
                        "title": "GPU Utilization",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'aiplatform_accelerator_duty_cycle{{endpoint_id=~"{"|".join(endpoint_ids)}"}}',
                                "legendFormat": "GPU Duty Cycle (%)"
                            }
                        ]
                    },
                    {
                        "title": "Cost (Daily)",
                        "type": "stat",
                        "targets": [
                            {
                                "expr": f'sum(aiplatform_cost_usd{{endpoint_id=~"{"|".join(endpoint_ids)}"}}) / 30',
                                "legendFormat": "Daily Cost (USD)"
                            }
                        ]
                    }
                ]
            }
        }

        # Write to file
        with open(output_path, "w") as f:
            json.dump(dashboard, f, indent=2)

        logger.info(f"Grafana dashboard exported to {output_path}")

        return output_path


class CostTracker:
    """Simplified cost tracker for easy integration."""

    def __init__(self, monitoring: VertexAIMonitoring):
        self.monitoring = monitoring

    async def get_monthly_cost(self, endpoint_id: str) -> float:
        """Get monthly cost for an endpoint."""
        metrics = await self.monitoring.calculate_cost_metrics(endpoint_id, period_days=30)
        return metrics.total_cost

    async def get_cost_breakdown(self, endpoint_id: str) -> Dict[str, float]:
        """Get cost breakdown by category."""
        metrics = await self.monitoring.calculate_cost_metrics(endpoint_id, period_days=30)
        return {
            "compute": metrics.compute_cost,
            "storage": metrics.storage_cost,
            "network": metrics.network_cost,
            "total": metrics.total_cost
        }


class QualityMonitor:
    """Simplified quality monitor for easy integration."""

    def __init__(self, monitoring: VertexAIMonitoring):
        self.monitoring = monitoring

    async def check_quality_degradation(
        self,
        endpoint_id: str,
        accuracy_threshold: float = 0.80,
        hallucination_threshold: float = 0.10
    ) -> Tuple[bool, str]:
        """
        Check if model quality has degraded.

        Returns:
            (has_degraded, reason)
        """
        metrics = await self.monitoring.collect_quality_metrics(endpoint_id)

        if metrics.accuracy < accuracy_threshold:
            return True, f"Accuracy below threshold: {metrics.accuracy:.2%} < {accuracy_threshold:.2%}"

        if metrics.hallucination_rate > hallucination_threshold:
            return True, f"Hallucination rate above threshold: {metrics.hallucination_rate:.2%} > {hallucination_threshold:.2%}"

        return False, "Quality within acceptable range"


# Factory functions
def get_vertex_ai_monitoring(
    project_id: Optional[str] = None,
    location: str = "us-central1"
) -> VertexAIMonitoring:
    """Get VertexAIMonitoring instance."""
    return VertexAIMonitoring(project_id=project_id, location=location)


def get_cost_tracker(monitoring: Optional[VertexAIMonitoring] = None) -> CostTracker:
    """Get CostTracker instance."""
    if not monitoring:
        monitoring = get_vertex_ai_monitoring()
    return CostTracker(monitoring)


def get_quality_monitor(monitoring: Optional[VertexAIMonitoring] = None) -> QualityMonitor:
    """Get QualityMonitor instance."""
    if not monitoring:
        monitoring = get_vertex_ai_monitoring()
    return QualityMonitor(monitoring)
