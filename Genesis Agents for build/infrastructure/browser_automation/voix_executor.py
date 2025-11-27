"""
VOIX Executor - Invokes VOIX declarative tools

Based on arXiv:2511.11287 - Building the Web for Agents
Integration #74: VOIX Declarative Discovery Layer

Features:
- Invokes VOIX <tool> actions
- Handles authentication (session, bearer, none)
- Parameter validation against tool schema
- Error handling and retries
- Performance tracking
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import aiohttp
import asyncio
import json
import logging
from datetime import datetime

from infrastructure.load_env import load_genesis_env
from infrastructure.browser_automation.voix_detector import (
    ToolDefinition,
    ContextDefinition,
    get_voix_detector
)

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class VoixInvocationResult:
    """Result from VOIX tool invocation."""
    success: bool
    tool_name: str
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    status_code: Optional[int] = None
    latency_ms: float = 0.0
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class VoixExecutor:
    """
    Executes VOIX declarative tools.

    Handles tool invocation with proper authentication, parameter validation,
    and error handling.
    """

    def __init__(
        self,
        timeout: int = 30,
        max_retries: int = 3,
        session_cookies: Optional[Dict[str, str]] = None
    ):
        self.timeout = timeout
        self.max_retries = max_retries
        self.session_cookies = session_cookies or {}
        self.detector = get_voix_detector()

        # Performance tracking
        self.invocation_count = 0
        self.success_count = 0
        self.failure_count = 0
        self.total_latency = 0.0

        # Response caching (reduces redundant network calls)
        self.enable_response_cache: bool = True
        self.cache_ttl_seconds: float = 60.0
        self._response_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}

        logger.info("[VoixExecutor] Initialized")

    async def invoke_tool(
        self,
        url: str,
        tool_name: str,
        parameters: Dict[str, Any],
        bearer_token: Optional[str] = None
    ) -> VoixInvocationResult:
        """
        Invoke a VOIX tool.

        Args:
            url: Page URL where tool was discovered
            tool_name: Name of tool to invoke
            parameters: Tool parameters
            bearer_token: Optional bearer token for auth

        Returns:
            VoixInvocationResult with response or error
        """
        start_time = asyncio.get_event_loop().time()

        # Get tool definition
        tool = self.detector.get_tool_by_name(url, tool_name)

        if not tool:
            error_msg = f"Tool '{tool_name}' not found on {url}"
            logger.error(f"[VOIX] {error_msg}")
            return VoixInvocationResult(
                success=False,
                tool_name=tool_name,
                error=error_msg
            )

        # Check tool visibility (only invoke visible tools by default)
        if not tool.visible:
            logger.warning(f"[VOIX] Tool '{tool_name}' is not visible, but proceeding with invocation")

        # Log tool invocation
        logger.info(f"[VOIX] Invoking tool '{tool_name}' on {url}")
        logger.debug(f"[VOIX] Tool details: method={tool.method}, endpoint={tool.endpoint}, auth={tool.auth}")

        # Validate parameters
        validation_error = self._validate_parameters(tool, parameters)
        if validation_error:
            logger.error(f"[VOIX] Parameter validation failed: {validation_error}")
            return VoixInvocationResult(
                success=False,
                tool_name=tool_name,
                error=f"Parameter validation failed: {validation_error}"
            )

        # Determine endpoint
        endpoint = tool.endpoint
        if not endpoint:
            # If no endpoint specified, tool might use form submission
            # For now, return error
            error_msg = f"Tool '{tool_name}' has no endpoint specified"
            logger.error(f"[VOIX] {error_msg}")
            return VoixInvocationResult(
                success=False,
                tool_name=tool_name,
                error=error_msg
            )

        # Make endpoint absolute if needed
        if endpoint.startswith('/'):
            from urllib.parse import urlparse
            parsed = urlparse(url)
            endpoint = f"{parsed.scheme}://{parsed.netloc}{endpoint}"

        # Invoke with retries
        for attempt in range(self.max_retries):
            try:
                result = await self._invoke_with_auth(
                    tool=tool,
                    endpoint=endpoint,
                    parameters=parameters,
                    bearer_token=bearer_token
                )
            except Exception as e:
                logger.warning(
                    f"[VOIX] Invocation attempt {attempt + 1}/{self.max_retries} failed: {e}"
                )

                if attempt == self.max_retries - 1:
                    self.invocation_count += 1
                    self.failure_count += 1

                    return VoixInvocationResult(
                        success=False,
                        tool_name=tool_name,
                        error=f"All {self.max_retries} attempts failed: {str(e)}",
                        latency_ms=(asyncio.get_event_loop().time() - start_time) * 1000
                    )

                await asyncio.sleep(2 ** attempt)
                continue

            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            self.invocation_count += 1
            result.latency_ms = latency_ms

            if result.success:
                self.success_count += 1
                self.total_latency += latency_ms
                logger.info(
                    f"[VOIX] Tool '{tool_name}' invoked successfully "
                    f"(latency: {latency_ms:.0f}ms)"
                )
                return result

            self.failure_count += 1
            logger.warning(
                f"[VOIX] Tool '{tool_name}' invocation failed: {result.error}"
            )

            if attempt == self.max_retries - 1:
                # Exhausted retries
                return result

            await asyncio.sleep(2 ** attempt)

        # Should never reach here, but just in case
        return VoixInvocationResult(
            success=False,
            tool_name=tool_name,
            error="Unexpected error in retry loop"
        )

    async def _invoke_with_auth(
        self,
        tool: ToolDefinition,
        endpoint: str,
        parameters: Dict[str, Any],
        bearer_token: Optional[str]
    ) -> VoixInvocationResult:
        """
        Invoke tool with appropriate authentication.

        Args:
            tool: Tool definition
            endpoint: Full endpoint URL
            parameters: Tool parameters
            bearer_token: Optional bearer token

        Returns:
            VoixInvocationResult
        """
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Genesis-VOIX-Client/1.0"
        }

        # Add authentication
        if tool.auth == "bearer" and bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"
        elif tool.auth == "session":
            # Session cookies will be added automatically
            pass

        try:
            # Check response cache first
            cache_key = f"{endpoint}:{tool.method}:{json.dumps(parameters, sort_keys=True)}"
            if self.enable_response_cache:
                cached_entry = self._response_cache.get(cache_key)
                if cached_entry:
                    cached_result, cache_time = cached_entry
                    if (asyncio.get_event_loop().time() - cache_time) < self.cache_ttl_seconds:
                        logger.debug(f"[VOIX] Using cached response for {tool.name}")
                        return VoixInvocationResult(
                            success=cached_result["success"],
                            tool_name=tool.name,
                            response_data=cached_result.get("data"),
                            status_code=cached_result.get("status_code"),
                            latency_ms=0.0
                        )

            session_kwargs = {
                "cookies": self.session_cookies,
                "connector": aiohttp.TCPConnector(limit=100, limit_per_host=10)
            }

            async with aiohttp.ClientSession(**session_kwargs) as session:
                method = tool.method.upper()

                if method == "GET":
                    request_ctx = session.get(
                        endpoint,
                        params=parameters,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=self.timeout)
                    )
                elif method in ["POST", "PUT", "PATCH"]:
                    request_ctx = session.request(
                        method,
                        endpoint,
                        json=parameters,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=self.timeout)
                    )
                elif method == "DELETE":
                    request_ctx = session.delete(
                        endpoint,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=self.timeout)
                    )
                else:
                    return VoixInvocationResult(
                        success=False,
                        tool_name=tool.name,
                        error=f"Unsupported HTTP method: {tool.method}"
                    )

                async def _consume_response(resp_obj):
                    result = await self._handle_response(tool.name, resp_obj)
                    if self.enable_response_cache and result.success:
                        self._store_response_in_cache(cache_key, result)
                    return result

                if hasattr(request_ctx, "__aenter__"):
                    async with request_ctx as response:
                        return await _consume_response(response)

                # Some tests patch aiohttp to return simple coroutines instead of context managers
                response = await request_ctx
                return await _consume_response(response)

        except aiohttp.ClientError as e:
            return VoixInvocationResult(
                success=False,
                tool_name=tool.name,
                error=f"HTTP error: {str(e)}"
            )
        except asyncio.TimeoutError:
            return VoixInvocationResult(
                success=False,
                tool_name=tool.name,
                error=f"Request timed out after {self.timeout}s"
            )

    def _store_response_in_cache(self, cache_key: str, result: VoixInvocationResult):
        """Persist response metadata for future reuse."""
        self._response_cache[cache_key] = (
            {
                "success": result.success,
                "data": result.response_data,
                "status_code": result.status_code
            },
            asyncio.get_event_loop().time()
        )

        # Prevent unbounded cache growth
        if len(self._response_cache) > 100:
            oldest_key = min(
                self._response_cache.keys(),
                key=lambda k: self._response_cache[k][1]
            )
            self._response_cache.pop(oldest_key, None)

    async def _handle_response(
        self,
        tool_name: str,
        response: aiohttp.ClientResponse
    ) -> VoixInvocationResult:
        """
        Handle HTTP response.
        
        Enhanced error reporting:
        - Logs schema validation errors
        - Reports malformed responses
        - Tracks failure patterns for monitoring
        
        Args:
            tool_name: Name of tool
            response: aiohttp response

        Returns:
            VoixInvocationResult
        """
        status_code = response.status

        # Try to parse JSON response
        try:
            response_data = await response.json()
        except (json.JSONDecodeError, aiohttp.ContentTypeError) as e:
            # Not JSON, get text
            response_text = await response.text()
            response_data = {"text": response_text}
            logger.warning(f"[VOIX] Non-JSON response for {tool_name}: {e}")

        # Check if successful (2xx status codes)
        if 200 <= status_code < 300:
            return VoixInvocationResult(
                success=True,
                tool_name=tool_name,
                response_data=response_data,
                status_code=status_code
            )
        else:
            error_msg = response_data.get('error', response_data.get('message', f"HTTP {status_code}"))
            # Enhanced error logging
            logger.error(
                f"[VOIX] Tool invocation failed: {tool_name} returned HTTP {status_code} - {error_msg}"
            )
            return VoixInvocationResult(
                success=False,
                tool_name=tool_name,
                response_data=response_data,
                error=error_msg,
                status_code=status_code
            )

    def _validate_parameters(
        self,
        tool: ToolDefinition,
        parameters: Dict[str, Any]
    ) -> Optional[str]:
        """
        Validate parameters against tool schema.
        
        Enhanced error reporting:
        - Logs detailed validation errors
        - Reports malformed tool schemas
        - Tracks failure patterns
        
        Args:
            tool: Tool definition
            parameters: Provided parameters

        Returns:
            Error message if validation fails, None if valid
        """
        schema = tool.parameters

        # Validate schema structure
        if not isinstance(schema, dict):
            logger.error(f"[VOIX] Malformed tool schema for '{tool.name}': schema must be a dict")
            return f"Malformed tool schema for '{tool.name}': schema must be a dict"

        # Check required parameters
        for param_name, param_schema in schema.items():
            if isinstance(param_schema, dict) and param_schema.get('required', False):
                if param_name not in parameters:
                    error_msg = f"Missing required parameter: {param_name}"
                    logger.error(f"[VOIX] Validation failed for '{tool.name}': {error_msg}")
                    return error_msg

        # Check parameter types (basic validation)
        for param_name, param_value in parameters.items():
            if param_name not in schema:
                logger.warning(f"[VOIX] Unknown parameter '{param_name}' for tool '{tool.name}'")
                continue

            param_schema = schema[param_name]

            # Skip if schema is just a string (type only)
            if isinstance(param_schema, str):
                expected_type = param_schema
            elif isinstance(param_schema, dict):
                expected_type = param_schema.get('type', 'any')
            else:
                logger.warning(f"[VOIX] Malformed parameter schema for '{tool.name}.{param_name}'")
                continue

            # Validate type
            type_errors = {
                'string': (str,),
                'number': (int, float),
                'boolean': (bool,),
                'object': (dict,),
                'array': (list,)
            }
            
            if expected_type in type_errors:
                if not isinstance(param_value, type_errors[expected_type]):
                    error_msg = (
                        f"Parameter '{param_name}' must be a {expected_type}, "
                        f"got {type(param_value).__name__}"
                    )
                    logger.error(f"[VOIX] Validation failed for '{tool.name}': {error_msg}")
                    return error_msg

        return None

    def set_session_cookies(self, cookies: Dict[str, str]):
        """Update session cookies for authentication."""
        self.session_cookies = cookies
        logger.info("[VoixExecutor] Session cookies updated")

    def get_stats(self) -> Dict[str, Any]:
        """Get executor statistics."""
        avg_latency = (
            self.total_latency / self.success_count
            if self.success_count > 0
            else 0
        )

        success_rate = (
            (self.success_count / self.invocation_count * 100)
            if self.invocation_count > 0
            else 0
        )

        return {
            "invocation_count": self.invocation_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "success_rate": success_rate,
            "avg_latency_ms": avg_latency
        }


# Singleton instance
_voix_executor: Optional[VoixExecutor] = None


def get_voix_executor() -> VoixExecutor:
    """Get singleton VOIX executor instance."""
    global _voix_executor
    if _voix_executor is None:
        _voix_executor = VoixExecutor()
    return _voix_executor
