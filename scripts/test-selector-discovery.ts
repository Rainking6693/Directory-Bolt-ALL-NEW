/**
 * Test Script: Selector Discovery on Sample Directory
 * 
 * This script tests the selector discovery functionality by:
 * 1. Finding a sample directory
 * 2. Testing the update_directory_selectors function
 * 3. Verifying the selectors were updated correctly
 * 
 * Run with: npx ts-node scripts/test-selector-discovery.ts
 */

import { createClient } from '@supabase/supabase-js'
import type { DirectoriesRow } from '../types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: Supabase credentials not configured')
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface SelectorDiscoveryResult {
  success: boolean
  directoryId?: string
  directoryName?: string
  selectorsBefore?: any
  selectorsAfter?: any
  logBefore?: any
  logAfter?: any
  error?: string
}

async function testSelectorDiscovery(): Promise<SelectorDiscoveryResult> {
  console.log('🧪 Testing Selector Discovery Functionality\n')

  try {
    // Step 1: Find a sample directory
    console.log('Step 1: Finding sample directory...')
    const { data: directories, error: fetchError } = await supabase
      .from('directories')
      .select('id, name, field_selectors, selector_discovery_log')
      .limit(1)

    if (fetchError) {
      throw new Error(`Failed to fetch directories: ${fetchError.message}`)
    }

    if (!directories || directories.length === 0) {
      console.log('⚠️  No directories found in database')
      return { success: false, error: 'No directories found' }
    }

    const directory = directories[0] as DirectoriesRow
    console.log(`✅ Found directory: ${directory.name} (ID: ${directory.id})`)
    console.log(`   Current selectors: ${JSON.stringify(directory.field_selectors || {})}`)
    console.log(`   Last updated: ${directory.selectors_updated_at || 'Never'}\n`)

    // Step 2: Test the update function with sample selectors
    console.log('Step 2: Testing update_directory_selectors function...')
    
    const testSelectors = {
      business_name: '#business-name',
      email: 'input[type="email"]',
      phone: '#phone-number',
      website: 'input[name="website"]',
      description: 'textarea#description'
    }

    const testLog = {
      run_id: `test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      selectors_discovered: Object.keys(testSelectors).length,
      confidence_score: 0.85,
      discovery_method: 'automated_test',
      user_agent: 'test-script/1.0',
      validation_run: true
    }

    const { error: updateError } = await supabase.rpc('update_directory_selectors', {
      dir_id: directory.id,
      new_selectors: testSelectors,
      discovery_log: testLog
    })

    if (updateError) {
      throw new Error(`Failed to update selectors: ${updateError.message}`)
    }

    console.log('✅ Function call successful\n')

    // Step 3: Verify the update
    console.log('Step 3: Verifying selector update...')
    const { data: updatedDir, error: verifyError } = await supabase
      .from('directories')
      .select('id, name, field_selectors, selector_discovery_log, selectors_updated_at')
      .eq('id', directory.id)
      .single()

    if (verifyError) {
      throw new Error(`Failed to verify update: ${verifyError.message}`)
    }

    const updatedDirectory = updatedDir as DirectoriesRow

    // Check if test selector was merged in
    const fieldSelectors = (updatedDirectory.field_selectors ?? {}) as Record<string, string | undefined>
    const expectedSelectors = (testSelectors ?? {}) as Record<string, string | undefined>
    const hasTestSelectors = Object.keys(expectedSelectors).every(
      key => fieldSelectors[key] === expectedSelectors[key]
    )

    const discoveryLog = (updatedDirectory.selector_discovery_log as any) || {}
    const hasLog = discoveryLog.run_id === testLog.run_id

    console.log(`   Updated at: ${updatedDirectory.selectors_updated_at}`)
    console.log(`   Selectors count: ${Object.keys(fieldSelectors).length}`)
    console.log(`   Test selectors merged: ${hasTestSelectors ? '✅ YES' : '❌ NO'}`)
    console.log(`   Discovery log updated: ${hasLog ? '✅ YES' : '❌ NO'}\n`)

    if (hasTestSelectors && hasLog) {
      console.log('✅ TEST PASSED: Selector discovery function works correctly!')
      return {
        success: true,
        directoryId: directory.id,
        directoryName: directory.name,
        selectorsBefore: directory.field_selectors,
        selectorsAfter: updatedDirectory.field_selectors,
        logBefore: directory.selector_discovery_log,
        logAfter: updatedDirectory.selector_discovery_log
      }
    } else {
      console.log('❌ TEST FAILED: Selectors or log not updated correctly')
      return {
        success: false,
        directoryId: directory.id,
        directoryName: directory.name,
        error: 'Selectors or log not properly updated'
      }
    }

  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
}

// Run the test
testSelectorDiscovery()
  .then((result) => {
    if (result.success) {
      console.log('\n📊 Test Summary:')
      console.log(`   Directory: ${result.directoryName}`)
      console.log(`   Selectors before: ${JSON.stringify(result.selectorsBefore || {})}`)
      console.log(`   Selectors after: ${JSON.stringify(result.selectorsAfter || {})}`)
      process.exit(0)
    } else {
      console.error(`\n❌ Test failed: ${result.error}`)
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error(`\n❌ Unexpected error: ${error.message}`)
    process.exit(1)
  })

