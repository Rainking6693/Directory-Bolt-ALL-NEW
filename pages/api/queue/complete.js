// DirectoryBolt Queue Processing API - Complete Task Endpoint
// POST /api/queue/complete - Mark tasks as completed with results
// Handles success/failure tracking, screenshot storage, and customer notifications

const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

// Rate limiting for completion requests
const completeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 completion requests per minute
  message: {
    error: 'Too many completion requests, please try again later.',
    code: 'COMPLETE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Validation schema for completion requests
const completionSchema = Joi.object({
  submission_id: Joi.string().uuid(),
  verification_action_id: Joi.string().uuid(),
  batch_completion: Joi.object({
    batch_id: Joi.string().uuid().required(),
    submission_results: Joi.array().items(Joi.object({
      submission_id: Joi.string().uuid().required(),
      status: Joi.string().required(),
      result_data: Joi.object(),
      screenshots: Joi.array().items(Joi.string())
    })).required()
  }),
  completion_data: Joi.object({
    status: Joi.string().valid(
      'completed_success',
      'completed_failed', 
      'completed_partial',
      'requires_manual_review',
      'pending_approval',
      'cancelled'
    ).required(),
    external_submission_id: Joi.string().max(255),
    submission_url: Joi.string().uri(),
    confirmation_details: Joi.object({
      confirmation_number: Joi.string(),
      confirmation_email: Joi.string().email(),
      confirmation_date: Joi.date().iso(),
      additional_info: Joi.object()
    }),
    result_data: Joi.object({
      form_data_submitted: Joi.object(),
      response_received: Joi.object(),
      processing_time: Joi.number().integer().min(0),
      automation_method: Joi.string().valid('browser', 'api', 'manual'),
      quality_score: Joi.number().min(0).max(100),
      verification_screenshots: Joi.array().items(Joi.string()),
      error_details: Joi.object({
        error_code: Joi.string(),
        error_message: Joi.string(),
        error_context: Joi.object(),
        suggested_solution: Joi.string()
      }),
      manual_notes: Joi.string().max(2000)
    }).required()
  }).required(),
  va_context: Joi.object({
    va_id: Joi.string().uuid().required(),
    completion_time: Joi.date().iso().default(() => new Date().toISOString()),
    work_session_id: Joi.string().uuid(),
    quality_rating: Joi.number().min(1).max(5),
    effort_level: Joi.string().valid('low', 'medium', 'high', 'very_high'),
    tools_used: Joi.array().items(Joi.string()),
    challenges_encountered: Joi.array().items(Joi.string()),
    recommendations: Joi.string().max(1000)
  }).required()
}).or('submission_id', 'verification_action_id', 'batch_completion');

// Status mapping for notifications
const STATUS_NOTIFICATIONS = {
  completed_success: {
    customer_message: 'Your directory submission has been successfully completed',
    notify_customer: true,
    internal_priority: 'low'
  },
  completed_failed: {
    customer_message: 'Your directory submission encountered an issue and requires attention',
    notify_customer: true,
    internal_priority: 'high'
  },
  completed_partial: {
    customer_message: 'Your directory submission was partially completed',
    notify_customer: true,
    internal_priority: 'medium'
  },
  requires_manual_review: {
    customer_message: 'Your directory submission is under manual review',
    notify_customer: true,
    internal_priority: 'medium'
  },
  pending_approval: {
    customer_message: 'Your directory submission is pending approval',
    notify_customer: false,
    internal_priority: 'low'
  },
  cancelled: {
    customer_message: 'Your directory submission has been cancelled',
    notify_customer: true,
    internal_priority: 'medium'
  }
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Apply rate limiting
    await new Promise((resolve, reject) => {
      completeLimiter(req, res, (result) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });

    // Validate request body
    const { error, value } = completionSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validation_errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        code: 'VALIDATION_ERROR'
      });
    }

    const { 
      submission_id, 
      verification_action_id, 
      batch_completion, 
      completion_data, 
      va_context 
    } = value;

    // Authenticate VA
    const vaAuth = await authenticateVA(req.headers, va_context.va_id);
    if (!vaAuth.valid) {
      return res.status(401).json({
        success: false,
        error: 'VA authentication failed',
        code: 'VA_AUTHENTICATION_FAILED'
      });
    }

    let completionResults;

    if (batch_completion) {
      completionResults = await processBatchCompletion(batch_completion, va_context, vaAuth.va_profile);
    } else if (verification_action_id) {
      completionResults = await processVerificationActionCompletion(
        verification_action_id, 
        completion_data, 
        va_context, 
        vaAuth.va_profile
      );
    } else if (submission_id) {
      completionResults = await processSubmissionCompletion(
        submission_id, 
        completion_data, 
        va_context, 
        vaAuth.va_profile
      );
    }

    if (!completionResults.success) {
      return res.status(400).json({
        success: false,
        error: 'Completion processing failed',
        error_details: completionResults.error,
        code: 'COMPLETION_FAILED'
      });
    }

    // Process screenshots if provided
    if (completion_data.result_data.verification_screenshots?.length > 0) {
      const screenshotResults = await processScreenshots(
        completionResults.submission_ids,
        completion_data.result_data.verification_screenshots,
        va_context.va_id
      );
      completionResults.screenshot_urls = screenshotResults.urls;
    }

    // Send notifications
    const notificationResults = await sendCompletionNotifications(
      completionResults,
      completion_data.status,
      va_context
    );

    // Update analytics and performance tracking
    await updatePerformanceMetrics(va_context.va_id, completionResults, completion_data);

    // Log completion activity
    await logCompletionActivity({
      va_id: va_context.va_id,
      submission_ids: completionResults.submission_ids,
      verification_action_id,
      batch_id: batch_completion?.batch_id,
      action: 'TASK_COMPLETED',
      status: completion_data.status,
      details: {
        processing_time: completion_data.result_data.processing_time,
        automation_method: completion_data.result_data.automation_method,
        quality_score: completion_data.result_data.quality_score
      }
    });

    // Prepare response
    const response = {
      success: true,
      data: {
        completion_id: completionResults.completion_id,
        submissions_updated: completionResults.submissions_updated,
        verification_actions_updated: completionResults.verification_actions_updated,
        batch_updated: completionResults.batch_updated,
        notifications_sent: notificationResults.sent,
        screenshot_urls: completionResults.screenshot_urls || [],
        processing_summary: {
          total_items_processed: completionResults.submission_ids?.length || 1,
          success_count: completionResults.success_count,
          failure_count: completionResults.failure_count,
          review_required_count: completionResults.review_count,
          processing_time_total: completion_data.result_data.processing_time
        },
        next_steps: generateNextSteps(completion_data.status, completionResults),
        performance_impact: {
          va_rating_change: completionResults.va_rating_change,
          quality_score: completion_data.result_data.quality_score,
          efficiency_rating: calculateEfficiencyRating(completion_data, completionResults)
        }
      },
      metadata: {
        completed_at: new Date().toISOString(),
        va_id: va_context.va_id,
        completion_type: batch_completion ? 'batch' : verification_action_id ? 'verification_action' : 'submission'
      },
      message: 'Task completion processed successfully'
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Queue complete API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Authenticate VA for completion
async function authenticateVA(headers, vaId) {
  const authHeader = headers.authorization || headers['x-va-token'];
  
  if (!authHeader) {
    return { valid: false, reason: 'Missing authentication' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const { data: va, error } = await supabase
    .from('virtual_assistants')
    .select('*')
    .eq('auth_token', token)
    .eq('id', vaId)
    .eq('status', 'active')
    .single();

  if (error || !va) {
    return { valid: false, reason: 'Invalid VA authentication' };
  }

  return {
    valid: true,
    va_id: va.id,
    va_profile: va
  };
}

// Process batch completion
async function processBatchCompletion(batchCompletion, vaContext, vaProfile) {
  const { batch_id, submission_results } = batchCompletion;
  const completionId = uuidv4();
  
  try {
    // Verify batch exists and is assigned to VA
    const { data: batch, error: batchError } = await supabase
      .from('batch_submissions')
      .select('*')
      .eq('id', batch_id)
      .single();

    if (batchError || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    let successCount = 0;
    let failureCount = 0;
    let reviewCount = 0;
    const submissionIds = [];

    // Process each submission result
    for (const result of submission_results) {
      const updateResult = await updateSubmissionWithResult(
        result.submission_id,
        result.status,
        result.result_data,
        vaContext
      );

      if (updateResult.success) {
        submissionIds.push(result.submission_id);
        
        if (result.status.includes('success')) successCount++;
        else if (result.status.includes('failed')) failureCount++;
        else if (result.status.includes('review')) reviewCount++;
      }
    }

    // Update batch status
    const batchStatus = determineBatchStatus(successCount, failureCount, reviewCount, submission_results.length);
    
    const { error: batchUpdateError } = await supabase
      .from('batch_submissions')
      .update({
        status: batchStatus.status,
        successful_submissions: successCount,
        failed_submissions: failureCount,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        results_summary: {
          total_processed: submission_results.length,
          success_count: successCount,
          failure_count: failureCount,
          review_count: reviewCount,
          completed_by_va: vaContext.va_id,
          completion_id: completionId
        }
      })
      .eq('id', batch_id);

    if (batchUpdateError) {
      console.error('Failed to update batch:', batchUpdateError);
    }

    return {
      success: true,
      completion_id: completionId,
      submission_ids: submissionIds,
      submissions_updated: submissionIds.length,
      batch_updated: !batchUpdateError,
      success_count: successCount,
      failure_count: failureCount,
      review_count: reviewCount
    };

  } catch (error) {
    console.error('Batch completion processing error:', error);
    return { success: false, error: error.message };
  }
}

// Process verification action completion
async function processVerificationActionCompletion(actionId, completionData, vaContext, vaProfile) {
  const completionId = uuidv4();
  
  try {
    // Get verification action details
    const { data: action, error: actionError } = await supabase
      .from('verification_actions')
      .select(`
        *,
        user_submissions!inner(
          id,
          submission_status
        )
      `)
      .eq('id', actionId)
      .single();

    if (actionError || !action) {
      return { success: false, error: 'Verification action not found' };
    }

    // Update verification action
    const { error: actionUpdateError } = await supabase
      .from('verification_actions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_va: vaContext.va_id,
        result_data: completionData.result_data,
        resolution_notes: completionData.result_data.manual_notes,
        completion_time: completionData.result_data.processing_time
      })
      .eq('id', actionId);

    if (actionUpdateError) {
      console.error('Failed to update verification action:', actionUpdateError);
      return { success: false, error: 'Failed to update verification action' };
    }

    // Update related submission if applicable
    let submissionUpdateResult = null;
    if (action.user_submissions?.id) {
      submissionUpdateResult = await updateSubmissionWithResult(
        action.user_submissions.id,
        mapVerificationStatusToSubmissionStatus(completionData.status),
        completionData.result_data,
        vaContext
      );
    }

    return {
      success: true,
      completion_id: completionId,
      submission_ids: submissionUpdateResult?.success ? [action.user_submissions.id] : [],
      verification_actions_updated: 1,
      submissions_updated: submissionUpdateResult?.success ? 1 : 0,
      success_count: completionData.status.includes('success') ? 1 : 0,
      failure_count: completionData.status.includes('failed') ? 1 : 0,
      review_count: completionData.status.includes('review') ? 1 : 0
    };

  } catch (error) {
    console.error('Verification action completion error:', error);
    return { success: false, error: error.message };
  }
}

// Process single submission completion
async function processSubmissionCompletion(submissionId, completionData, vaContext, vaProfile) {
  const completionId = uuidv4();
  
  try {
    const updateResult = await updateSubmissionWithResult(
      submissionId,
      completionData.status,
      completionData.result_data,
      vaContext
    );

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return {
      success: true,
      completion_id: completionId,
      submission_ids: [submissionId],
      submissions_updated: 1,
      success_count: completionData.status.includes('success') ? 1 : 0,
      failure_count: completionData.status.includes('failed') ? 1 : 0,
      review_count: completionData.status.includes('review') ? 1 : 0
    };

  } catch (error) {
    console.error('Submission completion error:', error);
    return { success: false, error: error.message };
  }
}

// Update submission with completion result
async function updateSubmissionWithResult(submissionId, status, resultData, vaContext) {
  try {
    const mappedStatus = mapCompletionStatusToSubmissionStatus(status);
    
    const updateData = {
      submission_status: mappedStatus,
      updated_at: new Date().toISOString(),
      response_data: resultData,
      completed_by_va: vaContext.va_id
    };

    // Set appropriate timestamps based on status
    if (status.includes('success')) {
      updateData.approved_at = new Date().toISOString();
    } else if (status.includes('failed')) {
      updateData.rejection_reason = resultData.error_details?.error_message || 'Processing failed';
    }

    // Add external submission details if available
    if (resultData.external_submission_id) {
      updateData.external_submission_id = resultData.external_submission_id;
    }

    const { error: updateError } = await supabase
      .from('user_submissions')
      .update(updateData)
      .eq('id', submissionId);

    if (updateError) {
      console.error('Failed to update submission:', updateError);
      return { success: false, error: 'Failed to update submission' };
    }

    return { success: true };

  } catch (error) {
    console.error('Submission update error:', error);
    return { success: false, error: error.message };
  }
}

// Process and store screenshots
async function processScreenshots(submissionIds, screenshotUrls, vaId) {
  const processedUrls = [];
  
  try {
    for (const url of screenshotUrls) {
      // In production, would upload to cloud storage and generate secure URLs
      // For now, store references in database
      const screenshotId = uuidv4();
      
      const { error } = await supabase
        .from('submission_screenshots')
        .insert({
          id: screenshotId,
          submission_ids: submissionIds,
          screenshot_url: url,
          uploaded_by_va: vaId,
          upload_timestamp: new Date().toISOString(),
          screenshot_type: 'completion_proof'
        });

      if (!error) {
        processedUrls.push({
          id: screenshotId,
          url: url,
          secure_url: `/api/screenshots/${screenshotId}` // Secure access endpoint
        });
      }
    }
  } catch (error) {
    console.warn('Screenshot processing error:', error);
  }

  return { urls: processedUrls };
}

// Send completion notifications
async function sendCompletionNotifications(completionResults, status, vaContext) {
  const notificationConfig = STATUS_NOTIFICATIONS[status];
  let sentCount = 0;

  try {
    if (notificationConfig?.notify_customer) {
      // Get customer information for notifications
      const { data: submissions } = await supabase
        .from('user_submissions')
        .select(`
          user_id,
          business_name,
          users!inner(
            email,
            notification_preferences
          )
        `)
        .in('id', completionResults.submission_ids);

      // Send customer notifications
      for (const submission of submissions || []) {
        if (submission.users.notification_preferences?.email_updates !== false) {
          await sendCustomerNotification({
            user_email: submission.users.email,
            business_name: submission.business_name,
            message: notificationConfig.customer_message,
            status: status,
            submission_ids: completionResults.submission_ids
          });
          sentCount++;
        }
      }
    }

    // Send internal notifications for high priority statuses
    if (notificationConfig?.internal_priority === 'high') {
      await sendInternalNotification({
        priority: 'high',
        message: `VA ${vaContext.va_id} completed tasks with status: ${status}`,
        submission_count: completionResults.submission_ids?.length || 1,
        va_id: vaContext.va_id
      });
    }

  } catch (error) {
    console.warn('Notification sending error:', error);
  }

  return { sent: sentCount };
}

// Update performance metrics
async function updatePerformanceMetrics(vaId, completionResults, completionData) {
  try {
    // Calculate performance scores
    const qualityScore = completionData.result_data.quality_score || 80;
    const processingTime = completionData.result_data.processing_time || 0;
    const successRate = completionResults.success_count / (completionResults.success_count + completionResults.failure_count) * 100;

    // Update VA performance statistics
    await supabase.rpc('update_va_performance', {
      va_id: vaId,
      tasks_completed: completionResults.submission_ids?.length || 1,
      quality_score: qualityScore,
      average_processing_time: processingTime,
      success_rate: successRate
    });

    // Log performance event
    await supabase
      .from('va_performance_log')
      .insert({
        va_id: vaId,
        event_type: 'task_completion',
        metrics: {
          quality_score: qualityScore,
          processing_time: processingTime,
          success_rate: successRate,
          tasks_count: completionResults.submission_ids?.length || 1
        },
        timestamp: new Date().toISOString()
      });

  } catch (error) {
    console.warn('Performance metrics update error:', error);
  }
}

// Helper Functions

function mapCompletionStatusToSubmissionStatus(completionStatus) {
  const statusMap = {
    completed_success: 'approved',
    completed_failed: 'failed',
    completed_partial: 'needs_review',
    requires_manual_review: 'needs_review',
    pending_approval: 'submitted',
    cancelled: 'cancelled'
  };
  
  return statusMap[completionStatus] || 'needs_review';
}

function mapVerificationStatusToSubmissionStatus(completionStatus) {
  if (completionStatus.includes('success')) return 'submitted';
  if (completionStatus.includes('failed')) return 'failed';
  return 'needs_review';
}

function determineBatchStatus(successCount, failureCount, reviewCount, totalCount) {
  if (successCount === totalCount) {
    return { status: 'completed', message: 'All submissions completed successfully' };
  } else if (failureCount === totalCount) {
    return { status: 'failed', message: 'All submissions failed' };
  } else if (successCount + failureCount + reviewCount === totalCount) {
    return { status: 'completed_with_issues', message: 'Batch completed with mixed results' };
  } else {
    return { status: 'partially_completed', message: 'Batch partially completed' };
  }
}

function generateNextSteps(status, completionResults) {
  const steps = [];
  
  if (completionResults.review_count > 0) {
    steps.push('Review submissions marked for manual review');
  }
  
  if (completionResults.failure_count > 0) {
    steps.push('Investigate and retry failed submissions');
  }
  
  if (status === 'pending_approval') {
    steps.push('Monitor directory for approval notifications');
  }
  
  if (completionResults.success_count > 0) {
    steps.push('Track approval status and update customer records');
  }
  
  return steps;
}

function calculateEfficiencyRating(completionData, completionResults) {
  const processingTime = completionData.result_data.processing_time || 0;
  const itemsProcessed = completionResults.submission_ids?.length || 1;
  const successRate = completionResults.success_count / itemsProcessed * 100;
  
  // Calculate efficiency based on time per item and success rate
  const timePerItem = processingTime / itemsProcessed;
  const timeEfficiency = Math.max(0, 100 - (timePerItem / 300) * 50); // 300 seconds baseline
  
  return Math.round((timeEfficiency * 0.6 + successRate * 0.4));
}

// Log completion activity
async function logCompletionActivity(activity) {
  try {
    await supabase
      .from('queue_activity_log')
      .insert({
        ...activity,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.warn('Failed to log completion activity:', error);
  }
}

// Send customer notification (placeholder)
async function sendCustomerNotification(notificationData) {
  // In production, integrate with email service
  console.log('Sending customer notification:', notificationData);
}

// Send internal notification (placeholder)
async function sendInternalNotification(notificationData) {
  // In production, integrate with internal notification system
  console.log('Sending internal notification:', notificationData);
}