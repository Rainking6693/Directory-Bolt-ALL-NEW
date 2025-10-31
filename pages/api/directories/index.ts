// 🔒 JORDAN'S DIRECTORY API - Scalable directory management with caching
// GET /api/directories - List directories with filtering and pagination

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError } from '../../../lib/utils/errors'
// Use local errors shim as a fallback for missing project Errors implementation
import ErrorsShim from '../../../lib/utils/errors-shim'
const Errors = (typeof (global as any).ProjectErrors !== 'undefined') ? (global as any).ProjectErrors : ErrorsShim
import { validateUrl } from '../../../lib/utils/validation'
import type { Directory, DirectoryCategory } from '../../../lib/database/schema'

// Response interfaces
interface DirectoryListResponse {
  success: true
  data: {
    directories: Directory[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    filters: {
      category?: DirectoryCategory
      country?: string
      minAuthorityScore?: number
      isActive?: boolean
    }
  }
  requestId: string
  cached: boolean
}

interface DirectoryCreateRequest {
  name: string
  url: string
  category: DirectoryCategory
  submission_url?: string
  contact_email?: string
  submission_guidelines?: string
  submission_fee?: number
  turnaround_time_days?: number
  country_code?: string
  language?: string
}

// In-memory cache for directories (in production, use Redis)
const directoryCache = new Map<string, { data: Directory[]; timestamp: number }>()
const CACHE_TTL = 300000 // 5 minutes

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DirectoryListResponse | any>
) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (req.method === 'GET') {
      return await handleGetDirectories(req, res, requestId)
    }
    
    if (req.method === 'POST') {
      return await handleCreateDirectory(req, res, requestId)
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

async function handleGetDirectories(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  // Parse query parameters with validation
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
  const category = req.query.category as DirectoryCategory | undefined
  const country = req.query.country as string | undefined
  const minAuthorityScore = req.query.minAuthorityScore 
    ? parseInt(req.query.minAuthorityScore as string) 
    : undefined
  const isActive = req.query.isActive === 'true' ? true : 
                   req.query.isActive === 'false' ? false : 
                   undefined
  const search = req.query.search as string | undefined
  
  // Create cache key based on filters
  const cacheKey = JSON.stringify({
    page,
    limit,
    category,
    country,
    minAuthorityScore,
    isActive,
    search
  })
  
  // Check cache first
  const cached = directoryCache.get(cacheKey)
  const now = Date.now()
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    // Return cached data
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = cached.data.slice(startIndex, endIndex)
    
    const response: DirectoryListResponse = {
      success: true,
      data: {
        directories: paginatedData,
        pagination: {
          page,
          limit,
          total: cached.data.length,
          totalPages: Math.ceil(cached.data.length / limit)
        },
        filters: { category, country, minAuthorityScore, isActive }
      },
      requestId,
      cached: true
    }
    
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).json(response)
  }
  
  // Simulate database query (replace with actual database call)
  let directories = await getMockDirectories()
  
  // Apply filters
  if (category) {
    directories = directories.filter(d => d.category === category)
  }
  
  if (country) {
    directories = directories.filter(d => d.country_code === country.toLowerCase())
  }
  
  if (minAuthorityScore !== undefined) {
    directories = directories.filter(d => d.authority_score >= minAuthorityScore)
  }
  
  if (isActive !== undefined) {
    directories = directories.filter(d => d.is_active === isActive)
  }
  
  if (search) {
    const searchLower = search.toLowerCase()
    directories = directories.filter(d => 
      d.name.toLowerCase().includes(searchLower) ||
      d.url.toLowerCase().includes(searchLower)
    )
  }
  
  // Sort by authority score (highest first)
  directories.sort((a, b) => b.authority_score - a.authority_score)
  
  // Update cache
  directoryCache.set(cacheKey, { data: directories, timestamp: now })
  
  // Paginate results
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedDirectories = directories.slice(startIndex, endIndex)
  
  const response: DirectoryListResponse = {
    success: true,
    data: {
      directories: paginatedDirectories,
      pagination: {
        page,
        limit,
        total: directories.length,
        totalPages: Math.ceil(directories.length / limit)
      },
      filters: { category, country, minAuthorityScore, isActive }
    },
    requestId,
    cached: false
  }
  
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.status(200).json(response)
}

async function handleCreateDirectory(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  // TODO: Add authentication middleware
  // if (!isAuthenticated(req)) throw new AuthenticationError()
  // if (!hasPermission(req.user, 'admin')) throw new AuthorizationError()
  
  const data: DirectoryCreateRequest = req.body
  
  // Validate required fields
  if (!data.name || typeof data.name !== 'string') {
    throw Errors.required('name')
  }
  
  if (!data.url || typeof data.url !== 'string') {
    throw Errors.required('url')
  }
  
  // Validate URL format
  const urlValidation = validateUrl(data.url)
  if (!urlValidation.isValid) {
    throw new Error(urlValidation.errors[0].message)
  }
  
  // Validate category
  const validCategories: DirectoryCategory[] = [
    'business_general', 'local_business', 'tech_startups', 'ecommerce', 'saas',
    'healthcare', 'education', 'non_profit', 'real_estate', 'professional_services',
    'retail', 'restaurants', 'automotive', 'finance', 'legal'
  ]
  
  if (!validCategories.includes(data.category)) {
    throw Errors.invalid('category', 'Must be a valid directory category')
  }
  
  // Create directory (simulate database insertion)
  const newDirectory: Directory = {
    id: `dir_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: data.name.trim(),
    url: urlValidation.sanitizedData!,
    category: data.category,
    authority_score: 0, // Will be calculated later
    submission_fee: data.submission_fee || undefined,
    turnaround_time_days: data.turnaround_time_days || 7,
    submission_url: data.submission_url || undefined,
    contact_email: data.contact_email || undefined,
    submission_guidelines: data.submission_guidelines || undefined,
    is_active: true,
    last_checked_at: new Date(),
    response_rate: 0,
    avg_approval_time: 0,
    domain_authority: 0, // Will be scraped later
    monthly_traffic: undefined,
    language: data.language || 'en',
    country_code: data.country_code || 'us',
    created_at: new Date(),
    updated_at: new Date()
  }
  
  // Clear cache since we added new directory
  directoryCache.clear()
  
  // TODO: Schedule scraping job to get directory metadata
  // await scheduleScrapingJob({
  //   type: 'directory_discovery',
  //   target_url: newDirectory.url,
  //   payload: { directory_id: newDirectory.id }
  // })
  
  res.status(201).json({
    success: true,
    data: { directory: newDirectory },
    requestId
  })
}

// Enhanced directory data access using the comprehensive seed data
async function getMockDirectories(): Promise<Directory[]> {
  // Import seed data and transform to Directory interface
  const { DIRECTORY_SEED_DATA } = await import('../../../lib/database/directory-seed')
  
  return DIRECTORY_SEED_DATA.map(seedDir => ({
    id: `dir_${Math.random().toString(36).substr(2, 9)}`,
    name: seedDir.name,
    url: seedDir.website,
    category: seedDir.category as DirectoryCategory,
    authority_score: seedDir.domain_authority,
    submission_fee: seedDir.price > 0 ? seedDir.price : undefined,
    turnaround_time_days: parseTurnaroundTime(seedDir.time_to_approval),
    submission_url: seedDir.submission_url,
    contact_email: undefined,
    submission_guidelines: `${seedDir.difficulty} difficulty. ${seedDir.features.slice(0, 3).join(', ')}`,
    is_active: seedDir.active,
    last_checked_at: new Date(),
    response_rate: Math.floor(Math.random() * 30) + 70, // 70-100%
    avg_approval_time: parseTurnaroundTime(seedDir.time_to_approval) * 24, // Convert to hours
    domain_authority: seedDir.domain_authority,
    monthly_traffic: seedDir.estimated_traffic,
    language: seedDir.language || 'en',
    country_code: seedDir.country_code || 'us',
    created_at: new Date('2024-01-01'),
    updated_at: new Date()
  }))
}

function parseTurnaroundTime(timeString: string): number {
  // Convert time strings like "1-3 days", "2-4 weeks", "Instant" to days
  if (timeString.toLowerCase().includes('instant') || timeString.toLowerCase().includes('same day')) {
    return 1
  }
  
  // Extract number from string like "1-3 days" or "2-4 weeks"
  const matches = timeString.match(/(\d+)/)
  if (!matches) return 7 // Default to 7 days
  
  const number = parseInt(matches[1])
  
  if (timeString.toLowerCase().includes('week')) {
    return number * 7
  }
  
  return number // Assume days if no unit specified
}