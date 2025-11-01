/**
 * Comprehensive Stripe Connection Audit
 * Tests all Stripe initialization points and validates environment variables
 */

const Stripe = require('stripe')
const fs = require('fs')
const path = require('path')

// Color output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function main() {
  log('\n🔍 STRIPE CONNECTION AUDIT\n', 'cyan')
  
  const issues = []
  const warnings = []
  
  // 1. Check environment variables
  log('\n📋 STEP 1: Environment Variable Validation', 'blue')
  log('─'.repeat(60), 'blue')
  
  const requiredVars = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
  }
  
  const optionalVars = {
    STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID,
    STRIPE_GROWTH_PRICE_ID: process.env.STRIPE_GROWTH_PRICE_ID,
    STRIPE_PROFESSIONAL_PRICE_ID: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    STRIPE_ENTERPRISE_PRICE_ID: process.env.STRIPE_ENTERPRISE_PRICE_ID
  }
  
  // Check required vars
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      issues.push(`❌ Missing required environment variable: ${key}`)
      log(`❌ Missing: ${key}`, 'red')
    } else {
      log(`✅ Found: ${key} (${value.substring(0, 10)}...)`, 'green')
    }
  })
  
  // Check optional vars
  Object.entries(optionalVars).forEach(([key, value]) => {
    if (!value) {
      warnings.push(`⚠️  Missing optional environment variable: ${key}`)
      log(`⚠️  Missing (optional): ${key}`, 'yellow')
    } else {
      log(`✅ Found: ${key}`, 'green')
    }
  })
  
  // 2. Validate key formats
  log('\n📋 STEP 2: Key Format Validation', 'blue')
  log('─'.repeat(60), 'blue')
  
  if (requiredVars.STRIPE_SECRET_KEY) {
    const secretKey = requiredVars.STRIPE_SECRET_KEY
    
    // Check format
    if (!secretKey.startsWith('sk_')) {
      issues.push(`❌ STRIPE_SECRET_KEY format invalid - must start with 'sk_'`)
      log(`❌ Invalid format: Should start with 'sk_'`, 'red')
    } else {
      log(`✅ Format valid: Starts with 'sk_'`, 'green')
    }
    
    // Check test vs live
    if (secretKey.startsWith('sk_test_')) {
      log(`✅ Using TEST mode key`, 'yellow')
    } else if (secretKey.startsWith('sk_live_')) {
      log(`✅ Using LIVE mode key`, 'green')
    } else {
      warnings.push(`⚠️  Secret key format unclear (neither test nor live detected)`)
    }
    
    // Check length (typical Stripe keys are 32+ characters)
    if (secretKey.length < 32) {
      issues.push(`❌ STRIPE_SECRET_KEY appears too short (${secretKey.length} chars)`)
      log(`❌ Key too short: ${secretKey.length} characters`, 'red')
    } else {
      log(`✅ Key length valid: ${secretKey.length} characters`, 'green')
    }
  }
  
  if (requiredVars.STRIPE_PUBLISHABLE_KEY) {
    const pubKey = requiredVars.STRIPE_PUBLISHABLE_KEY
    
    if (!pubKey.startsWith('pk_')) {
      issues.push(`❌ STRIPE_PUBLISHABLE_KEY format invalid - must start with 'pk_'`)
      log(`❌ Invalid format: Should start with 'pk_'`, 'red')
    } else {
      log(`✅ Format valid: Starts with 'pk_'`, 'green')
    }
    
    // Check test vs live match with secret key
    if (requiredVars.STRIPE_SECRET_KEY) {
      const secretIsTest = requiredVars.STRIPE_SECRET_KEY.startsWith('sk_test_')
      const pubIsTest = pubKey.startsWith('pk_test_')
      
      if (secretIsTest !== pubIsTest) {
        issues.push(`❌ Key mismatch: Secret key is ${secretIsTest ? 'test' : 'live'}, but publishable is ${pubIsTest ? 'test' : 'live'}`)
        log(`❌ Key mismatch: Secret and publishable must be same mode`, 'red')
      } else {
        log(`✅ Key modes match`, 'green')
      }
    }
  }
  
  if (requiredVars.STRIPE_WEBHOOK_SECRET) {
    const webhookSecret = requiredVars.STRIPE_WEBHOOK_SECRET
    
    if (!webhookSecret.startsWith('whsec_')) {
      issues.push(`❌ STRIPE_WEBHOOK_SECRET format invalid - must start with 'whsec_'`)
      log(`❌ Invalid format: Should start with 'whsec_'`, 'red')
    } else {
      log(`✅ Format valid: Starts with 'whsec_'`, 'green')
    }
  }
  
  // 3. Test API Connection
  log('\n📋 STEP 3: API Connection Test', 'blue')
  log('─'.repeat(60), 'blue')
  
  if (requiredVars.STRIPE_SECRET_KEY && requiredVars.STRIPE_SECRET_KEY.startsWith('sk_')) {
    try {
      const stripe = new Stripe(requiredVars.STRIPE_SECRET_KEY, {
        apiVersion: '2023-08-16',
        timeout: 10000
      })
      
      log('🔄 Testing connection...', 'cyan')
      
      // Test 1: Retrieve account
      try {
        const account = await stripe.accounts.retrieve()
        log(`✅ Account retrieved: ${account.id}`, 'green')
        log(`   Business: ${account.business_profile?.name || 'N/A'}`, 'green')
        log(`   Country: ${account.country || 'N/A'}`, 'green')
        log(`   Mode: ${account.livemode ? 'LIVE' : 'TEST'}`, account.livemode ? 'yellow' : 'cyan')
      } catch (error) {
        if (error.type === 'StripeAuthenticationError' || error.statusCode === 401) {
          issues.push(`❌ 401 Authentication Error: ${error.message}`)
          log(`❌ 401 ERROR: ${error.message}`, 'red')
          log(`   This usually means:`, 'red')
          log(`   - Invalid API key`, 'red')
          log(`   - Key has been revoked`, 'red')
          log(`   - Key format is incorrect`, 'red')
        } else {
          issues.push(`❌ Account retrieval failed: ${error.message}`)
          log(`❌ Failed: ${error.message}`, 'red')
        }
      }
      
      // Test 2: List customers (lightweight test)
      try {
        const customers = await stripe.customers.list({ limit: 1 })
        log(`✅ Customer list works: ${customers.data.length} customer(s) found`, 'green')
      } catch (error) {
        if (error.type === 'StripeAuthenticationError' || error.statusCode === 401) {
          issues.push(`❌ 401 Authentication Error on customer list: ${error.message}`)
          log(`❌ 401 ERROR on customer list: ${error.message}`, 'red')
        } else {
          warnings.push(`⚠️  Customer list failed: ${error.message}`)
          log(`⚠️  Warning: ${error.message}`, 'yellow')
        }
      }
      
      // Test 3: Check prices (if configured)
      if (optionalVars.STRIPE_STARTER_PRICE_ID) {
        try {
          const price = await stripe.prices.retrieve(optionalVars.STRIPE_STARTER_PRICE_ID)
          log(`✅ Starter price valid: ${price.id} - $${(price.unit_amount || 0) / 100}`, 'green')
        } catch (error) {
          if (error.type === 'StripeAuthenticationError' || error.statusCode === 401) {
            issues.push(`❌ 401 Authentication Error on price check: ${error.message}`)
            log(`❌ 401 ERROR on price check: ${error.message}`, 'red')
          } else {
            warnings.push(`⚠️  Starter price check failed: ${error.message}`)
            log(`⚠️  Price invalid or missing: ${error.message}`, 'yellow')
          }
        }
      }
      
    } catch (error) {
      issues.push(`❌ Stripe initialization failed: ${error.message}`)
      log(`❌ Initialization failed: ${error.message}`, 'red')
    }
  } else {
    log(`⚠️  Skipping API test - secret key not configured or invalid`, 'yellow')
  }
  
  // 4. Check code initialization points
  log('\n📋 STEP 4: Code Initialization Audit', 'blue')
  log('─'.repeat(60), 'blue')
  
  const filesToCheck = [
    'pages/api/stripe/create-checkout-session.ts',
    'pages/api/webhooks/stripe-secure.ts',
    'pages/api/webhooks/stripe.js',
    'lib/utils/stripe-client.ts'
  ]
  
  filesToCheck.forEach(file => {
    const filePath = path.join(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      
      // Check for direct Stripe initialization
      if (content.includes('new Stripe(')) {
        const usesEnvVar = content.includes('process.env.STRIPE_SECRET_KEY')
        const usesGetClient = content.includes('getStripeClient')
        const usesNonNullAssertion = content.includes('process.env.STRIPE_SECRET_KEY!')
        
        if (!usesGetClient) {
          warnings.push(`⚠️  ${file}: Uses direct Stripe initialization instead of getStripeClient()`)
          log(`⚠️  ${file}: Direct initialization detected`, 'yellow')
          
          if (usesNonNullAssertion) {
            warnings.push(`⚠️  ${file}: Uses non-null assertion (!) which can hide missing env var`)
            log(`   Uses non-null assertion (!)`, 'yellow')
          }
        } else {
          log(`✅ ${file}: Uses getStripeClient()`, 'green')
        }
      } else {
        log(`✅ ${file}: No direct initialization`, 'green')
      }
    } else {
      warnings.push(`⚠️  ${file}: File not found`)
      log(`⚠️  ${file}: Not found`, 'yellow')
    }
  })
  
  // Summary
  log('\n📊 AUDIT SUMMARY', 'cyan')
  log('═'.repeat(60), 'cyan')
  
  if (issues.length === 0 && warnings.length === 0) {
    log('\n✅ ALL CHECKS PASSED!', 'green')
    log('Your Stripe configuration looks good.', 'green')
  } else {
    if (issues.length > 0) {
      log(`\n❌ CRITICAL ISSUES (${issues.length}):`, 'red')
      issues.forEach(issue => log(`   ${issue}`, 'red'))
    }
    
    if (warnings.length > 0) {
      log(`\n⚠️  WARNINGS (${warnings.length}):`, 'yellow')
      warnings.forEach(warning => log(`   ${warning}`, 'yellow'))
    }
  }
  
  // Recommendations
  log('\n💡 RECOMMENDATIONS:', 'cyan')
  log('─'.repeat(60), 'cyan')
  
  if (issues.some(i => i.includes('401'))) {
    log('\n🔧 Fix 401 Errors:', 'yellow')
    log('1. Verify STRIPE_SECRET_KEY in Netlify environment variables', 'yellow')
    log('2. Check for extra spaces or newlines in the key', 'yellow')
    log('3. Ensure you\'re using the correct key (test vs live)', 'yellow')
    log('4. Regenerate the key in Stripe Dashboard if needed', 'yellow')
    log('5. Check that the key hasn\'t been revoked', 'yellow')
  }
  
  if (warnings.some(w => w.includes('Direct initialization'))) {
    log('\n🔧 Improve Code:', 'yellow')
    log('1. Replace direct Stripe() calls with getStripeClient()', 'yellow')
    log('2. Remove non-null assertions (!) for better error handling', 'yellow')
    log('3. Add proper error handling for missing env vars', 'yellow')
  }
  
  log('\n')
  
  process.exit(issues.length > 0 ? 1 : 0)
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

