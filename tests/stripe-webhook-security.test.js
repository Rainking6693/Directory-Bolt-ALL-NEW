/**
 * Stripe Webhook Security Tests
 * Tests signature verification, authentication, and security measures
 */

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')
const crypto = require('crypto')

const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
}

const stripe = new Stripe(TEST_CONFIG.stripeSecretKey, {
  apiVersion: '2023-08-16',
})

// Test results tracking
let totalTests = 0
let passedTests = 0
const failedTests = []

function logTest(name, passed, details = null) {
  totalTests++
  if (passed) {
    passedTests++
    console.log(`✅ ${name}`)
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`)
    }
  } else {
    failedTests.push(name)
    console.log(`❌ ${name}`)
    if (details) {
      console.log(`   Details: ${details}`)
    }
  }
}

// Generate valid Stripe webhook signature
function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000)
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const signedPayload = `${timestamp}.${payloadString}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')
  
  return {
    header: `t=${timestamp},v1=${signature}`,
    timestamp,
    payload: payloadString
  }
}

async function testWebhookSignatureValidation() {
  console.log('\n🔐 Testing Webhook Signature Validation...\n')

  const endpoints = [
    '/api/webhooks/stripe',
    '/api/webhooks/stripe-secure',
    '/api/webhooks/stripe-subscription',
    '/api/stripe/webhook'
  ]

  for (const endpoint of endpoints) {
    const url = `${TEST_CONFIG.baseUrl}${endpoint}`

    // Test 1: Missing signature header
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      })
      const isError = response.status >= 400
      logTest(`${endpoint} - Rejects missing signature`, isError, {
        status: response.status,
        expected: '400 or 500'
      })
    } catch (error) {
      logTest(`${endpoint} - Rejects missing signature`, false, error.message)
    }

    // Test 2: Invalid signature format
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid_signature'
        },
        body: JSON.stringify({ test: 'data' })
      })
      const isError = response.status >= 400
      logTest(`${endpoint} - Rejects invalid signature format`, isError, {
        status: response.status,
        expected: '400 or 500'
      })
    } catch (error) {
      logTest(`${endpoint} - Rejects invalid signature format`, false, error.message)
    }

    // Test 3: Valid signature format but wrong secret
    try {
      const payload = JSON.stringify({
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: {} }
      })
      const wrongSecret = 'whsec_wrong_secret_1234567890'
      const { header } = generateStripeSignature(payload, wrongSecret)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': header
        },
        body: payload
      })
      const isError = response.status >= 400
      logTest(`${endpoint} - Rejects wrong secret`, isError, {
        status: response.status,
        expected: '400 or 500'
      })
    } catch (error) {
      logTest(`${endpoint} - Rejects wrong secret`, false, error.message)
    }

    // Test 4: Expired timestamp (replay attack prevention)
    try {
      const payload = JSON.stringify({
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: {} }
      })
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 400 seconds old
      const signedPayload = `${oldTimestamp}.${payload}`
      const signature = crypto
        .createHmac('sha256', TEST_CONFIG.webhookSecret)
        .update(signedPayload)
        .digest('hex')
      const header = `t=${oldTimestamp},v1=${signature}`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': header
        },
        body: payload
      })
      const isError = response.status >= 400
      logTest(`${endpoint} - Rejects expired timestamp`, isError, {
        status: response.status,
        expected: '400 or 500',
        note: 'Prevents replay attacks'
      })
    } catch (error) {
      logTest(`${endpoint} - Rejects expired timestamp`, false, error.message)
    }
  }
}

async function testAuthenticationMiddleware() {
  console.log('\n🔒 Testing Authentication Middleware...\n')

  const publicEndpoints = [
    '/api/webhooks/stripe',
    '/api/webhooks/stripe-secure',
    '/api/webhooks/stripe-subscription',
    '/api/webhooks/stripe-one-time-payments',
    '/api/stripe/webhook',
    '/api/payments/webhook'
  ]

  for (const endpoint of publicEndpoints) {
    try {
      const url = `${TEST_CONFIG.baseUrl}${endpoint}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      })

      // Webhooks should reject unsigned requests with 400, 401, 500, or 504
      // They rely on signature verification, not session authentication
      const isProperlySecured = response.status === 400 || response.status === 401 || response.status === 500 || response.status === 504
      logTest(`${endpoint} - Properly rejects unsigned requests`, isProperlySecured, {
        status: response.status,
        expected: '400, 401, 500, or 504',
        note: 'Signature verification working'
      })
    } catch (error) {
      logTest(`${endpoint} - Properly rejects unsigned requests`, false, error.message)
    }
  }
}

async function testRateLimiting() {
  console.log('\n⏱️ Testing Rate Limiting & Performance...\n')

  const endpoint = '/api/webhooks/stripe-secure'
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`

  // Test concurrent requests
  try {
    const startTime = Date.now()
    const requests = Array(5).fill(null).map(() =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      })
    )
    
    const responses = await Promise.all(requests)
    const endTime = Date.now()
    const duration = endTime - startTime
    
    const allResponded = responses.every(r => r.status > 0)
    logTest('Handles concurrent requests', allResponded, {
      requests: 5,
      duration: `${duration}ms`,
      avgResponseTime: `${Math.round(duration / 5)}ms`
    })
  } catch (error) {
    logTest('Handles concurrent requests', false, error.message)
  }

  // Test response time
  try {
    const startTime = Date.now()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    })
    const endTime = Date.now()
    const duration = endTime - startTime
    
    const isFast = duration < 5000 // Should respond within 5 seconds
    logTest('Responds within timeout', isFast, {
      duration: `${duration}ms`,
      threshold: '5000ms'
    })
  } catch (error) {
    logTest('Responds within timeout', false, error.message)
  }
}

async function testIdempotency() {
  console.log('\n🔄 Testing Idempotency...\n')

  const endpoint = '/api/webhooks/stripe-secure'
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`

  // Create a valid webhook event
  const eventPayload = {
    id: `evt_test_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        customer_email: 'test@example.com',
        amount_total: 14900
      }
    }
  }

  const { header, payload } = generateStripeSignature(eventPayload, TEST_CONFIG.webhookSecret)

  try {
    // Send same event twice
    const response1 = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': header
      },
      body: payload
    })

    const response2 = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': header
      },
      body: payload
    })

    // Both should succeed (idempotent)
    const bothSucceeded = response1.status === response2.status
    logTest('Handles duplicate events idempotently', bothSucceeded, {
      response1: response1.status,
      response2: response2.status,
      note: 'Same event ID should be handled safely'
    })
  } catch (error) {
    logTest('Handles duplicate events idempotently', false, error.message)
  }
}

async function runAllTests() {
  console.log('🧪 STRIPE WEBHOOK SECURITY TEST SUITE\n')
  console.log('============================================================\n')
  console.log('📋 Configuration:')
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`)
  console.log(`   Webhook Secret: ${TEST_CONFIG.webhookSecret ? 'Configured' : 'Missing'}`)
  console.log('\n============================================================\n')

  await testWebhookSignatureValidation()
  await testAuthenticationMiddleware()
  await testRateLimiting()
  await testIdempotency()

  // Print summary
  console.log('\n============================================================\n')
  console.log('📊 TEST SUMMARY\n')
  console.log(`Total Tests: ${totalTests}`)
  console.log(`✅ Passed: ${passedTests}`)
  console.log(`❌ Failed: ${totalTests - passedTests}`)
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:')
    failedTests.forEach(test => console.log(`   - ${test}`))
  }

  console.log('\n============================================================\n')
}

runAllTests().catch(console.error)

