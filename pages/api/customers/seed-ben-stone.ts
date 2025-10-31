import type { NextApiRequest, NextApiResponse} from 'next'

/**
 * Seed Ben Stone Test Customer
 * 
 * BYPASS MODE: Creates test customer for verification
 * Returns customer data that can be used for testing
 */

interface SeedResponse {
  success: boolean
  customer?: any
  instructions?: string[]
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SeedResponse>
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Create Ben Stone test customer
    const benStone = {
      id: 'test-ben-stone-' + Date.now(),
      firstName: 'Ben',
      lastName: 'Stone',
      businessName: 'DirectoryBolt',
      email: 'rainking6693@gmail.com',
      phone: '(801) 555-0123',
      address: '4026 W Harper Lan',
      city: 'Lehi',
      state: 'UT',
      zip: '84043',
      website: 'www.directorybolt.com',
      packageType: 'PRO',
      directoryLimit: 200,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    console.log('✅ Test customer seeded: Ben Stone')

    return res.status(200).json({
      success: true,
      customer: benStone,
      instructions: [
        '1. Copy the customer ID from the response',
        '2. Use POST /api/autobolt/push with body: { "customerId": "<id>", "priority": 1 }',
        '3. Check queue status at /staff-dashboard',
        '',
        '⚠️  BYPASS MODE ACTIVE:',
        '- Customer created in-memory (not persisted to Supabase)',
        '- Set SUPABASE_SERVICE_ROLE_KEY to use real database',
        '',
        '🔶 DEFERRED for human:',
        '- Configure Supabase environment variables',
        '- Remove in-memory bypass after testing'
      ]
    })

  } catch (error) {
    console.error('❌ Seed customer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to seed test customer'
    })
  }
}

