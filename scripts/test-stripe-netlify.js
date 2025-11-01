/**
 * TEST STRIPE CHECKOUT ON NETLIFY DEPLOYMENT
 * Tests checkout flow against your deployed Netlify app
 * 
 * Usage:
 *   node scripts/test-stripe-netlify.js [your-netlify-url]
 * 
 * Example:
 *   node scripts/test-stripe-netlify.js https://your-app.netlify.app
 */

const https = require('https')

// Get Netlify URL from command line or use default
const NETLIFY_URL = process.argv[2] || process.env.NETLIFY_URL || 'https://your-app.netlify.app'

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

async function testCheckout(url, plan) {
  const endpoint = `${url}/api/stripe/create-checkout-session`
  const payload = {
    plan: plan,
    customerEmail: `test+${plan}@example.com`,
    successUrl: `${url}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
    cancelUrl: `${url}/pricing?cancelled=true&plan=${plan}`,
    metadata: { test: 'true', plan: plan }
  }

  return new Promise((resolve, reject) => {
    const urlObj = new URL(endpoint)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve({ status: res.statusCode, data: parsed })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', reject)
    req.write(JSON.stringify(payload))
    req.end()
  })
}

async function main() {
  log('\n' + '='.repeat(60), 'cyan')
  log('STRIPE CHECKOUT TEST - NETLIFY DEPLOYMENT', 'cyan')
  log('='.repeat(60) + '\n', 'cyan')
  
  log(`Testing: ${NETLIFY_URL}`, 'blue')
  log(`Timestamp: ${new Date().toISOString()}\n`, 'blue')

  const plans = ['starter', 'growth', 'professional', 'enterprise']
  const results = []

  for (const plan of plans) {
    log(`Testing ${plan} plan...`, 'yellow')
    try {
      const result = await testCheckout(NETLIFY_URL, plan)
      if (result.status === 200 && result.data.success) {
        log(`  ✅ ${plan}: SUCCESS`, 'green')
        log(`     Session ID: ${result.data.sessionId}`, 'green')
        log(`     Checkout URL: ${result.data.checkoutUrl}`, 'green')
        results.push({ plan, success: true })
      } else {
        log(`  ❌ ${plan}: FAILED (${result.status})`, 'red')
        log(`     Error: ${JSON.stringify(result.data)}`, 'red')
        results.push({ plan, success: false, error: result.data })
      }
    } catch (error) {
      log(`  ❌ ${plan}: ERROR - ${error.message}`, 'red')
      results.push({ plan, success: false, error: error.message })
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  log('\n' + '='.repeat(60), 'cyan')
  log('RESULTS', 'cyan')
  log('='.repeat(60) + '\n', 'cyan')

  const successful = results.filter(r => r.success).length
  log(`Successful: ${successful}/${results.length}`, successful === results.length ? 'green' : 'yellow')

  if (successful === results.length) {
    log('\n✅ All checkout tests passed!', 'green')
    log('\nNext steps:', 'cyan')
    log('1. Visit checkout URLs above to test full flow', 'cyan')
    log('2. Use test card: 4242 4242 4242 4242', 'cyan')
    log('3. Set up webhook in Stripe Dashboard:', 'cyan')
    log(`   ${NETLIFY_URL}/api/webhooks/stripe-secure`, 'cyan')
  } else {
    log('\n⚠️  Some tests failed. Check errors above.', 'yellow')
  }
}

main().catch(error => {
  log(`\n❌ FATAL ERROR: ${error.message}`, 'red')
  process.exit(1)
})

