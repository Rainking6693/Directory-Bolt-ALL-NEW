import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerConfig } from './supabaseEnv'
import { logInfo, logWarn, logError, serializeError } from './logging'

import type { DirectoryBoltDatabase, DirectoryBoltSupabaseClient } from '../../types/supabase'

let cachedClient: DirectoryBoltSupabaseClient | null = null

export function createSupabaseAdminClient(): DirectoryBoltSupabaseClient {
  const fn = 'supabaseAdmin.createSupabaseAdminClient'
  logInfo(fn, 'Invoked')

  try {
    const { url: supabaseUrl, serviceRoleKey: serviceKey } = getSupabaseServerConfig()
    logInfo(fn, 'Environment configuration loaded', {
      hasUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceKey),
      urlHost: tryParseHost(supabaseUrl)
    })

    const client = createClient<DirectoryBoltDatabase, 'public'>(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    logInfo(fn, 'Supabase client instantiated')
    return client
  } catch (error) {
    logError(fn, 'Failed to create Supabase client', { error: serializeError(error) })
    throw error
  }
}

function tryParseHost(url?: string) {
  try {
    const { host } = new URL(url || '')
    return host
  } catch (error) {
    logWarn('supabaseAdmin.tryParseHost', 'Failed to parse host', { error: serializeError(error), url })
    return undefined
  }
}

export function getSupabaseAdminClient(): DirectoryBoltSupabaseClient | null {
  const fn = 'supabaseAdmin.getSupabaseAdminClient'

  if (cachedClient) {
    logInfo(fn, 'Returning cached Supabase client')
    return cachedClient
  }

  try {
    cachedClient = createSupabaseAdminClient()
    logInfo(fn, 'Cached Supabase client created')
    return cachedClient
  } catch (error) {
    logError(fn, 'Supabase admin client unavailable', { error: serializeError(error) })
    return null
  }
}
