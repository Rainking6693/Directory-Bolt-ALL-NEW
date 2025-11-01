/**
 * VERIFY WEBHOOK SECRET CONFIGURATION
 * Checks if STRIPE_WEBHOOK_SECRET is properly configured
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

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

function main() {
  log('\n' + '='.repeat(60), 'cyan')
  log('WEBHOOK SECRET VERIFICATION', 'cyan')
  log('='.repeat(60) + '\n', 'cyan')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  // Check if set
  if (!webhookSecret) {
    log('❌ STRIPE_WEBHOOK_SECRET is NOT SET', 'red')
    log('\nTo fix:', 'yellow')
    log('1. Local development: Add to .env file:', 'yellow')
    log('   STRIPE_WEBHOOK_SECRET=whsec_your_secret_here', 'yellow')
    log('\n2. Netlify: Add in Netlify Dashboard:', 'yellow')
    log('   Site settings > Environment variables', 'yellow')
    log('   Add: STRIPE_WEBHOOK_SECRET = whsec_your_secret_here', 'yellow')
    log('\n3. Get webhook secret from Stripe Dashboard:', 'yellow')
    log('   https://dashboard.stripe.com/test/webhooks', 'yellow')
    log('   Click your webhook endpoint > Reveal signing secret', 'yellow')
    process.exit(1)
  }

  log('✅ STRIPE_WEBHOOK_SECRET is SET', 'green')
  log(`   Value: ${webhookSecret.substring(0, 15)}...${webhookSecret.substring(webhookSecret.length - 4)}`, 'green')

  // Check format
  if (!webhookSecret.startsWith('whsec_')) {
    log('\n❌ INVALID FORMAT', 'red')
    log('   Webhook secret should start with "whsec_"', 'red')
    log(`   Current: ${webhookSecret.substring(0, 10)}...`, 'red')
    log('\nTo fix:', 'yellow')
    log('1. Go to Stripe Dashboard > Webhooks', 'yellow')
    log('2. Click on your webhook endpoint', 'yellow')
    log('3. Click "Reveal" on "Signing secret"', 'yellow')
    log('4. Copy the full secret (starts with whsec_)', 'yellow')
    process.exit(1)
  }

  log('✅ Format is VALID (starts with whsec_)', 'green')

  // Check length (webhook secrets are typically 64+ characters)
  if (webhookSecret.length < 20) {
    log('\n⚠️  WARNING: Secret seems too short', 'yellow')
    log(`   Length: ${webhookSecret.length} characters`, 'yellow')
    log('   Typical webhook secrets are 64+ characters', 'yellow')
  } else {
    log(`✅ Length is VALID (${webhookSecret.length} characters)`, 'green')
  }

  // Check if test or live mode
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey) {
    if (stripeKey.startsWith('sk_test_')) {
      log('\n📋 Mode: TEST MODE', 'blue')
      log('   Using test Stripe keys', 'blue')
      log('   Webhook URL: https://dashboard.stripe.com/test/webhooks', 'blue')
    } else if (stripeKey.startsWith('sk_live_')) {
      log('\n📋 Mode: LIVE MODE', 'blue')
      log('   Using live Stripe keys', 'blue')
      log('   Webhook URL: https://dashboard.stripe.com/webhooks', 'blue')
      log('   ⚠️  Make sure webhook secret matches LIVE mode webhook!', 'yellow')
    }
  }

  log('\n' + '='.repeat(60), 'cyan')
  log('✅ WEBHOOK SECRET CONFIGURATION VERIFIED', 'green')
  log('='.repeat(60) + '\n', 'cyan')

  log('Next steps:', 'cyan')
  log('1. Verify webhook endpoint in Stripe Dashboard matches:', 'cyan')
  log('   https://your-app.netlify.app/api/webhooks/stripe-secure', 'cyan')
  log('2. Test webhook by sending test event from Stripe Dashboard', 'cyan')
  log('3. Check webhook logs in Stripe Dashboard for any errors', 'cyan')
}

main()

