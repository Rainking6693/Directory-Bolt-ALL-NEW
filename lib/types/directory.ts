// Enhanced Directory Types for DirectoryBolt Frontend

export interface Directory {
  id: string
  name: string
  url: string
  category: DirectoryCategory
  domain_authority: number
  submission_fee?: number // in cents
  turnaround_time_days: number
  time_to_approval: string
  submission_url?: string
  contact_email?: string
  submission_guidelines?: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  is_active: boolean
  last_checked_at: Date
  response_rate: number
  avg_approval_time: number
  monthly_traffic?: number
  language: string
  country_code: string
  features: string[]
  requires_approval: boolean
  tier_required: 1 | 2 | 3 | 4
  impact_level: 'High' | 'Medium' | 'Low'
  recommended?: boolean
  created_at: Date
  updated_at: Date
}

export type DirectoryCategory = 
  | 'business_general'
  | 'local_business'
  | 'tech_startups'
  | 'saas'
  | 'ecommerce'
  | 'healthcare'
  | 'education'
  | 'finance'
  | 'legal'
  | 'real_estate'
  | 'professional_services'
  | 'restaurants'
  | 'automotive'
  | 'review_platforms'
  | 'social_media'
  | 'content_media'
  | 'ai_tools'
  | 'non_profit'

export interface DirectoryFilters {
  category?: DirectoryCategory
  minDomainAuthority?: number
  maxPrice?: number
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  requiresApproval?: boolean
  search?: string
  sortBy: 'domain_authority' | 'monthly_traffic' | 'submission_fee' | 'name' | 'time_to_approval'
  sortOrder: 'asc' | 'desc'
  country?: string
  language?: string
  tier?: 1 | 2 | 3 | 4
  impactLevel?: 'High' | 'Medium' | 'Low'
}

export interface DirectoryListResponse {
  directories: Directory[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
}

export interface SelectionStats {
  totalDirectories: number
  highDADirectories: number
  freeDirectories: number
  totalTraffic: number
  totalCost: number
  averageApprovalTime: number
  categoryBreakdown: Record<DirectoryCategory, number>
  difficultyBreakdown: Record<'Easy' | 'Medium' | 'Hard', number>
}

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
}

export interface PaginationState {
  page: number
  limit: number
  total: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// WebSocket message types for real-time updates
export interface WebSocketMessage {
  type: 'submission_update' | 'directory_update' | 'progress_update'
  payload: any
  timestamp: number
}

export interface SubmissionUpdate {
  submissionId: string
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'failed'
  message?: string
  directoryName?: string
  timestamp: Date
}