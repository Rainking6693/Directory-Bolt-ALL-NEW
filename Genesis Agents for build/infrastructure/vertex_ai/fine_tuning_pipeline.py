"""
Vertex AI Fine-Tuning Pipeline

Production-grade fine-tuning workflows for Genesis models.
Supports supervised fine-tuning, RLHF, and distillation.

Integration Points:
    - SE-Darwin evolution trajectories (training data source)
    - HALO router decisions (routing fine-tuning)
    - HTDAG task decompositions (planning fine-tuning)
    - Swarm Coordinator team compositions (collaboration fine-tuning)

Author: Nova (Vertex AI specialist)
Date: November 3, 2025
Research: Vertex AI Tuning API, RLHF papers, distillation best practices
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable

# Google Cloud imports
try:
    from google.cloud import aiplatform
    from google.cloud.aiplatform import PipelineJob, CustomJob
    from google.api_core import exceptions as google_exceptions
    VERTEX_AI_AVAILABLE = True
except ImportError:
    VERTEX_AI_AVAILABLE = False
    logging.warning("Vertex AI SDK not available - install google-cloud-aiplatform")

# Genesis infrastructure
from infrastructure.observability import get_observability_manager, traced_operation, SpanType
from infrastructure.vertex_ai.model_registry import (
    ModelRegistry,
    ModelMetadata,
    ModelSource,
    DeploymentStage
)

logger = logging.getLogger("vertex_ai.fine_tuning")
obs_manager = get_observability_manager()


class TuningType(Enum):
    """Types of fine-tuning supported."""
    SUPERVISED = "supervised"           # Standard supervised fine-tuning
    RLHF = "rlhf"                      # Reinforcement Learning from Human Feedback
    DISTILLATION = "distillation"      # Knowledge distillation (large → small)
    PARAMETER_EFFICIENT = "peft"       # LoRA, QLoRA, etc.


class TuningJobStatus(Enum):
    """Status of a tuning job."""
    PENDING = "pending"                 # Not yet started
    RUNNING = "running"                 # Currently training
    SUCCEEDED = "succeeded"             # Training completed successfully
    FAILED = "failed"                   # Training failed
    CANCELLED = "cancelled"             # User cancelled
    VALIDATING = "validating"           # Post-training validation


@dataclass
class TrainingDataset:
    """
    Training dataset configuration.

    Attributes:
        train_uri: GCS path to training data (JSONL format)
        validation_uri: Optional GCS path to validation data
        test_uri: Optional GCS path to test data
        num_train_samples: Number of training samples
        num_val_samples: Number of validation samples
        format: Data format ("jsonl", "tfrecord", "csv")
    """
    train_uri: str
    validation_uri: Optional[str] = None
    test_uri: Optional[str] = None
    num_train_samples: int = 0
    num_val_samples: int = 0
    format: str = "jsonl"

    def validate(self):
        """Validate dataset configuration."""
        if not self.train_uri.startswith("gs://"):
            raise ValueError(f"train_uri must be GCS path: {self.train_uri}")
        if self.validation_uri and not self.validation_uri.startswith("gs://"):
            raise ValueError(f"validation_uri must be GCS path: {self.validation_uri}")
        if self.num_train_samples < 100:
            logger.warning(
                f"Training with only {self.num_train_samples} samples may result in poor quality"
            )


@dataclass
class HyperparameterConfig:
    """
    Hyperparameter configuration for fine-tuning.

    Attributes:
        learning_rate: Initial learning rate
        batch_size: Training batch size
        num_epochs: Number of training epochs
        warmup_steps: Learning rate warmup steps
        weight_decay: L2 regularization strength
        max_seq_length: Maximum sequence length
        gradient_accumulation_steps: Steps to accumulate gradients
        scheduler: Learning rate scheduler ("linear", "cosine", "constant")
        optimizer: Optimizer ("adam", "adamw", "sgd")
    """
    learning_rate: float = 1e-5
    batch_size: int = 8
    num_epochs: int = 3
    warmup_steps: int = 100
    weight_decay: float = 0.01
    max_seq_length: int = 2048
    gradient_accumulation_steps: int = 1
    scheduler: str = "linear"
    optimizer: str = "adamw"
    # LoRA-specific (if using PEFT)
    lora_r: int = 8
    lora_alpha: int = 16
    lora_dropout: float = 0.05


@dataclass
class RLHFConfig:
    """
    RLHF-specific configuration.

    Attributes:
        reward_model_uri: GCS path to reward model
        ppo_epochs: PPO training epochs
        ppo_clip_range: PPO clip range
        value_loss_coef: Value loss coefficient
        kl_penalty_coef: KL divergence penalty coefficient
        reference_model_uri: Optional reference model for KL divergence
    """
    reward_model_uri: str
    ppo_epochs: int = 4
    ppo_clip_range: float = 0.2
    value_loss_coef: float = 0.5
    kl_penalty_coef: float = 0.1
    reference_model_uri: Optional[str] = None


@dataclass
class DistillationConfig:
    """
    Distillation-specific configuration.

    Attributes:
        teacher_model_uri: GCS path to teacher model
        temperature: Distillation temperature
        alpha: Weight of distillation loss vs. task loss
        student_model_size: Target student model size
    """
    teacher_model_uri: str
    temperature: float = 2.0
    alpha: float = 0.5
    student_model_size: str = "small"  # "small", "medium", "large"


@dataclass
class TuningJobConfig:
    """
    Complete configuration for a fine-tuning job.

    Attributes:
        name: Job identifier (short name)
        job_name: Full Vertex AI job name
        base_model: Base model to fine-tune (e.g., "gemini-2.0-flash")
        tuning_type: Type of fine-tuning
        dataset: Training dataset configuration
        hyperparameters: Hyperparameter configuration
        rlhf_config: RLHF configuration (if tuning_type=RLHF)
        distillation_config: Distillation configuration (if tuning_type=DISTILLATION)
        output_model_name: Name for fine-tuned model
        output_model_version: Version for fine-tuned model
        machine_type: GCP machine type for training
        accelerator_type: GPU/TPU type
        accelerator_count: Number of accelerators
        max_run_time_hours: Maximum training time
        enable_checkpointing: Save checkpoints during training
        checkpoint_frequency: Checkpoint frequency (steps)
        enable_early_stopping: Enable early stopping
        early_stopping_patience: Early stopping patience (epochs)
        tags: Metadata tags
    """
    name: str
    job_name: str
    base_model: str
    tuning_type: TuningType
    dataset: TrainingDataset
    hyperparameters: HyperparameterConfig = field(default_factory=HyperparameterConfig)
    rlhf_config: Optional[RLHFConfig] = None
    distillation_config: Optional[DistillationConfig] = None
    output_model_name: str = "tuned-model"
    output_model_version: str = "1.0.0"
    machine_type: str = "n1-highmem-8"
    accelerator_type: str = "NVIDIA_TESLA_T4"
    accelerator_count: int = 1
    max_run_time_hours: int = 24
    enable_checkpointing: bool = True
    checkpoint_frequency: int = 500
    enable_early_stopping: bool = True
    early_stopping_patience: int = 3
    tags: List[str] = field(default_factory=list)

    def validate(self):
        """Validate tuning job configuration."""
        self.dataset.validate()

        # Validate RLHF config
        if self.tuning_type == TuningType.RLHF and not self.rlhf_config:
            raise ValueError("RLHF tuning requires rlhf_config")

        # Validate distillation config
        if self.tuning_type == TuningType.DISTILLATION and not self.distillation_config:
            raise ValueError("Distillation requires distillation_config")

        # Validate machine config
        if self.accelerator_count < 1:
            raise ValueError("accelerator_count must be >= 1")

        if self.hyperparameters.batch_size < 1:
            raise ValueError("batch_size must be >= 1")

        if self.hyperparameters.learning_rate <= 0:
            raise ValueError("learning_rate must be > 0")


@dataclass
class TuningJobResult:
    """
    Result of a fine-tuning job.

    Attributes:
        job_id: Job identifier (short ID)
        job_name: Job name
        status: Final status
        tuned_model_uri: GCS path to tuned model
        metrics: Training metrics
        start_time: Training start time
        end_time: Training end time
        duration_seconds: Total training time
        vertex_ai_job_id: Vertex AI job ID (full resource name)
        error_message: Error message if failed
    """
    job_id: str
    job_name: str
    status: TuningJobStatus
    tuned_model_uri: Optional[str] = None
    metrics: Dict[str, float] = field(default_factory=dict)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: float = 0.0
    vertex_ai_job_id: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        data = asdict(self)
        data["status"] = self.status.value
        if self.start_time:
            data["start_time"] = self.start_time.isoformat()
        if self.end_time:
            data["end_time"] = self.end_time.isoformat()
        return data


class FineTuningPipeline:
    """
    Fine-Tuning Pipeline for Genesis models.

    Supports:
        1. Supervised fine-tuning (standard approach)
        2. RLHF (Reinforcement Learning from Human Feedback)
        3. Distillation (compress large models to small)
        4. Parameter-efficient fine-tuning (LoRA, QLoRA)

    Integration with Genesis:
        - SE-Darwin evolution trajectories → training data
        - HALO router decisions → routing fine-tuning
        - HTDAG task decompositions → planning fine-tuning
        - Benchmark validation results → quality metrics

    Usage:
        pipeline = FineTuningPipeline(project_id="my-project", location="us-central1")

        # Prepare training data from SE-Darwin
        dataset = await pipeline.prepare_se_darwin_dataset(
            archive_path="evolution_archives/routing_agent_v1",
            output_gcs_uri="gs://my-bucket/training-data/routing-v1.jsonl"
        )

        # Configure tuning job
        config = TuningJobConfig(
            job_name="routing-agent-tuning-v1",
            base_model="gemini-2.0-flash",
            tuning_type=TuningType.SUPERVISED,
            dataset=dataset,
            output_model_name="gemini-flash-routing-tuned",
            output_model_version="1.0.0"
        )

        # Submit tuning job
        result = await pipeline.submit_tuning_job(config)

        # Wait for completion and register model
        if result.status == TuningJobStatus.SUCCEEDED:
            model = await pipeline.register_tuned_model(result)
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        model_registry: Optional[ModelRegistry] = None
    ):
        """
        Initialize Fine-Tuning Pipeline.

        Args:
            project_id: GCP project ID
            location: Vertex AI region
            model_registry: ModelRegistry instance for model upload
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

        # Track active jobs
        self.active_jobs: Dict[str, TuningJobResult] = {}

        logger.info(
            f"FineTuningPipeline initialized: project={self.project_id}, "
            f"location={self.location}"
        )

    @traced_operation("fine_tuning.prepare_se_darwin_dataset", SpanType.INFRASTRUCTURE)
    async def prepare_se_darwin_dataset(
        self,
        archive_path: str,
        output_gcs_uri: str,
        max_trajectories: int = 1000,
        quality_threshold: float = 0.8,
        min_test_pass_rate: float = 0.7
    ) -> TrainingDataset:
        """
        Prepare training dataset from SE-Darwin evolution archives.

        Converts successful evolution trajectories into training examples.

        Args:
            archive_path: Path to SE-Darwin archive directory
            output_gcs_uri: GCS path for output JSONL file
            max_trajectories: Maximum number of trajectories to include
            quality_threshold: Minimum quality score (0-1)
            min_test_pass_rate: Minimum test pass rate to include trajectory (0-1)

        Returns:
            TrainingDataset configuration

        Format:
            Each line is JSON:
            {
                "prompt": "Task description",
                "completion": "High-quality agent code",
                "metadata": {"quality_score": 0.95, "benchmark": "agent_routing"}
            }
        """
        logger.info(
            f"Preparing SE-Darwin dataset from {archive_path} → {output_gcs_uri}"
        )

        # Load evolution trajectories
        archive_dir = Path(archive_path)
        if not archive_dir.exists():
            raise FileNotFoundError(f"Archive path not found: {archive_path}")

        training_examples = []

        # Read trajectory files
        for traj_file in archive_dir.glob("trajectory_*.json"):
            try:
                with open(traj_file, "r") as f:
                    trajectory = json.load(f)

                # Filter by quality
                quality = trajectory.get("quality_score", 0.0)
                if quality < quality_threshold:
                    continue

                # Extract prompt and completion
                prompt = trajectory.get("task_description", "")
                completion = trajectory.get("final_code", "")

                if not prompt or not completion:
                    continue

                training_examples.append({
                    "prompt": prompt,
                    "completion": completion,
                    "metadata": {
                        "quality_score": quality,
                        "benchmark": trajectory.get("benchmark", "unknown"),
                        "iteration": trajectory.get("iteration", 0)
                    }
                })

                if len(training_examples) >= max_trajectories:
                    break

            except Exception as e:
                logger.warning(f"Failed to process {traj_file}: {e}")
                continue

        if not training_examples:
            raise ValueError(f"No valid training examples found in {archive_path}")

        # Write to temporary file, then upload to GCS
        local_file = f"/tmp/training_data_{int(time.time())}.jsonl"
        with open(local_file, "w") as f:
            for example in training_examples:
                f.write(json.dumps(example) + "\n")

        # Upload to GCS (using gcloud SDK or google-cloud-storage)
        try:
            from google.cloud import storage
            storage_client = storage.Client(project=self.project_id)

            # Parse GCS URI
            bucket_name = output_gcs_uri.split("/")[2]
            blob_path = "/".join(output_gcs_uri.split("/")[3:])

            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            blob.upload_from_filename(local_file)

            logger.info(f"Uploaded training data to {output_gcs_uri}")

        except Exception as e:
            logger.error(f"Failed to upload to GCS: {e}")
            raise

        # Clean up local file
        os.remove(local_file)

        # Split into train/validation (80/20)
        num_train = int(len(training_examples) * 0.8)

        return TrainingDataset(
            train_uri=output_gcs_uri,
            num_train_samples=num_train,
            num_val_samples=len(training_examples) - num_train,
            format="jsonl"
        )

    @traced_operation("fine_tuning.prepare_halo_routing_dataset", SpanType.INFRASTRUCTURE)
    async def prepare_halo_routing_dataset(
        self,
        routing_decisions_path: str,
        output_gcs_uri: str,
        min_success_rate: float = 0.9
    ) -> TrainingDataset:
        """
        Prepare training dataset from HALO router decisions.

        Trains model to predict optimal agent routing.

        Args:
            routing_decisions_path: Path to HALO routing logs
            output_gcs_uri: GCS path for output JSONL file
            min_success_rate: Minimum agent success rate to include

        Returns:
            TrainingDataset configuration

        Format:
            {
                "prompt": "Task: Write Python function for sorting\nRequirements: Efficient, documented",
                "completion": "Builder Agent",
                "metadata": {"success_rate": 0.95, "avg_quality": 0.87}
            }
        """
        logger.info(
            f"Preparing HALO routing dataset from {routing_decisions_path} → {output_gcs_uri}"
        )

        # Load routing decisions
        decisions_file = Path(routing_decisions_path)
        if not decisions_file.exists():
            raise FileNotFoundError(f"Routing decisions file not found: {routing_decisions_path}")

        training_examples = []

        with open(decisions_file, "r") as f:
            for line in f:
                try:
                    decision = json.loads(line)

                    # Filter by success rate
                    success_rate = decision.get("success_rate", 0.0)
                    if success_rate < min_success_rate:
                        continue

                    # Extract task and selected agent
                    task_desc = decision.get("task_description", "")
                    selected_agent = decision.get("selected_agent", "")

                    if not task_desc or not selected_agent:
                        continue

                    training_examples.append({
                        "prompt": task_desc,
                        "completion": selected_agent,
                        "metadata": {
                            "success_rate": success_rate,
                            "avg_quality": decision.get("avg_quality_score", 0.0),
                            "routing_rule": decision.get("applied_rule", "learned")
                        }
                    })

                except Exception as e:
                    logger.warning(f"Failed to process routing decision: {e}")
                    continue

        if not training_examples:
            raise ValueError(f"No valid routing decisions found in {routing_decisions_path}")

        # Write and upload
        local_file = f"/tmp/routing_data_{int(time.time())}.jsonl"
        with open(local_file, "w") as f:
            for example in training_examples:
                f.write(json.dumps(example) + "\n")

        # Upload to GCS
        try:
            from google.cloud import storage
            storage_client = storage.Client(project=self.project_id)

            bucket_name = output_gcs_uri.split("/")[2]
            blob_path = "/".join(output_gcs_uri.split("/")[3:])

            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            blob.upload_from_filename(local_file)

            logger.info(f"Uploaded routing data to {output_gcs_uri}")

        except Exception as e:
            logger.error(f"Failed to upload to GCS: {e}")
            raise

        os.remove(local_file)

        # Split train/validation
        num_train = int(len(training_examples) * 0.8)

        return TrainingDataset(
            train_uri=output_gcs_uri,
            num_train_samples=num_train,
            num_val_samples=len(training_examples) - num_train,
            format="jsonl"
        )

    @traced_operation("fine_tuning.submit_tuning_job", SpanType.INFRASTRUCTURE)
    async def submit_tuning_job(
        self,
        config: TuningJobConfig,
        wait_for_completion: bool = False,
        progress_callback: Optional[Callable[[TuningJobStatus, float], None]] = None
    ) -> TuningJobResult:
        """
        Submit fine-tuning job to Vertex AI.

        Args:
            config: Tuning job configuration
            wait_for_completion: Block until training completes
            progress_callback: Callback for progress updates (status, progress%)

        Returns:
            TuningJobResult with job details

        Raises:
            ValueError: If configuration is invalid
            google_exceptions.GoogleAPICallError: If submission fails
        """
        start_time = time.time()

        # Validate config
        config.validate()

        logger.info(
            f"Submitting tuning job: {config.job_name} "
            f"(type={config.tuning_type.value}, base_model={config.base_model})"
        )

        # Create result object
        # Generate job_id from job_name (extract last component or use as-is)
        job_id = config.job_name.split('/')[-1] if '/' in config.job_name else config.job_name
        result = TuningJobResult(
            job_id=job_id,
            job_name=config.job_name,
            status=TuningJobStatus.PENDING,
            start_time=datetime.utcnow()
        )

        try:
            # Submit job based on tuning type
            if config.tuning_type == TuningType.SUPERVISED:
                vertex_job = await self._submit_supervised_job(config)
            elif config.tuning_type == TuningType.RLHF:
                vertex_job = await self._submit_rlhf_job(config)
            elif config.tuning_type == TuningType.DISTILLATION:
                vertex_job = await self._submit_distillation_job(config)
            elif config.tuning_type == TuningType.PARAMETER_EFFICIENT:
                vertex_job = await self._submit_peft_job(config)
            else:
                raise ValueError(f"Unsupported tuning type: {config.tuning_type}")

            # Update result with job ID
            result.vertex_ai_job_id = vertex_job.name
            result.status = TuningJobStatus.RUNNING

            # Track active job
            self.active_jobs[config.job_name] = result

            logger.info(
                f"Tuning job submitted: {vertex_job.name} "
                f"({time.time() - start_time:.2f}s)"
            )

            # Wait for completion if requested
            if wait_for_completion:
                result = await self._wait_for_job_completion(
                    config.job_name,
                    vertex_job,
                    progress_callback
                )

            return result

        except Exception as e:
            result.status = TuningJobStatus.FAILED
            result.error_message = str(e)
            result.end_time = datetime.utcnow()
            logger.error(f"Tuning job submission failed: {e}")
            raise

    async def _submit_supervised_job(
        self,
        config: TuningJobConfig
    ) -> Any:
        """Submit supervised fine-tuning job to Vertex AI."""
        # Build training script arguments
        training_args = {
            "base_model": config.base_model,
            "train_data": config.dataset.train_uri,
            "validation_data": config.dataset.validation_uri,
            "learning_rate": config.hyperparameters.learning_rate,
            "batch_size": config.hyperparameters.batch_size,
            "num_epochs": config.hyperparameters.num_epochs,
            "max_seq_length": config.hyperparameters.max_seq_length,
            "output_dir": f"gs://{self.project_id}-tuning-outputs/{config.job_name}",
            "checkpoint_frequency": config.checkpoint_frequency if config.enable_checkpointing else 0,
            "early_stopping": config.enable_early_stopping,
            "early_stopping_patience": config.early_stopping_patience
        }

        # Create CustomJob for supervised tuning
        # (This is a simplified example; actual implementation would use Vertex AI's tuning API)
        job = CustomJob.from_local_script(
            display_name=config.job_name,
            script_path="training_scripts/supervised_finetune.py",  # You'd provide this
            container_uri=f"gcr.io/{self.project_id}/training-container:latest",
            args=json.dumps(training_args),
            machine_type=config.machine_type,
            accelerator_type=config.accelerator_type,
            accelerator_count=config.accelerator_count
        )

        # Submit job
        job.run(sync=False)

        return job

    async def _submit_rlhf_job(
        self,
        config: TuningJobConfig
    ) -> Any:
        """Submit RLHF tuning job (PPO-based)."""
        if not config.rlhf_config:
            raise ValueError("RLHF config required for RLHF tuning")

        # Build RLHF training arguments
        training_args = {
            "base_model": config.base_model,
            "reward_model": config.rlhf_config.reward_model_uri,
            "reference_model": config.rlhf_config.reference_model_uri,
            "train_data": config.dataset.train_uri,
            "ppo_epochs": config.rlhf_config.ppo_epochs,
            "ppo_clip_range": config.rlhf_config.ppo_clip_range,
            "kl_penalty": config.rlhf_config.kl_penalty_coef,
            "output_dir": f"gs://{self.project_id}-tuning-outputs/{config.job_name}"
        }

        # Create CustomJob for RLHF
        job = CustomJob.from_local_script(
            display_name=config.job_name,
            script_path="training_scripts/rlhf_finetune.py",
            container_uri=f"gcr.io/{self.project_id}/rlhf-container:latest",
            args=json.dumps(training_args),
            machine_type=config.machine_type,
            accelerator_type=config.accelerator_type,
            accelerator_count=config.accelerator_count
        )

        job.run(sync=False)

        return job

    async def _submit_distillation_job(
        self,
        config: TuningJobConfig
    ) -> Any:
        """Submit distillation job (compress large model to small)."""
        if not config.distillation_config:
            raise ValueError("Distillation config required for distillation")

        training_args = {
            "teacher_model": config.distillation_config.teacher_model_uri,
            "student_model": config.base_model,
            "train_data": config.dataset.train_uri,
            "temperature": config.distillation_config.temperature,
            "alpha": config.distillation_config.alpha,
            "output_dir": f"gs://{self.project_id}-tuning-outputs/{config.job_name}"
        }

        job = CustomJob.from_local_script(
            display_name=config.job_name,
            script_path="training_scripts/distillation.py",
            container_uri=f"gcr.io/{self.project_id}/distillation-container:latest",
            args=json.dumps(training_args),
            machine_type=config.machine_type,
            accelerator_type=config.accelerator_type,
            accelerator_count=config.accelerator_count
        )

        job.run(sync=False)

        return job

    async def _submit_peft_job(
        self,
        config: TuningJobConfig
    ) -> Any:
        """Submit parameter-efficient fine-tuning job (LoRA)."""
        training_args = {
            "base_model": config.base_model,
            "train_data": config.dataset.train_uri,
            "lora_r": config.hyperparameters.lora_r,
            "lora_alpha": config.hyperparameters.lora_alpha,
            "lora_dropout": config.hyperparameters.lora_dropout,
            "learning_rate": config.hyperparameters.learning_rate,
            "batch_size": config.hyperparameters.batch_size,
            "num_epochs": config.hyperparameters.num_epochs,
            "output_dir": f"gs://{self.project_id}-tuning-outputs/{config.job_name}"
        }

        job = CustomJob.from_local_script(
            display_name=config.job_name,
            script_path="training_scripts/peft_finetune.py",
            container_uri=f"gcr.io/{self.project_id}/peft-container:latest",
            args=json.dumps(training_args),
            machine_type=config.machine_type,
            accelerator_type=config.accelerator_type,
            accelerator_count=config.accelerator_count
        )

        job.run(sync=False)

        return job

    async def _wait_for_job_completion(
        self,
        job_name: str,
        vertex_job: Any,
        progress_callback: Optional[Callable[[TuningJobStatus, float], None]]
    ) -> TuningJobResult:
        """Wait for tuning job to complete."""
        result = self.active_jobs[job_name]

        logger.info(f"Waiting for tuning job to complete: {job_name}")

        # Poll job status
        while True:
            await asyncio.sleep(30)  # Check every 30 seconds

            # Get job state
            vertex_job.refresh()
            state = vertex_job.state

            # Update status
            if state == "JOB_STATE_SUCCEEDED":
                result.status = TuningJobStatus.SUCCEEDED
                result.end_time = datetime.utcnow()
                result.duration_seconds = (result.end_time - result.start_time).total_seconds()
                result.tuned_model_uri = vertex_job.output_uri
                break
            elif state == "JOB_STATE_FAILED":
                result.status = TuningJobStatus.FAILED
                result.end_time = datetime.utcnow()
                result.error_message = vertex_job.error_message
                break
            elif state == "JOB_STATE_CANCELLED":
                result.status = TuningJobStatus.CANCELLED
                result.end_time = datetime.utcnow()
                break

            # Call progress callback
            if progress_callback:
                progress = 0.5  # Simplified progress tracking
                progress_callback(TuningJobStatus.RUNNING, progress)

        logger.info(
            f"Tuning job completed: {job_name} (status={result.status.value}, "
            f"duration={result.duration_seconds:.0f}s)"
        )

        return result

    @traced_operation("fine_tuning.register_tuned_model", SpanType.INFRASTRUCTURE)
    async def register_tuned_model(
        self,
        result: TuningJobResult,
        config: TuningJobConfig
    ) -> ModelMetadata:
        """
        Register tuned model in Model Registry.

        Args:
            result: Tuning job result
            config: Original tuning job config

        Returns:
            ModelMetadata for registered model

        Raises:
            ValueError: If job failed or model URI missing
        """
        if result.status != TuningJobStatus.SUCCEEDED:
            raise ValueError(f"Cannot register failed job: {result.status.value}")

        if not result.tuned_model_uri:
            raise ValueError("Tuned model URI missing from result")

        # Build model metadata
        metadata = ModelMetadata(
            name=config.output_model_name,
            display_name=f"{config.output_model_name}-v{config.output_model_version}",
            version=config.output_model_version,
            description=f"Fine-tuned {config.base_model} using {config.tuning_type.value}",
            source=ModelSource.SE_DARWIN_EVOLUTION if "darwin" in config.job_name else ModelSource.CUSTOM_TRAINING,
            base_model=config.base_model,
            artifact_uri=result.tuned_model_uri,
            serving_container_uri=f"us-docker.pkg.dev/vertex-ai/prediction/pytorch-cpu:latest",  # Default
            deployment_stage=DeploymentStage.DEVELOPMENT,
            performance_metrics=result.metrics,
            tags=config.tags + [config.tuning_type.value, "fine-tuned"]
        )

        # Upload to Model Registry
        model = await self.model_registry.upload_model(metadata)

        logger.info(
            f"Registered tuned model: {metadata.name} v{metadata.version} "
            f"({model.resource_name})"
        )

        return metadata


# Factory function
def get_fine_tuning_pipeline(
    project_id: Optional[str] = None,
    location: str = "us-central1"
) -> FineTuningPipeline:
    """
    Get FineTuningPipeline instance with default configuration.

    Args:
        project_id: GCP project ID
        location: Vertex AI region

    Returns:
        Configured FineTuningPipeline instance
    """
    return FineTuningPipeline(project_id=project_id, location=location)
