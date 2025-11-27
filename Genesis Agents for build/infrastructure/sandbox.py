"""
Sandbox - Safe Code Execution Environment
Infrastructure for Darwin Gödel Machine self-improvement

CRITICAL SAFETY COMPONENT: Isolates untrusted model-generated code

Features:
- Docker container isolation
- Resource limits (CPU, memory, time)
- Network isolation
- Read-only file systems where appropriate
- Automatic cleanup
- Comprehensive logging

Based on Darwin reference: github.com/jennyzzt/dgm/blob/main/utils/docker_utils.py
"""

import asyncio
import docker
import json
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from infrastructure import get_logger

logger = get_logger("sandbox")


class SandboxStatus(Enum):
    """Status of sandbox execution"""
    CREATED = "created"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    KILLED = "killed"


@dataclass
class SandboxResult:
    """Result from sandbox execution"""
    sandbox_id: str
    status: str  # SandboxStatus
    exit_code: int
    stdout: str
    stderr: str
    execution_time: float  # seconds
    resource_usage: Dict[str, Any]  # CPU, memory stats
    error_message: Optional[str] = None


class CodeSandbox:
    """
    Docker-based sandbox for safe execution of untrusted code

    Safety Guarantees:
    - Process isolation via Docker containers
    - Resource limits enforced (CPU, memory, time)
    - No network access by default
    - Cannot modify host filesystem
    - Automatic cleanup after execution

    Usage:
        sandbox = CodeSandbox()
        result = await sandbox.execute_code(
            code="print('hello')",
            timeout=10,
            memory_limit="512m"
        )
    """

    def __init__(
        self,
        base_image: str = "python:3.12-slim",
        docker_url: Optional[str] = None,
    ):
        """
        Initialize sandbox with Docker configuration

        Args:
            base_image: Docker base image to use
            docker_url: Docker daemon URL (None = use default)
        """
        self.base_image = base_image
        self.docker_client = docker.from_env() if not docker_url else docker.DockerClient(base_url=docker_url)

        # Verify Docker is available
        try:
            self.docker_client.ping()
            logger.info(f"Docker daemon connected: {self.docker_client.version()['Version']}")
        except Exception as e:
            logger.error(f"Docker daemon not available: {e}")
            raise RuntimeError("Docker is required for sandbox execution") from e

        # Ensure base image exists
        self._ensure_base_image()

    def _ensure_base_image(self):
        """Pull base image if not available locally"""
        try:
            self.docker_client.images.get(self.base_image)
            logger.info(f"Base image available: {self.base_image}")
        except docker.errors.ImageNotFound:
            logger.info(f"Pulling base image: {self.base_image}")
            self.docker_client.images.pull(self.base_image)
            logger.info("Base image pulled successfully")

    async def execute_code(
        self,
        code: str,
        timeout: int = 30,
        memory_limit: str = "512m",
        cpu_quota: int = 50000,  # 50% of one CPU core
        network_disabled: bool = True,
        working_dir: Optional[Path] = None,
        requirements: Optional[List[str]] = None,
    ) -> SandboxResult:
        """
        Execute Python code in isolated Docker sandbox

        Args:
            code: Python code to execute
            timeout: Maximum execution time in seconds
            memory_limit: Memory limit (e.g., "512m", "1g")
            cpu_quota: CPU quota in microseconds per 100ms period
            network_disabled: Disable network access
            working_dir: Working directory with additional files
            requirements: List of pip packages to install

        Returns:
            SandboxResult with execution output and status
        """
        sandbox_id = f"sandbox_{uuid.uuid4().hex[:12]}"
        container_name = f"genesis_{sandbox_id}"

        logger.info(f"🔒 Creating sandbox: {sandbox_id}")
        logger.info(f"Timeout: {timeout}s, Memory: {memory_limit}, Network: {'disabled' if network_disabled else 'enabled'}")

        # Create temporary directory for code
        temp_dir = Path(tempfile.mkdtemp(prefix=f"sandbox_{sandbox_id}_"))
        code_file = temp_dir / "code.py"
        code_file.write_text(code)

        # Create requirements file if needed
        if requirements:
            req_file = temp_dir / "requirements.txt"
            req_file.write_text("\n".join(requirements))

        start_time = time.time()
        container = None

        try:
            # Build container command
            cmd = ["python", "/workspace/code.py"]

            # Container configuration
            container_config = {
                "image": self.base_image,
                "command": cmd,
                "name": container_name,
                "detach": True,
                "mem_limit": memory_limit,
                "cpu_quota": cpu_quota,
                "cpu_period": 100000,  # 100ms period
                "network_disabled": network_disabled,
                "volumes": {
                    str(temp_dir): {"bind": "/workspace", "mode": "ro"},  # Read-only
                },
                "working_dir": "/workspace",
                "auto_remove": False,  # We'll remove manually after getting logs
            }

            # Install requirements if provided
            if requirements:
                logger.info(f"Installing requirements: {requirements}")
                # Create init container to install packages
                install_container = self.docker_client.containers.run(
                    image=self.base_image,
                    command=["pip", "install", "--no-cache-dir", "-r", "/workspace/requirements.txt"],
                    volumes={str(temp_dir): {"bind": "/workspace", "mode": "rw"}},
                    detach=True,
                    remove=True,
                )
                install_container.wait(timeout=60)

            # Create and start container
            logger.info("Starting container...")
            container = self.docker_client.containers.create(**container_config)
            container.start()

            # Wait for completion or timeout
            try:
                exit_code = container.wait(timeout=timeout)["StatusCode"]
                status = SandboxStatus.COMPLETED if exit_code == 0 else SandboxStatus.FAILED
            except Exception as e:
                logger.warning(f"Container timeout or error: {e}")
                container.kill()
                status = SandboxStatus.TIMEOUT
                exit_code = -1

            execution_time = time.time() - start_time

            # Get logs
            stdout = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
            stderr = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')

            # Get resource usage
            stats = container.stats(stream=False)
            resource_usage = {
                "memory_usage": stats["memory_stats"].get("usage", 0),
                "memory_limit": stats["memory_stats"].get("limit", 0),
                "cpu_usage": stats["cpu_stats"]["cpu_usage"].get("total_usage", 0),
            }

            logger.info(f"Sandbox complete: {status.value} (exit code: {exit_code}, time: {execution_time:.2f}s)")

            result = SandboxResult(
                sandbox_id=sandbox_id,
                status=status.value,
                exit_code=exit_code,
                stdout=stdout,
                stderr=stderr,
                execution_time=execution_time,
                resource_usage=resource_usage,
                error_message=stderr if exit_code != 0 else None,
            )

            return result

        except Exception as e:
            logger.error(f"Sandbox execution error: {e}", exc_info=True)
            execution_time = time.time() - start_time

            return SandboxResult(
                sandbox_id=sandbox_id,
                status=SandboxStatus.FAILED.value,
                exit_code=-1,
                stdout="",
                stderr=str(e),
                execution_time=execution_time,
                resource_usage={},
                error_message=str(e),
            )

        finally:
            # Cleanup
            if container:
                try:
                    container.remove(force=True)
                    logger.info(f"Container removed: {container_name}")
                except Exception as e:
                    logger.warning(f"Failed to remove container: {e}")

            # Remove temp directory
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to remove temp directory: {e}")

    async def execute_tests(
        self,
        code: str,
        test_code: str,
        timeout: int = 60,
    ) -> SandboxResult:
        """
        Execute code with tests in sandbox

        Args:
            code: Main code to test
            test_code: Test code (pytest format)
            timeout: Maximum execution time

        Returns:
            SandboxResult with test results
        """
        combined_code = f"""
# Main code
{code}

# Tests
{test_code}

# Run tests
if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
"""

        return await self.execute_code(
            code=combined_code,
            timeout=timeout,
            requirements=["pytest"],
        )

    async def validate_syntax(self, code: str) -> Tuple[bool, str]:
        """
        Validate Python syntax without execution

        Args:
            code: Python code to validate

        Returns:
            (valid: bool, error_message: str)
        """
        sandbox_id = f"syntax_{uuid.uuid4().hex[:8]}"
        temp_file = Path(f"/tmp/{sandbox_id}.py")

        try:
            temp_file.write_text(code)

            # Use py_compile for syntax check
            result = subprocess.run(
                ["python3", "-m", "py_compile", str(temp_file)],
                capture_output=True,
                text=True,
                timeout=5,
            )

            if result.returncode == 0:
                return True, ""
            else:
                return False, result.stderr

        except Exception as e:
            return False, str(e)

        finally:
            if temp_file.exists():
                temp_file.unlink()

    async def execute_file(
        self,
        file_path: Path,
        timeout: int = 30,
        **kwargs
    ) -> SandboxResult:
        """
        Execute Python file in sandbox

        Args:
            file_path: Path to Python file
            timeout: Maximum execution time
            **kwargs: Additional arguments for execute_code

        Returns:
            SandboxResult
        """
        code = file_path.read_text()
        return await self.execute_code(code=code, timeout=timeout, **kwargs)


# Convenience functions
_sandbox_instance = None


def get_sandbox() -> CodeSandbox:
    """Get singleton sandbox instance"""
    global _sandbox_instance
    if _sandbox_instance is None:
        _sandbox_instance = CodeSandbox()
    return _sandbox_instance


async def safe_execute(code: str, timeout: int = 30) -> SandboxResult:
    """
    Convenience function for safe code execution

    Example:
        result = await safe_execute("print('hello')")
        print(result.stdout)
    """
    sandbox = get_sandbox()
    return await sandbox.execute_code(code, timeout=timeout)


if __name__ == "__main__":
    # Test sandbox
    async def test_sandbox():
        sandbox = CodeSandbox()

        # Test 1: Simple execution
        print("Test 1: Simple execution")
        result = await sandbox.execute_code("print('Hello from sandbox!')")
        print(f"Status: {result.status}")
        print(f"Output: {result.stdout}")

        # Test 2: Syntax error
        print("\nTest 2: Syntax error")
        result = await sandbox.execute_code("print('missing paren'")
        print(f"Status: {result.status}")
        print(f"Error: {result.stderr}")

        # Test 3: Timeout
        print("\nTest 3: Timeout")
        result = await sandbox.execute_code("import time; time.sleep(100)", timeout=2)
        print(f"Status: {result.status}")

        # Test 4: Memory limit (this might not trigger in small test)
        print("\nTest 4: Memory usage")
        result = await sandbox.execute_code(
            "data = [0] * 10000000",  # ~76MB list
            memory_limit="100m"
        )
        print(f"Status: {result.status}")
        print(f"Memory used: {result.resource_usage.get('memory_usage', 0) / 1024 / 1024:.1f}MB")

        # Test 5: With requirements
        print("\nTest 5: With requirements")
        result = await sandbox.execute_code(
            "import requests; print(f'Requests version: {requests.__version__}')",
            requirements=["requests"],
            timeout=60
        )
        print(f"Status: {result.status}")
        print(f"Output: {result.stdout}")

    asyncio.run(test_sandbox())
