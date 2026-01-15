"""
Cron Job Runner for Directory Submissions
Designed to run as a background task or scheduled cron job
"""

import asyncio
import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from directory_submitter import DirectorySubmitter, BusinessData, SubmissionResult
from supabase import create_client

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('submission_log.txt'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class SubmissionOrchestrator:
    """
    Orchestrates directory submissions with smart batching and rate limiting
    """

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")

        if not all([self.supabase_url, self.supabase_key, self.gemini_key]):
            raise ValueError("Missing required environment variables")

        self.supabase = create_client(self.supabase_url, self.supabase_key)

    def get_pending_jobs(self) -> List[Dict]:
        """Get jobs that are pending submission"""
        result = self.supabase.table("jobs").select(
            "*, customers(*)"
        ).eq("status", "pending").order("priority_level").order("created_at").execute()

        return result.data

    def get_business_data_from_job(self, job: Dict) -> BusinessData:
        """Extract business data from a job record"""

        # Try to get from business_data JSON first
        biz_data = job.get("business_data", {}) or {}

        # Fall back to individual columns
        return BusinessData(
            name=biz_data.get("name") or job.get("business_name") or job.get("customer_name", ""),
            url=biz_data.get("url") or job.get("business_website") or job.get("website", ""),
            email=biz_data.get("email") or job.get("business_email") or job.get("email", ""),
            description=biz_data.get("description") or job.get("business_description") or job.get("description", ""),
            tagline=biz_data.get("tagline"),
            category=biz_data.get("category") or job.get("business_category") or job.get("category"),
            phone=biz_data.get("phone") or job.get("business_phone") or job.get("phone"),
            address=biz_data.get("address") or job.get("business_address") or job.get("address"),
            city=biz_data.get("city") or job.get("business_city") or job.get("city"),
            state=biz_data.get("state") or job.get("business_state") or job.get("state"),
            zip_code=biz_data.get("zip") or job.get("business_zip") or job.get("zip"),
            logo_url=biz_data.get("logo_url"),
            social_twitter=biz_data.get("twitter"),
            social_linkedin=biz_data.get("linkedin"),
        )

    async def process_job(
        self,
        job: Dict,
        parallel_workers: int = 3,
        batch_size: int = 50
    ) -> Dict:
        """Process a single submission job"""

        job_id = job["id"]
        package_size = job.get("package_size", 50)

        logger.info(f"Processing job {job_id} - Package size: {package_size}")

        # Update job status to in_progress
        self.supabase.table("jobs").update({
            "status": "in_progress",
            "started_at": datetime.now().isoformat()
        }).eq("id", job_id).execute()

        try:
            # Get business data
            business = self.get_business_data_from_job(job)

            if not business.name or not business.url or not business.email:
                raise ValueError("Missing required business data (name, url, or email)")

            # Create submitter
            submitter = DirectorySubmitter(
                supabase_url=self.supabase_url,
                supabase_key=self.supabase_key,
                gemini_api_key=self.gemini_key,
                headless=False,  # Need non-headless for NopeCHA
                parallel_workers=parallel_workers,
                screenshot_dir=f"./screenshots/{job_id}"
            )

            # Get directories (limited to package size)
            directories = await submitter.get_directories(limit=package_size)

            logger.info(f"Job {job_id}: Submitting to {len(directories)} directories")

            # Process in batches to avoid memory issues
            all_results = []
            for i in range(0, len(directories), batch_size):
                batch = directories[i:i + batch_size]
                logger.info(f"Job {job_id}: Processing batch {i//batch_size + 1} ({len(batch)} directories)")

                results = await submitter.run_submissions(business, batch)
                all_results.extend(results)

                # Save intermediate results to job_results table
                for result in results:
                    self.save_job_result(job_id, result)

                # Small delay between batches
                await asyncio.sleep(5)

            # Calculate final stats
            successful = sum(1 for r in all_results if r.success)
            failed = len(all_results) - successful
            success_rate = (successful / len(all_results) * 100) if all_results else 0

            # Update job as complete
            self.supabase.table("jobs").update({
                "status": "complete",
                "completed_at": datetime.now().isoformat(),
                "metadata": {
                    "total_submitted": len(all_results),
                    "successful": successful,
                    "failed": failed,
                    "success_rate": success_rate
                }
            }).eq("id", job_id).execute()

            logger.info(f"Job {job_id} complete: {successful}/{len(all_results)} successful ({success_rate:.1f}%)")

            return {
                "job_id": job_id,
                "status": "complete",
                "total": len(all_results),
                "successful": successful,
                "failed": failed,
                "success_rate": success_rate
            }

        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")

            self.supabase.table("jobs").update({
                "status": "failed",
                "completed_at": datetime.now().isoformat(),
                "error_message": str(e)
            }).eq("id", job_id).execute()

            return {
                "job_id": job_id,
                "status": "failed",
                "error": str(e)
            }

    def save_job_result(self, job_id: str, result: SubmissionResult):
        """Save individual submission result to job_results table"""

        self.supabase.table("job_results").upsert({
            "job_id": job_id,
            "directory_name": result.directory_name,
            "status": "submitted" if result.success else "failed",
            "response_log": {
                "success": result.success,
                "error": result.error_message,
                "screenshot": result.screenshot_path,
                "duration_ms": result.duration_ms,
                "submitted_at": result.submitted_at.isoformat() if result.submitted_at else None
            },
            "submitted_at": result.submitted_at.isoformat() if result.submitted_at else None,
            "updated_at": datetime.now().isoformat()
        }, on_conflict="job_id,directory_name").execute()

    async def run_all_pending_jobs(self, parallel_workers: int = 3):
        """Process all pending jobs"""

        jobs = self.get_pending_jobs()

        if not jobs:
            logger.info("No pending jobs found")
            return []

        logger.info(f"Found {len(jobs)} pending jobs")

        results = []
        for job in jobs:
            result = await self.process_job(job, parallel_workers=parallel_workers)
            results.append(result)

        return results

    async def run_single_submission(
        self,
        business: BusinessData,
        limit: Optional[int] = None,
        difficulty: Optional[str] = None,
        parallel_workers: int = 3
    ) -> List[SubmissionResult]:
        """Run a one-off submission without creating a job"""

        logger.info(f"Running single submission for {business.name}")

        submitter = DirectorySubmitter(
            supabase_url=self.supabase_url,
            supabase_key=self.supabase_key,
            gemini_api_key=self.gemini_key,
            headless=False,
            parallel_workers=parallel_workers
        )

        directories = await submitter.get_directories(
            limit=limit,
            difficulty=difficulty
        )

        return await submitter.run_submissions(business, directories)


async def run_cron():
    """Main cron job entry point"""
    logger.info("=" * 60)
    logger.info("CRON JOB STARTED")
    logger.info(f"Time: {datetime.now().isoformat()}")
    logger.info("=" * 60)

    orchestrator = SubmissionOrchestrator()
    results = await orchestrator.run_all_pending_jobs(parallel_workers=3)

    logger.info("=" * 60)
    logger.info("CRON JOB COMPLETE")
    logger.info(f"Processed {len(results)} jobs")
    logger.info("=" * 60)

    return results


async def run_manual(
    business_name: str,
    business_url: str,
    business_email: str,
    business_description: str,
    limit: Optional[int] = None,
    difficulty: Optional[str] = None,
    parallel: int = 3
):
    """Manual submission entry point"""

    business = BusinessData(
        name=business_name,
        url=business_url,
        email=business_email,
        description=business_description
    )

    orchestrator = SubmissionOrchestrator()
    results = await orchestrator.run_single_submission(
        business=business,
        limit=limit,
        difficulty=difficulty,
        parallel_workers=parallel
    )

    return results


# CLI
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Directory Submission Cron Runner")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Cron command (processes pending jobs from database)
    cron_parser = subparsers.add_parser("cron", help="Process all pending jobs")

    # Manual command (one-off submission)
    manual_parser = subparsers.add_parser("manual", help="Run manual submission")
    manual_parser.add_argument("--name", required=True, help="Business name")
    manual_parser.add_argument("--url", required=True, help="Business URL")
    manual_parser.add_argument("--email", required=True, help="Business email")
    manual_parser.add_argument("--description", required=True, help="Business description")
    manual_parser.add_argument("--limit", type=int, help="Limit directories")
    manual_parser.add_argument("--difficulty", choices=["Easy", "Medium", "Hard"])
    manual_parser.add_argument("--parallel", type=int, default=3, help="Parallel workers")

    # Test command (submit to 5 easy directories)
    test_parser = subparsers.add_parser("test", help="Test with 5 easy directories")
    test_parser.add_argument("--name", required=True, help="Business name")
    test_parser.add_argument("--url", required=True, help="Business URL")
    test_parser.add_argument("--email", required=True, help="Business email")
    test_parser.add_argument("--description", required=True, help="Business description")

    args = parser.parse_args()

    if args.command == "cron":
        asyncio.run(run_cron())

    elif args.command == "manual":
        asyncio.run(run_manual(
            business_name=args.name,
            business_url=args.url,
            business_email=args.email,
            business_description=args.description,
            limit=args.limit,
            difficulty=args.difficulty,
            parallel=args.parallel
        ))

    elif args.command == "test":
        asyncio.run(run_manual(
            business_name=args.name,
            business_url=args.url,
            business_email=args.email,
            business_description=args.description,
            limit=5,
            difficulty="Easy",
            parallel=1
        ))

    else:
        parser.print_help()
