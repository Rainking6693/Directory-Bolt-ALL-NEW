"""
COMPUTER USE CLIENT - Unified GUI Automation Interface
Version: 1.0
Last Updated: October 27, 2025

Unified client for GUI automation with pluggable backends:
- Gemini Computer Use (mock implementation, ~50-60% success rate)
- Agent-S (production implementation, 83.6% OSWorld success rate)

ARCHITECTURE:
- Backend abstraction layer
- Feature flag-based selection
- Backward compatibility with existing code
- A/B testing capability

USAGE:
    # Use Gemini backend (default)
    client = ComputerUseClient(backend="gemini")

    # Use Agent-S backend
    client = ComputerUseClient(backend="agent_s")

    # Execute task
    result = await client.execute_task("Open browser and go to github.com")
"""

import logging
import os
from typing import Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class UnifiedTaskResult:
    """Unified result format for all backends"""
    success: bool
    output: str
    backend: str
    actions_taken: int = 0
    duration_seconds: float = 0.0
    error: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ComputerUseClient:
    """
    Unified GUI automation client with pluggable backends

    Supports:
    - Gemini Computer Use (mock)
    - Agent-S (production)

    Backend selection via:
    1. Constructor parameter: ComputerUseClient(backend="agent_s")
    2. Environment variable: COMPUTER_USE_BACKEND=agent_s
    """

    def __init__(
        self,
        backend: Optional[str] = None,
        model: str = "gpt-4o",
        **backend_kwargs
    ):
        """
        Initialize computer use client

        Args:
            backend: Backend to use (gemini, agent_s). If None, uses env var or default.
            model: LLM model for backend
            **backend_kwargs: Additional backend-specific arguments
        """
        # Determine backend
        if backend is None:
            backend = os.getenv("COMPUTER_USE_BACKEND", "gemini")

        self.backend_name = backend.lower()
        self.model = model

        # Initialize backend
        if self.backend_name == "gemini":
            self.backend = self._init_gemini_backend(**backend_kwargs)
        elif self.backend_name == "agent_s":
            self.backend = self._init_agent_s_backend(model=model, **backend_kwargs)
        else:
            raise ValueError(
                f"Unknown backend: {backend}. Supported: gemini, agent_s"
            )

        logger.info(f"✅ ComputerUseClient initialized with backend: {self.backend_name}")

    def _init_gemini_backend(self, **kwargs):
        """Initialize Gemini Computer Use backend (mock)"""
        # Import here to avoid circular dependency
        from agents.deploy_agent import GeminiComputerUseClient

        require_human_confirmation = kwargs.get("require_human_confirmation", False)
        return GeminiComputerUseClient(
            require_human_confirmation=require_human_confirmation
        )

    def _init_agent_s_backend(self, model: str, **kwargs):
        """Initialize Agent-S backend"""
        from infrastructure.agent_s_backend import get_agent_s_backend

        engine_type = kwargs.get("engine_type", "openai")
        use_dom_parsing = kwargs.get("use_dom_parsing", False)

        # Check environment variable for DOM parsing feature flag
        if not use_dom_parsing:
            use_dom_parsing = os.getenv("USE_DOM_PARSING", "false").lower() == "true"

        return get_agent_s_backend(
            model=model,
            engine_type=engine_type,
            use_dom_parsing=use_dom_parsing
        )

    async def execute_task(
        self,
        task: str,
        max_steps: int = 20,
        timeout_seconds: int = 300,
    ) -> UnifiedTaskResult:
        """
        Execute GUI automation task

        Args:
            task: Natural language task description
            max_steps: Maximum steps for task execution
            timeout_seconds: Task timeout in seconds

        Returns:
            UnifiedTaskResult with success status and output
        """
        if self.backend_name == "gemini":
            return await self._execute_gemini_task(task, max_steps, timeout_seconds)
        elif self.backend_name == "agent_s":
            return await self._execute_agent_s_task(task, max_steps, timeout_seconds)

    async def _execute_gemini_task(
        self, task: str, max_steps: int, timeout_seconds: int
    ) -> UnifiedTaskResult:
        """Execute task with Gemini backend"""
        try:
            result = await self.backend.autonomous_task(
                task_description=task, max_steps=max_steps
            )

            return UnifiedTaskResult(
                success=result.get("success", True),
                output=result.get("result", "Task completed"),
                backend="gemini",
                actions_taken=result.get("steps", 0),
                duration_seconds=result.get("duration", 0.0),
                metadata=result,
            )

        except Exception as e:
            logger.error(f"❌ Gemini task execution failed: {e}")
            return UnifiedTaskResult(
                success=False,
                output="",
                backend="gemini",
                error=str(e),
            )

    async def _execute_agent_s_task(
        self, task: str, max_steps: int, timeout_seconds: int
    ) -> UnifiedTaskResult:
        """Execute task with Agent-S backend"""
        try:
            result = await self.backend.execute_task(
                task=task,
                max_steps=max_steps,
                timeout_seconds=timeout_seconds,
            )

            return UnifiedTaskResult(
                success=result.success,
                output=result.output,
                backend="agent_s",
                actions_taken=len(result.actions_taken),
                duration_seconds=result.duration_seconds,
                error=result.error,
                metadata={"info": result.info, "reflection": result.reflection},
            )

        except Exception as e:
            logger.error(f"❌ Agent-S task execution failed: {e}")
            return UnifiedTaskResult(
                success=False,
                output="",
                backend="agent_s",
                error=str(e),
            )

    async def click(self, x: int, y: int) -> UnifiedTaskResult:
        """Click at coordinates"""
        if self.backend_name == "gemini":
            # Gemini doesn't have click method, use execute_task
            return await self.execute_task(f"Click at coordinates ({x}, {y})")
        elif self.backend_name == "agent_s":
            result = await self.backend.click(x, y)
            return UnifiedTaskResult(
                success=result.success,
                output=result.output,
                backend="agent_s",
                actions_taken=len(result.actions_taken),
                duration_seconds=result.duration_seconds,
                error=result.error,
            )

    async def type_text(self, text: str) -> UnifiedTaskResult:
        """Type text at current cursor position"""
        if self.backend_name == "gemini":
            return await self.execute_task(f"Type text: {text}")
        elif self.backend_name == "agent_s":
            result = await self.backend.type_text(text)
            return UnifiedTaskResult(
                success=result.success,
                output=result.output,
                backend="agent_s",
                actions_taken=len(result.actions_taken),
                duration_seconds=result.duration_seconds,
                error=result.error,
            )

    async def screenshot(self, save_path: Optional[str] = None) -> UnifiedTaskResult:
        """Take screenshot"""
        if self.backend_name == "gemini":
            await self.backend.take_screenshot()
            return UnifiedTaskResult(
                success=True,
                output=f"Screenshot taken",
                backend="gemini",
            )
        elif self.backend_name == "agent_s":
            result = await self.backend.screenshot(save_path)
            return UnifiedTaskResult(
                success=result.success,
                output=result.output,
                backend="agent_s",
                actions_taken=len(result.actions_taken),
                duration_seconds=result.duration_seconds,
                error=result.error,
            )

    async def navigate(self, url: str) -> UnifiedTaskResult:
        """Navigate browser to URL"""
        if self.backend_name == "gemini":
            await self.backend.navigate(url)
            return UnifiedTaskResult(
                success=True,
                output=f"Navigated to {url}",
                backend="gemini",
            )
        elif self.backend_name == "agent_s":
            result = await self.backend.navigate(url)
            return UnifiedTaskResult(
                success=result.success,
                output=result.output,
                backend="agent_s",
                actions_taken=len(result.actions_taken),
                duration_seconds=result.duration_seconds,
                error=result.error,
            )

    async def start_browser(self, headless: bool = True):
        """Start browser session (Gemini only)"""
        if self.backend_name == "gemini":
            await self.backend.start_browser(headless=headless)
        else:
            logger.warning("start_browser() not supported by Agent-S backend")

    async def stop_browser(self):
        """Stop browser session (Gemini only)"""
        if self.backend_name == "gemini":
            await self.backend.stop_browser()
        else:
            logger.warning("stop_browser() not supported by Agent-S backend")

    def get_metrics(self) -> Dict[str, Any]:
        """Get backend metrics"""
        if self.backend_name == "agent_s":
            return self.backend.get_metrics()
        else:
            # Gemini mock doesn't track metrics
            return {
                "backend": "gemini",
                "note": "Metrics not available for Gemini mock backend",
            }


# Convenience function
def get_computer_use_client(
    backend: Optional[str] = None,
    model: str = "gpt-4o",
    **kwargs
) -> ComputerUseClient:
    """
    Get ComputerUseClient instance

    Args:
        backend: Backend to use (gemini, agent_s)
        model: LLM model
        **kwargs: Additional backend arguments

    Returns:
        ComputerUseClient instance
    """
    return ComputerUseClient(backend=backend, model=model, **kwargs)


if __name__ == "__main__":
    import asyncio

    async def test_client():
        # Test Gemini backend
        print("Testing Gemini backend...")
        gemini_client = get_computer_use_client(backend="gemini")
        result = await gemini_client.execute_task("Open browser")
        print(f"Gemini result: {result}")

        # Test Agent-S backend (requires API keys)
        print("\nTesting Agent-S backend...")
        try:
            agent_s_client = get_computer_use_client(backend="agent_s")
            result = await agent_s_client.execute_task("Take a screenshot")
            print(f"Agent-S result: {result}")
        except Exception as e:
            print(f"Agent-S test failed (expected if no API keys): {e}")

    asyncio.run(test_client())
