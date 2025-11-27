"""
Complete Directory-Bolt Site Audit & Debugging Script

This script will:
1. Read CLAUDE.md to understand the project
2. Find broken links and non-working features
3. Audit the 4 Render machines (worker, subscriber, server, brain)
4. Identify the database being used
5. Debug backend/staff dashboard communication issues
6. Map the customer signup → database → jobs → directory distribution flow

Usage:
    python scripts/full_site_audit.py --full-audit
"""

import asyncio
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from infrastructure.genesis_meta_agent import GenesisMetaAgent
from infrastructure.halo_router import HALORouter
from agents.security_agent import EnhancedSecurityAgent
from agents.qa_agent import QAAgent
from agents.analyst_agent import AnalystAgent
from agents.research_discovery_agent import ResearchDiscoveryAgent
from agents.reflection_agent import ReflectionAgent
from agents.builder_agent import BuilderAgent

# Directory-Bolt root
DIRECTORY_BOLT_ROOT = Path(__file__).parent.parent.parent
CLAUDE_MD_PATH = DIRECTORY_BOLT_ROOT / "CLAUDE.md"
BACKEND_PATH = DIRECTORY_BOLT_ROOT / "backend"
STAFF_DASHBOARD_PATH = DIRECTORY_BOLT_ROOT / "staff-dashboard"

class DirectoryBoltAuditor:
    """Complete audit system for Directory-Bolt"""

    def __init__(self):
        self.genesis = GenesisMetaAgent()
        self.security = EnhancedSecurityAgent()
        self.qa = QAAgent()
        self.analyst = AnalystAgent()
        self.researcher = ResearchDiscoveryAgent()
        self.reflection = ReflectionAgent()
        self.builder = BuilderAgent()

        self.audit_results = {
            "timestamp": datetime.now().isoformat(),
            "project_understanding": {},
            "broken_links": [],
            "non_working_features": [],
            "render_machines": {},
            "database_info": {},
            "backend_issues": {},
            "staff_dashboard_issues": {},
            "customer_flow": {},
            "recommendations": []
        }

        print(f"📍 Auditing Directory-Bolt at: {DIRECTORY_BOLT_ROOT}")

    async def read_claude_md(self):
        """Step 1: Read and understand CLAUDE.md"""
        print("\n" + "="*60)
        print("STEP 1: Reading CLAUDE.md to understand the project")
        print("="*60)

        if CLAUDE_MD_PATH.exists():
            with open(CLAUDE_MD_PATH, 'r', encoding='utf-8') as f:
                claude_content = f.read()

            print(f"✅ Found CLAUDE.md ({len(claude_content)} characters)")

            # Use Analyst Agent to extract key information
            understanding = await self.analyst.analyze_documentation(
                documentation=claude_content,
                focus_areas=[
                    "tech stack",
                    "architecture",
                    "database setup",
                    "deployment configuration",
                    "customer signup flow",
                    "render deployment details"
                ]
            )

            self.audit_results["project_understanding"] = understanding

            print("\n📋 Key Information Extracted:")
            print(f"   - Tech Stack: {understanding.get('tech_stack', 'Unknown')}")
            print(f"   - Database: {understanding.get('database', 'Unknown')}")
            print(f"   - Deployment: {understanding.get('deployment', 'Unknown')}")

            return understanding
        else:
            print("⚠️  CLAUDE.md not found. Will analyze codebase directly.")
            return await self.analyze_codebase_structure()

    async def analyze_codebase_structure(self):
        """Analyze codebase if CLAUDE.md doesn't exist"""
        print("\n🔍 Analyzing codebase structure...")

        structure = await self.researcher.analyze_codebase(
            root_path=str(DIRECTORY_BOLT_ROOT),
            focus_areas=[
                "package.json files",
                "database config files",
                ".env files",
                "render.yaml or deployment configs",
                "API route files"
            ]
        )

        return structure

    async def find_broken_links(self):
        """Step 2: Find all broken links on the site"""
        print("\n" + "="*60)
        print("STEP 2: Scanning for broken links")
        print("="*60)

        broken_links = await self.qa.scan_for_broken_links(
            site_path=str(DIRECTORY_BOLT_ROOT),
            check_external=True,
            check_internal=True
        )

        self.audit_results["broken_links"] = broken_links

        if broken_links:
            print(f"❌ Found {len(broken_links)} broken links:")
            for link in broken_links[:5]:  # Show first 5
                print(f"   - {link['url']} (found in {link['file']})")
            if len(broken_links) > 5:
                print(f"   ... and {len(broken_links) - 5} more")
        else:
            print("✅ No broken links found")

        return broken_links

    async def test_all_features(self):
        """Step 3: Test all features to find what's not working"""
        print("\n" + "="*60)
        print("STEP 3: Testing all features")
        print("="*60)

        # Test critical features
        features_to_test = [
            "User signup",
            "Package purchase",
            "Payment processing",
            "Database writes",
            "Job creation",
            "Directory distribution",
            "Staff dashboard access",
            "Backend API endpoints"
        ]

        non_working = []

        for feature in features_to_test:
            print(f"\n   Testing: {feature}")
            result = await self.qa.test_feature(
                feature_name=feature,
                app_path=str(DIRECTORY_BOLT_ROOT)
            )

            if not result.get('working', True):
                non_working.append({
                    "feature": feature,
                    "error": result.get('error'),
                    "details": result.get('details')
                })
                print(f"   ❌ FAILED: {result.get('error')}")
            else:
                print(f"   ✅ PASSED")

        self.audit_results["non_working_features"] = non_working
        return non_working

    async def audit_render_machines(self):
        """Step 4: Audit the 4 Render machines"""
        print("\n" + "="*60)
        print("STEP 4: Auditing Render Deployment (Worker, Subscriber, Server, Brain)")
        print("="*60)

        # Look for render.yaml or deployment configs
        render_configs = []
        for file in DIRECTORY_BOLT_ROOT.rglob("render.yaml"):
            render_configs.append(file)
        for file in DIRECTORY_BOLT_ROOT.rglob("render.yml"):
            render_configs.append(file)

        if render_configs:
            print(f"✅ Found {len(render_configs)} Render config files")
            for config_file in render_configs:
                print(f"   📄 {config_file.relative_to(DIRECTORY_BOLT_ROOT)}")

                with open(config_file, 'r') as f:
                    config_content = f.read()

                # Analyze the configuration
                analysis = await self.analyst.analyze_render_config(
                    config_content=config_content
                )

                self.audit_results["render_machines"][str(config_file)] = analysis

                print(f"\n   🔍 Analysis:")
                print(f"      Services: {analysis.get('services', [])}")
                print(f"      Databases: {analysis.get('databases', [])}")
                print(f"      Environment vars: {len(analysis.get('env_vars', []))}")

        else:
            print("⚠️  No render.yaml found. Checking for other deployment configs...")

            # Check for Dockerfile, docker-compose.yml, etc.
            docker_files = list(DIRECTORY_BOLT_ROOT.rglob("Dockerfile")) + \
                          list(DIRECTORY_BOLT_ROOT.rglob("docker-compose.yml"))

            if docker_files:
                print(f"✅ Found Docker configs: {len(docker_files)} files")
                for df in docker_files:
                    print(f"   📄 {df.relative_to(DIRECTORY_BOLT_ROOT)}")

        # Check backend for deployment info
        await self.check_backend_deployment_config()

        return self.audit_results["render_machines"]

    async def check_backend_deployment_config(self):
        """Check backend folder for deployment configuration"""
        print("\n   🔍 Checking backend deployment configuration...")

        if BACKEND_PATH.exists():
            # Look for common config files
            config_files = [
                BACKEND_PATH / "config.py",
                BACKEND_PATH / "settings.py",
                BACKEND_PATH / "config" / "production.py",
                BACKEND_PATH / ".env.example",
                BACKEND_PATH / "package.json"
            ]

            for config_file in config_files:
                if config_file.exists():
                    print(f"      ✅ Found: {config_file.name}")

                    # Read and analyze
                    with open(config_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    # Look for Render-specific settings
                    if "render" in content.lower():
                        print(f"         🎯 Contains Render configuration")

                    # Look for database URLs
                    if "database" in content.lower() or "db_url" in content.lower():
                        print(f"         💾 Contains database configuration")

    async def identify_database(self):
        """Step 5: Identify which database is being used"""
        print("\n" + "="*60)
        print("STEP 5: Identifying Database")
        print("="*60)

        databases_found = []

        # Check for database-related files
        db_indicators = {
            "prisma": ["schema.prisma", "prisma/"],
            "supabase": [".supabase/", "supabase/"],
            "postgres": ["pg_", "postgres", "psql"],
            "mongodb": ["mongoose", "mongodb://"],
            "sqlite": [".db", ".sqlite"],
            "mysql": ["mysql", "mariadb"]
        }

        # Scan codebase
        for db_type, indicators in db_indicators.items():
            for indicator in indicators:
                files = list(DIRECTORY_BOLT_ROOT.rglob(f"*{indicator}*"))
                if files:
                    databases_found.append({
                        "type": db_type,
                        "files": [str(f.relative_to(DIRECTORY_BOLT_ROOT)) for f in files[:5]]
                    })
                    print(f"   🔍 Found {db_type} indicators:")
                    for f in files[:3]:
                        print(f"      - {f.relative_to(DIRECTORY_BOLT_ROOT)}")

        # Check environment files for DATABASE_URL
        env_files = list(DIRECTORY_BOLT_ROOT.rglob(".env*"))
        for env_file in env_files:
            if env_file.is_file():
                try:
                    with open(env_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if "DATABASE_URL" in content or "DB_URL" in content:
                            print(f"\n   💾 Found database URL in: {env_file.name}")
                            # Extract database type from URL
                            if "postgresql://" in content or "postgres://" in content:
                                print(f"      → PostgreSQL")
                                databases_found.append({"type": "postgresql", "source": env_file.name})
                            elif "mongodb://" in content or "mongodb+srv://" in content:
                                print(f"      → MongoDB")
                                databases_found.append({"type": "mongodb", "source": env_file.name})
                            elif "mysql://" in content:
                                print(f"      → MySQL")
                                databases_found.append({"type": "mysql", "source": env_file.name})
                except Exception as e:
                    print(f"      ⚠️  Could not read {env_file.name}: {e}")

        # Check package.json for database dependencies
        package_files = list(DIRECTORY_BOLT_ROOT.rglob("package.json"))
        for pkg_file in package_files:
            try:
                with open(pkg_file, 'r', encoding='utf-8') as f:
                    pkg_data = json.load(f)
                    deps = {**pkg_data.get('dependencies', {}), **pkg_data.get('devDependencies', {})}

                    db_packages = {
                        "pg": "PostgreSQL",
                        "postgres": "PostgreSQL",
                        "@supabase/supabase-js": "Supabase (PostgreSQL)",
                        "mongodb": "MongoDB",
                        "mongoose": "MongoDB",
                        "mysql2": "MySQL",
                        "prisma": "Prisma ORM",
                        "@prisma/client": "Prisma ORM"
                    }

                    for pkg, db_name in db_packages.items():
                        if pkg in deps:
                            print(f"   📦 Found package: {pkg} ({db_name})")
                            databases_found.append({"type": db_name, "source": f"package.json - {pkg}"})

            except Exception as e:
                continue

        self.audit_results["database_info"] = {
            "databases_found": databases_found,
            "primary_database": databases_found[0] if databases_found else "Unknown"
        }

        if databases_found:
            print(f"\n✅ Identified {len(set([db['type'] for db in databases_found]))} database type(s)")
        else:
            print(f"\n⚠️  Could not identify database. Manual inspection needed.")

        return databases_found

    async def debug_backend_communication(self):
        """Step 6: Debug backend/staff dashboard communication"""
        print("\n" + "="*60)
        print("STEP 6: Debugging Backend ↔ Staff Dashboard Communication")
        print("="*60)

        issues = []

        # Check if staff dashboard exists
        if not STAFF_DASHBOARD_PATH.exists():
            print("⚠️  Staff dashboard path not found. Searching...")
            possible_paths = [
                DIRECTORY_BOLT_ROOT / "dashboard",
                DIRECTORY_BOLT_ROOT / "admin",
                DIRECTORY_BOLT_ROOT / "staff",
                DIRECTORY_BOLT_ROOT / "admin-dashboard"
            ]
            for path in possible_paths:
                if path.exists():
                    STAFF_DASHBOARD_PATH = path
                    print(f"✅ Found staff dashboard at: {path.relative_to(DIRECTORY_BOLT_ROOT)}")
                    break

        # Check backend API endpoints
        print("\n   🔍 Checking backend API endpoints...")
        api_files = list(BACKEND_PATH.rglob("*route*.py")) + \
                   list(BACKEND_PATH.rglob("*api*.py")) + \
                   list(BACKEND_PATH.rglob("*router*.py"))

        if api_files:
            print(f"   ✅ Found {len(api_files)} API files")
            for api_file in api_files[:5]:
                print(f"      - {api_file.relative_to(DIRECTORY_BOLT_ROOT)}")
        else:
            issues.append({
                "type": "missing_api_files",
                "severity": "high",
                "message": "No API route files found in backend"
            })

        # Check CORS configuration
        print("\n   🔍 Checking CORS configuration...")
        cors_check = await self.security.check_cors_config(
            backend_path=str(BACKEND_PATH)
        )

        if not cors_check.get('configured', False):
            issues.append({
                "type": "cors_not_configured",
                "severity": "critical",
                "message": "CORS not configured - staff dashboard cannot communicate with backend"
            })
            print("   ❌ CORS not configured properly")
        else:
            print("   ✅ CORS configured")

        # Check API base URL configuration
        print("\n   🔍 Checking API base URL in staff dashboard...")
        if STAFF_DASHBOARD_PATH.exists():
            config_files = list(STAFF_DASHBOARD_PATH.rglob("*config*.js")) + \
                          list(STAFF_DASHBOARD_PATH.rglob("*config*.ts")) + \
                          list(STAFF_DASHBOARD_PATH.rglob(".env*"))

            api_url_found = False
            for config_file in config_files:
                try:
                    with open(config_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if "API_URL" in content or "BACKEND_URL" in content or "BASE_URL" in content:
                            api_url_found = True
                            print(f"   ✅ Found API URL config in: {config_file.name}")
                            break
                except:
                    continue

            if not api_url_found:
                issues.append({
                    "type": "api_url_not_configured",
                    "severity": "critical",
                    "message": "API URL not configured in staff dashboard"
                })
                print("   ❌ API URL not configured in staff dashboard")

        self.audit_results["backend_issues"] = issues
        return issues

    async def map_customer_flow(self):
        """Step 7: Map the customer signup → purchase → database → jobs → distribution flow"""
        print("\n" + "="*60)
        print("STEP 7: Mapping Customer Flow")
        print("="*60)
        print("   📋 Tracing: Signup → Purchase → Database → Jobs → Distribution")

        flow_map = {
            "signup": {},
            "purchase": {},
            "database_write": {},
            "jobs_database": {},
            "distribution": {}
        }

        # Find signup code
        print("\n   1️⃣ Finding signup implementation...")
        signup_files = []
        for pattern in ["*signup*", "*register*", "*auth*"]:
            signup_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".py"))
            signup_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".js"))
            signup_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".ts"))

        if signup_files:
            print(f"      ✅ Found {len(signup_files)} signup-related files")
            flow_map["signup"]["files"] = [str(f.relative_to(DIRECTORY_BOLT_ROOT)) for f in signup_files[:3]]

        # Find payment/purchase code
        print("\n   2️⃣ Finding payment/purchase implementation...")
        payment_files = []
        for pattern in ["*payment*", "*checkout*", "*stripe*", "*purchase*"]:
            payment_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".py"))
            payment_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".js"))
            payment_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".ts"))

        if payment_files:
            print(f"      ✅ Found {len(payment_files)} payment-related files")
            flow_map["purchase"]["files"] = [str(f.relative_to(DIRECTORY_BOLT_ROOT)) for f in payment_files[:3]]

        # Find job/queue system
        print("\n   3️⃣ Finding jobs/queue system...")
        job_files = []
        for pattern in ["*job*", "*queue*", "*worker*", "*task*"]:
            job_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".py"))
            job_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".js"))
            job_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".ts"))

        if job_files:
            print(f"      ✅ Found {len(job_files)} job/queue-related files")
            flow_map["jobs_database"]["files"] = [str(f.relative_to(DIRECTORY_BOLT_ROOT)) for f in job_files[:3]]

        # Find distribution logic
        print("\n   4️⃣ Finding directory distribution logic...")
        distribution_files = []
        for pattern in ["*distribution*", "*distribute*", "*listing*", "*publish*"]:
            distribution_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".py"))
            distribution_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".js"))
            distribution_files.extend(DIRECTORY_BOLT_ROOT.rglob(pattern + ".ts"))

        if distribution_files:
            print(f"      ✅ Found {len(distribution_files)} distribution-related files")
            flow_map["distribution"]["files"] = [str(f.relative_to(DIRECTORY_BOLT_ROOT)) for f in distribution_files[:3]]

        self.audit_results["customer_flow"] = flow_map
        return flow_map

    async def generate_recommendations(self):
        """Step 8: Generate actionable recommendations"""
        print("\n" + "="*60)
        print("STEP 8: Generating Recommendations")
        print("="*60)

        recommendations = []

        # Use Reflection Agent to analyze all findings
        analysis = await self.reflection.analyze_audit_results(
            audit_results=self.audit_results
        )

        recommendations.extend(analysis.get('recommendations', []))

        # Add specific recommendations based on findings
        if self.audit_results["backend_issues"]:
            recommendations.append({
                "priority": "CRITICAL",
                "issue": "Backend Communication Issues",
                "action": "Fix CORS, API URL configuration, and endpoint connectivity",
                "estimated_time": "2-4 hours"
            })

        if not self.audit_results["database_info"].get("databases_found"):
            recommendations.append({
                "priority": "HIGH",
                "issue": "Database Not Identified",
                "action": "Manually check Render dashboard for database service details",
                "estimated_time": "30 minutes"
            })

        if len(self.audit_results["render_machines"]) == 0:
            recommendations.append({
                "priority": "HIGH",
                "issue": "Render Configuration Missing",
                "action": "Access Render dashboard to export service configurations",
                "estimated_time": "1 hour"
            })

        self.audit_results["recommendations"] = recommendations

        print("\n📋 TOP RECOMMENDATIONS:")
        for i, rec in enumerate(recommendations[:5], 1):
            print(f"\n{i}. [{rec.get('priority', 'MEDIUM')}] {rec.get('issue')}")
            print(f"   Action: {rec.get('action')}")
            print(f"   Time: {rec.get('estimated_time', 'Unknown')}")

        return recommendations

    async def save_audit_report(self):
        """Save complete audit report to file"""
        report_path = DIRECTORY_BOLT_ROOT / "AUDIT_REPORT.json"

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.audit_results, f, indent=2)

        print(f"\n💾 Full audit report saved to: AUDIT_REPORT.json")

        # Also create a human-readable markdown report
        md_report_path = DIRECTORY_BOLT_ROOT / "AUDIT_REPORT.md"
        await self.create_markdown_report(md_report_path)

        print(f"📄 Readable report saved to: AUDIT_REPORT.md")

    async def create_markdown_report(self, path):
        """Create human-readable markdown report"""
        with open(path, 'w', encoding='utf-8') as f:
            f.write("# Directory-Bolt Complete Audit Report\n\n")
            f.write(f"**Generated:** {self.audit_results['timestamp']}\n\n")

            f.write("## 🔍 Executive Summary\n\n")

            # Summary stats
            f.write(f"- **Broken Links:** {len(self.audit_results['broken_links'])}\n")
            f.write(f"- **Non-Working Features:** {len(self.audit_results['non_working_features'])}\n")
            f.write(f"- **Backend Issues:** {len(self.audit_results['backend_issues'])}\n")
            f.write(f"- **Database Identified:** {'Yes' if self.audit_results['database_info'].get('databases_found') else 'No'}\n")
            f.write(f"- **Recommendations:** {len(self.audit_results['recommendations'])}\n\n")

            # Detailed sections
            f.write("## 📋 Detailed Findings\n\n")

            if self.audit_results["broken_links"]:
                f.write("### Broken Links\n\n")
                for link in self.audit_results["broken_links"][:10]:
                    f.write(f"- `{link.get('url')}` (in {link.get('file')})\n")
                f.write("\n")

            if self.audit_results["database_info"].get("databases_found"):
                f.write("### Database Information\n\n")
                for db in self.audit_results["database_info"]["databases_found"]:
                    f.write(f"- **Type:** {db.get('type')}\n")
                    if db.get('source'):
                        f.write(f"  - Source: {db.get('source')}\n")
                f.write("\n")

            if self.audit_results["backend_issues"]:
                f.write("### Backend Communication Issues\n\n")
                for issue in self.audit_results["backend_issues"]:
                    f.write(f"- **[{issue.get('severity', 'UNKNOWN').upper()}]** {issue.get('message')}\n")
                f.write("\n")

            f.write("## 🎯 Recommendations\n\n")
            for i, rec in enumerate(self.audit_results["recommendations"], 1):
                f.write(f"### {i}. [{rec.get('priority', 'MEDIUM')}] {rec.get('issue')}\n\n")
                f.write(f"**Action:** {rec.get('action')}\n\n")
                f.write(f"**Estimated Time:** {rec.get('estimated_time', 'Unknown')}\n\n")


async def main():
    """Main audit execution"""
    print("="*60)
    print("DIRECTORY-BOLT COMPLETE AUDIT")
    print("="*60)
    print()
    print("This comprehensive audit will:")
    print("1. Read CLAUDE.md to understand the project")
    print("2. Find all broken links")
    print("3. Test all features")
    print("4. Audit the 4 Render machines (worker, subscriber, server, brain)")
    print("5. Identify which database is being used")
    print("6. Debug backend/staff dashboard communication")
    print("7. Map customer signup → purchase → distribution flow")
    print("8. Generate actionable recommendations")
    print()
    print("="*60)
    print()

    auditor = DirectoryBoltAuditor()

    # Run all audit steps
    await auditor.read_claude_md()
    await auditor.find_broken_links()
    await auditor.test_all_features()
    await auditor.audit_render_machines()
    await auditor.identify_database()
    await auditor.debug_backend_communication()
    await auditor.map_customer_flow()
    await auditor.generate_recommendations()
    await auditor.save_audit_report()

    print("\n" + "="*60)
    print("✅ AUDIT COMPLETE!")
    print("="*60)
    print()
    print("📄 Check AUDIT_REPORT.md for full details")
    print("📄 Check AUDIT_REPORT.json for machine-readable data")
    print()


if __name__ == "__main__":
    asyncio.run(main())
