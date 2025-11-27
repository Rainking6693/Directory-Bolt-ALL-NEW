"""
GitHub API Client

Wrapper for GitHub REST API:
- Create repositories
- Manage repository content
- Configure webhooks
- Access repository metadata

Documentation: https://docs.github.com/en/rest
"""

import httpx
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class GitHubRepository:
    """GitHub repository metadata."""
    id: int
    name: str
    full_name: str
    html_url: str
    clone_url: str
    ssh_url: str
    default_branch: str
    private: bool
    created_at: datetime


class GitHubAPIError(Exception):
    """GitHub API error."""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class GitHubClient:
    """
    GitHub REST API client.

    Handles all interactions with GitHub's API:
    - Repository creation and management
    - Content management
    - Webhook configuration
    - Metadata access

    Documentation: https://docs.github.com/en/rest
    """

    def __init__(self, token: str, org: Optional[str] = None):
        """
        Initialize GitHub API client.

        Args:
            token: GitHub personal access token
            org: Optional organization name (uses user account if not provided)
        """
        self.token = token
        self.org = org
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }

    async def create_repo(
        self,
        name: str,
        description: str,
        private: bool = False,
        auto_init: bool = False,
        gitignore_template: Optional[str] = None,
        license_template: Optional[str] = None
    ) -> GitHubRepository:
        """
        Create a new GitHub repository.

        Args:
            name: Repository name
            description: Repository description
            private: Whether repository should be private
            auto_init: Initialize repository with README
            gitignore_template: Gitignore template name (e.g., "Node", "Python")
            license_template: License template name (e.g., "mit", "apache-2.0")

        Returns:
            GitHubRepository with repository metadata

        Raises:
            GitHubAPIError: If repository creation fails
        """
        payload: Dict[str, Any] = {
            "name": name,
            "description": description,
            "private": private,
            "auto_init": auto_init
        }

        if gitignore_template:
            payload["gitignore_template"] = gitignore_template

        if license_template:
            payload["license_template"] = license_template

        # Determine endpoint (org vs user)
        if self.org:
            endpoint = f"/orgs/{self.org}/repos"
        else:
            endpoint = "/user/repos"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

                if response.status_code == 201:
                    data = response.json()
                    logger.info(f"Created GitHub repository: {data['full_name']}")
                    return GitHubRepository(
                        id=data["id"],
                        name=data["name"],
                        full_name=data["full_name"],
                        html_url=data["html_url"],
                        clone_url=data["clone_url"],
                        ssh_url=data["ssh_url"],
                        default_branch=data.get("default_branch", "main"),
                        private=data["private"],
                        created_at=datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
                    )
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", "Unknown error")
                    raise GitHubAPIError(
                        f"Failed to create repository: {error_msg}",
                        status_code=response.status_code,
                        response=error_data
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating repository: {e}")
            raise GitHubAPIError(f"HTTP error: {str(e)}")

    async def get_repo(self, owner: str, repo: str) -> GitHubRepository:
        """
        Get repository metadata.

        Args:
            owner: Repository owner (username or org)
            repo: Repository name

        Returns:
            GitHubRepository with repository metadata

        Raises:
            GitHubAPIError: If repository retrieval fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}",
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return GitHubRepository(
                        id=data["id"],
                        name=data["name"],
                        full_name=data["full_name"],
                        html_url=data["html_url"],
                        clone_url=data["clone_url"],
                        ssh_url=data["ssh_url"],
                        default_branch=data.get("default_branch", "main"),
                        private=data["private"],
                        created_at=datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
                    )
                else:
                    raise GitHubAPIError(
                        f"Failed to get repository",
                        status_code=response.status_code
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting repository: {e}")
            raise GitHubAPIError(f"HTTP error: {str(e)}")

    async def delete_repo(self, owner: str, repo: str) -> bool:
        """
        Delete a repository.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            True if deletion successful

        Raises:
            GitHubAPIError: If deletion fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/repos/{owner}/{repo}",
                    headers=self.headers,
                    timeout=30.0
                )

                if response.status_code == 204:
                    logger.info(f"Deleted repository {owner}/{repo}")
                    return True
                else:
                    raise GitHubAPIError(
                        f"Failed to delete repository",
                        status_code=response.status_code
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error deleting repository: {e}")
            raise GitHubAPIError(f"HTTP error: {str(e)}")

    async def create_webhook(
        self,
        owner: str,
        repo: str,
        url: str,
        events: list = None,
        secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a webhook for repository events.

        Args:
            owner: Repository owner
            repo: Repository name
            url: Webhook callback URL
            events: List of events to subscribe to (default: ["push"])
            secret: Optional webhook secret for verification

        Returns:
            Webhook configuration

        Raises:
            GitHubAPIError: If webhook creation fails
        """
        if events is None:
            events = ["push"]

        payload: Dict[str, Any] = {
            "name": "web",
            "active": True,
            "events": events,
            "config": {
                "url": url,
                "content_type": "json"
            }
        }

        if secret:
            payload["config"]["secret"] = secret

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/repos/{owner}/{repo}/hooks",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

                if response.status_code == 201:
                    data = response.json()
                    logger.info(f"Created webhook for {owner}/{repo}")
                    return data
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", "Unknown error")
                    raise GitHubAPIError(
                        f"Failed to create webhook: {error_msg}",
                        status_code=response.status_code,
                        response=error_data
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating webhook: {e}")
            raise GitHubAPIError(f"HTTP error: {str(e)}")

    async def update_file(
        self,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str = "main",
        sha: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create or update a file in the repository.

        Args:
            owner: Repository owner
            repo: Repository name
            path: File path in repository
            content: File content (will be base64 encoded)
            message: Commit message
            branch: Branch name
            sha: SHA of file being updated (required for updates)

        Returns:
            Commit metadata

        Raises:
            GitHubAPIError: If file update fails
        """
        import base64

        encoded_content = base64.b64encode(content.encode()).decode()

        payload: Dict[str, Any] = {
            "message": message,
            "content": encoded_content,
            "branch": branch
        }

        if sha:
            payload["sha"] = sha

        try:
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    logger.info(f"Updated file {path} in {owner}/{repo}")
                    return data
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", "Unknown error")
                    raise GitHubAPIError(
                        f"Failed to update file: {error_msg}",
                        status_code=response.status_code,
                        response=error_data
                    )

        except httpx.HTTPError as e:
            logger.error(f"HTTP error updating file: {e}")
            raise GitHubAPIError(f"HTTP error: {str(e)}")
