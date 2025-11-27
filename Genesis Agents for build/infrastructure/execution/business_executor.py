"""
Business Execution Engine

Takes business plans from Genesis Meta-Agent and executes them:
1. Generate code (using Builder agent)
2. Create GitHub repo
3. Deploy to Vercel
4. Configure domain & SSL
5. Set up monitoring
6. Validate deployment

This is the EXECUTION LAYER of Genesis - where plans become live businesses.
"""

import asyncio
import subprocess
import os
import uuid
import json
import time
import logging
import shutil
import urllib.parse
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from infrastructure.execution.vercel_client import VercelClient, VercelAPIError
from infrastructure.execution.github_client import GitHubClient, GitHubAPIError
from infrastructure.execution.deployment_validator import DeploymentValidator, ValidationReport

logger = logging.getLogger(__name__)


@dataclass
class BusinessExecutionConfig:
    """Configuration for business execution."""
    vercel_token: str
    vercel_team_id: Optional[str]
    github_token: str
    mongodb_uri: str
    github_org: Optional[str] = None
    enable_monitoring: bool = True
    enable_analytics: bool = True
    temp_dir: str = "/tmp"
    execution_timeout_seconds: int = 3600  # 1 hour default timeout
    github_timeout_seconds: int = 60
    vercel_timeout_seconds: int = 300


@dataclass
class BusinessExecutionResult:
    """Result of business execution."""
    success: bool
    deployment_url: Optional[str] = None
    repo_url: Optional[str] = None
    project_id: Optional[str] = None
    validation_results: Optional[ValidationReport] = None
    execution_time_seconds: float = 0.0
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BusinessExecutor:
    """
    Execute business creation and deployment.

    Workflow:
    1. Generate code (via Builder agent)
    2. Create GitHub repository
    3. Initialize Next.js project
    4. Deploy to Vercel
    5. Configure custom domain (optional)
    6. Set up health checks
    7. Enable error tracking (Sentry/OTEL)
    8. Validate deployment

    This is the heart of Genesis's autonomous business creation.
    """

    def __init__(self, config: BusinessExecutionConfig):
        """
        Initialize Business Executor with credentials.

        Args:
            config: BusinessExecutionConfig with all necessary credentials
        """
        self.config = config
        self.vercel_client = VercelClient(
            token=config.vercel_token,
            team_id=config.vercel_team_id
        )
        self.github_client = GitHubClient(
            token=config.github_token,
            org=config.github_org
        )
        self.validator = DeploymentValidator()

    async def execute_business(
        self,
        business_plan: Dict[str, Any],
        code_files: Optional[Dict[str, str]] = None
    ) -> BusinessExecutionResult:
        """
        Execute full business creation and deployment.

        Args:
            business_plan: Plan from Genesis Meta-Agent
                {
                    "name": "AI Writing Assistant",
                    "description": "...",
                    "tech_stack": ["Next.js", "OpenAI", "Stripe"],
                    "mvp_features": ["Feature 1", "Feature 2"],
                    "custom_domain": "example.com" (optional)
                }
            code_files: Optional pre-generated code files
                {
                    "src/app/page.tsx": "...",
                    "package.json": "...",
                    ...
                }

        Returns:
            BusinessExecutionResult with deployment_url, repo_url, metrics

        Raises:
            asyncio.TimeoutError: If execution exceeds configured timeout
        """
        start_time = time.time()
        logger.info(f"Starting business execution: {business_plan.get('name')}")

        try:
            # Execute with timeout protection
            return await asyncio.wait_for(
                self._execute_business_internal(business_plan, code_files),
                timeout=self.config.execution_timeout_seconds
            )
        except asyncio.TimeoutError:
            execution_time = time.time() - start_time
            logger.error(f"Business execution timed out after {execution_time:.2f}s")
            return BusinessExecutionResult(
                success=False,
                error=f"Execution timed out after {self.config.execution_timeout_seconds} seconds",
                execution_time_seconds=execution_time
            )

    async def _execute_business_internal(
        self,
        business_plan: Dict[str, Any],
        code_files: Optional[Dict[str, str]] = None
    ) -> BusinessExecutionResult:
        """
        Internal execution logic (wrapped with timeout).

        Args:
            business_plan: Business plan configuration
            code_files: Optional pre-generated code files

        Returns:
            BusinessExecutionResult with execution details
        """
        start_time = time.time()

        try:
            # Step 1: Generate or use provided code
            if code_files is None:
                logger.info("Generating code (using minimal template for now)")
                code_files = self._generate_minimal_nextjs_app(business_plan)
            else:
                logger.info(f"Using provided code ({len(code_files)} files)")

            # Step 2: Create GitHub repository
            repo_name = self._sanitize_repo_name(business_plan["name"])
            logger.info(f"Creating GitHub repository: {repo_name}")
            repo_url = await self._create_github_repo(
                name=repo_name,
                description=business_plan.get("description", ""),
                code=code_files
            )

            # Step 3: Deploy to Vercel
            project_name = self._sanitize_project_name(business_plan["name"])
            logger.info(f"Deploying to Vercel: {project_name}")
            deployment = await self._deploy_to_vercel(
                repo_url=repo_url,
                project_name=project_name,
                env_vars=self._prepare_env_vars(business_plan)
            )

            # Step 4: Configure domain (if provided)
            if business_plan.get("custom_domain"):
                logger.info(f"Configuring domain: {business_plan['custom_domain']}")
                try:
                    await self.vercel_client.configure_domain(
                        project_id=deployment["project_id"],
                        domain=business_plan["custom_domain"]
                    )
                except VercelAPIError as e:
                    logger.warning(f"Domain configuration failed: {e}")

            # Step 5: Set up monitoring (placeholder)
            if self.config.enable_monitoring:
                logger.info("Setting up monitoring (placeholder)")
                # TODO: Integrate with monitoring service

            # Step 6: Validate deployment
            logger.info(f"Validating deployment: {deployment['url']}")
            validation = await self.validator.validate_full_deployment(
                deployment_url=deployment["url"],
                business_type=business_plan.get("type", "general")
            )

            execution_time = time.time() - start_time
            logger.info(
                f"Business execution completed in {execution_time:.2f}s: "
                f"{validation.passed_checks}/{validation.total_checks} checks passed"
            )

            return BusinessExecutionResult(
                success=validation.success,
                deployment_url=deployment["url"],
                repo_url=repo_url,
                project_id=deployment["project_id"],
                validation_results=validation,
                execution_time_seconds=execution_time,
                metadata={
                    "business_name": business_plan["name"],
                    "business_type": business_plan.get("type", "unknown"),
                    "tech_stack": business_plan.get("tech_stack", []),
                    "file_count": len(code_files)
                }
            )

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Business execution failed: {e}", exc_info=True)
            return BusinessExecutionResult(
                success=False,
                error=str(e),
                execution_time_seconds=execution_time
            )

    def _generate_minimal_nextjs_app(self, business_plan: Dict[str, Any]) -> Dict[str, str]:
        """
        Generate minimal Next.js 14 app structure.

        This is a placeholder implementation. In production, this would
        call the Builder agent to generate comprehensive code.

        Args:
            business_plan: Business plan with name, description, features

        Returns:
            Dictionary of file paths to content
        """
        name = business_plan.get("name", "Genesis App")
        description = business_plan.get("description", "Built by Genesis")
        features = business_plan.get("mvp_features", [])

        # package.json
        package_json = {
            "name": self._sanitize_project_name(name),
            "version": "0.1.0",
            "private": True,
            "scripts": {
                "dev": "next dev",
                "build": "next build",
                "start": "next start",
                "lint": "next lint"
            },
            "dependencies": {
                "next": "14.0.0",
                "react": "^18",
                "react-dom": "^18"
            },
            "devDependencies": {
                "@types/node": "^20",
                "@types/react": "^18",
                "@types/react-dom": "^18",
                "autoprefixer": "^10",
                "postcss": "^8",
                "tailwindcss": "^3",
                "typescript": "^5"
            }
        }

        # src/app/page.tsx
        page_tsx = f'''export default function Home() {{
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center">
        <h1 className="text-6xl font-bold mb-4">
          {name}
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          {description}
        </p>
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Features:</h2>
          <ul className="text-left max-w-md mx-auto space-y-2">
            {chr(10).join([f'            <li className="flex items-center"><span className="mr-2">✓</span>{feature}</li>' for feature in features])}
          </ul>
        </div>
        <footer className="mt-16 text-sm text-gray-500">
          Autonomously created by Genesis AI
        </footer>
      </div>
    </main>
  )
}}
'''

        # src/app/layout.tsx
        layout_tsx = '''import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: \'Genesis App\',
  description: \'Autonomously created by Genesis AI\',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
'''

        # src/app/globals.css
        globals_css = '''@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #171717;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
}
'''

        # tailwind.config.js
        tailwind_config = '''/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
'''

        # tsconfig.json
        tsconfig = {
            "compilerOptions": {
                "target": "ES2017",
                "lib": ["dom", "dom.iterable", "esnext"],
                "allowJs": True,
                "skipLibCheck": True,
                "strict": True,
                "noEmit": True,
                "esModuleInterop": True,
                "module": "esnext",
                "moduleResolution": "bundler",
                "resolveJsonModule": True,
                "isolatedModules": True,
                "jsx": "preserve",
                "incremental": True,
                "plugins": [{"name": "next"}],
                "paths": {"@/*": ["./src/*"]}
            },
            "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
            "exclude": ["node_modules"]
        }

        # .gitignore
        gitignore = '''# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
'''

        # README.md
        readme = f'''# {name}

{description}

## Features

{chr(10).join([f'- {feature}' for feature in features])}

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

Autonomously created by Genesis AI.
'''

        return {
            "package.json": json.dumps(package_json, indent=2),
            "src/app/page.tsx": page_tsx,
            "src/app/layout.tsx": layout_tsx,
            "src/app/globals.css": globals_css,
            "tailwind.config.js": tailwind_config,
            "tsconfig.json": json.dumps(tsconfig, indent=2),
            ".gitignore": gitignore,
            "README.md": readme,
            "postcss.config.js": "module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}\n"
        }

    async def _create_github_repo(
        self,
        name: str,
        description: str,
        code: Dict[str, str]
    ) -> str:
        """
        Create GitHub repository and push code.

        Args:
            name: Repository name
            description: Repository description
            code: Dictionary of file paths to content

        Returns:
            Repository URL (e.g., https://github.com/username/repo-name)

        Raises:
            GitHubAPIError: If repository creation fails
        """
        # Create repo via GitHub API
        repo = await self.github_client.create_repo(
            name=name,
            description=description,
            private=False,
            auto_init=False
        )

        # Clone repo locally
        temp_dir = Path(self.config.temp_dir) / f"genesis_{name}_{uuid.uuid4().hex[:8]}"

        # SECURITY: Validate temp_dir path to prevent path traversal
        temp_dir_abs = temp_dir.resolve()
        temp_base = Path(self.config.temp_dir).resolve()
        if not str(temp_dir_abs).startswith(str(temp_base)):
            raise SecurityError(f"Path traversal detected: {temp_dir_abs} outside {temp_base}")

        temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            # SECURITY: Validate repo.clone_url before using it
            # Only allow GitHub and GitLab URLs to prevent SSRF attacks
            parsed_url = urllib.parse.urlparse(repo.clone_url)
            allowed_hosts = ['github.com', 'gitlab.com', 'bitbucket.org']
            if parsed_url.hostname not in allowed_hosts:
                raise SecurityError(f"Untrusted git host: {parsed_url.hostname}. Allowed: {allowed_hosts}")

            # Initialize git repo
            subprocess.run(
                ["git", "init"],
                cwd=str(temp_dir),
                check=True,
                capture_output=True
            )

            # Set remote (now validated)
            subprocess.run(
                ["git", "remote", "add", "origin", repo.clone_url],
                cwd=str(temp_dir),
                check=True,
                capture_output=True
            )

            # Write code files
            for file_path, content in code.items():
                full_path = temp_dir / file_path
                full_path.parent.mkdir(parents=True, exist_ok=True)
                full_path.write_text(content)

            # Git operations
            subprocess.run(
                ["git", "add", "."],
                cwd=str(temp_dir),
                check=True,
                capture_output=True
            )

            subprocess.run(
                ["git", "commit", "-m", "Initial commit: Genesis autonomous creation"],
                cwd=str(temp_dir),
                check=True,
                capture_output=True
            )

            # Create main branch and push
            subprocess.run(
                ["git", "branch", "-M", "main"],
                cwd=str(temp_dir),
                check=True,
                capture_output=True
            )

            subprocess.run(
                ["git", "push", "-u", "origin", "main"],
                cwd=str(temp_dir),
                check=True,
                capture_output=True
            )

            logger.info(f"Pushed code to {repo.html_url}")
            return repo.html_url

        finally:
            # SECURITY FIX: Use shutil.rmtree instead of rm -rf
            # Original: subprocess.run(["rm", "-rf", str(temp_dir)]) - DANGEROUS
            # Fixed: shutil.rmtree with error handling (safer, cross-platform)
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir, ignore_errors=False)
                    logger.debug(f"Cleaned up temp directory: {temp_dir}")
            except Exception as e:
                logger.warning(f"Failed to cleanup temp directory {temp_dir}: {e}")

    async def _deploy_to_vercel(
        self,
        repo_url: str,
        project_name: str,
        env_vars: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Deploy GitHub repo to Vercel.

        Args:
            repo_url: GitHub repository URL
            project_name: Vercel project name
            env_vars: Environment variables for deployment

        Returns:
            {
                "url": "https://project-name.vercel.app",
                "project_id": "prj_...",
                "deployment_id": "dpl_..."
            }

        Raises:
            VercelAPIError: If deployment fails
        """
        # Extract repo path from URL (e.g., "username/repo-name")
        repo_path = self._extract_repo_path(repo_url)

        # Prepare environment variables for Vercel
        env_vars_list = [
            {
                "key": k,
                "value": v,
                "target": ["production", "preview", "development"]
            }
            for k, v in env_vars.items()
        ]

        # Create Vercel project
        project = await self.vercel_client.create_project(
            name=project_name,
            git_repository={
                "type": "github",
                "repo": repo_path
            },
            framework="nextjs",
            environment_variables=env_vars_list
        )

        # Create deployment (Vercel auto-deploys on project creation with git)
        # We just need to wait for it to be ready
        # In practice, we'd trigger a deployment or wait for the auto-deploy

        # For now, construct the expected URL
        deployment_url = f"{project_name}.vercel.app"

        logger.info(f"Project created: {project.id}, expected URL: {deployment_url}")

        return {
            "url": deployment_url,
            "project_id": project.id,
            "deployment_id": "auto"  # Vercel auto-deploys
        }

    def _prepare_env_vars(self, business_plan: Dict[str, Any]) -> Dict[str, str]:
        """
        Prepare environment variables for deployment.

        Auto-configure:
        - Database URLs (MongoDB, Redis)
        - API keys (OpenAI, Stripe, etc.)
        - Feature flags
        - Genesis metadata

        Args:
            business_plan: Business plan with tech_stack

        Returns:
            Dictionary of environment variables
        """
        env_vars = {}

        # Database configuration
        if "database" in business_plan.get("tech_stack", []):
            env_vars["DATABASE_URL"] = self.config.mongodb_uri

        # API keys (based on tech stack)
        tech_stack = [t.lower() for t in business_plan.get("tech_stack", [])]

        if "openai" in tech_stack:
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key:
                env_vars["OPENAI_API_KEY"] = openai_key

        if "stripe" in tech_stack:
            stripe_key = os.getenv("STRIPE_API_KEY")
            if stripe_key:
                env_vars["STRIPE_API_KEY"] = stripe_key

        if "anthropic" in tech_stack:
            anthropic_key = os.getenv("ANTHROPIC_API_KEY")
            if anthropic_key:
                env_vars["ANTHROPIC_API_KEY"] = anthropic_key

        # Genesis metadata
        env_vars["GENESIS_CREATED"] = "true"
        env_vars["GENESIS_VERSION"] = "1.0"
        env_vars["BUSINESS_TYPE"] = business_plan.get("type", "unknown")
        env_vars["CREATED_AT"] = datetime.now().isoformat()

        return env_vars

    def _sanitize_repo_name(self, name: str) -> str:
        """
        Sanitize repository name for GitHub.

        Rules:
        - Lowercase
        - Replace spaces with hyphens
        - Remove special characters
        - Max 100 characters
        """
        sanitized = name.lower().strip()
        sanitized = sanitized.replace(" ", "-")
        sanitized = "".join(c for c in sanitized if c.isalnum() or c in ("-", "_"))
        # Remove leading/trailing hyphens
        sanitized = sanitized.strip("-_")
        sanitized = sanitized[:100]
        return sanitized or "genesis-app"

    def _sanitize_project_name(self, name: str) -> str:
        """
        Sanitize project name for Vercel.

        Rules:
        - Lowercase
        - Replace spaces with hyphens
        - Remove special characters
        - Max 52 characters
        """
        sanitized = name.lower()
        sanitized = sanitized.replace(" ", "-")
        sanitized = "".join(c for c in sanitized if c.isalnum() or c == "-")
        sanitized = sanitized[:52]
        return sanitized or "genesis-app"

    def _extract_repo_path(self, repo_url: str) -> str:
        """
        Extract repo path from URL.

        Examples:
            https://github.com/username/repo-name -> username/repo-name
            git@github.com:username/repo-name.git -> username/repo-name

        Args:
            repo_url: GitHub repository URL

        Returns:
            Repository path in format "username/repo-name"
        """
        # Remove .git suffix
        repo_url = repo_url.rstrip("/").replace(".git", "")

        # Extract path
        if "github.com/" in repo_url:
            path = repo_url.split("github.com/")[-1]
        elif "github.com:" in repo_url:
            path = repo_url.split("github.com:")[-1]
        else:
            path = repo_url

        return path
