import type { SupabaseClient } from '@supabase/supabase-js'

function getDirectoryLimit(packageType: any): number {
  const type = String(packageType || '').toLowerCase()
  switch (type) {
    case 'enterprise':
      return 1000
    case 'pro':
    case 'professional':
      return 500
    case 'growth':
      return 150
    case 'starter':
    default:
      return 50
  }
}

function getPriorityLevel(packageType: any): number {
  const type = String(packageType || '').toLowerCase()
  switch (type) {
    case 'enterprise':
    case 'pro':
      return 1
    case 'professional':
      return 2
    case 'growth':
      return 3
    case 'starter':
    default:
      return 4
  }
}

export async function enqueueCustomerForAutoBolt(
  supabase: SupabaseClient,
  customer: Record<string, any>,
): Promise<{ success: boolean; message: string }>
{
  const customerId = customer.customer_id ?? customer.id
  const businessName = customer.business_name ?? customer.businessName ?? 'Unknown'
  const email = customer.email ?? null
  const packageType = customer.package_type ?? customer.packageType ?? 'starter'

  try {
    console.log(`[AutoBolt Sync] enqueue start id=${customerId} pkg=${packageType} at=${new Date().toISOString()}`)

    const directoryLimit = getDirectoryLimit(packageType)
    const priorityLevel = getPriorityLevel(packageType)

    const { error: queueError } = await supabase
      .from('autobolt_processing_queue')
      .insert([{ 
        customer_id: customerId,
        business_name: businessName,
        email,
        package_type: packageType,
        directory_limit: directoryLimit,
        priority_level: priorityLevel,
        status: 'queued',
        action: 'auto_enqueue',
        created_at: new Date().toISOString(),
        created_by: 'server_sync'
      }])

    if (queueError) {
      console.error('[AutoBolt Sync] enqueue failed:', queueError)
      return { success: false, message: queueError.message }
    }

    // Best-effort: update customers.status → queued
    await supabase
      .from('customers')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .or(`customer_id.eq.${customerId},id.eq.${customerId}`)

    const hasExternal = Boolean(process.env.AUTOBOLT_API && process.env.AUTOBOLT_TOKEN)
    if (!hasExternal) {
      console.warn('[AutoBolt Sync] External AutoBolt API integration DEFERRED (missing AUTOBOLT_API/AUTOBOLT_TOKEN)')
    }

    console.log(`[AutoBolt Sync] enqueue success id=${customerId} at=${new Date().toISOString()}`)
    return { success: true, message: 'enqueued' }
  } catch (err: any) {
    console.error('[AutoBolt Sync] unexpected error:', err)
    return { success: false, message: err?.message || 'unknown error' }
  }
}
