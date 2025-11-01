/**
 * Stripe Connection Test
 * Tests Stripe API connection and validates 401 error fixes
 */

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

async function testStripeConnection() {
  console.log('\n🧪 STRIPE CONNECTION TEST\n')
  
  // Check environment variables
  const secretKey = process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY
  
  if (!secretKey) {
    console.error('❌ STRIPE_SECRET_KEY not found in environment variables')
    console.error('   Make sure to set it in Netlify or load .env file')
    process.exit(1)
  }
  
  console.log(`✅ Found STRIPE_SECRET_KEY: ${secretKey.substring(0, 10)}...`)
  
  // Validate format
  if (!secretKey.startsWith('sk_')) {
    console.error('❌ Invalid key format - must start with "sk_"')
    console.error(`   Current: ${secretKey.substring(0, 5)}...`)
    process.exit(1)
  }
  
  console.log(`✅ Key format valid`)
  console.log(`   Mode: ${secretKey.startsWith('sk_test_') ? 'TEST' : secretKey.startsWith('sk_live_') ? 'LIVE' : 'UNKNOWN'}`)
  
  // Test connection
  try {
    console.log('\n🔄 Testing API connection...')
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-08-16',
      timeout: 10000
    })
    
    // Test 1: Retrieve account
    console.log('   Testing: accounts.retrieve()')
    const account = await stripe.accounts.retrieve()
    console.log(`   ✅ SUCCESS - Account ID: ${account.id}`)
    console.log(`      Business: ${account.business_profile?.name || 'N/A'}`)
    console.log(`      Country: ${account.country || 'N/A'}`)
    
    // Test 2: List customers
    console.log('   Testing: customers.list()')
    const customers = await stripe.customers.list({ limit: 1 })
    console.log(`   ✅ SUCCESS - Can list customers`)
    
    // Test 3: Create a test checkout session
    console.log('   Testing: checkout.sessions.create()')
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Product'
            },
            unit_amount: 1000 // $10.00
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel'
      })
      console.log(`   ✅ SUCCESS - Checkout session created: ${session.id}`)
      
      // Clean up - expire the session
      await stripe.checkout.sessions.expire(session.id)
      console.log(`   ✅ Cleaned up test session`)
    } catch (error) {
      if (error.type === 'StripeAuthenticationError' || error.statusCode === 401) {
        console.error(`   ❌ 401 ERROR: ${error.message}`)
        console.error('   This indicates an authentication problem')
        throw error
      } else {
        console.log(`   ⚠️  Checkout test failed (non-auth): ${error.message}`)
      }
    }
    
    console.log('\n✅ ALL TESTS PASSED!')
    console.log('   Stripe connection is working correctly')
    console.log('   No 401 errors detected')
    
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ CONNECTION TEST FAILED\n')
    
    if (error.type === 'StripeAuthenticationError' || error.statusCode === 401) {
      console.error('401 AUTHENTICATION ERROR DETECTED')
      console.error('\n🔧 TROUBLESHOOTING:\n')
      console.error('1. Verify STRIPE_SECRET_KEY in Netlify environment variables')
      console.error('2. Check for extra spaces or newlines in the key')
      console.error('3. Ensure you\'re using the correct key (test vs live)')
      console.error('4. Regenerate the key in Stripe Dashboard if needed')
      console.error('5. Check that the key hasn\'t been revoked')
      console.error(`\n   Error details: ${error.message}`)
      console.error(`   Error code: ${error.code || 'N/A'}`)
    } else {
      console.error(`Error: ${error.message}`)
      console.error(`Type: ${error.type || 'Unknown'}`)
    }
    
    process.exit(1)
  }
}

testStripeConnection().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

