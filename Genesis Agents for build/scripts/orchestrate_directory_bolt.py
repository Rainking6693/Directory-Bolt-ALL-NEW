"""
Genesis Agents Orchestrator for Directory-Bolt Website

This script tells Genesis agents HOW to work on your Directory-Bolt website.
Agents don't automatically "activate" - they need instructions and coordination.

Usage:
    python scripts/orchestrate_directory_bolt.py --task <task_name>

Available tasks:
    - build_feature: Build a new feature
    - fix_bug: Fix a bug
    - optimize_seo: Run SEO optimization
    - audit_security: Security audit
    - add_billing: Add Stripe billing integration
"""

import asyncio
import sys
import os
from pathlib import Path

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path so we can import agents
sys.path.insert(0, str(Path(__file__).parent.parent))

from infrastructure.genesis_meta_agent import GenesisMetaAgent, BusinessSpec
from infrastructure.halo_router import HALORouter
from agents.billing_agent import BillingAgent
from agents.builder_agent import BuilderAgent
from agents.seo_agent import SEOAgent
from agents.security_agent import EnhancedSecurityAgent
from agents.qa_agent import QAAgent

# Directory-Bolt website root (go up two levels from this script)
DIRECTORY_BOLT_ROOT = Path(__file__).parent.parent.parent

class DirectoryBoltOrchestrator:
    """Orchestrates Genesis agents to work on Directory-Bolt website"""

    def __init__(self):
        self.router = HALORouter.create_with_integrations()
        self.genesis = GenesisMetaAgent()

        # Initialize specialized agents
        self.billing = BillingAgent()
        self.builder = BuilderAgent()
        self.seo = SEOAgent()
        self.security = EnhancedSecurityAgent()
        self.qa = QAAgent()

        print(f"📍 Working on Directory-Bolt at: {DIRECTORY_BOLT_ROOT}")
        print(f"✅ Loaded 26 Genesis agents")

    async def build_feature(self, feature_description: str):
        """Build a new feature for Directory-Bolt"""
        print(f"\n🏗️  Building feature: {feature_description}")

        # Step 1: Use Genesis Meta-Agent to plan the build
        spec = BusinessSpec(
            name="Directory-Bolt Feature",
            business_type="directory",
            description=feature_description,
            components=["component"],  # Will be auto-determined
            output_dir=DIRECTORY_BOLT_ROOT
        )

        print("\n📋 Genesis Meta-Agent is planning the build...")
        result = await self.genesis.generate_business(spec)

        if result.success:
            print(f"✅ Feature built successfully!")
            print(f"   Quality score: {result.quality_score}/100")
            print(f"   Components generated: {len(result.components)}")
        else:
            print(f"❌ Build failed: {result.errors}")

        return result

    async def add_billing_integration(self):
        """Add Stripe billing to Directory-Bolt"""
        print("\n💳 Setting up Stripe billing integration...")

        # Billing agent will create Stripe integration
        result = await self.billing.setup_stripe_billing(
            business_name="Directory-Bolt",
            pricing_tiers=[
                {"name": "Free", "price": 0, "features": ["Basic listings"]},
                {"name": "Pro", "price": 29, "features": ["Unlimited listings", "Featured placement"]},
                {"name": "Enterprise", "price": 99, "features": ["Custom domain", "API access"]}
            ],
            output_dir=str(DIRECTORY_BOLT_ROOT)
        )

        print(f"✅ Billing integration complete!")
        print(f"   Stripe components created: {result.get('components_created', [])}")

        return result

    async def optimize_seo(self):
        """Run SEO optimization on Directory-Bolt"""
        print("\n🔍 Running SEO optimization...")

        result = await self.seo.optimize_directory_seo(
            site_path=str(DIRECTORY_BOLT_ROOT),
            target_keywords=["AI directory", "AI tools", "AI agents marketplace"],
            competitors=["theresanaiforthat.com", "futuretools.io"]
        )

        print(f"✅ SEO optimization complete!")
        print(f"   Recommendations: {len(result.get('recommendations', []))}")

        return result

    async def audit_security(self):
        """Run security audit on Directory-Bolt"""
        print("\n🔒 Running security audit...")

        result = await self.security.audit_application(
            app_path=str(DIRECTORY_BOLT_ROOT),
            scan_types=["xss", "sql_injection", "auth", "api_security"]
        )

        print(f"✅ Security audit complete!")
        print(f"   Vulnerabilities found: {result.get('vulnerability_count', 0)}")
        print(f"   Critical: {result.get('critical', 0)}")
        print(f"   High: {result.get('high', 0)}")

        return result

    async def fix_bug(self, bug_description: str):
        """Fix a bug in Directory-Bolt"""
        print(f"\n🐛 Fixing bug: {bug_description}")

        # Step 1: QA agent reproduces the bug
        print("   QA Agent: Reproducing bug...")
        reproduction = await self.qa.reproduce_bug(
            bug_description=bug_description,
            repo_path=str(DIRECTORY_BOLT_ROOT)
        )

        if not reproduction.get('reproducible'):
            print("   ⚠️  Could not reproduce bug. Please provide more details.")
            return reproduction

        # Step 2: Builder agent fixes it
        print("   Builder Agent: Applying fix...")
        fix_result = await self.builder.fix_bug(
            bug_info=reproduction,
            repo_path=str(DIRECTORY_BOLT_ROOT)
        )

        # Step 3: QA agent verifies fix
        print("   QA Agent: Verifying fix...")
        verification = await self.qa.verify_fix(
            original_bug=bug_description,
            fix=fix_result,
            repo_path=str(DIRECTORY_BOLT_ROOT)
        )

        if verification.get('fixed'):
            print(f"✅ Bug fixed and verified!")
        else:
            print(f"⚠️  Fix applied but not fully verified")

        return verification

    async def generate_tests(self):
        """Generate tests for Directory-Bolt"""
        print("\n🧪 Generating tests...")

        result = await self.qa.generate_tests(
            repo_path=str(DIRECTORY_BOLT_ROOT),
            test_types=["unit", "integration", "e2e"]
        )

        print(f"✅ Tests generated!")
        print(f"   Test files created: {len(result.get('test_files', []))}")

        return result


async def main():
    """Main orchestration function"""
    import argparse

    parser = argparse.ArgumentParser(description="Orchestrate Genesis agents on Directory-Bolt")
    parser.add_argument("--task", required=True, choices=[
        "build_feature",
        "add_billing",
        "optimize_seo",
        "audit_security",
        "fix_bug",
        "generate_tests",
        "full_audit"  # NEW: Complete site audit
    ])
    parser.add_argument("--description", help="Description for build_feature or fix_bug tasks")

    args = parser.parse_args()

    # Initialize orchestrator
    orchestrator = DirectoryBoltOrchestrator()

    # Execute task
    if args.task == "build_feature":
        if not args.description:
            print("❌ Error: --description required for build_feature task")
            sys.exit(1)
        result = await orchestrator.build_feature(args.description)

    elif args.task == "add_billing":
        result = await orchestrator.add_billing_integration()

    elif args.task == "optimize_seo":
        result = await orchestrator.optimize_seo()

    elif args.task == "audit_security":
        result = await orchestrator.audit_security()

    elif args.task == "fix_bug":
        if not args.description:
            print("❌ Error: --description required for fix_bug task")
            sys.exit(1)
        result = await orchestrator.fix_bug(args.description)

    elif args.task == "generate_tests":
        result = await orchestrator.generate_tests()

    elif args.task == "full_audit":
        # Run the comprehensive audit script
        print("🔍 Running comprehensive site audit...")
        print("   This will read CLAUDE.md, find broken links, audit Render machines,")
        print("   identify database, debug backend communication, and more.\n")

        import subprocess
        audit_script = Path(__file__).parent / "full_site_audit.py"
        subprocess.run([sys.executable, str(audit_script)])
        return

    print(f"\n{'='*60}")
    print(f"✅ Task '{args.task}' completed!")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
