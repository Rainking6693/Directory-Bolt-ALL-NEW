/**
 * Trigger.dev Task: Directory Submission
 * 
 * Generic form submission task using Playwright automation.
 * Uses AI-generated field mappings to fill directory forms.
 */

import { task } from "@trigger.dev/sdk/v3"
import { chromium } from "playwright"

interface DirectorySubmissionPayload {
  jobId: string
  directory: string
  businessData: {
    name: string
    address?: string
    phone?: string
    email?: string
    description?: string
    website: string
    services?: string[]
  }
  fieldMappings: {
    [fieldName: string]: {
      selector: string
      value: string
      type: 'text' | 'select' | 'checkbox' | 'radio' | 'textarea'
    }
  }
  submissionUrl: string
}

export const directorySubmissionTask = task({
  id: "directory-submission",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
  },
  run: async (payload: DirectorySubmissionPayload, { ctx }) => {
    const { jobId, directory, businessData, fieldMappings, submissionUrl } = payload

    // Launch browser
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    const page = await context.newPage()

    try {
      // Navigate to submission page
      await page.goto(submissionUrl, { waitUntil: 'networkidle' })

      // Fill form fields using AI-generated mappings
      for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
        try {
          const element = await page.waitForSelector(mapping.selector, { timeout: 5000 })

          switch (mapping.type) {
            case 'text':
            case 'textarea':
              await element.fill(mapping.value)
              break
            case 'select':
              await element.selectOption(mapping.value)
              break
            case 'checkbox':
            case 'radio':
              if (mapping.value === 'true') {
                await element.check()
              }
              break
          }
        } catch (error) {
          ctx.logger.warn(`Failed to fill field ${fieldName}: ${error}`)
          // Continue with other fields
        }
      }

      // Submit form (common patterns)
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Submit Listing")')
      if (submitButton) {
        await submitButton.click()
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 })
      }

      // Capture success/error state
      const success = await page.$('.success, .confirmation, .thank-you, [class*="success"]')
      const error = await page.$('.error, [class*="error"]')

      // Take screenshot for verification
      const screenshot = await page.screenshot({ fullPage: false })

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
      throw new Error(`Directory submission failed for ${directory}: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
})
