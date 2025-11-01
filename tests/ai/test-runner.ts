/**
 * Comprehensive AI Features Test Runner
 * 
 * Runs all AI feature tests and generates a comprehensive report
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

interface TestResult {
  suite: string
  passed: boolean
  duration?: number
  error?: string
}

const AI_TEST_FILES = [
  'tests/ai/__tests__/anthropic-client.test.ts',
  'tests/ai/__tests__/ai-analysis-cache.test.ts',
  'tests/ai/__tests__/integrated-seo-ai-service.test.ts',
  'tests/ai/__tests__/ai-business-analyzer.test.ts',
  'tests/ai/__tests__/content-gap-analyzer.test.ts',
  'tests/ai/__tests__/competitive-benchmarking.test.ts',
  'tests/ai/__tests__/reputation-manager.test.ts',
  'tests/ai/__tests__/brand-consistency-engine.test.ts',
  'tests/ai/__tests__/competitive-intelligence-engine.test.ts',
  'tests/ai/__tests__/enhanced-website-analyzer.test.ts',
  'tests/ai/__tests__/analysis-cost-tracker.test.ts',
  'tests/ai/__tests__/ai-business-intelligence-engine.test.ts',
  'tests/ai/__tests__/ai-api-endpoints.test.ts'
]

function runTests(): void {
  console.log('🧪 Running Comprehensive AI Features Test Suite\n')
  console.log(`Found ${AI_TEST_FILES.length} test files\n`)

  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  for (const testFile of AI_TEST_FILES) {
    const testPath = join(process.cwd(), testFile)
    const suiteName = testFile.split('/').pop()?.replace('.test.ts', '') || 'unknown'

    if (!existsSync(testPath)) {
      console.log(`⏭️  Skipping ${suiteName} (file not found)`)
      continue
    }

    try {
      console.log(`▶️  Running ${suiteName}...`)
      const startTime = Date.now()
      
      execSync(`npx jest ${testFile} --passWithNoTests`, {
        stdio: 'inherit',
        cwd: process.cwd()
      })
      
      const duration = Date.now() - startTime
      results.push({ suite: suiteName, passed: true, duration })
      passed++
      console.log(`✅ ${suiteName} passed (${duration}ms)\n`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : String(error)
      results.push({ suite: suiteName, passed: false, duration, error: errorMsg })
      failed++
      console.log(`❌ ${suiteName} failed\n`)
    }
  }

  // Generate report
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total Tests: ${results.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏭️  Skipped: ${AI_TEST_FILES.length - results.length}`)
  console.log('\n' + '='.repeat(60))

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:')
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.suite}`)
        if (r.error) {
          console.log(`    Error: ${r.error}`)
        }
      })
  }

  console.log('\n' + '='.repeat(60))
  console.log('Detailed Results:')
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌'
    const duration = result.duration ? ` (${result.duration}ms)` : ''
    console.log(`  ${status} ${result.suite}${duration}`)
  })
}

// Run if executed directly
if (require.main === module) {
  runTests()
}

export { runTests, AI_TEST_FILES }

