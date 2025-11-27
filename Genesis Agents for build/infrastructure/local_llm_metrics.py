"""
Prometheus Metrics Exporter for Local LLM

P1-4 Fix: Production-grade observability with Prometheus metrics.

Exposes metrics on port 9090:
- llm_inference_requests_total: Total inference requests (by model, status)
- llm_inference_latency_seconds: Inference latency histogram
- llm_rate_limit_hits_total: Rate limit hits (by client)
- llm_active_connections: Current active connections
- llm_queue_size: Current queue size
- llm_error_total: Total errors (by error type)

Author: Claude (P1 Fixes)
Date: November 3, 2025
Audit: Hudson (8.9/10 recommendation)
"""

import logging
from typing import Optional
from contextlib import contextmanager
import time

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    start_http_server,
    CollectorRegistry,
    REGISTRY
)

logger = logging.getLogger(__name__)


# ============================================================================
# PROMETHEUS METRICS
# ============================================================================

# Request counter (by model, status)
llm_inference_requests_total = Counter(
    'llm_inference_requests_total',
    'Total LLM inference requests',
    ['model', 'status'],  # status: success, error, rate_limited
    registry=REGISTRY
)

# Latency histogram (by model)
llm_inference_latency_seconds = Histogram(
    'llm_inference_latency_seconds',
    'LLM inference latency in seconds',
    ['model'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0],  # Up to 2 minutes
    registry=REGISTRY
)

# Rate limit hits (by client)
llm_rate_limit_hits_total = Counter(
    'llm_rate_limit_hits_total',
    'Total rate limit hits',
    ['client_id'],
    registry=REGISTRY
)

# Active connections gauge
llm_active_connections = Gauge(
    'llm_active_connections',
    'Current number of active LLM connections',
    ['model'],
    registry=REGISTRY
)

# Queue size gauge
llm_queue_size = Gauge(
    'llm_queue_size',
    'Current LLM request queue size',
    ['model'],
    registry=REGISTRY
)

# Error counter (by error type)
llm_error_total = Counter(
    'llm_error_total',
    'Total LLM errors',
    ['error_type'],  # timeout, connection_error, validation_error, etc.
    registry=REGISTRY
)

# Token usage counter (by model)
llm_tokens_total = Counter(
    'llm_tokens_total',
    'Total tokens processed',
    ['model', 'type'],  # type: prompt, completion
    registry=REGISTRY
)

# Model info (static metadata)
llm_model_info = Info(
    'llm_model_info',
    'LLM model metadata',
    registry=REGISTRY
)


# ============================================================================
# METRICS COLLECTOR
# ============================================================================

class LocalLLMMetricsCollector:
    """
    Prometheus metrics collector for Local LLM.

    Usage:
        collector = LocalLLMMetricsCollector(port=9090)
        collector.start()  # Start HTTP server

        # Track inference
        with collector.track_inference("llama-3.2-vision"):
            result = llm_client.generate(...)

        # Track rate limit
        collector.record_rate_limit("client_123")

        # Track error
        collector.record_error("timeout")
    """

    def __init__(
        self,
        port: int = 9090,
        host: str = "0.0.0.0",
        enable_metrics: bool = True
    ):
        """
        Initialize metrics collector.

        Args:
            port: Prometheus HTTP server port (default 9090)
            host: Bind address (default 0.0.0.0 = all interfaces)
            enable_metrics: Whether to enable metrics collection
        """
        self.port = port
        self.host = host
        self.enable_metrics = enable_metrics
        self._server_started = False

        logger.info(
            f"LocalLLMMetricsCollector initialized "
            f"(port={port}, enable_metrics={enable_metrics})"
        )

    def start(self):
        """Start Prometheus HTTP server."""
        if not self.enable_metrics:
            logger.info("Metrics collection disabled")
            return

        if self._server_started:
            logger.warning("Metrics server already started")
            return

        try:
            start_http_server(self.port, addr=self.host)
            self._server_started = True
            logger.info(
                f"✓ Prometheus metrics server started on "
                f"http://{self.host}:{self.port}/metrics"
            )
        except OSError as e:
            if "Address already in use" in str(e):
                logger.warning(
                    f"Metrics port {self.port} already in use - "
                    f"assuming metrics server already running"
                )
                self._server_started = True
            else:
                logger.error(f"Failed to start metrics server: {e}")
                raise

    @contextmanager
    def track_inference(self, model: str):
        """
        Context manager to track inference latency and status.

        Usage:
            with collector.track_inference("llama-3.2-vision"):
                result = llm_client.generate(...)

        Automatically tracks:
        - Request count (success/error)
        - Latency histogram
        - Active connections (incremented during inference)
        """
        if not self.enable_metrics:
            yield
            return

        # Increment active connections
        llm_active_connections.labels(model=model).inc()

        start_time = time.time()
        status = "success"

        try:
            yield
        except Exception as e:
            status = "error"
            error_type = type(e).__name__
            llm_error_total.labels(error_type=error_type).inc()
            raise
        finally:
            # Record latency
            latency = time.time() - start_time
            llm_inference_latency_seconds.labels(model=model).observe(latency)

            # Record request count
            llm_inference_requests_total.labels(model=model, status=status).inc()

            # Decrement active connections
            llm_active_connections.labels(model=model).dec()

    def record_rate_limit(self, client_id: str):
        """Record a rate limit hit."""
        if not self.enable_metrics:
            return

        llm_rate_limit_hits_total.labels(client_id=client_id).inc()
        logger.debug(f"Rate limit hit recorded for client {client_id}")

    def record_error(self, error_type: str):
        """Record an error."""
        if not self.enable_metrics:
            return

        llm_error_total.labels(error_type=error_type).inc()
        logger.debug(f"Error recorded: {error_type}")

    def record_tokens(self, model: str, prompt_tokens: int, completion_tokens: int):
        """Record token usage."""
        if not self.enable_metrics:
            return

        llm_tokens_total.labels(model=model, type="prompt").inc(prompt_tokens)
        llm_tokens_total.labels(model=model, type="completion").inc(completion_tokens)

    def set_queue_size(self, model: str, size: int):
        """Update queue size gauge."""
        if not self.enable_metrics:
            return

        llm_queue_size.labels(model=model).set(size)

    def set_model_info(self, model_name: str, version: str, base_url: str):
        """Set model metadata (called once at startup)."""
        if not self.enable_metrics:
            return

        llm_model_info.info({
            'model': model_name,
            'version': version,
            'base_url': base_url
        })


# ============================================================================
# GLOBAL COLLECTOR INSTANCE
# ============================================================================

# Singleton metrics collector
_global_collector: Optional[LocalLLMMetricsCollector] = None


def get_metrics_collector(
    port: int = 9090,
    enable_metrics: bool = True
) -> LocalLLMMetricsCollector:
    """
    Get global metrics collector instance (singleton).

    Args:
        port: Prometheus HTTP server port
        enable_metrics: Whether to enable metrics

    Returns:
        LocalLLMMetricsCollector instance
    """
    global _global_collector

    if _global_collector is None:
        _global_collector = LocalLLMMetricsCollector(
            port=port,
            enable_metrics=enable_metrics
        )

    return _global_collector


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def start_metrics_server(port: int = 9090, enable_metrics: bool = True):
    """
    Start Prometheus metrics server (convenience function).

    Usage:
        from infrastructure.local_llm_metrics import start_metrics_server
        start_metrics_server(port=9090)
    """
    collector = get_metrics_collector(port=port, enable_metrics=enable_metrics)
    collector.start()


def track_inference(model: str):
    """
    Track inference metrics (convenience function).

    Usage:
        with track_inference("llama-3.2-vision"):
            result = llm_client.generate(...)
    """
    collector = get_metrics_collector()
    return collector.track_inference(model)


def record_rate_limit(client_id: str):
    """Record rate limit hit (convenience function)."""
    collector = get_metrics_collector()
    collector.record_rate_limit(client_id)


def record_error(error_type: str):
    """Record error (convenience function)."""
    collector = get_metrics_collector()
    collector.record_error(error_type)


def record_tokens(model: str, prompt_tokens: int, completion_tokens: int):
    """Record token usage (convenience function)."""
    collector = get_metrics_collector()
    collector.record_tokens(model, prompt_tokens, completion_tokens)
