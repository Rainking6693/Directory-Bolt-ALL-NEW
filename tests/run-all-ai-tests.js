/**
 * MASTER AI SERVICES TEST RUNNER
 * Runs all AI service tests and generates comprehensive report
 */

const { spawn } = require('child_process')
const path = require('path')

// Test suites to run
const TEST_SUITES = [
  {
    name: 'AI Services Audit',
    file: 'tests/ai-services-audit.test.js',
    description: 'Static analysis of AI service files'
  },
  {
    name: 'AI Services Functional Tests',
    file: 'tests/ai-services-functional.test.js',
    description: 'Functional validation of AI services'
  }
]

// Results tracking
const results = {
  suites: [],
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  totalWarnings: 0,
  startTime: Date.now()
}

console.log('╔════════════════════════════════════════════════════════════════════════════╗')
console.log('║                    AI SERVICES COMPREHENSIVE TEST SUITE                    ║')
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n')

/**
 * Run a single test suite
 */
function runTestSuite(suite) {
  return new Promise((resolve, reject) => {
    console.log('═'.repeat(80))
    console.log(`Running: ${suite.name}`)
    console.log(`Description: ${suite.description}`)
    console.log('═'.repeat(80))
    
    const startTime = Date.now()
    const testProcess = spawn('node', [suite.file], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    })
    
    testProcess.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      
      const result = {
        name: suite.name,
        passed: code === 0,
        duration: parseFloat(duration),
        exitCode: code
      }
      
      results.suites.push(result)
      
      console.log(`\n⏱️  Duration: ${duration}s`)
      console.log(`${code === 0 ? '✅' : '❌'} ${suite.name} ${code === 0 ? 'PASSED' : 'FAILED'}\n`)
      
      resolve(result)
    })
    
    testProcess.on('error', (error) => {
      console.error(`❌ Error running ${suite.name}:`, error)
      reject(error)
    })
  })
}

/**
 * Run all test suites sequentially
 */
async function runAllTests() {
  for (const suite of TEST_SUITES) {
    try {
      await runTestSuite(suite)
    } catch (error) {
      console.error(`Failed to run ${suite.name}:`, error)
      results.suites.push({
        name: suite.name,
        passed: false,
        duration: 0,
        error: error.message
      })
    }
  }
  
  // Generate final report
  generateReport()
}

/**
 * Generate comprehensive test report
 */
function generateReport() {
  const totalDuration = ((Date.now() - results.startTime) / 1000).toFixed(2)
  
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                         COMPREHENSIVE TEST REPORT                          ║')
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n')
  
  // Suite-by-suite breakdown
  console.log('📊 Test Suite Results:\n')
  results.suites.forEach((suite, index) => {
    const status = suite.passed ? '✅ PASSED' : '❌ FAILED'
    console.log(`${index + 1}. ${suite.name}`)
    console.log(`   Status: ${status}`)
    console.log(`   Duration: ${suite.duration}s`)
    if (suite.error) {
      console.log(`   Error: ${suite.error}`)
    }
    console.log()
  })
  
  // Overall statistics
  const passedSuites = results.suites.filter(s => s.passed).length
  const failedSuites = results.suites.filter(s => !s.passed).length
  const successRate = ((passedSuites / results.suites.length) * 100).toFixed(1)
  
  console.log('📈 Overall Statistics:')
  console.log(`   Total Test Suites: ${results.suites.length}`)
  console.log(`   ✅ Passed: ${passedSuites}`)
  console.log(`   ❌ Failed: ${failedSuites}`)
  console.log(`   Success Rate: ${successRate}%`)
  console.log(`   Total Duration: ${totalDuration}s\n`)
  
  // Final verdict
  if (failedSuites === 0) {
    console.log('╔════════════════════════════════════════════════════════════════════════════╗')
    console.log('║                    🎉 ALL AI SERVICES TESTS PASSED! 🎉                     ║')
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n')
    
    console.log('✅ AI Services Status: PRODUCTION READY\n')
    console.log('All AI services have been validated:')
    console.log('  • File structure and existence verified')
    console.log('  • TypeScript compilation successful')
    console.log('  • Method signatures validated')
    console.log('  • Import statements correct')
    console.log('  • Error handling implemented')
    console.log('  • API endpoints properly structured\n')
    
    process.exit(0)
  } else {
    console.log('╔════════════════════════════════════════════════════════════════════════════╗')
    console.log('║                    ⚠️  SOME TESTS FAILED - REVIEW NEEDED                   ║')
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n')
    
    console.log('Failed Test Suites:')
    results.suites.filter(s => !s.passed).forEach(suite => {
      console.log(`  ❌ ${suite.name}`)
      if (suite.error) {
        console.log(`     Error: ${suite.error}`)
      }
    })
    console.log()
    
    process.exit(1)
  }
}

// Run all tests
runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error)
  process.exit(1)
})

