"""
Base Middleware Framework

Provides abstract base classes for middleware that hooks into tool execution lifecycle.

Lifecycle:
    1. on_tool_call()   - Before tool execution (validation, policy checks)
    2. [Tool executes]
    3. on_tool_result() - After successful execution (logging, scoring)
    4. on_tool_error()  - On execution failure (retry logic, error handling)

Author: Claude Code
Date: 2025-11-08
Version: 1.0.0
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ToolCall:
    """Tool execution request (pre-execution)"""
    tool_name: str
    agent_name: str
    arguments: Dict[str, Any]
    context: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ToolResult:
    """Tool execution result (post-execution)"""
    tool_name: str
    agent_name: str
    result: Any
    execution_time_ms: float
    success: bool
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


class AgentMiddleware(ABC):
    """
    Abstract base class for tool execution middleware.

    Middleware can intercept tool calls at three points:
    - Before execution (on_tool_call): Validate policies, check permissions
    - After success (on_tool_result): Log traces, compute scores
    - After failure (on_tool_error): Handle errors, trigger retries

    Example:
        class LoggingMiddleware(AgentMiddleware):
            async def on_tool_call(self, call: ToolCall) -> None:
                print(f"Calling {call.tool_name} with {call.arguments}")

            async def on_tool_result(self, result: ToolResult) -> None:
                print(f"Result: {result.result}")

            async def on_tool_error(self, call: ToolCall, error: Exception) -> None:
                print(f"Error: {error}")
    """

    @abstractmethod
    async def on_tool_call(self, call: ToolCall) -> None:
        """
        Execute before tool invocation.

        Use for:
        - Policy card validation
        - Capability map checks
        - Argument schema validation
        - Rate limiting
        - Permission checks

        Args:
            call: Tool call request

        Raises:
            PolicyViolation: If policy check fails
            CapabilityError: If capability check fails
            ValidationError: If argument validation fails
        """
        pass

    @abstractmethod
    async def on_tool_result(self, result: ToolResult) -> None:
        """
        Execute after successful tool execution.

        Use for:
        - OTEL trace logging
        - ToolRM quality scoring
        - Reasoning bank storage
        - Usage statistics
        - Success metrics

        Args:
            result: Tool execution result
        """
        pass

    @abstractmethod
    async def on_tool_error(self, call: ToolCall, error: Exception) -> None:
        """
        Execute on tool failure.

        Use for:
        - Error logging
        - Retry logic
        - Circuit breaker updates
        - Failure metrics
        - Alerting

        Args:
            call: Original tool call
            error: Exception that occurred
        """
        pass


class PolicyViolation(Exception):
    """Raised when policy card check fails"""
    pass


class CapabilityError(Exception):
    """Raised when capability map check fails"""
    pass


class ValidationError(Exception):
    """Raised when argument validation fails"""
    pass
