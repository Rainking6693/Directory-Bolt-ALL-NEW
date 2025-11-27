"""
Vertex AI Integration Infrastructure

Production-grade LLM deployment infrastructure for Genesis multi-agent system.
Provides model registry, fine-tuning pipelines, endpoint management, and monitoring.

Components:
    - ModelRegistry: Upload, version, and manage models in Vertex AI
    - FineTuningPipeline: Supervised, RLHF, and distillation workflows
    - ModelEndpoints: Deploy models with auto-scaling and A/B testing
    - Monitoring: Track performance, cost, and quality metrics

Author: Nova (Vertex AI specialist)
Date: November 3, 2025
Integration: Phase 5 Production Infrastructure
"""

from .model_registry import (
    ModelRegistry,
    ModelMetadata,
    ModelVersion,
    DeploymentStage
)
from .fine_tuning_pipeline import (
    FineTuningPipeline,
    TuningJobConfig,
    TuningJobStatus,
    TuningType
)
from .model_endpoints import (
    ModelEndpoints,
    EndpointConfig,
    TrafficSplit,
    AutoScalingConfig
)
from .monitoring import (
    VertexAIMonitoring,
    ModelMetrics,
    CostTracker,
    QualityMonitor
)

__all__ = [
    # Model Registry
    "ModelRegistry",
    "ModelMetadata",
    "ModelVersion",
    "DeploymentStage",

    # Fine-Tuning
    "FineTuningPipeline",
    "TuningJobConfig",
    "TuningJobStatus",
    "TuningType",

    # Endpoints
    "ModelEndpoints",
    "EndpointConfig",
    "TrafficSplit",
    "AutoScalingConfig",

    # Monitoring
    "VertexAIMonitoring",
    "ModelMetrics",
    "CostTracker",
    "QualityMonitor",
]

__version__ = "1.0.0"
__author__ = "Nova (Vertex AI specialist)"
__integration__ = "Phase 5 Production Infrastructure"
