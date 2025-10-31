export interface CustomerDashboard {
  totalDirectories: number
  submitted: number
  live: number
  pending: number
  lastUpdated: string
  userId: string
  businessName: string
}

export interface DirectoryStatus {
  id: string
  name: string
  status: 'pending' | 'submitted' | 'live' | 'rejected' | 'processing'
  submittedAt?: string
  liveAt?: string
  rejectedReason?: string
  category: string
  tier: 'premium' | 'standard' | 'local'
  domainAuthority?: number
  estimatedTraffic?: number
  listingUrl?: string
}

export interface BusinessInfo {
  id: string
  businessName: string
  description: string
  website: string
  phone: string
  email: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  categories: string[]
  logo?: string
  images?: string[]
  socialMedia?: {
    facebook?: string
    twitter?: string
    linkedin?: string
    instagram?: string
  }
  openingHours?: {
    [key: string]: {
      open: string
      close: string
      closed: boolean
    } | undefined
  }
}

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionText?: string
}

export interface ActionCard {
  id: string
  title: string
  description: string
  type: 'verification' | 'approval' | 'update' | 'payment'
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  actionUrl: string
  actionText: string
  status: 'pending' | 'in_progress' | 'completed'
  directoryName?: string
  estimatedTime?: number // minutes
  requiresUpload?: boolean
}

// Extended verification action types
export interface VerificationAction extends ActionCard {
  type: 'verification'
  verificationType: 'sms' | 'email' | 'document' | 'phone_call' | 'identity'
  contactInfo?: {
    email?: string
    phone?: string
  }
  documentRequirements?: {
    acceptedFormats: string[]
    maxFileSize: number // MB
    maxFiles: number
    description: string
  }
  phoneCallOptions?: {
    availableSlots: string[] // ISO date strings
    duration: number // minutes
    timezone: string
  }
}

export interface UploadStatus {
  id: string
  fileName: string
  fileSize: number
  uploadProgress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  errorMessage?: string
  previewUrl?: string
}

export interface DashboardStats {
  totalDirectories: number
  submitted: number
  live: number
  pending: number
  rejectedCount: number
  averageApprovalTime: number
  completionRate: number
  monthlyTraffic?: number
  leadGeneration?: number
}

export interface VerificationStats {
  totalActions: number
  completedActions: number
  pendingActions: number
  urgentActions: number
  averageCompletionTime: number
  completionRate: number
}

// Verification Action Center Types
export interface PendingAction {
  id: string
  type: 'sms' | 'email' | 'document' | 'phone_call'
  directory: string
  directoryId: string
  instructions: string
  deadline?: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: string
  updatedAt?: string
  estimatedTimeMinutes: number
  attempts?: number
  maxAttempts?: number
  metadata?: {
    phoneNumber?: string
    email?: string
    documentTypes?: string[]
    smsCode?: string
    verificationData?: any
  }
}

export interface VerificationFormData {
  actionId: string
  type: 'sms' | 'email' | 'document' | 'phone_call'
  data: any
}

export interface DocumentUpload {
  id: string
  filename: string
  fileType: string
  fileSize: number
  uploadUrl: string
  status: 'uploading' | 'uploaded' | 'processing' | 'verified' | 'rejected'
  rejectionReason?: string
}

export interface SMSVerification {
  phoneNumber: string
  code: string
  verified: boolean
  expiresAt: string
}

export interface EmailVerification {
  email: string
  verified: boolean
  verificationLink?: string
  sentAt?: string
}

export interface PhoneCallSchedule {
  preferredDate: string
  preferredTime: string
  timeZone: string
  phoneNumber: string
  notes?: string
  scheduled: boolean
  scheduledFor?: string
}