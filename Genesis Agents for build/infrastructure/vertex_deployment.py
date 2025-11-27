"""
Vertex AI Deployment Utilities
==============================

Provides a high-level manager for registering Genesis tuned models with
Vertex AI, creating endpoints, handling traffic splits, and rolling back
deployments.  The code is written to run in two modes:

1. **Live mode** — when ``google-cloud-aiplatform`` is installed and credentials
   are configured.  In this case the manager proxies operations to the official
   Vertex AI SDK.
2. **Mock mode** — when the SDK is unavailable (e.g. in CI, local testing).  The
   manager falls back to a pure in-memory simulation so that unit-tests can
   verify orchestration logic without hitting external services.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple
import logging
import uuid

logger = logging.getLogger(__name__)

try:
    from google.cloud import aiplatform
    HAS_VERTEX = True
except ImportError:  # pragma: no cover - library optional
    HAS_VERTEX = False
    aiplatform = None  # type: ignore
    logger.warning("google-cloud-aiplatform not installed; using mock Vertex deployment manager.")


@dataclass
class ModelVersion:
    """Represents a single deployed model version."""

    model_resource_name: str
    display_name: str
    artifact_uri: str
    container_image_uri: str
    deployed: bool = False


@dataclass
class EndpointRecord:
    """Represents an endpoint with traffic history."""

    endpoint_id: str
    display_name: str
    location: str
    traffic_split: Dict[str, int] = field(default_factory=dict)  # model_resource_name -> percentage
    version_history: List[str] = field(default_factory=list)


class VertexDeploymentManager:
    """
    Handles Vertex AI model uploads, endpoint creation, and rollout management.

    The manager exposes a minimal surface tailored to Genesis use-cases:
    - upload models (7 tuned Mistral variants)
    - create endpoints and deploy versions with traffic splits
    - promote/rollback versions for safe releases
    - list endpoints and associated models
    """

    def __init__(
        self,
        project_id: str,
        location: str = "us-central1",
        staging_bucket: Optional[str] = None,
        enable_vertex: Optional[bool] = None,
    ):
        self.project_id = project_id
        self.location = location
        self.staging_bucket = staging_bucket
        self._use_vertex = enable_vertex if enable_vertex is not None else HAS_VERTEX

        self._models: Dict[str, ModelVersion] = {}
        self._endpoints: Dict[str, EndpointRecord] = {}

        if self._use_vertex and not HAS_VERTEX:
            raise RuntimeError("enable_vertex=True but google-cloud-aiplatform is not installed")

        if self._use_vertex:
            aiplatform.init(project=self.project_id, location=self.location, staging_bucket=self.staging_bucket)
            logger.info("VertexDeploymentManager running in LIVE mode for project %s", self.project_id)
        else:
            logger.info("VertexDeploymentManager running in MOCK mode")

    # ------------------------------------------------------------------ #
    # Model Upload
    # ------------------------------------------------------------------ #

    def upload_model(
        self,
        display_name: str,
        artifact_uri: str,
        serving_container_image_uri: str,
        labels: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Upload a model artifact to Vertex AI Model Registry.

        Returns:
            str: Resource name of the uploaded model.
        """
        model_resource_name: str

        if self._use_vertex:
            model = aiplatform.Model.upload(
                display_name=display_name,
                artifact_uri=artifact_uri,
                serving_container_image_uri=serving_container_image_uri,
                labels=labels or {},
            )
            model_resource_name = model.resource_name  # type: ignore[attr-defined]
            logger.info("Uploaded model %s → %s", display_name, model_resource_name)
        else:
            model_resource_name = f"projects/{self.project_id}/locations/{self.location}/models/mock-{uuid.uuid4().hex}"
            logger.debug("[MOCK] Uploaded model %s → %s", display_name, model_resource_name)

        self._models[model_resource_name] = ModelVersion(
            model_resource_name=model_resource_name,
            display_name=display_name,
            artifact_uri=artifact_uri,
            container_image_uri=serving_container_image_uri,
        )
        return model_resource_name

    # ------------------------------------------------------------------ #
    # Endpoint Management
    # ------------------------------------------------------------------ #

    def create_endpoint(self, display_name: str) -> str:
        """
        Create an endpoint (or return existing one with same display name in mock mode).

        Returns:
            str: Endpoint resource name.
        """
        endpoint_resource_name: str

        if self._use_vertex:
            endpoint = aiplatform.Endpoint.create(display_name=display_name)
            endpoint_resource_name = endpoint.resource_name  # type: ignore[attr-defined]
            logger.info("Created endpoint %s → %s", display_name, endpoint_resource_name)
        else:
            existing = next((ep for ep in self._endpoints.values() if ep.display_name == display_name), None)
            if existing:
                return existing.endpoint_id
            endpoint_resource_name = f"projects/{self.project_id}/locations/{self.location}/endpoints/mock-{uuid.uuid4().hex}"
            logger.debug("[MOCK] Created endpoint %s → %s", display_name, endpoint_resource_name)

        self._endpoints[endpoint_resource_name] = EndpointRecord(
            endpoint_id=endpoint_resource_name,
            display_name=display_name,
            location=self.location,
        )
        return endpoint_resource_name

    def deploy_model(
        self,
        endpoint_id: str,
        model_resource_name: str,
        traffic_percentage: int = 100,
        min_replica_count: int = 1,
        max_replica_count: int = 3,
    ) -> None:
        """
        Deploy a model to an endpoint and adjust the traffic split.
        """
        if model_resource_name not in self._models:
            raise ValueError(f"Unknown model: {model_resource_name}")
        if endpoint_id not in self._endpoints:
            raise ValueError(f"Unknown endpoint: {endpoint_id}")

        model = self._models[model_resource_name]
        endpoint = self._endpoints[endpoint_id]

        if self._use_vertex:
            endpoint_obj = aiplatform.Endpoint(endpoint_id)
            endpoint_obj.deploy(
                model=model_resource_name,
                deployed_model_display_name=model.display_name,
                traffic_percentage=traffic_percentage,
                min_replica_count=min_replica_count,
                max_replica_count=max_replica_count,
            )

        # Update mock metadata
        endpoint.traffic_split[model_resource_name] = traffic_percentage
        # normalise splits
        total = sum(endpoint.traffic_split.values())
        for model_id in list(endpoint.traffic_split.keys()):
            endpoint.traffic_split[model_id] = int(round((endpoint.traffic_split[model_id] / total) * 100))
        model.deployed = True
        endpoint.version_history.append(model_resource_name)
        logger.debug("Model %s deployed to endpoint %s (traffic=%s%%)", model.display_name, endpoint.display_name, traffic_percentage)

    # ------------------------------------------------------------------ #
    # Promotion / Rollback
    # ------------------------------------------------------------------ #

    def promote_model(self, endpoint_id: str, new_model_resource: str) -> None:
        """
        Promote a new model version by shifting traffic to 100%.
        """
        if endpoint_id not in self._endpoints:
            raise ValueError(f"Unknown endpoint: {endpoint_id}")
        endpoint = self._endpoints[endpoint_id]
        self.deploy_model(endpoint_id, new_model_resource, traffic_percentage=100)
        logger.info("Promoted model %s on endpoint %s", new_model_resource, endpoint.display_name)

    def rollback(self, endpoint_id: str) -> Optional[str]:
        """
        Roll back to the previous model version on an endpoint.

        Returns:
            Optional[str]: the model resource name that is active after rollback,
            or ``None`` if no previous version exists.
        """
        if endpoint_id not in self._endpoints:
            raise ValueError(f"Unknown endpoint: {endpoint_id}")
        endpoint = self._endpoints[endpoint_id]
        if len(endpoint.version_history) < 2:
            logger.warning("No previous version to roll back to on endpoint %s", endpoint.display_name)
            return None

        # pop current version
        current = endpoint.version_history.pop()
        previous = endpoint.version_history[-1]
        endpoint.traffic_split = {previous: 100}
        logger.info("Rolled back endpoint %s from %s to %s", endpoint.display_name, current, previous)
        return previous

    # ------------------------------------------------------------------ #
    # Utility
    # ------------------------------------------------------------------ #

    def list_endpoints(self) -> List[EndpointRecord]:
        """Return metadata for all managed endpoints."""
        return list(self._endpoints.values())

    def describe_model(self, model_resource_name: str) -> ModelVersion:
        if model_resource_name not in self._models:
            raise ValueError(f"Unknown model: {model_resource_name}")
        return self._models[model_resource_name]

    def ensure_models_uploaded(self, models: Iterable[Tuple[str, str, str]]) -> List[str]:
        """
        Convenience helper to bulk upload models.

        Args:
            models: iterable of tuples (display_name, artifact_uri, container_image)

        Returns:
            List[str]: resource names of uploaded models.
        """
        resource_names = []
        for display_name, artifact_uri, container in models:
            resource_names.append(
                self.upload_model(
                    display_name=display_name,
                    artifact_uri=artifact_uri,
                    serving_container_image_uri=container,
                )
            )
        return resource_names

