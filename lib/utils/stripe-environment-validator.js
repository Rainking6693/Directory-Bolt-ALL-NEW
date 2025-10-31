/**
 * Stripe Environment Validator
 * Validates Stripe configuration and environment setup
 */

export function validateStripeEnvironment() {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ]

  const missing = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    console.warn(`Missing Stripe environment variables: ${missing.join(', ')}`)
    return false
  }

  return true
}

export function getStripeKey() {
  return process.env.STRIPE_SECRET_KEY
}

export function getStripePublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET
}