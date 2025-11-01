// 🔒 STRIPE SUBSCRIPTION WEBHOOK HANDLER
// POST /api/webhooks/stripe-subscription - Handle Stripe subscription events for tier management

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError } from '../../../lib/utils/errors'
import { tierManager } from '../../../lib/services/tier-management'
import type { SubscriptionTier } from '../../../lib/database/tier-schema'
import { logger } from '../../../lib/utils/logger'

// Disable body parser for webhooks
export const config = {
  api: {
    bodyParser: false,
  },
}

interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }

    // Get raw body for signature verification
    const rawBody = await getRawBody(req)
    
    // Verify webhook signature
    const event = await verifyStripeWebhook(rawBody, req.headers['stripe-signature'] as string)
    if (!event) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    await handleStripeEvent(event, requestId)
    
    res.status(200).json({ received: true, requestId })

  } catch (error) {
    logger.error('Stripe webhook error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleStripeEvent(event: StripeWebhookEvent, requestId: string) {
  logger.info('Processing Stripe webhook', {
    requestId,
    eventType: event.type,
    eventId: event.id
  })

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object, requestId)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, requestId)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, requestId)
      break

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object, requestId)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object, requestId)
      break

    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event.data.object, requestId)
      break

    default:
      logger.info('Unhandled webhook event', {
        requestId,
        eventType: event.type
      })
  }
}

async function handleSubscriptionCreated(subscription: any, requestId: string) {
  try {
    const userId = subscription.metadata?.user_id
    if (!userId) {
      throw new Error('User ID not found in subscription metadata')
    }

    const tier = mapStripePriceToTier(subscription.items.data[0].price.id)
    if (!tier) {
      throw new Error(`Unknown price ID: ${subscription.items.data[0].price.id}`)
    }

    // Update user subscription tier
    await updateUserSubscription({
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      tier,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    })

    // Record tier upgrade event
    const previousTier = subscription.metadata?.upgraded_from as SubscriptionTier || 'free'
    await tierManager.recordTierUpgrade(
      userId,
      previousTier,
      tier,
      'stripe_checkout',
      undefined,
      subscription.items.data[0].price.unit_amount
    )

    // Reset usage counters for new subscription
    await tierManager.resetMonthlyUsage(userId)

    logger.info('Subscription created successfully', {
      requestId,
      userId,
      subscriptionId: subscription.id,
      tier,
      status: subscription.status
    })

    // Send welcome email
    await sendWelcomeEmail(userId, tier)

  } catch (error) {
    logger.error('Failed to handle subscription created', {
      requestId,
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

async function handleSubscriptionUpdated(subscription: any, requestId: string) {
  try {
    const userId = subscription.metadata?.user_id
    if (!userId) {
      throw new Error('User ID not found in subscription metadata')
    }

    const newTier = mapStripePriceToTier(subscription.items.data[0].price.id)
    if (!newTier) {
      throw new Error(`Unknown price ID: ${subscription.items.data[0].price.id}`)
    }

    // Get current user tier to detect changes
    const currentUser = await getUserById(userId)
    const previousTier = currentUser?.subscription_tier as SubscriptionTier

    // Update user subscription
    await updateUserSubscription({
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      tier: newTier,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    })

    // Record tier change if applicable
    if (previousTier && previousTier !== newTier) {
      await tierManager.recordTierUpgrade(
        userId,
        previousTier,
        newTier,
        'stripe_update',
        undefined,
        subscription.items.data[0].price.unit_amount
      )

      // Send tier change notification
      await sendTierChangeEmail(userId, previousTier, newTier)
    }

    // Handle subscription status changes
    if (subscription.status === 'past_due') {
      await handlePastDueSubscription(userId, subscription.id)
    } else if (subscription.status === 'canceled') {
      await handleCanceledSubscription(userId, subscription.id)
    }

    logger.info('Subscription updated successfully', {
      requestId,
      userId,
      subscriptionId: subscription.id,
      previousTier,
      newTier,
      status: subscription.status
    })

  } catch (error) {
    logger.error('Failed to handle subscription updated', {
      requestId,
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: any, requestId: string) {
  try {
    const userId = subscription.metadata?.user_id
    if (!userId) {
      throw new Error('User ID not found in subscription metadata')
    }

    // Downgrade user to free tier
    await updateUserSubscription({
      userId,
      stripeSubscriptionId: null,
      stripeCustomerId: subscription.customer,
      tier: 'free',
      status: 'canceled',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEnd: null
    })

    // Record downgrade event
    const previousTier = mapStripePriceToTier(subscription.items.data[0].price.id) || 'starter'
    await tierManager.recordTierUpgrade(
      userId,
      previousTier,
      'free',
      'stripe_cancel',
      undefined,
      0
    )

    logger.info('Subscription canceled successfully', {
      requestId,
      userId,
      subscriptionId: subscription.id,
      previousTier
    })

    // Send cancellation email
    await sendCancellationEmail(userId, previousTier)

  } catch (error) {
    logger.error('Failed to handle subscription deleted', {
      requestId,
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

async function handlePaymentSucceeded(invoice: any, requestId: string) {
  try {
    const subscriptionId = invoice.subscription
    const userId = invoice.subscription_details?.metadata?.user_id
    
    if (!userId || !subscriptionId) {
      logger.warn('Payment succeeded but missing user/subscription info', {
        requestId,
        invoiceId: invoice.id,
        subscriptionId,
        userId
      })
      return
    }

    // Update payment record
    await recordSuccessfulPayment({
      userId,
      subscriptionId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      paidAt: new Date(invoice.status_transitions.paid_at * 1000),
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000)
    })

    // Reset usage counters for new billing period
    await tierManager.resetMonthlyUsage(userId)

    logger.info('Payment processed successfully', {
      requestId,
      userId,
      invoiceId: invoice.id,
      amount: invoice.amount_paid
    })

  } catch (error) {
    logger.error('Failed to handle payment succeeded', {
      requestId,
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handlePaymentFailed(invoice: any, requestId: string) {
  try {
    const userId = invoice.subscription_details?.metadata?.user_id
    
    if (!userId) {
      logger.warn('Payment failed but missing user info', {
        requestId,
        invoiceId: invoice.id
      })
      return
    }

    // Record failed payment
    await recordFailedPayment({
      userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      failedAt: new Date(),
      nextRetryAt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : null
    })

    // Send payment failed email
    await sendPaymentFailedEmail(userId, invoice.amount_due, invoice.currency)

    logger.warn('Payment failed', {
      requestId,
      userId,
      invoiceId: invoice.id,
      amount: invoice.amount_due
    })

  } catch (error) {
    logger.error('Failed to handle payment failed', {
      requestId,
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleTrialWillEnd(subscription: any, requestId: string) {
  try {
    const userId = subscription.metadata?.user_id
    if (!userId) return

    const trialEndDate = new Date(subscription.trial_end * 1000)
    const tier = mapStripePriceToTier(subscription.items.data[0].price.id)

    // Send trial ending email
    await sendTrialEndingEmail(userId, tier!, trialEndDate)

    logger.info('Trial ending notification sent', {
      requestId,
      userId,
      subscriptionId: subscription.id,
      trialEndDate: trialEndDate.toISOString()
    })

  } catch (error) {
    logger.error('Failed to handle trial will end', {
      requestId,
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Helper functions

async function verifyStripeWebhook(body: Buffer, signature: string): Promise<StripeWebhookEvent | null> {
  try {
    if (!signature) {
      logger.error('Webhook signature missing')
      return null
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error('Webhook secret not configured')
      return null
    }

    // Use Stripe's built-in signature verification
    const Stripe = require('stripe')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-08-16',
    })

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as StripeWebhookEvent
    return event

  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    
    req.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    
    req.on('error', (error) => {
      reject(error)
    })
  })
}

function mapStripePriceToTier(priceId: string): SubscriptionTier | null {
  const priceToTierMap: Record<string, SubscriptionTier> = {
    'price_starter_monthly_prod': 'starter',
    'price_starter_annual_prod': 'starter',
    'price_growth_monthly_prod': 'growth',
    'price_growth_annual_prod': 'growth',
    'price_professional_monthly_prod': 'professional',
    'price_professional_annual_prod': 'professional',
    'price_enterprise_monthly_prod': 'enterprise',
    'price_enterprise_annual_prod': 'enterprise'
  }

  return priceToTierMap[priceId] || null
}

// Database helper functions (mock implementations)

async function updateUserSubscription(params: {
  userId: string
  stripeSubscriptionId: string | null
  stripeCustomerId: string
  tier: SubscriptionTier
  status: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  trialEnd: Date | null
}): Promise<void> {
  // TODO: Implement database update
  // await db.users.update({
  //   where: { id: params.userId },
  //   data: {
  //     subscription_tier: params.tier,
  //     subscription_status: params.status,
  //     subscription_id: params.stripeSubscriptionId,
  //     stripe_customer_id: params.stripeCustomerId,
  //     current_period_start: params.currentPeriodStart,
  //     current_period_end: params.currentPeriodEnd,
  //     trial_ends_at: params.trialEnd,
  //     updated_at: new Date()
  //   }
  // })

  logger.info('User subscription updated', {
    userId: params.userId,
    tier: params.tier,
    status: params.status
  })
}

async function getUserById(userId: string): Promise<{ subscription_tier: string } | null> {
  // TODO: Implement database query
  // return await db.users.findFirst({ where: { id: userId } })
  
  // Mock user data
  return { subscription_tier: 'free' }
}

async function recordSuccessfulPayment(params: {
  userId: string
  subscriptionId: string
  stripeInvoiceId: string
  amount: number
  currency: string
  paidAt: Date
  periodStart: Date
  periodEnd: Date
}): Promise<void> {
  // TODO: Implement database save
  // await db.payments.create({
  //   data: {
  //     user_id: params.userId,
  //     subscription_id: params.subscriptionId,
  //     stripe_invoice_id: params.stripeInvoiceId,
  //     amount: params.amount,
  //     currency: params.currency,
  //     status: 'succeeded',
  //     payment_type: 'subscription',
  //     period_start: params.periodStart,
  //     period_end: params.periodEnd,
  //     created_at: params.paidAt
  //   }
  // })

  logger.info('Payment recorded', {
    userId: params.userId,
    amount: params.amount,
    currency: params.currency
  })
}

async function recordFailedPayment(params: {
  userId: string
  stripeInvoiceId: string
  amount: number
  currency: string
  failedAt: Date
  nextRetryAt: Date | null
}): Promise<void> {
  // TODO: Implement database save and notification
  logger.warn('Payment failed recorded', {
    userId: params.userId,
    amount: params.amount,
    nextRetryAt: params.nextRetryAt?.toISOString()
  })
}

async function handlePastDueSubscription(userId: string, subscriptionId: string): Promise<void> {
  // TODO: Implement business logic for past due subscriptions
  // - Limit access to paid features
  // - Send dunning emails
  // - Update user status
  
  logger.warn('Subscription past due', { userId, subscriptionId })
}

async function handleCanceledSubscription(userId: string, subscriptionId: string): Promise<void> {
  // TODO: Implement cancellation logic
  // - Schedule data export
  // - Send feedback survey
  // - Mark subscription as canceled
  
  logger.info('Subscription canceled', { userId, subscriptionId })
}

// Email notification functions (mock implementations)

async function sendWelcomeEmail(userId: string, tier: SubscriptionTier): Promise<void> {
  logger.info('Welcome email sent', { userId, tier })
}

async function sendTierChangeEmail(userId: string, fromTier: SubscriptionTier, toTier: SubscriptionTier): Promise<void> {
  logger.info('Tier change email sent', { userId, fromTier, toTier })
}

async function sendCancellationEmail(userId: string, previousTier: SubscriptionTier): Promise<void> {
  logger.info('Cancellation email sent', { userId, previousTier })
}

async function sendPaymentFailedEmail(userId: string, amount: number, currency: string): Promise<void> {
  logger.info('Payment failed email sent', { userId, amount, currency })
}

async function sendTrialEndingEmail(userId: string, tier: SubscriptionTier, trialEndDate: Date): Promise<void> {
  logger.info('Trial ending email sent', { userId, tier, trialEndDate: trialEndDate.toISOString() })
}