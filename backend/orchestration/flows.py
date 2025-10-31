"""Prefect flows for job orchestration."""
import os
from prefect import flow, get_run_logger
from .tasks import mark_in_progress, list_directories_for_job, submit_directory, finalize_job
from db.dao import record_history

# AI services (optional - only if enabled)
ENABLE_AI_FEATURES = os.getenv('ENABLE_AI_FEATURES', 'true').lower() == 'true'
if ENABLE_AI_FEATURES:
    try:
        from ai.probability_calculator import SuccessProbabilityCalculator
        from ai.timing_optimizer import SubmissionTimingOptimizer
        from ai.retry_analyzer import IntelligentRetryAnalyzer
        
        probability_calculator = SuccessProbabilityCalculator()
        timing_optimizer = SubmissionTimingOptimizer()
        retry_analyzer = IntelligentRetryAnalyzer()
        ai_enabled = True
    except Exception as e:
        print(f"Warning: AI services not available: {e}")
        ai_enabled = False
else:
    ai_enabled = False


@flow(name="process_job", retries=0, log_prints=True)
async def process_job(job_id: str, customer_id: str, package_size: int, priority: str = "starter"):
    """
    Main flow for processing a directory submission job.
    
    Args:
        job_id: UUID of the job
        customer_id: UUID of the customer
        package_size: Number of directories to submit
        priority: Package priority (starter, pro, enterprise)
    
    Returns:
        Dict with summary of results
    """
    logger = get_run_logger()
    logger.info(f"Starting job {job_id} for customer {customer_id}")
    
    # Record flow start
    record_history(job_id, None, "flow_started", {
        "customer_id": customer_id,
        "package_size": package_size,
        "priority": priority
    })
    
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
    if ai_enabled:
        try:
            from db.dao import get_business_profile, get_directory_info
            
            business = get_business_profile(job_id)
            if business:
                # Score directories by success probability
                directory_scores = []
                for directory_id in directories:
                    try:
                        directory = get_directory_info(directory_id)
                        if directory:
                            submission_data = {
                                'business': business,
                                'directory': directory
                            }
                            probability_result = await probability_calculator.calculate_success_probability(submission_data)
                            directory_scores.append({
                                'directory': directory_id,
                                'probability': probability_result.get('probability', 0.5),
                                'confidence': probability_result.get('confidence', 0.5)
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
                record_history(job_id, None, "ai_prioritization", {
                    'sorted_directories': [ds['directory'] for ds in directory_scores[:5]],
                    'top_probability': directory_scores[0]['probability'] if directory_scores else 0.5
                })
        except Exception as e:
            logger.warning(f"AI prioritization failed, using original order: {e}")
    
    # Submit to each directory in parallel (Prefect handles concurrency)
    # Use submit() for parallel execution, then await results
    task_results = []
    for directory in directories:
        task_result = submit_directory.submit(job_id, directory, priority)
        task_results.append(task_result)
    
    # Wait for all tasks to complete
    completed_results = []
    for task_result in task_results:
        result = await task_result.get()
        completed_results.append(result)
    
    # Finalize job based on results
    finalize_job(job_id, completed_results)
    
    # Calculate summary
    summary = {
        "status": "completed",
        "total": len(completed_results),
        "submitted": sum(1 for r in completed_results if r.get("status") == "submitted"),
        "failed": sum(1 for r in completed_results if r.get("status") == "failed"),
        "skipped": sum(1 for r in completed_results if r.get("status") == "skipped")
    }
    
    logger.info(f"Job {job_id} completed", extra=summary)
    record_history(job_id, None, "flow_completed", summary)
    
    return summary
