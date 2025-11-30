"""CrewAI brain service - FastAPI adapter."""
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from orchestration.api.enqueue_job import (
    QueueConfigurationError,
    QueueSendError,
    enqueue_job as enqueue_job_to_queue,
)

import os

app = FastAPI(title="DirectoryBolt Brain Service")

# Configure CORS to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://directorybolt.com",
        "https://www.directorybolt.com",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BusinessProfile(BaseModel):
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip: Optional[str] = ""
    website: Optional[str] = ""
    email: Optional[str] = ""
    description: Optional[str] = ""
    categories: List[str] = []


class PlanRequest(BaseModel):
    directory: str
    business: BusinessProfile
    hints: Dict[str, Any] = {}


class PlanStep(BaseModel):
    action: str
    url: Optional[str] = None
    selector: Optional[str] = None
    value: Optional[str] = None
    until: Optional[str] = None
    seconds: Optional[float] = None


class PlanResponse(BaseModel):
    plan: List[PlanStep]
    constraints: Dict[str, Any]
    idempotency_factors: Dict[str, str]


class EnqueueJobRequest(BaseModel):
    job_id: str
    customer_id: str
    package_size: int
    priority: int
    metadata: Optional[Dict[str, Any]] = None


class EnqueueJobResponse(BaseModel):
    job_id: str
    message_id: str
    queue_provider: str
    queue_url: str
    status: str = "queued"


def _allowed_tokens() -> List[str]:
    tokens = [
        os.getenv("BACKEND_ENQUEUE_TOKEN"),
        os.getenv("STAFF_API_KEY"),
        os.getenv("ADMIN_API_KEY"),
    ]

    if os.getenv("TEST_MODE") == "true":
        tokens.extend(
            [
                "DirectoryBolt-Staff-2025-SecureKey",
                "718e8866b81ecc6527dfc1b640e103e6741d844f4438286210d652ca02ee4622",
            ]
        )

    return [token for token in tokens if token]


def _normalize_token(candidate: Optional[str]) -> Optional[str]:
    if not candidate:
        return None
    value = candidate.strip()
    if not value:
        return None
    if value.lower().startswith("bearer "):
        return value.split(" ", 1)[1].strip()
    return value


def _is_authorized(
    authorization: Optional[str],
    staff_key: Optional[str],
    admin_key: Optional[str],
) -> bool:
    allowed = set(_allowed_tokens())
    if not allowed:
        return False

    provided = {
        _normalize_token(authorization),
        _normalize_token(staff_key),
        _normalize_token(admin_key),
    }

    provided.discard(None)

    return any(token in allowed for token in provided)


@app.get("/health")
async def health_check():
    """
    Health check endpoint with comprehensive dependency checks.

    Returns:
        - status: Overall health status (healthy/degraded/unhealthy)
        - service: Service name
        - version: Service version
        - timestamp: Current UTC timestamp
        - checks: Individual dependency health checks
    """
    from datetime import datetime
    import boto3
    from botocore.exceptions import ClientError

    checks = {}
    overall_status = "healthy"

    # Check SQS connectivity
    try:
        queue_url = os.getenv("SQS_QUEUE_URL")
        if queue_url:
            region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
            access_key = os.getenv("AWS_DEFAULT_ACCESS_KEY_ID")
            secret_key = os.getenv("AWS_DEFAULT_SECRET_ACCESS_KEY")

            if access_key and secret_key:
                sqs = boto3.client(
                    "sqs",
                    region_name=region,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key
                )
                # Test queue access
                sqs.get_queue_attributes(
                    QueueUrl=queue_url,
                    AttributeNames=["ApproximateNumberOfMessages"]
                )
                checks["sqs"] = "connected"
            else:
                checks["sqs"] = "credentials_missing"
                overall_status = "degraded"
        else:
            checks["sqs"] = "not_configured"
            overall_status = "degraded"
    except ClientError as e:
        checks["sqs"] = f"error: {str(e)}"
        overall_status = "unhealthy"
    except Exception as e:
        checks["sqs"] = f"error: {str(e)}"
        overall_status = "degraded"

    # Check environment variables
    required_env_vars = ["SQS_QUEUE_URL", "AWS_DEFAULT_REGION"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]

    if missing_vars:
        checks["environment"] = f"missing: {', '.join(missing_vars)}"
        overall_status = "degraded"
    else:
        checks["environment"] = "configured"

    # Check API authentication
    if os.getenv("BACKEND_ENQUEUE_TOKEN") or os.getenv("STAFF_API_KEY"):
        checks["authentication"] = "configured"
    else:
        checks["authentication"] = "not_configured"
        overall_status = "degraded"

    return {
        "status": overall_status,
        "service": "brain",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }


@app.post("/api/jobs/enqueue", response_model=EnqueueJobResponse)
def enqueue_job(
    request: EnqueueJobRequest,
    authorization: Optional[str] = Header(default=None),
    x_staff_key: Optional[str] = Header(default=None),
    x_admin_key: Optional[str] = Header(default=None),
):
    """Enqueue a job for processing via SQS."""

    if not _is_authorized(authorization, x_staff_key, x_admin_key):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        result = enqueue_job_to_queue(
            job_id=request.job_id,
            customer_id=request.customer_id,
            package_size=request.package_size,
            priority=request.priority,
            metadata=request.metadata,
        )
    except QueueConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except QueueSendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return EnqueueJobResponse(
        job_id=request.job_id,
        message_id=result["message_id"],
        queue_provider=result["queue_provider"],
        queue_url=result["queue_url"],
    )


@app.post("/plan", response_model=PlanResponse)
def generate_plan(request: PlanRequest):
    """
    Generate submission plan for a directory.
    
    TODO: Integrate actual CrewAI agents here.
    For now, returns a simple fallback plan.
    """
    directory = request.directory
    business = request.business
    
    # Simple fallback plan (replace with CrewAI logic)
    plan = [
        PlanStep(action="goto", url=f"https://{directory}/submit"),
        PlanStep(action="fill", selector="input[name='name']", value=business.name),
        PlanStep(action="fill", selector="input[name='email']", value=business.email),
        PlanStep(action="fill", selector="input[name='phone']", value=business.phone),
        PlanStep(action="fill", selector="input[name='website']", value=business.website),
        PlanStep(action="fill", selector="textarea[name='description']", value=business.description),
        PlanStep(action="click", selector="button[type='submit']"),
        PlanStep(action="wait", until="networkidle")
    ]
    
    return PlanResponse(
        plan=plan,
        constraints={
            "rateLimitMs": 1500,
            "captcha": "possible"
        },
        idempotency_factors={
            "name": business.name,
            "dir": directory
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
