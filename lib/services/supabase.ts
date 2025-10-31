import { createClient } from '@supabase/supabase-js'

type SupabaseClientInstance = ReturnType<typeof createClient>

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
}

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined'
  }
})

interface LegacyExports {
  createSupabaseService: () => unknown
  SupabaseService: new () => unknown
}

const legacy: LegacyExports = require('./supabase.js')

export interface SupabaseCustomer {
  customerId: string
  firstName?: string
  lastName?: string
  businessName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  packageType?: string
  status?: string
  submissionStatus?: string
  directoriesSubmitted?: number
  failedDirectories?: number
  purchaseDate?: string
  recordId?: string
}

export interface SupabaseQueryResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface SupabaseService {
  initialize(): Promise<boolean>
  testConnection(): Promise<{ ok: boolean; message?: string; error?: string; hasData?: boolean }>
  getCustomerById(
    customerId: string
  ): Promise<{ found: boolean; customer?: SupabaseCustomer; error?: string }>
  findByCustomerId(customerId: string): Promise<SupabaseCustomer | null>
  getAllCustomers(
    limit?: number
  ): Promise<{ success: boolean; customers: SupabaseCustomer[]; total: number; error?: string }>
  addCustomer(customer: SupabaseCustomer): Promise<{ success: boolean; customerId?: string; error?: string }>
  updateCustomer(
    customerId: string,
    updateData: Record<string, unknown>
  ): Promise<{ success: boolean; updatedFields?: string[]; customerId?: string; error?: string }>
  updateSubmissionStatus(
    customerId: string,
    status: string,
    directoriesSubmitted?: number | null,
    failedDirectories?: number | null
  ): Promise<boolean>
  healthCheck(): Promise<boolean>
  findByStatus(status: string): Promise<SupabaseCustomer[]>
  subscribeToCustomers(callback: (payload: unknown) => void): unknown
  unsubscribe(subscription: unknown): void
  getDatabaseHealthDashboard(): unknown
}

export function createSupabaseService(): SupabaseService {
  return legacy.createSupabaseService() as SupabaseService
}

export const SupabaseService = legacy.SupabaseService as unknown as {
  new (): SupabaseService
}

export type { SupabaseClientInstance }

export default SupabaseService
