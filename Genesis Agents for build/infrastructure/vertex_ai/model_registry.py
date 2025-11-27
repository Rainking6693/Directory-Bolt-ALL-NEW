"""
Vertex AI Model Registry

Production-grade model versioning, tracking, and deployment management.
Integrates with SE-Darwin evolution, HALO routing, and cost optimization.

Features:
    - Model upload and versioning
    - Metadata tracking (performance, cost, provenance)
    - A/B testing infrastructure
    - Deployment stage management
    - Integration with SE-Darwin evolution archives

Author: Nova (Vertex AI specialist)
Date: November 3, 2025
Research: Vertex AI Python SDK, Model Garden patterns
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

# Google Cloud imports
try:
    from google.cloud import aiplatform
    from google.cloud.aiplatform import Model, Endpoint
    from google.api_core import exceptions as google_exceptions
    VERTEX_AI_AVAILABLE = True
except ImportError:
    VERTEX_AI_AVAILABLE = False
    logging.warning("Vertex AI SDK not available - install google-cloud-aiplatform")

# Genesis infrastructure
from infrastructure.observability import get_observability_manager, traced_operation, SpanType

logger = logging.getLogger("vertex_ai.model_registry")
obs_manager = get_observability_manager()


class DeploymentStage(Enum):
    """Model deployment stages (GitFlow-style)."""
    DEVELOPMENT = "development"  # Local testing
    STAGING = "staging"          # Pre-production validation
    PRODUCTION = "production"    # Live serving
    ARCHIVED = "archived"        # Deprecated/historical


class ModelSource(Enum):
    """Source of the model (provenance tracking)."""
    SE_DARWIN_EVOLUTION = "se_darwin"     # From SE-Darwin evolution
    MANUAL_UPLOAD = "manual"              # Manually uploaded
    PRETRAINED_HF = "huggingface"         # Hugging Face Hub
    PRETRAINED_VERTEX = "vertex_model_garden"  # Vertex AI Model Garden
    CUSTOM_TRAINING = "custom"            # Custom training job


@dataclass
class ModelMetadata:
    """
    Complete metadata for a registered model.

    Attributes:
        name: Human-readable model name (e.g., "gemini-flash-1.5-tuned")
        display_name: Display name in Vertex AI console
        version: Semantic version (e.g., "1.0.0", "2.1.3")
        description: What the model does
        source: Where the model came from
        base_model: Base model if fine-tuned (e.g., "gemini-2.0-flash")
        artifact_uri: GCS path to model artifacts (gs://bucket/path)
        serving_container_uri: Docker image for serving
        deployment_stage: Current deployment status
        performance_metrics: Benchmark results (accuracy, latency, etc.)
        cost_metrics: Inference cost per 1M tokens
        tags: Searchable tags (e.g., ["reasoning", "code-generation"])
        created_at: Timestamp of upload
        updated_at: Last update timestamp
        created_by: User/agent who uploaded
        parent_version: Previous version if iterative improvement
        vertex_ai_resource_name: Full Vertex AI resource path
    """
    name: str
    display_name: str
    version: str
    description: str
    source: ModelSource
    artifact_uri: str
    serving_container_uri: str
    deployment_stage: DeploymentStage = DeploymentStage.DEVELOPMENT
    base_model: Optional[str] = None
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    cost_metrics: Dict[str, float] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: str = "genesis"
    parent_version: Optional[str] = None
    vertex_ai_resource_name: Optional[str] = None
    custom_metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        data = asdict(self)
        # Convert enums to strings
        data["source"] = self.source.value
        data["deployment_stage"] = self.deployment_stage.value
        # Convert datetime to ISO string
        if self.created_at:
            data["created_at"] = self.created_at.isoformat()
        if self.updated_at:
            data["updated_at"] = self.updated_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelMetadata":
        """Construct from dict."""
        # Convert string enums back
        if "source" in data and isinstance(data["source"], str):
            data["source"] = ModelSource(data["source"])
        if "deployment_stage" in data and isinstance(data["deployment_stage"], str):
            data["deployment_stage"] = DeploymentStage(data["deployment_stage"])
        # Convert ISO strings to datetime
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "updated_at" in data and isinstance(data["updated_at"], str):
            data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        return cls(**data)


@dataclass
class ModelVersion:
    """Simplified model version reference."""
    name: str
    version: str
    vertex_ai_resource_name: str
    deployment_stage: DeploymentStage
    created_at: datetime
    performance_score: float = 0.0  # Overall quality score

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict."""
        return {
            "name": self.name,
            "version": self.version,
            "vertex_ai_resource_name": self.vertex_ai_resource_name,
            "deployment_stage": self.deployment_stage.value,
            "created_at": self.created_at.isoformat(),
            "performance_score": self.performance_score
        }


class ModelRegistry:
    """
    Vertex AI Model Registry for Genesis multi-agent system.

    Manages model lifecycle:
        1. Upload models to Vertex AI Model Registry
        2. Track versions and metadata
        3. Manage deployment stages (dev → staging → prod)
        4. A/B testing infrastructure
        5. Integration with SE-Darwin evolution

    Usage:
        # Upload a fine-tuned model
        registry = ModelRegistry(project_id="my-project", location="us-central1")
        metadata = ModelMetadata(
            name="gemini-flash-tuned-for-routing",
            version="1.0.0",
            source=ModelSource.SE_DARWIN_EVOLUTION,
            artifact_uri="gs://my-bucket/tuned-models/routing-v1",
            serving_container_uri="us-docker.pkg.dev/vertex-ai/prediction/..."
        )
        model_resource = await registry.upload_model(metadata)

        # Promote to production
        await registry.promote_model("gemini-flash-tuned-for-routing", "1.0.0", DeploymentStage.PRODUCTION)

        # List all production models
        prod_models = await registry.list_models(stage=DeploymentStage.PRODUCTION)
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        metadata_storage_path: Optional[str] = None
    ):
        """
        Initialize Model Registry.

        Args:
            project_id: GCP project ID (defaults to GOOGLE_CLOUD_PROJECT env var)
            location: Vertex AI region (us-central1, europe-west4, etc.)
            metadata_storage_path: Local JSON file for metadata cache
        """
        if not VERTEX_AI_AVAILABLE:
            raise ImportError("Vertex AI SDK required: pip install google-cloud-aiplatform")

        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        if not self.project_id:
            raise ValueError("project_id required (set GOOGLE_CLOUD_PROJECT env var)")

        self.location = location
        self.metadata_storage_path = metadata_storage_path or "/tmp/genesis_model_registry.json"

        # Initialize Vertex AI SDK
        aiplatform.init(project=self.project_id, location=self.location)

        # In-memory metadata cache
        self.metadata_cache: Dict[str, ModelMetadata] = {}
        self._load_metadata_cache()

        logger.info(
            f"ModelRegistry initialized: project={self.project_id}, "
            f"location={self.location}"
        )

    def _load_metadata_cache(self):
        """Load metadata from local JSON file."""
        try:
            if Path(self.metadata_storage_path).exists():
                with open(self.metadata_storage_path, "r") as f:
                    data = json.load(f)
                    for key, val in data.items():
                        self.metadata_cache[key] = ModelMetadata.from_dict(val)
                logger.info(f"Loaded {len(self.metadata_cache)} models from cache")
        except Exception as e:
            logger.warning(f"Could not load metadata cache: {e}")

    def _save_metadata_cache(self):
        """Persist metadata to local JSON file."""
        try:
            data = {key: val.to_dict() for key, val in self.metadata_cache.items()}
            with open(self.metadata_storage_path, "w") as f:
                json.dump(data, f, indent=2)
            logger.debug(f"Saved {len(self.metadata_cache)} models to cache")
        except Exception as e:
            logger.warning(f"Could not save metadata cache: {e}")

    def _get_cache_key(self, name: str, version: str) -> str:
        """Generate cache key from name and version."""
        return f"{name}:{version}"

    @traced_operation("model_registry.upload_model", SpanType.INFRASTRUCTURE)
    async def upload_model(
        self,
        metadata: ModelMetadata,
        serving_container_ports: List[int] = [8080],
        serving_container_predict_route: str = "/predict",
        serving_container_health_route: str = "/health",
        serving_container_env_vars: Optional[Dict[str, str]] = None,
        shared_memory_mb: int = 16384,  # 16 GB shared memory
        deployment_timeout: int = 1800,  # 30 minutes
        labels: Optional[Dict[str, str]] = None,
        sync: bool = True
    ) -> Model:
        """
        Upload a model to Vertex AI Model Registry.

        Args:
            metadata: Complete model metadata
            serving_container_ports: Ports exposed by serving container
            serving_container_predict_route: HTTP route for predictions
            serving_container_health_route: HTTP route for health checks
            serving_container_env_vars: Environment variables for container
            shared_memory_mb: Shared memory allocation (MB)
            deployment_timeout: Timeout for deployment (seconds)
            labels: GCP resource labels (key-value pairs)
            sync: Whether to wait for upload to complete

        Returns:
            Vertex AI Model resource

        Raises:
            ValueError: If metadata is invalid
            google_exceptions.GoogleAPICallError: If upload fails
        """
        start_time = time.time()

        # Validate metadata
        if not metadata.artifact_uri.startswith("gs://"):
            raise ValueError(f"artifact_uri must be GCS path (gs://...): {metadata.artifact_uri}")

        if not metadata.serving_container_uri:
            raise ValueError("serving_container_uri required")

        # Set timestamps
        if not metadata.created_at:
            metadata.created_at = datetime.utcnow()
        metadata.updated_at = datetime.utcnow()

        # Build labels for Vertex AI
        vertex_labels = labels or {}
        vertex_labels.update({
            "genesis_version": metadata.version.replace(".", "_"),  # GCP labels don't allow dots
            "genesis_source": metadata.source.value,
            "genesis_stage": metadata.deployment_stage.value,
        })

        # Add tags as labels
        for tag in metadata.tags[:10]:  # Max 10 tags (GCP limit: 64 labels)
            safe_tag = tag.replace(" ", "_").replace("-", "_").lower()
            vertex_labels[f"tag_{safe_tag}"] = "true"

        # Prepare environment variables
        env_vars = serving_container_env_vars or {}
        env_vars.update({
            "GENESIS_MODEL_NAME": metadata.name,
            "GENESIS_MODEL_VERSION": metadata.version,
            "GENESIS_DEPLOYMENT_STAGE": metadata.deployment_stage.value
        })

        logger.info(
            f"Uploading model to Vertex AI: {metadata.name} v{metadata.version} "
            f"(stage={metadata.deployment_stage.value})"
        )

        try:
            # Upload model using Vertex AI SDK
            model = Model.upload(
                display_name=metadata.display_name or f"{metadata.name}-v{metadata.version}",
                description=metadata.description,
                artifact_uri=metadata.artifact_uri,
                serving_container_image_uri=metadata.serving_container_uri,
                serving_container_ports=serving_container_ports,
                serving_container_predict_route=serving_container_predict_route,
                serving_container_health_route=serving_container_health_route,
                serving_container_environment_variables=env_vars,
                serving_container_shared_memory_size_mb=shared_memory_mb,
                serving_container_deployment_timeout=deployment_timeout,
                labels=vertex_labels,
                sync=sync
            )

            # Wait for upload if sync=True
            if sync:
                model.wait()

            # Update metadata with Vertex AI resource name
            metadata.vertex_ai_resource_name = model.resource_name

            # Cache metadata
            cache_key = self._get_cache_key(metadata.name, metadata.version)
            self.metadata_cache[cache_key] = metadata
            self._save_metadata_cache()

            elapsed = time.time() - start_time
            logger.info(
                f"Model uploaded successfully: {model.resource_name} "
                f"({elapsed:.2f}s)"
            )

            return model

        except Exception as e:
            logger.error(f"Model upload failed: {e}")
            raise

    @traced_operation("model_registry.get_model", SpanType.INFRASTRUCTURE)
    async def get_model(
        self,
        name: str,
        version: str
    ) -> Tuple[Model, ModelMetadata]:
        """
        Retrieve model from registry.

        Args:
            name: Model name
            version: Model version

        Returns:
            (Vertex AI Model resource, ModelMetadata)

        Raises:
            ValueError: If model not found
        """
        cache_key = self._get_cache_key(name, version)

        if cache_key not in self.metadata_cache:
            raise ValueError(f"Model not found in registry: {name} v{version}")

        metadata = self.metadata_cache[cache_key]

        # Load from Vertex AI
        try:
            model = Model(metadata.vertex_ai_resource_name)
            return model, metadata
        except Exception as e:
            logger.error(f"Failed to load model from Vertex AI: {e}")
            raise

    @traced_operation("model_registry.list_models", SpanType.INFRASTRUCTURE)
    async def list_models(
        self,
        stage: Optional[DeploymentStage] = None,
        source: Optional[ModelSource] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[ModelMetadata]:
        """
        List models in registry with optional filters.

        Args:
            stage: Filter by deployment stage
            source: Filter by model source
            tags: Filter by tags (models must have all tags)
            limit: Maximum number of models to return

        Returns:
            List of ModelMetadata objects
        """
        results = []

        for metadata in self.metadata_cache.values():
            # Apply filters
            if stage and metadata.deployment_stage != stage:
                continue
            if source and metadata.source != source:
                continue
            if tags:
                if not all(tag in metadata.tags for tag in tags):
                    continue

            results.append(metadata)

            if len(results) >= limit:
                break

        # Sort by updated_at (most recent first)
        results.sort(key=lambda m: m.updated_at or datetime.min, reverse=True)

        logger.debug(
            f"Listed {len(results)} models (stage={stage}, source={source}, tags={tags})"
        )

        return results

    @traced_operation("model_registry.promote_model", SpanType.INFRASTRUCTURE)
    async def promote_model(
        self,
        name: str,
        version: str,
        new_stage: DeploymentStage
    ) -> ModelMetadata:
        """
        Promote model to a new deployment stage.

        Flow: DEVELOPMENT → STAGING → PRODUCTION

        Args:
            name: Model name
            version: Model version
            new_stage: Target deployment stage

        Returns:
            Updated ModelMetadata

        Raises:
            ValueError: If promotion is invalid
        """
        cache_key = self._get_cache_key(name, version)

        if cache_key not in self.metadata_cache:
            raise ValueError(f"Model not found: {name} v{version}")

        metadata = self.metadata_cache[cache_key]
        old_stage = metadata.deployment_stage

        # Validate stage transition
        stage_order = [
            DeploymentStage.DEVELOPMENT,
            DeploymentStage.STAGING,
            DeploymentStage.PRODUCTION,
            DeploymentStage.ARCHIVED
        ]

        if stage_order.index(new_stage) < stage_order.index(old_stage):
            if new_stage != DeploymentStage.ARCHIVED:
                raise ValueError(
                    f"Cannot demote from {old_stage.value} to {new_stage.value} "
                    "(except to ARCHIVED)"
                )

        # Update metadata
        metadata.deployment_stage = new_stage
        metadata.updated_at = datetime.utcnow()

        # Save to cache
        self.metadata_cache[cache_key] = metadata
        self._save_metadata_cache()

        logger.info(
            f"Promoted model: {name} v{version} from {old_stage.value} → {new_stage.value}"
        )

        return metadata

    @traced_operation("model_registry.update_performance_metrics", SpanType.INFRASTRUCTURE)
    async def update_performance_metrics(
        self,
        name: str,
        version: str,
        metrics: Dict[str, float]
    ) -> ModelMetadata:
        """
        Update performance metrics for a model.

        Typical metrics:
            - accuracy: 0.85
            - latency_p50: 123.4 (ms)
            - latency_p95: 456.7 (ms)
            - throughput_qps: 100.0
            - error_rate: 0.01

        Args:
            name: Model name
            version: Model version
            metrics: Performance metrics dict

        Returns:
            Updated ModelMetadata
        """
        cache_key = self._get_cache_key(name, version)

        if cache_key not in self.metadata_cache:
            raise ValueError(f"Model not found: {name} v{version}")

        metadata = self.metadata_cache[cache_key]
        metadata.performance_metrics.update(metrics)
        metadata.updated_at = datetime.utcnow()

        # Save to cache
        self.metadata_cache[cache_key] = metadata
        self._save_metadata_cache()

        logger.info(
            f"Updated performance metrics for {name} v{version}: "
            f"{list(metrics.keys())}"
        )

        return metadata

    @traced_operation("model_registry.update_cost_metrics", SpanType.INFRASTRUCTURE)
    async def update_cost_metrics(
        self,
        name: str,
        version: str,
        metrics: Dict[str, float]
    ) -> ModelMetadata:
        """
        Update cost metrics for a model.

        Typical metrics:
            - cost_per_1m_tokens: 0.03  # USD
            - cost_per_request: 0.0001  # USD
            - monthly_cost: 120.50      # USD

        Args:
            name: Model name
            version: Model version
            metrics: Cost metrics dict

        Returns:
            Updated ModelMetadata
        """
        cache_key = self._get_cache_key(name, version)

        if cache_key not in self.metadata_cache:
            raise ValueError(f"Model not found: {name} v{version}")

        metadata = self.metadata_cache[cache_key]
        metadata.cost_metrics.update(metrics)
        metadata.updated_at = datetime.utcnow()

        # Save to cache
        self.metadata_cache[cache_key] = metadata
        self._save_metadata_cache()

        logger.info(
            f"Updated cost metrics for {name} v{version}: "
            f"{list(metrics.keys())}"
        )

        return metadata

    @traced_operation("model_registry.delete_model", SpanType.INFRASTRUCTURE)
    async def delete_model(
        self,
        name: str,
        version: str,
        delete_from_vertex_ai: bool = False
    ) -> bool:
        """
        Delete model from registry.

        Args:
            name: Model name
            version: Model version
            delete_from_vertex_ai: Also delete from Vertex AI (irreversible)

        Returns:
            True if deleted successfully

        Raises:
            ValueError: If model not found
        """
        cache_key = self._get_cache_key(name, version)

        if cache_key not in self.metadata_cache:
            raise ValueError(f"Model not found: {name} v{version}")

        metadata = self.metadata_cache[cache_key]

        # Delete from Vertex AI if requested
        if delete_from_vertex_ai and metadata.vertex_ai_resource_name:
            try:
                model = Model(metadata.vertex_ai_resource_name)
                model.delete()
                logger.info(f"Deleted model from Vertex AI: {metadata.vertex_ai_resource_name}")
            except Exception as e:
                logger.warning(f"Failed to delete from Vertex AI: {e}")

        # Remove from cache
        del self.metadata_cache[cache_key]
        self._save_metadata_cache()

        logger.info(f"Deleted model from registry: {name} v{version}")

        return True

    @traced_operation("model_registry.compare_versions", SpanType.INFRASTRUCTURE)
    async def compare_versions(
        self,
        name: str,
        version_a: str,
        version_b: str
    ) -> Dict[str, Any]:
        """
        Compare two versions of the same model.

        Useful for A/B testing and performance regression detection.

        Args:
            name: Model name
            version_a: First version
            version_b: Second version

        Returns:
            {
                "version_a": {...},
                "version_b": {...},
                "performance_diff": {
                    "accuracy": +0.05,
                    "latency_p95": -50.0  # Improvement
                },
                "cost_diff": {
                    "cost_per_1m_tokens": -0.01  # Savings
                },
                "recommendation": "version_b is 5% more accurate and 25% faster"
            }
        """
        key_a = self._get_cache_key(name, version_a)
        key_b = self._get_cache_key(name, version_b)

        if key_a not in self.metadata_cache or key_b not in self.metadata_cache:
            raise ValueError("Both versions must exist in registry")

        meta_a = self.metadata_cache[key_a]
        meta_b = self.metadata_cache[key_b]

        # Calculate performance diff
        perf_diff = {}
        for key in set(meta_a.performance_metrics.keys()) | set(meta_b.performance_metrics.keys()):
            val_a = meta_a.performance_metrics.get(key, 0.0)
            val_b = meta_b.performance_metrics.get(key, 0.0)
            perf_diff[key] = val_b - val_a

        # Calculate cost diff
        cost_diff = {}
        for key in set(meta_a.cost_metrics.keys()) | set(meta_b.cost_metrics.keys()):
            val_a = meta_a.cost_metrics.get(key, 0.0)
            val_b = meta_b.cost_metrics.get(key, 0.0)
            cost_diff[key] = val_b - val_a

        # Generate recommendation
        recommendation = self._generate_recommendation(perf_diff, cost_diff, version_a, version_b)

        return {
            "version_a": meta_a.to_dict(),
            "version_b": meta_b.to_dict(),
            "performance_diff": perf_diff,
            "cost_diff": cost_diff,
            "recommendation": recommendation
        }

    def _generate_recommendation(
        self,
        perf_diff: Dict[str, float],
        cost_diff: Dict[str, float],
        version_a: str,
        version_b: str
    ) -> str:
        """Generate human-readable recommendation from diffs."""
        improvements = []
        regressions = []

        # Check accuracy
        if "accuracy" in perf_diff:
            acc_diff = perf_diff["accuracy"]
            if acc_diff > 0.01:
                improvements.append(f"{acc_diff*100:.1f}% more accurate")
            elif acc_diff < -0.01:
                regressions.append(f"{-acc_diff*100:.1f}% less accurate")

        # Check latency
        if "latency_p95" in perf_diff:
            lat_diff = perf_diff["latency_p95"]
            if lat_diff < -10:  # Faster
                pct = abs(lat_diff / (perf_diff.get("latency_p95", 1) + abs(lat_diff))) * 100
                improvements.append(f"{pct:.0f}% faster")
            elif lat_diff > 10:  # Slower
                pct = lat_diff / (perf_diff.get("latency_p95", 1)) * 100
                regressions.append(f"{pct:.0f}% slower")

        # Check cost
        if "cost_per_1m_tokens" in cost_diff:
            cost_change = cost_diff["cost_per_1m_tokens"]
            if cost_change < -0.001:  # Cheaper
                improvements.append(f"${abs(cost_change):.4f}/1M tokens cheaper")
            elif cost_change > 0.001:  # More expensive
                regressions.append(f"${cost_change:.4f}/1M tokens more expensive")

        # Build recommendation
        if improvements and not regressions:
            return f"{version_b} is better: {', '.join(improvements)}"
        elif regressions and not improvements:
            return f"{version_a} is better: {version_b} has {', '.join(regressions)}"
        elif improvements and regressions:
            return f"Mixed: {version_b} has {', '.join(improvements)} but {', '.join(regressions)}"
        else:
            return f"No significant difference between {version_a} and {version_b}"


# Factory function
def get_model_registry(
    project_id: Optional[str] = None,
    location: str = "us-central1"
) -> ModelRegistry:
    """
    Get ModelRegistry instance with default configuration.

    Args:
        project_id: GCP project ID (defaults to env var)
        location: Vertex AI region

    Returns:
        Configured ModelRegistry instance
    """
    return ModelRegistry(project_id=project_id, location=location)
