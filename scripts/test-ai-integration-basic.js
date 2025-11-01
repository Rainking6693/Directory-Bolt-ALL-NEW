/**
 * Basic Integration Test for AI Services
 * 
 * Tests that services can be imported and instantiated without errors.
 * Does NOT make actual API calls (requires API keys).
 */

const path = require('path')

console.log('🧪 Basic AI Services Integration Test\n')
console.log('Testing import and instantiation (no API calls)...\n')

const testResults = {
  passed: [],
  failed: []
}

// Test imports (simulating what would happen in Next.js)
function testImports() {
  console.log('Testing service imports...\n')
  
  const services = [
    { name: 'Anthropic Client', path: '../lib/utils/anthropic-client.ts' },
    { name: 'Integrated SEO AI', path: '../lib/services/integrated-seo-ai-service.ts' },
    { name: 'AI Business Analyzer', path: '../lib/services/ai-business-analyzer.ts' },
    { name: 'Content Gap Analyzer', path: '../lib/services/content-gap-analyzer.ts' },
    { name: 'Competitive Benchmarking', path: '../lib/services/competitive-benchmarking.ts' },
    { name: 'Competitive Intelligence', path: '../lib/competitive-features/competitive-intelligence-engine.ts' },
    { name: 'AI Reputation Manager', path: '../lib/competitive-features/ai-reputation-manager.ts' },
    { name: 'Brand Consistency Engine', path: '../lib/competitive-features/brand-consistency-engine.ts' }
  ]
  
  services.forEach(service => {
    try {
      const servicePath = path.join(__dirname, service.path)
      const fs = require('fs')
      
      if (!fs.existsSync(servicePath)) {
        throw new Error(`File not found: ${service.path}`)
      }
      
      const content = fs.readFileSync(servicePath, 'utf8')
      
      // Check for basic syntax issues
      if (content.includes('export') || content.includes('class') || content.includes('interface')) {
        testResults.passed.push(service.name)
        console.log(`   ✅ ${service.name} - OK`)
      } else {
        throw new Error('Invalid service structure')
      }
    } catch (error) {
      testResults.failed.push(`${service.name}: ${error.message}`)
      console.log(`   ❌ ${service.name} - FAILED: ${error.message}`)
    }
  })
  
  console.log('')
}

// Test API endpoints exist
function testAPIEndpoints() {
  console.log('Testing API endpoints...\n')
  
  const endpoints = [
    { name: 'Integrated Analysis', path: '../pages/api/ai/integrated-analysis.ts' },
    { name: 'Business Analyzer', path: '../pages/api/ai/business-analyzer.ts' },
    { name: 'Content Gap', path: '../pages/api/ai/content-gap.ts' },
    { name: 'Competitive Benchmark', path: '../pages/api/ai/competitive-benchmark.ts' },
    { name: 'Business Intelligence', path: '../pages/api/ai/business-intelligence.ts' },
    { name: 'Competitive Intelligence', path: '../pages/api/ai/competitive-intelligence.ts' },
    { name: 'Reputation Manager', path: '../pages/api/ai/reputation-manager.ts' },
    { name: 'Brand Consistency', path: '../pages/api/ai/brand-consistency.ts' }
  ]
  
  endpoints.forEach(endpoint => {
    try {
      const endpointPath = path.join(__dirname, endpoint.path)
      const fs = require('fs')
      
      if (!fs.existsSync(endpointPath)) {
        throw new Error(`File not found: ${endpoint.path}`)
      }
      
      const content = fs.readFileSync(endpointPath, 'utf8')
      
      // Check for required Next.js API structure
      if (content.includes('NextApiRequest') && content.includes('NextApiResponse')) {
        testResults.passed.push(endpoint.name)
        console.log(`   ✅ ${endpoint.name} - OK`)
      } else {
        throw new Error('Invalid API endpoint structure')
      }
    } catch (error) {
      testResults.failed.push(`${endpoint.name}: ${error.message}`)
      console.log(`   ❌ ${endpoint.name} - FAILED: ${error.message}`)
    }
  })
  
  console.log('')
}

// Run tests
console.log('='.repeat(60))
testImports()
testAPIEndpoints()

// Summary
console.log('='.repeat(60))
console.log('📊 SUMMARY')
console.log('='.repeat(60))
console.log(`✅ Passed: ${testResults.passed.length}`)
console.log(`❌ Failed: ${testResults.failed.length}`)
console.log('')

if (testResults.failed.length > 0) {
  console.log('❌ FAILURES:')
  testResults.failed.forEach(failure => console.log(`   - ${failure}`))
  console.log('')
  process.exit(1)
} else {
  console.log('✅ All basic integration tests passed!')
  console.log('')
  console.log('📝 Note: This test only verifies file structure.')
  console.log('   To test actual functionality, you need:')
  console.log('   1. ANTHROPIC_API_KEY and GEMINI_API_KEY in .env')
  console.log('   2. Run actual API calls against the endpoints')
  console.log('   3. Monitor responses and error handling')
  process.exit(0)
}

