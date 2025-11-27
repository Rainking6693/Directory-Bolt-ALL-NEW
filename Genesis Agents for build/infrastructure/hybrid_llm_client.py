"""
Hybrid LLM Client - Local LLM with API Fallback

P1 Fix #1: Provides graceful fallback from Local LLM to cloud APIs.
Implements resilience pattern: Local → OpenAI → Anthropic → Gemini

Based on:
- Local LLM (llama.cpp) for 99% cost savings
- OpenAI GPT-4o for high-quality fallback
- Anthropic Claude Haiku 4.5 for fast fallback
- Gemini Flash for ultra-cheap fallback

Author: Claude (P1 Fixes)
Date: November 3, 2025
Audit: Hudson (8.9/10 recommendation)
"""

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, Optional, List

# Local LLM client
from infrastructure.local_llm_client import (
    LocalLLMClient,
    LocalLLMConfig
)

# API clients (existing infrastructure)
try:
    from infrastructure.llm_client import (
        LLMProvider,
        LLMClient
    )
    API_CLIENTS_AVAILABLE = True
except ImportError:
    API_CLIENTS_AVAILABLE = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("API clients not available - fallback disabled")

logger = logging.getLogger("hybrid_llm_client")


class FallbackStrategy(Enum):
    """Fallback strategy when local LLM fails."""
    NONE = "none"  # No fallback (fail fast)
    OPENAI_ONLY = "openai"  # Fallback to OpenAI GPT-4o
    ANTHROPIC_ONLY = "anthropic"  # Fallback to Claude
    GEMINI_ONLY = "gemini"  # Fallback to Gemini Flash
    FULL_CASCADE = "cascade"  # Try all: Local → OpenAI → Anthropic → Gemini


@dataclass
class HybridLLMConfig:
    """
    Configuration for Hybrid LLM Client.

    Attributes:
        fallback_strategy: Strategy when local LLM fails
        fallback_timeout: Max time for fallback attempts (seconds)
        local_llm_timeout: Timeout for local LLM (seconds)
        enable_local_llm: Whether to try local LLM first
        track_metrics: Whether to track usage metrics
    """
    fallback_strategy: FallbackStrategy = FallbackStrategy.FULL_CASCADE
    fallback_timeout: float = 30.0
    local_llm_timeout: float = 10.0
    enable_local_llm: bool = True
    track_metrics: bool = True


@dataclass
class UsageMetrics:
    """Track LLM usage for cost analysis."""
    local_llm_requests: int = 0
    local_llm_successes: int = 0
    local_llm_failures: int = 0
    openai_fallbacks: int = 0
    anthropic_fallbacks: int = 0
    gemini_fallbacks: int = 0
    total_requests: int = 0
    total_failures: int = 0


class HybridLLMClient:
    """
    Hybrid LLM Client with Local-First + API Fallback.

    Usage:
        async with HybridLLMClient() as client:
            response = await client.complete_text("Hello")
            # Tries: Local LLM → OpenAI → Anthropic → Gemini

    Cost Optimization:
        - 99% requests: Local LLM ($0)
        - 1% fallback: Cloud APIs ($0.003-0.03 per request)
        - Net cost reduction: 98-99% vs. API-only

    Resilience:
        - Automatic fallback on local LLM failure
        - Configurable fallback strategies
        - Metrics tracking for monitoring
    """

    def __init__(
        self,
        config: Optional[HybridLLMConfig] = None,
        local_llm_config: Optional[LocalLLMConfig] = None
    ):
        """
        Initialize Hybrid LLM Client.

        Args:
            config: Hybrid client configuration
            local_llm_config: Local LLM specific configuration
        """
        self.config = config or HybridLLMConfig()
        self.local_llm_config = local_llm_config or LocalLLMConfig()

        # Initialize clients
        self.local_llm_client: Optional[LocalLLMClient] = None
        self.api_clients: Dict[str, Any] = {}

        # Metrics tracking
        self.metrics = UsageMetrics()

        # Initialize based on config
        if self.config.enable_local_llm:
            try:
                self.local_llm_client = LocalLLMClient(self.local_llm_config)
                logger.info("Local LLM client initialized for hybrid mode")
            except Exception as e:
                logger.warning(f"Could not initialize local LLM: {e}")
                self.local_llm_client = None

        # Initialize API clients if fallback enabled
        if self.config.fallback_strategy != FallbackStrategy.NONE:
            self._init_api_clients()

        logger.info(
            f"HybridLLMClient initialized: "
            f"local_llm={self.local_llm_client is not None}, "
            f"fallback_strategy={self.config.fallback_strategy.value}"
        )

    def _init_api_clients(self):
        """Initialize API clients for fallback."""
        if not API_CLIENTS_AVAILABLE:
            logger.warning("API clients not available - fallback disabled")
            return

        # Initialize OpenAI client
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key and self.config.fallback_strategy in [
            FallbackStrategy.OPENAI_ONLY,
            FallbackStrategy.FULL_CASCADE
        ]:
            try:
                from infrastructure.openai_client import OpenAIClient
                self.api_clients["openai"] = OpenAIClient()
                logger.info("OpenAI fallback client initialized")
            except Exception as e:
                logger.warning(f"Could not initialize OpenAI client: {e}")

        # Initialize Anthropic client
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key and self.config.fallback_strategy in [
            FallbackStrategy.ANTHROPIC_ONLY,
            FallbackStrategy.FULL_CASCADE
        ]:
            try:
                from infrastructure.anthropic_client import AnthropicClient
                self.api_clients["anthropic"] = AnthropicClient()
                logger.info("Anthropic fallback client initialized")
            except Exception as e:
                logger.warning(f"Could not initialize Anthropic client: {e}")

        # Initialize Gemini client
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key and self.config.fallback_strategy in [
            FallbackStrategy.GEMINI_ONLY,
            FallbackStrategy.FULL_CASCADE
        ]:
            try:
                from infrastructure.gemini_client import GeminiClient
                self.api_clients["gemini"] = GeminiClient()
                logger.info("Gemini fallback client initialized")
            except Exception as e:
                logger.warning(f"Could not initialize Gemini client: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        if self.local_llm_client:
            await self.local_llm_client.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.local_llm_client:
            await self.local_llm_client.__aexit__(exc_type, exc_val, exc_tb)

    async def complete_text(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> str:
        """
        Generate text completion with local-first + API fallback.

        Flow:
        1. Try local LLM (if enabled)
        2. On failure, try OpenAI GPT-4o
        3. On failure, try Anthropic Claude Haiku 4.5
        4. On failure, try Gemini Flash
        5. If all fail, raise exception

        Args:
            prompt: User prompt
            system: Optional system message
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response length
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated text string

        Raises:
            Exception: If all providers fail
        """
        start_time = time.time()
        self.metrics.total_requests += 1

        # Step 1: Try local LLM first
        if self.config.enable_local_llm and self.local_llm_client:
            try:
                logger.debug("Attempting local LLM completion")
                self.metrics.local_llm_requests += 1

                response = await asyncio.wait_for(
                    self.local_llm_client.complete_text(
                        prompt=prompt,
                        system=system,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **kwargs
                    ),
                    timeout=self.config.local_llm_timeout
                )

                self.metrics.local_llm_successes += 1
                elapsed = time.time() - start_time
                logger.info(f"Local LLM success ({elapsed:.2f}s)")
                return response

            except asyncio.TimeoutError:
                self.metrics.local_llm_failures += 1
                logger.warning(f"Local LLM timeout ({self.config.local_llm_timeout}s)")
            except Exception as e:
                self.metrics.local_llm_failures += 1
                logger.warning(f"Local LLM failed: {e}")

        # Step 2-4: Try API fallbacks based on strategy
        if self.config.fallback_strategy == FallbackStrategy.NONE:
            self.metrics.total_failures += 1
            raise Exception("Local LLM failed and fallback disabled")

        return await self._try_api_fallbacks(
            prompt=prompt,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

    async def _try_api_fallbacks(
        self,
        prompt: str,
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        **kwargs
    ) -> str:
        """
        Try API fallbacks in order based on strategy.

        Order for FULL_CASCADE:
        1. OpenAI GPT-4o (best quality)
        2. Anthropic Claude Haiku 4.5 (fast + cheap)
        3. Gemini Flash (ultra-cheap)
        """
        fallback_order = self._get_fallback_order()
        errors = []

        for provider_name in fallback_order:
            if provider_name not in self.api_clients:
                continue

            try:
                logger.info(f"Attempting {provider_name} fallback")
                client = self.api_clients[provider_name]

                response = await asyncio.wait_for(
                    self._call_api_provider(
                        client=client,
                        provider_name=provider_name,
                        prompt=prompt,
                        system=system,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **kwargs
                    ),
                    timeout=self.config.fallback_timeout
                )

                # Track successful fallback
                self._track_fallback_success(provider_name)
                logger.info(f"{provider_name} fallback success")
                return response

            except asyncio.TimeoutError:
                error_msg = f"{provider_name} timeout ({self.config.fallback_timeout}s)"
                logger.warning(error_msg)
                errors.append(error_msg)
            except Exception as e:
                error_msg = f"{provider_name} failed: {str(e)}"
                logger.warning(error_msg)
                errors.append(error_msg)

        # All providers failed
        self.metrics.total_failures += 1
        error_summary = "; ".join(errors)
        raise Exception(f"All LLM providers failed: {error_summary}")

    def _get_fallback_order(self) -> List[str]:
        """Get fallback order based on strategy."""
        if self.config.fallback_strategy == FallbackStrategy.OPENAI_ONLY:
            return ["openai"]
        elif self.config.fallback_strategy == FallbackStrategy.ANTHROPIC_ONLY:
            return ["anthropic"]
        elif self.config.fallback_strategy == FallbackStrategy.GEMINI_ONLY:
            return ["gemini"]
        elif self.config.fallback_strategy == FallbackStrategy.FULL_CASCADE:
            return ["openai", "anthropic", "gemini"]
        else:
            return []

    async def _call_api_provider(
        self,
        client: Any,
        provider_name: str,
        prompt: str,
        system: Optional[str],
        temperature: float,
        max_tokens: int,
        **kwargs
    ) -> str:
        """
        Call API provider with unified interface.

        Handles different API client interfaces.
        """
        # Most clients follow this pattern
        if hasattr(client, "generate_text"):
            return await client.generate_text(
                system_prompt=system or "",
                user_prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )
        elif hasattr(client, "complete"):
            return await client.complete(
                prompt=prompt,
                system=system,
                temperature=temperature,
                max_tokens=max_tokens
            )
        else:
            raise Exception(f"Unknown API client interface for {provider_name}")

    def _track_fallback_success(self, provider_name: str):
        """Track successful fallback metrics."""
        if provider_name == "openai":
            self.metrics.openai_fallbacks += 1
        elif provider_name == "anthropic":
            self.metrics.anthropic_fallbacks += 1
        elif provider_name == "gemini":
            self.metrics.gemini_fallbacks += 1

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get usage metrics for monitoring and cost analysis.

        Returns:
            {
                "local_llm_success_rate": 0.99,
                "total_requests": 1000,
                "local_llm_requests": 1000,
                "local_llm_successes": 990,
                "local_llm_failures": 10,
                "openai_fallbacks": 8,
                "anthropic_fallbacks": 1,
                "gemini_fallbacks": 1,
                "estimated_cost_savings": "$4.97"
            }
        """
        total_reqs = self.metrics.total_requests or 1  # Avoid division by zero

        # Calculate cost savings
        # Assumptions: OpenAI $0.003, Anthropic $0.0015, Gemini $0.0003, Local $0
        estimated_cost_without_local = total_reqs * 0.003  # If all OpenAI
        estimated_cost_with_local = (
            self.metrics.openai_fallbacks * 0.003 +
            self.metrics.anthropic_fallbacks * 0.0015 +
            self.metrics.gemini_fallbacks * 0.0003
        )
        cost_savings = estimated_cost_without_local - estimated_cost_with_local

        return {
            "total_requests": self.metrics.total_requests,
            "local_llm_requests": self.metrics.local_llm_requests,
            "local_llm_successes": self.metrics.local_llm_successes,
            "local_llm_failures": self.metrics.local_llm_failures,
            "local_llm_success_rate": (
                self.metrics.local_llm_successes / self.metrics.local_llm_requests
                if self.metrics.local_llm_requests > 0 else 0.0
            ),
            "openai_fallbacks": self.metrics.openai_fallbacks,
            "anthropic_fallbacks": self.metrics.anthropic_fallbacks,
            "gemini_fallbacks": self.metrics.gemini_fallbacks,
            "total_fallbacks": (
                self.metrics.openai_fallbacks +
                self.metrics.anthropic_fallbacks +
                self.metrics.gemini_fallbacks
            ),
            "fallback_rate": (
                (self.metrics.openai_fallbacks + self.metrics.anthropic_fallbacks + self.metrics.gemini_fallbacks) / total_reqs
            ),
            "estimated_cost_savings_usd": f"${cost_savings:.2f}",
            "estimated_cost_without_local_usd": f"${estimated_cost_without_local:.2f}",
            "estimated_cost_with_local_usd": f"${estimated_cost_with_local:.2f}"
        }


# Factory function
def get_hybrid_llm_client(
    fallback_strategy: FallbackStrategy = FallbackStrategy.FULL_CASCADE
) -> HybridLLMClient:
    """
    Get HybridLLMClient with default configuration.

    Args:
        fallback_strategy: Strategy for API fallback

    Returns:
        Configured HybridLLMClient instance
    """
    config = HybridLLMConfig(fallback_strategy=fallback_strategy)
    return HybridLLMClient(config=config)
