import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
let supabaseServerInstance: ReturnType<typeof createClient> | null = null

function getSupabaseServer() {
  if (supabaseServerInstance) {
    return supabaseServerInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY')
  }

  supabaseServerInstance = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false
    }
  })

  return supabaseServerInstance
}

export const supabaseServer = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return getSupabaseServer()[prop as keyof ReturnType<typeof createClient>]
  }
})
