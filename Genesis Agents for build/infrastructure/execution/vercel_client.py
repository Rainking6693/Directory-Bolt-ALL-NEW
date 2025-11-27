"""
Vercel API Client

Wrapper for Vercel REST API:
- Create projects
- Deploy from GitHub
- Configure domains
- Manage environment variables
- Monitor deployment status

Documentation: https://vercel.com/docs/rest-api
"""

import asyncio
import base64
import httpx
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class VercelProject:
    """Vercel project metadata."""
    id: str
    name: str
    framework: str
    created_at: datetime
    git_repository: Optional[Dict[str, Any]] = None


@dataclass
class VercelDeployment:
    """Vercel deployment metadata."""
    id: str
    url: str
    state: str  # BUILDING, READY, ERROR, CANCELED
    created_at: datetime
    project_id: str
    ready_state: Optional[str] = None


class VercelAPIError(Exception):
    """Vercel API error."""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class VercelClient:
    """
    Vercel REST API client.

    Handles all interactions with Vercel's deployment platform:
    - Project creation and management
    - Deployment triggering and monitoring
    - Domain configuration
    - Environment variable management
    - Health checks and status monitoring

    Documentation: https://vercel.com/docs/rest-api
    """

    def __init__(self, token: str, team_id: Optional[str] = None):
        """
        Initialize Vercel API client.

        Args:
            token: Vercel API token (from https://vercel.com/account/tokens)
            team_id: Optional team ID for team projects
        """
        self.token = token
        self.team_id = team_id
        self.base_url = "https://api.vercel.com"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def _build_url(self, path: str) -> str:
        """Build full API URL with optional team parameter."""
        url = f"{self.base_url}{path}"
        if self.team_id and "?" not in url:
            url += f"?teamId={self.team_id}"
        elif self.team_id:
            url += f"&teamId={self.team_id}"
        return url

    async def create_project(
        self,
        name: str,
        git_repository: Optional[Dict[str, Any]] = None,
        framework: str = "nextjs",
        environment_variables: Optional[List[Dict[str, Any]]] = None,
        build_command: Optional[str] = None,
        output_directory: Optional[str] = None,
        install_command: Optional[str] = None
    ) -> VercelProject:
        """
        Create a new Vercel project.

        Args:
            name: Project name (lowercase, alphanumeric, hyphens)
            git_repository: Git repository configuration
                {
                    "type": "github",
                    "repo": "username/repo-name"
                }
            framework: Framework preset (nextjs, react, vue, etc.)
            environment_variables: List of environment variables
                [
                    {
                        "key": "API_KEY",
                        "value": "secret",
                        "target": ["production", "preview", "development"]
                    }
                ]
            build_command: Custom build command
            output_directory: Custom output directory
            install_command: Custom install command

        Returns:
            VercelProject with project metadata

        Raises:
            VercelAPIError: If project creation fails
        """
        payload: Dict[str, Any] = {
            "name": name,
            "framework": framework
        }

        if git_repository:
            payload["gitRepository"] = git_repository

        if environment_variables:
            payload["environmentVariables"] = environment_variables

        if build_command:
            payload["buildCommand"] = build_command

        if output_directory:
            payload["outputDirectory"] = output_directory

        if install_command:
            payload["installCommand"] = install_command

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._build_url("/v9/projects"),
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

                if response.status_code == 201:
                    data = response.json()
                    logger.info(f"Created Vercel project: {name} (ID: {data['id']})")
                    return VercelProject(
                        id=data["id"],
                        name=data["name"],
                        framework=data.get("framework", framework),
                        created_at=datetime.fromtimestamp(data["createdAt"] / 1000),
                        git_repository=data.get("link")
                    )
                else:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise VercelAPIError(
                        f"Failed to create project: {error_msg}",
                        status_code=response.status_code,
                        response=error_data
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating project: {e}")
            raise VercelAPIError(f"HTTP error: {str(e)}")

    async def create_deployment(
        self,
        project_name: str,
        git_source: Optional[Dict[str, Any]] = None,
        target: str = "production"
    ) -> VercelDeployment:
        """
        Create a new deployment.

        Args:
            project_name: Name of the project to deploy
            git_source: Git source configuration
                {
                    "type": "github",
                    "ref": "main",
                    "repoId": "repo-id"
                }
            target: Deployment target (production, preview)

        Returns:
            VercelDeployment with deployment metadata

        Raises:
            VercelAPIError: If deployment creation fails
        """
        payload: Dict[str, Any] = {
            "name": project_name,
            "target": target
        }

        if git_source:
            payload["gitSource"] = git_source

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._build_url("/v13/deployments"),
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    logger.info(f"Created deployment: {data['id']} for project {project_name}")
                    return VercelDeployment(
                        id=data["id"],
                        url=data["url"],
                        state=data["readyState"],
                        created_at=datetime.fromtimestamp(data["createdAt"] / 1000),
                        project_id=data.get("projectId", ""),
                        ready_state=data.get("readyState")
                    )
                else:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise VercelAPIError(
                        f"Failed to create deployment: {error_msg}",
                        status_code=response.status_code,
                        response=error_data
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating deployment: {e}")
            raise VercelAPIError(f"HTTP error: {str(e)}")

    async def create_static_deployment(
        self,
        name: str,
        files: Dict[str, bytes],
        project_settings: Optional[Dict[str, Any]] = None,
        target: str = "production"
    ) -> VercelDeployment:
        """
        Create a static deployment from in-memory files.

        Args:
            name: Deployment (project) name
            files: Mapping of file paths -> bytes/str content
            project_settings: Optional projectSettings configuration
            target: Deployment target (default production)

        Returns:
            VercelDeployment metadata

        Raises:
            VercelAPIError: If deployment fails
        """
        payload: Dict[str, Any] = {
            "name": name,
            "target": target,
            "files": []
        }

        if project_settings:
            payload["projectSettings"] = project_settings

        for path, content in files.items():
            if isinstance(content, str):
                content_bytes = content.encode("utf-8")
            else:
                content_bytes = content
            payload["files"].append({
                "file": path,
                "data": base64.b64encode(content_bytes).decode("utf-8")
            })

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._build_url("/v13/deployments"),
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

            if response.status_code in (200, 201):
                data = response.json()
                logger.info(f"Created static deployment: {data['id']} for {name}")
                return VercelDeployment(
                    id=data["id"],
                    url=data["url"],
                    state=data["readyState"],
                    created_at=datetime.fromtimestamp(data["createdAt"] / 1000),
                    project_id=data.get("projectId", ""),
                    ready_state=data.get("readyState")
                )

            error_data = response.json()
            error_msg = error_data.get("error", {}).get("message", "Unknown error")
            raise VercelAPIError(
                f"Failed to create static deployment: {error_msg}",
                status_code=response.status_code,
                response=error_data
            )

        except httpx.HTTPError as exc:
            logger.error(f"HTTP error creating static deployment: {exc}")
            raise VercelAPIError(f"HTTP error: {exc}")

    async def get_deployment_status(self, deployment_id: str) -> VercelDeployment:
        """
        Get deployment status.

        Args:
            deployment_id: Deployment ID

        Returns:
            VercelDeployment with current status

        Raises:
            VercelAPIError: If status check fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._build_url(f"/v13/deployments/{deployment_id}"),
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return VercelDeployment(
                        id=data["id"],
                        url=data["url"],
                        state=data["readyState"],
                        created_at=datetime.fromtimestamp(data["createdAt"] / 1000),
                        project_id=data.get("projectId", ""),
                        ready_state=data.get("readyState")
                    )
                else:
                    raise VercelAPIError(
                        f"Failed to get deployment status",
                        status_code=response.status_code
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting deployment status: {e}")
            raise VercelAPIError(f"HTTP error: {str(e)}")

    async def wait_for_deployment(
        self,
        deployment_id: str,
        timeout_seconds: int = 300,
        poll_interval: int = 10
    ) -> str:
        """
        Wait for deployment to complete.

        Args:
            deployment_id: Deployment ID to monitor
            timeout_seconds: Maximum wait time (default 5 minutes)
            poll_interval: Seconds between status checks (default 10s)

        Returns:
            Deployment URL when ready

        Raises:
            VercelAPIError: If deployment fails or times out
        """
        start_time = asyncio.get_event_loop().time()

        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout_seconds:
                raise VercelAPIError(
                    f"Deployment timed out after {timeout_seconds}s",
                    status_code=None
                )

            deployment = await self.get_deployment_status(deployment_id)

            if deployment.ready_state == "READY":
                logger.info(f"Deployment ready: https://{deployment.url}")
                return f"https://{deployment.url}"
            elif deployment.ready_state == "ERROR":
                raise VercelAPIError(f"Deployment failed with ERROR state")
            elif deployment.ready_state == "CANCELED":
                raise VercelAPIError(f"Deployment was canceled")

            logger.debug(f"Deployment {deployment_id} state: {deployment.ready_state}, waiting...")
            await asyncio.sleep(poll_interval)

    async def configure_domain(
        self,
        project_id: str,
        domain: str
    ) -> Dict[str, Any]:
        """
        Add custom domain to project.

        Args:
            project_id: Project ID
            domain: Custom domain (e.g., example.com)

        Returns:
            Domain configuration details

        Raises:
            VercelAPIError: If domain configuration fails
        """
        payload = {
            "name": domain
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._build_url(f"/v10/projects/{project_id}/domains"),
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    logger.info(f"Configured domain {domain} for project {project_id}")
                    return data
                else:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise VercelAPIError(
                        f"Failed to configure domain: {error_msg}",
                        status_code=response.status_code,
                        response=error_data
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error configuring domain: {e}")
            raise VercelAPIError(f"HTTP error: {str(e)}")

    async def list_projects(self, limit: int = 20) -> List[VercelProject]:
        """
        List all projects in the account/team.

        Args:
            limit: Maximum number of projects to return

        Returns:
            List of VercelProject objects
        """
        try:
            async with httpx.AsyncClient() as client:
                url = self._build_url(f"/v9/projects")
                if "?" in url:
                    url += f"&limit={limit}"
                else:
                    url += f"?limit={limit}"

                response = await client.get(
                    url,
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    projects = []
                    for proj in data.get("projects", []):
                        projects.append(VercelProject(
                            id=proj["id"],
                            name=proj["name"],
                            framework=proj.get("framework", ""),
                            created_at=datetime.fromtimestamp(proj["createdAt"] / 1000),
                            git_repository=proj.get("link")
                        ))
                    return projects
                else:
                    raise VercelAPIError(
                        f"Failed to list projects",
                        status_code=response.status_code
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error listing projects: {e}")
            raise VercelAPIError(f"HTTP error: {str(e)}")

    async def delete_project(self, project_id: str) -> bool:
        """
        Delete a project.

        Args:
            project_id: Project ID to delete

        Returns:
            True if deletion successful

        Raises:
            VercelAPIError: If deletion fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    self._build_url(f"/v9/projects/{project_id}"),
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 204:
                    logger.info(f"Deleted project {project_id}")
                    return True
                else:
                    raise VercelAPIError(
                        f"Failed to delete project",
                        status_code=response.status_code
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error deleting project: {e}")
            raise VercelAPIError(f"HTTP error: {str(e)}")
