/**
 * COMPREHENSIVE AI SERVICES AUDIT TEST
 * Tests all AI services for TypeScript errors, method signatures, and integration
 */

const fs = require('fs')
const path = require('path')

// Test configuration
const AI_SERVICES = [
  // Core AI Services
  { name: 'AI Service', path: 'lib/services/ai-service.ts', critical: true },
  { name: 'AI Business Analyzer', path: 'lib/services/ai-business-analyzer.ts', critical: true },
  { name: 'AI Business Intelligence Engine', path: 'lib/services/ai-business-intelligence-engine.ts', critical: true },
  { name: 'Enhanced AI Business Analyzer', path: 'lib/services/enhanced-ai-business-analyzer.ts', critical: false },
  { name: 'Enhanced AI Integration', path: 'lib/services/enhanced-ai-integration.ts', critical: false },
  { name: 'Integrated SEO AI Service', path: 'lib/services/integrated-seo-ai-service.ts', critical: true },
  { name: 'Content Gap Analyzer', path: 'lib/services/content-gap-analyzer.ts', critical: true },
  { name: 'Competitive Benchmarking', path: 'lib/services/competitive-benchmarking.ts', critical: true },
  { name: 'Website Analyzer', path: 'lib/services/website-analyzer.ts', critical: true },
  { name: 'Enhanced Website Analyzer', path: 'lib/services/enhanced-website-analyzer.ts', critical: true },
  { name: 'Directory Matcher', path: 'lib/services/directory-matcher.ts', critical: true },
  { name: 'AI Analysis Cache', path: 'lib/services/ai-analysis-cache.ts', critical: true },
  { name: 'Business Intelligence', path: 'lib/services/business-intelligence.ts', critical: false },
  
  // Competitive Features
  { name: 'Competitive Intelligence Engine', path: 'lib/competitive-features/competitive-intelligence-engine.ts', critical: false },
  { name: 'AI Reputation Manager', path: 'lib/competitive-features/ai-reputation-manager.ts', critical: false },
  { name: 'Brand Consistency Engine', path: 'lib/competitive-features/brand-consistency-engine.ts', critical: false },
]

const AI_API_ENDPOINTS = [
  { name: 'Business Analyzer API', path: 'pages/api/ai/business-analyzer.ts', critical: true },
  { name: 'Business Intelligence API', path: 'pages/api/ai/business-intelligence.ts', critical: true },
  { name: 'Competitive Benchmark API', path: 'pages/api/ai/competitive-benchmark.ts', critical: true },
  { name: 'Competitive Benchmarking API', path: 'pages/api/ai/competitive-benchmarking.ts', critical: false },
  { name: 'Competitive Intelligence API', path: 'pages/api/ai/competitive-intelligence.ts', critical: false },
  { name: 'Competitor Analysis API', path: 'pages/api/ai/competitor-analysis.ts', critical: false },
  { name: 'Competitor SEO Research API', path: 'pages/api/ai/competitor-seo-research.ts', critical: false },
  { name: 'Content Gap Analysis API', path: 'pages/api/ai/content-gap-analysis.ts', critical: true },
  { name: 'Content Optimization API', path: 'pages/api/ai/content-optimization.ts', critical: false },
  { name: 'Brand Consistency API', path: 'pages/api/ai/brand-consistency.ts', critical: false },
  { name: 'Reputation Manager API', path: 'pages/api/ai/reputation-manager.ts', critical: false },
  { name: 'Enhanced Analysis API', path: 'pages/api/ai/enhanced-analysis.ts', critical: false },
  { name: 'Integrated Analysis API', path: 'pages/api/ai/integrated-analysis.ts', critical: false },
  { name: 'Generate Descriptions API', path: 'pages/api/ai/generate-descriptions.ts', critical: true },
]

// Common TypeScript issues to check
const COMMON_ISSUES = [
  { pattern: /\bformatCompanyName\(/g, fix: 'this.formatCompanyName(', description: 'Missing this. qualifier' },
  { pattern: /\bperformComprehensiveAnalysis\(/g, fix: 'Check method name', description: 'Non-existent method' },
  { pattern: /private\s+async\s+generateMarketInsights/g, fix: 'async generateMarketInsights', description: 'Private method called externally' },
  { pattern: /result\.confidence(?!\s*:)/g, fix: 'result.data?.confidence', description: 'Incorrect property access' },
  { pattern: /result\.qualityScore(?!\s*:)/g, fix: 'result.data?.qualityScore', description: 'Incorrect property access' },
]

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  critical_failures: 0,
  issues: []
}

console.log('╔════════════════════════════════════════════════════════════════════════════╗')
console.log('║                    AI SERVICES COMPREHENSIVE AUDIT                         ║')
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n')

/**
 * Test 1: File Existence Check
 */
function testFileExistence() {
  console.log('📁 TEST 1: File Existence Check')
  console.log('─'.repeat(80))
  
  const allFiles = [...AI_SERVICES, ...AI_API_ENDPOINTS]
  let passed = 0
  let failed = 0
  
  allFiles.forEach(file => {
    results.total++
    const fullPath = path.join(process.cwd(), file.path)
    const exists = fs.existsSync(fullPath)
    
    if (exists) {
      console.log(`✅ ${file.name}`)
      passed++
      results.passed++
    } else {
      console.log(`❌ ${file.name} - FILE NOT FOUND`)
      failed++
      results.failed++
      if (file.critical) {
        results.critical_failures++
      }
      results.issues.push({
        severity: file.critical ? 'CRITICAL' : 'WARNING',
        file: file.path,
        issue: 'File not found'
      })
    }
  })
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)
}

/**
 * Test 2: TypeScript Syntax Issues
 */
function testTypeScriptIssues() {
  console.log('🔍 TEST 2: Common TypeScript Issues Check')
  console.log('─'.repeat(80))
  
  const allFiles = [...AI_SERVICES, ...AI_API_ENDPOINTS]
  let filesChecked = 0
  let issuesFound = 0
  
  allFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file.path)
    
    if (!fs.existsSync(fullPath)) {
      return // Skip non-existent files
    }
    
    filesChecked++
    const content = fs.readFileSync(fullPath, 'utf-8')
    
    COMMON_ISSUES.forEach(issue => {
      const matches = content.match(issue.pattern)
      if (matches) {
        issuesFound++
        results.warnings++
        console.log(`⚠️  ${file.name}`)
        console.log(`   Issue: ${issue.description}`)
        console.log(`   Found: ${matches.length} occurrence(s)`)
        console.log(`   Suggested fix: ${issue.fix}\n`)
        
        results.issues.push({
          severity: 'WARNING',
          file: file.path,
          issue: issue.description,
          occurrences: matches.length
        })
      }
    })
  })
  
  if (issuesFound === 0) {
    console.log('✅ No common TypeScript issues found\n')
  } else {
    console.log(`\n📊 Results: ${filesChecked} files checked, ${issuesFound} issues found\n`)
  }
}

/**
 * Test 3: Method Signature Validation
 */
function testMethodSignatures() {
  console.log('🔧 TEST 3: Critical Method Signatures')
  console.log('─'.repeat(80))
  
  const criticalMethods = [
    {
      file: 'lib/services/ai-business-analyzer.ts',
      method: 'generateBusinessIntelligence',
      shouldExist: true
    },
    {
      file: 'lib/services/ai-business-intelligence-engine.ts',
      method: 'analyzeBusinessIntelligence',
      shouldExist: true
    },
    {
      file: 'lib/services/competitive-benchmarking.ts',
      method: 'performBenchmarkAnalysis',
      shouldExist: true
    },
    {
      file: 'lib/services/competitive-benchmarking.ts',
      method: 'formatCompanyName',
      shouldExist: true
    },
  ]
  
  let passed = 0
  let failed = 0
  
  criticalMethods.forEach(test => {
    results.total++
    const fullPath = path.join(process.cwd(), test.file)
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  ${test.file} - File not found, skipping method check`)
      return
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8')
    const methodPattern = new RegExp(`\\b${test.method}\\s*\\(`, 'g')
    const exists = methodPattern.test(content)
    
    if (exists === test.shouldExist) {
      console.log(`✅ ${test.file} - ${test.method}()`)
      passed++
      results.passed++
    } else {
      console.log(`❌ ${test.file} - ${test.method}() ${test.shouldExist ? 'NOT FOUND' : 'SHOULD NOT EXIST'}`)
      failed++
      results.failed++
      results.issues.push({
        severity: 'ERROR',
        file: test.file,
        issue: `Method ${test.method}() ${test.shouldExist ? 'not found' : 'should not exist'}`
      })
    }
  })
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)
}

/**
 * Test 4: Import Statement Validation
 */
function testImportStatements() {
  console.log('📦 TEST 4: Import Statement Validation')
  console.log('─'.repeat(80))
  
  const criticalImports = [
    {
      file: 'lib/services/ai-business-analyzer.ts',
      imports: ['callAI', 'isAnthropicAvailable']
    },
    {
      file: 'lib/services/competitive-benchmarking.ts',
      imports: ['callAI', 'createClient']
    },
    {
      file: 'pages/api/ai/business-analyzer.ts',
      imports: ['AIBusinessAnalyzer']
    },
    {
      file: 'pages/api/ai/business-intelligence.ts',
      imports: ['AIBusinessIntelligenceEngine']
    },
  ]
  
  let passed = 0
  let failed = 0
  
  criticalImports.forEach(test => {
    const fullPath = path.join(process.cwd(), test.file)
    
    if (!fs.existsSync(fullPath)) {
      return
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8')
    
    test.imports.forEach(importName => {
      results.total++
      const importPattern = new RegExp(`import.*\\b${importName}\\b`, 'g')
      const exists = importPattern.test(content)
      
      if (exists) {
        console.log(`✅ ${test.file} - imports ${importName}`)
        passed++
        results.passed++
      } else {
        console.log(`⚠️  ${test.file} - missing import: ${importName}`)
        failed++
        results.warnings++
        results.issues.push({
          severity: 'WARNING',
          file: test.file,
          issue: `Missing import: ${importName}`
        })
      }
    })
  })
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} warnings\n`)
}

// Run all tests
testFileExistence()
testTypeScriptIssues()
testMethodSignatures()
testImportStatements()

// Final Summary
console.log('╔════════════════════════════════════════════════════════════════════════════╗')
console.log('║                           AUDIT SUMMARY                                    ║')
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n')

console.log(`📈 Total Tests: ${results.total}`)
console.log(`✅ Passed: ${results.passed}`)
console.log(`❌ Failed: ${results.failed}`)
console.log(`⚠️  Warnings: ${results.warnings}`)
console.log(`🚨 Critical Failures: ${results.critical_failures}\n`)

if (results.issues.length > 0) {
  console.log('📋 Issues Found:\n')
  results.issues.forEach((issue, index) => {
    console.log(`${index + 1}. [${issue.severity}] ${issue.file}`)
    console.log(`   ${issue.issue}`)
    if (issue.occurrences) {
      console.log(`   Occurrences: ${issue.occurrences}`)
    }
    console.log()
  })
}

const successRate = ((results.passed / results.total) * 100).toFixed(1)
console.log(`\n🎯 Success Rate: ${successRate}%`)

if (results.critical_failures > 0) {
  console.log('\n🚨 CRITICAL FAILURES DETECTED - Immediate action required!')
  process.exit(1)
} else if (results.failed > 0) {
  console.log('\n⚠️  Some tests failed - Review recommended')
  process.exit(1)
} else if (results.warnings > 0) {
  console.log('\n✅ All tests passed with warnings')
  process.exit(0)
} else {
  console.log('\n✅ ALL TESTS PASSED - AI services are healthy!')
  process.exit(0)
}

