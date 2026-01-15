/**
 * Trigger.dev Configuration
 * 
 * Configuration file for Trigger.dev v3/v4.
 * Requires TRIGGER_API_KEY and TRIGGER_API_URL environment variables.
 */

import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID || "directorybolt",
  apiKey: process.env.TRIGGER_API_KEY,
  apiUrl: process.env.TRIGGER_API_URL || "https://api.trigger.dev",
  
  // Directories to include
  dirs: ["./trigger/tasks"],
  
  // Retry configuration
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  
  // Logging
  logLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
  
  // Machine configuration (optional)
  machine: {
    preset: "small-1x", // Can be upgraded for more resources
  },
})
