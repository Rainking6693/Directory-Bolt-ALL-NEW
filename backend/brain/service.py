"""CrewAI brain service - FastAPI adapter."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os

app = FastAPI(title="DirectoryBolt Brain Service")


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


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "brain"}


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
