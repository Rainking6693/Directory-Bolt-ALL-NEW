// 🔒 STRIPE CHECKOUT SESSION RETRIEVAL - Get completed checkout session details
// GET /api/checkout-session/[sessionId] - Retrieve Stripe checkout session details for success page

import Stripe from 'stripe';
import { handleApiError } from '../../../lib/utils/errors';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export default async function handler(req, res) {
  const requestId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ));
    }

    await handleGetCheckoutSession(req, res, requestId);

  } catch (error) {
    console.error('Checkout session retrieval error:', error);
    const errorResponse = handleApiError(error, requestId);
    return res.status(errorResponse.error.statusCode || 500).json(errorResponse);
  }
}

async function handleGetCheckoutSession(req, res, requestId) {
  const { sessionId } = req.query;

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'payment_intent']
    });

    // Validate session status
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      throw new Error('Payment not completed');
    }

    let planName = 'DirectoryBolt Package';
    let trialEnd = null;
    let nextBillingDate = null;
    let subscriptionId = null;

    // Handle DirectoryBolt packages (one-time payments)
    if (session.metadata?.package_id) {
      const packageMap = {
        'starter': 'Starter Package',
        'growth': 'Growth Package', 
        'pro': 'Pro Package'
      };
      planName = packageMap[session.metadata.package_id] || 'DirectoryBolt Package';
    }

    // Get subscription details if it's a subscription
    if (session.subscription) {
      subscriptionId = session.subscription.id;
      const subscription = typeof session.subscription === 'string' 
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

      // Handle subscription services
      if (subscription.metadata?.service === 'auto_update') {
        planName = 'Auto Update & Resubmission';
      } else {
        // Legacy plan handling
        const planTier = subscription.metadata?.plan_tier || 'unknown';
        const planMap = {
          'starter': 'Starter Plan',
          'growth': 'Growth Plan', 
          'professional': 'Professional Plan',
          'enterprise': 'Enterprise Plan'
        };
        planName = planMap[planTier] || 'Subscription Plan';
      }

      // Set trial and billing dates
      trialEnd = subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;
      nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
    }

    // Get customer details
    const customer = typeof session.customer === 'string'
      ? await stripe.customers.retrieve(session.customer)
      : session.customer;

    console.log(`✅ Checkout session retrieved:`, {
      session_id: sessionId,
      customer_email: customer.email,
      plan_name: planName,
      amount_total: session.amount_total,
      payment_status: session.payment_status,
      subscription_id: subscriptionId,
      request_id: requestId
    });

    // Return session details
    res.status(200).json({
      success: true,
      session: {
        id: sessionId,
        status: session.status,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        },
        payment_intent: {
          id: session.payment_intent?.id || null,
          amount: session.amount_total,
          currency: session.currency || 'usd'
        },
        metadata: session.metadata || {}
      },
      data: {
        session_id: sessionId,
        customer_email: customer.email,
        customer_id: customer.id,
        plan_name: planName,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        trial_end: trialEnd,
        next_billing_date: nextBillingDate,
        subscription_id: subscriptionId,
        created: new Date(session.created * 1000).toISOString()
      },
      requestId
    });

  } catch (stripeError) {
    console.error('Stripe session retrieval error:', {
      session_id: sessionId,
      error: stripeError.message,
      stripe_error_code: stripeError.code,
      stripe_error_type: stripeError.type,
      request_id: requestId
    });

    // Handle specific Stripe errors
    if (stripeError.code === 'resource_missing') {
      throw new Error('Checkout session not found');
    }

    throw new Error(`Failed to retrieve session details: ${stripeError.message}`);
  }
}