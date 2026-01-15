"""
Directory Submission Automation
Uses Playwright + Gemini Flash + NopeCHA for free automated submissions
"""

import asyncio
import json
import os
import re
import hashlib
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from pathlib import Path

from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from supabase import create_client, Client
import google.generativeai as genai

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# NopeCHA extension path (download from https://nopecha.com)
NOPECHA_EXTENSION_PATH = os.getenv("NOPECHA_EXTENSION_PATH", "./extensions/nopecha")


@dataclass
class BusinessData:
    """Business information to submit to directories"""
    name: str
    url: str
    description: str
    email: str
    tagline: Optional[str] = None
    category: Optional[str] = None
    logo_url: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = "USA"
    social_twitter: Optional[str] = None
    social_linkedin: Optional[str] = None
    founding_year: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class SubmissionResult:
    """Result of a directory submission attempt"""
    directory_id: str
    directory_name: str
    success: bool
    status: str  # 'submitted', 'failed', 'captcha_failed', 'timeout', 'blocked'
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    submitted_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


class GeminiFormMapper:
    """Uses Gemini to intelligently map business data to form fields"""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')

    async def analyze_form(self, page_html: str, business_data: Dict) -> Dict[str, str]:
        """Analyze form HTML and map business data to form fields"""

        prompt = f"""Analyze this HTML form and map the business data to the correct form fields.

BUSINESS DATA:
{json.dumps(business_data, indent=2)}

HTML FORM (truncated):
{page_html[:15000]}

Return a JSON object mapping CSS selectors to values. Example:
{{
  "input#company-name": "Acme Inc",
  "input[name='website']": "https://acme.com",
  "textarea#description": "We build great products...",
  "select#category": "Technology",
  "input[type='email']": "hello@acme.com"
}}

Rules:
1. Only include fields that exist in the form
2. Use precise CSS selectors (id, name, or unique attributes)
3. For select/dropdown fields, use the visible option text
4. Skip file upload fields
5. Return ONLY valid JSON, no explanation

JSON:"""

        try:
            response = await asyncio.to_thread(
                self.model.generate_content, prompt
            )

            # Extract JSON from response
            text = response.text.strip()
            # Handle markdown code blocks
            if text.startswith("```"):
                text = re.sub(r'^```(?:json)?\n?', '', text)
                text = re.sub(r'\n?```$', '', text)

            return json.loads(text)
        except Exception as e:
            print(f"Gemini form analysis error: {e}")
            return {}

    async def find_submit_button(self, page_html: str) -> str:
        """Find the submit button selector"""

        prompt = f"""Find the submit button in this HTML form and return its CSS selector.

HTML (truncated):
{page_html[:10000]}

Return ONLY the CSS selector string, nothing else. Examples:
- button[type='submit']
- input[type='submit']
- button.submit-btn
- #submit-button

Selector:"""

        try:
            response = await asyncio.to_thread(
                self.model.generate_content, prompt
            )
            return response.text.strip().strip('"\'')
        except Exception as e:
            print(f"Gemini submit button error: {e}")
            return "button[type='submit'], input[type='submit']"


class CaptchaSolver:
    """Handles CAPTCHA solving using NopeCHA extension"""

    def __init__(self, extension_path: str):
        self.extension_path = extension_path
        self.enabled = os.path.exists(extension_path)

        if not self.enabled:
            print(f"Warning: NopeCHA extension not found at {extension_path}")
            print("CAPTCHAs will not be auto-solved. Download from https://nopecha.com")

    async def wait_for_solve(self, page: Page, timeout: int = 30000) -> bool:
        """Wait for CAPTCHA to be solved by NopeCHA"""

        if not self.enabled:
            return False

        try:
            # Wait for reCAPTCHA checkbox to be checked
            await page.wait_for_function(
                """() => {
                    const iframe = document.querySelector('iframe[src*="recaptcha"]');
                    if (!iframe) return true; // No CAPTCHA present

                    // Check if solved (checkbox checked or response filled)
                    const response = document.querySelector('[name="g-recaptcha-response"]');
                    return response && response.value.length > 0;
                }""",
                timeout=timeout
            )
            return True
        except Exception as e:
            print(f"CAPTCHA solve timeout: {e}")
            return False

    async def detect_captcha(self, page: Page) -> Optional[str]:
        """Detect what type of CAPTCHA is on the page"""

        captcha_type = await page.evaluate("""() => {
            if (document.querySelector('iframe[src*="recaptcha"]')) return 'recaptcha';
            if (document.querySelector('iframe[src*="hcaptcha"]')) return 'hcaptcha';
            if (document.querySelector('[data-turnstile-sitekey]')) return 'cloudflare';
            if (document.querySelector('.g-recaptcha')) return 'recaptcha';
            if (document.querySelector('.h-captcha')) return 'hcaptcha';
            return null;
        }""")

        return captcha_type


class DirectorySubmitter:
    """Main class for submitting to directories"""

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        gemini_api_key: str,
        nopecha_path: Optional[str] = None,
        headless: bool = True,
        parallel_workers: int = 3,
        screenshot_dir: str = "./screenshots"
    ):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.form_mapper = GeminiFormMapper(gemini_api_key)
        self.captcha_solver = CaptchaSolver(nopecha_path or NOPECHA_EXTENSION_PATH)
        self.headless = headless
        self.parallel_workers = parallel_workers
        self.screenshot_dir = Path(screenshot_dir)
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)

        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None

    async def setup_browser(self):
        """Initialize browser with extensions"""

        playwright = await async_playwright().start()

        # Browser launch options
        launch_options = {
            "headless": self.headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ]
        }

        # Add NopeCHA extension if available
        if self.captcha_solver.enabled:
            launch_options["args"].append(
                f"--load-extension={self.captcha_solver.extension_path}"
            )
            launch_options["args"].append(
                f"--disable-extensions-except={self.captcha_solver.extension_path}"
            )
            # Extensions require non-headless mode
            launch_options["headless"] = False

        self.browser = await playwright.chromium.launch(**launch_options)
        self.context = await self.browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

    async def close_browser(self):
        """Clean up browser resources"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

    async def get_directories(
        self,
        limit: Optional[int] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        has_captcha: Optional[bool] = None
    ) -> List[Dict]:
        """Fetch directories from Supabase"""

        query = self.supabase.table("directories").select("*").eq("active", True).eq("status", "active")

        if category:
            query = query.eq("category", category)
        if difficulty:
            query = query.eq("difficulty", difficulty)
        if has_captcha is not None:
            query = query.eq("has_captcha", has_captcha)

        query = query.order("priority_score", desc=True).order("domain_authority", desc=True)

        if limit:
            query = query.limit(limit)

        result = query.execute()
        return result.data

    async def submit_to_directory(
        self,
        directory: Dict,
        business: BusinessData
    ) -> SubmissionResult:
        """Submit business data to a single directory"""

        start_time = datetime.now()
        directory_id = directory["id"]
        directory_name = directory["name"]
        submission_url = directory.get("submission_url")

        if not submission_url:
            return SubmissionResult(
                directory_id=directory_id,
                directory_name=directory_name,
                success=False,
                status="failed",
                error_message="No submission URL"
            )

        page = await self.context.new_page()
        screenshot_path = None

        try:
            print(f"[{directory_name}] Navigating to {submission_url}")

            # Navigate to submission page
            await page.goto(submission_url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)  # Wait for dynamic content

            # Check for CAPTCHA
            captcha_type = await self.captcha_solver.detect_captcha(page)
            if captcha_type:
                print(f"[{directory_name}] Detected {captcha_type} CAPTCHA")
                if self.captcha_solver.enabled:
                    print(f"[{directory_name}] Waiting for NopeCHA to solve...")
                    solved = await self.captcha_solver.wait_for_solve(page, timeout=45000)
                    if not solved:
                        return SubmissionResult(
                            directory_id=directory_id,
                            directory_name=directory_name,
                            success=False,
                            status="captcha_failed",
                            error_message=f"Failed to solve {captcha_type} CAPTCHA"
                        )

            # Get page HTML for Gemini analysis
            page_html = await page.content()

            # Use Gemini to map form fields
            print(f"[{directory_name}] Analyzing form with Gemini...")
            field_mappings = await self.form_mapper.analyze_form(
                page_html,
                business.to_dict()
            )

            if not field_mappings:
                # Fallback to stored selectors if Gemini fails
                field_mappings = directory.get("field_selectors", {})

            if not field_mappings:
                return SubmissionResult(
                    directory_id=directory_id,
                    directory_name=directory_name,
                    success=False,
                    status="failed",
                    error_message="Could not map form fields"
                )

            # Fill out the form
            print(f"[{directory_name}] Filling form fields...")
            for selector, value in field_mappings.items():
                try:
                    element = await page.query_selector(selector)
                    if element:
                        tag_name = await element.evaluate("el => el.tagName.toLowerCase()")

                        if tag_name == "select":
                            await element.select_option(label=value)
                        elif tag_name == "textarea":
                            await element.fill(value)
                        else:
                            input_type = await element.get_attribute("type")
                            if input_type == "checkbox":
                                if value in [True, "true", "True", "1", "yes"]:
                                    await element.check()
                            elif input_type == "radio":
                                await element.check()
                            else:
                                await element.fill(str(value))

                        await asyncio.sleep(0.3)  # Small delay between fields
                except Exception as e:
                    print(f"[{directory_name}] Error filling {selector}: {e}")

            # Check for CAPTCHA again (some appear after form fill)
            captcha_type = await self.captcha_solver.detect_captcha(page)
            if captcha_type and self.captcha_solver.enabled:
                print(f"[{directory_name}] Post-fill CAPTCHA detected, waiting...")
                await self.captcha_solver.wait_for_solve(page, timeout=45000)

            # Find and click submit button
            submit_selector = await self.form_mapper.find_submit_button(page_html)
            print(f"[{directory_name}] Clicking submit button: {submit_selector}")

            submit_button = await page.query_selector(submit_selector)
            if submit_button:
                await submit_button.click()
                await asyncio.sleep(3)  # Wait for submission
            else:
                # Try common submit button selectors
                for fallback in [
                    "button[type='submit']",
                    "input[type='submit']",
                    "button:has-text('Submit')",
                    "button:has-text('Add')",
                    "button:has-text('Create')",
                ]:
                    btn = await page.query_selector(fallback)
                    if btn:
                        await btn.click()
                        await asyncio.sleep(3)
                        break

            # Take screenshot of result
            screenshot_path = str(self.screenshot_dir / f"{directory_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
            await page.screenshot(path=screenshot_path, full_page=True)

            # Check for success indicators
            current_url = page.url
            page_text = await page.inner_text("body")

            success_indicators = [
                "thank you", "success", "submitted", "received",
                "confirmation", "approved", "pending review"
            ]

            is_success = any(indicator in page_text.lower() for indicator in success_indicators)

            # Calculate duration
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            return SubmissionResult(
                directory_id=directory_id,
                directory_name=directory_name,
                success=is_success,
                status="submitted" if is_success else "failed",
                screenshot_path=screenshot_path,
                submitted_at=datetime.now(),
                duration_ms=duration_ms,
                error_message=None if is_success else "No success confirmation found"
            )

        except Exception as e:
            print(f"[{directory_name}] Error: {e}")

            # Take error screenshot
            try:
                screenshot_path = str(self.screenshot_dir / f"{directory_id}_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
                await page.screenshot(path=screenshot_path)
            except:
                pass

            return SubmissionResult(
                directory_id=directory_id,
                directory_name=directory_name,
                success=False,
                status="failed",
                error_message=str(e),
                screenshot_path=screenshot_path
            )

        finally:
            await page.close()

    async def update_submission_result(self, result: SubmissionResult):
        """Save submission result to Supabase"""

        # Update directory record
        update_data = {
            "last_submission_attempt": {
                "date": result.submitted_at.isoformat() if result.submitted_at else datetime.now().isoformat(),
                "success": result.success,
                "status": result.status,
                "error": result.error_message,
                "screenshot": result.screenshot_path,
                "duration_ms": result.duration_ms
            },
            "total_submissions": self.supabase.table("directories").select("total_submissions").eq("id", result.directory_id).execute().data[0].get("total_submissions", 0) + 1
        }

        if result.success:
            update_data["successful_submissions"] = self.supabase.table("directories").select("successful_submissions").eq("id", result.directory_id).execute().data[0].get("successful_submissions", 0) + 1
            update_data["last_successful_submission_at"] = datetime.now().isoformat()
        else:
            update_data["failed_submissions"] = self.supabase.table("directories").select("failed_submissions").eq("id", result.directory_id).execute().data[0].get("failed_submissions", 0) + 1

        self.supabase.table("directories").update(update_data).eq("id", result.directory_id).execute()

    async def run_submissions(
        self,
        business: BusinessData,
        directories: Optional[List[Dict]] = None,
        limit: Optional[int] = None
    ) -> List[SubmissionResult]:
        """Run submissions for multiple directories"""

        if directories is None:
            directories = await self.get_directories(limit=limit)

        print(f"\n{'='*60}")
        print(f"Starting submissions for {len(directories)} directories")
        print(f"Business: {business.name}")
        print(f"Parallel workers: {self.parallel_workers}")
        print(f"{'='*60}\n")

        await self.setup_browser()

        results = []
        semaphore = asyncio.Semaphore(self.parallel_workers)

        async def submit_with_semaphore(directory: Dict) -> SubmissionResult:
            async with semaphore:
                result = await self.submit_to_directory(directory, business)
                await self.update_submission_result(result)

                status_emoji = "✅" if result.success else "❌"
                print(f"{status_emoji} [{result.directory_name}] {result.status}")

                return result

        # Run all submissions
        tasks = [submit_with_semaphore(d) for d in directories]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions
        results = [r for r in results if isinstance(r, SubmissionResult)]

        await self.close_browser()

        # Print summary
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful

        print(f"\n{'='*60}")
        print(f"SUBMISSION COMPLETE")
        print(f"{'='*60}")
        print(f"Total: {len(results)}")
        print(f"Successful: {successful}")
        print(f"Failed: {failed}")
        print(f"Success rate: {successful/len(results)*100:.1f}%")
        print(f"{'='*60}\n")

        return results


# CLI Entry Point
async def main():
    """Main entry point for CLI usage"""
    import argparse

    parser = argparse.ArgumentParser(description="Directory Submission Automation")
    parser.add_argument("--business-name", required=True, help="Business name")
    parser.add_argument("--business-url", required=True, help="Business website URL")
    parser.add_argument("--business-email", required=True, help="Business email")
    parser.add_argument("--business-description", required=True, help="Business description")
    parser.add_argument("--tagline", help="Business tagline")
    parser.add_argument("--category", help="Business category")
    parser.add_argument("--limit", type=int, help="Limit number of directories")
    parser.add_argument("--parallel", type=int, default=3, help="Parallel workers (default: 3)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode (no NopeCHA)")
    parser.add_argument("--difficulty", choices=["Easy", "Medium", "Hard"], help="Filter by difficulty")

    args = parser.parse_args()

    # Load environment
    from dotenv import load_dotenv
    load_dotenv()

    # Create business data
    business = BusinessData(
        name=args.business_name,
        url=args.business_url,
        email=args.business_email,
        description=args.business_description,
        tagline=args.tagline,
        category=args.category
    )

    # Create submitter
    submitter = DirectorySubmitter(
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        headless=args.headless,
        parallel_workers=args.parallel
    )

    # Get directories
    directories = await submitter.get_directories(
        limit=args.limit,
        difficulty=args.difficulty
    )

    # Run submissions
    results = await submitter.run_submissions(business, directories)

    return results


if __name__ == "__main__":
    asyncio.run(main())
