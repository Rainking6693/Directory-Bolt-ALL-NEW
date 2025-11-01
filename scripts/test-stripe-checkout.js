/**
 * TEST STRIPE CHECKOUT FLOW
 * Tests the checkout session creation with test mode keys
 */

const https = require('https')
const http = require('http')

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const TEST_PLANS = ['starter', 'growth', 'professional', 'enterprise']

// Test colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60) + '\n')
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    const req = client.request(reqOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve({ status: res.statusCode, data: parsed, headers: res.headers })
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers })
        }
      })
    })

    req.on('error', reject)
    
    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    
    req.end()
  })
}

async function testCheckoutSessionCreation(plan) {
  log(`\nTesting checkout session creation for: ${plan}`, 'blue')
  
  const endpoint = `${BASE_URL}/api/stripe/create-checkout-session`
  const payload = {
    plan: plan,
    customerEmail: `test+${plan}@example.com`,
    successUrl: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
    cancelUrl: `${BASE_URL}/pricing?cancelled=true&plan=${plan}`,
    metadata: {
      test: 'true',
      plan: plan
    }
  }

  try {
    log(`  POST ${endpoint}`, 'yellow')
    log(`  Payload: ${JSON.stringify(payload, null, 2)}`, 'yellow')
    
    const response = await makeRequest(endpoint, {
      method: 'POST',
      body: payload
    })

    if (response.status === 200 && response.data.success) {
      log(`  ✅ SUCCESS - Checkout session created`, 'green')
      log(`  Session ID: ${response.data.sessionId}`, 'green')
      log(`  Checkout URL: ${response.data.checkoutUrl}`, 'green')
      log(`  Plan: ${response.data.plan?.name || plan}`, 'green')
      return { success: true, data: response.data }
    } else {
      log(`  ❌ FAILED - Status: ${response.status}`, 'red')
      log(`  Error: ${JSON.stringify(response.data, null, 2)}`, 'red')
      return { success: false, error: response.data }
    }
  } catch (error) {
    log(`  ❌ ERROR - ${error.message}`, 'red')
    return { success: false, error: error.message }
  }
}

async function testWebhookEndpoint() {
  logSection('Testing Webhook Endpoint')
  
  const endpoint = `${BASE_URL}/api/webhooks/stripe-secure`
  
  log(`Testing webhook endpoint: ${endpoint}`, 'blue')
  
  try {
    // Test GET (should return 405 Method Not Allowed)
    const getResponse = await makeRequest(endpoint, { method: 'GET' })
    
    if (getResponse.status === 405) {
      log(`  ✅ GET request correctly rejected (405)`, 'green')
    } else {
      log(`  ⚠️  Unexpected GET response: ${getResponse.status}`, 'yellow')
    }
    
    // Test POST without signature (should fail)
    const postResponse = await makeRequest(endpoint, {
      method: 'POST',
      body: { test: 'data' }
    })
    
    if (postResponse.status === 400 || postResponse.status === 401) {
      log(`  ✅ POST without signature correctly rejected`, 'green')
    } else {
      log(`  ⚠️  Unexpected POST response: ${postResponse.status}`, 'yellow')
      log(`  Response: ${JSON.stringify(postResponse.data, null, 2)}`, 'yellow')
    }
    
    return { success: true }
  } catch (error) {
    log(`  ❌ ERROR - ${error.message}`, 'red')
    return { success: false, error: error.message }
  }
}

async function testEnvironmentVariables() {
  logSection('Checking Environment Variables')
  
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ]
  
  const priceVars = [
    'STRIPE_STARTER_PRICE_ID',
    'STRIPE_GROWTH_PRICE_ID',
    'STRIPE_PROFESSIONAL_PRICE_ID',
    'STRIPE_ENTERPRISE_PRICE_ID'
  ]
  
  log('Required Stripe Variables:', 'blue')
  let allPresent = true
  
  requiredVars.forEach(varName => {
    const value = process.env[varName]
    if (value) {
      const preview = varName.includes('SECRET') || varName.includes('KEY')
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : value
      log(`  ✅ ${varName}: ${preview}`, 'green')
    } else {
      log(`  ❌ ${varName}: NOT SET`, 'red')
      allPresent = false
    }
  })
  
  log('\nStripe Price IDs:', 'blue')
  priceVars.forEach(varName => {
    const value = process.env[varName]
    if (value && value.startsWith('price_')) {
      log(`  ✅ ${varName}: ${value}`, 'green')
    } else if (value) {
      log(`  ⚠️  ${varName}: ${value} (doesn't start with 'price_')`, 'yellow')
    } else {
      log(`  ⚠️  ${varName}: NOT SET (will use price_data fallback)`, 'yellow')
    }
  })
  
  return allPresent
}

async function main() {
  logSection('STRIPE CHECKOUT FLOW TEST')
  log(`Testing against: ${BASE_URL}`, 'cyan')
  log(`Timestamp: ${new Date().toISOString()}`, 'cyan')
  
  // Check environment variables
  const envOk = await testEnvironmentVariables()
  
  if (!envOk) {
    log('\n⚠️  Some required environment variables are missing!', 'yellow')
    log('Make sure to set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET', 'yellow')
  }
  
  // Test webhook endpoint
  await testWebhookEndpoint()
  
  // Test checkout session creation for each plan
  logSection('Testing Checkout Session Creation')
  
  const results = []
  for (const plan of TEST_PLANS) {
    const result = await testCheckoutSessionCreation(plan)
    results.push({ plan, ...result })
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // Summary
  logSection('Test Summary')
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  log(`Total Plans Tested: ${results.length}`, 'blue')
  log(`✅ Successful: ${successful}`, 'green')
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green')
  
  if (failed > 0) {
    log('\nFailed Tests:', 'red')
    results.filter(r => !r.success).forEach(r => {
      log(`  - ${r.plan}: ${r.error?.error || r.error}`, 'red')
    })
  }
  
  log('\n✅ Test completed!', 'green')
  log('\nNext Steps:', 'cyan')
  log('1. If tests passed, your checkout flow is working correctly', 'cyan')
  log('2. Visit the checkout URLs in a browser to test the full flow', 'cyan')
  log('3. Use Stripe test cards: 4242 4242 4242 4242 (Visa)', 'cyan')
  log('4. Set up webhook in Stripe Dashboard pointing to:', 'cyan')
  log(`   ${BASE_URL}/api/webhooks/stripe-secure`, 'cyan')
}

// Run tests
main().catch(error => {
  log(`\n❌ FATAL ERROR: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

