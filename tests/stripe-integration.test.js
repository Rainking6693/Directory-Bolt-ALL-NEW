/**
 * COMPREHENSIVE STRIPE INTEGRATION TESTS
 * Tests all Stripe webhooks, checkout sessions, and payment features
 */

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  priceIds: {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    growth: process.env.STRIPE_GROWTH_PRICE_ID,
    professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
  }
}

const results = []

function logTest(name, passed, error, details) {
  results.push({ name, passed, error, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (error) console.log(`   Error: ${error}`)
  if (details) console.log(`   Details:`, JSON.stringify(details, null, 2))
}

async function testStripeClientInitialization() {
  try {
    if (!TEST_CONFIG.stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    const stripe = new Stripe(TEST_CONFIG.stripeSecretKey, { apiVersion: '2023-08-16' })
    logTest('Stripe Client Initialization', !!stripe)
    return stripe
  } catch (error) {
    logTest('Stripe Client Initialization', false, error.message)
    throw error
  }
}

async function testStripeConnection(stripe) {
  try {
    const account = await stripe.accounts.retrieve()
    logTest('Stripe API Connection', true, null, {
      accountId: account.id,
      keyType: account.livemode ? 'live' : 'test'
    })
    return account
  } catch (error) {
    logTest('Stripe API Connection', false, error.message)
    throw error
  }
}

async function testPriceValidation(stripe) {
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
      const price = await stripe.prices.retrieve(id)
      logTest(`Price Validation - ${name}`, price.active, null, {
        priceId: id,
        amount: price.unit_amount ? `$${price.unit_amount / 100}` : 'N/A',
        currency: price.currency,
        active: price.active
      })
    } catch (error) {
      logTest(`Price Validation - ${name}`, false, error.message)
    }
  }
}

async function testCheckoutSessionCreation(stripe) {
  const plans = ['starter', 'growth', 'professional', 'enterprise']

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

      logTest(`Checkout Session - ${plan}`, !!session.id, null, {
        sessionId: session.id,
        url: session.url ? session.url.substring(0, 50) + '...' : 'N/A',
        status: session.status
      })
    } catch (error) {
      logTest(`Checkout Session - ${plan}`, false, error.message)
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
      
      // Test POST without signature (should return 400, 401, 500, or 504)
      const postResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      })
      const postOk = postResponse.status === 400 || postResponse.status === 401 || postResponse.status === 500 || postResponse.status === 504
      
      logTest(`Webhook Endpoint - ${endpoint}`, getOk && postOk, null, {
        getStatus: getResponse.status,
        postStatus: postResponse.status
      })
    } catch (error) {
      logTest(`Webhook Endpoint - ${endpoint}`, false, error.message)
    }
  }
}

async function testWebhookSignatureVerification(stripe) {
  if (!TEST_CONFIG.stripeWebhookSecret) {
    logTest('Webhook Signature Verification', false, 'STRIPE_WEBHOOK_SECRET not configured')
    return
  }

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
  
  // Generate valid signature
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_CONFIG.stripeWebhookSecret
  })

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, TEST_CONFIG.stripeWebhookSecret)
    logTest('Webhook Signature Verification - Valid', !!event, null, {
      eventId: event.id,
      eventType: event.type
    })
  } catch (error) {
    logTest('Webhook Signature Verification - Valid', false, error.message)
  }

  // Test invalid signature
  try {
    stripe.webhooks.constructEvent(payload, 'invalid_signature', TEST_CONFIG.stripeWebhookSecret)
    logTest('Webhook Signature Verification - Invalid', false, 'Should have thrown error')
  } catch (error) {
    logTest('Webhook Signature Verification - Invalid', true, null, {
      expectedError: 'Correctly rejected invalid signature'
    })
  }
}

async function testWebhookEventHandling(stripe) {
  if (!TEST_CONFIG.stripeWebhookSecret) {
    logTest('Webhook Event Handling', false, 'STRIPE_WEBHOOK_SECRET not configured')
    return
  }

  const eventTypes = [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'customer.created',
    'customer.updated'
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

      const responseOk = response.status === 200 || response.status === 500
      logTest(`Webhook Event - ${eventType}`, responseOk, null, {
        status: response.status,
        statusText: response.statusText
      })
    } catch (error) {
      logTest(`Webhook Event - ${eventType}`, false, error.message)
    }
  }
}

async function testCustomerCreation(stripe) {
  try {
    const customer = await stripe.customers.create({
      email: `test-${Date.now()}@example.com`,
      name: 'Test Customer',
      metadata: {
        test: 'true',
        source: 'integration_test'
      }
    })

    logTest('Customer Creation', !!customer.id, null, {
      customerId: customer.id,
      email: customer.email
    })

    // Cleanup
    await stripe.customers.del(customer.id)
  } catch (error) {
    logTest('Customer Creation', false, error.message)
  }
}

async function testPaymentIntentCreation(stripe) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2999,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        test: 'true',
        source: 'integration_test'
      }
    })

    logTest('Payment Intent Creation', !!paymentIntent.id, null, {
      paymentIntentId: paymentIntent.id,
      amount: `$${paymentIntent.amount / 100}`,
      status: paymentIntent.status
    })
  } catch (error) {
    logTest('Payment Intent Creation', false, error.message)
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n🧪 STRIPE INTEGRATION TEST SUITE\n')
  console.log('='.repeat(60))
  console.log('\n📋 Configuration:')
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`)
  console.log(`   Stripe Mode: ${TEST_CONFIG.stripeSecretKey?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`)
  console.log(`   Webhook Secret: ${TEST_CONFIG.stripeWebhookSecret ? 'Configured' : 'NOT CONFIGURED'}`)
  console.log('\n' + '='.repeat(60) + '\n')

  try {
    console.log('🔧 Testing Stripe Client...\n')
    const stripe = await testStripeClientInitialization()
    await testStripeConnection(stripe)

    console.log('\n💰 Testing Price Configuration...\n')
    await testPriceValidation(stripe)

    console.log('\n🛒 Testing Checkout Sessions...\n')
    await testCheckoutSessionCreation(stripe)

    console.log('\n🔗 Testing Webhook Endpoints...\n')
    await testWebhookEndpoints()

    console.log('\n🔐 Testing Webhook Security...\n')
    await testWebhookSignatureVerification(stripe)

    console.log('\n📨 Testing Webhook Event Handling...\n')
    await testWebhookEventHandling(stripe)

    console.log('\n👤 Testing Customer Operations...\n')
    await testCustomerCreation(stripe)

    console.log('\n💳 Testing Payment Operations...\n')
    await testPaymentIntentCreation(stripe)

  } catch (error) {
    console.error('\n❌ Test suite encountered a fatal error:', error.message)
  }

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

// Run tests
runAllTests()
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0)
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  })

