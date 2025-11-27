"""
Health Check Endpoint for Fine-Tuned Models

Provides health check endpoint to verify all 5 fine-tuned models are accessible.
"""

import logging
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# Try to import ModelRegistry
try:
    from infrastructure.model_registry import ModelRegistry
    MODEL_REGISTRY_AVAILABLE = True
except ImportError:
    MODEL_REGISTRY_AVAILABLE = False
    logger.warning("ModelRegistry not available for health checks")


class HealthCheckService:
    """Service for checking health of fine-tuned models"""
    
    def __init__(self, model_registry: Optional[ModelRegistry] = None):
        """
        Initialize health check service
        
        Args:
            model_registry: Optional ModelRegistry instance (defaults to creating new one)
        """
        if not MODEL_REGISTRY_AVAILABLE:
            raise ImportError("ModelRegistry not available. Install dependencies.")
        
        self.model_registry = model_registry
        if not self.model_registry:
            try:
                self.model_registry = ModelRegistry()
            except Exception as e:
                logger.error(f"Failed to initialize ModelRegistry: {e}")
                self.model_registry = None
        
        self.agents = ["qa_agent", "support_agent", "legal_agent", "analyst_agent", "content_agent"]
    
    def check_agent_health(self, agent_name: str, timeout_seconds: float = 5.0) -> Dict[str, any]:
        """
        Check health of a specific agent's fine-tuned model
        
        Args:
            agent_name: Name of the agent
            timeout_seconds: Maximum time to wait for response
        
        Returns:
            Dictionary with health status
        """
        if not self.model_registry:
            return {
                "agent": agent_name,
                "status": "ERROR",
                "message": "ModelRegistry not initialized",
                "latency_ms": 0.0
            }
        
        start_time = time.time()
        try:
            # Send test message
            test_messages = [
                {"role": "user", "content": "health check"}
            ]
            
            response = self.model_registry.chat(
                agent_name=agent_name,
                messages=test_messages,
                use_finetuned=True,
                use_fallback=False  # Don't fallback for health check
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            if latency_ms > timeout_seconds * 1000:
                return {
                    "agent": agent_name,
                    "status": "SLOW",
                    "message": f"Response time exceeded {timeout_seconds}s",
                    "latency_ms": latency_ms,
                    "response_length": len(response) if response else 0
                }
            
            return {
                "agent": agent_name,
                "status": "OK",
                "message": "Model accessible and responding",
                "latency_ms": latency_ms,
                "response_length": len(response) if response else 0
            }
        
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return {
                "agent": agent_name,
                "status": "ERROR",
                "message": str(e),
                "latency_ms": latency_ms
            }
    
    def check_all_agents(self, timeout_seconds: float = 5.0) -> Dict[str, any]:
        """
        Check health of all agents
        
        Args:
            timeout_seconds: Maximum time to wait for each response
        
        Returns:
            Dictionary with overall status and per-agent results
        """
        results = {}
        all_ok = True
        
        for agent_name in self.agents:
            result = self.check_agent_health(agent_name, timeout_seconds)
            results[agent_name] = result
            
            if result["status"] != "OK":
                all_ok = False
        
        return {
            "status": "healthy" if all_ok else "degraded",
            "agents": results,
            "timestamp": time.time()
        }


# FastAPI app for health check endpoint
app = FastAPI(title="Genesis Model Health Check")

# Global health check service (will be initialized on startup)
health_service: Optional[HealthCheckService] = None


@app.on_event("startup")
async def startup_event():
    """Initialize health check service on startup"""
    global health_service
    try:
        health_service = HealthCheckService()
        logger.info("Health check service initialized")
    except Exception as e:
        logger.error(f"Failed to initialize health check service: {e}")
        health_service = None


@app.get("/health")
async def health_check():
    """
    Health check endpoint for all fine-tuned models
    
    Returns:
        JSON response with health status of all agents
    """
    if not health_service:
        raise HTTPException(
            status_code=503,
            detail="Health check service not available"
        )
    
    result = health_service.check_all_agents()
    
    status_code = 200 if result["status"] == "healthy" else 503
    
    return JSONResponse(
        content=result,
        status_code=status_code
    )


@app.get("/health/{agent_name}")
async def health_check_agent(agent_name: str):
    """
    Health check endpoint for a specific agent
    
    Args:
        agent_name: Name of the agent to check
    
    Returns:
        JSON response with health status of the agent
    """
    if not health_service:
        raise HTTPException(
            status_code=503,
            detail="Health check service not available"
        )
    
    if agent_name not in health_service.agents:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown agent: {agent_name}"
        )
    
    result = health_service.check_agent_health(agent_name)
    
    status_code = 200 if result["status"] == "OK" else 503
    
    return JSONResponse(
        content=result,
        status_code=status_code
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

