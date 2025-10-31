// @ts-nocheck
/**
 * DEBUG Extension Customer Validation API
 * Comprehensive debugging for extension authentication issues
 * Updated to use Google Sheets instead of Airtable
 */

import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log('🔍 DEBUG: Extension validation debug request')
    console.log('Method:', req.method)
    console.log('Headers:', req.headers)
    console.log('Body:', req.body)
    console.log('Query:', req.query)

    // Check environment variables
    const envCheck = {
      GOOGLE_SHEET_ID: !!process.env.GOOGLE_SHEET_ID,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
      NODE_ENV: process.env.NODE_ENV
    }

    console.log('🔍 Environment variables:', envCheck)

    // Test Google Sheets import
    let googleSheetsImportError = null
    let googleSheetsServiceError = null
    
    try {
      const { createGoogleSheetsService } = await import('../../../lib/services/google-sheets')
      console.log('✅ Google Sheets service imported successfully')
      
      try {
        const googleSheetsService = createGoogleSheetsService()
        console.log('✅ Google Sheets service created successfully')
        
        // Test health check
        const healthCheck = await googleSheetsService.healthCheck()
        console.log('🔍 Google Sheets health check:', healthCheck)
        
      } catch (serviceError) {
        console.error('❌ Google Sheets service creation failed:', serviceError)
        googleSheetsServiceError = serviceError instanceof Error ? serviceError.message : String(serviceError)
      }
      
    } catch (importError) {
      console.error('❌ Google Sheets import failed:', importError)
      googleSheetsImportError = importError instanceof Error ? importError.message : String(importError)
    }

    // Test customer ID if provided
    let customerTestResult = null
    const { customerId } = req.method === 'GET' ? req.query : req.body
    
    if (customerId) {
      console.log('🔍 Testing Customer ID:', customerId)
      
      try {
        const { createGoogleSheetsService } = await import('../../../lib/services/google-sheets')
        const googleSheetsService = createGoogleSheetsService()
        const customer = await googleSheetsService.findByCustomerId(customerId as string)
        
        customerTestResult = {
          found: !!customer,
          customerId: customer?.customerID || customer?.customerId,
          businessName: customer?.businessName,
          packageType: customer?.packageType,
          submissionStatus: customer?.submissionStatus
        }
        
        console.log('🔍 Customer test result:', customerTestResult)
        
      } catch (testError) {
        console.error('❌ Customer test failed:', testError)
        customerTestResult = {
          error: testError instanceof Error ? testError.message : String(testError)
        }
      }
    }

    return res.status(200).json({
      debug: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      googleSheetsImportError,
      googleSheetsServiceError,
      customerTestResult,
      request: {
        method: req.method,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        queryKeys: Object.keys(req.query)
      }
    })

  } catch (error) {
    console.error('❌ Debug API error:', error)
    
    return res.status(500).json({
      debug: true,
      error: 'Debug API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}