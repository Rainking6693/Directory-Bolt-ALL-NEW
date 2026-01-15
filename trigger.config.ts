/**
 * Trigger.dev Configuration
 * 
 * Configuration file for Trigger.dev v3/v4.
 * Requires TRIGGER_API_KEY and TRIGGER_API_URL environment variables.
 */

import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID || "directorybolt",
  ...(process.env.TRIGGER_API_KEY && { apiKey: process.env.TRIGGER_API_KEY }),
})
