"""
Genesis Business Execution Engine

Core infrastructure for deploying autonomous businesses to production.

Components:
- BusinessExecutor: Main execution engine
- VercelClient: Vercel API client for deployments
- GitHubClient: GitHub API client for repository management
- DeploymentValidator: Health checks and validation

Usage:
    from infrastructure.execution import BusinessExecutor, BusinessExecutionConfig

    config = BusinessExecutionConfig(
        vercel_token=os.getenv("VERCEL_TOKEN"),
        vercel_team_id=os.getenv("VERCEL_TEAM_ID"),
        github_token=os.getenv("GITHUB_TOKEN"),
        mongodb_uri=os.getenv("MONGODB_URI")
    )

    executor = BusinessExecutor(config)
    result = await executor.execute_business(business_plan)
"""

from infrastructure.execution.business_executor import (
    BusinessExecutor,
    BusinessExecutionConfig,
    BusinessExecutionResult
)
from infrastructure.execution.vercel_client import (
    VercelClient,
    VercelProject,
    VercelDeployment,
    VercelAPIError
)
from infrastructure.execution.github_client import (
    GitHubClient,
    GitHubRepository,
    GitHubAPIError
)
from infrastructure.execution.deployment_validator import (
    DeploymentValidator,
    ValidationReport,
    ValidationResult
)

__all__ = [
    # Main executor
    "BusinessExecutor",
    "BusinessExecutionConfig",
    "BusinessExecutionResult",
    # Vercel
    "VercelClient",
    "VercelProject",
    "VercelDeployment",
    "VercelAPIError",
    # GitHub
    "GitHubClient",
    "GitHubRepository",
    "GitHubAPIError",
    # Validation
    "DeploymentValidator",
    "ValidationReport",
    "ValidationResult",
]
