"""Prefect tasks for directory submissions."""
import os
from prefect import task, get_run_logger
from typing import Dict, List
from db.dao import (
    upsert_job_result,
    set_job_status,
    record_history,
    get_business_profile,
    get_directories_for_job,
    get_directory_info
)
from brain.client import get_plan
from workers.submission_runner import run_plan
from utils.ids import make_idempotency_key
from utils.retry import exponential_backoff_with_jitter
import time

# AI services (optional - only if enabled)
ENABLE_AI_FEATURES = os.getenv('ENABLE_AI_FEATURES', 'true').lower() == 'true'
ENABLE_CONTENT_CUSTOMIZATION = os.getenv('ENABLE_CONTENT_CUSTOMIZATION', 'true').lower() == 'true'

if ENABLE_AI_FEATURES:
    try:
        from ai.description_customizer import DescriptionCustomizer
        description_customizer = DescriptionCustomizer() if ENABLE_CONTENT_CUSTOMIZATION else None
        ai_enabled = True
    except Exception as e:
        print(f"Warning: AI services not available: {e}")
        description_customizer = None
        ai_enabled = False
else:
    description_customizer = None
    ai_enabled = False


@task(name="mark_in_progress")
def mark_in_progress(job_id: str):
    """Mark job as in_progress."""
    logger = get_run_logger()
    logger.info(f"Marking job {job_id} as in_progress")
    set_job_status(job_id, "in_progress")
    record_history(job_id, None, "job_started", {})


@task(name="list_directories")
def list_directories_for_job(job_id: str) -> List[str]:
    """
    Get list of directories for a job.
    
    Returns:
        List of directory names/domains
    """
    logger = get_run_logger()
    directories = get_directories_for_job(job_id)
    logger.info(f"Found {len(directories)} directories for job {job_id}")
    return directories


@task(
    name="submit_directory",
    retries=3,
    retry_delay_seconds=30,
    timeout_seconds=480,
    log_prints=True
)
async def submit_directory(job_id: str, directory: str, priority: str = "starter") -> Dict:
    """
    Submit business to a single directory with idempotency and retries.
    
    Args:
        job_id: UUID of the job
        directory: Directory name/domain
        priority: Package priority for rate limiting
    
    Returns:
        Dict with status and details
    """
    logger = get_run_logger()
    logger.info(f"Processing {directory} for job {job_id}")
    
    try:
        # Get business profile
        business = get_business_profile(job_id)
        
        if not business or not business.get("business_name"):
            logger.error(f"No business profile found for job {job_id}")
            record_history(job_id, directory, "error_no_profile", {})
            return {"status": "failed", "reason": "no_business_profile"}
        
        # AI: Customize description for this directory (if enabled)
        if ai_enabled and description_customizer:
            try:
                directory_info = get_directory_info(directory)
                if directory_info and business.get("business_description"):
                    customization_request = {
                        'directory_id': directory_info.get('id', directory),
                        'business_data': business,
                        'original_description': business.get("business_description")
                    }
                    
                    customization_result = await description_customizer.customize_description(customization_request)
                    
                    if customization_result and customization_result.get('primary_customization'):
                        customized = customization_result['primary_customization']
                        business['business_description'] = customized.get('description', business.get("business_description"))
                        
                        logger.info(f"AI: Customized description for {directory} (confidence: {customized.get('confidence', 0)*100:.1f}%)")
                        record_history(job_id, directory, "ai_content_customized", {
                            'original_length': len(customization_request['original_description']),
                            'customized_length': len(business['business_description']),
                            'confidence': customized.get('confidence', 0)
                        })
            except Exception as e:
                logger.warning(f"AI description customization failed for {directory}: {e}")
                # Continue with original description
        
        # Get submission plan from CrewAI brain
        logger.info(f"Getting plan from CrewAI for {directory}")
        plan = get_plan(directory, business)
        
        # Generate idempotency key
        idem_factors = plan.get("idempotency_factors", {
            "name": business.get("business_name"),
            "dir": directory
        })
        idem = make_idempotency_key(job_id, directory, idem_factors)
        
        # Pre-write to prevent duplicates on retry
        logger.info(f"Checking idempotency for {directory}")
        dup_status = upsert_job_result(
            job_id=job_id,
            directory=directory,
            status="submitting",
            idem=idem,
            payload={"business": business, "plan": plan}
        )
        
        if dup_status == "duplicate_success":
            logger.info(f"Skipping {directory} - already successfully submitted")
            record_history(job_id, directory, "skipped_duplicate", {"idem": idem})
            return {"status": "skipped", "directory": directory}
        
        # Record submission attempt
        record_history(job_id, directory, "submitting", {"idem": idem})
        
        # Apply rate limiting based on priority
        rate_limit_ms = plan.get("constraints", {}).get("rateLimitMs", 1500)
        if priority == "enterprise":
            rate_limit_ms = max(rate_limit_ms * 0.5, 500)  # Faster for enterprise
        elif priority == "starter":
            rate_limit_ms = rate_limit_ms * 1.5  # Slower for starter
        
        time.sleep(rate_limit_ms / 1000.0)
        
        # Execute submission with Playwright
        logger.info(f"Executing submission to {directory}")
        result = run_plan(job_id, directory, plan, business)
        
        # Update result in database
        upsert_job_result(
            job_id=job_id,
            directory=directory,
            status=result["status"],
            idem=idem,
            response_log=result.get("response_log", {}),
            error_message=result.get("error_message")
        )
        
        # Record outcome
        record_history(job_id, directory, result["status"], {
            "idem": idem,
            "duration_ms": result.get("duration_ms"),
            "screenshot_url": result.get("screenshot_url")
        })
        
        logger.info(f"Completed {directory} with status: {result['status']}")
        
        # AI: Analyze failure and recommend retry if submission failed
        if result['status'] == 'failed' and ai_enabled:
            try:
                from ai.retry_analyzer import IntelligentRetryAnalyzer
                retry_analyzer = IntelligentRetryAnalyzer()
                
                directory_info = get_directory_info(directory)
                failure_data = {
                    'submission_id': f"{job_id}_{directory}",
                    'directory_id': directory_info.get('id', directory) if directory_info else directory,
                    'business_name': business.get('business_name', ''),
                    'business_category': business.get('business_category', ''),
                    'business_description': business.get('business_description', ''),
                    'rejection_reason': result.get('error_message', 'Submission failed'),
                    'error_message': result.get('error_message', ''),
                    'status': 'failed',
                    'attempt_number': 1,
                    'submitted_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }
                
                retry_analysis = await retry_analyzer.analyze_failure_and_recommend_retry(failure_data)
                
                if retry_analysis.get('retry_recommendation'):
                    logger.info(f"AI: Retry recommended for {directory} (probability: {retry_analysis.get('retry_probability', {}).get('probability', 0)*100:.1f}%)")
                    record_history(job_id, directory, "ai_retry_recommended", {
                        'retry_probability': retry_analysis.get('retry_probability', {}).get('probability', 0),
                        'retry_date': retry_analysis.get('optimal_timing', {}).get('retry_date'),
                        'failure_category': retry_analysis.get('failure_analysis', {}).get('category')
                    })
                    # TODO: Schedule retry based on optimal_timing
            except Exception as e:
                logger.warning(f"AI retry analysis failed for {directory}: {e}")
        
        return {
            "status": result["status"],
            "directory": directory,
            "duration_ms": result.get("duration_ms")
        }
        
    except Exception as e:
        logger.error(f"Error submitting to {directory}: {str(e)}")
        record_history(job_id, directory, "error", {"error": str(e)})
        
        # AI: Analyze error for retry recommendation
        if ai_enabled:
            try:
                from ai.retry_analyzer import IntelligentRetryAnalyzer
                retry_analyzer = IntelligentRetryAnalyzer()
                
                directory_info = get_directory_info(directory) if directory else None
                failure_data = {
                    'submission_id': f"{job_id}_{directory}",
                    'directory_id': directory_info.get('id', directory) if directory_info else directory,
                    'business_name': business.get('business_name', '') if business else '',
                    'rejection_reason': str(e),
                    'error_message': str(e),
                    'status': 'error',
                    'attempt_number': 1
                }
                
                retry_analysis = await retry_analyzer.analyze_failure_and_recommend_retry(failure_data)
                logger.info(f"AI: Error analysis for {directory} - Retry: {retry_analysis.get('retry_recommendation', False)}")
            except:
                pass  # Don't fail on AI analysis error
        
        # Update as failed
        try:
            upsert_job_result(
                job_id=job_id,
                directory=directory,
                status="failed",
                idem=make_idempotency_key(job_id, directory, {"error": True}),
                error_message=str(e)
            )
        except:
            pass  # Don't fail if we can't update
        
        # Re-raise for Prefect retry logic
        raise


@task(name="finalize_job")
def finalize_job(job_id: str, results: List[Dict]):
    """
    Finalize job based on task results.
    
    Args:
        job_id: UUID of the job
        results: List of result dicts from submit_directory tasks
    """
    logger = get_run_logger()
    
    if not results:
        logger.warning(f"No results for job {job_id}, marking as failed")
        set_job_status(job_id, "failed", "No directories processed")
        record_history(job_id, None, "job_failed", {"reason": "no_results"})
        return
    
    # Calculate stats
    total = len(results)
    submitted = sum(1 for r in results if r.get("status") == "submitted")
    failed = sum(1 for r in results if r.get("status") == "failed")
    skipped = sum(1 for r in results if r.get("status") == "skipped")
    
    # Determine final status
    if failed == total:
        final_status = "failed"
        error_msg = "All submissions failed"
    elif submitted + skipped == total:
        final_status = "completed"
        error_msg = None
    else:
        final_status = "completed"  # Partial success
        error_msg = f"{failed} of {total} submissions failed"
    
    logger.info(f"Finalizing job {job_id}: {final_status} ({submitted} submitted, {failed} failed, {skipped} skipped)")
    
    set_job_status(job_id, final_status, error_msg)
    record_history(job_id, None, "job_finalized", {
        "final_status": final_status,
        "total": total,
        "submitted": submitted,
        "failed": failed,
        "skipped": skipped
    })
