"""
Vertex AI Model Endpoints

Production-grade endpoint management for Genesis models.
Handles deployment, auto-scaling, A/B testing, and traffic management.

Features:
    - Endpoint creation with dedicated/shared modes
    - Model deployment with hardware configuration
    - Auto-scaling based on traffic and accelerator duty cycle
    - A/B testing with traffic split management
    - Health monitoring and prediction serving
    - Integration with Model Registry

Author: Nova (Vertex AI specialist)
Date: November 3, 2025
Research: Vertex AI Endpoint API, deployment best practices
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
from infrastructure.vertex_ai.model_registry import ModelRegistry, ModelMetadata

logger = logging.getLogger("vertex_ai.model_endpoints")
obs_manager = get_observability_manager()


class TrafficSplitStrategy(Enum):
    """Traffic split strategies for A/B testing."""
    SINGLE = "single"          # 100% to one model
    CANARY = "canary"          # 90/10 split (baseline/canary)
    AB_TEST = "ab_test"        # 50/50 split
    GRADUAL = "gradual"        # Progressive rollout (0% → 100%)
    BLUE_GREEN = "blue_green"  # Blue/green deployment


@dataclass
class AutoScalingConfig:
    """
    Auto-scaling configuration for model deployment.

    Attributes:
        min_replica_count: Minimum number of replicas
        max_replica_count: Maximum number of replicas
        target_accelerator_duty_cycle: Target GPU utilization % (0-100)
        scale_down_delay_minutes: Delay before scaling down
        enable_scale_to_zero: Allow scaling to zero replicas
    """
    min_replica_count: int = 1
    max_replica_count: int = 10
    target_accelerator_duty_cycle: int = 60  # Scale up at 60% GPU utilization
    scale_down_delay_minutes: int = 5
    enable_scale_to_zero: bool = False

    def validate(self):
        """Validate auto-scaling configuration."""
        if self.min_replica_count < 0:
            raise ValueError("min_replica_count must be >= 0")
        if self.max_replica_count < self.min_replica_count:
            raise ValueError("max_replica_count must be >= min_replica_count")
        if not 0 <= self.target_accelerator_duty_cycle <= 100:
            raise ValueError("target_accelerator_duty_cycle must be 0-100")
        if self.enable_scale_to_zero and self.min_replica_count > 0:
            raise ValueError("Cannot enable scale_to_zero with min_replica_count > 0")


@dataclass
class TrafficSplit:
    """
    Traffic split configuration for A/B testing.

    Attributes:
        splits: Map of deployed_model_id → traffic percentage
        strategy: Traffic split strategy
    """
    splits: Dict[str, int] = field(default_factory=dict)
    strategy: TrafficSplitStrategy = TrafficSplitStrategy.SINGLE

    def validate(self):
        """Validate traffic split."""
        if not self.splits:
            raise ValueError("splits cannot be empty")

        total = sum(self.splits.values())
        if total != 100:
            raise ValueError(f"Traffic percentages must sum to 100, got {total}")


@dataclass
class EndpointConfig:
    """
    Complete endpoint configuration.

    Attributes:
        name: Human-readable endpoint name
        display_name: Display name in Vertex AI console
        description: Endpoint purpose
        machine_type: GCP machine type (e.g., "n1-standard-4", "g2-standard-4")
        accelerator_type: GPU/TPU type (e.g., "NVIDIA_TESLA_T4", "NVIDIA_L4")
        accelerator_count: Number of accelerators
        network: VPC network for Private Service Access (format: projects/{project}/global/networks/{network})
        auto_scaling: Auto-scaling configuration
        traffic_split: Traffic split for A/B testing
        enable_request_logging: Enable request/response logging (for predictions)
        enable_access_logging: Enable access logging (for network traffic)
        enable_container_logging: Enable container-level logging
        dedicated_endpoint: Use dedicated endpoint (isolated network)
        spot_instance: Use Spot VMs (cost optimization)
        labels: GCP resource labels
    """
    name: str
    display_name: str
    description: str = ""
    machine_type: str = "n1-standard-4"
    accelerator_type: Optional[str] = None
    accelerator_count: int = 0
    network: str = ""
    auto_scaling: AutoScalingConfig = field(default_factory=AutoScalingConfig)
    traffic_split: Optional[TrafficSplit] = None
    enable_request_logging: bool = True
    enable_access_logging: bool = True
    enable_container_logging: bool = True
    dedicated_endpoint: bool = False
    spot_instance: bool = False
    labels: Dict[str, str] = field(default_factory=dict)

    def validate(self):
        """Validate endpoint configuration."""
        if not self.name:
            raise ValueError("name required")
        self.auto_scaling.validate()
        if self.traffic_split:
            self.traffic_split.validate()
        if self.accelerator_count < 0:
            raise ValueError("accelerator_count must be >= 0")


class ModelEndpoints:
    """
    Model Endpoint Manager for Genesis multi-agent system.

    Manages endpoint lifecycle:
        1. Create endpoints (dedicated or shared)
        2. Deploy models with auto-scaling
        3. Manage A/B testing with traffic splits
        4. Health monitoring and predictions
        5. Undeploy and cleanup

    Usage:
        # Create endpoint manager
        endpoints = ModelEndpoints(project_id="my-project", location="us-central1")

        # Create endpoint
        endpoint = await endpoints.create_endpoint(
            config=EndpointConfig(
                name="gemini-flash-routing-endpoint",
                display_name="Routing Agent Endpoint",
                machine_type="g2-standard-4",
                accelerator_type="NVIDIA_L4",
                accelerator_count=1
            )
        )

        # Deploy model
        await endpoints.deploy_model(
            endpoint_id=endpoint.name,
            model_name="gemini-flash-routing-tuned",
            model_version="1.0.0",
            traffic_percentage=100
        )

        # Make predictions
        response = await endpoints.predict(
            endpoint_id=endpoint.name,
            instances=[{"prompt": "Route task: Write Python function"}]
        )

        # A/B test two models
        await endpoints.update_traffic_split(
            endpoint_id=endpoint.name,
            traffic_split=TrafficSplit(
                splits={"model_v1": 50, "model_v2": 50},
                strategy=TrafficSplitStrategy.AB_TEST
            )
        )
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        model_registry: Optional[ModelRegistry] = None
    ):
        """
        Initialize Model Endpoints Manager.

        Args:
            project_id: GCP project ID
            location: Vertex AI region
            model_registry: ModelRegistry instance
        """
        if not VERTEX_AI_AVAILABLE:
            raise ImportError("Vertex AI SDK required: pip install google-cloud-aiplatform")

        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        if not self.project_id:
            raise ValueError("project_id required (set GOOGLE_CLOUD_PROJECT env var)")

        self.location = location
        self.model_registry = model_registry or ModelRegistry(
            project_id=self.project_id,
            location=self.location
        )

        # Initialize Vertex AI SDK
        aiplatform.init(project=self.project_id, location=self.location)

        # Cache active endpoints
        self.endpoint_cache: Dict[str, Endpoint] = {}

        logger.info(
            f"ModelEndpoints initialized: project={self.project_id}, "
            f"location={self.location}"
        )

    @traced_operation("model_endpoints.create_endpoint", SpanType.INFRASTRUCTURE)
    async def create_endpoint(
        self,
        config: EndpointConfig,
        sync: bool = True
    ) -> Endpoint:
        """
        Create a new Vertex AI endpoint.

        Args:
            config: Endpoint configuration
            sync: Wait for creation to complete

        Returns:
            Vertex AI Endpoint resource

        Raises:
            ValueError: If configuration is invalid
            google_exceptions.GoogleAPICallError: If creation fails
        """
        start_time = time.time()

        # Validate config
        config.validate()

        logger.info(
            f"Creating endpoint: {config.name} "
            f"(dedicated={config.dedicated_endpoint})"
        )

        # Build labels
        labels = config.labels or {}
        labels.update({
            "genesis_endpoint": "true",
            "genesis_version": "1_0_0"
        })

        try:
            # Create endpoint
            endpoint = Endpoint.create(
                display_name=config.display_name or config.name,
                description=config.description,
                labels=labels,
                dedicated_endpoint_enabled=config.dedicated_endpoint,
                encryption_spec_key_name=None,  # Could add KMS encryption
                sync=sync
            )

            if sync:
                endpoint.wait()

            # Cache endpoint
            self.endpoint_cache[endpoint.name] = endpoint

            elapsed = time.time() - start_time
            logger.info(
                f"Endpoint created: {endpoint.resource_name} "
                f"({elapsed:.2f}s)"
            )

            return endpoint

        except Exception as e:
            logger.error(f"Endpoint creation failed: {e}")
            raise

    @traced_operation("model_endpoints.deploy_model", SpanType.INFRASTRUCTURE)
    async def deploy_model(
        self,
        endpoint_id: str,
        model_name: str,
        model_version: str,
        deployed_model_display_name: Optional[str] = None,
        display_name: Optional[str] = None,  # Backward compatibility
        traffic_percentage: int = 100,
        config: Optional[EndpointConfig] = None,
        machine_type: Optional[str] = None,  # Backward compatibility
        accelerator_type: Optional[str] = None,  # Backward compatibility
        accelerator_count: int = 0,  # Backward compatibility
        min_replica_count: int = 1,  # Backward compatibility
        max_replica_count: int = 1,  # Backward compatibility
        sync: bool = True
    ) -> str:
        """
        Deploy a model to an endpoint.

        Args:
            endpoint_id: Endpoint resource name or ID
            model_name: Model name from registry
            model_version: Model version
            deployed_model_display_name: Display name for deployment
            display_name: Alias for deployed_model_display_name (backward compatibility)
            traffic_percentage: Percentage of traffic (0-100)
            config: Endpoint config (machine type, accelerator, auto-scaling)
            machine_type: Machine type (if config not provided)
            accelerator_type: Accelerator type (if config not provided)
            accelerator_count: Accelerator count (if config not provided)
            min_replica_count: Min replicas (if config not provided)
            max_replica_count: Max replicas (if config not provided)
            sync: Wait for deployment to complete (15-25 minutes)

        Returns:
            Deployed model ID

        Raises:
            ValueError: If model not found or config invalid
            google_exceptions.GoogleAPICallError: If deployment fails
        """
        start_time = time.time()

        # Backward compatibility: use display_name if deployed_model_display_name not provided
        if not deployed_model_display_name and display_name:
            deployed_model_display_name = display_name

        # Get model from registry
        model, metadata = await self.model_registry.get_model(model_name, model_version)

        # Get endpoint
        if endpoint_id in self.endpoint_cache:
            endpoint = self.endpoint_cache[endpoint_id]
        else:
            endpoint = Endpoint(endpoint_id)
            self.endpoint_cache[endpoint_id] = endpoint

        # Build config from individual parameters if not provided
        if not config:
            config = EndpointConfig(
                name=endpoint.display_name if hasattr(endpoint, 'display_name') else endpoint_id,
                display_name=endpoint.display_name if hasattr(endpoint, 'display_name') else endpoint_id,
                machine_type=machine_type or "n1-standard-4",
                accelerator_type=accelerator_type,
                accelerator_count=accelerator_count,
                auto_scaling=AutoScalingConfig(
                    min_replica_count=min_replica_count,
                    max_replica_count=max_replica_count
                )
            )
        else:
            config.validate()

        logger.info(
            f"Deploying model to endpoint: {model_name} v{model_version} → {endpoint.display_name} "
            f"(traffic={traffic_percentage}%)"
        )

        try:
            # Deploy model
            deployed_model = model.deploy(
                endpoint=endpoint,
                deployed_model_display_name=deployed_model_display_name or f"{model_name}-v{model_version}",
                machine_type=config.machine_type,
                accelerator_type=config.accelerator_type,
                accelerator_count=config.accelerator_count,
                min_replica_count=config.auto_scaling.min_replica_count,
                max_replica_count=config.auto_scaling.max_replica_count,
                autoscaling_target_accelerator_duty_cycle=config.auto_scaling.target_accelerator_duty_cycle,
                traffic_percentage=traffic_percentage,
                enable_access_logging=config.enable_access_logging,
                enable_container_logging=config.enable_container_logging,
                sync=sync
            )

            elapsed = time.time() - start_time
            logger.info(
                f"Model deployed successfully: {deployed_model.id} "
                f"({elapsed:.2f}s)"
            )

            return deployed_model.id

        except Exception as e:
            logger.error(f"Model deployment failed: {e}")
            raise

    @traced_operation("model_endpoints.predict", SpanType.INFRASTRUCTURE)
    async def predict(
        self,
        endpoint_id: str,
        instances: List[Dict[str, Any]],
        parameters: Optional[Dict[str, Any]] = None,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Make prediction request to endpoint.

        Args:
            endpoint_id: Endpoint resource name or ID
            instances: List of input instances
            parameters: Optional prediction parameters
            timeout: Request timeout (seconds)

        Returns:
            {
                "predictions": [...],
                "deployed_model_id": "...",
                "latency_ms": 123.4
            }

        Raises:
            ValueError: If endpoint not found
            google_exceptions.GoogleAPICallError: If prediction fails
        """
        start_time = time.time()

        # Get endpoint
        if endpoint_id in self.endpoint_cache:
            endpoint = self.endpoint_cache[endpoint_id]
        else:
            endpoint = Endpoint(endpoint_id)
            self.endpoint_cache[endpoint_id] = endpoint

        logger.debug(
            f"Sending prediction request: {len(instances)} instances → {endpoint.display_name}"
        )

        try:
            # Make prediction
            response = endpoint.predict(
                instances=instances,
                parameters=parameters,
                timeout=timeout
            )

            latency_ms = (time.time() - start_time) * 1000

            result = {
                "predictions": response.predictions,
                "deployed_model_id": response.deployed_model_id,
                "latency_ms": latency_ms
            }

            logger.debug(
                f"Prediction completed: {len(response.predictions)} predictions "
                f"({latency_ms:.1f}ms)"
            )

            return result

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise

    @traced_operation("model_endpoints.update_traffic_split", SpanType.INFRASTRUCTURE)
    async def update_traffic_split(
        self,
        endpoint_id: str,
        traffic_split: TrafficSplit
    ) -> bool:
        """
        Update traffic split for A/B testing.

        Args:
            endpoint_id: Endpoint resource name or ID
            traffic_split: New traffic split configuration

        Returns:
            True if updated successfully

        Raises:
            ValueError: If traffic split invalid
        """
        traffic_split.validate()

        # Get endpoint
        if endpoint_id in self.endpoint_cache:
            endpoint = self.endpoint_cache[endpoint_id]
        else:
            endpoint = Endpoint(endpoint_id)
            self.endpoint_cache[endpoint_id] = endpoint

        logger.info(
            f"Updating traffic split: {endpoint.display_name} "
            f"(strategy={traffic_split.strategy.value})"
        )

        try:
            # Update traffic split
            endpoint.update(
                traffic_split=traffic_split.splits
            )

            logger.info(
                f"Traffic split updated: {traffic_split.splits}"
            )

            return True

        except Exception as e:
            logger.error(f"Traffic split update failed: {e}")
            raise

    @traced_operation("model_endpoints.undeploy_model", SpanType.INFRASTRUCTURE)
    async def undeploy_model(
        self,
        endpoint_id: str,
        deployed_model_id: str,
        sync: bool = True
    ) -> bool:
        """
        Undeploy a model from an endpoint.

        Args:
            endpoint_id: Endpoint resource name or ID
            deployed_model_id: Deployed model ID
            sync: Wait for undeployment to complete

        Returns:
            True if undeployed successfully
        """
        # Get endpoint
        if endpoint_id in self.endpoint_cache:
            endpoint = self.endpoint_cache[endpoint_id]
        else:
            endpoint = Endpoint(endpoint_id)
            self.endpoint_cache[endpoint_id] = endpoint

        logger.info(
            f"Undeploying model: {deployed_model_id} from {endpoint.display_name}"
        )

        try:
            endpoint.undeploy(deployed_model_id=deployed_model_id, sync=sync)

            logger.info(f"Model undeployed: {deployed_model_id}")

            return True

        except Exception as e:
            logger.error(f"Model undeployment failed: {e}")
            raise

    @traced_operation("model_endpoints.delete_endpoint", SpanType.INFRASTRUCTURE)
    async def delete_endpoint(
        self,
        endpoint_id: str,
        force: bool = False,
        sync: bool = True
    ) -> bool:
        """
        Delete an endpoint.

        Args:
            endpoint_id: Endpoint resource name or ID
            force: Force deletion even if models deployed
            sync: Wait for deletion to complete

        Returns:
            True if deleted successfully
        """
        # Get endpoint
        if endpoint_id in self.endpoint_cache:
            endpoint = self.endpoint_cache[endpoint_id]
            del self.endpoint_cache[endpoint_id]
        else:
            endpoint = Endpoint(endpoint_id)

        logger.info(f"Deleting endpoint: {endpoint.display_name} (force={force})")

        try:
            endpoint.delete(force=force, sync=sync)

            logger.info(f"Endpoint deleted: {endpoint.display_name}")

            return True

        except Exception as e:
            logger.error(f"Endpoint deletion failed: {e}")
            raise

    @traced_operation("model_endpoints.list_endpoints", SpanType.INFRASTRUCTURE)
    async def list_endpoints(
        self,
        filter_labels: Optional[Dict[str, str]] = None,
        limit: int = 100
    ) -> List[Endpoint]:
        """
        List all endpoints in the project.

        Args:
            filter_labels: Filter by labels (key-value pairs)
            limit: Maximum number of endpoints to return

        Returns:
            List of Endpoint resources
        """
        logger.debug(f"Listing endpoints (filter_labels={filter_labels})")

        try:
            # Build filter string
            filter_str = None
            if filter_labels:
                filters = [f'labels.{k}="{v}"' for k, v in filter_labels.items()]
                filter_str = " AND ".join(filters)

            # List endpoints
            endpoints = Endpoint.list(filter=filter_str)

            # Apply limit
            endpoints = list(endpoints)[:limit]

            # Update cache
            for endpoint in endpoints:
                self.endpoint_cache[endpoint.name] = endpoint

            logger.debug(f"Listed {len(endpoints)} endpoints")

            return endpoints

        except Exception as e:
            logger.error(f"Endpoint listing failed: {e}")
            raise

    @traced_operation("model_endpoints.get_endpoint_stats", SpanType.INFRASTRUCTURE)
    async def get_endpoint_stats(
        self,
        endpoint_id: str
    ) -> Dict[str, Any]:
        """
        Get endpoint statistics.

        Args:
            endpoint_id: Endpoint resource name or ID

        Returns:
            {
                "name": "...",
                "deployed_models": [
                    {
                        "id": "...",
                        "display_name": "...",
                        "machine_type": "...",
                        "min_replicas": 1,
                        "max_replicas": 10,
                        "traffic_percentage": 100
                    }
                ],
                "total_traffic_percentage": 100,
                "status": "healthy"
            }
        """
        # Get endpoint
        if endpoint_id in self.endpoint_cache:
            endpoint = self.endpoint_cache[endpoint_id]
        else:
            endpoint = Endpoint(endpoint_id)
            self.endpoint_cache[endpoint_id] = endpoint

        # Refresh endpoint state
        endpoint.refresh()

        # Extract deployed models
        deployed_models = []
        total_traffic = 0

        for deployed_model in endpoint.traffic_split.items():
            deployed_model_id, traffic_pct = deployed_model
            total_traffic += traffic_pct

            deployed_models.append({
                "id": deployed_model_id,
                "traffic_percentage": traffic_pct
            })

        return {
            "name": endpoint.display_name,
            "resource_name": endpoint.resource_name,
            "deployed_models": deployed_models,
            "total_traffic_percentage": total_traffic,
            "status": "healthy" if total_traffic == 100 else "degraded"
        }


# Factory function
def get_model_endpoints(
    project_id: Optional[str] = None,
    location: str = "us-central1"
) -> ModelEndpoints:
    """
    Get ModelEndpoints instance with default configuration.

    Args:
        project_id: GCP project ID
        location: Vertex AI region

    Returns:
        Configured ModelEndpoints instance
    """
    return ModelEndpoints(project_id=project_id, location=location)
