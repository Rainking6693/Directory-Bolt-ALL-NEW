/**
 * IMMEDIATE STRIPE CONNECTION TEST
 * Run this directly: node test-stripe-now.js
 */

require('dotenv').config({ path: '.env.example.stripe' })

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
}

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

async function testStripe() {
  console.log('🚀 Testing Stripe Configuration...\n')
  
  // Check if .env.example.stripe exists
  const fs = require('fs')
  if (!fs.existsSync('.env.example.stripe')) {
    log('❌ .env.example.stripe file not found!', 'red')
    log('💡 Create this file with your Stripe keys first', 'yellow')
    process.exit(1)
  }
  
  // Check environment variables
  log('📋 Environment Variables:', 'cyan')
  const vars = [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_STARTER_PRICE_ID',
    'STRIPE_GROWTH_PRICE_ID',
    'STRIPE_PROFESSIONAL_PRICE_ID',
    'STRIPE_ENTERPRISE_PRICE_ID'
  ]
  
  let hasRequired = true
  vars.forEach(varName => {
    const value = process.env[varName]
    if (value) {
      const preview = value.length > 20 
        ? `${value.substring(0, 10)}...${value.slice(-4)}`
        : value
      log(`  ✅ ${varName}: ${preview}`, 'green')
    } else {
      log(`  ❌ ${varName}: NOT SET`, 'red')
      if (varName.includes('SECRET_KEY') || varName.includes('PUBLISHABLE_KEY')) {
        hasRequired = false
      }
    }
  })
  
  if (!hasRequired) {
    log('\n❌ Missing required Stripe keys. Cannot test connection.', 'red')
    log('💡 Make sure .env.example.stripe exists and has valid keys', 'yellow')
    return
  }
  
  // Test Stripe connection
  try {
    log('\n🔌 Testing Stripe API Connection...', 'cyan')
    
    // Dynamic import for Stripe (in case it's not installed)
    let Stripe
    try {
      Stripe = require('stripe')
    } catch (e) {
      log('❌ Stripe package not found. Installing...', 'yellow')
      log('Run: npm install stripe', 'yellow')
      return
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-08-16'
    })
    
    // Test account access
    const account = await stripe.accounts.retrieve()
    log(`  ✅ Connected to account: ${account.id}`, 'green')
    log(`  🏢 Business name: ${account.business_profile?.name || 'Not set'}`, 'blue')
    log(`  🌍 Country: ${account.country}`, 'blue')
    log(`  💰 Currency: ${account.default_currency?.toUpperCase()}`, 'blue')
    log(`  🔧 Mode: ${account.livemode ? 'LIVE' : 'TEST'}`, account.livemode ? 'red' : 'green')
    
    // Test price retrieval
    log('\n💰 Testing Price IDs...', 'cyan')
    const priceTests = [
      { name: 'Starter', id: process.env.STRIPE_STARTER_PRICE_ID },
      { name: 'Growth', id: process.env.STRIPE_GROWTH_PRICE_ID },
      { name: 'Professional', id: process.env.STRIPE_PROFESSIONAL_PRICE_ID },
      { name: 'Enterprise', id: process.env.STRIPE_ENTERPRISE_PRICE_ID }
    ]
    
    for (const { name, id } of priceTests) {
      if (id) {
        try {
          const price = await stripe.prices.retrieve(id)
          const amount = price.unit_amount ? `$${price.unit_amount / 100}` : 'Free'
          const interval = price.recurring?.interval || 'one-time'
          log(`  ✅ ${name}: ${amount}/${interval}`, 'green')
        } catch (e) {
          log(`  ❌ ${name}: Invalid price ID (${id})`, 'red')
        }
      } else {
        log(`  ⚠️  ${name}: Not configured`, 'yellow')
      }
    }
    
    // Test checkout session creation
    log('\n🛒 Testing Checkout Session Creation...', 'cyan')
    if (process.env.STRIPE_STARTER_PRICE_ID) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price: process.env.STRIPE_STARTER_PRICE_ID,
            quantity: 1,
          }],
          mode: 'payment', // Changed from 'subscription' to 'payment'
          success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://example.com/cancel',
          customer_email: 'test@example.com'
        })
        
        log(`  ✅ Checkout session created: ${session.id}`, 'green')
        log(`  🔗 URL: ${session.url?.substring(0, 50)}...`, 'blue')
      } catch (e) {
        log(`  ❌ Checkout creation failed: ${e.message}`, 'red')
      }
    }
    
    log('\n🎉 Stripe connection test completed!', 'green')
    log('\nNext steps:', 'cyan')
    log('1. Copy .env.example.stripe to .env.local', 'blue')
    log('2. Set up webhook in Stripe Dashboard', 'blue')
    log('3. Test with: stripe trigger payment_intent.succeeded', 'blue') // Changed webhook test
    
  } catch (error) {
    log(`\n❌ Stripe connection failed: ${error.message}`, 'red')
    
    if (error.message.includes('Invalid API Key')) {
      log('💡 Check your STRIPE_SECRET_KEY format', 'yellow')
    }
    if (error.message.includes('No such')) {
      log('💡 Check your price IDs in Stripe Dashboard', 'yellow')
    }
  }
}

testStripe().catch(console.error)
