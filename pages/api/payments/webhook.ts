// 🔒 JORDAN'S STRIPE WEBHOOK - Secure payment processing with idempotency
// POST /api/payments/webhook - Handle Stripe webhook events for payment processing

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, ExternalServiceError } from '../../../lib/utils/errors'
import { verifyWebhookSignature, handleStripeError } from '../../../lib/utils/stripe-client'
// Removed broken import: stripe-environment-validator
import { log } from '../../../lib/utils/logger'
import type { Payment, User } from '../../../lib/database/schema'

// Initialize configuration safely at runtime
let config: any = null

function getConfigSafely() {
  if (!config) {
    config = {
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000'
    }
  }
  return config
}

// Webhook event tracking for idempotency (use Redis in production)
const processedEvents = new Map<string, { timestamp: number; status: 'processed' | 'failed' }>()
const IDEMPOTENCY_WINDOW = 24 * 60 * 60 * 1000 // 24 hours

interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
}

interface WebhookResponse {
  success: true
  message: string
  event_id: string
  processed: boolean
}

// 🔒 SECURITY: Secure CORS configuration for webhook endpoints
function getWebhookCorsHeaders(req: NextApiRequest) {
  // Webhooks are called by Stripe servers, so we need to allow Stripe origins
  const allowedOrigins = [
    'https://api.stripe.com',
    'https://hooks.stripe.com'
  ];
  
  // For development, also allow localhost for testing
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
  }
    
  const origin = req.headers.origin;
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }
  
  return corsHeaders;
}

// 🔒 SECURITY: Apply CORS headers to response
function applyCorsHeaders(res: NextApiResponse, corsHeaders: Record<string, string>) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse | any>
) {
  // Prevent execution during build time - Next.js static generation fix
  if (!req || !res || typeof res.status !== 'function') {
    console.warn('API route called during build time - skipping execution')
    return { notFound: true }
  }
  
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 🔒 SECURITY FIX: Apply secure CORS headers for webhooks (CORS-007)
  const corsHeaders = getWebhookCorsHeaders(req);
  applyCorsHeaders(res, corsHeaders);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method !== 'POST') {
      try {
        res.setHeader('Allow', ['POST'])
      } catch (headerError) {
        console.warn('Unable to set headers during build time:', headerError instanceof Error ? headerError.message : 'Unknown error')
      }
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }
    
    await handleWebhook(req, res, requestId)
    
  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    console.error('Webhook processing failed:', errorResponse)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleWebhook(
  req: NextApiRequest,
  res: NextApiResponse,
  _requestId: string
) {
  const signature = req.headers['stripe-signature'] as string
  
  if (!signature) {
    throw new ExternalServiceError('Stripe', 'Missing Stripe signature')
  }
  
  // Verify webhook signature
  const event = verifyWebhookSignatureInternal(req.body, signature)
  
  // Check idempotency - prevent duplicate processing
  const existingEvent = processedEvents.get(event.id)
  if (existingEvent && (Date.now() - existingEvent.timestamp) < IDEMPOTENCY_WINDOW) {
    console.log(`⚡ Webhook event ${event.id} already processed, skipping`)
    return res.status(200).json({
      success: true,
      message: 'Event already processed',
      event_id: event.id,
      processed: true
    })
  }
  
  console.log(`⚡ Processing Stripe webhook: ${event.type} (${event.id})`)
  
  try {
    // Process the event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event)
        break
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event)
        break
        
      case 'invoice.payment_succeeded':
        await handleSubscriptionPayment(event)
        break
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event)
        break
        
      default:
        console.log(`⚠️ Unhandled webhook event type: ${event.type}`)
        break
    }
    
    // Mark event as processed
    processedEvents.set(event.id, { timestamp: Date.now(), status: 'processed' })
    
    const response: WebhookResponse = {
      success: true,
      message: `Event ${event.type} processed successfully`,
      event_id: event.id,
      processed: true
    }
    
    res.status(200).json(response)
    
  } catch (error) {
    console.error(`❌ Failed to process webhook event ${event.id}:`, error)
    
    // Mark event as failed
    processedEvents.set(event.id, { timestamp: Date.now(), status: 'failed' })
    
    // Log webhook processing failure
    await logWebhookFailure(event.id, event.type, error instanceof Error ? error.message : 'Unknown error')
    
    throw error
  }
}

// Webhook signature verification using our enhanced system
function verifyWebhookSignatureInternal(body: any, signature: string): StripeWebhookEvent {
  try {
    // Use our centralized webhook verification
    return verifyWebhookSignature(body, signature) as StripeWebhookEvent
  } catch (error) {
    log.error('Webhook signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      hasSignature: !!signature,
      hasWebhookSecret: !!(getConfigSafely()?.webhookSecret)
    } as any)
    
    throw new ExternalServiceError('Stripe', 'Webhook signature verification failed')
  }
}

// ========== CRITICAL ERROR RECOVERY IMPLEMENTATIONS ==========

// Utility functions for error recovery
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function createErrorRecoveryLogger(operation: string, transactionId: string) {
  return {
    logRecoveryAttempt: (attempt: number, error: Error) => {
      log.warn(`Error recovery attempt ${attempt} for ${operation}`, {
        operation: operation,
        transactionId: transactionId,
        attempt: attempt,
        error: error.message,
        timestamp: new Date().toISOString()
      } as any)
    },
    
    logRecoverySuccess: (attempt: number) => {
      log.info(`Error recovery successful for ${operation} after ${attempt} attempts`, {
        operation: operation,
        transactionId: transactionId,
        finalAttempt: attempt
      } as any)
    },
    
    logRecoveryFailure: (totalAttempts: number, finalError: Error) => {
      log.error(`Error recovery failed for ${operation} after ${totalAttempts} attempts`, {
        operation: operation,
        transactionId: transactionId,
        totalAttempts: totalAttempts,
        finalError: finalError.message
      } as any, finalError)
    }
  }
}

// Payment processing with retry logic
async function processPaymentWithRetry(paymentData: any, maxRetries: number = 3): Promise<any> {
  const transactionId = generateTransactionId()
  const logger = createErrorRecoveryLogger('payment_processing', transactionId)
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await processPayment(paymentData)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        // Final attempt failed - implement recovery strategy
        await handlePaymentProcessingFailure(paymentData, err)
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      // Exponential backoff between retries
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

// Database operations with retry logic
async function createCustomerRecordWithRetry(session: any, transactionId: string): Promise<any> {
  const logger = createErrorRecoveryLogger('create_customer_record', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const customerRecord = await createCustomerRecord(session)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return customerRecord
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

async function createAccessLevelWithRetry(customerRecord: any, transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('create_access_level', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await createAccessLevel(customerRecord)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

async function initializeUsageTrackingWithRetry(customerRecord: any, transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('initialize_usage_tracking', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await initializeUsageTracking(customerRecord)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

// Graceful degradation for non-critical operations
async function sendNotificationsWithGracefulFailure(customerData: any): Promise<void> {
  try {
    await sendWelcomeEmail(customerData.email, customerData.tier)
    log.info('Welcome email sent successfully', {
      customerId: customerData.customerId,
      email: customerData.email
    } as any)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.warn('Welcome email failed - customer access not affected', {
      customerId: customerData.customerId,
      email: customerData.email,
      error: err.message
    } as any)
    
    // Queue email for retry later
    await queueEmailForRetry('welcome', customerData, err)
  }
}

async function triggerAIProcessingWithGracefulFailure(customerData: any): Promise<void> {
  try {
    if (['growth', 'pro', 'enterprise'].includes(customerData.tier)) {
      await triggerAIAnalysisProcess(customerData)
      log.info('AI processing triggered successfully', {
        customerId: customerData.customerId,
        tier: customerData.tier
      } as any)
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.warn('AI processing trigger failed - customer access not affected', {
      customerId: customerData.customerId,
      tier: customerData.tier,
      error: err.message
    } as any)
    
    // Queue AI processing for retry
    await queueAIProcessingForRetry(customerData, err)
  }
}

// Payment failure recovery strategy
async function handlePaymentProcessingFailure(paymentData: any, error: Error): Promise<void> {
  const failureRecord = {
    transactionId: generateTransactionId(),
    customerId: paymentData.customerId,
    sessionId: paymentData.sessionId,
    failureReason: error.message,
    failureTimestamp: new Date().toISOString(),
    recoveryStatus: 'pending',
    attemptCount: paymentData.attemptCount || 1
  }
  
  // Store failure record for manual recovery
  await storePaymentFailureRecord(failureRecord)
  
  // Send immediate notification to admin for manual intervention
  await sendUrgentAdminAlert('CRITICAL: Payment Processing Failure', {
    customerId: paymentData.customerId,
    sessionId: paymentData.sessionId,
    amount: paymentData.amount,
    error: error.message,
    recoveryInstructions: 'Manual review required - customer may need access granted manually'
  })
  
  // Send customer notification about processing delay
  await sendCustomerProcessingDelayNotification(paymentData.customerEmail, {
    sessionId: paymentData.sessionId,
    expectedResolution: '24 hours',
    supportContact: 'support@directorybolt.com'
  })
}

// Comprehensive error recovery for checkout completion
async function handleCheckoutCompletedWithRecovery(session: any): Promise<void> {
  const transactionId = generateTransactionId()
  
  try {
    // Step 1: Create customer record
    const customerRecord = await createCustomerRecordWithRetry(session, transactionId)
    
    // Step 2: Create access level record  
    await createAccessLevelWithRetry(customerRecord, transactionId)
    
    // Step 3: Initialize usage tracking
    await initializeUsageTrackingWithRetry(customerRecord, transactionId)
    
    // Step 4: Send notifications (non-critical - don't fail on email errors)
    await sendNotificationsWithGracefulFailure(customerRecord)
    
    // Step 5: Trigger AI processing (non-critical)
    await triggerAIProcessingWithGracefulFailure(customerRecord)
    
    log.info('Checkout processing completed successfully', {
      transactionId: transactionId,
      customerId: customerRecord.customerId
    } as any)
    
  } catch (error) {
    // Implement comprehensive error recovery
    const err = error instanceof Error ? error : new Error(String(error))
    await handleCheckoutProcessingFailure(session, transactionId, err)
    throw err
  }
}

async function handleCheckoutProcessingFailure(session: any, transactionId: string, error: Error): Promise<void> {
  const failureRecord = {
    transactionId: transactionId,
    sessionId: session.id,
    customerId: session.metadata?.user_id,
    customerEmail: session.customer_email,
    failureReason: error.message,
    failureTimestamp: new Date().toISOString(),
    recoveryStatus: 'pending',
    paymentAmount: session.amount_total,
    currency: session.currency
  }
  
  // Store comprehensive failure record
  await storeCheckoutFailureRecord(failureRecord)
  
  // Send urgent admin alert
  await sendUrgentAdminAlert('CRITICAL: Checkout Processing Failure', {
    transactionId: transactionId,
    sessionId: session.id,
    customerId: session.metadata?.user_id,
    customerEmail: session.customer_email,
    amount: session.amount_total,
    currency: session.currency,
    error: error.message,
    recoveryInstructions: 'IMMEDIATE ACTION REQUIRED: Payment succeeded but access not granted. Manual intervention needed.'
  })
  
  // Send customer notification
  if (session.customer_email) {
    await sendCustomerProcessingDelayNotification(session.customer_email, {
      sessionId: session.id,
      expectedResolution: '2 hours',
      supportContact: 'support@directorybolt.com',
      urgencyLevel: 'high'
    })
  }
}

// Event handlers
async function handleCheckoutCompleted(event: StripeWebhookEvent): Promise<void> {
  const session = event.data.object
  const userId = session.metadata?.user_id
  const credits = parseInt(session.metadata?.credits || '0')
  
  if (!userId || !credits) {
    throw new Error('Missing required metadata in checkout session')
  }
  
  console.log(`💰 Checkout completed for user ${userId}: ${credits} credits`)
  
  // Use comprehensive error recovery system
  await handleCheckoutCompletedWithRecovery(session)
}

async function handlePaymentSucceeded(event: StripeWebhookEvent): Promise<void> {
  const paymentIntent = event.data.object
  const transactionId = generateTransactionId()
  
  console.log(`✅ Payment succeeded: ${paymentIntent.id}`)
  
  try {
    // Step 1: Update payment record with retry
    await updatePaymentStatusWithRetry(paymentIntent.id, 'succeeded', transactionId)
    
    // Step 2: Additional processing if needed
    const payment = await getPaymentByStripeIdWithRetry(paymentIntent.id, transactionId)
    if (payment && payment.credits_purchased) {
      await logPaymentProcessedWithRetry(payment.user_id, payment.credits_purchased, paymentIntent.id, transactionId)
    }
    
    log.info('Payment processing completed successfully', {
      transactionId: transactionId,
      paymentIntentId: paymentIntent.id
    } as any)
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    await handlePaymentSuccessFailure(paymentIntent, transactionId, err)
    throw err
  }
}

async function handlePaymentFailed(event: StripeWebhookEvent): Promise<void> {
  const paymentIntent = event.data.object
  const transactionId = generateTransactionId()
  
  console.log(`❌ Payment failed: ${paymentIntent.id}`)
  
  try {
    // Step 1: Update payment record with retry
    await updatePaymentStatusWithRetry(paymentIntent.id, 'failed', transactionId)
    
    // Step 2: Get user and send failure notification (graceful degradation for notifications)
    const payment = await getPaymentByStripeIdWithRetry(paymentIntent.id, transactionId)
    if (payment) {
      // Send failure email with graceful degradation
      await sendPaymentFailureEmailWithGracefulFailure(payment.user_id, paymentIntent.last_payment_error?.message)
      
      // Log payment failure
      await logPaymentFailureWithRetry(payment.user_id, paymentIntent.id, paymentIntent.last_payment_error?.message, transactionId)
      
      // Alert admin of payment failure
      await sendAdminPaymentFailureAlert(payment, paymentIntent, transactionId)
    }
    
    log.info('Payment failure processing completed', {
      transactionId: transactionId,
      paymentIntentId: paymentIntent.id
    } as any)
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    await handlePaymentFailureProcessingError(paymentIntent, transactionId, err)
    throw err
  }
}

async function handleSubscriptionPayment(event: StripeWebhookEvent): Promise<void> {
  const invoice = event.data.object
  const customerId = invoice.customer
  const transactionId = generateTransactionId()
  
  console.log(`💳 Subscription payment succeeded for customer: ${customerId}`)
  
  try {
    // Step 1: Get user with retry
    const user = await getUserByStripeCustomerIdWithRetry(customerId, transactionId)
    if (user) {
      // Step 2: Update subscription status with retry
      await updateSubscriptionStatusWithRetry(user.id, 'active', transactionId)
      
      // Step 3: Add subscription credits with retry
      await addSubscriptionCreditsWithRetry(user.id, user.subscription_tier, transactionId)
      
      // Step 4: Log subscription payment
      await logSubscriptionPaymentWithRetry(user.id, invoice.amount_paid, transactionId)
      
      // Step 5: Send renewal confirmation (graceful degradation)
      await sendSubscriptionRenewalConfirmationWithGracefulFailure(user, invoice)
    }
    
    log.info('Subscription payment processing completed successfully', {
      transactionId: transactionId,
      customerId: customerId,
      invoiceId: invoice.id
    } as any)
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    await handleSubscriptionPaymentFailure(invoice, transactionId, err)
    throw err
  }
}

async function handleSubscriptionUpdated(event: StripeWebhookEvent): Promise<void> {
  const subscription = event.data.object
  const customerId = subscription.customer
  
  console.log(`🔄 Subscription updated for customer: ${customerId}`)
  
  const user = await getUserByStripeCustomerId(customerId)
  if (user) {
    await updateUserSubscription(user.id, {
      subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_tier: getSubscriptionTier(subscription.items?.data[0]?.price?.id)
    })
  }
}

async function handleSubscriptionCancelled(event: StripeWebhookEvent): Promise<void> {
  const subscription = event.data.object
  const customerId = subscription.customer
  
  console.log(`🚫 Subscription cancelled for customer: ${customerId}`)
  
  const user = await getUserByStripeCustomerId(customerId)
  if (user) {
    await updateUserSubscription(user.id, {
      subscription_status: 'cancelled',
      subscription_tier: 'free'
    })
    await sendSubscriptionCancelledEmail(user.id)
  }
}

// Database functions (mock implementations)
// ========== MOCK IMPLEMENTATIONS FOR MISSING FUNCTIONS ==========
// These would be replaced with actual implementations in production

async function processPayment(paymentData: any): Promise<any> {
  // Mock implementation - replace with actual payment processing
  console.log('💳 Processing payment:', paymentData)
  return { success: true, paymentId: generateTransactionId() }
}

async function createCustomerRecord(session: any): Promise<any> {
  // Mock implementation - replace with actual database operation
  const customerRecord = {
    customerId: session.metadata?.user_id || generateTransactionId(),
    email: session.customer_email,
    tier: session.metadata?.tier || 'starter',
    credits: parseInt(session.metadata?.credits || '0'),
    sessionId: session.id
  }
  console.log('👤 Created customer record:', customerRecord)
  return customerRecord
}

async function createAccessLevel(customerRecord: any): Promise<void> {
  // Mock implementation - replace with actual access control setup
  console.log('🔑 Created access level for customer:', customerRecord.customerId)
}

async function initializeUsageTracking(customerRecord: any): Promise<void> {
  // Mock implementation - replace with actual usage tracking setup
  console.log('📊 Initialized usage tracking for customer:', customerRecord.customerId)
}

async function sendWelcomeEmail(email: string, tier: string): Promise<void> {
  // Mock implementation - replace with actual email service
  console.log(`📧 Sent welcome email to ${email} for ${tier} tier`)
}

async function triggerAIAnalysisProcess(customerData: any): Promise<void> {
  // Mock implementation - replace with actual AI service integration
  console.log('🤖 Triggered AI analysis for customer:', customerData.customerId)
}

async function queueEmailForRetry(type: string, customerData: any, error: Error): Promise<void> {
  // Mock implementation - replace with actual queue service
  console.log(`📬 Queued ${type} email for retry:`, {
    customerId: customerData.customerId,
    email: customerData.email,
    error: error.message
  })
}

async function queueAIProcessingForRetry(customerData: any, error: Error): Promise<void> {
  // Mock implementation - replace with actual queue service
  console.log('🤖 Queued AI processing for retry:', {
    customerId: customerData.customerId,
    error: error.message
  })
}

async function storePaymentFailureRecord(failureRecord: any): Promise<void> {
  // Mock implementation - replace with actual database storage
  console.log('💾 Stored payment failure record:', failureRecord)
}

async function storeCheckoutFailureRecord(failureRecord: any): Promise<void> {
  // Mock implementation - replace with actual database storage
  console.log('💾 Stored checkout failure record:', failureRecord)
}

async function sendUrgentAdminAlert(subject: string, details: any): Promise<void> {
  // Mock implementation - replace with actual admin notification system
  console.log(`🚨 URGENT ADMIN ALERT: ${subject}`, details)
  
  // In production, this would send to multiple channels:
  // - Email to admin team
  // - Slack notification
  // - SMS to on-call engineer
  // - PagerDuty alert
}

async function sendCustomerProcessingDelayNotification(email: string, details: any): Promise<void> {
  // Mock implementation - replace with actual customer notification
  console.log(`📧 Sent processing delay notification to ${email}:`, details)
}

async function updatePaymentStatus(paymentIntentId: string, status: 'succeeded' | 'failed'): Promise<void> {
  // TODO: Implement actual database update
  // await db.payments.update({
  //   where: { stripe_payment_intent_id: paymentIntentId },
  //   data: { 
  //     status,
  //     updated_at: new Date()
  //   }
  // })
  
  console.log(`💾 Updated payment ${paymentIntentId} status to: ${status}`)
}

async function addCreditsToUser(userId: string, credits: number): Promise<void> {
  const maxRetries = 3
  const transactionId = generateTransactionId()
  const logger = createErrorRecoveryLogger('add_credits_to_user', transactionId)
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // TODO: Implement actual database update with transaction
      // await db.users.update({
      //   where: { id: userId },
      //   data: { 
      //     credits_remaining: { increment: credits },
      //     updated_at: new Date()
      //   }
      // })
      
      console.log(`💎 Added ${credits} credits to user ${userId} (attempt ${attempt})`)
      
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        
        // Critical failure - alert admin immediately
        await sendUrgentAdminAlert('CRITICAL: Failed to add credits to user', {
          userId: userId,
          credits: credits,
          transactionId: transactionId,
          error: err.message,
          recoveryAction: 'Manual credit addition required'
        })
        
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

async function getPaymentByStripeId(stripePaymentIntentId: string): Promise<Payment | null> {
  // TODO: Implement actual database query
  // return await db.payments.findFirst({
  //   where: { stripe_payment_intent_id: stripePaymentIntentId }
  // })
  
  // Mock payment data
  return {
    id: 'pay_mock_123',
    user_id: 'usr_test_123',
    stripe_payment_intent_id: stripePaymentIntentId,
    amount: 4999,
    currency: 'usd',
    status: 'processing',
    description: 'Professional Package',
    credits_purchased: 200,
    payment_method_type: 'card',
    created_at: new Date(),
    updated_at: new Date()
  } as Payment
}

async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  // TODO: Implement actual database query
  // return await db.users.findFirst({
  //   where: { stripe_customer_id: stripeCustomerId }
  // })
  
  // Mock user data
  if (stripeCustomerId === 'cus_mock_123') {
    return {
      id: 'usr_test_123',
      email: 'test@directorybolt.com',
      password_hash: 'hashed',
      full_name: 'Test User',
      company_name: 'Test Company',
      subscription_tier: 'professional',
      credits_remaining: 50,
      is_verified: true,
      failed_login_attempts: 0,
      stripe_customer_id: stripeCustomerId,
      created_at: new Date('2024-01-01'),
      updated_at: new Date(),
      directories_used_this_period: 25,
      directory_limit: 100
    } as User
  }
  
  return null
}

async function updateSubscriptionStatus(userId: string, status: string): Promise<void> {
  // TODO: Implement database update
  console.log(`💾 Updated subscription status for user ${userId}: ${status}`)
}

async function addSubscriptionCredits(userId: string, tier: string): Promise<void> {
  const creditsMap = { free: 0, pro: 100, enterprise: 500 }
  const credits = creditsMap[tier as keyof typeof creditsMap] || 0
  
  if (credits > 0) {
    await addCreditsToUser(userId, credits)
  }
}

async function updateUserSubscription(userId: string, updates: Partial<User>): Promise<void> {
  // TODO: Implement database update
  console.log(`💾 Updated subscription for user ${userId}:`, updates)
}

// Utility functions
function getSubscriptionTier(priceId: string): 'free' | 'starter' | 'growth' | 'professional' | 'enterprise' {
  // Map Stripe price IDs to subscription tiers
  const tierMap: Record<string, 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'> = {
    [process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_monthly']: 'starter',
    [process.env.STRIPE_GROWTH_PRICE_ID || 'price_growth_monthly']: 'growth', 
    [process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_monthly']: 'professional',
    [process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly']: 'enterprise'
  }
  
  return tierMap[priceId] || 'free'
}

// Email notifications (mock implementations)
async function sendPurchaseConfirmationEmail(userId: string, credits: number): Promise<void> {
  try {
    // TODO: Implement actual email sending
    console.log(`📧 Purchase confirmation email sent to user ${userId} for ${credits} credits`)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.warn('Purchase confirmation email failed - will retry later', {
      userId: userId,
      credits: credits,
      error: err.message
    } as any)
    
    // Queue for retry - don't fail the entire checkout process
    await queueEmailForRetry('purchase_confirmation', { userId, credits }, err)
  }
}

async function sendPaymentFailureEmail(userId: string, errorMessage?: string): Promise<void> {
  console.log(`📧 Payment failure email sent to user ${userId}. Error: ${errorMessage}`)
}

async function sendSubscriptionCancelledEmail(userId: string): Promise<void> {
  console.log(`📧 Subscription cancellation email sent to user ${userId}`)
}

// Logging functions
async function logPurchaseSuccess(userId: string, credits: number, paymentIntentId: string): Promise<void> {
  const transactionId = generateTransactionId()
  
  try {
    const logEntry = {
      transactionId: transactionId,
      timestamp: new Date().toISOString(),
      event: 'purchase_success',
      user_id: userId,
      credits_purchased: credits,
      payment_intent_id: paymentIntentId,
      recovery_status: 'completed'
    }
    
    // TODO: Store in audit log database
    console.log(`📝 Purchase success:`, logEntry)
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('Failed to log purchase success:', err.message)
    
    // Don't fail the transaction for logging errors, but alert admin
    await sendUrgentAdminAlert('WARNING: Purchase success logging failed', {
      userId: userId,
      credits: credits,
      paymentIntentId: paymentIntentId,
      transactionId: transactionId,
      error: err.message
    })
  }
}

async function logPaymentProcessed(userId: string, credits: number, paymentIntentId: string): Promise<void> {
  console.log(`📝 Payment processed: User ${userId}, Credits: ${credits}, Payment: ${paymentIntentId}`)
}

async function logPaymentFailure(userId: string, paymentIntentId: string, error?: string): Promise<void> {
  console.log(`📝 Payment failed: User ${userId}, Payment: ${paymentIntentId}, Error: ${error}`)
}

async function logSubscriptionPayment(userId: string, amount: number): Promise<void> {
  console.log(`📝 Subscription payment: User ${userId}, Amount: $${(amount / 100).toFixed(2)}`)
}

async function logWebhookFailure(eventId: string, eventType: string, error: string): Promise<void> {
  console.log(`📝 Webhook failure: Event ${eventId} (${eventType}), Error: ${error}`)
}

// ========== ENHANCED DATABASE FUNCTIONS WITH ERROR RECOVERY ==========

async function updatePaymentStatusWithRetry(paymentIntentId: string, status: 'succeeded' | 'failed', transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('update_payment_status', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // TODO: Implement actual database update
      console.log(`💾 Updated payment ${paymentIntentId} status to: ${status} (attempt ${attempt})`)
      
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

async function getPaymentByStripeIdWithRetry(stripePaymentIntentId: string, transactionId: string): Promise<Payment | null> {
  const logger = createErrorRecoveryLogger('get_payment_by_stripe_id', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Mock payment data for now
      const payment: Payment = {
        id: 'pay_mock_123',
        user_id: 'usr_test_123',
        stripe_payment_intent_id: stripePaymentIntentId,
        amount: 4999,
        currency: 'usd',
        status: 'processing',
        description: 'Professional Package',
        credits_purchased: 200,
        payment_method_type: 'card',
        payment_type: 'one_time',
        created_at: new Date(),
        updated_at: new Date()
      }
      
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return payment
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
  
  return null
}

async function getUserByStripeCustomerIdWithRetry(stripeCustomerId: string, transactionId: string): Promise<User | null> {
  const logger = createErrorRecoveryLogger('get_user_by_stripe_customer_id', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Mock user data for now
      if (stripeCustomerId === 'cus_mock_123') {
        const user: User = {
          id: 'usr_test_123',
          email: 'test@directorybolt.com',
          password_hash: 'hashed',
          full_name: 'Test User',
          company_name: 'Test Company',
          subscription_tier: 'professional',
          credits_remaining: 50,
          is_verified: true,
          failed_login_attempts: 0,
          stripe_customer_id: stripeCustomerId,
          created_at: new Date('2024-01-01'),
          updated_at: new Date(),
          directories_used_this_period: 25,
          directory_limit: 100
        }
        
        if (attempt > 1) {
          logger.logRecoverySuccess(attempt)
        }
        return user
      }
      
      return null
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
  
  return null
}

async function updateSubscriptionStatusWithRetry(userId: string, status: string, transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('update_subscription_status', transactionId)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`💾 Updated subscription status for user ${userId}: ${status} (attempt ${attempt})`)
      
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        logger.logRecoveryFailure(maxRetries, err)
        throw err
      }
      
      await sleep(1000 * Math.pow(2, attempt - 1))
    }
  }
}

async function addSubscriptionCreditsWithRetry(userId: string, tier: string, transactionId: string): Promise<void> {
  const creditsMap = { free: 0, pro: 100, enterprise: 500 }
  const credits = creditsMap[tier as keyof typeof creditsMap] || 0
  
  if (credits > 0) {
    const logger = createErrorRecoveryLogger('add_subscription_credits', transactionId)
    const maxRetries = 3
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await addCreditsToUser(userId, credits)
        if (attempt > 1) {
          logger.logRecoverySuccess(attempt)
        }
        return
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.logRecoveryAttempt(attempt, err)
        
        if (attempt === maxRetries) {
          logger.logRecoveryFailure(maxRetries, err)
          throw err
        }
        
        await sleep(1000 * Math.pow(2, attempt - 1))
      }
    }
  }
}

// ========== ENHANCED LOGGING FUNCTIONS WITH ERROR RECOVERY ==========

async function logPaymentProcessedWithRetry(userId: string, credits: number, paymentIntentId: string, transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('log_payment_processed', transactionId)
  const maxRetries = 2
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📝 Payment processed: User ${userId}, Credits: ${credits}, Payment: ${paymentIntentId}`)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        console.warn(`Failed to log payment processing after ${maxRetries} attempts:`, err.message)
        return
      }
      
      await sleep(500 * attempt)
    }
  }
}

async function logPaymentFailureWithRetry(userId: string, paymentIntentId: string, error: string | undefined, transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('log_payment_failure', transactionId)
  const maxRetries = 2
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📝 Payment failed: User ${userId}, Payment: ${paymentIntentId}, Error: ${error}`)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (logError) {
      const err = logError instanceof Error ? logError : new Error(String(logError))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        console.warn(`Failed to log payment failure after ${maxRetries} attempts:`, err.message)
        return
      }
      
      await sleep(500 * attempt)
    }
  }
}

async function logSubscriptionPaymentWithRetry(userId: string, amount: number, transactionId: string): Promise<void> {
  const logger = createErrorRecoveryLogger('log_subscription_payment', transactionId)
  const maxRetries = 2
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📝 Subscription payment: User ${userId}, Amount: $${(amount / 100).toFixed(2)}`)
      if (attempt > 1) {
        logger.logRecoverySuccess(attempt)
      }
      return
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logRecoveryAttempt(attempt, err)
      
      if (attempt === maxRetries) {
        console.warn(`Failed to log subscription payment after ${maxRetries} attempts:`, err.message)
        return
      }
      
      await sleep(500 * attempt)
    }
  }
}

// ========== GRACEFUL FAILURE HANDLERS FOR NON-CRITICAL OPERATIONS ==========

async function sendPaymentFailureEmailWithGracefulFailure(userId: string, errorMessage?: string): Promise<void> {
  try {
    console.log(`📧 Payment failure email sent to user ${userId}. Error: ${errorMessage}`)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.warn('Payment failure email failed - will retry later', {
      userId: userId,
      errorMessage: errorMessage,
      error: err.message
    } as any)
    
    await queueEmailForRetry('payment_failure', { userId, errorMessage }, err)
  }
}

async function sendSubscriptionRenewalConfirmationWithGracefulFailure(user: User, invoice: any): Promise<void> {
  try {
    console.log(`📧 Subscription renewal confirmation sent to user ${user.id}`)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.warn('Subscription renewal confirmation failed - will retry later', {
      userId: user.id,
      invoiceId: invoice.id,
      error: err.message
    } as any)
    
    await queueEmailForRetry('subscription_renewal', { user, invoice }, err)
  }
}

// ========== COMPREHENSIVE ERROR HANDLERS ==========

async function handlePaymentSuccessFailure(paymentIntent: any, transactionId: string, error: Error): Promise<void> {
  await sendUrgentAdminAlert('CRITICAL: Payment Success Processing Failure', {
    transactionId: transactionId,
    paymentIntentId: paymentIntent.id,
    customerId: paymentIntent.customer,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    error: error.message,
    recoveryInstructions: 'Payment succeeded but post-processing failed. Manual verification required.'
  })
}

async function handlePaymentFailureProcessingError(paymentIntent: any, transactionId: string, error: Error): Promise<void> {
  await sendUrgentAdminAlert('ERROR: Payment Failure Processing Error', {
    transactionId: transactionId,
    paymentIntentId: paymentIntent.id,
    customerId: paymentIntent.customer,
    error: error.message,
    recoveryInstructions: 'Failed to process payment failure properly. Check payment status manually.'
  })
}

async function handleSubscriptionPaymentFailure(invoice: any, transactionId: string, error: Error): Promise<void> {
  await sendUrgentAdminAlert('CRITICAL: Subscription Payment Processing Failure', {
    transactionId: transactionId,
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription,
    amount: invoice.amount_paid,
    error: error.message,
    recoveryInstructions: 'Subscription payment succeeded but post-processing failed. Manual access grant required.'
  })
}

async function sendAdminPaymentFailureAlert(payment: Payment, paymentIntent: any, transactionId: string): Promise<void> {
  await sendUrgentAdminAlert('Payment Failure Alert', {
    transactionId: transactionId,
    paymentIntentId: paymentIntent.id,
    userId: payment.user_id,
    amount: payment.amount,
    currency: payment.currency,
    failureReason: paymentIntent.last_payment_error?.message,
    recoveryInstructions: 'Customer payment failed. Follow up with customer support if needed.'
  })
}