import { supabase } from './supabase'

export interface CustomerProfile {
  customerId: string
  firstName?: string
  lastName?: string
  businessName?: string
  website?: string
  description?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  packageType?: string
  status?: string
  submissionStatus?: string
  directoriesSubmitted?: number
  failedDirectories?: number
  sessionId?: string
  metadata?: Record<string, unknown>
}

interface DirectoryStats {
  submitted: number
  failed: number
}

function mapRowToCustomer(row: any): CustomerProfile {
  if (!row) return null as unknown as CustomerProfile

  return {
    customerId: row.customer_id,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    businessName: row.business_name ?? undefined,
    website: row.website ?? undefined,
    description: row.description ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    packageType: row.package_type ?? undefined,
    status: row.status ?? undefined,
    submissionStatus: row.submission_status ?? undefined,
    directoriesSubmitted: row.directories_submitted ?? undefined,
    failedDirectories: row.failed_directories ?? undefined,
    sessionId: row.session_id ?? undefined,
    metadata: row.metadata ?? undefined
  }
}

export async function findByCustomerId(customerId: string): Promise<CustomerProfile | null> {
  if (!customerId) {
    throw new Error('customerId is required')
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (error) {
    console.error('[customer-service] Failed to fetch customer', { customerId, error })
    throw error
  }

  return mapRowToCustomer(data)
}

export async function findPendingCustomerBySessionOrEmail(
  sessionId: string | null,
  email: string
): Promise<CustomerProfile | null> {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('status', 'pending')

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  } else {
    query = query.eq('email', email)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('[customer-service] Failed to find pending customer', { sessionId, email, error })
    throw error
  }

  return mapRowToCustomer(data)
}

export async function createOrUpdateCustomer(profile: Partial<CustomerProfile>): Promise<CustomerProfile | null> {
  if (!profile?.customerId) {
    throw new Error('profile must include customerId')
  }

  const payload = {
    customer_id: profile.customerId,
    first_name: profile.firstName ?? null,
    last_name: profile.lastName ?? null,
    business_name: profile.businessName ?? null,
    website: profile.website ?? null,
    description: profile.description ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    city: profile.city ?? null,
    state: profile.state ?? null,
    package_type: profile.packageType ?? null,
    status: profile.status ?? 'pending',
    submission_status: profile.submissionStatus ?? 'pending',
    directories_submitted: profile.directoriesSubmitted ?? 0,
    failed_directories: profile.failedDirectories ?? 0,
    session_id: profile.sessionId ?? null,
    metadata: profile.metadata ?? null
  }

  const { data, error } = await supabase
    .from('customers')
    .upsert(payload, { onConflict: 'customer_id' })
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[customer-service] Failed to upsert customer', { payload, error })
    throw error
  }

  return mapRowToCustomer(data)
}

export async function updateDirectoryStats(
  customerId: string,
  { submitted, failed }: DirectoryStats
): Promise<CustomerProfile | null> {
  if (!customerId) {
    throw new Error('customerId is required')
  }

  const update = {
    directories_submitted: submitted,
    failed_directories: failed
  }

  const { data, error } = await supabase
    .from('customers')
    .update(update)
    .eq('customer_id', customerId)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[customer-service] Failed to update directory stats', {
      customerId,
      update,
      error
    })
    throw error
  }

  return mapRowToCustomer(data)
}

export async function updateSubmissionStatus(
  customerId: string,
  status: string,
  directoriesSubmitted?: number,
  failedDirectories?: number
): Promise<CustomerProfile | null> {
  if (!customerId) {
    throw new Error('customerId is required')
  }

  const update: Record<string, any> = {
    submission_status: status
  }

  if (typeof directoriesSubmitted === 'number') {
    update.directories_submitted = directoriesSubmitted
  }

  if (typeof failedDirectories === 'number') {
    update.failed_directories = failedDirectories
  }

  const { data, error } = await supabase
    .from('customers')
    .update(update)
    .eq('customer_id', customerId)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[customer-service] Failed to update submission status', {
      customerId,
      update,
      error
    })
    throw error
  }

  return mapRowToCustomer(data)
}

export function mapCustomerToSubmissionRecord(customer: CustomerProfile | null) {
  if (!customer) return null

  const metadata = (customer.metadata ?? {}) as Record<string, any>
  const social = (metadata.social ?? {}) as Record<string, any>

  return {
    customerId: customer.customerId,
    businessName: customer.businessName ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    website: customer.website ?? '',
    description: customer.description ?? '',
    address: metadata.address ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    zip: metadata.zip ?? '',
    facebook: social.facebook ?? '',
    instagram: social.instagram ?? '',
    linkedin: social.linkedin ?? ''
  }
}
