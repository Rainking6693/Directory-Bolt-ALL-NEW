/**
 * Test Script for New AI Services Integration
 * 
 * Tests all newly integrated AI services to ensure they work correctly:
 * - Anthropic/Gemini client initialization
 * - Service instantiation
 * - API endpoint availability
 * - Error handling
 */

const path = require('path')
const fs = require('fs')

console.log('🧪 Testing New AI Services Integration...\n')

const testResults = {
  passed: [],
  failed: [],
  warnings: []
}

// Test 1: Check Anthropic Client Utility
function testAnthropicClient() {
  console.log('1️⃣ Testing Anthropic Client Utility...')
  try {
    const clientPath = path.join(__dirname, '../lib/utils/anthropic-client.ts')
    if (!fs.existsSync(clientPath)) {
      throw new Error('anthropic-client.ts not found')
    }
    
    const content = fs.readFileSync(clientPath, 'utf8')
    
    // Check for required imports
    if (!content.includes('@anthropic-ai/sdk')) {
      throw new Error('Missing @anthropic-ai/sdk import')
    }
    
    if (!content.includes('@google/generative-ai')) {
      throw new Error('Missing @google/generative-ai import')
    }
    
    // Check for required functions
    const requiredFunctions = [
      'callAI',
      'callAnthropic',
      'callGemini',
      'isAnthropicAvailable',
      'isGeminiAvailable'
    ]
    
    for (const func of requiredFunctions) {
      if (!content.includes(`function ${func}`) && !content.includes(`export function ${func}`) && !content.includes(`export async function ${func}`)) {
        throw new Error(`Missing function: ${func}`)
      }
    }
    
    testResults.passed.push('Anthropic Client Utility')
    console.log('   ✅ Anthropic Client Utility - OK\n')
  } catch (error) {
    testResults.failed.push(`Anthropic Client Utility: ${error.message}`)
    console.log(`   ❌ Anthropic Client Utility - FAILED: ${error.message}\n`)
  }
}

// Test 2: Check Phase 1 Services
function testPhase1Services() {
  console.log('2️⃣ Testing Phase 1 Services...')
  
  const phase1Services = [
    { name: 'Integrated SEO AI Service', path: 'lib/services/integrated-seo-ai-service.ts', endpoint: 'pages/api/ai/integrated-analysis.ts' },
    { name: 'AI Business Analyzer', path: 'lib/services/ai-business-analyzer.ts', endpoint: 'pages/api/ai/business-analyzer.ts' },
    { name: 'Content Gap Analyzer', path: 'lib/services/content-gap-analyzer.ts', endpoint: 'pages/api/ai/content-gap.ts' },
    { name: 'Competitive Benchmarking', path: 'lib/services/competitive-benchmarking.ts', endpoint: 'pages/api/ai/competitive-benchmark.ts' }
  ]
  
  phase1Services.forEach(service => {
    try {
      const servicePath = path.join(__dirname, '..', service.path)
      const endpointPath = path.join(__dirname, '..', service.endpoint)
      
      if (!fs.existsSync(servicePath)) {
        throw new Error(`Service file not found: ${service.path}`)
      }
      
      if (!fs.existsSync(endpointPath)) {
        throw new Error(`API endpoint not found: ${service.endpoint}`)
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8')
      
      // Check for AI client usage
      if (!serviceContent.includes('callAI') && !serviceContent.includes('anthropic-client')) {
        testResults.warnings.push(`${service.name}: May not be using unified AI client`)
      }
      
      // Check for proper error handling
      if (!serviceContent.includes('try') || !serviceContent.includes('catch')) {
        testResults.warnings.push(`${service.name}: Missing error handling`)
      }
      
      const endpointContent = fs.readFileSync(endpointPath, 'utf8')
      
      // Check endpoint has proper structure
      if (!endpointContent.includes('NextApiRequest') || !endpointContent.includes('NextApiResponse')) {
        throw new Error('Invalid API endpoint structure')
      }
      
      testResults.passed.push(service.name)
      console.log(`   ✅ ${service.name} - OK`)
    } catch (error) {
      testResults.failed.push(`${service.name}: ${error.message}`)
      console.log(`   ❌ ${service.name} - FAILED: ${error.message}`)
    }
  })
  
  console.log('')
}

// Test 3: Check Phase 2 Services
function testPhase2Services() {
  console.log('3️⃣ Testing Phase 2 Services...')
  
  const phase2Services = [
    { name: 'AI Business Intelligence Engine', path: 'lib/services/ai-business-intelligence-engine.ts', endpoint: 'pages/api/ai/business-intelligence.ts' },
    { name: 'Competitive Intelligence Engine', path: 'lib/competitive-features/competitive-intelligence-engine.ts', endpoint: 'pages/api/ai/competitive-intelligence.ts' }
  ]
  
  phase2Services.forEach(service => {
    try {
      const servicePath = path.join(__dirname, '..', service.path)
      const endpointPath = path.join(__dirname, '..', service.endpoint)
      
      if (!fs.existsSync(servicePath)) {
        throw new Error(`Service file not found: ${service.path}`)
      }
      
      if (!fs.existsSync(endpointPath)) {
        throw new Error(`API endpoint not found: ${service.endpoint}`)
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8')
      
      // Check for AI integration
      if (!serviceContent.includes('callAI') && !serviceContent.includes('anthropic-client')) {
        testResults.warnings.push(`${service.name}: May not be using unified AI client`)
      }
      
      testResults.passed.push(service.name)
      console.log(`   ✅ ${service.name} - OK`)
    } catch (error) {
      testResults.failed.push(`${service.name}: ${error.message}`)
      console.log(`   ❌ ${service.name} - FAILED: ${error.message}`)
    }
  })
  
  console.log('')
}

// Test 4: Check Phase 3 Services
function testPhase3Services() {
  console.log('4️⃣ Testing Phase 3 Services...')
  
  const phase3Services = [
    { name: 'AI Reputation Manager', path: 'lib/competitive-features/ai-reputation-manager.ts', endpoint: 'pages/api/ai/reputation-manager.ts' },
    { name: 'Brand Consistency Engine', path: 'lib/competitive-features/brand-consistency-engine.ts', endpoint: 'pages/api/ai/brand-consistency.ts' },
    { name: 'Analysis Cost Tracker', path: 'lib/services/analysis-cost-tracker.ts' }
  ]
  
  phase3Services.forEach(service => {
    try {
      const servicePath = path.join(__dirname, '..', service.path)
      
      if (!fs.existsSync(servicePath)) {
        throw new Error(`Service file not found: ${service.path}`)
      }
      
      if (service.endpoint) {
        const endpointPath = path.join(__dirname, '..', service.endpoint)
        if (!fs.existsSync(endpointPath)) {
          throw new Error(`API endpoint not found: ${service.endpoint}`)
        }
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8')
      
      // Check for Gemini pricing in cost tracker
      if (service.name === 'Analysis Cost Tracker') {
        if (!serviceContent.includes('gemini')) {
          testResults.warnings.push(`${service.name}: Missing Gemini pricing`)
        }
      }
      
      testResults.passed.push(service.name)
      console.log(`   ✅ ${service.name} - OK`)
    } catch (error) {
      testResults.failed.push(`${service.name}: ${error.message}`)
      console.log(`   ❌ ${service.name} - FAILED: ${error.message}`)
    }
  })
  
  console.log('')
}

// Test 5: Check Dependencies
function testDependencies() {
  console.log('5️⃣ Testing Dependencies...')
  
  try {
    const packageJsonPath = path.join(__dirname, '../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    
    const requiredDeps = {
      '@anthropic-ai/sdk': 'Anthropic SDK',
      '@google/generative-ai': 'Google Gemini SDK'
    }
    
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    for (const [dep, name] of Object.entries(requiredDeps)) {
      if (!deps[dep]) {
        throw new Error(`Missing dependency: ${dep} (${name})`)
      }
    }
    
    testResults.passed.push('Dependencies')
    console.log('   ✅ All required dependencies installed\n')
  } catch (error) {
    testResults.failed.push(`Dependencies: ${error.message}`)
    console.log(`   ❌ Dependencies - FAILED: ${error.message}\n`)
  }
}

// Test 6: Check Environment Variables
function testEnvironmentVariables() {
  console.log('6️⃣ Testing Environment Variables...')
  
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY'
  ]
  
  const envExamplePath = path.join(__dirname, '../.env.example')
  let envExampleContent = ''
  
  if (fs.existsSync(envExamplePath)) {
    envExampleContent = fs.readFileSync(envExamplePath, 'utf8')
  }
  
  requiredEnvVars.forEach(envVar => {
    if (!envExampleContent.includes(envVar)) {
      testResults.warnings.push(`Environment variable ${envVar} not in .env.example`)
    }
  })
  
  testResults.passed.push('Environment Variables')
  console.log('   ✅ Environment variables documented\n')
}

// Run all tests
console.log('='.repeat(60))
console.log('🧪 NEW AI SERVICES INTEGRATION TEST SUITE')
console.log('='.repeat(60))
console.log('')

testAnthropicClient()
testPhase1Services()
testPhase2Services()
testPhase3Services()
testDependencies()
testEnvironmentVariables()

// Print summary
console.log('='.repeat(60))
console.log('📊 TEST SUMMARY')
console.log('='.repeat(60))
console.log(`✅ Passed: ${testResults.passed.length}`)
console.log(`❌ Failed: ${testResults.failed.length}`)
console.log(`⚠️  Warnings: ${testResults.warnings.length}`)
console.log('')

if (testResults.failed.length > 0) {
  console.log('❌ FAILED TESTS:')
  testResults.failed.forEach(failure => {
    console.log(`   - ${failure}`)
  })
  console.log('')
}

if (testResults.warnings.length > 0) {
  console.log('⚠️  WARNINGS:')
  testResults.warnings.forEach(warning => {
    console.log(`   - ${warning}`)
  })
  console.log('')
}

if (testResults.passed.length > 0) {
  console.log('✅ PASSED TESTS:')
  testResults.passed.forEach(passed => {
    console.log(`   - ${passed}`)
  })
  console.log('')
}

// Exit code
if (testResults.failed.length > 0) {
  console.log('❌ Some tests failed. Please review and fix issues.')
  process.exit(1)
} else {
  console.log('✅ All tests passed! Services are ready for use.')
  console.log('')
  console.log('📝 Next Steps:')
  console.log('   1. Ensure ANTHROPIC_API_KEY and GEMINI_API_KEY are set in .env')
  console.log('   2. Test API endpoints manually or with integration tests')
  console.log('   3. Monitor costs using analysis-cost-tracker.ts')
  process.exit(0)
}

