"""Playwright submission runner with heartbeats."""
import os
import re
import time
import asyncio
import tempfile
from typing import Dict, Any, Optional, List
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from utils.logging import setup_logger
from utils.ids import generate_worker_id
from db.dao import upsert_worker_heartbeat

logger = setup_logger(__name__)

# AI services (optional - only if enabled)
enable_ai_features = os.getenv('ENABLE_AI_FEATURES', 'true').lower() == 'true'
enable_form_mapping = os.getenv('ENABLE_FORM_MAPPING', 'true').lower() == 'true'

# Initialize AI services at module level
form_mapper: Optional[Any] = None
ai_form_mapping_enabled = False

if enable_ai_features and enable_form_mapping:
    try:
        from ai.form_mapper import AIFormMapper
        form_mapper = AIFormMapper()
        ai_form_mapping_enabled = True
        logger.info("AI form mapping initialized successfully")
    except ImportError as e:
        logger.warning(f"AI form mapping not available (import error): {e}")
        form_mapper = None
        ai_form_mapping_enabled = False
    except Exception as e:
        logger.warning(f"AI form mapping initialization failed: {e}")
        form_mapper = None
        ai_form_mapping_enabled = False
else:
    logger.info("AI form mapping disabled via environment variable")

WORKER_ID = generate_worker_id()
HEADLESS = os.getenv("PLAYWRIGHT_HEADLESS", "1") == "1"


async def send_heartbeat(job_id: str, directory: str):
    """Send worker heartbeat."""
    try:
        upsert_worker_heartbeat(
            worker_id=WORKER_ID,
            queue_name="default",
            status="running",
            current_job_id=job_id,
            metadata={"directory": directory}
        )
    except Exception as e:
        logger.error(f"Failed to send heartbeat: {e}")


async def execute_plan_step(page: Page, step: Dict[str, Any]) -> None:
    """
    Execute a single plan step.
    
    Args:
        page: Playwright Page object
        step: Step dict with action, selector, value, etc.
    
    Raises:
        ValueError: If step is invalid
        RuntimeError: If step execution fails
    """
    if not step or not isinstance(step, dict):
        raise ValueError("Step must be a non-empty dict")
    
    action = step.get("action")
    if not action or not isinstance(action, str):
        raise ValueError("Step must have a valid 'action' field")
    
    try:
        if action == "goto":
            url = step.get("url")
            if not url:
                raise ValueError("goto action requires 'url' field")
            await page.goto(url, wait_until="networkidle", timeout=30000)
        elif action == "fill":
            selector = step.get("selector")
            value = step.get("value", "")
            if not selector:
                raise ValueError("fill action requires 'selector' field")
            await page.fill(selector, str(value), timeout=10000)
        elif action == "click":
            selector = step.get("selector")
            if not selector:
                raise ValueError("click action requires 'selector' field")
            await page.click(selector, timeout=10000)
        elif action == "wait":
            if step.get("until") == "networkidle":
                await page.wait_for_load_state("networkidle", timeout=30000)
            else:
                seconds = step.get("seconds", 1)
                if not isinstance(seconds, (int, float)) or seconds < 0:
                    seconds = 1
                await asyncio.sleep(seconds)
        elif action == "select":
            selector = step.get("selector")
            value = step.get("value")
            if not selector:
                raise ValueError("select action requires 'selector' field")
            if value is None:
                raise ValueError("select action requires 'value' field")
            await page.select_option(selector, str(value), timeout=10000)
        else:
            logger.warning(f"Unknown action: {action}")
            raise ValueError(f"Unknown action: {action}")
    except ValueError as e:
        logger.error(f"Invalid step configuration: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to execute step {action}: {e}", extra={"error_type": type(e).__name__})
        raise RuntimeError(f"Step execution failed: {e}")


def run_plan(job_id: str, directory: str, plan: Dict[str, Any], business: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute submission plan with Playwright.
    
    Args:
        job_id: UUID of the job (must be non-empty string)
        directory: Directory name/domain (must be non-empty string)
        plan: Submission plan from CrewAI (must be dict)
        business: Business profile (must be dict)
    
    Returns:
        Result dict with status, duration, screenshot, etc.
    
    Raises:
        ValueError: If inputs are invalid
    """
    # Input validation
    if not job_id or not isinstance(job_id, str) or len(job_id.strip()) == 0:
        raise ValueError("job_id must be a non-empty string")
    if not directory or not isinstance(directory, str) or len(directory.strip()) == 0:
        raise ValueError("directory must be a non-empty string")
    if not plan or not isinstance(plan, dict):
        raise ValueError("plan must be a non-empty dict")
    if not business or not isinstance(business, dict):
        raise ValueError("business must be a non-empty dict")
    
    try:
        return asyncio.run(_run_plan_async(job_id, directory, plan, business))
    except ValueError as e:
        logger.error(f"Invalid input to run_plan: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to run plan: {e}", extra={"error_type": type(e).__name__})
        raise RuntimeError(f"Plan execution failed: {e}")


async def _run_plan_async(job_id: str, directory: str, plan: Dict[str, Any], business: Dict[str, Any]) -> Dict[str, Any]:
    """
    Async implementation of run_plan with proper resource management.
    
    Args:
        job_id: UUID of the job
        directory: Directory name/domain
        plan: Submission plan from CrewAI
        business: Business profile
    
    Returns:
        Result dict with status, duration, screenshot, etc.
    """
    start_time = time.time()
    screenshot_url: Optional[str] = None
    error_message: Optional[str] = None
    
    logger.info(f"Starting Playwright execution for {directory}")
    
    # Start heartbeat task
    heartbeat_task: Optional[asyncio.Task] = None
    browser: Optional[Browser] = None
    context: Optional[BrowserContext] = None
    page: Optional[Page] = None
    
    try:
        heartbeat_task = asyncio.create_task(_heartbeat_loop(job_id, directory))
        
        async with async_playwright() as p:
            try:
                browser = await p.chromium.launch(headless=HEADLESS)
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = await context.new_page()
            except Exception as e:
                logger.error(f"Failed to initialize browser: {e}")
                raise RuntimeError(f"Browser initialization failed: {e}")
            
            # AI: Dynamic form field mapping if plan doesn't have selectors
            steps = plan.get("plan", [])
            if not isinstance(steps, list):
                steps = []
            
            if ai_form_mapping_enabled and form_mapper and page:
                # Check if plan has form field selectors
                has_selectors = any(
                    isinstance(step, dict) and step.get('action') == 'fill' and step.get('selector')
                    for step in steps
                )
                
                if not has_selectors:
                    try:
                        # Get page HTML for form analysis
                        await page.wait_for_load_state('networkidle', timeout=30000)
                        page_html = await page.content()
                        
                        if not page_html:
                            raise ValueError("Failed to get page HTML")
                        
                        page_data = {
                            'url': page.url,
                            'html': page_html[:50000]  # Limit HTML size for AI processing
                        }
                        
                        # Analyze form with AI (properly await async method)
                        form_analysis = await form_mapper.analyze_form(page_data)
                        
                        if form_analysis and isinstance(form_analysis, dict) and form_analysis.get('success') and form_analysis.get('mapping'):
                            mapping = form_analysis['mapping']
                            if not isinstance(mapping, dict):
                                raise ValueError("Invalid mapping format")
                            
                            logger.info(f"AI: Detected {len(mapping)} form fields for {directory}")
                            
                            # Generate plan steps from AI mapping
                            ai_steps: List[Dict[str, Any]] = []
                            
                            # Map business data to form fields with validation
                            field_mappings = {
                                'businessName': ('business_name', 'businessName'),
                                'email': ('email', 'email'),
                                'website': ('website', 'website'),
                                'description': ('business_description', 'description'),
                                'phone': ('phone', 'phone')
                            }
                            
                            for field_key, (business_key, mapping_key) in field_mappings.items():
                                if mapping_key in mapping and business.get(business_key):
                                    field_info = mapping[mapping_key]
                                    if isinstance(field_info, dict) and 'selector' in field_info:
                                        ai_steps.append({
                                            'action': 'fill',
                                            'selector': field_info['selector'],
                                            'value': str(business[business_key])
                                        })
                            
                            # Combine with existing steps or replace if empty
                            if ai_steps:
                                steps = ai_steps + [s for s in steps if isinstance(s, dict) and s.get('action') != 'fill']
                                logger.info(f"AI: Generated {len(ai_steps)} form field steps")
                    except ValueError as e:
                        logger.warning(f"Invalid input for AI form mapping: {e}")
                        # Continue with original plan
                    except Exception as e:
                        logger.warning(f"AI form mapping failed for {directory}: {e}", extra={"error_type": type(e).__name__})
                        # Continue with original plan
            
            if not page:
                raise RuntimeError("Page not initialized")
            
            logger.info(f"Executing {len(steps)} steps for {directory}")
            
            # Execute steps with error handling
            for i, step in enumerate(steps):
                if not isinstance(step, dict):
                    logger.warning(f"Invalid step format at index {i}, skipping")
                    continue
                
                logger.info(f"Step {i+1}/{len(steps)}: {step.get('action')}")
                try:
                    await execute_plan_step(page, step)
                except ValueError as e:
                    logger.error(f"Invalid step configuration at step {i+1}: {e}")
                    raise
                except Exception as e:
                    logger.error(f"Step {i+1} failed: {e}")
                    raise RuntimeError(f"Step execution failed: {e}")
                
                # Rate limiting between steps
                await asyncio.sleep(0.5)
            
            # Take screenshot (with error handling)
            try:
                # Sanitize directory name to prevent path traversal
                safe_directory = re.sub(r'[^a-zA-Z0-9_-]', '_', directory)
                screenshot_path = os.path.join(
                    tempfile.gettempdir(),
                    f"screenshot_{job_id}_{safe_directory}.png"
                )
                await page.screenshot(path=screenshot_path, full_page=True, timeout=10000)
                screenshot_url = screenshot_path  # TODO: Upload to S3/storage
            except Exception as e:
                logger.warning(f"Failed to take screenshot: {e}")
                screenshot_url = None
            
            # Get final URL
            final_url = page.url if page else ""
            
            # Analyze success (simple heuristic for now)
            try:
                content = await page.content() if page else ""
                success_indicators = ["success", "thank you", "submitted", "received"]
                is_success = any(indicator in content.lower() for indicator in success_indicators) if content else False
            except Exception as e:
                logger.warning(f"Failed to analyze success indicators: {e}")
                is_success = False
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            result = {
                "status": "submitted" if is_success else "failed",
                "duration_ms": duration_ms,
                "screenshot_url": screenshot_url,
                "listing_url": final_url,
                "response_log": {
                    "final_url": final_url,
                    "steps_executed": len(steps),
                    "success_indicators_found": is_success
                }
            }
            
            if not is_success:
                result["error_message"] = "No success indicators found on final page"
            
            logger.info(f"Completed {directory}: {result['status']} in {duration_ms}ms")
            return result
            
    except ValueError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(f"Invalid input error executing plan for {directory}: {error_message}")
        
        return {
            "status": "failed",
            "duration_ms": duration_ms,
            "error_message": error_message,
            "response_log": {"error": error_message, "error_type": "ValueError"}
        }
    except RuntimeError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(f"Runtime error executing plan for {directory}: {error_message}")
        
        return {
            "status": "failed",
            "duration_ms": duration_ms,
            "error_message": error_message,
            "response_log": {"error": error_message, "error_type": "RuntimeError"}
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(f"Error executing plan for {directory}: {error_message}", extra={"error_type": type(e).__name__})
        
        return {
            "status": "failed",
            "duration_ms": duration_ms,
            "error_message": error_message,
            "response_log": {"error": error_message, "error_type": type(e).__name__}
        }
    finally:
        # Cleanup resources in reverse order with comprehensive error handling
        cleanup_errors = []

        # Close page
        if page:
            try:
                await page.close()
            except Exception as e:
                cleanup_errors.append(f"page: {e}")
                logger.warning(f"Failed to close page: {e}")

        # Close context
        if context:
            try:
                await context.close()
            except Exception as e:
                cleanup_errors.append(f"context: {e}")
                logger.warning(f"Failed to close context: {e}")

        # Close browser
        if browser:
            try:
                await browser.close()
            except Exception as e:
                cleanup_errors.append(f"browser: {e}")
                logger.warning(f"Failed to close browser: {e}")

        # Stop heartbeat task
        if heartbeat_task and not heartbeat_task.done():
            heartbeat_task.cancel()
            try:
                await asyncio.wait_for(heartbeat_task, timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
            except Exception as e:
                cleanup_errors.append(f"heartbeat: {e}")
                logger.warning(f"Error cancelling heartbeat task: {e}")

        if cleanup_errors:
            logger.error(f"Cleanup completed with errors: {', '.join(cleanup_errors)}")


async def _heartbeat_loop(job_id: str, directory: str) -> None:
    """
    Background task to send heartbeats every 20 seconds.
    
    Args:
        job_id: UUID of the job
        directory: Directory name/domain
    """
    try:
        while True:
            await send_heartbeat(job_id, directory)
            await asyncio.sleep(20)
    except asyncio.CancelledError:
        # Final heartbeat on completion
        try:
            upsert_worker_heartbeat(
                worker_id=WORKER_ID,
                queue_name="default",
                status="idle",
                current_job_id=None
            )
        except Exception as e:
            logger.warning(f"Failed to send final heartbeat: {e}")
        raise
    except Exception as e:
        logger.error(f"Heartbeat loop error: {e}", extra={"error_type": type(e).__name__})
        raise
