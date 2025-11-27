"""
Resource Manager for Genesis Fine-Tuning Jobs

Manages GPU allocation, job scheduling, and queueing for fine-tuning operations.

Features:
- Job scheduling with priority queues
- GPU availability tracking
- Concurrent job management
- Job status monitoring
- Cost tracking and limits
"""

import os
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import json

# Genesis infrastructure
from infrastructure import get_logger

# OTEL observability
try:
    from opentelemetry import trace
    from opentelemetry.trace import Status, StatusCode
    tracer = trace.get_tracer(__name__)
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    tracer = None

logger = get_logger(__name__)


class JobStatus(Enum):
    """Job status states"""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobPriority(Enum):
    """Job priority levels"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class FinetuneJob:
    """Fine-tuning job specification"""
    job_id: str
    agent_name: str
    dataset_path: str
    model_name: str
    priority: JobPriority
    status: JobStatus = JobStatus.PENDING
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_path: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict"""
        data = asdict(self)
        data["priority"] = self.priority.value
        data["status"] = self.status.value
        data["created_at"] = self.created_at.isoformat()
        data["started_at"] = self.started_at.isoformat() if self.started_at else None
        data["completed_at"] = self.completed_at.isoformat() if self.completed_at else None
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FinetuneJob":
        """Reconstruct from dict"""
        data["priority"] = JobPriority(data["priority"])
        data["status"] = JobStatus(data["status"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        if data.get("started_at"):
            data["started_at"] = datetime.fromisoformat(data["started_at"])
        if data.get("completed_at"):
            data["completed_at"] = datetime.fromisoformat(data["completed_at"])
        return cls(**data)


@dataclass
class GPUResource:
    """GPU resource tracking"""
    gpu_id: int
    name: str
    memory_total_mb: float
    memory_available_mb: float
    utilization_percent: float
    is_available: bool = True
    current_job_id: Optional[str] = None


class ResourceManager:
    """
    Manage fine-tuning jobs and GPU resources.

    Responsibilities:
    - Queue and schedule fine-tuning jobs
    - Track GPU availability
    - Execute jobs with resource allocation
    - Monitor job status and failures
    - Enforce cost limits
    """

    def __init__(
        self,
        max_concurrent_jobs: int = 2,
        job_queue_size: int = 100,
        enable_otel: bool = True,
        state_dir: str = os.path.join(os.path.dirname(__file__), "../data/resource_manager")
    ):
        """
        Initialize resource manager.

        Args:
            max_concurrent_jobs: Maximum concurrent fine-tuning jobs
            job_queue_size: Maximum queue size
            enable_otel: Enable OpenTelemetry tracing
            state_dir: Directory for persistent state
        """
        self.max_concurrent_jobs = max_concurrent_jobs
        self.job_queue_size = job_queue_size
        self.enable_otel = enable_otel and HAS_OTEL
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)

        # Job storage
        self.jobs: Dict[str, FinetuneJob] = {}  # job_id -> FinetuneJob
        self.job_queue: List[str] = []  # job_ids in priority order
        self.running_jobs: Dict[str, asyncio.Task] = {}  # job_id -> task

        # GPU tracking
        self.gpus: Dict[int, GPUResource] = {}
        self._initialize_gpus()

        # Cost tracking
        self.total_cost_usd = 0.0
        self.max_cost_limit_usd = 1000.0  # Default limit

        logger.info(
            f"ResourceManager initialized: max_concurrent={max_concurrent_jobs}, "
            f"queue_size={job_queue_size}"
        )

    def _initialize_gpus(self):
        """Initialize GPU tracking"""
        try:
            import torch
            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    props = torch.cuda.get_device_properties(i)
                    total_memory = props.total_memory / 1024**2  # MB

                    self.gpus[i] = GPUResource(
                        gpu_id=i,
                        name=props.name,
                        memory_total_mb=total_memory,
                        memory_available_mb=total_memory,
                        utilization_percent=0.0,
                        is_available=True
                    )

                    logger.info(
                        f"GPU {i}: {props.name}, {total_memory:.0f}MB"
                    )
            else:
                logger.warning("No CUDA GPUs available")

        except ImportError:
            logger.warning("PyTorch not available, GPU tracking disabled")

    def _get_available_gpu(self) -> Optional[int]:
        """Get next available GPU ID"""
        for gpu_id, gpu in self.gpus.items():
            if gpu.is_available:
                return gpu_id
        return None

    def schedule_finetune_job(
        self,
        agent_name: str,
        dataset_path: str,
        model_name: str = "gemini-2-flash-9b",
        priority: JobPriority = JobPriority.NORMAL,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Schedule a new fine-tuning job.

        Args:
            agent_name: Agent name
            dataset_path: Path to training dataset
            model_name: Model to fine-tune
            priority: Job priority
            metadata: Optional job metadata

        Returns:
            Job ID

        Raises:
            ValueError: If queue is full
        """
        if len(self.job_queue) >= self.job_queue_size:
            raise ValueError(f"Job queue full (max: {self.job_queue_size})")

        # Generate job ID
        job_id = f"ft_{agent_name}_{uuid.uuid4().hex[:8]}"

        # Create job
        job = FinetuneJob(
            job_id=job_id,
            agent_name=agent_name,
            dataset_path=dataset_path,
            model_name=model_name,
            priority=priority,
            status=JobStatus.QUEUED,
            metadata=metadata or {}
        )

        # Add to storage
        self.jobs[job_id] = job

        # Add to priority queue
        self._add_to_queue(job_id, priority)

        # Persist state
        self._save_state()

        logger.info(
            f"Job scheduled: {job_id} (agent={agent_name}, "
            f"priority={priority.name}, queue_pos={self.job_queue.index(job_id)+1})"
        )

        # Note: Caller should manually trigger queue processing via process_queue()
        # Cannot call asyncio.create_task from sync context

        return job_id

    def start_processing(self):
        """
        Start async queue processing.
        Must be called from async context or with asyncio.run().
        """
        try:
            # Try to get current event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is running, create task
                asyncio.create_task(self._process_queue())
            else:
                # If no loop, user needs to call process_queue() manually
                logger.warning("No running event loop. Call process_queue() in async context.")
        except RuntimeError:
            # No event loop in current thread
            logger.warning("No event loop. Call process_queue() in async context.")

    def _add_to_queue(self, job_id: str, priority: JobPriority):
        """Add job to priority queue"""
        # Insert based on priority (higher priority first)
        inserted = False
        for i, existing_job_id in enumerate(self.job_queue):
            existing_job = self.jobs[existing_job_id]
            if priority.value > existing_job.priority.value:
                self.job_queue.insert(i, job_id)
                inserted = True
                break

        if not inserted:
            self.job_queue.append(job_id)

    async def _process_queue(self):
        """Process job queue and start jobs when resources available"""
        while self.job_queue and len(self.running_jobs) < self.max_concurrent_jobs:
            # Get next job
            job_id = self.job_queue[0]
            job = self.jobs[job_id]

            # Check if GPU available
            gpu_id = self._get_available_gpu()
            if gpu_id is None:
                logger.info("No GPUs available, waiting")
                break

            # Check cost limit
            if self.total_cost_usd >= self.max_cost_limit_usd:
                logger.warning(
                    f"Cost limit reached: ${self.total_cost_usd:.2f} / ${self.max_cost_limit_usd:.2f}"
                )
                break

            # Start job
            self.job_queue.pop(0)
            task = asyncio.create_task(self._run_job(job_id, gpu_id))
            self.running_jobs[job_id] = task

            logger.info(
                f"Job started: {job_id} on GPU {gpu_id} "
                f"({len(self.running_jobs)}/{self.max_concurrent_jobs} running)"
            )

    async def _run_job(self, job_id: str, gpu_id: int):
        """Execute fine-tuning job"""
        job = self.jobs[job_id]

        if self.enable_otel and tracer:
            span = tracer.start_span("resource_manager.run_job")
            span.set_attribute("job_id", job_id)
            span.set_attribute("agent_name", job.agent_name)
            span.set_attribute("gpu_id", gpu_id)
        else:
            span = None

        try:
            # Mark GPU as in use
            gpu = self.gpus[gpu_id]
            gpu.is_available = False
            gpu.current_job_id = job_id

            # Update job status
            job.status = JobStatus.RUNNING
            job.started_at = datetime.now(timezone.utc)
            self._save_state()

            logger.info(f"Running job {job_id} on GPU {gpu_id}")

            # Import here to avoid circular dependencies
            from infrastructure.finetune.unsloth_pipeline import get_unsloth_pipeline
            from infrastructure.finetune.casebank_to_dataset import CaseBankDatasetConverter
            from datasets import load_from_disk

            # Load pipeline
            pipeline = get_unsloth_pipeline()

            # Load dataset
            logger.info(f"Loading dataset: {job.dataset_path}")
            dataset = load_from_disk(job.dataset_path)

            # Load model
            logger.info(f"Loading model: {job.model_name}")
            model, tokenizer = pipeline.load_model_4bit(job.model_name)

            # Prepare QLoRA
            qlora_config = pipeline.prepare_qlora_config()
            model = pipeline.prepare_model_for_training(model, qlora_config)

            # Train
            logger.info(f"Training started: {job_id}")
            result = pipeline.train(
                model=model,
                tokenizer=tokenizer,
                dataset=dataset,
                qlora_config=qlora_config,
                agent_name=job.agent_name
            )

            # Update job with results
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            job.result_path = result.model_path
            job.metadata.update({
                "training_loss": result.training_loss,
                "training_time_seconds": result.training_time_seconds,
                "peak_memory_mb": result.peak_memory_mb
            })

            # Estimate cost (rough estimate: $0.50/hour for GPU)
            cost_usd = (result.training_time_seconds / 3600) * 0.50
            self.total_cost_usd += cost_usd
            job.metadata["estimated_cost_usd"] = cost_usd

            logger.info(
                f"Job completed: {job_id}, loss={result.training_loss:.4f}, "
                f"time={result.training_time_seconds:.2f}s, cost=${cost_usd:.2f}"
            )

            if span:
                span.set_attribute("training_loss", result.training_loss)
                span.set_attribute("cost_usd", cost_usd)
                span.set_status(Status(StatusCode.OK))

        except Exception as e:
            # Job failed
            job.status = JobStatus.FAILED
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = str(e)

            logger.error(f"Job failed: {job_id}, error={e}", exc_info=True)

            if span:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)

        finally:
            # Release GPU
            gpu.is_available = True
            gpu.current_job_id = None

            # Remove from running jobs
            if job_id in self.running_jobs:
                del self.running_jobs[job_id]

            # Save state
            self._save_state()

            # Process next job
            asyncio.create_task(self._process_queue())

            if span:
                span.end()

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get job status.

        Args:
            job_id: Job ID

        Returns:
            Job status dict

        Raises:
            KeyError: If job not found
        """
        if job_id not in self.jobs:
            raise KeyError(f"Job not found: {job_id}")

        job = self.jobs[job_id]
        status = job.to_dict()

        # Add queue position if queued
        if job.status == JobStatus.QUEUED and job_id in self.job_queue:
            status["queue_position"] = self.job_queue.index(job_id) + 1

        return status

    def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a job.

        Args:
            job_id: Job ID

        Returns:
            True if cancelled, False otherwise
        """
        if job_id not in self.jobs:
            return False

        job = self.jobs[job_id]

        if job.status == JobStatus.RUNNING:
            # Cancel running task
            if job_id in self.running_jobs:
                self.running_jobs[job_id].cancel()
                del self.running_jobs[job_id]

            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.now(timezone.utc)

            logger.info(f"Job cancelled: {job_id}")
            return True

        elif job.status == JobStatus.QUEUED:
            # Remove from queue
            if job_id in self.job_queue:
                self.job_queue.remove(job_id)

            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.now(timezone.utc)

            logger.info(f"Job cancelled: {job_id}")
            return True

        return False

    def list_jobs(
        self,
        agent_name: Optional[str] = None,
        status: Optional[JobStatus] = None
    ) -> List[Dict[str, Any]]:
        """
        List jobs with optional filters.

        Args:
            agent_name: Filter by agent name
            status: Filter by status

        Returns:
            List of job status dicts
        """
        jobs = []
        for job in self.jobs.values():
            if agent_name and job.agent_name != agent_name:
                continue
            if status and job.status != status:
                continue

            jobs.append(job.to_dict())

        # Sort by created_at (newest first)
        jobs.sort(key=lambda x: x["created_at"], reverse=True)

        return jobs

    def get_resource_stats(self) -> Dict[str, Any]:
        """Get resource utilization statistics"""
        return {
            "total_jobs": len(self.jobs),
            "running_jobs": len(self.running_jobs),
            "queued_jobs": len(self.job_queue),
            "completed_jobs": len([j for j in self.jobs.values() if j.status == JobStatus.COMPLETED]),
            "failed_jobs": len([j for j in self.jobs.values() if j.status == JobStatus.FAILED]),
            "total_cost_usd": self.total_cost_usd,
            "cost_limit_usd": self.max_cost_limit_usd,
            "gpus_available": len([g for g in self.gpus.values() if g.is_available]),
            "gpus_total": len(self.gpus)
        }

    def _save_state(self):
        """Save state to disk"""
        try:
            state_file = self.state_dir / "state.json"
            state = {
                "jobs": {jid: job.to_dict() for jid, job in self.jobs.items()},
                "job_queue": self.job_queue,
                "total_cost_usd": self.total_cost_usd
            }

            with open(state_file, "w") as f:
                json.dump(state, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    def _load_state(self):
        """Load state from disk"""
        try:
            state_file = self.state_dir / "state.json"
            if not state_file.exists():
                return

            with open(state_file, "r") as f:
                state = json.load(f)

            # Restore jobs
            for jid, job_data in state.get("jobs", {}).items():
                self.jobs[jid] = FinetuneJob.from_dict(job_data)

            # Restore queue
            self.job_queue = state.get("job_queue", [])

            # Restore cost
            self.total_cost_usd = state.get("total_cost_usd", 0.0)

            logger.info(f"State restored: {len(self.jobs)} jobs")

        except Exception as e:
            logger.error(f"Failed to load state: {e}")


# Factory function
def get_resource_manager(**kwargs) -> ResourceManager:
    """
    Factory function to create ResourceManager.

    Args:
        **kwargs: ResourceManager parameters

    Returns:
        ResourceManager instance
    """
    return ResourceManager(**kwargs)


if __name__ == "__main__":
    import asyncio

    async def main():
        logger.info("Resource Manager - Example Usage")

        # Initialize
        rm = get_resource_manager(max_concurrent_jobs=2)

        # Schedule jobs
        job1 = rm.schedule_finetune_job(
            agent_name="legal_agent",
            dataset_path="/path/to/dataset",
            priority=JobPriority.HIGH
        )

        job2 = rm.schedule_finetune_job(
            agent_name="security_agent",
            dataset_path="/path/to/dataset",
            priority=JobPriority.NORMAL
        )

        print("\n" + "="*60)
        print("JOBS SCHEDULED")
        print("="*60)
        print(f"Job 1: {job1}")
        print(f"Job 2: {job2}")

        # Get stats
        stats = rm.get_resource_stats()
        print("\n" + "="*60)
        print("RESOURCE STATS")
        print("="*60)
        for key, value in stats.items():
            print(f"{key}: {value}")

    asyncio.run(main())
