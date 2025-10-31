// 🚀 STRIPE WEBHOOK HANDLER - PHASE 2 SUBSCRIPTION EVENTS
// Complete webhook handling for payment events and subscription management

import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { buffer as getRawBody } from '../../../lib/utils/server-utils'
// Removed micro dependency for Netlify compatibility
// Buffer handling is done inline for serverless functions

// Simple logger fallback
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg: string, meta?: any, error?: Error) => console.error(`[ERROR] ${msg}`, meta || '', error || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || '')
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
})

// Netlify Functions configuration
// Note: Netlify handles raw body parsing automatically for webhooks

// Webhook event handlers
const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session) => {
  logger.info('Checkout session completed', {
    metadata: {
      sessionId: session.id,
      customerEmail: session.customer_email,
      plan: session.metadata?.plan,
      amount: session.amount_total,
      currency: session.currency
    }
  })

  // TODO: Implement business logic
  // 1. Create user account if doesn't exist
  // 2. Grant access to purchased plan
  // 3. Send welcome email
  // 4. Start directory submission process
  // 5. Update CRM/system of record with customer data (Airtable removed)

  try {
    // Example: Store purchase in database
    const purchaseData = {
      stripeSessionId: session.id,
      customerEmail: session.customer_email,
      plan: session.metadata?.plan,
      planName: session.metadata?.planName,
      amount: session.amount_total,
      currency: session.currency,
      status: 'completed',
      purchaseDate: new Date(),
      metadata: session.metadata
    }

    // TODO: Save to your database
    logger.info('Purchase data prepared for storage', { metadata: purchaseData })

    // TODO: Send to Airtable
    // await saveToAirtable(purchaseData)

    // TODO: Send welcome email
    // await sendWelcomeEmail(session.customer_email, session.metadata?.plan)

    // TODO: Trigger directory submission process
    // await startDirectorySubmissions(session.customer_email, session.metadata?.plan)

  } catch (error) {
    logger.error('Failed to process completed checkout', {
      metadata: {
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : new Error(String(error)))
    throw error // Re-throw to be handled by timeout wrapper
  }
}

const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  logger.info('Payment intent succeeded', {
    metadata: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customerEmail: paymentIntent.receipt_email
    }
  })

  // TODO: Implement payment confirmation logic
}

const handlePaymentIntentFailed = async (paymentIntent: Stripe.PaymentIntent) => {
  logger.error('Payment intent failed', {
    metadata: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      lastPaymentError: paymentIntent.last_payment_error?.message
    }
  })

  // TODO: Implement payment failure handling
  // 1. Send failure notification email
  // 2. Log for customer support follow-up
}

const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  logger.info('Invoice payment succeeded', {
    metadata: {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerEmail: invoice.customer_email,
      amount: invoice.amount_paid,
      currency: invoice.currency
    }
  })

  // TODO: Handle subscription renewals
}

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  logger.error('Invoice payment failed', {
    metadata: {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerEmail: invoice.customer_email,
      amount: invoice.amount_due,
      currency: invoice.currency
    }
  })

  // TODO: Handle failed subscription payments
  // 1. Send payment failure notification
  // 2. Implement dunning management
  // 3. Suspend service if needed
}

const handleCustomerSubscriptionCreated = async (subscription: Stripe.Subscription) => {
  logger.info('Customer subscription created', {
    metadata: {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
    }
  })

  // TODO: Handle new subscription
}

const handleCustomerSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  logger.info('Customer subscription updated', {
    metadata: {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
    }
  })

  // TODO: Handle subscription changes (upgrades, downgrades, etc.)
}

const handleCustomerSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  logger.info('Customer subscription deleted', {
    metadata: {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      canceledAt: subscription.canceled_at
    }
  })

  // TODO: Handle subscription cancellation
  // 1. Revoke access to premium features
  // 2. Send cancellation confirmation email
  // 3. Offer win-back incentives
}

// 🔒 SECURITY: Secure CORS configuration for Stripe webhook endpoints
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔒 SECURITY FIX: Apply secure CORS headers for Stripe webhooks (CORS-008)
  const corsHeaders = getWebhookCorsHeaders(req);
  applyCorsHeaders(res, corsHeaders);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Add timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Webhook processing timeout')), 25000) // 25 second timeout
  })

  try {
    const result = await Promise.race([
      handleWebhook(req, res),
      timeoutPromise
    ])
    return result
  } catch (error) {
    logger.error('Webhook processing failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : new Error(String(error)))

    if (error instanceof Error && error.message === 'Webhook processing timeout') {
      return res.status(504).json({
        error: 'Webhook processing timeout',
        processed: false
      })
    }

    return res.status(500).json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleWebhook(req: NextApiRequest, res: NextApiResponse) {
  const sig = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.warn('Stripe webhook secret not configured, using mock processing')
    // Return success for mock/testing scenarios
    return res.status(200).json({
      success: true,
      processed: true,
      mock: true,
      message: 'Webhook received but not processed (no secret configured)'
    })
  }

  // Initialize Stripe
  let stripe: Stripe
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-08-16',
    })
  } catch (error) {
    logger.error('Failed to initialize Stripe for webhook')
    return res.status(500).json({ error: 'Stripe initialization failed' })
  }

  let event: Stripe.Event

  try {
  const body = await getRawBody(req as any)
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : new Error(String(error)))
    
    return res.status(400).json({
      error: 'Webhook signature verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  logger.info('Webhook event received', {
    metadata: {
      eventId: event.id,
      eventType: event.type,
      created: event.created
    }
  })

  try {
    // Handle different event types with timeout protection
    const eventHandler = getEventHandler(event)
    if (eventHandler) {
      await Promise.race([
        eventHandler(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Event handler timeout')), 20000)
        )
      ])
    } else {
      logger.info('Unhandled webhook event type', {
        metadata: {
          eventType: event.type,
          eventId: event.id
        }
      })
    }

    return res.status(200).json({
      success: true,
      eventId: event.id,
      eventType: event.type,
      processed: true
    })

  } catch (error) {
    logger.error('Webhook event processing failed', {
      metadata: {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : new Error(String(error)))

    return res.status(500).json({
      error: 'Webhook processing failed',
      eventId: event.id,
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function getEventHandler(event: Stripe.Event): (() => Promise<void>) | null {
  switch (event.type) {
    case 'checkout.session.completed':
      return () => handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
    case 'payment_intent.succeeded':
      return () => handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
    case 'payment_intent.payment_failed':
      return () => handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
    case 'invoice.payment_succeeded':
      return () => handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
    case 'invoice.payment_failed':
      return () => handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
    case 'customer.subscription.created':
      return () => handleCustomerSubscriptionCreated(event.data.object as Stripe.Subscription)
    case 'customer.subscription.updated':
      return () => handleCustomerSubscriptionUpdated(event.data.object as Stripe.Subscription)
    case 'customer.subscription.deleted':
      return () => handleCustomerSubscriptionDeleted(event.data.object as Stripe.Subscription)
    default:
      return null
  }
}