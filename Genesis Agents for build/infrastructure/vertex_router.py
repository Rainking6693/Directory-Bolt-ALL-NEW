"""
Vertex AI Request Router
========================

Routes agent inference requests to tuned Vertex AI endpoints with automatic
fallback to the base Gemini model when tuned endpoints are unavailable.

The router can operate in live mode (calling Google Cloud SDK) or mock mode for
testing.  Weighted round-robin balancing is used when multiple endpoints are
available for the same agent role.
"""

from __future__ import annotations

import itertools
import logging
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    from google.cloud import aiplatform
    HAS_VERTEX = True
except ImportError:  # pragma: no cover - optional dependency
    HAS_VERTEX = False
    aiplatform = None  # type: ignore
    logger.warning("google-cloud-aiplatform not installed; VertexModelRouter will operate in mock mode.")

try:
    from vertexai.generative_models import GenerativeModel
except ImportError:  # pragma: no cover
    GenerativeModel = None  # type: ignore

BASE_MODEL = "gemini-2.0-flash-001"


@dataclass
class UsageStats:
    """Track usage statistics for a role/endpoint."""
    
    requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    fallback_requests: int = 0
    total_tokens: int = 0
    total_latency_ms: float = 0.0
    total_cost_usd: float = 0.0
    last_request_time: Optional[float] = None
    
    @property
    def avg_latency_ms(self) -> float:
        """Calculate average latency."""
        return self.total_latency_ms / max(self.requests, 1)
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate (0-1)."""
        return self.successful_requests / max(self.requests, 1)
    
    @property
    def fallback_rate(self) -> float:
        """Calculate fallback rate (0-1)."""
        return self.fallback_requests / max(self.requests, 1)


class WeightedRoundRobin:
    """Simple weighted round-robin iterator used for load balancing."""

    def __init__(self, nodes: List[Tuple[str, int]]):
        self.nodes = [(node, max(weight, 1)) for node, weight in nodes]
        expanded = []
        for node, weight in self.nodes:
            expanded.extend([node] * weight)
        self._cycle = itertools.cycle(expanded) if expanded else itertools.cycle([])

    def next(self) -> Optional[str]:
        try:
            return next(self._cycle)
        except StopIteration:  # pragma: no cover - cycle shouldn't stop
            return None


class VertexModelRouter:
    """
    Routes inference requests to Vertex AI endpoints.

    Each agent role can register one or more endpoints with optional traffic
    weights.  When an endpoint call fails, the router falls back to the base
    Gemini model to keep the system responsive.
    """

    def __init__(
        self,
        project_id: str,
        location: str = "us-central1",
        enable_vertex: Optional[bool] = None,
        cost_per_1k_tokens: float = 0.001,  # Default: $0.001 per 1K tokens
        enable_cost_tracking: bool = True,
        enable_latency_tracking: bool = True,
    ):
        self.project_id = project_id
        self.location = location
        self._use_vertex = enable_vertex if enable_vertex is not None else HAS_VERTEX

        if self._use_vertex and not HAS_VERTEX:
            raise RuntimeError("enable_vertex=True but google-cloud-aiplatform is not installed.")

        if self._use_vertex:
            aiplatform.init(project=self.project_id, location=self.location)
            logger.info("VertexModelRouter running in LIVE mode")
        else:
            logger.info("VertexModelRouter running in MOCK mode")

        self._role_endpoints: Dict[str, List[Tuple[str, int]]] = {}  # role -> list of (endpoint, weight)
        self._balancers: Dict[str, WeightedRoundRobin] = {}
        
        # Cost and latency tracking
        self._cost_per_1k_tokens = cost_per_1k_tokens
        self._enable_cost_tracking = enable_cost_tracking
        self._enable_latency_tracking = enable_latency_tracking
        self._usage_stats: Dict[str, UsageStats] = {}  # role -> usage stats
        
        if self._enable_cost_tracking:
            logger.info("Cost tracking enabled (${:.4f} per 1K tokens)".format(self._cost_per_1k_tokens))
        if self._enable_latency_tracking:
            logger.info("Latency tracking enabled")

    # ------------------------------------------------------------------ #
    # Registration
    # ------------------------------------------------------------------ #

    def register_endpoint(self, role: str, endpoint_resource: str, weight: int = 1) -> None:
        """Register a Vertex endpoint for a specific agent role."""
        role = role.lower()
        entries = self._role_endpoints.setdefault(role, [])
        entries.append((endpoint_resource, weight))
        self._balancers[role] = WeightedRoundRobin(entries)
        logger.debug("Registered endpoint %s for role %s (weight=%s)", endpoint_resource, role, weight)

    def clear_endpoints(self, role: Optional[str] = None) -> None:
        """Clear registered endpoints (for testing)."""
        if role:
            role = role.lower()
            self._role_endpoints.pop(role, None)
            self._balancers.pop(role, None)
        else:
            self._role_endpoints.clear()
            self._balancers.clear()

    # ------------------------------------------------------------------ #
    # Routing
    # ------------------------------------------------------------------ #

    def route(
        self,
        role: str,
        prompt: str,
        endpoint_override: Optional[str] = None,
        temperature: float = 0.2,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ) -> str:
        """
        Route a prompt to the appropriate Vertex AI endpoint with retry logic.

        Args:
            role: Agent role (e.g. 'qa', 'support').
            prompt: User prompt.
            endpoint_override: optional explicit endpoint resource name.
            temperature: generation temperature for fallback base model.

        Returns:
            str: model output (may be empty string if both tuned and fallback fail).
        """
        role_key = (role or "").lower()
        endpoint = endpoint_override or self._select_endpoint(role_key)
        
        # Initialize stats tracking
        start_time = time.time() if self._enable_latency_tracking else None
        response_text = ""
        used_fallback = False
        request_successful = False
        
        # Get or create usage stats for this role
        stats = self._usage_stats.setdefault(role_key, UsageStats())

        # PHASE 6 OPTIMIZATION: Retry with exponential backoff
        if endpoint and self._use_vertex:
            import time as time_module
            for attempt in range(max_retries):
                try:
                    endpoint_obj = aiplatform.Endpoint(endpoint)
                    prediction = endpoint_obj.predict(instances=[{"prompt": prompt}])
                    if prediction and prediction.predictions:
                        response_text = str(prediction.predictions[0])
                        request_successful = True
                        break  # Success, exit retry loop
                except Exception as exc:  # pragma: no cover - live failure path
                    logger.warning("Vertex endpoint %s failed for role %s (attempt %d/%d): %s",
                                 endpoint, role_key, attempt + 1, max_retries, exc)
                    if attempt < max_retries - 1:
                        # Exponential backoff: 1s, 2s, 4s
                        backoff_time = retry_delay * (2 ** attempt)
                        logger.info(f"Retrying in {backoff_time:.1f}s...")
                        time_module.sleep(backoff_time)
                    else:
                        logger.error(f"All {max_retries} retries exhausted for {endpoint}")

        # Fallback to base Gemini model using GenerativeModel if available.
        if not response_text and GenerativeModel is not None:
            used_fallback = True
            try:
                model = GenerativeModel(BASE_MODEL)
                response = model.generate_content(prompt, generation_config={"temperature": temperature})
                response_text = getattr(response, "text", "") or ""
                request_successful = bool(response_text)
            except Exception as exc:  # pragma: no cover
                # Check if it's a service account error (common in Railway deployment)
                error_msg = str(exc)
                if "service-account.json" in error_msg or "GOOGLE_APPLICATION_CREDENTIALS" in error_msg:
                    logger.warning("Gemini fallback skipped: Service account not configured (expected in Railway). Use GEMINI_API_KEY instead.")
                else:
                    logger.error("Base Gemini fallback failed: %s", exc)
                response_text = ""
        
        # Track metrics
        if self._enable_cost_tracking or self._enable_latency_tracking:
            self._track_request(
                role_key=role_key,
                prompt=prompt,
                response=response_text,
                start_time=start_time,
                used_fallback=used_fallback,
                successful=request_successful,
            )
        
        return response_text
    
    def _track_request(
        self,
        role_key: str,
        prompt: str,
        response: str,
        start_time: Optional[float],
        used_fallback: bool,
        successful: bool,
    ) -> None:
        """Track request metrics."""
        stats = self._usage_stats.get(role_key)
        if not stats:
            return
        
        # Update request counts
        stats.requests += 1
        if successful:
            stats.successful_requests += 1
        else:
            stats.failed_requests += 1
        if used_fallback:
            stats.fallback_requests += 1
        
        # Track latency
        if self._enable_latency_tracking and start_time is not None:
            latency_ms = (time.time() - start_time) * 1000
            stats.total_latency_ms += latency_ms
            stats.last_request_time = time.time()
        
        # Track cost (rough estimate based on token count)
        if self._enable_cost_tracking:
            # Rough token estimate: ~4 chars per token
            prompt_tokens = len(prompt) // 4
            response_tokens = len(response) // 4
            total_tokens = prompt_tokens + response_tokens
            
            stats.total_tokens += total_tokens
            stats.total_cost_usd += (total_tokens / 1000) * self._cost_per_1k_tokens

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    def _select_endpoint(self, role: str) -> Optional[str]:
        """Select the next endpoint for a role using weighted round-robin."""
        balancer = self._balancers.get(role)
        if balancer:
            return balancer.next()
        return None

    def list_endpoints(self, role: Optional[str] = None) -> Dict[str, List[Tuple[str, int]]]:
        """Return registered endpoints per role."""
        if role:
            role = role.lower()
            return {role: self._role_endpoints.get(role, [])}
        return dict(self._role_endpoints)
    
    # ------------------------------------------------------------------ #
    # Cost & Latency Tracking
    # ------------------------------------------------------------------ #
    
    def get_usage_stats(self, role: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Get usage statistics for roles.
        
        Args:
            role: Optional role to filter by (None = all roles)
        
        Returns:
            Dict mapping role -> stats dict
        """
        if role:
            role = role.lower()
            stats = self._usage_stats.get(role)
            if not stats:
                return {}
            return {
                role: {
                    "requests": stats.requests,
                    "successful_requests": stats.successful_requests,
                    "failed_requests": stats.failed_requests,
                    "fallback_requests": stats.fallback_requests,
                    "success_rate": stats.success_rate,
                    "fallback_rate": stats.fallback_rate,
                    "total_tokens": stats.total_tokens,
                    "total_cost_usd": stats.total_cost_usd,
                    "avg_latency_ms": stats.avg_latency_ms,
                    "last_request_time": stats.last_request_time,
                }
            }
        
        # Return all roles
        return {
            role_key: {
                "requests": stats.requests,
                "successful_requests": stats.successful_requests,
                "failed_requests": stats.failed_requests,
                "fallback_requests": stats.fallback_requests,
                "success_rate": stats.success_rate,
                "fallback_rate": stats.fallback_rate,
                "total_tokens": stats.total_tokens,
                "total_cost_usd": stats.total_cost_usd,
                "avg_latency_ms": stats.avg_latency_ms,
                "last_request_time": stats.last_request_time,
            }
            for role_key, stats in self._usage_stats.items()
        }
    
    def get_total_cost(self) -> float:
        """Get total cost across all roles."""
        return sum(stats.total_cost_usd for stats in self._usage_stats.values())
    
    def get_avg_latency(self, role: Optional[str] = None) -> float:
        """
        Get average latency in milliseconds.
        
        Args:
            role: Optional role to filter by (None = all roles)
        
        Returns:
            Average latency in milliseconds
        """
        if role:
            role = role.lower()
            stats = self._usage_stats.get(role)
            return stats.avg_latency_ms if stats else 0.0
        
        # Average across all roles
        total_latency = sum(stats.total_latency_ms for stats in self._usage_stats.values())
        total_requests = sum(stats.requests for stats in self._usage_stats.values())
        return total_latency / max(total_requests, 1)
    
    def reset_stats(self, role: Optional[str] = None) -> None:
        """
        Reset usage statistics.
        
        Args:
            role: Optional role to reset (None = reset all)
        """
        if role:
            role = role.lower()
            if role in self._usage_stats:
                self._usage_stats[role] = UsageStats()
        else:
            self._usage_stats.clear()

