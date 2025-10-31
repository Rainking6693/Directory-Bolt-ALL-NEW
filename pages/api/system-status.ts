/**
 * EMERGENCY SYSTEM STATUS API
 * Comprehensive system diagnostics for DirectoryBolt
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

type GoogleSheetsConfigMethod = 'service-account-file' | 'environment-variables' | 'none'

interface SystemStatus {
  timestamp: string
  environment?: string
  environment_variables: {
    stripe: {
      secret_key: boolean
      secret_key_format: boolean
      publishable_key: boolean
      webhook_secret: boolean
      starter_price: boolean
      growth_price: boolean
      professional_price: boolean
      enterprise_price: boolean
    }
    google_sheets: {
      sheet_id: boolean
      service_account_email: boolean
      private_key: boolean
      service_account_file: boolean
      config_method: GoogleSheetsConfigMethod
    }
    ai: {
      openai_key: boolean
      anthropic_key: boolean
    }
    urls: {
      nextauth_url?: string
      base_url?: string
      app_url?: string
    }
  }
  api_endpoints: {
    payment_configured: boolean
    extension_validation: boolean
    google_sheets_connection: boolean
  }
  critical_issues: string[]
  warnings: string[]
  recommendations: string[]
}

const SERVICE_ACCOUNT_FILENAME = 'directoryboltGoogleKey9.17.json'

function serviceAccountFileExists(): boolean {
  try {
    const serviceAccountPath = path.join(process.cwd(), 'config', SERVICE_ACCOUNT_FILENAME)
    return fs.existsSync(serviceAccountPath)
  } catch {
    return false
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const status: SystemStatus = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      
      // Environment Variables Check
      environment_variables: {
        stripe: {
          secret_key: !!process.env.STRIPE_SECRET_KEY,
          secret_key_format: process.env.STRIPE_SECRET_KEY?.startsWith('sk_') || false,
          publishable_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
          webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
          starter_price: !!process.env.STRIPE_STARTER_PRICE_ID,
          growth_price: !!process.env.STRIPE_GROWTH_PRICE_ID,
          professional_price: !!process.env.STRIPE_PROFESSIONAL_PRICE_ID,
          enterprise_price: !!process.env.STRIPE_ENTERPRISE_PRICE_ID
        },
        google_sheets: {
          sheet_id: !!process.env.GOOGLE_SHEET_ID,
          service_account_email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: !!process.env.GOOGLE_PRIVATE_KEY,
          service_account_file: serviceAccountFileExists(),
          config_method: 'none'
        },
        ai: {
          openai_key: !!process.env.OPENAI_API_KEY,
          anthropic_key: !!process.env.ANTHROPIC_API_KEY
        },
        urls: {
          nextauth_url: process.env.NEXTAUTH_URL,
          base_url: process.env.BASE_URL,
          app_url: process.env.NEXT_PUBLIC_APP_URL
        }
      },

      // API Endpoints Status
      api_endpoints: {
        payment_configured: false,
        extension_validation: false,
        google_sheets_connection: false
      },

      // Critical Issues
      critical_issues: [],
      warnings: [],
      
      // Recommendations
      recommendations: []
    }

    // Check Stripe Configuration
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        status.critical_issues.push('STRIPE_SECRET_KEY is missing')
      } else if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
        status.critical_issues.push('STRIPE_SECRET_KEY has invalid format')
      } else {
        status.api_endpoints.payment_configured = true
      }

      if (!process.env.STRIPE_STARTER_PRICE_ID) {
        status.critical_issues.push('STRIPE_STARTER_PRICE_ID is missing')
      }
      if (!process.env.STRIPE_GROWTH_PRICE_ID) {
        status.critical_issues.push('STRIPE_GROWTH_PRICE_ID is missing')
      }
      if (!process.env.STRIPE_PROFESSIONAL_PRICE_ID) {
        status.critical_issues.push('STRIPE_PROFESSIONAL_PRICE_ID is missing')
      }

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        status.warnings.push('STRIPE_WEBHOOK_SECRET is missing - webhooks will not work')
      }
    } catch (error) {
      status.critical_issues.push(`Stripe configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Check Google Sheets Configuration
    try {
      let hasValidConfig = false
      let configMethod: GoogleSheetsConfigMethod = 'none'
      
      if (status.environment_variables.google_sheets.service_account_file) {
        hasValidConfig = true
        configMethod = 'service-account-file'
      } else {
        // Check environment variables
        if (!process.env.GOOGLE_SHEET_ID) {
          status.critical_issues.push('GOOGLE_SHEET_ID is missing')
        }
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
          status.critical_issues.push('GOOGLE_SERVICE_ACCOUNT_EMAIL is missing')
        }
        if (!process.env.GOOGLE_PRIVATE_KEY) {
          status.critical_issues.push('GOOGLE_PRIVATE_KEY is missing')
        }
        
        if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
          hasValidConfig = true
          configMethod = 'environment-variables'
        }
      }
      
      if (hasValidConfig) {
        status.api_endpoints.google_sheets_connection = true
        status.environment_variables.google_sheets.config_method = configMethod
      } else {
        status.critical_issues.push('Google Sheets not configured - missing both service account file and environment variables')
      }
    } catch (error) {
      status.critical_issues.push(`Google Sheets configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Test Extension Validation
    try {
      if (status.api_endpoints.google_sheets_connection) {
        status.api_endpoints.extension_validation = true
      } else {
        status.critical_issues.push('Extension validation will fail - Google Sheets not configured')
      }
    } catch (error) {
      status.critical_issues.push(`Extension validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Generate Recommendations
    if (status.critical_issues.length > 0) {
      status.recommendations.push('Set missing environment variables in Netlify dashboard')
      status.recommendations.push('Verify Stripe account is properly configured')
      status.recommendations.push('Check Google Sheets service account credentials are valid')
    }

    if (!status.api_endpoints.payment_configured) {
      status.recommendations.push('Payment system is not functional - customers cannot purchase')
    }

    if (!status.api_endpoints.extension_validation) {
      status.recommendations.push('Extension authentication is not functional - customers cannot use extension')
    }

    // Set appropriate status code
    const statusCode = status.critical_issues.length > 0 ? 503 : 200

    res.status(statusCode).json(status)
    return

  } catch (error) {
    res.status(500).json({
      error: 'System status check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
    return
  }
}
