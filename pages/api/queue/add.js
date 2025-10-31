// DirectoryBolt Queue Processing API - Add to Queue Endpoint
// POST /api/queue/add - Customer enrollment in directory submission queue
// Handles business data validation, directory selection, and subscription tier integration

const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

// Rate limiting for queue additions
const queueAddLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 queue additions per hour
  message: {
    error: 'Too many queue additions, please try again later.',
    code: 'QUEUE_ADD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize Supabase client with service role key for full access
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

// Validation schema for queue addition requests
const queueAddSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  business_data: Joi.object({
    business_name: Joi.string().min(2).max(255).required(),
    business_description: Joi.string().max(2000),
    business_url: Joi.string().uri().required(),
    business_email: Joi.string().email().required(),
    business_phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/),
    business_address: Joi.string().max(500),
    business_category: Joi.string().max(100),
    business_logo_url: Joi.string().uri(),
    additional_info: Joi.object()
  }).required(),
  directory_selection: Joi.object({
    directory_ids: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
    categories: Joi.array().items(Joi.string()),
    priority_level: Joi.number().integer().min(1).max(5).default(3),
    target_da_range: Joi.object({
      min: Joi.number().min(0).max(100),
      max: Joi.number().min(0).max(100)
    }),
    exclude_directories: Joi.array().items(Joi.string().uuid())
  }).required(),
  processing_options: Joi.object({
    batch_name: Joi.string().max(255),
    scheduling: Joi.object({
      start_immediately: Joi.boolean().default(true),
      scheduled_start: Joi.date().iso(),
      processing_speed: Joi.string().valid('slow', 'normal', 'fast').default('normal')
    }),
    notifications: Joi.object({
      email_updates: Joi.boolean().default(true),
      progress_webhooks: Joi.array().items(Joi.string().uri()),
      completion_callback: Joi.string().uri()
    }),
    retry_configuration: Joi.object({
      max_retries: Joi.number().integer().min(0).max(10).default(3),
      retry_delay: Joi.number().integer().min(300).max(86400).default(3600) // seconds
    })
  }).default({}),
  subscription_context: Joi.object({
    tier: Joi.string().valid('basic', 'professional', 'enterprise').required(),
    credits_available: Joi.number().integer().min(0),
    monthly_limit: Joi.number().integer().min(0),
    features_enabled: Joi.array().items(Joi.string())
  }).required()
});

// Subscription tier configurations
const TIER_CONFIGS = {
  basic: {
    max_concurrent_jobs: 5,
    max_directories_per_batch: 25,
    processing_priority: 3,
    rate_limit_per_hour: 50,
    features: ['basic_submission', 'email_notifications']
  },
  professional: {
    max_concurrent_jobs: 15,
    max_directories_per_batch: 100,
    processing_priority: 2,
    rate_limit_per_hour: 200,
    features: ['basic_submission', 'email_notifications', 'priority_processing', 'webhooks', 'analytics']
  },
  enterprise: {
    max_concurrent_jobs: 50,
    max_directories_per_batch: 500,
    processing_priority: 1,
    rate_limit_per_hour: 1000,
    features: ['basic_submission', 'email_notifications', 'priority_processing', 'webhooks', 'analytics', 'custom_fields', 'dedicated_support']
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
      queueAddLimiter(req, res, (result) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });

    // Validate request body
    const { error, value } = queueAddSchema.validate(req.body, {
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

    const { user_id, business_data, directory_selection, processing_options, subscription_context } = value;

    // Verify user exists and get subscription details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        subscription_tier,
        credits_remaining,
        monthly_submission_count,
        subscription_status,
        created_at
      `)
      .eq('id', user_id)
      .eq('subscription_status', 'active')
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found or subscription inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get tier configuration
    const tierConfig = TIER_CONFIGS[subscription_context.tier] || TIER_CONFIGS.basic;

    // Validate subscription limits
    const limitChecks = await validateSubscriptionLimits(user, directory_selection, tierConfig);
    if (!limitChecks.valid) {
      return res.status(403).json({
        success: false,
        error: 'Subscription limits exceeded',
        limit_violations: limitChecks.violations,
        code: 'SUBSCRIPTION_LIMITS_EXCEEDED'
      });
    }

    // Validate directories exist and are active
    const { data: directories, error: dirError } = await supabase
      .from('directories')
      .select(`
        id,
        name,
        website,
        is_active,
        da_score,
        submission_requirements,
        form_fields,
        estimated_processing_time,
        success_rate,
        categories!inner(
          id,
          display_name,
          slug
        )
      `)
      .in('id', directory_selection.directory_ids)
      .eq('is_active', true);

    if (dirError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to validate directories',
        code: 'DATABASE_ERROR'
      });
    }

    if (directories.length !== directory_selection.directory_ids.length) {
      const foundIds = directories.map(d => d.id);
      const missingIds = directory_selection.directory_ids.filter(id => !foundIds.includes(id));
      
      return res.status(400).json({
        success: false,
        error: 'Some directories not found or inactive',
        missing_directory_ids: missingIds,
        code: 'DIRECTORIES_NOT_FOUND'
      });
    }

    // Filter directories by DA range if specified
    let filteredDirectories = directories;
    if (directory_selection.target_da_range) {
      const { min, max } = directory_selection.target_da_range;
      filteredDirectories = directories.filter(d => 
        d.da_score >= (min || 0) && d.da_score <= (max || 100)
      );
    }

    // Exclude specified directories
    if (directory_selection.exclude_directories?.length > 0) {
      filteredDirectories = filteredDirectories.filter(d => 
        !directory_selection.exclude_directories.includes(d.id)
      );
    }

    // Create batch record
    const batchId = uuidv4();
    const { data: batch, error: batchError } = await supabase
      .from('batch_submissions')
      .insert([{
        id: batchId,
        user_id,
        batch_name: processing_options.batch_name || `Batch ${new Date().toISOString().split('T')[0]}`,
        total_submissions: filteredDirectories.length,
        status: 'pending',
        configuration: {
          processing_options,
          subscription_tier: subscription_context.tier,
          priority_level: directory_selection.priority_level,
          estimated_completion: calculateEstimatedCompletion(filteredDirectories, tierConfig)
        }
      }])
      .select()
      .single();

    if (batchError) {
      console.error('Batch creation error:', batchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create batch',
        code: 'DATABASE_ERROR'
      });
    }

    // Create individual queue items
    const queueItems = filteredDirectories.map((directory, index) => ({
      id: uuidv4(),
      user_id,
      directory_id: directory.id,
      batch_id: batchId,
      business_name: business_data.business_name,
      business_description: business_data.business_description,
      business_url: business_data.business_url,
      business_email: business_data.business_email,
      business_phone: business_data.business_phone,
      business_address: business_data.business_address,
      business_category: business_data.business_category,
      submission_data: {
        ...business_data,
        directory_specific: adaptBusinessDataForDirectory(business_data, directory)
      },
      priority: calculatePriority(directory_selection.priority_level, tierConfig.processing_priority, directory.success_rate),
      submission_status: 'queued',
      max_retries: processing_options.retry_configuration?.max_retries || 3,
      estimated_start_time: calculateEstimatedStartTime(index, tierConfig),
      metadata: {
        queue_position: index + 1,
        subscription_tier: subscription_context.tier,
        processing_speed: processing_options.scheduling?.processing_speed || 'normal',
        created_via: 'queue_api'
      }
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from('user_submissions')
      .insert(queueItems)
      .select();

    if (itemsError) {
      console.error('Queue items creation error:', itemsError);
      
      // Clean up batch if queue items failed
      await supabase
        .from('batch_submissions')
        .delete()
        .eq('id', batchId);

      return res.status(500).json({
        success: false,
        error: 'Failed to create queue items',
        code: 'DATABASE_ERROR'
      });
    }

    // Update user's monthly submission count and credits
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        monthly_submission_count: (user.monthly_submission_count || 0) + filteredDirectories.length,
        credits_remaining: Math.max(0, (user.credits_remaining || 0) - filteredDirectories.length)
      })
      .eq('id', user_id);

    if (userUpdateError) {
      console.warn('Failed to update user submission count:', userUpdateError);
    }

    // Schedule processing if immediate start requested
    if (processing_options.scheduling?.start_immediately !== false) {
      await scheduleQueueProcessing(batchId, tierConfig);
    }

    // Log queue activity
    await logQueueActivity({
      user_id,
      batch_id: batchId,
      action: 'QUEUE_ADD',
      details: {
        directories_count: filteredDirectories.length,
        subscription_tier: subscription_context.tier,
        processing_priority: directory_selection.priority_level
      }
    });

    // Send response
    res.status(201).json({
      success: true,
      data: {
        batch_id: batchId,
        batch_name: batch.batch_name,
        queue_summary: {
          total_directories: filteredDirectories.length,
          estimated_completion_time: batch.configuration.estimated_completion,
          average_processing_time: calculateAverageProcessingTime(filteredDirectories),
          success_rate_estimate: calculateSuccessRateEstimate(filteredDirectories)
        },
        queue_items: createdItems.map(item => ({
          id: item.id,
          directory_name: filteredDirectories.find(d => d.id === item.directory_id)?.name,
          status: item.submission_status,
          priority: item.priority,
          estimated_start: item.estimated_start_time,
          queue_position: item.metadata.queue_position
        })),
        subscription_usage: {
          credits_used: filteredDirectories.length,
          credits_remaining: Math.max(0, (user.credits_remaining || 0) - filteredDirectories.length),
          monthly_submissions: (user.monthly_submission_count || 0) + filteredDirectories.length,
          tier_limits: {
            max_concurrent_jobs: tierConfig.max_concurrent_jobs,
            max_directories_per_batch: tierConfig.max_directories_per_batch
          }
        },
        processing_info: {
          starts_immediately: processing_options.scheduling?.start_immediately !== false,
          processing_speed: processing_options.scheduling?.processing_speed || 'normal',
          retry_configuration: {
            max_retries: processing_options.retry_configuration?.max_retries || 3,
            retry_delay: processing_options.retry_configuration?.retry_delay || 3600
          }
        }
      },
      message: 'Queue items created successfully'
    });

  } catch (error) {
    console.error('Queue add API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Helper Functions

async function validateSubscriptionLimits(user, directory_selection, tierConfig) {
  const violations = [];
  
  // Check directory count per batch
  if (directory_selection.directory_ids.length > tierConfig.max_directories_per_batch) {
    violations.push({
      limit: 'max_directories_per_batch',
      allowed: tierConfig.max_directories_per_batch,
      requested: directory_selection.directory_ids.length
    });
  }

  // Check concurrent jobs
  const { count: activeJobs } = await supabase
    .from('batch_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing']);

  if (activeJobs >= tierConfig.max_concurrent_jobs) {
    violations.push({
      limit: 'max_concurrent_jobs',
      allowed: tierConfig.max_concurrent_jobs,
      current: activeJobs
    });
  }

  // Check credits availability
  if (user.credits_remaining < directory_selection.directory_ids.length) {
    violations.push({
      limit: 'credits_available',
      available: user.credits_remaining,
      required: directory_selection.directory_ids.length
    });
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

function adaptBusinessDataForDirectory(businessData, directory) {
  const adapted = { ...businessData };
  
  // Adapt data based on directory requirements
  if (directory.form_fields) {
    directory.form_fields.forEach(field => {
      if (field.type === 'category' && businessData.business_category) {
        adapted[field.name] = mapCategoryToDirectory(businessData.business_category, field.options);
      }
      if (field.type === 'description' && businessData.business_description) {
        adapted[field.name] = truncateDescription(businessData.business_description, field.max_length);
      }
    });
  }
  
  return adapted;
}

function calculatePriority(userPriority, tierPriority, directorySuccessRate) {
  // Combine user priority, tier priority, and directory success rate
  const basePriority = Math.min(userPriority + tierPriority, 10);
  const successBonus = directorySuccessRate > 80 ? -1 : 0; // Higher success rate = higher priority
  return Math.max(1, basePriority + successBonus);
}

function calculateEstimatedStartTime(queuePosition, tierConfig) {
  const baseDelay = 300; // 5 minutes base delay
  const positionDelay = Math.floor(queuePosition / tierConfig.max_concurrent_jobs) * 1800; // 30 min per batch
  const startTime = new Date();
  startTime.setSeconds(startTime.getSeconds() + baseDelay + positionDelay);
  return startTime.toISOString();
}

function calculateEstimatedCompletion(directories, tierConfig) {
  const avgProcessingTime = directories.reduce((sum, dir) => 
    sum + (dir.estimated_processing_time || 1800), 0) / directories.length;
  const batchProcessingTime = (avgProcessingTime * directories.length) / tierConfig.max_concurrent_jobs;
  const completionTime = new Date();
  completionTime.setSeconds(completionTime.getSeconds() + batchProcessingTime);
  return completionTime.toISOString();
}

function calculateAverageProcessingTime(directories) {
  const totalTime = directories.reduce((sum, dir) => sum + (dir.estimated_processing_time || 1800), 0);
  return Math.round(totalTime / directories.length / 60); // in minutes
}

function calculateSuccessRateEstimate(directories) {
  const totalSuccessRate = directories.reduce((sum, dir) => sum + (dir.success_rate || 70), 0);
  return Math.round(totalSuccessRate / directories.length);
}

async function scheduleQueueProcessing(batchId, tierConfig) {
  // In production, this would integrate with Redis/Bull Queue
  // For now, we'll simulate with a database update
  await supabase
    .from('batch_submissions')
    .update({
      status: 'scheduled',
      started_at: new Date().toISOString()
    })
    .eq('id', batchId);
}

async function logQueueActivity(activity) {
  try {
    await supabase
      .from('queue_activity_log')
      .insert([{
        ...activity,
        timestamp: new Date().toISOString()
      }]);
  } catch (error) {
    console.warn('Failed to log queue activity:', error);
  }
}

function mapCategoryToDirectory(businessCategory, directoryOptions) {
  if (!directoryOptions || !Array.isArray(directoryOptions)) return businessCategory;
  
  const normalizedCategory = businessCategory.toLowerCase();
  const match = directoryOptions.find(option => 
    option.toLowerCase().includes(normalizedCategory) || 
    normalizedCategory.includes(option.toLowerCase())
  );
  
  return match || directoryOptions[0] || businessCategory;
}

function truncateDescription(description, maxLength) {
  if (!maxLength || description.length <= maxLength) return description;
  return description.substring(0, maxLength - 3) + '...';
}