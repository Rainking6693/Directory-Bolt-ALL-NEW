// DirectoryBolt Queue Processing API - Retry Endpoint
// PUT /api/queue/retry - Failure recovery and retry mechanisms
// Handles automatic retry scheduling, manual retry triggers, and rate limiting

const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

// Rate limiting for retry requests
const retryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 retry requests per hour
  message: {
    error: 'Too many retry requests, please try again later.',
    code: 'RETRY_RATE_LIMIT_EXCEEDED'
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

// Validation schema for retry requests
const retrySchema = Joi.object({
  submission_id: Joi.string().uuid(),
  batch_id: Joi.string().uuid(),
  verification_action_id: Joi.string().uuid(),
  retry_multiple: Joi.object({
    submission_ids: Joi.array().items(Joi.string().uuid()).max(50),
    verification_action_ids: Joi.array().items(Joi.string().uuid()).max(50),
    filter_criteria: Joi.object({
      failure_type: Joi.string(),
      directory_category: Joi.string(),
      min_retry_count: Joi.number().integer().min(0),
      max_retry_count: Joi.number().integer().max(10),
      failed_after: Joi.date().iso()
    })
  }),
  retry_config: Joi.object({
    retry_type: Joi.string().valid('automatic', 'manual', 'scheduled').default('manual'),
    retry_delay: Joi.number().integer().min(300).max(86400).default(3600), // 5 min to 24 hours
    scheduled_retry_time: Joi.date().iso(),
    priority_boost: Joi.number().integer().min(0).max(2).default(1),
    method_override: Joi.string().valid('browser', 'api', 'hybrid'),
    max_retry_attempts: Joi.number().integer().min(1).max(10).default(3),
    escalate_after_attempts: Joi.number().integer().min(1).max(5).default(3),
    retry_reason: Joi.string().max(500)
  }).default({}),
  failure_analysis: Joi.object({
    analyze_failure: Joi.boolean().default(true),
    failure_patterns: Joi.array().items(Joi.string()),
    root_cause: Joi.string().max(500),
    suggested_solution: Joi.string().max(500),
    requires_manual_intervention: Joi.boolean().default(false)
  }).default({}),
  system_context: Joi.object({
    initiated_by: Joi.string().valid('admin', 'va', 'scheduler', 'customer', 'system').required(),
    initiator_id: Joi.string().uuid(),
    retry_context: Joi.string().max(200),
    business_justification: Joi.string().max(500)
  }).required()
}).or('submission_id', 'batch_id', 'verification_action_id', 'retry_multiple');

// Failure type classifications and retry strategies
const FAILURE_STRATEGIES = {
  network_timeout: {
    default_delay: 1800, // 30 minutes
    max_attempts: 5,
    delay_multiplier: 2.0,
    method_preference: ['api', 'browser'],
    escalate_after: 3
  },
  captcha_failed: {
    default_delay: 600, // 10 minutes
    max_attempts: 3,
    delay_multiplier: 1.0,
    method_preference: ['browser'],
    escalate_after: 2
  },
  form_validation_error: {
    default_delay: 3600, // 1 hour
    max_attempts: 4,
    delay_multiplier: 1.5,
    method_preference: ['browser'],
    escalate_after: 2
  },
  site_maintenance: {
    default_delay: 7200, // 2 hours
    max_attempts: 8,
    delay_multiplier: 1.0,
    method_preference: ['api', 'browser'],
    escalate_after: 4
  },
  authentication_failed: {
    default_delay: 3600, // 1 hour
    max_attempts: 3,
    delay_multiplier: 1.0,
    method_preference: ['manual'],
    escalate_after: 1
  },
  rate_limited: {
    default_delay: 14400, // 4 hours
    max_attempts: 6,
    delay_multiplier: 1.5,
    method_preference: ['browser'],
    escalate_after: 3
  },
  unknown_error: {
    default_delay: 3600, // 1 hour
    max_attempts: 3,
    delay_multiplier: 1.5,
    method_preference: ['browser'],
    escalate_after: 2
  }
};

export default async function handler(req, res) {
  // Only allow PUT requests
  if (req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Apply rate limiting
    await new Promise((resolve, reject) => {
      retryLimiter(req, res, (result) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });

    // Validate request body
    const { error, value } = retrySchema.validate(req.body, {
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
      batch_id,
      verification_action_id,
      retry_multiple,
      retry_config,
      failure_analysis,
      system_context
    } = value;

    // Authenticate request based on initiator
    const authResult = await authenticateRetryRequest(system_context, req.headers);
    if (!authResult.valid) {
      return res.status(401).json({
        success: false,
        error: 'Retry request authentication failed',
        code: 'AUTHENTICATION_FAILED'
      });
    }

    // Collect items to retry
    let itemsToRetry = [];
    
    if (retry_multiple) {
      itemsToRetry = await collectMultipleRetryItems(retry_multiple);
    } else {
      const singleItem = await collectSingleRetryItem({
        submission_id,
        batch_id,
        verification_action_id
      });
      if (singleItem) {
        itemsToRetry = [singleItem];
      }
    }

    if (itemsToRetry.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No eligible items found for retry',
        code: 'NO_RETRY_ITEMS_FOUND'
      });
    }

    // Validate retry eligibility
    const eligibilityCheck = await validateRetryEligibility(itemsToRetry, retry_config);
    if (!eligibilityCheck.all_eligible) {
      return res.status(400).json({
        success: false,
        error: 'Some items are not eligible for retry',
        ineligible_items: eligibilityCheck.ineligible_items,
        eligible_count: eligibilityCheck.eligible_count,
        code: 'RETRY_ELIGIBILITY_FAILED'
      });
    }

    // Analyze failures and determine retry strategy
    const failureAnalysisResults = failure_analysis.analyze_failure ? 
      await analyzeFailurePatterns(itemsToRetry, failure_analysis) : null;

    // Process retries
    const retryResults = await processRetries(
      itemsToRetry,
      retry_config,
      failureAnalysisResults,
      system_context,
      authResult.user_context
    );

    if (!retryResults.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process retries',
        error_details: retryResults.error,
        code: 'RETRY_PROCESSING_FAILED'
      });
    }

    // Log retry activity
    await logRetryActivity({
      initiated_by: system_context.initiated_by,
      initiator_id: system_context.initiator_id,
      action: 'RETRY_INITIATED',
      items_count: itemsToRetry.length,
      retry_type: retry_config.retry_type,
      details: {
        retry_reason: retry_config.retry_reason,
        failure_analysis: failureAnalysisResults?.summary,
        business_justification: system_context.business_justification
      }
    });

    // Prepare response
    const response = {
      success: true,
      data: {
        retry_job_id: retryResults.retry_job_id,
        items_scheduled_for_retry: retryResults.retry_count,
        items_escalated: retryResults.escalation_count,
        items_failed_to_schedule: retryResults.failed_count,
        retry_summary: {
          total_items: itemsToRetry.length,
          scheduled_retries: retryResults.retry_count,
          immediate_retries: retryResults.immediate_count,
          scheduled_for_later: retryResults.delayed_count,
          escalated_to_manual: retryResults.escalation_count
        },
        scheduling_details: {
          retry_type: retry_config.retry_type,
          average_delay_minutes: Math.round(retryResults.average_delay / 60),
          next_retry_times: retryResults.next_retry_times,
          priority_boosts_applied: retryResults.priority_boosts
        },
        failure_analysis: failureAnalysisResults,
        monitoring: {
          status_endpoint: `/api/queue/status`,
          retry_job_status: `/api/queue/retry-status/${retryResults.retry_job_id}`,
          estimated_completion: retryResults.estimated_completion
        }
      },
      metadata: {
        initiated_at: new Date().toISOString(),
        initiated_by: system_context.initiated_by,
        retry_context: system_context.retry_context
      },
      message: 'Retry process initiated successfully'
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Queue retry API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Authenticate retry request
async function authenticateRetryRequest(systemContext, headers) {
  const { initiated_by, initiator_id } = systemContext;

  if (initiated_by === 'admin') {
    const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return { valid: false, reason: 'Invalid admin API key' };
    }
  } else if (initiated_by === 'va') {
    const vaToken = headers['x-va-token'] || headers['authorization']?.replace('Bearer ', '');
    const { data: va } = await supabase
      .from('virtual_assistants')
      .select('id, name')
      .eq('auth_token', vaToken)
      .eq('id', initiator_id)
      .single();
    
    if (!va) {
      return { valid: false, reason: 'Invalid VA authentication' };
    }
  } else if (initiated_by === 'customer') {
    // Validate customer JWT token
    const customerToken = headers['authorization']?.replace('Bearer ', '');
    // Implement JWT validation for customer requests
  }

  return { 
    valid: true, 
    user_context: { 
      type: initiated_by, 
      id: initiator_id 
    }
  };
}

// Collect single retry item
async function collectSingleRetryItem(params) {
  const { submission_id, batch_id, verification_action_id } = params;

  if (submission_id) {
    const { data: submission } = await supabase
      .from('user_submissions')
      .select(`
        id,
        submission_status,
        retry_count,
        max_retries,
        notes,
        response_data,
        directories!inner(id, name)
      `)
      .eq('id', submission_id)
      .single();

    if (submission) {
      return {
        type: 'submission',
        id: submission.id,
        current_status: submission.submission_status,
        retry_count: submission.retry_count,
        max_retries: submission.max_retries,
        failure_data: extractFailureData(submission),
        directory_info: submission.directories
      };
    }
  }

  if (verification_action_id) {
    const { data: action } = await supabase
      .from('verification_actions')
      .select(`
        id,
        status,
        attempts,
        max_attempts,
        context_data,
        submission_id
      `)
      .eq('id', verification_action_id)
      .single();

    if (action) {
      return {
        type: 'verification_action',
        id: action.id,
        current_status: action.status,
        retry_count: action.attempts,
        max_retries: action.max_attempts,
        failure_data: action.context_data?.error_details || {},
        submission_id: action.submission_id
      };
    }
  }

  if (batch_id) {
    const { data: failedSubmissions } = await supabase
      .from('user_submissions')
      .select(`
        id,
        submission_status,
        retry_count,
        max_retries,
        notes,
        response_data,
        directories!inner(id, name)
      `)
      .eq('batch_id', batch_id)
      .in('submission_status', ['failed', 'needs_review']);

    return failedSubmissions?.map(submission => ({
      type: 'submission',
      id: submission.id,
      current_status: submission.submission_status,
      retry_count: submission.retry_count,
      max_retries: submission.max_retries,
      failure_data: extractFailureData(submission),
      directory_info: submission.directories,
      batch_id: batch_id
    })) || [];
  }

  return null;
}

// Collect multiple retry items
async function collectMultipleRetryItems(retryMultiple) {
  const { submission_ids, verification_action_ids, filter_criteria } = retryMultiple;
  const items = [];

  if (submission_ids?.length > 0) {
    const { data: submissions } = await supabase
      .from('user_submissions')
      .select(`
        id,
        submission_status,
        retry_count,
        max_retries,
        notes,
        response_data,
        directories!inner(id, name)
      `)
      .in('id', submission_ids);

    submissions?.forEach(submission => {
      items.push({
        type: 'submission',
        id: submission.id,
        current_status: submission.submission_status,
        retry_count: submission.retry_count,
        max_retries: submission.max_retries,
        failure_data: extractFailureData(submission),
        directory_info: submission.directories
      });
    });
  }

  if (verification_action_ids?.length > 0) {
    const { data: actions } = await supabase
      .from('verification_actions')
      .select(`
        id,
        status,
        attempts,
        max_attempts,
        context_data,
        submission_id
      `)
      .in('id', verification_action_ids);

    actions?.forEach(action => {
      items.push({
        type: 'verification_action',
        id: action.id,
        current_status: action.status,
        retry_count: action.attempts,
        max_retries: action.max_attempts,
        failure_data: action.context_data?.error_details || {},
        submission_id: action.submission_id
      });
    });
  }

  // Apply filter criteria if provided
  if (filter_criteria) {
    return items.filter(item => {
      if (filter_criteria.min_retry_count && item.retry_count < filter_criteria.min_retry_count) {
        return false;
      }
      if (filter_criteria.max_retry_count && item.retry_count > filter_criteria.max_retry_count) {
        return false;
      }
      if (filter_criteria.failure_type && !item.failure_data.error_code?.includes(filter_criteria.failure_type)) {
        return false;
      }
      return true;
    });
  }

  return items;
}

// Validate retry eligibility
async function validateRetryEligibility(items, retryConfig) {
  const eligibleItems = [];
  const ineligibleItems = [];

  items.forEach(item => {
    const issues = [];

    // Check retry count limits
    if (item.retry_count >= item.max_retries) {
      issues.push(`Maximum retry attempts (${item.max_retries}) exceeded`);
    }

    // Check if item is in a retryable state
    const nonRetryableStates = ['approved', 'cancelled', 'completed_success'];
    if (nonRetryableStates.includes(item.current_status)) {
      issues.push(`Current status '${item.current_status}' is not retryable`);
    }

    // Check for manual intervention requirements
    if (item.failure_data.requires_manual_intervention) {
      issues.push('Requires manual intervention');
    }

    if (issues.length === 0) {
      eligibleItems.push(item);
    } else {
      ineligibleItems.push({
        id: item.id,
        type: item.type,
        issues: issues
      });
    }
  });

  return {
    all_eligible: ineligibleItems.length === 0,
    eligible_count: eligibleItems.length,
    ineligible_items: ineligibleItems,
    eligible_items: eligibleItems
  };
}

// Analyze failure patterns
async function analyzeFailurePatterns(items, analysisConfig) {
  const failureTypes = {};
  const patterns = [];
  let totalFailures = 0;

  items.forEach(item => {
    if (item.failure_data) {
      totalFailures++;
      const errorCode = item.failure_data.error_code || 'unknown_error';
      failureTypes[errorCode] = (failureTypes[errorCode] || 0) + 1;
    }
  });

  // Identify common patterns
  Object.entries(failureTypes).forEach(([type, count]) => {
    if (count > 1) {
      patterns.push({
        type: type,
        count: count,
        percentage: Math.round((count / totalFailures) * 100),
        recommended_strategy: FAILURE_STRATEGIES[type] || FAILURE_STRATEGIES.unknown_error
      });
    }
  });

  return {
    summary: {
      total_failures_analyzed: totalFailures,
      unique_failure_types: Object.keys(failureTypes).length,
      most_common_failure: Object.keys(failureTypes).reduce((a, b) => 
        failureTypes[a] > failureTypes[b] ? a : b, 'unknown_error'),
      patterns_found: patterns.length
    },
    failure_type_breakdown: failureTypes,
    identified_patterns: patterns,
    recommendations: generateFailureRecommendations(patterns, analysisConfig)
  };
}

// Process retries
async function processRetries(items, retryConfig, failureAnalysis, systemContext, userContext) {
  const retryJobId = uuidv4();
  let retryCount = 0;
  let escalationCount = 0;
  let failedCount = 0;
  let immediateCount = 0;
  let delayedCount = 0;
  const nextRetryTimes = [];
  const priorityBoosts = [];

  try {
    // Create retry job record
    const { data: retryJob, error: jobError } = await supabase
      .from('retry_jobs')
      .insert({
        id: retryJobId,
        initiated_by: systemContext.initiated_by,
        initiator_id: systemContext.initiator_id,
        total_items: items.length,
        retry_type: retryConfig.retry_type,
        configuration: {
          retry_config: retryConfig,
          failure_analysis: failureAnalysis,
          system_context: systemContext
        },
        status: 'processing'
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create retry job: ${jobError.message}`);
    }

    // Process each item
    for (const item of items) {
      try {
        const retryStrategy = determineRetryStrategy(item, retryConfig, failureAnalysis);
        
        if (retryStrategy.action === 'retry') {
          const retryResult = await scheduleRetry(item, retryStrategy, retryJobId);
          
          if (retryResult.success) {
            retryCount++;
            nextRetryTimes.push({
              item_id: item.id,
              next_retry: retryResult.next_retry_time
            });
            
            if (retryStrategy.delay === 0) {
              immediateCount++;
            } else {
              delayedCount++;
            }
            
            if (retryStrategy.priority_boost > 0) {
              priorityBoosts.push({
                item_id: item.id,
                boost_amount: retryStrategy.priority_boost
              });
            }
          } else {
            failedCount++;
          }
        } else if (retryStrategy.action === 'escalate') {
          await escalateToManual(item, retryStrategy.reason, retryJobId);
          escalationCount++;
        }
      } catch (itemError) {
        console.error(`Failed to process retry for item ${item.id}:`, itemError);
        failedCount++;
      }
    }

    // Update retry job with results
    await supabase
      .from('retry_jobs')
      .update({
        status: 'completed',
        processed_items: retryCount + escalationCount,
        successful_retries: retryCount,
        escalated_items: escalationCount,
        failed_items: failedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', retryJobId);

    // Calculate average delay and estimated completion
    const totalDelay = nextRetryTimes.reduce((sum, item) => {
      const delay = new Date(item.next_retry) - new Date();
      return sum + Math.max(0, delay / 1000);
    }, 0);
    
    const averageDelay = nextRetryTimes.length > 0 ? totalDelay / nextRetryTimes.length : 0;
    const estimatedCompletion = new Date();
    estimatedCompletion.setSeconds(estimatedCompletion.getSeconds() + averageDelay + 1800); // Add 30 min buffer

    return {
      success: true,
      retry_job_id: retryJobId,
      retry_count: retryCount,
      escalation_count: escalationCount,
      failed_count: failedCount,
      immediate_count: immediateCount,
      delayed_count: delayedCount,
      average_delay: averageDelay,
      next_retry_times: nextRetryTimes,
      priority_boosts: priorityBoosts,
      estimated_completion: estimatedCompletion.toISOString()
    };

  } catch (error) {
    console.error('Retry processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Determine retry strategy for item
function determineRetryStrategy(item, retryConfig, failureAnalysis) {
  const failureType = item.failure_data.error_code || 'unknown_error';
  const strategy = FAILURE_STRATEGIES[failureType] || FAILURE_STRATEGIES.unknown_error;
  
  // Check if should escalate
  if (item.retry_count >= strategy.escalate_after) {
    return {
      action: 'escalate',
      reason: `Exceeded escalation threshold (${strategy.escalate_after} attempts)`
    };
  }

  // Calculate retry delay
  let delay = retryConfig.retry_delay || strategy.default_delay;
  if (retryConfig.retry_type === 'automatic') {
    delay = Math.min(delay * Math.pow(strategy.delay_multiplier, item.retry_count), 86400); // Max 24 hours
  }

  // Determine priority boost
  let priorityBoost = retryConfig.priority_boost || 0;
  if (item.retry_count > 1) {
    priorityBoost += Math.min(item.retry_count - 1, 2); // Max +2 priority boost
  }

  return {
    action: 'retry',
    delay: delay,
    method: retryConfig.method_override || strategy.method_preference[0],
    priority_boost: priorityBoost,
    max_attempts: Math.min(retryConfig.max_retry_attempts, strategy.max_attempts)
  };
}

// Schedule retry for item
async function scheduleRetry(item, strategy, retryJobId) {
  try {
    const nextRetryTime = new Date();
    nextRetryTime.setSeconds(nextRetryTime.getSeconds() + strategy.delay);

    if (item.type === 'submission') {
      const { error } = await supabase
        .from('user_submissions')
        .update({
          submission_status: 'queued',
          retry_count: item.retry_count + 1,
          next_retry_at: nextRetryTime.toISOString(),
          priority: Math.max(1, (item.priority || 3) - strategy.priority_boost),
          metadata: {
            ...item.metadata,
            retry_job_id: retryJobId,
            retry_method: strategy.method,
            retry_reason: strategy.reason
          }
        })
        .eq('id', item.id);

      if (error) throw error;
    } else if (item.type === 'verification_action') {
      const { error } = await supabase
        .from('verification_actions')
        .update({
          status: 'pending',
          attempts: item.retry_count + 1,
          deadline: nextRetryTime.toISOString(),
          context_data: {
            ...item.context_data,
            retry_job_id: retryJobId,
            retry_method: strategy.method
          }
        })
        .eq('id', item.id);

      if (error) throw error;
    }

    return {
      success: true,
      next_retry_time: nextRetryTime.toISOString()
    };

  } catch (error) {
    console.error('Retry scheduling error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Escalate item to manual processing
async function escalateToManual(item, reason, retryJobId) {
  try {
    // Create manual intervention record
    await supabase
      .from('manual_interventions')
      .insert({
        id: uuidv4(),
        item_type: item.type,
        item_id: item.id,
        escalation_reason: reason,
        retry_job_id: retryJobId,
        status: 'pending',
        priority: 'high',
        created_at: new Date().toISOString()
      });

    // Update original item status
    if (item.type === 'submission') {
      await supabase
        .from('user_submissions')
        .update({
          submission_status: 'needs_manual_review',
          notes: `Escalated: ${reason}`
        })
        .eq('id', item.id);
    } else if (item.type === 'verification_action') {
      await supabase
        .from('verification_actions')
        .update({
          status: 'escalated',
          context_data: {
            ...item.context_data,
            escalation_reason: reason,
            escalation_time: new Date().toISOString()
          }
        })
        .eq('id', item.id);
    }

  } catch (error) {
    console.error('Escalation error:', error);
    throw error;
  }
}

// Helper Functions

function extractFailureData(submission) {
  const failureData = submission.response_data?.error_details || {};
  const notes = submission.notes || '';
  
  return {
    error_code: failureData.error_code || extractErrorCodeFromNotes(notes),
    error_message: failureData.error_message || notes,
    timestamp: submission.updated_at,
    requires_manual_intervention: failureData.requires_manual_intervention || false
  };
}

function extractErrorCodeFromNotes(notes) {
  if (!notes) return 'unknown_error';
  
  const lowerNotes = notes.toLowerCase();
  if (lowerNotes.includes('timeout')) return 'network_timeout';
  if (lowerNotes.includes('captcha')) return 'captcha_failed';
  if (lowerNotes.includes('validation')) return 'form_validation_error';
  if (lowerNotes.includes('maintenance')) return 'site_maintenance';
  if (lowerNotes.includes('auth')) return 'authentication_failed';
  if (lowerNotes.includes('rate limit')) return 'rate_limited';
  
  return 'unknown_error';
}

function generateFailureRecommendations(patterns, analysisConfig) {
  const recommendations = [];
  
  patterns.forEach(pattern => {
    const strategy = pattern.recommended_strategy;
    recommendations.push({
      failure_type: pattern.type,
      recommendation: `Use ${strategy.method_preference[0]} method with ${strategy.default_delay}s delay`,
      confidence: pattern.percentage > 30 ? 'high' : pattern.percentage > 15 ? 'medium' : 'low',
      expected_success_rate: calculateExpectedSuccessRate(pattern.type, strategy)
    });
  });
  
  return recommendations;
}

function calculateExpectedSuccessRate(failureType, strategy) {
  const successRates = {
    network_timeout: 75,
    captcha_failed: 60,
    form_validation_error: 85,
    site_maintenance: 90,
    authentication_failed: 40,
    rate_limited: 80,
    unknown_error: 65
  };
  
  return successRates[failureType] || 65;
}

// Log retry activity
async function logRetryActivity(activity) {
  try {
    await supabase
      .from('queue_activity_log')
      .insert({
        ...activity,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.warn('Failed to log retry activity:', error);
  }
}