"""
Simple Deploy Wrapper for Genesis Agents

Wraps the simple deployment script for use by Genesis agents.
No Vercel - uses Railway (preferred), Render, PythonAnywhere, or GitHub Pages.

Author: Genesis Infrastructure
Date: November 12, 2025
Status: Production Ready
"""

import logging
import os
import subprocess
from pathlib import Path
from typing import Dict, Optional

from infrastructure.load_env import load_genesis_env

# Load environment
load_genesis_env()

logger = logging.getLogger(__name__)


class SimpleDeployWrapper:
    """Wrapper for simple deployment without Vercel"""

    def __init__(self):
        """Initialize wrapper"""
        self.default_platform = os.getenv("DEFAULT_DEPLOY_PLATFORM", "railway")
        self.disable_vercel = os.getenv("DISABLE_VERCEL_DEPLOY", "true").lower() == "true"

        if self.disable_vercel:
            logger.info("✅ Vercel deployment disabled (as requested)")

    def deploy_app(
        self,
        app_path: str,
        platform: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Deploy an application

        Args:
            app_path: Path to application directory
            platform: Deployment platform (optional, uses DEFAULT_DEPLOY_PLATFORM if not specified)

        Returns:
            Dictionary with deployment result
        """
        # Use default platform if not specified
        if platform is None:
            platform = self.default_platform

        # Block Vercel if disabled
        if platform.lower() == "vercel" and self.disable_vercel:
            logger.error("❌ Vercel deployment is disabled")
            return {
                "success": False,
                "error": "Vercel deployment disabled. Use railway, render, pythonanywhere, or github-pages instead.",
                "platform": platform
            }

        # Validate app path
        app_path_obj = Path(app_path)
        if not app_path_obj.exists():
            logger.error(f"❌ App path does not exist: {app_path}")
            return {
                "success": False,
                "error": f"App path does not exist: {app_path}",
                "platform": platform
            }

        logger.info(f"Deploying {app_path_obj.name} to {platform}...")

        # Run simple deploy script
        script_path = Path(__file__).parent.parent / "scripts" / "simple_deploy.py"

        try:
            result = subprocess.run(
                [
                    "python",
                    str(script_path),
                    "--path", str(app_path_obj),
                    "--platform", platform
                ],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                logger.info(f"✅ Deployment successful: {app_path_obj.name}")
                return {
                    "success": True,
                    "platform": platform,
                    "app_name": app_path_obj.name,
                    "output": result.stdout
                }
            else:
                logger.error(f"❌ Deployment failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr,
                    "platform": platform,
                    "output": result.stdout
                }

        except subprocess.TimeoutExpired:
            logger.error("❌ Deployment timed out (5 minutes)")
            return {
                "success": False,
                "error": "Deployment timed out after 5 minutes",
                "platform": platform
            }

        except Exception as e:
            logger.error(f"❌ Deployment exception: {e}")
            return {
                "success": False,
                "error": str(e),
                "platform": platform
            }

    def get_deployment_instructions(
        self,
        app_type: str = "nodejs"
    ) -> str:
        """
        Get deployment instructions for manual deployment

        Args:
            app_type: Application type (nodejs, python, static)

        Returns:
            Markdown-formatted deployment instructions
        """
        platform = self.default_platform

        instructions = f"""# Deployment Instructions

## Platform: {platform.upper()}

"""

        if platform == "railway":
            instructions += """### Railway Deployment (Recommended)

**Why Railway:**
- Automatic deployments from Git
- Built-in databases (PostgreSQL, Redis, MySQL)
- Simple CLI and web interface
- $5/month credit for free tier

**Quick Start:**
1. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```

2. Deploy your app:
   ```bash
   railway login
   railway init
   railway up
   ```

3. Open your deployed app:
   ```bash
   railway open
   ```

**Configuration:**
- Railway auto-detects your app type from `package.json` or `requirements.txt`
- Environment variables: Set in Railway dashboard or via `railway variables`
- Custom domains: Available on all plans

**Docs:** https://docs.railway.app
"""

        elif platform == "render":
            instructions += """### Render Deployment

**Why Render:**
- Free tier for static sites and web services
- Auto-deploy from GitHub
- Built-in SSL certificates
- PostgreSQL databases included

**Quick Start:**
1. Push your code to GitHub

2. Go to https://dashboard.render.com

3. Click "New" -> "Web Service"

4. Connect your GitHub repository

5. Render auto-detects build settings from `render.yaml`

**Configuration:**
- `render.yaml` file defines build/deploy settings
- Environment variables: Set in Render dashboard
- Free tier: 750 hours/month (enough for 1 app)

**Docs:** https://render.com/docs
"""

        elif platform == "pythonanywhere":
            instructions += """### PythonAnywhere Deployment

**Why PythonAnywhere:**
- Perfect for Python web apps
- Free tier available
- Easy MySQL/PostgreSQL setup
- Simple file upload interface

**Quick Start:**
1. Sign up at https://www.pythonanywhere.com

2. Get API token from Account -> API token

3. Run deployment script:
   ```bash
   python scripts/deploy_pythonanywhere.py --username YOUR_USERNAME --api-token YOUR_TOKEN
   ```

**OR use web interface:**
1. Go to "Web" tab -> "Add a new web app"
2. Choose "Manual configuration" -> Python 3.10
3. Upload your files
4. Configure WSGI file
5. Reload web app

**Docs:** https://help.pythonanywhere.com
"""

        elif platform == "github-pages":
            instructions += """### GitHub Pages Deployment

**Why GitHub Pages:**
- Free hosting for static sites
- Custom domains supported
- Automatic HTTPS
- Deploy directly from GitHub repo

**Quick Start:**
1. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO
   git push -u origin main
   ```

2. Go to repository Settings -> Pages

3. Select "Deploy from branch" -> "main" -> "/" (root)

4. Click "Save"

Your site will be at: `https://YOUR_USERNAME.github.io/YOUR_REPO`

**Docs:** https://pages.github.com
"""

        instructions += """
---

## Need Help?

Run the simple deploy script:
```bash
python scripts/simple_deploy.py --path YOUR_APP_PATH --platform {platform}
```

Change default platform in `.env`:
```bash
DEFAULT_DEPLOY_PLATFORM=railway  # or render, pythonanywhere, github-pages
```
"""

        return instructions


# Singleton instance
_wrapper_instance = None


def get_deploy_wrapper() -> SimpleDeployWrapper:
    """Get singleton deploy wrapper instance"""
    global _wrapper_instance
    if _wrapper_instance is None:
        _wrapper_instance = SimpleDeployWrapper()
    return _wrapper_instance


# Convenience functions
def deploy_app(app_path: str, platform: Optional[str] = None) -> Dict[str, any]:
    """Deploy an application (convenience function)"""
    wrapper = get_deploy_wrapper()
    return wrapper.deploy_app(app_path, platform)


def get_deployment_instructions(app_type: str = "nodejs") -> str:
    """Get deployment instructions (convenience function)"""
    wrapper = get_deploy_wrapper()
    return wrapper.get_deployment_instructions(app_type)
