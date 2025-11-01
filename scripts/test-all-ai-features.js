/**
 * Test All AI Features Script
 * 
 * Runs comprehensive tests for all AI features in the project
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const AI_FEATURES = [
  // Core AI Services
  { name: 'Anthropic Client', test: 'tests/ai/__tests__/anthropic-client.test.ts' },
  { name: 'AI Analysis Cache', test: 'tests/ai/__tests__/ai-analysis-cache.test.ts' },
  { name: 'Integrated SEO AI Service', test: 'tests/ai/__tests__/integrated-seo-ai-service.test.ts' },
  { name: 'AI Business Analyzer', test: 'tests/ai/__tests__/ai-business-analyzer.test.ts' },
  { name: 'AI Business Intelligence Engine', test: 'tests/ai/__tests__/ai-business-intelligence-engine.test.ts' },
  
  // Analysis Services
  { name: 'Content Gap Analyzer', test: 'tests/ai/__tests__/content-gap-analyzer.test.ts' },
  { name: 'Competitive Benchmarking', test: 'tests/ai/__tests__/competitive-benchmarking.test.ts' },
  { name: 'Enhanced Website Analyzer', test: 'tests/ai/__tests__/enhanced-website-analyzer.test.ts' },
  { name: 'Analysis Cost Tracker', test: 'tests/ai/__tests__/analysis-cost-tracker.test.ts' },
  
  // Competitive Features
  { name: 'Reputation Manager', test: 'tests/ai/__tests__/reputation-manager.test.ts' },
  { name: 'Brand Consistency Engine', test: 'tests/ai/__tests__/brand-consistency-engine.test.ts' },
  { name: 'Competitive Intelligence Engine', test: 'tests/ai/__tests__/competitive-intelligence-engine.test.ts' },
  
  // API Endpoints
  { name: 'AI API Endpoints', test: 'tests/ai/__tests__/ai-api-endpoints.test.ts' }
]

console.log('🧪 COMPREHENSIVE AI FEATURES TEST SUITE\n')
console.log(`Found ${AI_FEATURES.length} AI feature test suites\n`)

const results = []
let passed = 0
let failed = 0
let skipped = 0

AI_FEATURES.forEach((feature, index) => {
  const testPath = path.join(process.cwd(), feature.test)
  console.log(`[${index + 1}/${AI_FEATURES.length}] Testing: ${feature.name}`)
  
  if (!fs.existsSync(testPath)) {
    console.log(`  ⏭️  Skipped (test file not found)\n`)
    skipped++
    results.push({ name: feature.name, status: 'skipped' })
    return
  }

  try {
    const startTime = Date.now()
    execSync(`npx jest ${feature.test} --passWithNoTests`, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    })
    const duration = Date.now() - startTime
    console.log(`  ✅ PASSED (${duration}ms)\n`)
    passed++
    results.push({ name: feature.name, status: 'passed', duration })
  } catch (error) {
    console.log(`  ❌ FAILED\n`)
    failed++
    results.push({ name: feature.name, status: 'failed', error: error.message })
  }
})

// Summary
console.log('\n' + '='.repeat(70))
console.log('📊 TEST SUMMARY')
console.log('='.repeat(70))
console.log(`Total Test Suites: ${AI_FEATURES.length}`)
console.log(`✅ Passed: ${passed}`)
console.log(`❌ Failed: ${failed}`)
console.log(`⏭️  Skipped: ${skipped}`)
console.log('\n' + '='.repeat(70))

if (failed > 0) {
  console.log('\n❌ FAILED TEST SUITES:')
  results
    .filter(r => r.status === 'failed')
    .forEach(r => {
      console.log(`  - ${r.name}`)
    })
}

console.log('\n✅ Test run complete!')
process.exit(failed > 0 ? 1 : 0)

