// DirectoryBolt Queue Processing API - Status Tracking Endpoint
// GET /api/queue/status - Real-time progress tracking for customers
// Provides batch processing status, ETA calculations, and detailed progress

const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

// Rate limiting for status checks
const statusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 status checks per minute
  message: {
    error: 'Too many status requests, please try again later.',
    code: 'STATUS_RATE_LIMIT_EXCEEDED'
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

// Validation schema for status requests
const statusQuerySchema = Joi.object({
  batch_id: Joi.string().uuid(),
  user_id: Joi.string().uuid(),
  submission_id: Joi.string().uuid(),
  include_details: Joi.boolean().default(false),
  include_timeline: Joi.boolean().default(false),
  include_analytics: Joi.boolean().default(false)
}).or('batch_id', 'submission_id').required();

// Status update intervals for different scenarios
const STATUS_UPDATE_INTERVALS = {
  queued: 5 * 60, // 5 minutes
  processing: 2 * 60, // 2 minutes  
  submitted: 15 * 60, // 15 minutes
  completed: null // No updates needed
};

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Apply rate limiting
    await new Promise((resolve, reject) => {
      statusLimiter(req, res, (result) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });

    // Validate query parameters
    const { error, value } = statusQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        validation_errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        })),
        code: 'VALIDATION_ERROR'
      });
    }

    const { batch_id, user_id, submission_id, include_details, include_timeline, include_analytics } = value;

    let statusData;

    if (batch_id) {
      statusData = await getBatchStatus(batch_id, user_id, {
        include_details,
        include_timeline,
        include_analytics
      });
    } else if (submission_id) {
      statusData = await getSubmissionStatus(submission_id, user_id, {
        include_details,
        include_timeline
      });
    }

    if (!statusData) {
      return res.status(404).json({
        success: false,
        error: 'Queue item not found or access denied',
        code: 'QUEUE_ITEM_NOT_FOUND'
      });
    }

    // Calculate next update recommendation
    const nextUpdateIn = calculateNextUpdateTime(statusData.status);

    res.json({
      success: true,
      data: statusData,
      metadata: {
        last_updated: new Date().toISOString(),
        next_update_recommended: nextUpdateIn ? new Date(Date.now() + nextUpdateIn * 1000).toISOString() : null,
        update_interval_seconds: nextUpdateIn
      }
    });

  } catch (error) {
    console.error('Queue status API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Get comprehensive batch status
async function getBatchStatus(batchId, userId, options = {}) {
  // Get batch details
  const { data: batch, error: batchError } = await supabase
    .from('batch_submissions')
    .select('*')
    .eq('id', batchId)
    .eq('user_id', userId)
    .single();

  if (batchError || !batch) {
    return null;
  }

  // Get all submissions in this batch
  const { data: submissions, error: submissionsError } = await supabase
    .from('user_submissions')
    .select(`
      id,
      directory_id,
      submission_status,
      priority,
      retry_count,
      max_retries,
      created_at,
      updated_at,
      submitted_at,
      approved_at,
      rejection_reason,
      notes,
      next_retry_at,
      estimated_start_time,
      metadata,
      directories!inner(
        id,
        name,
        website,
        da_score,
        success_rate,
        estimated_processing_time,
        categories!inner(
          display_name,
          slug
        )
      )
    `)
    .eq('batch_id', batchId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (submissionsError) {
    console.error('Failed to fetch submissions:', submissionsError);
    return null;
  }

  // Calculate comprehensive statistics
  const stats = calculateBatchStatistics(submissions);
  
  // Calculate progress and ETA
  const progressData = calculateProgressAndETA(submissions, batch);

  const result = {
    batch_id: batchId,
    batch_name: batch.batch_name,
    status: batch.status,
    created_at: batch.created_at,
    started_at: batch.started_at,
    completed_at: batch.completed_at,
    progress: progressData,
    statistics: stats,
    subscription_info: {
      tier: batch.configuration?.subscription_tier,
      processing_priority: batch.configuration?.priority_level
    }
  };

  // Add detailed submission information if requested
  if (options.include_details) {
    result.submissions = submissions.map(submission => ({
      id: submission.id,
      directory: {
        id: submission.directories.id,
        name: submission.directories.name,
        website: submission.directories.website,
        da_score: submission.directories.da_score,
        success_rate: submission.directories.success_rate,
        category: submission.directories.categories.display_name
      },
      status: submission.submission_status,
      priority: submission.priority,
      progress: calculateSubmissionProgress(submission),
      timing: {
        created_at: submission.created_at,
        estimated_start: submission.estimated_start_time,
        submitted_at: submission.submitted_at,
        approved_at: submission.approved_at,
        processing_time: calculateProcessingTime(submission)
      },
      retry_info: {
        retry_count: submission.retry_count,
        max_retries: submission.max_retries,
        next_retry_at: submission.next_retry_at
      },
      issues: {
        rejection_reason: submission.rejection_reason,
        notes: submission.notes
      }
    }));
  }

  // Add timeline if requested
  if (options.include_timeline) {
    result.timeline = await getBatchTimeline(batchId);
  }

  // Add analytics if requested
  if (options.include_analytics) {
    result.analytics = await getBatchAnalytics(batchId, submissions);
  }

  return result;
}

// Get individual submission status
async function getSubmissionStatus(submissionId, userId, options = {}) {
  const { data: submission, error: submissionError } = await supabase
    .from('user_submissions')
    .select(`
      *,
      batch_submissions!inner(
        id,
        batch_name,
        user_id
      ),
      directories!inner(
        id,
        name,
        website,
        da_score,
        success_rate,
        estimated_processing_time,
        categories!inner(
          display_name,
          slug
        )
      )
    `)
    .eq('id', submissionId)
    .eq('batch_submissions.user_id', userId)
    .single();

  if (submissionError || !submission) {
    return null;
  }

  const progress = calculateSubmissionProgress(submission);
  
  const result = {
    submission_id: submissionId,
    batch_info: {
      batch_id: submission.batch_submissions.id,
      batch_name: submission.batch_submissions.batch_name
    },
    directory: {
      id: submission.directories.id,
      name: submission.directories.name,
      website: submission.directories.website,
      da_score: submission.directories.da_score,
      success_rate: submission.directories.success_rate,
      category: submission.directories.categories.display_name,
      estimated_processing_time: submission.directories.estimated_processing_time
    },
    status: submission.submission_status,
    priority: submission.priority,
    progress: progress,
    timing: {
      created_at: submission.created_at,
      updated_at: submission.updated_at,
      estimated_start: submission.estimated_start_time,
      submitted_at: submission.submitted_at,
      approved_at: submission.approved_at,
      processing_time: calculateProcessingTime(submission),
      eta: calculateSubmissionETA(submission)
    },
    retry_info: {
      retry_count: submission.retry_count,
      max_retries: submission.max_retries,
      next_retry_at: submission.next_retry_at,
      can_retry: submission.retry_count < submission.max_retries
    },
    results: {
      external_submission_id: submission.external_submission_id,
      rejection_reason: submission.rejection_reason,
      notes: submission.notes,
      response_data: submission.response_data
    },
    metadata: submission.metadata
  };

  // Add timeline if requested
  if (options.include_timeline) {
    result.timeline = await getSubmissionTimeline(submissionId);
  }

  return result;
}

// Calculate comprehensive batch statistics
function calculateBatchStatistics(submissions) {
  const total = submissions.length;
  const statusCounts = {
    queued: 0,
    processing: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
    cancelled: 0,
    needs_review: 0
  };

  let totalProcessingTime = 0;
  let completedItems = 0;

  submissions.forEach(submission => {
    const status = submission.submission_status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (['approved', 'rejected'].includes(status)) {
      completedItems++;
      const processingTime = calculateProcessingTime(submission);
      if (processingTime) {
        totalProcessingTime += processingTime;
      }
    }
  });

  const successRate = completedItems > 0 ? 
    Math.round((statusCounts.approved / completedItems) * 100) : 0;

  const averageProcessingTime = completedItems > 0 ? 
    Math.round(totalProcessingTime / completedItems) : 0;

  return {
    total,
    completed: statusCounts.approved + statusCounts.rejected + statusCounts.failed,
    pending: total - (statusCounts.approved + statusCounts.rejected + statusCounts.failed),
    status_breakdown: statusCounts,
    success_rate: successRate,
    average_processing_time_minutes: Math.round(averageProcessingTime / 60),
    performance: {
      fastest_submission: getFastestSubmissionTime(submissions),
      slowest_submission: getSlowestSubmissionTime(submissions),
      retry_rate: Math.round((submissions.filter(s => s.retry_count > 0).length / total) * 100)
    }
  };
}

// Calculate progress and ETA for batch
function calculateProgressAndETA(submissions, batch) {
  const total = submissions.length;
  const completed = submissions.filter(s => 
    ['approved', 'rejected', 'failed'].includes(s.submission_status)
  ).length;
  const processing = submissions.filter(s => 
    s.submission_status === 'processing'
  ).length;

  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate ETA based on current processing rate
  const eta = calculateBatchETA(submissions, batch);

  return {
    percentage: progressPercentage,
    completed_count: completed,
    processing_count: processing,
    remaining_count: total - completed - processing,
    estimated_completion_time: eta,
    phase: determineProcessingPhase(progressPercentage, batch.status)
  };
}

// Calculate individual submission progress
function calculateSubmissionProgress(submission) {
  const statusProgress = {
    queued: 0,
    processing: 25,
    submitted: 50,
    approved: 100,
    rejected: 100,
    failed: 100,
    cancelled: 100,
    needs_review: 75
  };

  const baseProgress = statusProgress[submission.submission_status] || 0;
  
  // Add retry penalty
  const retryPenalty = submission.retry_count * 5;
  
  return Math.max(0, Math.min(100, baseProgress - retryPenalty));
}

// Calculate processing time in seconds
function calculateProcessingTime(submission) {
  if (!submission.created_at) return null;
  
  const startTime = new Date(submission.created_at);
  const endTime = submission.approved_at || submission.updated_at;
  
  if (!endTime) return null;
  
  return Math.round((new Date(endTime) - startTime) / 1000);
}

// Calculate ETA for individual submission
function calculateSubmissionETA(submission) {
  if (['approved', 'rejected', 'failed'].includes(submission.submission_status)) {
    return null; // Already completed
  }

  const estimatedProcessingTime = submission.directories?.estimated_processing_time || 1800; // 30 minutes default
  const queuePosition = submission.metadata?.queue_position || 1;
  const baseDelay = queuePosition * 300; // 5 minutes per position

  const eta = new Date();
  eta.setSeconds(eta.getSeconds() + estimatedProcessingTime + baseDelay);
  
  return eta.toISOString();
}

// Calculate ETA for entire batch
function calculateBatchETA(submissions, batch) {
  const pendingSubmissions = submissions.filter(s => 
    !['approved', 'rejected', 'failed'].includes(s.submission_status)
  );

  if (pendingSubmissions.length === 0) {
    return batch.completed_at || new Date().toISOString();
  }

  // Calculate based on average processing time and concurrent capacity
  const avgProcessingTime = submissions
    .filter(s => s.directories?.estimated_processing_time)
    .reduce((sum, s) => sum + s.directories.estimated_processing_time, 0) / submissions.length || 1800;

  const maxConcurrent = 5; // Default concurrent capacity
  const remainingTime = (pendingSubmissions.length / maxConcurrent) * avgProcessingTime;

  const eta = new Date();
  eta.setSeconds(eta.getSeconds() + remainingTime);
  
  return eta.toISOString();
}

// Determine current processing phase
function determineProcessingPhase(progressPercentage, batchStatus) {
  if (batchStatus === 'completed') return 'completed';
  if (batchStatus === 'failed') return 'failed';
  if (batchStatus === 'cancelled') return 'cancelled';
  
  if (progressPercentage === 0) return 'initializing';
  if (progressPercentage < 25) return 'starting';
  if (progressPercentage < 75) return 'processing';
  if (progressPercentage < 100) return 'finishing';
  return 'completed';
}

// Get batch timeline
async function getBatchTimeline(batchId) {
  const { data: timeline, error } = await supabase
    .from('queue_activity_log')
    .select('*')
    .eq('batch_id', batchId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.warn('Failed to fetch timeline:', error);
    return [];
  }

  return timeline.map(event => ({
    timestamp: event.timestamp,
    action: event.action,
    details: event.details,
    description: formatTimelineEvent(event)
  }));
}

// Get submission timeline
async function getSubmissionTimeline(submissionId) {
  const { data: timeline, error } = await supabase
    .from('queue_activity_log')
    .select('*')
    .eq('submission_id', submissionId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.warn('Failed to fetch submission timeline:', error);
    return [];
  }

  return timeline.map(event => ({
    timestamp: event.timestamp,
    action: event.action,
    details: event.details,
    description: formatTimelineEvent(event)
  }));
}

// Get batch analytics
async function getBatchAnalytics(batchId, submissions) {
  const analytics = {
    directory_performance: {},
    category_breakdown: {},
    priority_analysis: {},
    time_analysis: {}
  };

  // Directory performance analysis
  const directoryGroups = submissions.reduce((acc, sub) => {
    const dirId = sub.directories.id;
    if (!acc[dirId]) {
      acc[dirId] = {
        name: sub.directories.name,
        submissions: [],
        success_rate: sub.directories.success_rate
      };
    }
    acc[dirId].submissions.push(sub);
    return acc;
  }, {});

  analytics.directory_performance = Object.entries(directoryGroups).map(([dirId, data]) => ({
    directory_id: dirId,
    directory_name: data.name,
    total_submissions: data.submissions.length,
    completed: data.submissions.filter(s => ['approved', 'rejected'].includes(s.submission_status)).length,
    success_rate: data.success_rate,
    actual_success_rate: calculateActualSuccessRate(data.submissions)
  }));

  return analytics;
}

// Helper functions
function getFastestSubmissionTime(submissions) {
  const processingTimes = submissions
    .map(calculateProcessingTime)
    .filter(time => time !== null);
    
  return processingTimes.length > 0 ? Math.min(...processingTimes) : null;
}

function getSlowestSubmissionTime(submissions) {
  const processingTimes = submissions
    .map(calculateProcessingTime)
    .filter(time => time !== null);
    
  return processingTimes.length > 0 ? Math.max(...processingTimes) : null;
}

function calculateActualSuccessRate(submissions) {
  const completed = submissions.filter(s => ['approved', 'rejected'].includes(s.submission_status));
  const approved = submissions.filter(s => s.submission_status === 'approved');
  
  return completed.length > 0 ? Math.round((approved.length / completed.length) * 100) : 0;
}

function formatTimelineEvent(event) {
  const actionDescriptions = {
    QUEUE_ADD: 'Added to processing queue',
    BATCH_START: 'Batch processing started',
    SUBMISSION_START: 'Individual submission processing started',
    SUBMISSION_COMPLETE: 'Submission completed',
    SUBMISSION_RETRY: 'Submission retried',
    BATCH_COMPLETE: 'Batch processing completed'
  };

  return actionDescriptions[event.action] || event.action;
}

function calculateNextUpdateTime(status) {
  return STATUS_UPDATE_INTERVALS[status] || 60; // Default 1 minute
}