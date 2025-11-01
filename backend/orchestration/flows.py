"""Prefect flows for job orchestration."""
import os
from typing import Dict, List, Optional, Any
from prefect import flow, get_run_logger
from .tasks import mark_in_progress, list_directories_for_job, submit_directory, finalize_job
from db.dao import record_history
from utils.logging import setup_logger

logger = setup_logger(__name__)

# AI services (optional - only if enabled)
# Using lowercase constant name per PEP 8
enable_ai_features = os.getenv('ENABLE_AI_FEATURES', 'true').lower() == 'true'

# Initialize AI services at module level
probability_calculator: Optional[Any] = None
timing_optimizer: Optional[Any] = None
retry_analyzer: Optional[Any] = None
ab_testing: Optional[Any] = None
performance_feedback: Optional[Any] = None
submission_orchestrator: Optional[Any] = None
ai_enabled = False

if enable_ai_features:
    try:
        from ai.probability_calculator import SuccessProbabilityCalculator
        from ai.timing_optimizer import SubmissionTimingOptimizer
        from ai.retry_analyzer import IntelligentRetryAnalyzer
        from ai.ab_testing_framework import ABTestingFramework
        from ai.performance_feedback import PerformanceFeedbackLoop
        from ai.submission_orchestrator import AISubmissionOrchestrator
        
        probability_calculator = SuccessProbabilityCalculator()
        timing_optimizer = SubmissionTimingOptimizer()
        retry_analyzer = IntelligentRetryAnalyzer()
        ab_testing = ABTestingFramework()
        performance_feedback = PerformanceFeedbackLoop()
        submission_orchestrator = AISubmissionOrchestrator()
        ai_enabled = True
        logger.info("AI services initialized successfully")
    except ImportError as e:
        logger.warning(f"AI services not available (import error): {e}")
        ai_enabled = False
    except Exception as e:
        logger.warning(f"AI services initialization failed: {e}")
        ai_enabled = False
else:
    logger.info("AI features disabled via environment variable")


@flow(name="process_job", retries=0, log_prints=True)
async def process_job(
    job_id: str, 
    customer_id: str, 
    package_size: int, 
    priority: str = "starter"
) -> Dict[str, Any]:
    """
    Main flow for processing a directory submission job.
    
    Args:
        job_id: UUID of the job
        customer_id: UUID of the customer
        package_size: Number of directories to submit
        priority: Package priority (starter, pro, enterprise)
    
    Returns:
        Dict with summary of results containing:
            - status: Job completion status
            - total: Total directories processed
            - submitted: Number successfully submitted
            - failed: Number that failed
            - skipped: Number skipped
    
    Raises:
        ValueError: If job_id or customer_id are invalid
    """
    # Input validation
    if not job_id or not isinstance(job_id, str) or len(job_id.strip()) == 0:
        raise ValueError("job_id must be a non-empty string")
    if not customer_id or not isinstance(customer_id, str) or len(customer_id.strip()) == 0:
        raise ValueError("customer_id must be a non-empty string")
    if not isinstance(package_size, int) or package_size < 0:
        raise ValueError("package_size must be a non-negative integer")
    
    logger = get_run_logger()
    logger.info(
        f"Starting job {job_id} for customer {customer_id}",
        extra={"job_id": job_id, "customer_id": customer_id, "package_size": package_size, "priority": priority}
    )
    
    # Record flow start (directory=None is valid for flow-level events)
    try:
        record_history(job_id, None, "flow_started", {
            "customer_id": customer_id,
            "package_size": package_size,
            "priority": priority
        })
    except Exception as e:
        logger.warning(f"Failed to record flow_started history: {e}")
    
    # Mark job as in progress
    mark_in_progress(job_id)
    
    # Get list of directories to submit
    directories = list_directories_for_job(job_id)
    logger.info(f"Found {len(directories)} directories to process")
    
    if not directories:
        logger.warning(f"No directories found for job {job_id}")
        record_history(job_id, None, "no_directories", {})
        finalize_job(job_id, [])
        return {"status": "failed", "reason": "no_directories", "results": []}
    
    # AI: Prioritize directories based on success probability (if enabled)
    if ai_enabled and probability_calculator:
        try:
            from db.dao import get_business_profile, get_directory_info
            
            business = get_business_profile(job_id)
            if business:
                # Score directories by success probability
                directory_scores: List[Dict[str, Any]] = []
                for directory_id in directories:
                    try:
                        directory = get_directory_info(directory_id)
                        if directory:
                            submission_data = {
                                'business': business,
                                'directory': directory
                            }
                            # Properly await async method
                            probability_result = await probability_calculator.calculate_success_probability(submission_data)
                            directory_scores.append({
                                'directory': directory_id,
                                'probability': probability_result.get('probability', 0.5),
                                'confidence': probability_result.get('confidence', 0.5)
                            })
                    except ValueError as e:
                        logger.warning(f"Invalid data for directory {directory_id}: {e}")
                        directory_scores.append({
                            'directory': directory_id,
                            'probability': 0.5,
                            'confidence': 0.3
                        })
                    except Exception as e:
                        logger.warning(f"Failed to calculate probability for {directory_id}: {e}")
                        directory_scores.append({
                            'directory': directory_id,
                            'probability': 0.5,
                            'confidence': 0.3
                        })
                
                # Sort by probability (highest first)
                directory_scores.sort(key=lambda x: x['probability'], reverse=True)
                directories = [ds['directory'] for ds in directory_scores]
                
                logger.info(f"AI: Prioritized {len(directories)} directories by success probability")
                try:
                    record_history(job_id, None, "ai_prioritization", {
                        'sorted_directories': [ds['directory'] for ds in directory_scores[:5]],
                        'top_probability': directory_scores[0]['probability'] if directory_scores else 0.5
                    })
                except Exception as e:
                    logger.warning(f"Failed to record AI prioritization history: {e}")
        except ValueError as e:
            logger.error(f"Invalid input for AI prioritization: {e}")
        except Exception as e:
            logger.warning(f"AI prioritization failed, using original order: {e}")
    
    # Submit to each directory in parallel (Prefect handles concurrency)
    # Use submit() for parallel execution, then await results
    task_results = []
    for directory in directories:
        task_result = submit_directory.submit(job_id, directory, priority)
        task_results.append(task_result)
    
    # Wait for all tasks to complete
    completed_results: List[Dict[str, Any]] = []
    for task_result in task_results:
        try:
            result = await task_result.get()
            completed_results.append(result)
        except Exception as e:
            logger.error(f"Task failed: {e}")
            completed_results.append({"status": "failed", "error": str(e)})
    
    # Finalize job based on results
    try:
        finalize_job(job_id, completed_results)
    except Exception as e:
        logger.error(f"Failed to finalize job: {e}")
    
    # Calculate summary
    summary = {
        "status": "completed",
        "total": len(completed_results),
        "submitted": sum(1 for r in completed_results if r.get("status") == "submitted"),
        "failed": sum(1 for r in completed_results if r.get("status") == "failed"),
        "skipped": sum(1 for r in completed_results if r.get("status") == "skipped")
    }
    
    logger.info(f"Job {job_id} completed", extra=summary)
    try:
        record_history(job_id, None, "flow_completed", summary)
    except Exception as e:
        logger.warning(f"Failed to record flow_completed history: {e}")
    
    return summary
