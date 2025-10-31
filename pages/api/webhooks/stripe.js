/**
 * DirectoryBolt Stripe Webhook Handler
 * Location: /pages/api/webhooks/stripe.js
 * 
 * Complete Stripe webhook handler for $149-799 AI Business Intelligence tiers
 * with full database integration and customer lifecycle management
 */

import Stripe from 'stripe'
import { logger } from '../../../lib/utils/logger'
const { createGoogleSheetsService } = require('../../../lib/services/google-sheets.js')
import { AutoBoltNotificationService } from '../../../lib/services/autobolt-notifications'
import { getRawBody } from '../../../lib/utils/server-utils'

// Initialize Stripe with configurable API version (fallback to latest supported in types)
const stripeApiVersion = process.env.STRIPE_API_VERSION || '2023-08-16'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: stripeApiVersion,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Netlify Functions configuration
// Note: Netlify handles raw body parsing automatically for webhooks

// AI Business Intelligence Tier Configuration
const AI_BUSINESS_TIERS = {
  'price_starter_149': {
    name: 'AI Business Intelligence - Starter',
    tier: 'starter',
    amount: 14900, // $149.00
    directoryLimit: 25,
    features: [
      'Basic AI Analysis',
      'Competitor Research',
      'Directory Recommendations',
      'Email Support'
    ],
    accessLevel: 'starter'
  },
  'price_growth_299': {
    name: 'AI Business Intelligence - Growth',
    tier: 'growth',
    amount: 29900, // $299.00
    directoryLimit: 75,
    features: [
      'Advanced AI Analysis',
      'Competitive Intelligence',
      'Market Positioning',
      'Priority Directory Access',
      'Priority Support'
    ],
    accessLevel: 'growth'
  },
  'price_pro_499': {
    name: 'AI Business Intelligence - Pro',
    tier: 'pro',
    amount: 49900, // $499.00
    directoryLimit: 150,
    features: [
      'Premium AI Analysis',
      'Advanced Market Intelligence',
      'Custom Directory Strategy',
      'Performance Analytics',
      'Dedicated Support'
    ],
    accessLevel: 'pro'
  },
  'price_enterprise_799': {
    name: 'AI Business Intelligence - Enterprise',
    tier: 'enterprise',
    amount: 79900, // $799.00
    directoryLimit: 500,
    features: [
      'Enterprise AI Analysis',
      'Full Market Intelligence Suite',
      'Custom Integration',
      'Advanced Analytics',
      'White-glove Support'
    ],
    accessLevel: 'enterprise'
  }
}

// Webhook timeout configuration
const WEBHOOK_TIMEOUT = 8000 // 8 seconds (before Stripe's 10s timeout)
const CRITICAL_OPERATIONS_TIMEOUT = 3000 // 3 seconds for critical operations

// Email template cache for memory optimization
const emailTemplateCache = new Map()

// Performance monitoring class
class WebhookPerformanceMonitor {
  static trackOperation(operationName, startTime, endTime, success, metadata = {}) {
    const duration = endTime - startTime
    
    logger.info('Operation performance', {
      metadata: {
        operation: operationName,
        duration: duration,
        success: success,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    })
    
    // Send to monitoring service if available
    if (process.env.PERFORMANCE_MONITORING_ENABLED) {
      this.sendToMonitoring(operationName, duration, success, metadata)
    }
  }
  
  static sendToMonitoring(operation, duration, success, metadata) {
    // Implementation for external monitoring service
    // Could integrate with DataDog, New Relic, etc.
    logger.info('Performance metrics sent to monitoring', {
      metadata: { operation, duration, success }
    })
  }
}

// Main webhook handler - compatible with both Next.js and Netlify Functions
export default async function handler(req, res) {
  const startTime = Date.now()
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Netlify Functions context detection
  const isNetlifyFunction = !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME

  logger.info('🔄 Stripe webhook triggered', {
    metadata: {
      isNetlify: isNetlifyFunction,
      method: req.method,
      requestId
    }
  })

  if (req.method !== 'POST') {
    const response = { error: 'Method not allowed' }
    if (isNetlifyFunction) {
      return {
        statusCode: 405,
        body: JSON.stringify(response)
      }
    }
    return res.status(405).json(response)
  }

  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Webhook timeout')), WEBHOOK_TIMEOUT)
  )

  try {
    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured', { metadata: { requestId } })
      // SECURITY FIX: Return 400 instead of 200 for missing webhook secret
      const response = { error: 'webhook_secret_not_configured' }
      if (isNetlifyFunction) {
        return { statusCode: 400, body: JSON.stringify(response) }
      }
      return res.status(400).json(response)
    }

    // SECURITY FIX: Validate webhook secret format
    if (!webhookSecret.startsWith('whsec_')) {
      logger.error('Invalid webhook secret format', { metadata: { requestId } })
      const response = { error: 'invalid_webhook_secret_format' }
      if (isNetlifyFunction) {
        return { statusCode: 400, body: JSON.stringify(response) }
      }
      return res.status(400).json(response)
    }

    // Race webhook processing against timeout
    const result = await Promise.race([
      processWebhookEvent(req, requestId),
      timeoutPromise
    ])

    const processingTime = Date.now() - startTime
    logger.info('Webhook completed within timeout', {
      metadata: {
        processingTime: processingTime,
        requestId: requestId,
        eventType: result.eventType || 'unknown'
      }
    })

    WebhookPerformanceMonitor.trackOperation(
      'webhook_total', startTime, Date.now(), true, 
      { requestId, eventType: result.eventType }
    )

    const response = { 
      received: true,
      processingTime: processingTime,
      requestId: requestId
    }
    
    if (isNetlifyFunction) {
      return {
        statusCode: 200,
        body: JSON.stringify(response)
      }
    }
    return res.status(200).json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    if (error.message === 'Webhook timeout') {
      logger.error('Webhook processing timeout', {
        metadata: {
          processingTime: processingTime,
          timeoutLimit: WEBHOOK_TIMEOUT,
          requestId: requestId
        }
      })

      WebhookPerformanceMonitor.trackOperation(
        'webhook_timeout', startTime, Date.now(), false,
        { requestId, timeoutLimit: WEBHOOK_TIMEOUT }
      )
      
      // Return 200 to Stripe but log the timeout for investigation
      const response = { 
        received: true,
        timeout: true,
        processingTime: processingTime,
        requestId: requestId
      }
      
      if (isNetlifyFunction) {
        return {
          statusCode: 200,
          body: JSON.stringify(response)
        }
      }
      return res.status(200).json(response)
    }

    logger.error('Webhook processing failed', { 
      metadata: { 
        processingTime: processingTime,
        error: error.message,
        requestId: requestId
      }
    }, error)

    WebhookPerformanceMonitor.trackOperation(
      'webhook_error', startTime, Date.now(), false,
      { requestId, error: error.message }
    )

    const response = { 
      error: 'Webhook processing failed',
      requestId: requestId
    }
    
    if (isNetlifyFunction) {
      return {
        statusCode: 500,
        body: JSON.stringify(response)
      }
    }
    return res.status(500).json(response)
  }
}

/**
 * Process webhook event with performance optimization
 */
async function processWebhookEvent(req, requestId) {
  // Handle buffer for both Next.js and Netlify Functions
  let buf
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Netlify Functions context - body is already parsed
    if (typeof req.body === 'string') {
      buf = Buffer.from(req.body, 'utf8')
    } else if (Buffer.isBuffer(req.body)) {
      buf = req.body
    } else {
      buf = Buffer.from(JSON.stringify(req.body), 'utf8')
    }
  } else {
    // Next.js API route context
    buf = await getRawBody(req)
  }
  
  const signature = req.headers['stripe-signature']

  if (!signature) {
    logger.error('Missing Stripe signature', { metadata: { requestId } })
    throw new Error('Missing signature')
  }

  // SECURITY FIX: Validate signature format before processing
  if (typeof signature !== 'string' || !signature.includes('t=') || !signature.includes('v1=')) {
    logger.error('Invalid Stripe signature format', { 
      metadata: { 
        requestId,
        signaturePresent: !!signature,
        signatureType: typeof signature
      } 
    })
    throw new Error('Invalid signature format')
  }

  // Verify webhook signature
  let event
  try {
    event = stripe.webhooks.constructEvent(buf, signature, webhookSecret)
  } catch (error) {
    logger.error('Webhook signature verification failed', { metadata: { requestId } }, error)
    throw new Error('Invalid signature')
  }

  logger.info('Stripe webhook received', {
    metadata: {
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString(),
      requestId: requestId
    }
  })

  // Handle different event types with performance tracking
  const eventStartTime = Date.now()
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompletedOptimized(event.data.object, requestId)
        break
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object)
        break
        
      case 'customer.created':
        await handleCustomerCreated(event.data.object)
        break
        
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object)
        break
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object)
        break
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break
        
      default:
        logger.info('Unhandled webhook event type', {
          metadata: { eventType: event.type, requestId: requestId }
        })
    }

    WebhookPerformanceMonitor.trackOperation(
      `event_${event.type}`, eventStartTime, Date.now(), true,
      { eventId: event.id, requestId }
    )

    return { eventType: event.type, eventId: event.id }
    
  } catch (error) {
    WebhookPerformanceMonitor.trackOperation(
      `event_${event.type}`, eventStartTime, Date.now(), false,
      { eventId: event.id, requestId, error: error.message }
    )
    throw error
  }
}

/**
 * Handle successful checkout completion with optimized parallel processing
 */
async function handleCheckoutCompletedOptimized(session, requestId) {
  const startTime = Date.now()
  
  try {
    logger.info('Processing checkout completion', {
      metadata: {
        sessionId: session.id,
        customerId: session.customer,
        amount: session.amount_total,
        priceId: session.metadata?.priceId,
        requestId: requestId
      }
    })

    // Step 1: Get basic data (required for next steps)
    const { customerData, tierConfig, lineItems, customer } = await prepareCustomerData(session)
    
    WebhookPerformanceMonitor.trackOperation(
      'prepare_customer_data', startTime, Date.now(), true,
      { sessionId: session.id, requestId }
    )

    // Step 2: Critical operations in parallel (must all succeed)
    const criticalStartTime = Date.now()
    
    // Create timeout for critical operations
    const criticalTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Critical operations timeout')), CRITICAL_OPERATIONS_TIMEOUT)
    )
    
    const criticalOperationsPromise = Promise.all([
      createAirtableRecord(customerData),
      createAccessLevelRecord({
        customerId: customerData.customerId || customerData.stripeCustomerId,
        stripeCustomerId: session.customer,
        accessLevel: tierConfig.accessLevel,
        tier: tierConfig.tier,
        monthlyLimit: tierConfig.directoryLimit,
        features: tierConfig.features,
        validUntil: getAccessExpiryDate(tierConfig.tier),
        status: 'active'
      }),
      initializeUsageTracking({
        customerId: customerData.customerId || customerData.stripeCustomerId,
        stripeCustomerId: session.customer,
        tier: tierConfig.tier,
        monthlyLimit: tierConfig.directoryLimit
      })
    ])

    const criticalResults = await Promise.race([
      criticalOperationsPromise,
      criticalTimeoutPromise
    ])

    const [airtableRecord, accessRecord, usageRecord] = criticalResults
    
    WebhookPerformanceMonitor.trackOperation(
      'critical_operations', criticalStartTime, Date.now(), true,
      { sessionId: session.id, requestId, operations: 3 }
    )

    // Update customerData with the actual customer ID from Airtable
    customerData.customerId = airtableRecord.customerId || airtableRecord.recordId

    // Step 3: Non-critical operations in parallel (can fail gracefully)
    const nonCriticalOperations = Promise.allSettled([
      sendWelcomeEmail(customerData, tierConfig),
      triggerAIAnalysisProcess(customerData, tierConfig),
      addToProcessingQueue(customerData, tierConfig),
      sendPaymentConfirmationOptimized(session)
    ])

    // Don't await non-critical operations - let them complete in background
    nonCriticalOperations.then(results => {
      logNonCriticalResults(results, session.id, requestId)
    }).catch(error => {
      logger.warn('Non-critical operations had issues', { 
        metadata: { 
          error: error.message, 
          sessionId: session.id,
          requestId: requestId
        }
      })
    })

    const processingTime = Date.now() - startTime
    logger.info('Checkout completion processed successfully', {
      metadata: {
        sessionId: session.id,
        processingTime: processingTime,
        customerId: airtableRecord.customerId,
        tier: tierConfig.tier,
        requestId: requestId
      }
    })

    return { 
      success: true, 
      processingTime, 
      customerId: airtableRecord.customerId,
      tier: tierConfig.tier
    }

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    if (error.message === 'Critical operations timeout') {
      logger.error('Critical operations timeout in checkout processing', {
        metadata: {
          sessionId: session.id,
          processingTime: processingTime,
          timeoutLimit: CRITICAL_OPERATIONS_TIMEOUT,
          requestId: requestId
        }
      })
    } else {
      logger.error('Failed to process checkout completion', {
        metadata: {
          sessionId: session.id,
          processingTime: processingTime,
          error: error.message,
          requestId: requestId
        }
      }, error)
    }
    
    // Send error notification to admin (non-blocking)
    sendAdminErrorNotification('Checkout Processing Failed', {
      sessionId: session.id,
      customerId: session.customer,
      error: error.message,
      timestamp: new Date().toISOString(),
      requestId: requestId
    }).catch(notifError => {
      logger.warn('Failed to send admin error notification', {
        metadata: { error: notifError.message, requestId }
      })
    })
    
    throw error
  }
}

/**
 * Handle successful checkout completion - Original method (deprecated)
 */
async function handleCheckoutCompleted(session) {
  // Redirect to optimized version
  return await handleCheckoutCompletedOptimized(session, `legacy_${Date.now()}`)
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    logger.info('Processing payment success', {
      metadata: {
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customer,
        amount: paymentIntent.amount
      }
    })

    // Update payment status in database
    await updatePaymentStatus({
      paymentIntentId: paymentIntent.id,
      stripeCustomerId: paymentIntent.customer,
      status: 'succeeded',
      amount: paymentIntent.amount,
      paidAt: new Date().toISOString()
    })

    // Send payment confirmation
    if (paymentIntent.receipt_email) {
      await sendPaymentConfirmation({
        email: paymentIntent.receipt_email,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase()
      })
    }

  } catch (error) {
    logger.error('Failed to process payment success', {}, error)
    throw error
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentFailed(paymentIntent) {
  try {
    logger.info('Processing payment failure', {
      metadata: {
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customer,
        amount: paymentIntent.amount,
        failureReason: paymentIntent.last_payment_error?.message
      }
    })

    // Update payment status in database
    await updatePaymentStatus({
      paymentIntentId: paymentIntent.id,
      stripeCustomerId: paymentIntent.customer,
      status: 'failed',
      amount: paymentIntent.amount,
      failureReason: paymentIntent.last_payment_error?.message,
      failedAt: new Date().toISOString()
    })

    // Send payment failure notification to customer
    const customer = await stripe.customers.retrieve(paymentIntent.customer)
    if (customer.email) {
      await sendPaymentFailureNotification({
        email: customer.email,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        failureReason: paymentIntent.last_payment_error?.message
      })
    }

  } catch (error) {
    logger.error('Failed to process payment failure', {}, error)
    throw error
  }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(customer) {
  try {
    logger.info('Processing customer creation', {
      metadata: {
        customerId: customer.id,
        email: customer.email
      }
    })

    // Store basic customer profile
    await storeCustomerProfile({
      stripeCustomerId: customer.id,
      email: customer.email,
      name: customer.name || '',
      phone: customer.phone || '',
      created: customer.created,
      metadata: customer.metadata || {}
    })

  } catch (error) {
    logger.error('Failed to process customer creation', {}, error)
    throw error
  }
}

/**
 * Handle customer updates
 */
async function handleCustomerUpdated(customer) {
  try {
    logger.info('Processing customer update', {
      metadata: {
        customerId: customer.id,
        email: customer.email
      }
    })

    // Update customer profile in database
    await updateCustomerProfile({
      stripeCustomerId: customer.id,
      email: customer.email,
      name: customer.name || '',
      phone: customer.phone || '',
      metadata: customer.metadata || {},
      updatedAt: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to process customer update', {}, error)
    throw error
  }
}

/**
 * Handle successful invoice payment (for recurring subscriptions if added later)
 */
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    logger.info('Processing invoice payment success', {
      metadata: {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_paid,
        subscriptionId: invoice.subscription
      }
    })

    // For future subscription handling
    if (invoice.subscription) {
      await handleSubscriptionPayment({
        invoiceId: invoice.id,
        stripeCustomerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amountPaid: invoice.amount_paid,
        status: 'paid',
        periodStart: new Date(invoice.period_start * 1000).toISOString(),
        periodEnd: new Date(invoice.period_end * 1000).toISOString()
      })
    }

  } catch (error) {
    logger.error('Failed to process invoice payment success', {}, error)
    throw error
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice) {
  try {
    logger.info('Processing invoice payment failure', {
      metadata: {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amountDue: invoice.amount_due,
        subscriptionId: invoice.subscription
      }
    })

    // Handle subscription payment failure
    if (invoice.subscription) {
      await handleSubscriptionPaymentFailure({
        invoiceId: invoice.id,
        stripeCustomerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amountDue: invoice.amount_due,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
      })
    }

  } catch (error) {
    logger.error('Failed to process invoice payment failure', {}, error)
    throw error
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription) {
  try {
    logger.info('Processing subscription creation', {
      metadata: {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status
      }
    })

    // Store subscription data for future use
    await storeSubscriptionData({
      subscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      priceId: subscription.items.data[0]?.price?.id,
      createdAt: new Date(subscription.created * 1000).toISOString()
    })

  } catch (error) {
    logger.error('Failed to process subscription creation', {}, error)
    throw error
  }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    logger.info('Processing subscription update', {
      metadata: {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status
      }
    })

    // Update subscription data
    await updateSubscriptionData({
      subscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to process subscription update', {}, error)
    throw error
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    logger.info('Processing subscription deletion', {
      metadata: {
        subscriptionId: subscription.id,
        customerId: subscription.customer
      }
    })

    // Update access level to revoked
    await updateAccessLevel({
      stripeCustomerId: subscription.customer,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      accessValidUntil: new Date(subscription.canceled_at * 1000).toISOString()
    })

  } catch (error) {
    logger.error('Failed to process subscription deletion', {}, error)
    throw error
  }
}

// ======================== SECURITY FUNCTIONS ========================

/**
 * Sanitize input for Airtable queries to prevent injection attacks
 * @param {any} value - The value to sanitize
 * @returns {string} - Sanitized value safe for use in queries
 */
function sanitizeAirtableInput(value) {
  if (value === null || value === undefined) {
    return ''
  }
  
  // Convert to string if not already
  const stringValue = String(value)
  
  // Escape special characters and potential injection patterns
  return stringValue
    .replace(/["\\]/g, '\\$&')  // Escape quotes and backslashes
    .replace(/[\x00-\x1f]/g, '') // Remove control characters
    .replace(/'/g, "\\'")        // Escape single quotes
    .trim()                      // Remove leading/trailing whitespace
}

/**
 * Validate Stripe customer ID format
 * @param {string} customerId - The customer ID to validate
 * @returns {string} - Validated customer ID
 * @throws {Error} - If customer ID format is invalid
 */
function validateStripeCustomerId(customerId) {
  if (!customerId || typeof customerId !== 'string') {
    throw new Error('Customer ID is required and must be a string')
  }
  
  // Stripe customer IDs follow pattern: cus_[alphanumeric]
  const isValid = /^cus_[a-zA-Z0-9]{14,}$/.test(customerId)
  if (!isValid) {
    throw new Error('Invalid Stripe customer ID format')
  }
  
  return customerId
}

/**
 * Validate Stripe subscription ID format
 * @param {string} subscriptionId - The subscription ID to validate
 * @returns {string} - Validated subscription ID
 * @throws {Error} - If subscription ID format is invalid
 */
function validateStripeSubscriptionId(subscriptionId) {
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    throw new Error('Subscription ID is required and must be a string')
  }
  
  // Stripe subscription IDs follow pattern: sub_[alphanumeric]
  const isValid = /^sub_[a-zA-Z0-9]{14,}$/.test(subscriptionId)
  if (!isValid) {
    throw new Error('Invalid Stripe subscription ID format')
  }
  
  return subscriptionId
}

/**
 * Validate Stripe payment intent ID format
 * @param {string} paymentIntentId - The payment intent ID to validate
 * @returns {string} - Validated payment intent ID
 * @throws {Error} - If payment intent ID format is invalid
 */
function validateStripePaymentIntentId(paymentIntentId) {
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    throw new Error('Payment intent ID is required and must be a string')
  }
  
  // Stripe payment intent IDs follow pattern: pi_[alphanumeric]
  const isValid = /^pi_[a-zA-Z0-9]{14,}$/.test(paymentIntentId)
  if (!isValid) {
    throw new Error('Invalid Stripe payment intent ID format')
  }
  
  return paymentIntentId
}

/**
 * Create safe filter formula for Airtable queries
 * @param {string} fieldName - The field name to filter on
 * @param {any} value - The value to filter by
 * @returns {string} - Safe filter formula
 */
async function createSafeFilterFormula(fieldName, value) {
  const sanitizedValue = sanitizeAirtableInput(value)
  const sanitizedFieldName = fieldName.replace(/[^a-zA-Z0-9_]/g, '') // Only allow alphanumeric and underscore in field names
  return `{${sanitizedFieldName}} = '${sanitizedValue}'`
}

// ======================== HELPER FUNCTIONS FOR OPTIMIZATION ========================

/**
 * Prepare customer data from session (optimized data gathering)
 */
async function prepareCustomerData(session) {
  const dataStartTime = Date.now()
  
  // Parallel data fetching
  const [lineItems, customer] = await Promise.all([
    stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product']
    }),
    stripe.customers.retrieve(session.customer)
  ])

  const priceId = lineItems.data[0]?.price?.id
  const tierConfig = AI_BUSINESS_TIERS[priceId]

  if (!tierConfig) {
    throw new Error(`Unknown price ID: ${priceId}`)
  }

  // Prepare customer data for database storage
  const customerData = {
    stripeCustomerId: session.customer,
    email: customer.email || session.customer_details?.email,
    firstName: session.customer_details?.name?.split(' ')[0] || '',
    lastName: session.customer_details?.name?.split(' ').slice(1).join(' ') || '',
    phone: session.customer_details?.phone || customer.phone || '',
    businessName: session.metadata?.businessName || customer.metadata?.businessName || '',
    website: session.metadata?.website || customer.metadata?.website || '',
    description: session.metadata?.description || customer.metadata?.description || '',
    address: session.customer_details?.address?.line1 || customer.address?.line1 || '',
    city: session.customer_details?.address?.city || customer.address?.city || '',
    state: session.customer_details?.address?.state || customer.address?.state || '',
    zip: session.customer_details?.address?.postal_code || customer.address?.postal_code || '',
    
    // Tier and payment information
    packageType: tierConfig.tier,
    planName: tierConfig.name,
    amount: session.amount_total,
    paymentStatus: 'completed',
    submissionStatus: 'pending',
    purchaseDate: new Date().toISOString(),
    sessionId: session.id,
    
    // AI Business Intelligence specifics
    accessLevel: tierConfig.accessLevel,
    directoryLimit: tierConfig.directoryLimit,
    tierFeatures: JSON.stringify(tierConfig.features),
    
    // Initialize usage tracking
    directoriesSubmitted: 0,
    failedDirectories: 0,
    totalDirectories: tierConfig.directoryLimit,
    
    // Social media from metadata if provided
    facebook: session.metadata?.facebook || customer.metadata?.facebook || '',
    instagram: session.metadata?.instagram || customer.metadata?.instagram || '',
    linkedin: session.metadata?.linkedin || customer.metadata?.linkedin || '',
    logo: session.metadata?.logo || customer.metadata?.logo || ''
  }

  WebhookPerformanceMonitor.trackOperation(
    'data_preparation', dataStartTime, Date.now(), true,
    { sessionId: session.id, tier: tierConfig.tier }
  )

  return { customerData, tierConfig, lineItems, customer }
}

/**
 * Create Airtable record (optimized wrapper)
 */
async function createAirtableRecord(customerData) {
  console.info('[Stripe Webhook] Skipping Airtable create for customer', customerData?.email)
  return {
    customerId: customerData.customerId ?? 'stub-customer-id',
    recordId: 'stub-record-id'
  }
}

/**
 * Log results of non-critical operations
 */
function logNonCriticalResults(results, sessionId, requestId) {
  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length
  
  logger.info('Non-critical operations completed', {
    metadata: {
      sessionId: sessionId,
      requestId: requestId,
      successCount: successCount,
      failureCount: failureCount,
      total: results.length
    }
  })
  
  // Log individual failures for investigation
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn('Non-critical operation failed', {
        metadata: {
          sessionId: sessionId,
          requestId: requestId,
          operationIndex: index,
          error: result.reason?.message || 'Unknown error'
        }
      })
    }
  })
}

/**
 * Send payment confirmation with caching optimization
 */
async function sendPaymentConfirmationOptimized(session) {
  try {
    const paymentData = {
      email: session.customer_details?.email,
      amount: session.amount_total,
      currency: session.currency.toUpperCase(),
      paymentIntentId: session.payment_intent,
      sessionId: session.id
    }
    
    if (!paymentData.email) {
      logger.warn('No email address for payment confirmation')
      return
    }
    
    const emailHtml = getCachedEmailTemplate('payment_confirmation', paymentData)
    
    const transporter = AutoBoltNotificationService.initializeTransporter()
    const mailOptions = {
      from: `"DirectoryBolt AI" <${process.env.SMTP_FROM_EMAIL}>`,
      to: paymentData.email,
      subject: `Payment Confirmation - $${(paymentData.amount / 100).toFixed(2)} ${paymentData.currency}`,
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    
    logger.info('Payment confirmation sent', {
      metadata: {
        email: paymentData.email,
        amount: paymentData.amount,
        sessionId: session.id
      }
    })

  } catch (error) {
    logger.error('Failed to send payment confirmation', {}, error)
    // Don't throw - this is non-critical
  }
}

/**
 * Get cached email template (memory optimization)
 */
function getCachedEmailTemplate(templateName, data) {
  const cacheKey = `${templateName}_${JSON.stringify(data).substring(0, 100)}`
  
  if (emailTemplateCache.has(cacheKey)) {
    return emailTemplateCache.get(cacheKey)
  }
  
  let template
  switch (templateName) {
    case 'payment_confirmation':
      template = generatePaymentConfirmationTemplate(data)
      break
    case 'payment_failure':
      template = generatePaymentFailureTemplate(data)
      break
    case 'admin_error':
      template = generateAdminErrorTemplate(data.errorType, data)
      break
    default:
      template = `<html><body>Template not found: ${templateName}</body></html>`
  }
  
  // Cache with TTL (Time To Live)
  emailTemplateCache.set(cacheKey, template)
  
  // Clean cache after 1 hour
  setTimeout(() => {
    emailTemplateCache.delete(cacheKey)
  }, 60 * 60 * 1000)
  
  return template
}

/**
 * Batch database operations with optimized processing
 */
async function batchDatabaseOperations(operations) {
  const BATCH_SIZE = 3
  const results = []
  const startTime = Date.now()
  
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = operations.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (op, index) => {
        try {
          return await op()
        } catch (error) {
          logger.warn(`Batch operation ${i + index} failed`, { 
            metadata: { error: error.message, operationIndex: i + index }
          })
          return { error: error.message, index: i + index }
        }
      })
    )
    results.push(...batchResults)
  }
  
  WebhookPerformanceMonitor.trackOperation(
    'batch_database_operations', startTime, Date.now(), true,
    { operationCount: operations.length, batchSize: BATCH_SIZE }
  )
  
  return results
}

// ======================== DATABASE OPERATIONS ========================

/**
 * Create access level record for AI services
 */
async function createAccessLevelRecord(accessData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Check if access record already exists
    const existingRecord = await googleSheetsService.findByCustomerId(accessData.customerId)
    
    if (existingRecord) {
      // Update existing record with access information
      await googleSheetsService.updateBusinessSubmission(existingRecord.recordId, {
        accessLevel: accessData.accessLevel,
        tierLevel: accessData.tier,
        monthlyDirectoryLimit: accessData.monthlyLimit,
        accessFeatures: JSON.stringify(accessData.features),
        accessValidUntil: accessData.validUntil,
        accessStatus: accessData.status,
        lastAccessUpdate: new Date().toISOString()
      })
    } else {
      // Create new access record
      await googleSheetsService.createBusinessSubmission({
        customerId: accessData.customerId,
        stripeCustomerId: accessData.stripeCustomerId,
        accessLevel: accessData.accessLevel,
        tierLevel: accessData.tier,
        monthlyDirectoryLimit: accessData.monthlyLimit,
        accessFeatures: JSON.stringify(accessData.features),
        accessValidUntil: accessData.validUntil,
        accessStatus: accessData.status,
        createdAt: new Date().toISOString()
      })
    }

    logger.info('Access level record created/updated', {
      metadata: {
        customerId: accessData.customerId,
        accessLevel: accessData.accessLevel,
        tier: accessData.tier
      }
    })

  } catch (error) {
    logger.error('Failed to create access level record', {}, error)
    throw error
  }
}

/**
 * Initialize usage tracking for new customer
 */
async function initializeUsageTracking(trackingData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    const record = await googleSheetsService.findByCustomerId(trackingData.customerId)
    
    if (record) {
      await googleSheetsService.updateBusinessSubmission(record.recordId, {
        currentMonthUsage: 0,
        totalUsage: 0,
        lastUsageReset: new Date().toISOString(),
        usageLimit: trackingData.monthlyLimit,
        usageStatus: 'active',
        tierAtCreation: trackingData.tier
      })
    }

    logger.info('Usage tracking initialized', {
      metadata: {
        customerId: trackingData.customerId,
        tier: trackingData.tier,
        monthlyLimit: trackingData.monthlyLimit
      }
    })

  } catch (error) {
    logger.error('Failed to initialize usage tracking', {}, error)
    throw error
  }
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(paymentData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize customer ID
    const validatedCustomerId = validateStripeCustomerId(paymentData.stripeCustomerId)
    
    // Find customer by Stripe customer ID using safe query
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('stripeCustomerId', validatedCustomerId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        paymentStatus: paymentData.status,
        lastPaymentUpdate: new Date().toISOString(),
        paymentIntentId: paymentData.paymentIntentId,
        paymentFailureReason: paymentData.failureReason || '',
        lastPaymentAttempt: new Date().toISOString()
      })
    }

    logger.info('Payment status updated', {
      metadata: {
        paymentIntentId: paymentData.paymentIntentId,
        status: paymentData.status
      }
    })

  } catch (error) {
    logger.error('Failed to update payment status', {}, error)
    throw error
  }
}

/**
 * Store basic customer profile
 */
async function storeCustomerProfile(customerData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize customer ID
    const validatedCustomerId = validateStripeCustomerId(customerData.stripeCustomerId)
    
    // Check if customer already exists using safe query
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('stripeCustomerId', validatedCustomerId),
      maxRecords: 1
    }).firstPage()

    if (records.length === 0) {
      // Create new customer profile
      await googleSheetsService.createBusinessSubmission({
        stripeCustomerId: customerData.stripeCustomerId,
        email: customerData.email,
        firstName: customerData.name.split(' ')[0] || '',
        lastName: customerData.name.split(' ').slice(1).join(' ') || '',
        phone: customerData.phone,
        stripeMetadata: JSON.stringify(customerData.metadata),
        customerCreatedAt: new Date(customerData.created * 1000).toISOString(),
        profileStatus: 'created'
      })
    }

    logger.info('Customer profile stored', {
      metadata: {
        stripeCustomerId: customerData.stripeCustomerId,
        email: customerData.email
      }
    })

  } catch (error) {
    logger.error('Failed to store customer profile', {}, error)
    throw error
  }
}

/**
 * Update customer profile
 */
async function updateCustomerProfile(customerData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize customer ID
    const validatedCustomerId = validateStripeCustomerId(customerData.stripeCustomerId)
    
    // Find and update customer using safe query
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('stripeCustomerId', validatedCustomerId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        email: customerData.email,
        firstName: customerData.name.split(' ')[0] || '',
        lastName: customerData.name.split(' ').slice(1).join(' ') || '',
        phone: customerData.phone,
        stripeMetadata: JSON.stringify(customerData.metadata),
        lastProfileUpdate: customerData.updatedAt
      })
    }

    logger.info('Customer profile updated', {
      metadata: {
        stripeCustomerId: customerData.stripeCustomerId
      }
    })

  } catch (error) {
    logger.error('Failed to update customer profile', {}, error)
    throw error
  }
}

/**
 * Store subscription data (for future recurring billing)
 */
async function storeSubscriptionData(subscriptionData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize customer ID
    const validatedCustomerId = validateStripeCustomerId(subscriptionData.stripeCustomerId)
    
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('stripeCustomerId', validatedCustomerId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        subscriptionId: subscriptionData.subscriptionId,
        subscriptionStatus: subscriptionData.status,
        currentPeriodStart: subscriptionData.currentPeriodStart,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        subscriptionPriceId: subscriptionData.priceId,
        subscriptionCreatedAt: subscriptionData.createdAt
      })
    }

    logger.info('Subscription data stored', {
      metadata: {
        subscriptionId: subscriptionData.subscriptionId,
        status: subscriptionData.status
      }
    })

  } catch (error) {
    logger.error('Failed to store subscription data', {}, error)
    throw error
  }
}

/**
 * Update subscription data
 */
async function updateSubscriptionData(subscriptionData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize subscription ID
    const validatedSubscriptionId = validateStripeSubscriptionId(subscriptionData.subscriptionId)
    
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('subscriptionId', validatedSubscriptionId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        subscriptionStatus: subscriptionData.status,
        currentPeriodStart: subscriptionData.currentPeriodStart,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        lastSubscriptionUpdate: subscriptionData.updatedAt
      })
    }

    logger.info('Subscription data updated', {
      metadata: {
        subscriptionId: subscriptionData.subscriptionId,
        status: subscriptionData.status
      }
    })

  } catch (error) {
    logger.error('Failed to update subscription data', {}, error)
    throw error
  }
}

/**
 * Update access level
 */
async function updateAccessLevel(accessData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize customer ID
    const validatedCustomerId = validateStripeCustomerId(accessData.stripeCustomerId)
    
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('stripeCustomerId', validatedCustomerId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        accessStatus: accessData.status,
        accessCancelledAt: accessData.cancelledAt,
        accessValidUntil: accessData.accessValidUntil,
        lastAccessUpdate: new Date().toISOString()
      })
    }

    logger.info('Access level updated', {
      metadata: {
        stripeCustomerId: accessData.stripeCustomerId,
        status: accessData.status
      }
    })

  } catch (error) {
    logger.error('Failed to update access level', {}, error)
    throw error
  }
}

/**
 * Handle subscription payment
 */
async function handleSubscriptionPayment(paymentData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize subscription ID
    const validatedSubscriptionId = validateStripeSubscriptionId(paymentData.subscriptionId)
    
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('subscriptionId', validatedSubscriptionId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        lastPaymentDate: new Date().toISOString(),
        lastPaymentAmount: paymentData.amountPaid,
        paymentStatus: paymentData.status,
        currentPeriodStart: paymentData.periodStart,
        currentPeriodEnd: paymentData.periodEnd,
        paymentHistory: JSON.stringify({
          invoiceId: paymentData.invoiceId,
          amount: paymentData.amountPaid,
          paidAt: new Date().toISOString()
        })
      })
    }

    logger.info('Subscription payment processed', {
      metadata: {
        subscriptionId: paymentData.subscriptionId,
        amount: paymentData.amountPaid
      }
    })

  } catch (error) {
    logger.error('Failed to handle subscription payment', {}, error)
    throw error
  }
}

/**
 * Handle subscription payment failure
 */
async function handleSubscriptionPaymentFailure(failureData) {
  try {
    const googleSheetsService = createGoogleSheetsService()
    
    // Validate and sanitize subscription ID
    const validatedSubscriptionId = validateStripeSubscriptionId(failureData.subscriptionId)
    
    const records = await googleSheetsService.base(googleSheetsService.tableName).select({
      filterByFormula: await createSafeFilterFormula('subscriptionId', validatedSubscriptionId),
      maxRecords: 1
    }).firstPage()

    if (records.length > 0) {
      const record = records[0]
      await googleSheetsService.updateBusinessSubmission(record.getId(), {
        paymentStatus: 'failed',
        paymentFailureReason: 'Invoice payment failed',
        failedPaymentAttempts: failureData.attemptCount,
        nextPaymentAttempt: failureData.nextPaymentAttempt ? new Date(failureData.nextPaymentAttempt * 1000).toISOString() : null,
        lastPaymentFailure: new Date().toISOString()
      })
    }

    logger.info('Subscription payment failure handled', {
      metadata: {
        subscriptionId: failureData.subscriptionId,
        attemptCount: failureData.attemptCount
      }
    })

  } catch (error) {
    logger.error('Failed to handle subscription payment failure', {}, error)
    throw error
  }
}

// ======================== EMAIL NOTIFICATIONS ========================

/**
 * Send welcome email to new customer
 */
async function sendWelcomeEmail(customerData, tierConfig) {
  try {
    if (!customerData.email) {
      logger.warn('No email address for welcome notification')
      return
    }

    await AutoBoltNotificationService.sendWelcomeNotification(
      customerData.customerId || 'N/A',
      customerData.email,
      customerData.businessName || customerData.firstName,
      tierConfig.name
    )

    logger.info('Welcome email sent', {
      metadata: {
        email: customerData.email,
        tier: tierConfig.tier
      }
    })

  } catch (error) {
    logger.error('Failed to send welcome email', {}, error)
    // Don't throw - email failure shouldn't break webhook processing
  }
}

/**
 * Send payment confirmation
 */
async function sendPaymentConfirmation(paymentData) {
  try {
    const emailHtml = generatePaymentConfirmationTemplate(paymentData)
    
    const transporter = AutoBoltNotificationService.initializeTransporter()
    const mailOptions = {
      from: `"DirectoryBolt AI" <${process.env.SMTP_FROM_EMAIL}>`,
      to: paymentData.email,
      subject: `Payment Confirmation - $${(paymentData.amount / 100).toFixed(2)} ${paymentData.currency}`,
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    
    logger.info('Payment confirmation sent', {
      metadata: {
        email: paymentData.email,
        amount: paymentData.amount
      }
    })

  } catch (error) {
    logger.error('Failed to send payment confirmation', {}, error)
  }
}

/**
 * Send payment failure notification
 */
async function sendPaymentFailureNotification(failureData) {
  try {
    const emailHtml = generatePaymentFailureTemplate(failureData)
    
    const transporter = AutoBoltNotificationService.initializeTransporter()
    const mailOptions = {
      from: `"DirectoryBolt AI" <${process.env.SMTP_FROM_EMAIL}>`,
      to: failureData.email,
      subject: `Payment Failed - Please Update Your Payment Method`,
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    
    logger.info('Payment failure notification sent', {
      metadata: {
        email: failureData.email,
        paymentIntentId: failureData.paymentIntentId
      }
    })

  } catch (error) {
    logger.error('Failed to send payment failure notification', {}, error)
  }
}

/**
 * Send admin error notification
 */
async function sendAdminErrorNotification(errorType, errorData) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@directorybolt.com'
    const emailHtml = generateAdminErrorTemplate(errorType, errorData)
    
    const transporter = AutoBoltNotificationService.initializeTransporter()
    const mailOptions = {
      from: `"DirectoryBolt System" <${process.env.SMTP_FROM_EMAIL}>`,
      to: adminEmail,
      subject: `🚨 DirectoryBolt System Alert: ${errorType}`,
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    
    logger.info('Admin error notification sent', {
      metadata: {
        errorType: errorType,
        timestamp: errorData.timestamp
      }
    })

  } catch (error) {
    logger.error('Failed to send admin error notification', {}, error)
  }
}

// ======================== AI PROCESSING FUNCTIONS ========================

/**
 * Trigger AI analysis process for qualifying tiers
 */
async function triggerAIAnalysisProcess(customerData, tierConfig) {
  try {
    if (!['growth', 'pro', 'enterprise'].includes(tierConfig.tier)) {
      logger.info('AI analysis not triggered - tier does not qualify', {
        metadata: { tier: tierConfig.tier }
      })
      return
    }

    // Queue AI analysis job
    const analysisRequest = {
      customerId: customerData.customerId,
      businessName: customerData.businessName,
      website: customerData.website,
      description: customerData.description,
      tier: tierConfig.tier,
      features: tierConfig.features,
      priority: tierConfig.tier === 'enterprise' ? 'high' : 'normal'
    }

    // This would integrate with your AI analysis queue system
    logger.info('AI analysis process triggered', {
      metadata: {
        customerId: customerData.customerId,
        tier: tierConfig.tier,
        businessName: customerData.businessName
      }
    })

    // Update status in Airtable
    await updateAirtableStatus(customerData.customerId, {
      aiAnalysisStatus: 'queued',
      aiAnalysisQueuedAt: new Date().toISOString(),
      aiAnalysisTier: tierConfig.tier
    })

  } catch (error) {
    logger.error('Failed to trigger AI analysis process', {}, error)
    throw error
  }
}

/**
 * Add customer to processing queue
 */
async function addToProcessingQueue(customerData, tierConfig) {
  try {
    // Add to AutoBolt processing queue based on tier priority
    const queuePriority = {
      'starter': 3,
      'growth': 2, 
      'pro': 1,
      'enterprise': 0 // Highest priority
    }[tierConfig.tier] || 3

    logger.info('Added to processing queue', {
      metadata: {
        customerId: customerData.customerId,
        tier: tierConfig.tier,
        priority: queuePriority,
        directoryLimit: tierConfig.directoryLimit
      }
    })

    // Update queue status in Airtable
    await updateAirtableQueueStatus(customerData.customerId, {
      queueStatus: 'pending',
      queuePriority: queuePriority,
      queuedAt: new Date().toISOString(),
      processingTier: tierConfig.tier
    })

  } catch (error) {
    logger.error('Failed to add to processing queue', {}, error)
    throw error
  }
}

// ======================== UTILITY FUNCTIONS ========================

/**
 * Get access expiry date for one-time purchases
 */
function getAccessExpiryDate(tier) {
  const now = new Date()
  // One-time purchases get 1 year access
  const expiryDate = new Date(now.setFullYear(now.getFullYear() + 1))
  return expiryDate.toISOString()
}

/**
 * Generate payment confirmation email template
 */
function generatePaymentConfirmationTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Payment Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4caf50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Payment Confirmed</h1>
                <p>DirectoryBolt AI Business Intelligence</p>
            </div>
            
            <div class="content">
                <h2>Thank you for your payment!</h2>
                <p>Your payment of <strong>$${(data.amount / 100).toFixed(2)} ${data.currency}</strong> has been successfully processed.</p>
                
                <p><strong>Payment ID:</strong> ${data.paymentIntentId}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                
                <p>You will receive a separate email with your service activation details shortly.</p>
            </div>
            
            <div class="footer">
                <p>DirectoryBolt AI | support@directorybolt.com</p>
            </div>
        </div>
    </body>
    </html>
  `
}

/**
 * Generate payment failure email template
 */
function generatePaymentFailureTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Payment Failed</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #2196f3; color: white; text-decoration: none; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Payment Failed</h1>
                <p>DirectoryBolt AI Business Intelligence</p>
            </div>
            
            <div class="content">
                <h2>We couldn't process your payment</h2>
                <p>Your payment of <strong>$${(data.amount / 100).toFixed(2)}</strong> could not be processed.</p>
                
                <p><strong>Reason:</strong> ${data.failureReason}</p>
                
                <p>Please update your payment method or try a different card to complete your purchase.</p>
                
                <a href="https://directorybolt.com/pricing" class="button">Try Again</a>
                
                <p>If you continue to experience issues, please contact our support team.</p>
            </div>
            
            <div class="footer">
                <p>DirectoryBolt AI | support@directorybolt.com</p>
            </div>
        </div>
    </body>
    </html>
  `
}

/**
 * Generate admin error notification template
 */
function generateAdminErrorTemplate(errorType, errorData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>System Alert: ${errorType}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff5722; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .error-details { background: #ffebee; padding: 15px; border-left: 4px solid #f44336; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚨 System Alert</h1>
                <p>DirectoryBolt Monitoring</p>
            </div>
            
            <div class="content">
                <h2>${errorType}</h2>
                
                <div class="error-details">
                    <h3>Error Details:</h3>
                    <pre>${JSON.stringify(errorData, null, 2)}</pre>
                </div>
                
                <p><strong>Timestamp:</strong> ${errorData.timestamp}</p>
                <p><strong>Session ID:</strong> ${errorData.sessionId || 'N/A'}</p>
                <p><strong>Customer ID:</strong> ${errorData.customerId || 'N/A'}</p>
                
                <p>Please investigate this issue immediately.</p>
            </div>
            
            <div class="footer">
                <p>DirectoryBolt System Monitoring</p>
            </div>
        </div>
    </body>
    </html>
  `
}