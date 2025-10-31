/**
 * Security Testing API - Admin Authentication Test
 * This endpoint tests admin authentication security per Emily's requirements
 * Used to demonstrate that hardcoded credentials are no longer active
 */

import { authenticateAdmin } from '../../../lib/auth/admin-auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    })
  }

  try {
    const { testType = 'basic', simulateProduction = false } = req.body

    const results = {
      timestamp: new Date().toISOString(),
      testType,
      simulateProduction,
      environmentVariables: {
        ADMIN_API_KEY_SET: !!process.env.ADMIN_API_KEY,
        ADMIN_SESSION_TOKEN_SET: !!process.env.ADMIN_SESSION_TOKEN,
        ADMIN_USERNAME_SET: !!process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD
      },
      authTests: []
    }

    // Test different scenarios
    const testCases = [
      {
        name: 'Valid API Key Test',
        headers: { 'x-admin-key': process.env.ADMIN_API_KEY }
      },
      {
        name: 'Invalid API Key Test',
        headers: { 'x-admin-key': 'invalid-key-should-fail' }
      },
      {
        name: 'No Credentials Test',
        headers: {}
      },
      {
        name: 'Old Hardcoded Key Test (Should Fail)',
        headers: { 'x-admin-key': 'DirectoryBolt-Admin-2025-SecureKey' }
      }
    ]

    for (const testCase of testCases) {
      // Create mock request object
      const mockReq = {
        headers: testCase.headers,
        cookies: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      // For production simulation, temporarily clear env vars
      let originalVars = {}
      if (simulateProduction && testCase.name.includes('Valid API Key')) {
        originalVars = {
          ADMIN_API_KEY: process.env.ADMIN_API_KEY,
          ADMIN_SESSION_TOKEN: process.env.ADMIN_SESSION_TOKEN,
          ADMIN_USERNAME: process.env.ADMIN_USERNAME,
          ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
        }
        delete process.env.ADMIN_API_KEY
        delete process.env.ADMIN_SESSION_TOKEN
        delete process.env.ADMIN_USERNAME
        delete process.env.ADMIN_PASSWORD
      }

      try {
        const authResult = await authenticateAdmin(mockReq)
        
        results.authTests.push({
          testName: testCase.name,
          authenticated: authResult.authenticated,
          error: authResult.error,
          user: authResult.user,
          expected: testCase.name.includes('Valid API Key') && !simulateProduction ? 'success' : 'failure',
          passed: testCase.name.includes('Valid API Key') && !simulateProduction ? 
            authResult.authenticated : !authResult.authenticated
        })
      } catch (error) {
        results.authTests.push({
          testName: testCase.name,
          authenticated: false,
          error: error.message,
          passed: !testCase.name.includes('Valid API Key')
        })
      }

      // Restore environment variables if they were cleared
      if (simulateProduction && testCase.name.includes('Valid API Key')) {
        Object.assign(process.env, originalVars)
      }
    }

    // Calculate overall security status
    const failedTests = results.authTests.filter(test => !test.passed)
    const securityStatus = failedTests.length === 0 ? 'SECURE' : 'VULNERABLE'

    return res.status(200).json({
      success: true,
      message: 'Admin authentication security test completed',
      securityStatus,
      results,
      summary: {
        totalTests: results.authTests.length,
        passed: results.authTests.filter(test => test.passed).length,
        failed: failedTests.length,
        harcodedCredentialsActive: results.authTests
          .find(test => test.testName.includes('Old Hardcoded'))?.authenticated || false
      }
    })

  } catch (error) {
    console.error('Admin auth test endpoint error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Admin authentication test failed'
    })
  }
}