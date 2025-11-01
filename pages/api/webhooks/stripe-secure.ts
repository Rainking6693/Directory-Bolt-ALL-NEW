// 🔒 SECURE STRIPE WEBHOOK HANDLER
// Enhanced webhook processing with comprehensive security validation

import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
// Removed micro dependency for Netlify compatibility
// Buffer handling is done inline for serverless functions
import { logger } from '../../../lib/utils/logger'
import { secureWebhookHandler } from '../../../lib/security/webhook-validation'
import { securityMonitor, monitorPaymentAnomaly } from '../../../lib/security/security-monitoring'

import { buffer as getRawBody } from '../../../lib/utils/server-utils'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
})

// Get webhook secret with better error handling
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
}

interface CustomerData {
  stripeCustomerId: string
  email: string
  name?: string
  phone?: string
  plan: string
  planName: string
  amount: number
  paymentStatus: string
  subscriptionStatus?: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 WEBHOOK DEBUG - Request received:', {
    method: req.method,
    hasSignature: !!req.headers['stripe-signature'],
    contentType: req.headers['content-type'],
    bodyType: typeof req.body,
    hasWebhookSecret: !!webhookSecret
  })

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check webhook secret is configured
  if (!webhookSecret) {
    console.log('❌ Webhook secret missing')
    return res.status(500).json({ 
      error: 'Webhook secret not configured'
    })
  }

  try {
    const buf = await getRawBody(req as any)
    console.log('📦 Raw body status:', { 
      bufferLength: buf?.length,
      hasBuffer: !!buf 
    })
    
    // Store raw body for signature validation
    ;(req as any).rawBody = buf
    
    // Use secure webhook validation with monitoring
    const allowedEventTypes = [
      'checkout.session.completed',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'customer.created',
      'customer.updated',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'product.created',  // Add these for your test events
      'price.created',
      'charge.succeeded',
      'charge.updated',
      'charge.failed'
    ]
    
    console.log('🔐 Starting webhook validation...')
    const validation = await secureWebhookHandler(req, webhookSecret, allowedEventTypes)
    
    if (!validation.isValid) {
      console.log('❌ Webhook validation failed:', {
        error: validation.error,
        shouldBlock: validation.shouldBlock
      })
      securityMonitor.logEvent(
        'invalid_webhook',
        'high',
        req,
        { reason: validation.error, shouldBlock: validation.shouldBlock }
      )
      
      return res.status(validation.shouldBlock ? 429 : 400).json({ 
        error: validation.error 
      })
    }
    
    const event = validation.event as Stripe.Event

    logger.info('Secure Stripe webhook received', {
      metadata: {
        eventType: event.type,
        eventId: event.id
      }
    })
    
    // Monitor for payment anomalies
    if (event.type.includes('payment')) {
      await monitorPaymentEvent(event)
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer)
        break
        
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer)
        break
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
        
      default:
        logger.info('Unhandled webhook event type', {
          metadata: { eventType: event.type }
        })
    }

    return res.status(200).json({ received: true })

  } catch (error) {
    logger.error('Secure webhook processing failed', {}, error as Error)
    
    securityMonitor.logEvent(
      'suspicious_request',
      'high',
      req,
      { reason: 'webhook_processing_error', error: error instanceof Error ? error.message : 'Unknown error' }
    )
    
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

/**
 * Monitor payment events for anomalies
 */
async function monitorPaymentEvent(event: Stripe.Event) {
  try {
    const data = event.data.object as any
    
    // Check for unusual amounts
    if (data.amount && data.amount > 100000) { // $1000+
      monitorPaymentAnomaly('unusual_amount', {
        eventType: event.type,
        amount: data.amount,
        currency: data.currency,
        customerId: data.customer
      })
    }
    
    // Check for rapid payment attempts (would need to track in database)
    // This is a simplified check - in production, implement proper tracking
    
    // Log payment event for monitoring
    securityMonitor.logEvent(
      'api_key_usage',
      'low',
      { headers: {}, url: '/webhook/stripe' } as NextApiRequest,
      {
        eventType: event.type,
        amount: data.amount,
        currency: data.currency,
        customerId: data.customer
      }
    )
    
  } catch (error) {
    logger.error('Payment monitoring failed', {}, error as Error)
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    logger.info('Processing secure checkout completion', {
      metadata: {
        sessionId: session.id,
        customerId: session.customer,
        amount: session.amount_total,
        plan: session.metadata?.plan
      }
    })

    // Extract customer and payment information
    const customerData: Partial<CustomerData> = {
      stripeCustomerId: session.customer as string,
      email: session.customer_details?.email || '',
      name: session.customer_details?.name || '',
      phone: session.customer_details?.phone || '',
      plan: session.metadata?.plan || 'unknown',
      planName: session.metadata?.planName || 'Unknown Plan',
      amount: session.amount_total || 0,
      paymentStatus: 'completed',
      metadata: session.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Store customer data (implement your storage logic)
    await storeCustomerData(customerData)
    
    // Trigger analysis process
    await triggerAnalysisProcess(customerData)
    
    // Send confirmation email
    await sendConfirmationEmail(customerData)
    
    logger.info('Secure checkout completion processed successfully', {
      metadata: {
        customerId: customerData.stripeCustomerId,
        plan: customerData.plan
      }
    })

  } catch (error) {
    logger.error('Failed to process secure checkout completion', {}, error as Error)
    throw error
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    logger.info('Processing secure payment success', {
      metadata: {
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customer,
        amount: paymentIntent.amount
      }
    })

    // Update payment status in database
    await updatePaymentStatus(paymentIntent.id, 'succeeded')
    
    // Send payment confirmation
    await sendPaymentConfirmation(paymentIntent)

  } catch (error) {
    logger.error('Failed to process secure payment success', {}, error as Error)
    throw error
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    logger.info('Processing secure payment failure', {
      metadata: {
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customer,
        amount: paymentIntent.amount,
        failureReason: paymentIntent.last_payment_error?.message
      }
    })

    // Monitor payment failure
    monitorPaymentAnomaly('failed_payment', {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      failureReason: paymentIntent.last_payment_error?.message
    })

    // Update payment status in database
    await updatePaymentStatus(paymentIntent.id, 'failed')
    
    // Send payment failure notification
    await sendPaymentFailureNotification(paymentIntent)

  } catch (error) {
    logger.error('Failed to process secure payment failure', {}, error as Error)
    throw error
  }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(customer: Stripe.Customer) {
  try {
    logger.info('Processing secure customer creation', {
      metadata: {
        customerId: customer.id,
        email: customer.email
      }
    })

    // Store customer information
    await storeCustomerProfile(customer)

  } catch (error) {
    logger.error('Failed to process secure customer creation', {}, error as Error)
    throw error
  }
}

/**
 * Handle customer updates
 */
async function handleCustomerUpdated(customer: Stripe.Customer) {
  try {
    logger.info('Processing secure customer update', {
      metadata: {
        customerId: customer.id,
        email: customer.email
      }
    })

    // Update customer information
    await updateCustomerProfile(customer)

  } catch (error) {
    logger.error('Failed to process secure customer update', {}, error as Error)
    throw error
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    logger.info('Processing secure invoice payment success', {
      metadata: {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_paid
      }
    })

    // Process invoice payment
    await processInvoicePayment(invoice)

  } catch (error) {
    logger.error('Failed to process secure invoice payment success', {}, error as Error)
    throw error
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    logger.info('Processing secure invoice payment failure', {
      metadata: {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_due
      }
    })

    // Handle invoice payment failure
    await handleInvoiceFailure(invoice)

  } catch (error) {
    logger.error('Failed to process secure invoice payment failure', {}, error as Error)
    throw error
  }
}

// Helper functions (implement based on your storage and notification systems)

/**
 * Store customer data in your database
 */
async function storeCustomerData(customerData: Partial<CustomerData>) {
  try {
    // Implement your database storage logic here
    // This could be Airtable, PostgreSQL, MongoDB, etc.
    
    logger.info('Customer data stored securely', {
      metadata: {
        customerId: customerData.stripeCustomerId,
        plan: customerData.plan
      }
    })
  } catch (error) {
    logger.error('Failed to store customer data securely', {}, error as Error)
    throw error
  }
}

/**
 * Trigger the AI analysis process for the customer
 */
async function triggerAnalysisProcess(customerData: Partial<CustomerData>) {
  try {
    // Implement your analysis triggering logic here
    // This could queue a job, call an API, etc.
    
    logger.info('Analysis process triggered securely', {
      metadata: {
        customerId: customerData.stripeCustomerId,
        plan: customerData.plan
      }
    })
  } catch (error) {
    logger.error('Failed to trigger analysis process securely', {}, error as Error)
    throw error
  }
}

/**
 * Send confirmation email to customer
 */
async function sendConfirmationEmail(customerData: Partial<CustomerData>) {
  try {
    // Implement your email sending logic here
    // This could use SendGrid, AWS SES, etc.
    
    logger.info('Confirmation email sent securely', {
      metadata: {
        email: customerData.email,
        plan: customerData.plan
      }
    })
  } catch (error) {
    logger.error('Failed to send confirmation email securely', {}, error as Error)
    // Don't throw here - email failure shouldn't break the webhook
  }
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(paymentIntentId: string, status: string) {
  try {
    // Implement your database update logic here
    
    logger.info('Payment status updated securely', {
      metadata: {
        paymentIntentId,
        status
      }
    })
  } catch (error) {
    logger.error('Failed to update payment status securely', {}, error as Error)
    throw error
  }
}

/**
 * Send payment confirmation
 */
async function sendPaymentConfirmation(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Implement your payment confirmation logic here
    
    logger.info('Payment confirmation sent securely', {
      metadata: {
        paymentIntentId: paymentIntent.id
      }
    })
  } catch (error) {
    logger.error('Failed to send payment confirmation securely', {}, error as Error)
    // Don't throw here - email failure shouldn't break the webhook
  }
}

/**
 * Send payment failure notification
 */
async function sendPaymentFailureNotification(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Implement your payment failure notification logic here
    
    logger.info('Payment failure notification sent securely', {
      metadata: {
        paymentIntentId: paymentIntent.id
      }
    })
  } catch (error) {
    logger.error('Failed to send payment failure notification securely', {}, error as Error)
    // Don't throw here - email failure shouldn't break the webhook
  }
}

/**
 * Store customer profile
 */
async function storeCustomerProfile(customer: Stripe.Customer) {
  try {
    // Implement your customer profile storage logic here
    
    logger.info('Customer profile stored securely', {
      metadata: {
        customerId: customer.id
      }
    })
  } catch (error) {
    logger.error('Failed to store customer profile securely', {}, error as Error)
    throw error
  }
}

/**
 * Update customer profile
 */
async function updateCustomerProfile(customer: Stripe.Customer) {
  try {
    // Implement your customer profile update logic here
    
    logger.info('Customer profile updated securely', {
      metadata: {
        customerId: customer.id
      }
    })
  } catch (error) {
    logger.error('Failed to update customer profile securely', {}, error as Error)
    throw error
  }
}

/**
 * Process invoice payment
 */
async function processInvoicePayment(invoice: Stripe.Invoice) {
  try {
    // Implement your invoice processing logic here
    
    logger.info('Invoice payment processed securely', {
      metadata: {
        invoiceId: invoice.id
      }
    })
  } catch (error) {
    logger.error('Failed to process invoice payment securely', {}, error as Error)
    throw error
  }
}

/**
 * Handle invoice failure
 */
async function handleInvoiceFailure(invoice: Stripe.Invoice) {
  try {
    // Implement your invoice failure handling logic here
    
    logger.info('Invoice failure handled securely', {
      metadata: {
        invoiceId: invoice.id
      }
    })
  } catch (error) {
    logger.error('Failed to handle invoice failure securely', {}, error as Error)
    throw error
  }
}

