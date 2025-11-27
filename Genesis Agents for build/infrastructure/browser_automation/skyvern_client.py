"""
Skyvern Client for Genesis
Secure wrapper around Skyvern browser automation service
"""

import aiohttp
import asyncio
import os
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class SkyvernTaskStatus(str, Enum):
    """Task execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class SkyvernTask:
    """Skyvern task execution result"""
    task_id: str
    status: SkyvernTaskStatus
    task_file: str
    parameters: Dict[str, Any]
    extracted_data: Dict[str, Any]
    error_message: Optional[str] = None
    execution_time_ms: float = 0
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class SkyvernClient:
    """
    Client for Skyvern browser automation service

    Features:
    - Async task submission and polling
    - Automatic retry with exponential backoff
    - Secure API key handling (from Docker secrets)
    - Health check monitoring
    - Detailed error reporting
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        timeout_seconds: int = 300,
        poll_interval_seconds: float = 2.0
    ):
        """
        Initialize Skyvern client

        Args:
            base_url: Skyvern service base URL
            api_key: API key (defaults to SKYVERN_API_KEY env var)
            timeout_seconds: Global timeout for task execution
            poll_interval_seconds: How often to poll for task status
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or self._load_api_key()
        self.timeout_seconds = timeout_seconds
        self.poll_interval = poll_interval_seconds

        if not self.api_key:
            logger.warning(
                "No Skyvern API key configured. "
                "Set SKYVERN_API_KEY environment variable or pass api_key parameter."
            )

    def _load_api_key(self) -> Optional[str]:
        """
        Load API key from environment or Docker secret

        Priority:
        1. SKYVERN_API_KEY environment variable
        2. SKYVERN_API_KEY_FILE (Docker secret path)
        3. /run/secrets/skyvern_api_key (default Docker secret location)
        """
        # Try environment variable
        api_key = os.getenv("SKYVERN_API_KEY")
        if api_key:
            return api_key

        # Try Docker secret file path from env
        secret_file = os.getenv("SKYVERN_API_KEY_FILE")
        if secret_file and Path(secret_file).exists():
            return Path(secret_file).read_text().strip()

        # Try default Docker secret location
        default_secret = Path("/run/secrets/skyvern_api_key")
        if default_secret.exists():
            return default_secret.read_text().strip()

        return None

    async def health_check(self) -> bool:
        """
        Check if Skyvern service is healthy

        Returns:
            True if healthy, False otherwise
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/health",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        logger.info("Skyvern health check: OK")
                        return True
                    else:
                        logger.warning(f"Skyvern health check failed: HTTP {resp.status}")
                        return False
        except Exception as e:
            logger.error(f"Skyvern health check error: {e}")
            return False

    async def run_task(
        self,
        task_file: str,
        parameters: Dict[str, Any],
        timeout_seconds: Optional[int] = None,
        max_retries: int = 2
    ) -> SkyvernTask:
        """
        Run a Skyvern task and wait for completion

        Args:
            task_file: Path to YAML task definition (relative to skyvern_tasks/)
            parameters: Task parameters (template variables)
            timeout_seconds: Task-specific timeout (overrides global)
            max_retries: Number of retries on failure

        Returns:
            SkyvernTask with results

        Raises:
            TimeoutError: Task exceeded timeout
            RuntimeError: Task failed after retries
            aiohttp.ClientError: Network/API errors
        """
        timeout = timeout_seconds or self.timeout_seconds

        for attempt in range(max_retries + 1):
            try:
                logger.info(
                    f"Running Skyvern task: {task_file} "
                    f"(attempt {attempt + 1}/{max_retries + 1})"
                )

                # Submit task
                task_id = await self._submit_task(task_file, parameters, timeout)

                # Poll for completion
                result = await self._poll_task(task_id, timeout)

                if result.status == SkyvernTaskStatus.COMPLETED:
                    logger.info(
                        f"Task {task_id} completed successfully in "
                        f"{result.execution_time_ms:.0f}ms"
                    )
                    return result
                elif result.status == SkyvernTaskStatus.FAILED:
                    error_msg = result.error_message or "Unknown error"
                    logger.warning(
                        f"Task {task_id} failed: {error_msg} "
                        f"(attempt {attempt + 1}/{max_retries + 1})"
                    )

                    if attempt < max_retries:
                        # Exponential backoff before retry
                        wait_time = 2 ** attempt
                        logger.info(f"Retrying in {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise RuntimeError(
                            f"Task failed after {max_retries + 1} attempts: {error_msg}"
                        )
                else:
                    raise RuntimeError(f"Unexpected task status: {result.status}")

            except TimeoutError as e:
                logger.error(f"Task {task_id if 'task_id' in locals() else 'unknown'} timed out: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                else:
                    raise
            except Exception as e:
                logger.error(f"Task execution error: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                else:
                    raise

    async def _submit_task(
        self,
        task_file: str,
        parameters: Dict[str, Any],
        timeout_seconds: int
    ) -> str:
        """
        Submit a task to Skyvern API

        Returns:
            Task ID
        """
        async with aiohttp.ClientSession() as session:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            payload = {
                "task_file": task_file,
                "parameters": parameters,
                "timeout_seconds": timeout_seconds
            }

            async with session.post(
                f"{self.base_url}/api/v1/tasks",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise RuntimeError(
                        f"Failed to submit task (HTTP {resp.status}): {error_text}"
                    )

                data = await resp.json()
                task_id = data.get("task_id")

                if not task_id:
                    raise RuntimeError(f"No task_id in response: {data}")

                logger.info(f"Task submitted: {task_id}")
                return task_id

    async def _poll_task(
        self,
        task_id: str,
        timeout_seconds: int
    ) -> SkyvernTask:
        """
        Poll task status until completion or timeout

        Returns:
            SkyvernTask with final status
        """
        start_time = asyncio.get_event_loop().time()

        async with aiohttp.ClientSession() as session:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            while True:
                # Check timeout
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > timeout_seconds:
                    raise TimeoutError(
                        f"Task {task_id} exceeded timeout ({timeout_seconds}s)"
                    )

                # Fetch task status
                async with session.get(
                    f"{self.base_url}/api/v1/tasks/{task_id}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        raise RuntimeError(
                            f"Failed to fetch task status (HTTP {resp.status}): {error_text}"
                        )

                    data = await resp.json()

                # Parse response
                status = SkyvernTaskStatus(data.get("status", "pending"))

                # Check if terminal state
                if status in [
                    SkyvernTaskStatus.COMPLETED,
                    SkyvernTaskStatus.FAILED,
                    SkyvernTaskStatus.TIMEOUT
                ]:
                    return SkyvernTask(
                        task_id=task_id,
                        status=status,
                        task_file=data.get("task_file", ""),
                        parameters=data.get("parameters", {}),
                        extracted_data=data.get("extracted_data", {}),
                        error_message=data.get("error_message"),
                        execution_time_ms=data.get("execution_time_ms", 0),
                        created_at=data.get("created_at"),
                        completed_at=data.get("completed_at")
                    )

                # Wait before next poll
                logger.debug(f"Task {task_id} status: {status}, polling again in {self.poll_interval}s")
                await asyncio.sleep(self.poll_interval)

    async def list_tasks(
        self,
        status: Optional[SkyvernTaskStatus] = None,
        limit: int = 100
    ) -> List[SkyvernTask]:
        """
        List recent tasks

        Args:
            status: Filter by status (None = all)
            limit: Maximum tasks to return

        Returns:
            List of SkyvernTask objects
        """
        async with aiohttp.ClientSession() as session:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            params = {"limit": limit}
            if status:
                params["status"] = status.value

            async with session.get(
                f"{self.base_url}/api/v1/tasks",
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise RuntimeError(
                        f"Failed to list tasks (HTTP {resp.status}): {error_text}"
                    )

                data = await resp.json()
                tasks = data.get("tasks", [])

                return [
                    SkyvernTask(
                        task_id=task["task_id"],
                        status=SkyvernTaskStatus(task["status"]),
                        task_file=task.get("task_file", ""),
                        parameters=task.get("parameters", {}),
                        extracted_data=task.get("extracted_data", {}),
                        error_message=task.get("error_message"),
                        execution_time_ms=task.get("execution_time_ms", 0),
                        created_at=task.get("created_at"),
                        completed_at=task.get("completed_at")
                    )
                    for task in tasks
                ]
