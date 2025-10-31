// 🔒 JORDAN'S SUBMISSION API - Enterprise submission system with rate limiting
// POST /api/submissions - Create new directory submissions with security controls

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, Errors, RateLimitError } from '../../../lib/utils/errors'
import { validateBusinessData, validateRateLimit } from '../../../lib/utils/validation'
import type { Submission, SubmissionStatus } from '../../../lib/database/schema'

// Rate limiting storage (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const submissionCounts = new Map<string, number>() // Daily submission counts per user

// Rate limits configuration
const RATE_LIMITS = {
  SUBMISSIONS_PER_HOUR: 10,
  SUBMISSIONS_PER_DAY: 50,
  BULK_SUBMISSIONS_PER_DAY: 100, // For pro users
  WINDOW_HOUR: 60 * 60 * 1000, // 1 hour in ms
  WINDOW_DAY: 24 * 60 * 60 * 1000 // 1 day in ms
}

interface SubmissionCreateRequest {
  directory_ids: string[]
  business_name: string
  business_description: string
  business_url: string
  business_email: string
  business_phone?: string
  business_address?: string
  business_category: string
  auto_submit?: boolean
}

interface SubmissionResponse {
  success: true
  data: {
    submissions: Submission[]
    summary: {
      total_created: number
      total_credits_used: number
      estimated_completion: string
    }
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubmissionResponse | any>
) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (req.method === 'POST') {
      return await handleCreateSubmissions(req, res, requestId)
    }
    
    if (req.method === 'GET') {
      return await handleGetSubmissions(req, res, requestId)
    }
    
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json(handleApiError(
      new Error('Method not allowed'),
      requestId
    ))
    
  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleCreateSubmissions(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  // TODO: Extract from authenticated session
  const userId = 'user_temp_123' // Replace with actual user ID from auth
  const userTier = 'pro' // Replace with actual user tier
  const userCredits = 100 // Replace with actual user credits
  
  const data: SubmissionCreateRequest = req.body
  
  // Rate limiting check
  const _clientIp = req.headers['x-forwarded-for'] as string || 
                    req.headers['x-real-ip'] as string || 
                    req.socket.remoteAddress || ''
  
  const hourlyRateCheck = validateRateLimit(
    `submissions:${userId}:hour`,
    userTier === 'pro' ? RATE_LIMITS.SUBMISSIONS_PER_HOUR * 2 : RATE_LIMITS.SUBMISSIONS_PER_HOUR,
    RATE_LIMITS.WINDOW_HOUR,
    rateLimitMap
  )
  
  if (!hourlyRateCheck.allowed) {
    throw new RateLimitError(hourlyRateCheck.resetTime, hourlyRateCheck.remaining)
  }
  
  // Daily submission limit check
  const today = new Date().toDateString()
  const dailyKey = `${userId}:${today}`
  const currentDailyCount = submissionCounts.get(dailyKey) || 0
  const dailyLimit = userTier === 'pro' ? RATE_LIMITS.BULK_SUBMISSIONS_PER_DAY : RATE_LIMITS.SUBMISSIONS_PER_DAY
  
  if (currentDailyCount >= dailyLimit) {
    throw Errors.submissionLimitReached(dailyLimit)
  }
  
  // Validate business data
  const businessValidation = validateBusinessData(data)
  if (!businessValidation.isValid) {
    throw businessValidation.errors[0]
  }
  
  // Validate directory IDs
  if (!data.directory_ids || !Array.isArray(data.directory_ids) || data.directory_ids.length === 0) {
    throw Errors.required('directory_ids')
  }
  
  if (data.directory_ids.length > 20) {
    throw Errors.invalid('directory_ids', 'Maximum 20 directories per request')
  }
  
  // Check if user has enough credits
  const requiredCredits = data.directory_ids.length
  if (userCredits < requiredCredits) {
    throw Errors.insufficientCredits(requiredCredits, userCredits)
  }
  
  // Get directory information (simulate database call)
  const directories = await getMockDirectoriesByIds(data.directory_ids)
  const foundDirectoryIds = directories.map(d => d.id)
  const missingDirectoryIds = data.directory_ids.filter(id => !foundDirectoryIds.includes(id))
  
  if (missingDirectoryIds.length > 0) {
    throw Errors.directoryNotFound()
  }
  
  // Check for inactive directories
  const inactiveDirectories = directories.filter(d => !d.is_active)
  if (inactiveDirectories.length > 0) {
    throw Errors.directoryInactive()
  }
  
  // Check for duplicate submissions (simulate database check)
  const existingSubmissions = await checkExistingSubmissions(userId, data.business_url, data.directory_ids)
  if (existingSubmissions.length > 0) {
    throw Errors.duplicateSubmission()
  }
  
  // Create submissions
  const submissions: Submission[] = []
  let totalCreditsUsed = 0
  
  for (const directory of directories) {
    const submission: Submission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      directory_id: directory.id,
      business_name: businessValidation.sanitizedData!.business_name,
      business_description: businessValidation.sanitizedData!.business_description,
      business_url: businessValidation.sanitizedData!.business_url,
      business_email: businessValidation.sanitizedData!.business_email,
      business_phone: businessValidation.sanitizedData!.business_phone || undefined,
      business_address: data.business_address || undefined,
      business_category: businessValidation.sanitizedData!.business_category,
      status: data.auto_submit ? 'in_progress' : 'pending',
      submitted_at: data.auto_submit ? new Date() : new Date(), // Will be updated when actually submitted
      auto_submitted: data.auto_submit || false,
      submission_method: data.auto_submit ? 'automated' : 'manual',
      credits_used: 1,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    submissions.push(submission)
    totalCreditsUsed += submission.credits_used
    
    // If auto-submit is enabled, schedule scraping job
    if (data.auto_submit) {
      await scheduleSubmissionJob(submission, directory)
    }
  }
  
  // Update rate limiting counters
  submissionCounts.set(dailyKey, currentDailyCount + submissions.length)
  
  // Calculate estimated completion time
  const avgProcessingTime = submissions.reduce((acc, sub) => {
    const dir = directories.find(d => d.id === sub.directory_id)
    return acc + (dir?.turnaround_time_days || 7)
  }, 0) / submissions.length
  
  const estimatedCompletion = new Date()
  estimatedCompletion.setDate(estimatedCompletion.getDate() + Math.ceil(avgProcessingTime))
  
  // TODO: Save submissions to database
  // await saveSubmissions(submissions)
  // await deductUserCredits(userId, totalCreditsUsed)
  
  const response: SubmissionResponse = {
    success: true,
    data: {
      submissions,
      summary: {
        total_created: submissions.length,
        total_credits_used: totalCreditsUsed,
        estimated_completion: estimatedCompletion.toISOString()
      }
    },
    requestId
  }
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', dailyLimit.toString())
  res.setHeader('X-RateLimit-Remaining', (dailyLimit - currentDailyCount - submissions.length).toString())
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMITS.WINDOW_DAY).toISOString())
  
  res.status(201).json(response)
}

async function handleGetSubmissions(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  // TODO: Extract from authenticated session
  const userId = 'user_temp_123'
  
  // Parse query parameters
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10))
  const status = req.query.status as SubmissionStatus | undefined
  const directoryId = req.query.directory_id as string | undefined
  
  // TODO: Implement actual database query
  const mockSubmissions = await getMockSubmissionsByUser(userId, { status, directoryId, page, limit })
  
  res.status(200).json({
    success: true,
    data: {
      submissions: mockSubmissions,
      pagination: {
        page,
        limit,
        total: 25, // Mock total
        totalPages: Math.ceil(25 / limit)
      }
    },
    requestId
  })
}

// Mock functions (replace with actual database calls)
async function getMockDirectoriesByIds(ids: string[]) {
  const _allDirectories = await import('./index').then(m => m.default)
  // Simulate fetching directories by IDs
  return [
    {
      id: 'dir_001',
      name: 'Product Hunt',
      url: 'https://producthunt.com',
      category: 'tech_startups' as const,
      authority_score: 95,
      submission_fee: null,
      turnaround_time_days: 1,
      is_active: true,
      submission_url: 'https://producthunt.com/posts/new',
      last_checked_at: new Date(),
      response_rate: 85,
      avg_approval_time: 2,
      domain_authority: 89,
      monthly_traffic: 5000000,
      language: 'en',
      country_code: 'us',
      created_at: new Date(),
      updated_at: new Date()
    }
  ].filter(d => ids.includes(d.id))
}

async function checkExistingSubmissions(_userId: string, _businessUrl: string, _directoryIds: string[]) {
  // TODO: Implement actual database check
  return [] // No duplicates found
}

async function scheduleSubmissionJob(submission: Submission, directory: any) {
  // TODO: Add to job queue for automated submission
  console.log(`Scheduled submission job for ${submission.id} to ${directory.name}`)
  
  // This would typically add a job to a queue like Bull/BullMQ
  // await jobQueue.add('auto-submit', {
  //   submissionId: submission.id,
  //   directoryUrl: directory.submission_url,
  //   businessData: {
  //     name: submission.business_name,
  //     url: submission.business_url,
  //     description: submission.business_description
  //   }
  // }, {
  //   delay: Math.random() * 60000 // Random delay up to 1 minute
  // })
}

async function getMockSubmissionsByUser(
  userId: string, 
  _filters: { status?: SubmissionStatus; directoryId?: string; page: number; limit: number }
) {
  // TODO: Implement actual database query
  return [
    {
      id: 'sub_001',
      user_id: userId,
      directory_id: 'dir_001',
      business_name: 'Example Business',
      business_description: 'A great business that does business things',
      business_url: 'https://example.com',
      business_email: 'contact@example.com',
      business_category: 'tech_startups',
      status: 'pending' as SubmissionStatus,
      submitted_at: new Date(),
      auto_submitted: false,
      submission_method: 'manual' as const,
      credits_used: 1,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
}