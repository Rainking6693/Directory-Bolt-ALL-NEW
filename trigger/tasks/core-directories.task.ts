/**
 * Trigger.dev Task: Core Directory Automations
 * 
 * Implements first set of "Core" directory automations:
 * - Google My Business
 * - Yelp
 * - Bing Places
 */

import { task } from "@trigger.dev/sdk/v3"
import { chromium } from "playwright"
import { logger } from "../../lib/utils/logger"

interface CoreDirectorySubmissionPayload {
  jobId: string
  directory: 'google' | 'yelp' | 'bing'
  businessData: {
    name: string
    address?: string
    phone?: string
    email?: string
    website: string
    category?: string
    description?: string
  }
}

/**
 * Google My Business submission
 */
async function submitToGoogleMyBusiness(page: any, businessData: CoreDirectorySubmissionPayload['businessData']) {
  // Navigate to Google Business Profile
  await page.goto('https://business.google.com/create', { waitUntil: 'networkidle' })
  
  // Fill business name
  await page.fill('input[name="businessName"]', businessData.name)
  
  // Fill address
  if (businessData.address) {
    await page.fill('input[name="address"]', businessData.address)
  }
  
  // Fill phone
  if (businessData.phone) {
    await page.fill('input[name="phone"]', businessData.phone)
  }
  
  // Fill website
  await page.fill('input[name="website"]', businessData.website)
  
  // Select category
  if (businessData.category) {
    await page.selectOption('select[name="category"]', { label: businessData.category })
  }
  
  // Submit
  await page.click('button[type="submit"]')
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 })
}

/**
 * Yelp submission
 */
async function submitToYelp(page: any, businessData: CoreDirectorySubmissionPayload['businessData']) {
  // Navigate to Yelp for Business
  await page.goto('https://biz.yelp.com/claiming', { waitUntil: 'networkidle' })
  
  // Click "Claim your business" or similar
  await page.click('a:has-text("Claim"), button:has-text("Get Started")')
  await page.waitForNavigation({ waitUntil: 'networkidle' })
  
  // Fill business name
  await page.fill('input[name="business_name"], input[id="business_name"]', businessData.name)
  
  // Fill address
  if (businessData.address) {
    await page.fill('input[name="address"], input[id="address"]', businessData.address)
  }
  
  // Fill phone
  if (businessData.phone) {
    await page.fill('input[name="phone"], input[id="phone"]', businessData.phone)
  }
  
  // Fill website
  await page.fill('input[name="website"], input[id="website"]', businessData.website)
  
  // Submit
  await page.click('button[type="submit"], button:has-text("Continue")')
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 })
}

/**
 * Bing Places submission
 */
async function submitToBingPlaces(page: any, businessData: CoreDirectorySubmissionPayload['businessData']) {
  // Navigate to Bing Places
  await page.goto('https://www.bingplaces.com/', { waitUntil: 'networkidle' })
  
  // Click "Add a place" or similar
  await page.click('a:has-text("Add"), button:has-text("Claim Business")')
  await page.waitForNavigation({ waitUntil: 'networkidle' })
  
  // Fill business information
  await page.fill('input[name="name"]', businessData.name)
  
  if (businessData.address) {
    await page.fill('input[name="address"]', businessData.address)
  }
  
  if (businessData.phone) {
    await page.fill('input[name="phone"]', businessData.phone)
  }
  
  if (businessData.website) {
    await page.fill('input[name="website"]', businessData.website)
  }
  
  // Submit
  await page.click('button[type="submit"]')
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 })
}

export const coreDirectorySubmissionTask = task({
  id: "core-directory-submission",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
  },
  run: async (payload: CoreDirectorySubmissionPayload, { ctx }) => {
    const { jobId, directory, businessData } = payload

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    const page = await context.newPage()

    try {
      // Route to appropriate submission function
      switch (directory) {
        case 'google':
          await submitToGoogleMyBusiness(page, businessData)
          break
        case 'yelp':
          await submitToYelp(page, businessData)
          break
        case 'bing':
          await submitToBingPlaces(page, businessData)
          break
        default:
          throw new Error(`Unsupported core directory: ${directory}`)
      }

      // Capture screenshot
      const screenshot = await page.screenshot({ fullPage: false })
      
      // Check for success indicators
      const success = await page.$('.success, .confirmation, .thank-you, [class*="success"]')
      const error = await page.$('.error, [class*="error"]')

      await browser.close()

      return {
        success: !!success && !error,
        directory,
        jobId,
        screenshot: screenshot.toString('base64'),
        submittedAt: new Date().toISOString()
      }

    } catch (error) {
      await browser.close()
      logger.error(`Core directory submission failed for ${directory}`, { error }, error instanceof Error ? error : undefined)
      throw error
    }
  },
})
