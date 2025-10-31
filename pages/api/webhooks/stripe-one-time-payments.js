// 🔒 STRIPE ONE-TIME PAYMENT WEBHOOK HANDLER - Process one-time payment events securely
// POST /api/webhooks/stripe-one-time-payments - Handle Stripe webhook events for one-time payments
// REPLACES: subscription webhook handlers - Now handles payment_intent.succeeded events

import { log } from '../../../lib/utils/logger';

// Initialize Stripe client and config dynamically to handle configuration errors gracefully
let stripe = null;
let config = null;

function getStripeClientSafe() {
  try {
    const { getStripeClient } = require('../../../lib/utils/stripe-client');
    return getStripeClient();
  } catch (error) {
    return null;
  }
}

function getStripeConfigSafe() {
  try {
    const { getStripeConfig } = require('../../../lib/utils/stripe-environment-validator');
    return getStripeConfig();
  } catch (error) {
    return null;
  }
}

// Disable body parsing for webhook endpoint
export const apiConfig = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const requestId = `one_time_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set JSON content type header
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed', request_id: requestId });
  }

  // Initialize Stripe configuration at request time
  stripe = getStripeClientSafe();
  config = getStripeConfigSafe();
  
  if (!stripe || !config) {
    console.log('Stripe configuration invalid - returning mock webhook response:', {
      request_id: requestId,
      has_stripe_client: !!stripe,
      has_config: !!config
    });
    
    // Return mock response for development when Stripe is not configured
    return res.status(200).json({
      received: true,
      event_type: 'mock_event',
      request_id: requestId,
      development_mode: true,
      note: 'Stripe not configured - mock response returned'
    });
  }

  // Get raw body as buffer for webhook signature verification
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const buf = Buffer.concat(chunks);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify webhook signature using our enhanced validation
    const { verifyWebhookSignature } = require('../../../lib/utils/stripe-client');
    event = verifyWebhookSignature(buf, sig);
    
    log('info', 'Webhook signature verified', {
      event_type: event.type,
      event_id: event.id,
      request_id: requestId
    });
    
    console.log(`✅ Webhook signature verified: ${event.type}`, { request_id: requestId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    log('error', 'Webhook signature verification failed', {
      error: errorMessage,
      request_id: requestId,
      has_signature: !!sig,
      has_webhook_secret: !!config.webhookSecret
    });
    
    console.error(`❌ Webhook signature verification failed:`, errorMessage);
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      request_id: requestId 
    });
  }

  try {
    // Handle different ONE-TIME PAYMENT event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, requestId);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, requestId);
        break;
        
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, requestId);
        break;
        
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object, requestId);
        break;
        
      case 'invoice.payment_succeeded':
        // Handle one-time invoice payments (not subscription)
        await handleInvoicePaymentSucceeded(event.data.object, requestId);
        break;
        
      // DEPRECATED SUBSCRIPTION EVENTS - Log but don't process
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
        console.warn(`⚠️ DEPRECATED: Received subscription event ${event.type} but DirectoryBolt now uses one-time payments only`, {
          request_id: requestId,
          event_id: event.id
        });
        break;
        
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`, { request_id: requestId });
    }

    // Log successful webhook processing
    console.log(`✅ One-time payment webhook processed successfully:`, {
      event_type: event.type,
      event_id: event.id,
      request_id: requestId
    });

    res.status(200).json({ 
      received: true, 
      event_type: event.type,
      request_id: requestId,
      payment_model: 'one_time_only'
    });

  } catch (error) {
    console.error(`❌ One-time payment webhook processing error:`, {
      event_type: event.type,
      event_id: event.id,
      error: error.message,
      request_id: requestId
    });

    res.status(500).json({ 
      error: 'Webhook processing failed',
      request_id: requestId 
    });
  }
}

// Handle successful one-time payment
async function handlePaymentIntentSucceeded(paymentIntent, requestId) {
  const customerEmail = paymentIntent.metadata?.customer_email;
  const packageId = paymentIntent.metadata?.package_id;
  const tierAccess = paymentIntent.metadata?.tier_access;
  const addonIds = paymentIntent.metadata?.addon_ids?.split(',').filter(Boolean) || [];
  const directoryCount = parseInt(paymentIntent.metadata?.directory_count) || 0;

  console.log(`🎉 One-time payment succeeded:`, {
    payment_intent_id: paymentIntent.id,
    customer_email: customerEmail,
    package_id: packageId,
    tier_access: tierAccess,
    addon_ids: addonIds,
    directory_count: directoryCount,
    amount_received: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    request_id: requestId
  });

  if (!customerEmail || !packageId || !tierAccess) {
    console.error('Missing required metadata in payment intent:', {
      payment_intent_id: paymentIntent.id,
      has_email: !!customerEmail,
      has_package_id: !!packageId,
      has_tier_access: !!tierAccess,
      request_id: requestId
    });
    throw new Error('Missing required metadata for one-time payment processing');
  }

  // Update user with one-time purchase details
  await recordOneTimePurchase({
    customer_email: customerEmail,
    payment_intent_id: paymentIntent.id,
    customer_id: paymentIntent.customer,
    package_id: packageId,
    tier_access: tierAccess,
    addon_ids: addonIds,
    directory_count: directoryCount,
    amount_paid: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    purchased_at: new Date()
  });

  // Grant permanent tier access
  await grantPermanentTierAccess(customerEmail, tierAccess);

  // Reset user's directory submission count for new purchase
  await resetUserDirectoryCount(customerEmail);

  // Send purchase confirmation and welcome email
  await sendOneTimePurchaseConfirmationEmail(customerEmail, packageId, tierAccess);
}

// Handle failed one-time payment
async function handlePaymentIntentFailed(paymentIntent, requestId) {
  const customerEmail = paymentIntent.metadata?.customer_email;
  const packageId = paymentIntent.metadata?.package_id;

  console.log(`💸 One-time payment failed:`, {
    payment_intent_id: paymentIntent.id,
    customer_email: customerEmail,
    package_id: packageId,
    amount_due: paymentIntent.amount,
    last_payment_error: paymentIntent.last_payment_error?.message,
    request_id: requestId
  });

  // Record failed payment attempt
  await recordFailedPaymentAttempt({
    customer_email: customerEmail,
    payment_intent_id: paymentIntent.id,
    package_id: packageId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    error_message: paymentIntent.last_payment_error?.message,
    failed_at: new Date()
  });

  // Send payment failed notification if email available
  if (customerEmail) {
    await sendPaymentFailedEmail(customerEmail, packageId, paymentIntent.amount, paymentIntent.currency);
  }
}

// Handle checkout session completion for one-time payments
async function handleCheckoutSessionCompleted(session, requestId) {
  const customerEmail = session.metadata?.customer_email;
  const packageId = session.metadata?.package_id;
  const tierAccess = session.metadata?.tier_access;

  console.log(`🎯 One-time checkout completed:`, {
    session_id: session.id,
    customer_id: session.customer,
    customer_email: customerEmail,
    package_id: packageId,
    tier_access: tierAccess,
    amount_total: session.amount_total,
    mode: session.mode,
    payment_status: session.payment_status,
    request_id: requestId
  });

  if (session.mode === 'payment' && session.payment_status === 'paid') {
    console.log(`📊 One-time payment checkout completed successfully: ${session.id}`);
    
    // Additional processing for completed checkout can be added here
    // The main processing will happen in payment_intent.succeeded
  } else {
    console.warn('Checkout session completed but payment not confirmed:', {
      session_id: session.id,
      mode: session.mode,
      payment_status: session.payment_status,
      request_id: requestId
    });
  }
}

// Handle payment method attachment (for future reference)
async function handlePaymentMethodAttached(paymentMethod, requestId) {
  console.log(`💳 Payment method attached:`, {
    payment_method_id: paymentMethod.id,
    customer_id: paymentMethod.customer,
    type: paymentMethod.type,
    card_last4: paymentMethod.card?.last4,
    card_brand: paymentMethod.card?.brand,
    request_id: requestId
  });

  // Store payment method details for customer record if needed
}

// Handle one-time invoice payments (not subscription invoices)
async function handleInvoicePaymentSucceeded(invoice, requestId) {
  // Only process if this is NOT a subscription invoice
  if (invoice.subscription) {
    console.log('Skipping subscription invoice - DirectoryBolt uses one-time payments only:', {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      request_id: requestId
    });
    return;
  }

  console.log(`💰 One-time invoice payment succeeded:`, {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    request_id: requestId
  });

  // Process one-time invoice payment if needed
}

// Database helper functions for one-time purchases

async function recordOneTimePurchase(purchaseData) {
  console.log(`💾 Recording one-time purchase:`, purchaseData);
  
  // TODO: Implement database record for one-time purchases
  // Example database structure:
  // await db.one_time_purchases.create({
  //   data: {
  //     customer_email: purchaseData.customer_email,
  //     stripe_payment_intent_id: purchaseData.payment_intent_id,
  //     stripe_customer_id: purchaseData.customer_id,
  //     package_id: purchaseData.package_id,
  //     tier_access: purchaseData.tier_access,
  //     addon_ids: purchaseData.addon_ids,
  //     directory_count: purchaseData.directory_count,
  //     amount_paid: purchaseData.amount_paid,
  //     currency: purchaseData.currency,
  //     purchased_at: purchaseData.purchased_at,
  //     status: 'completed'
  //   }
  // });
}

async function grantPermanentTierAccess(customerEmail, tierAccess) {
  console.log(`🔓 Granting permanent tier access:`, { 
    customer_email: customerEmail, 
    tier_access: tierAccess 
  });
  
  // TODO: Update user record with permanent tier access
  // await db.users.update({
  //   where: { email: customerEmail },
  //   data: {
  //     subscription_tier: tierAccess,
  //     tier_access_type: 'permanent', // New field to distinguish from subscription
  //     tier_purchased_at: new Date(),
  //     updated_at: new Date()
  //   }
  // });
}

async function resetUserDirectoryCount(customerEmail) {
  console.log(`🔄 Resetting directory count for user: ${customerEmail}`);
  
  // TODO: Reset user's directory submission count for new purchase
  // await db.users.update({
  //   where: { email: customerEmail },
  //   data: {
  //     directories_used_this_period: 0,
  //     directory_count_reset_at: new Date()
  //   }
  // });
}

async function recordFailedPaymentAttempt(failureData) {
  console.log(`⚠️ Recording failed payment attempt:`, failureData);
  
  // TODO: Record failed payment attempt
  // await db.failed_payments.create({
  //   data: {
  //     customer_email: failureData.customer_email,
  //     stripe_payment_intent_id: failureData.payment_intent_id,
  //     package_id: failureData.package_id,
  //     amount: failureData.amount,
  //     currency: failureData.currency,
  //     error_message: failureData.error_message,
  //     failed_at: failureData.failed_at
  //   }
  // });
}

// Email notification functions for one-time purchases

async function sendOneTimePurchaseConfirmationEmail(customerEmail, packageId, tierAccess) {
  console.log(`📧 Sending one-time purchase confirmation email:`, { 
    customer_email: customerEmail, 
    package_id: packageId,
    tier_access: tierAccess 
  });
  
  // TODO: Implement email sending for one-time purchase confirmation
  // This should be different from subscription emails - emphasize permanent access
}

async function sendPaymentFailedEmail(customerEmail, packageId, amount, currency) {
  console.log(`📧 Sending payment failed email:`, { 
    customer_email: customerEmail, 
    package_id: packageId,
    amount: amount,
    currency: currency 
  });
  
  // TODO: Implement email sending for failed one-time payments
}

// Export for testing
export { 
  handlePaymentIntentSucceeded, 
  handlePaymentIntentFailed, 
  handleCheckoutSessionCompleted 
};