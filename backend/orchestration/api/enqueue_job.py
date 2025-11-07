"""Helpers for enqueuing jobs onto the external processing queue."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError


class QueueConfigurationError(RuntimeError):
    """Raised when queue configuration is invalid or missing."""


class QueueSendError(RuntimeError):
    """Raised when a message fails to send to the queue."""


@lru_cache(maxsize=1)
def _get_queue_provider() -> str:
    provider = os.getenv("QUEUE_PROVIDER", "sqs").lower()
    if provider not in {"sqs"}:
        raise QueueConfigurationError(
            f"Unsupported queue provider '{provider}'. Only 'sqs' is currently supported."
        )
    return provider


@lru_cache(maxsize=1)
def _get_sqs_client():
    """Return a cached SQS client based on environment variables."""

    access_key = os.getenv("AWS_DEFAULT_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_DEFAULT_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    region = os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION", "us-east-1")

    if not access_key or not secret_key:
        raise QueueConfigurationError(
            "AWS credentials are not configured. Set AWS_DEFAULT_ACCESS_KEY_ID and "
            "AWS_DEFAULT_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)."
        )

    try:
        return boto3.client(
            "sqs",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
    except (BotoCoreError, ClientError) as exc:  # pragma: no cover - boto3 internals
        raise QueueConfigurationError(f"Failed to initialise SQS client: {exc}") from exc


def _build_message_body(
    *,
    job_id: str,
    customer_id: str,
    package_size: int,
    priority: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "job_id": job_id,
        "customer_id": customer_id,
        "package_size": package_size,
        "priority": priority,
        "created_at": metadata.get("created_at") if metadata else None,
        "source": metadata.get("source", "render_backend") if metadata else "render_backend",
        "metadata": metadata or {},
    }


def enqueue_job(
    *,
    job_id: str,
    customer_id: str,
    package_size: int,
    priority: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send a job to the configured queue.

    Returns a dictionary containing the message id and queue url used.
    """

    if not job_id:
        raise ValueError("job_id is required")
    if not customer_id:
        raise ValueError("customer_id is required")

    provider = _get_queue_provider()

    if provider == "sqs":
        queue_url = os.getenv("SQS_QUEUE_URL")
        if not queue_url:
            raise QueueConfigurationError("SQS_QUEUE_URL is not configured")

        message = _build_message_body(
            job_id=job_id,
            customer_id=customer_id,
            package_size=package_size,
            priority=priority,
            metadata=metadata,
        )

        try:
            response = _get_sqs_client().send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(message, default=str),
                MessageAttributes={
                    "job_id": {"DataType": "String", "StringValue": job_id},
                    "customer_id": {"DataType": "String", "StringValue": customer_id},
                    "priority": {"DataType": "Number", "StringValue": str(priority)},
                },
            )
        except (BotoCoreError, ClientError) as exc:
            raise QueueSendError(f"Failed to send message to SQS: {exc}") from exc

        message_id = response.get("MessageId")
        if not message_id:
            raise QueueSendError("SQS did not return a MessageId")

        return {"queue_provider": provider, "queue_url": queue_url, "message_id": message_id}

    raise QueueConfigurationError(f"Queue provider '{provider}' is not supported")


