"""
HopX Client Wrapper
===================

This module provides a high-level Python wrapper for HopX.  It intentionally
supports two execution modes:

1. **API mode**  – Uses the official HopX REST API (when credentials provided).
2. **Mock mode** – Creates local temporary directories that emulate HopX
   behaviour.  Useful for offline development and unit tests.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Union

import httpx

# REMOVED: Discord integration (integration disabled due to webhook errors)
# from infrastructure.genesis_discord import GenesisDiscord
from infrastructure.hopx_monitor import HopXMonitor, HopXEnvironmentRecord
from infrastructure.hopx_templates import HopXTemplate, get_template

FilePayload = Union[str, bytes, Dict[str, "FilePayload"]]

logger = logging.getLogger(__name__)


@dataclass
class HopXCommandResult:
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float

    @property
    def success(self) -> bool:
        return self.exit_code == 0


@dataclass
class HopXEnvironment:
    env_id: str
    business_id: str
    template: HopXTemplate
    workspace: Path
    created_at: float = field(default_factory=time.time)


class HopXClient:
    """High-level wrapper described in the integration plan."""

    def __init__(
        self,
        *,
        api_base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        monitor: Optional[HopXMonitor] = None,
        base_dir: Optional[Path] = None,
        timeout_seconds: float = 600.0,
    ):
        self.api_base_url = api_base_url or os.getenv("HOPX_API_BASE_URL")
        self.api_key = api_key or os.getenv("HOPX_API_KEY")
        self.timeout_seconds = timeout_seconds
        self.base_dir = Path(base_dir or Path(tempfile.gettempdir()) / "hopx_envs")
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.monitor = monitor or HopXMonitor()
        # Use mock mode when credentials are missing or explicitly requested
        use_fake = os.getenv("HOPX_USE_FAKE", "false").lower() in {"1", "true", "yes"}
        self.mock_mode = use_fake or not (self.api_base_url and self.api_key)
        self._client: Optional[httpx.AsyncClient] = None
        self._environments: Dict[str, HopXEnvironment] = {}

    async def _notify_environment_created(self, environment: HopXEnvironment) -> None:
        # REMOVED: Discord integration (integration disabled due to webhook errors)
        # discord = None
        # try:
        #     discord = GenesisDiscord()
        #     await discord.hopx_environment_created(
        #         environment.business_id, environment.env_id, environment.template.name
        #     )
        # except Exception as exc:
        #     logger.warning("Failed to notify Discord about HopX environment creation: %s", exc)
        # finally:
        #     if discord:
        #         await discord.close()
        pass  # Stub for removed Discord integration

    async def _notify_environment_destroyed(self, record: HopXEnvironmentRecord) -> None:
        # REMOVED: Discord integration (integration disabled due to webhook errors)
        # discord = None
        # try:
        #     discord = GenesisDiscord()
        #     await discord.hopx_environment_destroyed(
        #         record.business_id, record.env_id, record.lifetime_seconds
        #     )
        # except Exception as exc:
        #     logger.warning("Failed to notify Discord about HopX environment destruction: %s", exc)
        # finally:
        #     if discord:
        #         await discord.close()
        pass  # Stub for removed Discord integration

    async def _report_api_error(self, message: str) -> None:
        logger.error("HopX API error: %s", message)
        self.monitor.record_api_error(message)
        # REMOVED: Discord integration (integration disabled due to webhook errors)
        # discord = None
        # try:
        #     discord = GenesisDiscord()
        #     await discord.hopx_api_error(message)
        # except Exception as exc:
        #     logger.warning("HopX API error notification failed: %s", exc)
        # finally:
        #     if discord:
        #         await discord.close()

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self.mock_mode:
            raise RuntimeError("HTTP client not available in mock mode")
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.api_base_url,
                timeout=httpx.Timeout(self.timeout_seconds),
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
        return self._client

    def _workspace_for(self, env_id: str) -> Path:
        return self.base_dir / env_id

    # ------------------------------------------------------------------ #
    # Environment lifecycle
    # ------------------------------------------------------------------ #

    async def create_environment(
        self, business_id: str, *, template: str = "nodejs_environment"
    ) -> HopXEnvironment:
        tpl = get_template(template)
        env_id = f"hopx-{uuid.uuid4().hex[:10]}"
        workspace = self._workspace_for(env_id)
        workspace.mkdir(parents=True, exist_ok=True)

        if not self.mock_mode:
            client = await self._ensure_client()
            try:
                await client.post(
                    "/environments",
                    json={"environment": tpl.name, "business_id": business_id},
                )
            except httpx.HTTPError as exc:
                await self._report_api_error(
                    f"Failed to create HopX environment ({business_id}): {exc}"
                )
                raise

        environment = HopXEnvironment(
            env_id=env_id, business_id=business_id, template=tpl, workspace=workspace
        )
        self._environments[env_id] = environment
        self.monitor.record_created(env_id, business_id, template)
        await self._notify_environment_created(environment)
        return environment

    async def destroy_environment(self, env_id: str) -> Optional[HopXEnvironmentRecord]:
        env = self._environments.pop(env_id, None)
        if not env:
            return None

        if not self.mock_mode and self._client:
            try:
                await self._client.delete(f"/environments/{env_id}")
            except httpx.HTTPError as exc:
                await self._report_api_error(
                    f"Failed to destroy HopX environment ({env_id}): {exc}"
                )

        if env.workspace.exists():
            shutil.rmtree(env.workspace, ignore_errors=True)
        record = self.monitor.record_destroyed(env_id)
        if record:
            await self._notify_environment_destroyed(record)
        return record

    # ------------------------------------------------------------------ #
    # File management
    # ------------------------------------------------------------------ #

    def upload_files(self, env_id: str, files: Dict[str, FilePayload]) -> None:
        env = self._environments.get(env_id)
        if not env:
            raise KeyError(f"Environment {env_id} not found")
        for relative_path, payload in files.items():
            self._write_payload(env.workspace / relative_path, payload)

    def _write_payload(self, path: Path, payload: FilePayload) -> None:
        if isinstance(payload, dict):
            path.mkdir(parents=True, exist_ok=True)
            for child_name, child_payload in payload.items():
                self._write_payload(path / child_name, child_payload)
            return

        path.parent.mkdir(parents=True, exist_ok=True)
        mode = "wb" if isinstance(payload, bytes) else "w"
        with path.open(mode, encoding=None if isinstance(payload, bytes) else "utf-8") as handle:
            handle.write(payload)

    async def download_results(self, env_id: str, paths: Sequence[str]) -> Dict[str, str]:
        env = self._environments.get(env_id)
        if not env:
            raise KeyError(f"Environment {env_id} not found")
        result: Dict[str, str] = {}
        for relative_path in paths:
            abs_path = env.workspace / relative_path
            if abs_path.is_dir():
                result[relative_path] = json_directory_listing(abs_path)
            elif abs_path.exists():
                result[relative_path] = abs_path.read_text(encoding="utf-8", errors="ignore")
        return result

    # ------------------------------------------------------------------ #
    # Command execution
    # ------------------------------------------------------------------ #

    async def execute_command(
        self,
        env_id: str,
        command: str,
        *,
        timeout: Optional[float] = None,
    ) -> HopXCommandResult:
        env = self._environments.get(env_id)
        if not env:
            raise KeyError(f"Environment {env_id} not found")

        timeout = timeout or self.timeout_seconds
        start = time.time()

        if not self.mock_mode:
            client = await self._ensure_client()
            try:
                response = await client.post(
                    f"/environments/{env_id}/commands", json={"command": command, "timeout": timeout}
                )
            except httpx.HTTPError as exc:
                await self._report_api_error(
                    f"Failed to execute command in HopX environment ({env_id}): {exc}"
                )
                raise
            try:
                response.raise_for_status()
            except httpx.HTTPError as exc:
                await self._report_api_error(
                    f"HopX command failure ({env_id}): {exc}"
                )
                raise
            payload = response.json()
            return HopXCommandResult(
                command=command,
                exit_code=payload.get("exit_code", 0),
                stdout=payload.get("stdout", ""),
                stderr=payload.get("stderr", ""),
                duration_seconds=payload.get("duration", 0.0),
            )

        process = await asyncio.create_subprocess_shell(
            command,
            cwd=env.workspace,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            stdout_bytes, stderr_bytes = await process.communicate()
            raise TimeoutError(f"Command exceeded timeout ({timeout}s): {command}") from None
        finally:
            self.monitor.mark_heartbeat(env_id)

        duration = time.time() - start
        return HopXCommandResult(
            command=command,
            exit_code=process.returncode,
            stdout=stdout_bytes.decode("utf-8", errors="ignore"),
            stderr=stderr_bytes.decode("utf-8", errors="ignore"),
            duration_seconds=duration,
        )

    # ------------------------------------------------------------------ #
    # Context helpers
    # ------------------------------------------------------------------ #

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self._client:
            await self._client.aclose()


def json_directory_listing(path: Path) -> str:
    """Return a deterministic textual representation of a directory."""

    items: List[str] = []
    for item in sorted(path.rglob("*")):
        rel = item.relative_to(path)
        if item.is_dir():
            items.append(f"[DIR] {rel}")
        else:
            items.append(f"{rel} ({item.stat().st_size} bytes)")
    return "\n".join(items)


def run_sync(coro):
    """Allow synchronous scripts to call async HopX helpers."""

    return asyncio.get_event_loop().run_until_complete(coro)

