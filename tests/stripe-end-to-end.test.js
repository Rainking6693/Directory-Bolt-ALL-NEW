/**
 * Stripe End-to-End Integration Tests
 * Tests complete payment flows from checkout to webhook processing
 */

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  priceIds: {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    growth: process.env.STRIPE_GROWTH_PRICE_ID,
    professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
  }
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

async function testCheckoutFlow() {
  console.log('\n🛒 Testing Complete Checkout Flow...\n')

  const plans = ['starter', 'growth', 'professional', 'enterprise']

  for (const plan of plans) {
    try {
      // Step 1: Create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: TEST_CONFIG.priceIds[plan],
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${TEST_CONFIG.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${TEST_CONFIG.baseUrl}/cancel`,
        customer_email: `test-${Date.now()}@example.com`,
        metadata: {
          plan: plan,
          test: 'true'
        }
      })

      const sessionValid = session && session.id && session.url
      logTest(`Checkout Flow - ${plan} - Session Created`, sessionValid, {
        sessionId: session.id,
        url: session.url.substring(0, 50) + '...',
        status: session.status,
        amount: `$${(session.amount_total / 100).toFixed(2)}`
      })

      // Step 2: Verify session can be retrieved
      const retrievedSession = await stripe.checkout.sessions.retrieve(session.id)
      const retrievalValid = retrievedSession.id === session.id
      logTest(`Checkout Flow - ${plan} - Session Retrieved`, retrievalValid, {
        sessionId: retrievedSession.id,
        status: retrievedSession.status
      })

      // Step 3: Verify session has correct metadata
      const metadataValid = retrievedSession.metadata.plan === plan
      logTest(`Checkout Flow - ${plan} - Metadata Correct`, metadataValid, {
        plan: retrievedSession.metadata.plan,
        expected: plan
      })

    } catch (error) {
      logTest(`Checkout Flow - ${plan}`, false, error.message)
    }
  }
}

async function testPaymentIntentFlow() {
  console.log('\n💳 Testing Payment Intent Flow...\n')

  try {
    // Step 1: Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 14900, // $149.00
      currency: 'usd',
      metadata: {
        plan: 'starter',
        test: 'true'
      }
    })

    const created = paymentIntent && paymentIntent.id
    logTest('Payment Intent - Created', created, {
      id: paymentIntent.id,
      amount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
      status: paymentIntent.status
    })

    // Step 2: Retrieve payment intent
    const retrieved = await stripe.paymentIntents.retrieve(paymentIntent.id)
    const retrievalValid = retrieved.id === paymentIntent.id
    logTest('Payment Intent - Retrieved', retrievalValid, {
      id: retrieved.id,
      status: retrieved.status
    })

    // Step 3: Update payment intent
    const updated = await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: { updated: 'true' }
    })
    const updateValid = updated.metadata.updated === 'true'
    logTest('Payment Intent - Updated', updateValid, {
      metadata: updated.metadata
    })

    // Step 4: Cancel payment intent
    const cancelled = await stripe.paymentIntents.cancel(paymentIntent.id)
    const cancelValid = cancelled.status === 'canceled'
    logTest('Payment Intent - Cancelled', cancelValid, {
      status: cancelled.status
    })

  } catch (error) {
    logTest('Payment Intent Flow', false, error.message)
  }
}

async function testCustomerManagement() {
  console.log('\n👤 Testing Customer Management...\n')

  try {
    // Step 1: Create customer
    const customer = await stripe.customers.create({
      email: `test-${Date.now()}@example.com`,
      name: 'Test Customer',
      metadata: {
        test: 'true',
        source: 'integration_test'
      }
    })

    const created = customer && customer.id
    logTest('Customer - Created', created, {
      id: customer.id,
      email: customer.email,
      name: customer.name
    })

    // Step 2: Retrieve customer
    const retrieved = await stripe.customers.retrieve(customer.id)
    const retrievalValid = retrieved.id === customer.id
    logTest('Customer - Retrieved', retrievalValid, {
      id: retrieved.id,
      email: retrieved.email
    })

    // Step 3: Update customer
    const updated = await stripe.customers.update(customer.id, {
      metadata: { updated: 'true' }
    })
    const updateValid = updated.metadata.updated === 'true'
    logTest('Customer - Updated', updateValid, {
      metadata: updated.metadata
    })

    // Step 4: List customers
    const customers = await stripe.customers.list({ limit: 5 })
    const listValid = customers.data.length > 0
    logTest('Customer - List', listValid, {
      count: customers.data.length
    })

    // Step 5: Delete customer
    const deleted = await stripe.customers.del(customer.id)
    const deleteValid = deleted.deleted === true
    logTest('Customer - Deleted', deleteValid, {
      deleted: deleted.deleted
    })

  } catch (error) {
    logTest('Customer Management', false, error.message)
  }
}

async function testPriceAndProductValidation() {
  console.log('\n💰 Testing Price & Product Validation...\n')

  const plans = {
    starter: { priceId: TEST_CONFIG.priceIds.starter, amount: 14900 },
    growth: { priceId: TEST_CONFIG.priceIds.growth, amount: 29900 },
    professional: { priceId: TEST_CONFIG.priceIds.professional, amount: 49900 },
    enterprise: { priceId: TEST_CONFIG.priceIds.enterprise, amount: 79900 }
  }

  for (const [planName, config] of Object.entries(plans)) {
    try {
      // Retrieve price
      const price = await stripe.prices.retrieve(config.priceId)
      
      const priceValid = price.unit_amount === config.amount
      logTest(`Price Validation - ${planName}`, priceValid, {
        priceId: price.id,
        amount: `$${(price.unit_amount / 100).toFixed(2)}`,
        expected: `$${(config.amount / 100).toFixed(2)}`,
        currency: price.currency,
        active: price.active
      })

      // Retrieve associated product
      const product = await stripe.products.retrieve(price.product)
      const productValid = product && product.id
      logTest(`Product Validation - ${planName}`, productValid, {
        productId: product.id,
        name: product.name,
        active: product.active
      })

    } catch (error) {
      logTest(`Price/Product Validation - ${planName}`, false, error.message)
    }
  }
}

async function testWebhookEventTypes() {
  console.log('\n📨 Testing Webhook Event Types...\n')

  const eventTypes = [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'customer.created',
    'customer.updated',
    'customer.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted'
  ]

  for (const eventType of eventTypes) {
    try {
      // List recent events of this type
      const events = await stripe.events.list({
        type: eventType,
        limit: 1
      })

      const canQuery = events !== null
      logTest(`Event Type - ${eventType}`, canQuery, {
        queryable: true,
        recentEvents: events.data.length
      })

    } catch (error) {
      logTest(`Event Type - ${eventType}`, false, error.message)
    }
  }
}

async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...\n')

  // Test 1: Invalid price ID
  try {
    await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: 'price_invalid', quantity: 1 }],
      mode: 'payment',
      success_url: `${TEST_CONFIG.baseUrl}/success`,
      cancel_url: `${TEST_CONFIG.baseUrl}/cancel`,
    })
    logTest('Error Handling - Invalid Price ID', false, 'Should have thrown error')
  } catch (error) {
    const correctError = error.type === 'StripeInvalidRequestError'
    logTest('Error Handling - Invalid Price ID', correctError, {
      errorType: error.type,
      message: error.message.substring(0, 50) + '...'
    })
  }

  // Test 2: Invalid customer ID
  try {
    await stripe.customers.retrieve('cus_invalid')
    logTest('Error Handling - Invalid Customer ID', false, 'Should have thrown error')
  } catch (error) {
    const correctError = error.type === 'StripeInvalidRequestError'
    logTest('Error Handling - Invalid Customer ID', correctError, {
      errorType: error.type,
      message: error.message.substring(0, 50) + '...'
    })
  }

  // Test 3: Invalid payment intent ID
  try {
    await stripe.paymentIntents.retrieve('pi_invalid')
    logTest('Error Handling - Invalid Payment Intent ID', false, 'Should have thrown error')
  } catch (error) {
    const correctError = error.type === 'StripeInvalidRequestError'
    logTest('Error Handling - Invalid Payment Intent ID', correctError, {
      errorType: error.type,
      message: error.message.substring(0, 50) + '...'
    })
  }
}

async function runAllTests() {
  console.log('🧪 STRIPE END-TO-END INTEGRATION TEST SUITE\n')
  console.log('============================================================\n')
  console.log('📋 Configuration:')
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`)
  console.log(`   Stripe Mode: ${TEST_CONFIG.stripeSecretKey.startsWith('sk_live') ? 'LIVE' : 'TEST'}`)
  console.log(`   Prices Configured: ${Object.keys(TEST_CONFIG.priceIds).length}`)
  console.log('\n============================================================\n')

  await testCheckoutFlow()
  await testPaymentIntentFlow()
  await testCustomerManagement()
  await testPriceAndProductValidation()
  await testWebhookEventTypes()
  await testErrorHandling()

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

