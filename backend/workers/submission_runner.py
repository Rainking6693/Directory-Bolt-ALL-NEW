"""Playwright submission runner with heartbeats."""
import os
import time
import asyncio
from typing import Dict, Any
from playwright.async_api import async_playwright, Page
from utils.logging import setup_logger
from utils.ids import generate_worker_id
from db.dao import upsert_worker_heartbeat

# AI services (optional - only if enabled)
ENABLE_AI_FEATURES = os.getenv('ENABLE_AI_FEATURES', 'true').lower() == 'true'
ENABLE_FORM_MAPPING = os.getenv('ENABLE_FORM_MAPPING', 'true').lower() == 'true'

if ENABLE_AI_FEATURES and ENABLE_FORM_MAPPING:
    try:
        from ai.form_mapper import AIFormMapper
        form_mapper = AIFormMapper()
        ai_form_mapping_enabled = True
    except Exception as e:
        print(f"Warning: AI form mapping not available: {e}")
        form_mapper = None
        ai_form_mapping_enabled = False
else:
    form_mapper = None
    ai_form_mapping_enabled = False

logger = setup_logger(__name__)

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


async def execute_plan_step(page: Page, step: Dict[str, Any]):
    """Execute a single plan step."""
    action = step.get("action")
    
    if action == "goto":
        await page.goto(step["url"], wait_until="networkidle")
    elif action == "fill":
        await page.fill(step["selector"], step["value"])
    elif action == "click":
        await page.click(step["selector"])
    elif action == "wait":
        if step.get("until") == "networkidle":
            await page.wait_for_load_state("networkidle")
        else:
            await asyncio.sleep(step.get("seconds", 1))
    elif action == "select":
        await page.select_option(step["selector"], step["value"])
    else:
        logger.warning(f"Unknown action: {action}")


def run_plan(job_id: str, directory: str, plan: Dict[str, Any], business: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute submission plan with Playwright.
    
    Args:
        job_id: UUID of the job
        directory: Directory name/domain
        plan: Submission plan from CrewAI
        business: Business profile
    
    Returns:
        Result dict with status, duration, screenshot, etc.
    """
    return asyncio.run(_run_plan_async(job_id, directory, plan, business))


async def _run_plan_async(job_id: str, directory: str, plan: Dict[str, Any], business: Dict[str, Any]) -> Dict[str, Any]:
    """Async implementation of run_plan."""
    start_time = time.time()
    screenshot_url = None
    error_message = None
    
    logger.info(f"Starting Playwright execution for {directory}")
    
    # Start heartbeat task
    heartbeat_task = asyncio.create_task(_heartbeat_loop(job_id, directory))
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=HEADLESS)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = await context.new_page()
            
            # AI: Dynamic form field mapping if plan doesn't have selectors
            steps = plan.get("plan", [])
            
            if ai_form_mapping_enabled and form_mapper:
                # Check if plan has form field selectors
                has_selectors = any(
                    step.get('action') == 'fill' and step.get('selector')
                    for step in steps
                )
                
                if not has_selectors:
                    try:
                        # Get page HTML for form analysis
                        await page.wait_for_load_state('networkidle')
                        page_html = await page.content()
                        
                        page_data = {
                            'url': page.url,
                            'html': page_html
                        }
                        
                        # Analyze form with AI
                        form_analysis = await form_mapper.analyze_form(page_data)
                        
                        if form_analysis.get('success') and form_analysis.get('mapping'):
                            logger.info(f"AI: Detected {len(form_analysis['mapping'])} form fields for {directory}")
                            
                            # Generate plan steps from AI mapping
                            ai_steps = []
                            mapping = form_analysis['mapping']
                            
                            # Map business data to form fields
                            if 'businessName' in mapping and business.get('business_name'):
                                ai_steps.append({
                                    'action': 'fill',
                                    'selector': mapping['businessName']['selector'],
                                    'value': business['business_name']
                                })
                            
                            if 'email' in mapping and business.get('email'):
                                ai_steps.append({
                                    'action': 'fill',
                                    'selector': mapping['email']['selector'],
                                    'value': business['email']
                                })
                            
                            if 'website' in mapping and business.get('website'):
                                ai_steps.append({
                                    'action': 'fill',
                                    'selector': mapping['website']['selector'],
                                    'value': business['website']
                                })
                            
                            if 'description' in mapping and business.get('business_description'):
                                ai_steps.append({
                                    'action': 'fill',
                                    'selector': mapping['description']['selector'],
                                    'value': business['business_description']
                                })
                            
                            if 'phone' in mapping and business.get('phone'):
                                ai_steps.append({
                                    'action': 'fill',
                                    'selector': mapping['phone']['selector'],
                                    'value': business['phone']
                                })
                            
                            # Combine with existing steps or replace if empty
                            if ai_steps:
                                steps = ai_steps + [s for s in steps if s.get('action') != 'fill']
                                logger.info(f"AI: Generated {len(ai_steps)} form field steps")
                    except Exception as e:
                        logger.warning(f"AI form mapping failed for {directory}: {e}")
                        # Continue with original plan
            
            logger.info(f"Executing {len(steps)} steps for {directory}")
            
            for i, step in enumerate(steps):
                logger.info(f"Step {i+1}/{len(steps)}: {step.get('action')}")
                await execute_plan_step(page, step)
                
                # Rate limiting between steps
                await asyncio.sleep(0.5)
            
            # Take screenshot
            screenshot_path = f"/tmp/screenshot_{job_id}_{directory}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            screenshot_url = screenshot_path  # TODO: Upload to S3/storage
            
            # Get final URL
            final_url = page.url
            
            # Analyze success (simple heuristic for now)
            content = await page.content()
            success_indicators = ["success", "thank you", "submitted", "received"]
            is_success = any(indicator in content.lower() for indicator in success_indicators)
            
            await browser.close()
            
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
            
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(f"Error executing plan for {directory}: {error_message}")
        
        return {
            "status": "failed",
            "duration_ms": duration_ms,
            "error_message": error_message,
            "response_log": {"error": error_message}
        }
    finally:
        # Stop heartbeat
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass


async def _heartbeat_loop(job_id: str, directory: str):
    """Background task to send heartbeats every 20 seconds."""
    try:
        while True:
            await send_heartbeat(job_id, directory)
            await asyncio.sleep(20)
    except asyncio.CancelledError:
        # Final heartbeat on completion
        upsert_worker_heartbeat(
            worker_id=WORKER_ID,
            queue_name="default",
            status="idle",
            current_job_id=None
        )
        raise
