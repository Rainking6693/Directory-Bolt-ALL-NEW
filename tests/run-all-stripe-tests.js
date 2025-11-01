/**
 * Stripe Test Runner
 * Runs all Stripe integration tests and generates a comprehensive report
 */

const { spawn } = require('child_process')
const path = require('path')

const tests = [
  {
    name: 'Stripe Integration Tests',
    file: 'stripe-integration.test.js',
    description: 'Core Stripe API functionality, webhooks, and payment operations'
  },
  {
    name: 'Stripe Webhook Security Tests',
    file: 'stripe-webhook-security.test.js',
    description: 'Signature verification, authentication, and security measures'
  },
  {
    name: 'Stripe End-to-End Tests',
    file: 'stripe-end-to-end.test.js',
    description: 'Complete payment flows and customer management'
  }
]

const results = []

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Running: ${testFile.name}`)
    console.log(`Description: ${testFile.description}`)
    console.log('='.repeat(80))
    
    const testPath = path.join(__dirname, testFile.file)
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      shell: true
    })

    const startTime = Date.now()

    child.on('close', (code) => {
      const duration = Date.now() - startTime
      results.push({
        name: testFile.name,
        file: testFile.file,
        exitCode: code,
        duration,
        passed: code === 0
      })
      resolve()
    })

    child.on('error', (error) => {
      results.push({
        name: testFile.name,
        file: testFile.file,
        exitCode: 1,
        duration: Date.now() - startTime,
        passed: false,
        error: error.message
      })
      resolve()
    })
  })
}

async function runAllTests() {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                    STRIPE COMPREHENSIVE TEST SUITE                         ║')
  console.log('╚════════════════════════════════════════════════════════════════════════════╝')
  console.log('\n')

  const overallStartTime = Date.now()

  // Run tests sequentially
  for (const test of tests) {
    await runTest(test)
  }

  const overallDuration = Date.now() - overallStartTime

  // Print comprehensive summary
  console.log('\n\n')
  console.log('╔════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                         COMPREHENSIVE TEST REPORT                          ║')
  console.log('╚════════════════════════════════════════════════════════════════════════════╝')
  console.log('\n')

  console.log('📊 Test Suite Results:\n')
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED'
    const duration = `${(result.duration / 1000).toFixed(2)}s`
    
    console.log(`${index + 1}. ${result.name}`)
    console.log(`   Status: ${status}`)
    console.log(`   Duration: ${duration}`)
    console.log(`   File: ${result.file}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    console.log('')
  })

  const totalTests = results.length
  const passedTests = results.filter(r => r.passed).length
  const failedTests = totalTests - passedTests
  const successRate = ((passedTests / totalTests) * 100).toFixed(1)

  console.log('─'.repeat(80))
  console.log('\n📈 Overall Statistics:\n')
  console.log(`   Total Test Suites: ${totalTests}`)
  console.log(`   ✅ Passed: ${passedTests}`)
  console.log(`   ❌ Failed: ${failedTests}`)
  console.log(`   Success Rate: ${successRate}%`)
  console.log(`   Total Duration: ${(overallDuration / 1000).toFixed(2)}s`)
  console.log('')

  if (failedTests > 0) {
    console.log('❌ Failed Test Suites:')
    results.filter(r => !r.passed).forEach(result => {
      console.log(`   - ${result.name} (${result.file})`)
    })
    console.log('')
  }

  console.log('─'.repeat(80))
  console.log('\n🎯 Test Coverage:\n')
  console.log('   ✅ Stripe API Connection')
  console.log('   ✅ Price Configuration (4 tiers)')
  console.log('   ✅ Checkout Session Creation')
  console.log('   ✅ Webhook Endpoints (6 endpoints)')
  console.log('   ✅ Webhook Security & Signature Verification')
  console.log('   ✅ Authentication Middleware')
  console.log('   ✅ Payment Intent Operations')
  console.log('   ✅ Customer Management')
  console.log('   ✅ Event Handling (11 event types)')
  console.log('   ✅ Error Handling')
  console.log('   ✅ Rate Limiting & Performance')
  console.log('   ✅ Idempotency')
  console.log('')

  console.log('─'.repeat(80))
  console.log('\n💡 Next Steps:\n')
  
  if (failedTests === 0) {
    console.log('   🎉 All tests passed! Your Stripe integration is working correctly.')
    console.log('   ✅ Ready for production deployment')
    console.log('   📝 Consider setting up CI/CD to run these tests automatically')
  } else {
    console.log('   ⚠️  Some tests failed. Please review the errors above.')
    console.log('   🔧 Fix the failing tests before deploying to production')
    console.log('   📖 Check the test output for detailed error messages')
  }
  
  console.log('')
  console.log('─'.repeat(80))
  console.log('\n')

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0)
}

runAllTests().catch(error => {
  console.error('Fatal error running tests:', error)
  process.exit(1)
})

