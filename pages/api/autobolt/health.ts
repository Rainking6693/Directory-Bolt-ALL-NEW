/**
 * AutoBolt Health Check API
 * 
 * GET /api/autobolt/health - Health check for AutoBolt system
 * 
 * Returns system status and connectivity information
 * Used by Chrome extension to verify backend connectivity
 * 
 * Security: Public endpoint (no authentication required)
 * 
 * Phase 1 - Emergency Fix
 * Agent: Alex (Full-Stack Engineer)
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  services: {
    database: {
      status: 'connected' | 'disconnected' | 'error'
      response_time_ms?: number
      error?: string
    }
    api: {
      status: 'operational' | 'error'
      autobolt_key_configured: boolean
    }
    environment: {
      node_env: string
      port: number
    }
  }
  checks: {
    customers_table: boolean
    autobolt_processing_queue_table: boolean
    environment_variables: boolean
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse>
) {
  // Enhanced CORS headers for Chrome extension support
  const origin = req.headers.origin;
  
  if (origin && origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '2.0.1-emergency-fix',
      services: {
        database: { status: 'error', error: 'Method not allowed' },
        api: { status: 'error', autobolt_key_configured: false },
        environment: { node_env: process.env.NODE_ENV || 'unknown', port: 3001 }
      },
      checks: {
        customers_table: false,
        autobolt_processing_queue_table: false,
        environment_variables: false
      }
    })
  }

  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  
  // Initialize response structure
  const healthCheck: HealthCheckResponse = {
    status: 'healthy',
    timestamp,
    version: '2.0.1-emergency-fix',
    services: {
      database: { status: 'disconnected' },
      api: { 
        status: 'operational',
        autobolt_key_configured: !!process.env.AUTOBOLT_API_KEY
      },
      environment: {
        node_env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3001')
      }
    },
    checks: {
      customers_table: false,
      autobolt_processing_queue_table: false,
      environment_variables: false
    }
  }

  try {
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AUTOBOLT_API_KEY'
    ]
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
    healthCheck.checks.environment_variables = missingEnvVars.length === 0

    if (missingEnvVars.length > 0) {
      healthCheck.status = 'degraded'
      healthCheck.services.api.status = 'error'
    }

    // Test database connection
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      try {
        // Test customers table
        const { data: customersTest, error: customersError } = await supabase
          .from('customers')
          .select('customer_id')
          .limit(1)

        healthCheck.checks.customers_table = !customersError
        
        if (customersError) {
          console.error('Customers table check failed:', customersError)
        }

        // Test autobolt_processing_queue table
        const { data: queueTest, error: queueError } = await supabase
          .from('autobolt_processing_queue')
          .select('id')
          .limit(1)

        healthCheck.checks.autobolt_processing_queue_table = !queueError
        
        if (queueError) {
          console.error('AutoBolt queue table check failed:', queueError)
        }

        // Overall database status
        if (!customersError && !queueError) {
          healthCheck.services.database.status = 'connected'
          healthCheck.services.database.response_time_ms = Date.now() - startTime
        } else {
          healthCheck.services.database.status = 'error'
          healthCheck.services.database.error = customersError?.message || queueError?.message || 'Unknown database error'
          healthCheck.status = 'degraded'
        }

      } catch (dbError: any) {
        healthCheck.services.database.status = 'error'
        healthCheck.services.database.error = dbError.message
        healthCheck.status = 'unhealthy'
      }
    } else {
      healthCheck.services.database.status = 'error'
      healthCheck.services.database.error = 'Missing database configuration'
      healthCheck.status = 'unhealthy'
    }

    // Determine overall status
    const allChecksPass = Object.values(healthCheck.checks).every(check => check === true)
    const databaseConnected = healthCheck.services.database.status === 'connected'
    
    if (!allChecksPass || !databaseConnected) {
      healthCheck.status = healthCheck.status === 'unhealthy' ? 'unhealthy' : 'degraded'
    }

    // Return appropriate HTTP status code
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503

    console.log(`🏥 Health check completed: ${healthCheck.status} (${Date.now() - startTime}ms)`)
    
    return res.status(httpStatus).json(healthCheck)

  } catch (error: any) {
    console.error('Health check error:', error)
    
    healthCheck.status = 'unhealthy'
    healthCheck.services.database.status = 'error'
    healthCheck.services.database.error = error.message
    healthCheck.services.api.status = 'error'
    
    return res.status(503).json(healthCheck)
  }
}