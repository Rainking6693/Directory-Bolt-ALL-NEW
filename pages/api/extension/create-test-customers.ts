// @ts-nocheck
/**
 * Create Test Customers API
 * Creates test customer records for extension validation testing
 */

import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    })
  }

  try {
    console.log('🧪 Creating test customer records for extension validation')

    const {
      createOrUpdateCustomer,
      findByCustomerId
    } = await import('../../../lib/services/customer-service')

    // Create test customers with both DIR- and DB- prefixes
    const testCustomers = [
      {
        customerId: 'DB-2025-TEST01',
        firstName: 'Test',
        lastName: 'Customer',
        businessName: 'DB Test Business',
        email: 'test-db@directorybolt.com',
        phone: '555-0001',
        address: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zip: '90210',
        website: 'https://test-db-business.com',
        description: 'Test business for DB prefix validation',
        packageType: 'growth' as const,
        submissionStatus: 'pending' as const
      },
      {
        customerId: 'DB-2025-TEST02',
        firstName: 'Another',
        lastName: 'Test',
        businessName: 'DB Premium Business',
        email: 'test-db2@directorybolt.com',
        phone: '555-0002',
        address: '456 Test Ave',
        city: 'Test Town',
        state: 'NY',
        zip: '10001',
        website: 'https://test-db-premium.com',
        description: 'Premium test business for DB prefix validation',
        packageType: 'pro' as const,
        submissionStatus: 'pending' as const
      },
      {
        customerId: 'DIR-2025-TEST03',
        firstName: 'Legacy',
        lastName: 'Customer',
        businessName: 'DIR Legacy Business',
        email: 'test-dir@directorybolt.com',
        phone: '555-0003',
        address: '789 Legacy Blvd',
        city: 'Legacy City',
        state: 'TX',
        zip: '75001',
        website: 'https://test-dir-legacy.com',
        description: 'Legacy test business for DIR prefix validation',
        packageType: 'starter' as const,
        submissionStatus: 'pending' as const
      }
    ]

    const results = []

    for (const customer of testCustomers) {
      try {
        // Check if customer already exists
        const existing = await findByCustomerId(customer.customerId)
        
        if (existing) {
          console.log(`✅ Test customer already exists: ${customer.customerId}`)
          results.push({
            customerId: customer.customerId,
            status: 'already_exists',
            businessName: existing.businessName
          })
        } else {
          // Create new test customer
          const created = await createOrUpdateCustomer({
            customerId: customer.customerId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            businessName: customer.businessName,
            email: customer.email,
            phone: customer.phone,
            city: customer.city,
            state: customer.state,
            packageType: customer.packageType,
            submissionStatus: customer.submissionStatus,
            website: customer.website,
            description: customer.description,
            status: 'pending',
            directoriesSubmitted: 0,
            failedDirectories: 0,
            metadata: {
              source: 'extension-test-customers'
            }
          })
          console.log(`✅ Test customer created: ${customer.customerId}`)
          results.push({
            customerId: customer.customerId,
            status: 'created',
            recordId: created.recordId,
            businessName: created.businessName
          })
        }
      } catch (error) {
        console.error(`❌ Failed to create test customer ${customer.customerId}:`, error)
        results.push({
          customerId: customer.customerId,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Test customer creation completed',
      results,
      summary: {
        total: testCustomers.length,
        created: results.filter(r => r.status === 'created').length,
        existing: results.filter(r => r.status === 'already_exists').length,
        errors: results.filter(r => r.status === 'error').length
      }
    })

  } catch (error) {
    console.error('❌ Test customer creation failed:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Test customer creation failed',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}