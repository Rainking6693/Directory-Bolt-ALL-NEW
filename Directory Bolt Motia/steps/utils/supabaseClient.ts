import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type SupabaseLike = SupabaseClient<any, any, any, any, any> | ReturnType<typeof createMockSupabase>

function createMockQuery<T = any[]>(data: T = [] as unknown as T) {
  const result: any = {
    data,
    error: null,
    eq: () => result,
    neq: () => result,
    gt: () => result,
    lt: () => result,
    gte: () => result,
    lte: () => result,
    in: () => result,
    like: () => result,
    ilike: () => result,
    order: () => result,
    limit: () => result,
    range: () => result,
    single: async () => ({ data: Array.isArray(data) ? (data[0] ?? null) : (data as any), error: null }),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }

  return result
}

function createMockSupabase() {
  return {
    from: () => ({
      select: () => createMockQuery(),
      insert: () => createMockQuery(),
      update: () => createMockQuery(),
      delete: () => createMockQuery(),
    }),
  }
}

export function getSupabaseClient(): SupabaseLike {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && supabaseKey) {
    return createClient(supabaseUrl, supabaseKey)
  }

  return createMockSupabase()
}

export type { SupabaseLike }
