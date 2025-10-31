// DirectoryBolt Queue Processing API - Pending Verification Actions Endpoint
// GET /api/queue/pending - VA task assignment and management
// Handles action prioritization, deadline tracking, and verification workflow

const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

// Rate limiting for pending actions requests
const pendingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: {
    error: 'Too many pending requests, please try again later.',
    code: 'PENDING_RATE_LIMIT_EXCEEDED'
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

// Validation schema for pending requests
const pendingQuerySchema = Joi.object({
  va_id: Joi.string().uuid(),
  action_type: Joi.string().valid(
    'verification_needed', 
    'manual_submission', 
    'captcha_required', 
    'phone_verification', 
    'email_verification',
    'document_upload',
    'business_verification',
    'payment_required',
    'approval_pending'
  ),
  priority: Joi.string().valid('urgent', 'high', 'normal', 'low'),
  directory_category: Joi.string(),
  assigned_only: Joi.boolean().default(false),
  include_metadata: Joi.boolean().default(true),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  sort_by: Joi.string().valid('created_at', 'priority', 'deadline', 'estimated_time').default('priority'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  deadline_filter: Joi.string().valid('overdue', 'today', 'this_week', 'this_month')
});

// Action type configurations
const ACTION_TYPE_CONFIGS = {
  verification_needed: {
    priority_weight: 8,
    estimated_time: 300, // 5 minutes
    skill_requirements: ['verification', 'research'],
    can_batch: true,
    deadline_hours: 24
  },
  manual_submission: {
    priority_weight: 9,
    estimated_time: 900, // 15 minutes
    skill_requirements: ['form_filling', 'automation'],
    can_batch: false,
    deadline_hours: 4
  },
  captcha_required: {
    priority_weight: 10,
    estimated_time: 120, // 2 minutes
    skill_requirements: ['captcha_solving'],
    can_batch: false,
    deadline_hours: 1
  },
  phone_verification: {
    priority_weight: 7,
    estimated_time: 600, // 10 minutes
    skill_requirements: ['phone_verification', 'communication'],
    can_batch: false,
    deadline_hours: 12
  },
  email_verification: {
    priority_weight: 5,
    estimated_time: 180, // 3 minutes
    skill_requirements: ['email_verification'],
    can_batch: true,
    deadline_hours: 6
  },
  document_upload: {
    priority_weight: 6,
    estimated_time: 420, // 7 minutes
    skill_requirements: ['document_processing'],
    can_batch: true,
    deadline_hours: 8
  },
  business_verification: {
    priority_weight: 8,
    estimated_time: 1200, // 20 minutes
    skill_requirements: ['business_verification', 'research'],
    can_batch: false,
    deadline_hours: 48
  },
  payment_required: {
    priority_weight: 9,
    estimated_time: 300, // 5 minutes
    skill_requirements: ['payment_processing'],
    can_batch: false,
    deadline_hours: 2
  },
  approval_pending: {
    priority_weight: 4,
    estimated_time: 60, // 1 minute
    skill_requirements: ['monitoring'],
    can_batch: true,
    deadline_hours: 72
  }
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
      pendingLimiter(req, res, (result) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });

    // Validate query parameters
    const { error, value } = pendingQuerySchema.validate(req.query, {
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

    const {
      va_id,
      action_type,
      priority,
      directory_category,
      assigned_only,
      include_metadata,
      limit,
      offset,
      sort_by,
      sort_order,
      deadline_filter
    } = value;

    // Authenticate VA request
    const vaAuth = await authenticateVA(req.headers, va_id);
    if (!vaAuth.valid) {
      return res.status(401).json({
        success: false,
        error: 'VA authentication failed',
        code: 'VA_AUTHENTICATION_FAILED'
      });
    }

    // Build pending actions query
    const pendingActions = await getPendingActions({
      va_id: vaAuth.va_id,
      action_type,
      priority,
      directory_category,
      assigned_only,
      limit,
      offset,
      sort_by,
      sort_order,
      deadline_filter
    });

    if (!pendingActions) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve pending actions',
        code: 'DATABASE_ERROR'
      });
    }

    // Enhance actions with priority calculations and metadata
    const enhancedActions = await enhancePendingActions(pendingActions.actions, vaAuth.va_profile);

    // Calculate workload and capacity information
    const workloadInfo = await calculateVAWorkload(vaAuth.va_id, enhancedActions);

    // Get action statistics
    const actionStats = await getActionStatistics(vaAuth.va_id, deadline_filter);

    // Prepare response
    const response = {
      success: true,
      data: {
        pending_actions: enhancedActions,
        workload_summary: workloadInfo,
        statistics: actionStats,
        pagination: {
          total: pendingActions.total,
          limit,
          offset,
          has_more: offset + limit < pendingActions.total
        },
        va_info: {
          va_id: vaAuth.va_id,
          skills: vaAuth.va_profile.skills,
          availability: vaAuth.va_profile.availability,
          current_capacity: workloadInfo.capacity_percentage
        }
      },
      metadata: {
        generated_at: new Date().toISOString(),
        filters_applied: {
          action_type,
          priority,
          directory_category,
          assigned_only,
          deadline_filter
        }
      }
    };

    // Include additional metadata if requested
    if (include_metadata) {
      response.data.action_type_configs = ACTION_TYPE_CONFIGS;
      response.data.recommendation_engine = await getActionRecommendations(vaAuth.va_profile, enhancedActions);
    }

    res.json(response);

  } catch (error) {
    console.error('Queue pending API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Authenticate VA request
async function authenticateVA(headers, requestedVAId) {
  const authHeader = headers.authorization || headers['x-va-token'];
  
  if (!authHeader) {
    return { valid: false, reason: 'Missing authentication' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // In production, validate JWT token
  // For now, simulate VA authentication
  const { data: va, error } = await supabase
    .from('virtual_assistants')
    .select(`
      id,
      name,
      email,
      skills,
      availability,
      max_concurrent_tasks,
      active_tasks_count,
      performance_rating,
      specializations,
      timezone
    `)
    .eq('auth_token', token)
    .eq('status', 'active')
    .single();

  if (error || !va) {
    return { valid: false, reason: 'Invalid VA token' };
  }

  // If specific VA ID requested, verify it matches
  if (requestedVAId && va.id !== requestedVAId) {
    return { valid: false, reason: 'VA ID mismatch' };
  }

  return {
    valid: true,
    va_id: va.id,
    va_profile: va
  };
}

// Get pending actions from database
async function getPendingActions(filters) {
  try {
    let query = supabase
      .from('verification_actions')
      .select(`
        id,
        submission_id,
        action_type,
        status,
        priority,
        created_at,
        deadline,
        assigned_va_id,
        attempts,
        max_attempts,
        context_data,
        requirements,
        estimated_time,
        user_submissions!inner(
          id,
          business_name,
          business_url,
          user_id,
          batch_id,
          directories!inner(
            id,
            name,
            website,
            da_score,
            categories!inner(
              display_name,
              slug
            )
          ),
          users!inner(
            id,
            email,
            subscription_tier
          )
        )
      `)
      .in('status', ['pending', 'assigned', 'in_progress'])
      .order(filters.sort_by, { ascending: filters.sort_order === 'asc' })
      .range(filters.offset, filters.offset + filters.limit - 1);

    // Apply filters
    if (filters.action_type) {
      query = query.eq('action_type', filters.action_type);
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters.assigned_only) {
      query = query.eq('assigned_va_id', filters.va_id);
    } else {
      // Include unassigned and assigned to this VA
      query = query.or(`assigned_va_id.is.null,assigned_va_id.eq.${filters.va_id}`);
    }

    if (filters.deadline_filter) {
      const now = new Date();
      let deadlineFilter;

      switch (filters.deadline_filter) {
        case 'overdue':
          deadlineFilter = now.toISOString();
          query = query.lt('deadline', deadlineFilter);
          break;
        case 'today':
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('deadline', endOfDay.toISOString());
          break;
        case 'this_week':
          const endOfWeek = new Date(now);
          endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
          query = query.lte('deadline', endOfWeek.toISOString());
          break;
        case 'this_month':
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          query = query.lte('deadline', endOfMonth.toISOString());
          break;
      }
    }

    if (filters.directory_category) {
      query = query.eq('user_submissions.directories.categories.slug', filters.directory_category);
    }

    const { data: actions, error } = await query;

    if (error) {
      console.error('Failed to fetch pending actions:', error);
      return null;
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('verification_actions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'assigned', 'in_progress']);

    // Apply same filters to count query
    if (filters.action_type) {
      countQuery = countQuery.eq('action_type', filters.action_type);
    }
    if (filters.priority) {
      countQuery = countQuery.eq('priority', filters.priority);
    }
    if (filters.assigned_only) {
      countQuery = countQuery.eq('assigned_va_id', filters.va_id);
    }

    const { count } = await countQuery;

    return {
      actions,
      total: count || 0
    };

  } catch (error) {
    console.error('Error fetching pending actions:', error);
    return null;
  }
}

// Enhance pending actions with priority and metadata
async function enhancePendingActions(actions, vaProfile) {
  return actions.map(action => {
    const actionConfig = ACTION_TYPE_CONFIGS[action.action_type];
    const isOverdue = new Date(action.deadline) < new Date();
    const isAssignedToVA = action.assigned_va_id === vaProfile.id;
    
    // Calculate dynamic priority score
    const priorityScore = calculatePriorityScore(action, actionConfig, vaProfile, isOverdue);
    
    // Calculate compatibility with VA skills
    const skillMatch = calculateSkillMatch(actionConfig.skill_requirements, vaProfile.skills);
    
    return {
      id: action.id,
      submission_info: {
        submission_id: action.submission_id,
        business_name: action.user_submissions.business_name,
        business_url: action.user_submissions.business_url,
        batch_id: action.user_submissions.batch_id,
        customer_tier: action.user_submissions.users.subscription_tier
      },
      directory_info: {
        directory_id: action.user_submissions.directories.id,
        directory_name: action.user_submissions.directories.name,
        directory_website: action.user_submissions.directories.website,
        da_score: action.user_submissions.directories.da_score,
        category: action.user_submissions.directories.categories.display_name
      },
      action_details: {
        type: action.action_type,
        status: action.status,
        priority: action.priority,
        priority_score: priorityScore,
        created_at: action.created_at,
        deadline: action.deadline,
        is_overdue: isOverdue,
        time_until_deadline: calculateTimeUntilDeadline(action.deadline),
        estimated_time: action.estimated_time || actionConfig.estimated_time,
        attempts: action.attempts,
        max_attempts: action.max_attempts
      },
      assignment_info: {
        assigned_va_id: action.assigned_va_id,
        is_assigned_to_me: isAssignedToVA,
        can_assign_to_me: !action.assigned_va_id || isAssignedToVA,
        skill_match_percentage: skillMatch.percentage,
        skill_gaps: skillMatch.gaps,
        recommended_for_va: skillMatch.percentage >= 70
      },
      context: {
        requirements: action.requirements,
        context_data: action.context_data,
        special_instructions: extractSpecialInstructions(action.context_data),
        complexity_level: assessComplexity(action, actionConfig)
      },
      batching_info: {
        can_batch: actionConfig.can_batch,
        similar_actions_count: 0, // Will be calculated separately to avoid async issues
        batch_potential: actionConfig.can_batch ? 'high' : 'none'
      }
    };
  });
}

// Calculate priority score
function calculatePriorityScore(action, config, vaProfile, isOverdue) {
  let score = config.priority_weight;
  
  // Urgency multiplier
  const urgencyMultipliers = {
    urgent: 2.0,
    high: 1.5,
    normal: 1.0,
    low: 0.7
  };
  score *= (urgencyMultipliers[action.priority] || 1.0);
  
  // Overdue penalty
  if (isOverdue) {
    const hoursOverdue = (new Date() - new Date(action.deadline)) / (1000 * 60 * 60);
    score += Math.min(hoursOverdue * 0.5, 5); // Max 5 points for overdue
  }
  
  // Deadline proximity
  const hoursUntilDeadline = (new Date(action.deadline) - new Date()) / (1000 * 60 * 60);
  if (hoursUntilDeadline < 2) {
    score += 3;
  } else if (hoursUntilDeadline < 6) {
    score += 2;
  } else if (hoursUntilDeadline < 24) {
    score += 1;
  }
  
  // Customer tier bonus
  const tierMultipliers = {
    enterprise: 1.3,
    professional: 1.1,
    basic: 1.0
  };
  score *= (tierMultipliers[action.user_submissions?.users?.subscription_tier] || 1.0);
  
  return Math.round(score * 10) / 10;
}

// Calculate skill match
function calculateSkillMatch(requiredSkills, vaSkills) {
  if (!requiredSkills || !vaSkills || requiredSkills.length === 0) {
    return { percentage: 100, gaps: [] };
  }
  
  const matches = requiredSkills.filter(skill => vaSkills.includes(skill));
  const percentage = Math.round((matches.length / requiredSkills.length) * 100);
  const gaps = requiredSkills.filter(skill => !vaSkills.includes(skill));
  
  return { percentage, gaps };
}

// Calculate time until deadline
function calculateTimeUntilDeadline(deadline) {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - now;
  
  if (diffMs < 0) {
    return { overdue: true, hours: Math.abs(Math.round(diffMs / (1000 * 60 * 60))) };
  }
  
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return { days, hours: hours % 24 };
  }
  
  return { hours };
}

// Extract special instructions from context
function extractSpecialInstructions(contextData) {
  if (!contextData || typeof contextData !== 'object') {
    return [];
  }
  
  const instructions = [];
  
  if (contextData.special_requirements) {
    instructions.push(...contextData.special_requirements);
  }
  
  if (contextData.customer_notes) {
    instructions.push(`Customer note: ${contextData.customer_notes}`);
  }
  
  if (contextData.previous_failure_reason) {
    instructions.push(`Previous failure: ${contextData.previous_failure_reason}`);
  }
  
  return instructions;
}

// Assess complexity level
function assessComplexity(action, config) {
  let complexity = 1; // Base complexity
  
  // Action type base complexity
  const complexityMap = {
    captcha_required: 1,
    email_verification: 1,
    phone_verification: 2,
    document_upload: 2,
    manual_submission: 3,
    verification_needed: 3,
    business_verification: 4,
    payment_required: 2,
    approval_pending: 1
  };
  
  complexity = complexityMap[action.action_type] || 2;
  
  // Increase complexity for retries
  if (action.attempts > 0) {
    complexity += 1;
  }
  
  // Context-based complexity
  if (action.context_data?.requires_research) {
    complexity += 1;
  }
  
  if (action.context_data?.multiple_steps) {
    complexity += 1;
  }
  
  const levels = ['simple', 'moderate', 'complex', 'very_complex', 'expert'];
  return levels[Math.min(complexity - 1, levels.length - 1)];
}

// Count similar actions for batching
async function countSimilarActions(actionType, directoryId) {
  const { count } = await supabase
    .from('verification_actions')
    .select('*', { count: 'exact', head: true })
    .eq('action_type', actionType)
    .eq('user_submissions.directory_id', directoryId)
    .in('status', ['pending', 'assigned']);
    
  return count || 0;
}

// Calculate VA workload
async function calculateVAWorkload(vaId, actions) {
  const { data: vaProfile } = await supabase
    .from('virtual_assistants')
    .select('max_concurrent_tasks, active_tasks_count')
    .eq('id', vaId)
    .single();
  
  const assignedToMe = actions.filter(a => a.assignment_info.is_assigned_to_me).length;
  const totalEstimatedTime = actions
    .filter(a => a.assignment_info.is_assigned_to_me || a.assignment_info.recommended_for_va)
    .reduce((sum, a) => sum + a.action_details.estimated_time, 0);
  
  const capacityUsed = vaProfile?.active_tasks_count || assignedToMe;
  const maxCapacity = vaProfile?.max_concurrent_tasks || 10;
  const capacityPercentage = Math.round((capacityUsed / maxCapacity) * 100);
  
  return {
    assigned_tasks: assignedToMe,
    recommended_tasks: actions.filter(a => a.assignment_info.recommended_for_va && !a.assignment_info.is_assigned_to_me).length,
    total_estimated_time_minutes: Math.round(totalEstimatedTime / 60),
    capacity_used: capacityUsed,
    max_capacity: maxCapacity,
    capacity_percentage: capacityPercentage,
    availability_status: capacityPercentage < 80 ? 'available' : capacityPercentage < 100 ? 'busy' : 'full'
  };
}

// Get action statistics
async function getActionStatistics(vaId, deadlineFilter) {
  const stats = {
    overdue_count: 0,
    today_count: 0,
    this_week_count: 0,
    total_pending: 0,
    action_type_breakdown: {},
    priority_breakdown: {}
  };

  // Get basic statistics
  const { data: allActions } = await supabase
    .from('verification_actions')
    .select('action_type, priority, deadline, assigned_va_id')
    .in('status', ['pending', 'assigned', 'in_progress'])
    .or(`assigned_va_id.is.null,assigned_va_id.eq.${vaId}`);

  if (allActions) {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));

    allActions.forEach(action => {
      stats.total_pending++;
      
      const deadline = new Date(action.deadline);
      if (deadline < now) stats.overdue_count++;
      if (deadline <= endOfDay) stats.today_count++;
      if (deadline <= endOfWeek) stats.this_week_count++;
      
      // Action type breakdown
      stats.action_type_breakdown[action.action_type] = 
        (stats.action_type_breakdown[action.action_type] || 0) + 1;
      
      // Priority breakdown
      stats.priority_breakdown[action.priority] = 
        (stats.priority_breakdown[action.priority] || 0) + 1;
    });
  }

  return stats;
}

// Get action recommendations
async function getActionRecommendations(vaProfile, actions) {
  const recommendations = {
    top_priority: [],
    skill_matched: [],
    batch_opportunities: [],
    urgent_actions: []
  };

  // Top priority actions
  recommendations.top_priority = actions
    .sort((a, b) => b.action_details.priority_score - a.action_details.priority_score)
    .slice(0, 5);

  // Skill matched actions
  recommendations.skill_matched = actions
    .filter(a => a.assignment_info.skill_match_percentage >= 80)
    .slice(0, 10);

  // Batch opportunities
  const batchableTypes = {};
  actions
    .filter(a => a.batching_info.can_batch)
    .forEach(action => {
      const key = `${action.action_details.type}_${action.directory_info.directory_id}`;
      if (!batchableTypes[key]) {
        batchableTypes[key] = {
          action_type: action.action_details.type,
          directory_name: action.directory_info.directory_name,
          actions: []
        };
      }
      batchableTypes[key].actions.push(action.id);
    });

  recommendations.batch_opportunities = Object.values(batchableTypes)
    .filter(batch => batch.actions.length > 1)
    .slice(0, 5);

  // Urgent actions (overdue or due soon)
  recommendations.urgent_actions = actions
    .filter(a => a.action_details.is_overdue || 
      (a.action_details.time_until_deadline.hours && a.action_details.time_until_deadline.hours < 6))
    .slice(0, 10);

  return recommendations;
}