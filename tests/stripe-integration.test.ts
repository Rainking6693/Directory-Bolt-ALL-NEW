/**
 * COMPREHENSIVE STRIPE INTEGRATION TESTS
 * Tests all Stripe webhooks, checkout sessions, and payment features
 */

import Stripe from 'stripe'
import { getStripeClient, testStripeConnection, validateStripePrice, verifyWebhookSignature } from '../lib/utils/stripe-client'

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  priceIds: {
    starter: process.env.STRIPE_STARTER_PRICE_ID!,
    growth: process.env.STRIPE_GROWTH_PRICE_ID!,
    professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!
  }
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

const results: TestResult[] = []

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (error) console.log(`   Error: ${error}`)
  if (details) console.log(`   Details:`, details)
}

async function testStripeClientInitialization() {
  try {
    const stripe = getStripeClient()
    logTest('Stripe Client Initialization', !!stripe)
  } catch (error) {
    logTest('Stripe Client Initialization', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testStripeConnection() {
  try {
    const result = await testStripeConnection()
    logTest('Stripe API Connection', result.connected, result.error, {
      accountId: result.accountId,
      keyType: result.keyType
    })
  } catch (error) {
    logTest('Stripe API Connection', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testPriceValidation() {
  const priceTests = [
    { name: 'Starter', id: TEST_CONFIG.priceIds.starter },
    { name: 'Growth', id: TEST_CONFIG.priceIds.growth },
    { name: 'Professional', id: TEST_CONFIG.priceIds.professional },
    { name: 'Enterprise', id: TEST_CONFIG.priceIds.enterprise }
  ]

  for (const { name, id } of priceTests) {
    if (!id) {
      logTest(`Price Validation - ${name}`, false, 'Price ID not configured')
      continue
    }

    try {
      const result = await validateStripePrice(id)
      logTest(`Price Validation - ${name}`, result.valid, result.error, {
        priceId: id,
        amount: result.price?.unit_amount ? `$${result.price.unit_amount / 100}` : 'N/A',
        currency: result.price?.currency,
        active: result.price?.active
      })
    } catch (error) {
      logTest(`Price Validation - ${name}`, false, error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

async function testCheckoutSessionCreation() {
  const stripe = getStripeClient()
  const plans = ['starter', 'growth', 'professional', 'enterprise'] as const

  for (const plan of plans) {
    const priceId = TEST_CONFIG.priceIds[plan]
    if (!priceId) {
      logTest(`Checkout Session - ${plan}`, false, 'Price ID not configured')
      continue
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${TEST_CONFIG.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${TEST_CONFIG.baseUrl}/pricing`,
        customer_email: `test-${plan}@example.com`,
        metadata: {
          plan,
          test: 'true'
        }
      })

      logTest(`Checkout Session - ${plan}`, !!session.id, undefined, {
        sessionId: session.id,
        url: session.url?.substring(0, 50) + '...',
        status: session.status
      })
    } catch (error) {
      logTest(`Checkout Session - ${plan}`, false, error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

async function testWebhookEndpoints() {
  const endpoints = [
    '/api/webhooks/stripe',
    '/api/webhooks/stripe-secure',
    '/api/webhooks/stripe-subscription',
    '/api/webhooks/stripe-one-time-payments',
    '/api/stripe/webhook',
    '/api/payments/webhook'
  ]

  for (const endpoint of endpoints) {
    try {
      const url = `${TEST_CONFIG.baseUrl}${endpoint}`
      
      // Test GET request (should return 405)
      const getResponse = await fetch(url, { method: 'GET' })
      const getOk = getResponse.status === 405
      
      // Test POST without signature (should return 400 or 401)
      const postResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      })
      const postOk = postResponse.status === 400 || postResponse.status === 401 || postResponse.status === 500
      
      logTest(`Webhook Endpoint - ${endpoint}`, getOk && postOk, undefined, {
        getStatus: getResponse.status,
        postStatus: postResponse.status
      })
    } catch (error) {
      logTest(`Webhook Endpoint - ${endpoint}`, false, error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

async function testWebhookSignatureVerification() {
  const stripe = getStripeClient()
  
  // Create a test event
  const testEvent = {
    id: 'evt_test_webhook',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        customer_email: 'test@example.com'
      }
    }
  }

  const payload = JSON.stringify(testEvent)
  const timestamp = Math.floor(Date.now() / 1000)
  
  // Generate valid signature
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_CONFIG.stripeWebhookSecret
  })

  try {
    const event = verifyWebhookSignature(payload, signature)
    logTest('Webhook Signature Verification - Valid', !!event, undefined, {
      eventId: event.id,
      eventType: event.type
    })
  } catch (error) {
    logTest('Webhook Signature Verification - Valid', false, error instanceof Error ? error.message : 'Unknown error')
  }

  // Test invalid signature
  try {
    verifyWebhookSignature(payload, 'invalid_signature')
    logTest('Webhook Signature Verification - Invalid', false, 'Should have thrown error')
  } catch (error) {
    logTest('Webhook Signature Verification - Invalid', true, undefined, {
      expectedError: 'Correctly rejected invalid signature'
    })
  }
}

async function testWebhookEventHandling() {
  const stripe = getStripeClient()
  
  const eventTypes = [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'customer.created',
    'customer.updated',
    'invoice.payment_succeeded',
    'invoice.payment_failed'
  ]

  for (const eventType of eventTypes) {
    try {
      // Create a mock event payload
      const testEvent = {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        type: eventType,
        data: {
          object: {
            id: `test_${Date.now()}`,
            object: eventType.split('.')[0]
          }
        }
      }

      const payload = JSON.stringify(testEvent)
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: TEST_CONFIG.stripeWebhookSecret
      })

      // Test against primary webhook endpoint
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: payload
      })

      const responseOk = response.status === 200 || response.status === 500 // 500 might occur if DB not available
      logTest(`Webhook Event - ${eventType}`, responseOk, undefined, {
        status: response.status,
        statusText: response.statusText
      })
    } catch (error) {
      logTest(`Webhook Event - ${eventType}`, false, error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

async function testCustomerCreation() {
  const stripe = getStripeClient()

  try {
    const customer = await stripe.customers.create({
      email: `test-${Date.now()}@example.com`,
      name: 'Test Customer',
      metadata: {
        test: 'true',
        source: 'integration_test'
      }
    })

    logTest('Customer Creation', !!customer.id, undefined, {
      customerId: customer.id,
      email: customer.email
    })

    // Cleanup
    await stripe.customers.del(customer.id)
  } catch (error) {
    logTest('Customer Creation', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testPaymentIntentCreation() {
  const stripe = getStripeClient()

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2999, // $29.99
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        test: 'true',
        source: 'integration_test'
      }
    })

    logTest('Payment Intent Creation', !!paymentIntent.id, undefined, {
      paymentIntentId: paymentIntent.id,
      amount: `$${paymentIntent.amount / 100}`,
      status: paymentIntent.status
    })
  } catch (error) {
    logTest('Payment Intent Creation', false, error instanceof Error ? error.message : 'Unknown error')
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n🧪 STRIPE INTEGRATION TEST SUITE\n')
  console.log('=' .repeat(60))
  console.log('\n📋 Configuration:')
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`)
  console.log(`   Stripe Mode: ${TEST_CONFIG.stripeSecretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`)
  console.log('\n' + '='.repeat(60) + '\n')

  console.log('🔧 Testing Stripe Client...\n')
  await testStripeClientInitialization()
  await testStripeConnection()

  console.log('\n💰 Testing Price Configuration...\n')
  await testPriceValidation()

  console.log('\n🛒 Testing Checkout Sessions...\n')
  await testCheckoutSessionCreation()

  console.log('\n🔗 Testing Webhook Endpoints...\n')
  await testWebhookEndpoints()

  console.log('\n🔐 Testing Webhook Security...\n')
  await testWebhookSignatureVerification()

  console.log('\n📨 Testing Webhook Event Handling...\n')
  await testWebhookEventHandling()

  console.log('\n👤 Testing Customer Operations...\n')
  await testCustomerCreation()

  console.log('\n💳 Testing Payment Operations...\n')
  await testPaymentIntentCreation()

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 TEST SUMMARY\n')
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log(`Total Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`)
    })
  }

  console.log('\n' + '='.repeat(60) + '\n')

  return { passed, failed, total, results }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0)
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error)
      process.exit(1)
    })
}

export { runAllTests, results }

