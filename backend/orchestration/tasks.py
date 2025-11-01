"""Prefect tasks for directory submissions."""
import os
import time
from typing import Dict, List, Any, Optional
from prefect import task, get_run_logger
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
from utils.logging import setup_logger

logger = setup_logger(__name__)

# AI services (optional - only if enabled)
enable_ai_features = os.getenv('ENABLE_AI_FEATURES', 'true').lower() == 'true'
enable_content_customization = os.getenv('ENABLE_CONTENT_CUSTOMIZATION', 'true').lower() == 'true'
enable_ab_testing = os.getenv('ENABLE_AB_TESTING', 'true').lower() == 'true'

# Initialize AI services at module level
description_customizer: Optional[Any] = None
submission_orchestrator: Optional[Any] = None
ab_testing: Optional[Any] = None
ai_enabled = False

if enable_ai_features:
    try:
        from ai.description_customizer import DescriptionCustomizer
        from ai.submission_orchestrator import AISubmissionOrchestrator
        from ai.ab_testing_framework import ABTestingFramework
        
        description_customizer = DescriptionCustomizer() if enable_content_customization else None
        submission_orchestrator = AISubmissionOrchestrator() if enable_ai_features else None
        ab_testing = ABTestingFramework() if enable_ab_testing else None
        ai_enabled = True
        logger.info("AI services initialized successfully")
    except ImportError as e:
        logger.warning(f"AI services not available (import error): {e}")
        description_customizer = None
        submission_orchestrator = None
        ab_testing = None
        ai_enabled = False
    except Exception as e:
        logger.warning(f"AI services initialization failed: {e}")
        description_customizer = None
        submission_orchestrator = None
        ab_testing = None
        ai_enabled = False
else:
    logger.info("AI features disabled via environment variable")


@task(name="mark_in_progress")
def mark_in_progress(job_id: str) -> None:
    """
    Mark job as in_progress.
    
    Args:
        job_id: UUID of the job (must be non-empty string)
    
    Raises:
        ValueError: If job_id is invalid
    """
    # Input validation
    if not job_id or not isinstance(job_id, str) or len(job_id.strip()) == 0:
        raise ValueError("job_id must be a non-empty string")
    
    logger = get_run_logger()
    logger.info(f"Marking job {job_id} as in_progress")
    
    try:
        set_job_status(job_id, "in_progress")
        record_history(job_id, None, "job_started", {})
    except ValueError as e:
        logger.error(f"Invalid job_id in mark_in_progress: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to mark job as in_progress: {e}")
        raise


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
async def submit_directory(job_id: str, directory: str, priority: str = "starter") -> Dict[str, Any]:
    """
    Submit business to a single directory with idempotency and retries.
    
    Args:
        job_id: UUID of the job (must be non-empty string)
        directory: Directory name/domain (must be non-empty string)
        priority: Package priority for rate limiting (starter, pro, enterprise)
    
    Returns:
        Dict with status, directory, and duration_ms
    
    Raises:
        ValueError: If inputs are invalid
        RuntimeError: If critical operations fail
    """
    # Input validation
    if not job_id or not isinstance(job_id, str) or len(job_id.strip()) == 0:
        raise ValueError("job_id must be a non-empty string")
    if not directory or not isinstance(directory, str) or len(directory.strip()) == 0:
        raise ValueError("directory must be a non-empty string")
    
    valid_priorities = ["starter", "pro", "enterprise"]
    if priority not in valid_priorities:
        logger = get_run_logger()
        logger.warning(f"Invalid priority '{priority}', defaulting to 'starter'")
        priority = "starter"
    
    logger = get_run_logger()
    logger.info(f"Processing {directory} for job {job_id}", extra={"priority": priority})
    
    business: Optional[Dict[str, Any]] = None
    
    try:
        # Get business profile
        try:
            business = get_business_profile(job_id)
        except ValueError as e:
            logger.error(f"Invalid job_id when fetching business profile: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to fetch business profile: {e}")
            raise RuntimeError(f"Failed to fetch business profile: {e}")
        
        if not business or not isinstance(business, dict) or not business.get("business_name"):
            logger.error(f"No business profile found for job {job_id}")
            try:
                record_history(job_id, directory, "error_no_profile", {})
            except Exception as e:
                logger.warning(f"Failed to record error_no_profile history: {e}")
            return {"status": "failed", "reason": "no_business_profile", "directory": directory}
        
        # AI: A/B Test Assignment (if enabled)
        ab_test_assignments = {}
        if ai_enabled and ab_testing:
            try:
                directory_info = get_directory_info(directory)
                submission_data = {
                    'submission_id': f"{job_id}_{directory}",
                    'business_id': business.get('id', job_id),
                    'directory_id': directory_info.get('id', directory) if directory_info else directory,
                    'business_category': business.get('category', ''),
                    'business': business,
                    'directory': directory_info if directory_info else {'id': directory}
                }
                
                ab_test_result = await ab_testing.assign_submission_to_variant(submission_data, [])
                if ab_test_result and ab_test_result.get('assignments'):
                    ab_test_assignments = ab_test_result['assignments']
                    logger.info(f"AI: Assigned to {ab_test_result.get('experiment_count', 0)} A/B test experiments")
                    try:
                        record_history(job_id, directory, "ab_test_assigned", {
                            'experiment_count': ab_test_result.get('experiment_count', 0),
                            'assignments': list(ab_test_assignments.keys())
                        })
                    except Exception as e:
                        logger.warning(f"Failed to record A/B test assignment history: {e}")
            except Exception as e:
                logger.warning(f"AI A/B testing assignment failed for {directory}: {e}")
        
        # AI: Customize description for this directory (if enabled)
        if ai_enabled and description_customizer:
            try:
                directory_info = get_directory_info(directory)
                original_description = business.get("business_description") or business.get("description") or ""
                
                if directory_info and original_description:
                    # Validate customization request
                    if not isinstance(directory_info, dict):
                        raise ValueError("Invalid directory_info format")
                    
                    customization_request = {
                        'directory_id': directory_info.get('id', directory),
                        'business_data': business,
                        'original_description': original_description
                    }
                    
                    # Properly await async method
                    customization_result = await description_customizer.customize_description(customization_request)
                    
                    if customization_result and isinstance(customization_result, dict) and customization_result.get('primary_customization'):
                        customized = customization_result['primary_customization']
                        if isinstance(customized, dict) and 'description' in customized:
                            business['business_description'] = customized.get('description', original_description)
                            
                            confidence = customized.get('confidence', 0)
                            logger.info(f"AI: Customized description for {directory} (confidence: {confidence*100:.1f}%)")
                            try:
                                record_history(job_id, directory, "ai_content_customized", {
                                    'original_length': len(original_description),
                                    'customized_length': len(business['business_description']),
                                    'confidence': confidence
                                })
                            except Exception as e:
                                logger.warning(f"Failed to record AI customization history: {e}")
            except ValueError as e:
                logger.warning(f"Invalid input for AI customization: {e}")
                # Continue with original description
            except Exception as e:
                logger.warning(f"AI description customization failed for {directory}: {e}", extra={"error_type": type(e).__name__})
                # Continue with original description
        
        # Get submission plan from CrewAI brain
        logger.info(f"Getting plan from CrewAI for {directory}")
        try:
            plan = await get_plan(directory, business)
            if not plan or not isinstance(plan, dict):
                raise ValueError("Invalid plan response format")
        except ValueError as e:
            logger.error(f"Invalid plan response: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to get plan: {e}")
            raise RuntimeError(f"Failed to get submission plan: {e}")
        
        # Generate idempotency key
        idem_factors = plan.get("idempotency_factors", {})
        if not idem_factors:
            idem_factors = {
                "name": business.get("business_name", ""),
                "dir": directory
            }
        idem = make_idempotency_key(job_id, directory, idem_factors)
        
        # Pre-write to prevent duplicates on retry
        logger.info(f"Checking idempotency for {directory}")
        try:
            dup_status = upsert_job_result(
                job_id=job_id,
                directory=directory,
                status="submitting",
                idem=idem,
                payload={"business": business, "plan": plan}
            )
        except Exception as e:
            logger.error(f"Failed to check idempotency: {e}")
            raise RuntimeError(f"Failed to check idempotency: {e}")
        
        if dup_status == "duplicate_success":
            logger.info(f"Skipping {directory} - already successfully submitted")
            try:
                record_history(job_id, directory, "skipped_duplicate", {"idem": idem})
            except Exception as e:
                logger.warning(f"Failed to record skipped_duplicate history: {e}")
            return {"status": "skipped", "directory": directory}
        
        # Record submission attempt
        try:
            record_history(job_id, directory, "submitting", {"idem": idem})
        except Exception as e:
            logger.warning(f"Failed to record submitting history: {e}")
        
        # Apply rate limiting based on priority
        constraints = plan.get("constraints", {})
        rate_limit_ms = constraints.get("rateLimitMs", 1500)
        if not isinstance(rate_limit_ms, (int, float)) or rate_limit_ms < 0:
            rate_limit_ms = 1500
        
        if priority == "enterprise":
            rate_limit_ms = max(rate_limit_ms * 0.5, 500)  # Faster for enterprise
        elif priority == "starter":
            rate_limit_ms = rate_limit_ms * 1.5  # Slower for starter
        
        # Use asyncio.sleep instead of time.sleep in async function
        import asyncio
        await asyncio.sleep(rate_limit_ms / 1000.0)
        
        # Execute submission with Playwright
        logger.info(f"Executing submission to {directory}")
        try:
            result = run_plan(job_id, directory, plan, business)
            if not result or not isinstance(result, dict):
                raise ValueError("Invalid result format from run_plan")
        except ValueError as e:
            logger.error(f"Invalid result from run_plan: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to execute submission: {e}")
            raise RuntimeError(f"Failed to execute submission: {e}")
        
        # Update result in database
        try:
            upsert_job_result(
                job_id=job_id,
                directory=directory,
                status=result.get("status", "unknown"),
                idem=idem,
                response_log=result.get("response_log", {}),
                error_message=result.get("error_message")
            )
        except Exception as e:
            logger.error(f"Failed to update job result: {e}")
            # Continue execution - don't fail the task if DB update fails
        
        # AI: Record A/B test results (if enabled)
        if ai_enabled and ab_testing and ab_test_assignments:
            try:
                outcome = {
                    'status': 'approved' if result.get("status") == "submitted" else 'rejected',
                    'submission_id': f"{job_id}_{directory}",
                    'directory_id': directory_info.get('id', directory) if directory_info else directory,
                    'submission_date': time.time(),
                    'processing_time': result.get("duration_ms")
                }
                metadata = {
                    'business_category': business.get('category', ''),
                    'job_id': job_id
                }
                await ab_testing.record_experiment_result(f"{job_id}_{directory}", outcome, metadata)
                logger.info(f"AI: Recorded A/B test results for {directory}")
            except Exception as e:
                logger.warning(f"Failed to record A/B test results: {e}")
        
        # Record outcome
        try:
            record_history(job_id, directory, result.get("status", "unknown"), {
                "idem": idem,
                "duration_ms": result.get("duration_ms"),
                "screenshot_url": result.get("screenshot_url")
            })
        except Exception as e:
            logger.warning(f"Failed to record outcome history: {e}")
        
        logger.info(f"Completed {directory} with status: {result.get('status', 'unknown')}")
        
        # AI: Analyze failure and recommend retry if submission failed
        if result.get('status') == 'failed' and ai_enabled:
            try:
                from ai.retry_analyzer import IntelligentRetryAnalyzer
                retry_analyzer = IntelligentRetryAnalyzer()
                
                directory_info = get_directory_info(directory)
                failure_data = {
                    'submission_id': f"{job_id}_{directory}",
                    'directory_id': directory_info.get('id', directory) if directory_info and isinstance(directory_info, dict) else directory,
                    'business_name': business.get('business_name', '') if business else '',
                    'business_category': business.get('business_category', '') if business else '',
                    'business_description': business.get('business_description', '') if business else '',
                    'rejection_reason': result.get('error_message', 'Submission failed'),
                    'error_message': result.get('error_message', ''),
                    'status': 'failed',
                    'attempt_number': 1,
                    'submitted_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }
                
                # Properly await async method
                retry_analysis = await retry_analyzer.analyze_failure_and_recommend_retry(failure_data)
                
                if retry_analysis and isinstance(retry_analysis, dict) and retry_analysis.get('retry_recommendation'):
                    retry_probability = retry_analysis.get('retry_probability', {})
                    probability = retry_probability.get('probability', 0) if isinstance(retry_probability, dict) else 0
                    
                    logger.info(f"AI: Retry recommended for {directory} (probability: {probability*100:.1f}%)")
                    try:
                        record_history(job_id, directory, "ai_retry_recommended", {
                            'retry_probability': probability,
                            'retry_date': retry_analysis.get('optimal_timing', {}).get('retry_date') if isinstance(retry_analysis.get('optimal_timing'), dict) else None,
                            'failure_category': retry_analysis.get('failure_analysis', {}).get('category') if isinstance(retry_analysis.get('failure_analysis'), dict) else None
                        })
                    except Exception as e:
                        logger.warning(f"Failed to record AI retry recommendation: {e}")
                    # TODO: Schedule retry based on optimal_timing
            except ImportError as e:
                logger.warning(f"AI retry analyzer not available: {e}")
            except ValueError as e:
                logger.warning(f"Invalid input for AI retry analysis: {e}")
            except Exception as e:
                logger.warning(f"AI retry analysis failed for {directory}: {e}", extra={"error_type": type(e).__name__})
        
        return {
            "status": result.get("status", "unknown"),
            "directory": directory,
            "duration_ms": result.get("duration_ms")
        }
        
    except ValueError as e:
        logger.error(f"Invalid input error submitting to {directory}: {e}")
        try:
            record_history(job_id, directory, "error", {"error": str(e), "error_type": "ValueError"})
        except Exception:
            pass
        raise
    except RuntimeError as e:
        logger.error(f"Runtime error submitting to {directory}: {e}")
        try:
            record_history(job_id, directory, "error", {"error": str(e), "error_type": "RuntimeError"})
        except Exception:
            pass
        raise
    except Exception as e:
        logger.error(f"Error submitting to {directory}: {e}", extra={"error_type": type(e).__name__})
        try:
            record_history(job_id, directory, "error", {"error": str(e), "error_type": type(e).__name__})
        except Exception:
            pass
        
        # AI: Analyze error for retry recommendation
        if ai_enabled:
            try:
                from ai.retry_analyzer import IntelligentRetryAnalyzer
                retry_analyzer = IntelligentRetryAnalyzer()
                
                directory_info = get_directory_info(directory) if directory else None
                failure_data = {
                    'submission_id': f"{job_id}_{directory}",
                    'directory_id': directory_info.get('id', directory) if directory_info and isinstance(directory_info, dict) else directory,
                    'business_name': business.get('business_name', '') if business and isinstance(business, dict) else '',
                    'rejection_reason': str(e),
                    'error_message': str(e),
                    'status': 'error',
                    'attempt_number': 1
                }
                
                # Properly await async method
                retry_analysis = await retry_analyzer.analyze_failure_and_recommend_retry(failure_data)
                logger.info(f"AI: Error analysis for {directory} - Retry: {retry_analysis.get('retry_recommendation', False) if isinstance(retry_analysis, dict) else False}")
            except Exception as e:
                logger.debug(f"AI retry analysis error (non-critical): {e}")
        
        # Update as failed
        try:
            upsert_job_result(
                job_id=job_id,
                directory=directory,
                status="failed",
                idem=make_idempotency_key(job_id, directory, {"error": True}),
                error_message=str(e)
            )
        except Exception as e:
            logger.warning(f"Failed to update job result on error: {e}")
        
        # Re-raise for Prefect retry logic
        raise


@task(name="finalize_job")
def finalize_job(job_id: str, results: List[Dict[str, Any]]) -> None:
    """
    Finalize job based on task results.
    
    Args:
        job_id: UUID of the job (must be non-empty string)
        results: List of result dicts from submit_directory tasks
    
    Raises:
        ValueError: If job_id is invalid
    """
    # Input validation
    if not job_id or not isinstance(job_id, str) or len(job_id.strip()) == 0:
        raise ValueError("job_id must be a non-empty string")
    
    if not isinstance(results, list):
        raise ValueError("results must be a list")
    
    logger = get_run_logger()
    
    if not results:
        logger.warning(f"No results for job {job_id}, marking as failed")
        try:
            set_job_status(job_id, "failed", "No directories processed")
            record_history(job_id, None, "job_failed", {"reason": "no_results"})
        except Exception as e:
            logger.error(f"Failed to finalize job with no results: {e}")
        return
    
    # Calculate stats
    total = len(results)
    submitted = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "submitted")
    failed = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "failed")
    skipped = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "skipped")
    
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
    
    try:
        set_job_status(job_id, final_status, error_msg)
        record_history(job_id, None, "job_finalized", {
            "final_status": final_status,
            "total": total,
            "submitted": submitted,
            "failed": failed,
            "skipped": skipped
        })
    except ValueError as e:
        logger.error(f"Invalid job_id in finalize_job: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to finalize job: {e}")
        raise RuntimeError(f"Failed to finalize job: {e}")
