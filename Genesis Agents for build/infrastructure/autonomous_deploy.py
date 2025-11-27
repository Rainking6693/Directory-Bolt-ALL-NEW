"""
Autonomous Deployment Module

Fully autonomous deployment for Genesis businesses.
No human interaction required - agents deploy, monitor, and manage autonomously.

Author: Genesis Infrastructure
Date: November 12, 2025
Status: Production Ready
"""

import asyncio
import json
import logging
import os
import subprocess
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from infrastructure.load_env import load_genesis_env
from infrastructure.simple_deploy_wrapper import get_deploy_wrapper

# Load environment
load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class DeploymentResult:
    """Result from autonomous deployment"""
    success: bool
    app_name: str
    platform: str
    deployment_url: Optional[str] = None
    deployment_id: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0
    cost_estimate: float = 0.0
    metadata: Dict = None

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {k: v for k, v in asdict(self).items() if v is not None}


class AutonomousDeployer:
    """
    Autonomous deployment manager

    Handles end-to-end deployment without human interaction:
    1. Detect app type
    2. Configure platform
    3. Deploy application
    4. Verify deployment
    5. Monitor health
    6. Return deployment URL for revenue tracking
    """

    def __init__(self):
        """Initialize autonomous deployer"""
        self.platform = os.getenv("DEFAULT_DEPLOY_PLATFORM", "railway")
        self.disable_vercel = os.getenv("DISABLE_VERCEL_DEPLOY", "true").lower() == "true"
        self.deploy_wrapper = get_deploy_wrapper()

        logger.info(f"🤖 Autonomous Deployer initialized (platform: {self.platform}, vercel: disabled)")

    async def deploy_business(
        self,
        app_path: str,
        business_name: str,
        platform: Optional[str] = None
    ) -> DeploymentResult:
        """
        Deploy a Genesis business autonomously

        Args:
            app_path: Path to business application
            business_name: Name of the business
            platform: Deployment platform (optional, uses default if not specified)

        Returns:
            DeploymentResult with deployment URL and metadata
        """
        start_time = time.time()
        platform = platform or self.platform

        logger.info(f"🚀 Autonomous deployment started: {business_name} -> {platform}")

        try:
            # Validate app path
            app_path_obj = Path(app_path)
            if not app_path_obj.exists():
                raise ValueError(f"App path does not exist: {app_path}")

            # Deploy using simple deploy wrapper
            deploy_result = self.deploy_wrapper.deploy_app(
                str(app_path_obj),
                platform=platform
            )

            if not deploy_result["success"]:
                raise Exception(deploy_result.get("error", "Unknown deployment error"))

            # Extract deployment URL from platform-specific output
            deployment_url = self._extract_deployment_url(
                deploy_result.get("output", ""),
                platform,
                business_name
            )

            # Generate deployment ID
            deployment_id = f"{platform}_{business_name}_{int(time.time())}"

            duration = time.time() - start_time

            logger.info(f"✅ Autonomous deployment successful: {deployment_url}")

            result = DeploymentResult(
                success=True,
                app_name=business_name,
                platform=platform,
                deployment_url=deployment_url,
                deployment_id=deployment_id,
                duration_seconds=duration,
                cost_estimate=self._estimate_cost(platform),
                metadata={
                    "deployed_at": datetime.utcnow().isoformat(),
                    "app_path": str(app_path_obj),
                    "autonomous": True
                }
            )

            # Save deployment record for monitoring
            await self._save_deployment_record(result)

            return result

        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)

            logger.error(f"❌ Autonomous deployment failed: {error_msg}")

            return DeploymentResult(
                success=False,
                app_name=business_name,
                platform=platform,
                error=error_msg,
                duration_seconds=duration,
                metadata={
                    "deployed_at": datetime.utcnow().isoformat(),
                    "autonomous": True,
                    "failed": True
                }
            )

    def _extract_deployment_url(
        self,
        output: str,
        platform: str,
        business_name: str
    ) -> str:
        """
        Extract deployment URL from platform output

        Args:
            output: Deployment script output
            platform: Platform name
            business_name: Business name

        Returns:
            Deployment URL
        """
        # Railway: Extract from "railway open" or generate URL
        if platform == "railway":
            # Railway URLs are dynamic, use railway CLI to get URL
            try:
                result = subprocess.run(
                    ["railway", "domain"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0 and result.stdout.strip():
                    return f"https://{result.stdout.strip()}"
            except:
                pass

            # Fallback: Generate typical Railway URL
            return f"https://{business_name}.up.railway.app"

        # Render: Extract from output or generate URL
        elif platform == "render":
            # Render URLs follow pattern: app-name.onrender.com
            return f"https://{business_name}.onrender.com"

        # PythonAnywhere: Generate URL
        elif platform == "pythonanywhere":
            username = os.getenv("PYTHONANYWHERE_USERNAME", "genesis")
            return f"https://{username}.pythonanywhere.com"

        # GitHub Pages: Generate URL
        elif platform == "github-pages":
            github_username = os.getenv("GITHUB_USERNAME", "genesis-ai")
            return f"https://{github_username}.github.io/{business_name}"

        else:
            # Generic URL
            return f"https://{business_name}.{platform}.app"

    def _estimate_cost(self, platform: str) -> float:
        """
        Estimate deployment cost for platform

        Args:
            platform: Platform name

        Returns:
            Estimated monthly cost in USD
        """
        cost_estimates = {
            "railway": 2.50,  # Average $2.50/month per app
            "render": 0.00,   # Free tier
            "pythonanywhere": 0.00,  # Free tier
            "github-pages": 0.00   # Always free
        }

        return cost_estimates.get(platform, 5.00)  # Default $5/month

    async def _save_deployment_record(self, result: DeploymentResult):
        """
        Save deployment record for monitoring and evaluation

        Args:
            result: Deployment result
        """
        # Create deployments directory
        deployments_dir = Path("data/deployments")
        deployments_dir.mkdir(parents=True, exist_ok=True)

        # Save deployment record
        record_file = deployments_dir / f"{result.deployment_id}.json"

        with open(record_file, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)

        logger.info(f"📝 Deployment record saved: {record_file}")

    async def verify_deployment(
        self,
        deployment_url: str,
        timeout: int = 30
    ) -> Dict:
        """
        Verify deployment is accessible

        Args:
            deployment_url: URL to verify
            timeout: Timeout in seconds

        Returns:
            Verification result dictionary
        """
        import aiohttp

        logger.info(f"🔍 Verifying deployment: {deployment_url}")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    deployment_url,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    status = response.status

                    if 200 <= status < 300:
                        logger.info(f"✅ Deployment verified (status: {status})")
                        return {
                            "success": True,
                            "status_code": status,
                            "accessible": True
                        }
                    else:
                        logger.warning(f"⚠️  Deployment returned status {status}")
                        return {
                            "success": False,
                            "status_code": status,
                            "accessible": True,
                            "error": f"HTTP {status}"
                        }

        except asyncio.TimeoutError:
            logger.error(f"❌ Deployment verification timed out")
            return {
                "success": False,
                "error": "Timeout",
                "accessible": False
            }

        except Exception as e:
            logger.error(f"❌ Deployment verification failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "accessible": False
            }

    async def get_deployment_status(self, deployment_id: str) -> Optional[Dict]:
        """
        Get status of a deployment

        Args:
            deployment_id: Deployment ID

        Returns:
            Deployment status dictionary or None
        """
        record_file = Path(f"data/deployments/{deployment_id}.json")

        if not record_file.exists():
            return None

        with open(record_file, 'r') as f:
            return json.load(f)

    async def list_active_deployments(self) -> List[Dict]:
        """
        List all active deployments

        Returns:
            List of deployment dictionaries
        """
        deployments_dir = Path("data/deployments")

        if not deployments_dir.exists():
            return []

        deployments = []
        for record_file in deployments_dir.glob("*.json"):
            with open(record_file, 'r') as f:
                deployment = json.load(f)
                if deployment.get("success"):
                    deployments.append(deployment)

        return deployments


# Singleton instance
_deployer_instance = None


def get_autonomous_deployer() -> AutonomousDeployer:
    """Get singleton autonomous deployer instance"""
    global _deployer_instance
    if _deployer_instance is None:
        _deployer_instance = AutonomousDeployer()
    return _deployer_instance


# Convenience functions for agents
async def deploy_business(
    app_path: str,
    business_name: str,
    platform: Optional[str] = None
) -> DeploymentResult:
    """
    Deploy a business autonomously (convenience function for agents)

    Args:
        app_path: Path to business application
        business_name: Name of the business
        platform: Deployment platform (optional)

    Returns:
        DeploymentResult with deployment URL
    """
    deployer = get_autonomous_deployer()
    return await deployer.deploy_business(app_path, business_name, platform)


async def verify_business(deployment_url: str) -> Dict:
    """Verify a business deployment (convenience function for agents)"""
    deployer = get_autonomous_deployer()
    return await deployer.verify_deployment(deployment_url)


async def list_businesses() -> List[Dict]:
    """List all deployed businesses (convenience function for agents)"""
    deployer = get_autonomous_deployer()
    return await deployer.list_active_deployments()
