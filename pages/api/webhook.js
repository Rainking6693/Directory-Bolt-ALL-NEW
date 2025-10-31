// 🔔 DIRECTORYBOLT WEBHOOK HANDLER
// POST /api/webhook - Handle Stripe webhook events for DirectoryBolt payments and subscriptions
// Supports both one-time package purchases and subscription services

import { log } from '../../lib/utils/logger';
import { 
  CORE_PACKAGES, 
  SUBSCRIPTION_SERVICES, 
  ADD_ONS,
  getOrderSummary
} from '../../lib/config/directoryBoltProducts';

// Critical environment variable validation for security
if (process.env.NODE_ENV === 'production') {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('🚨 CRITICAL: STRIPE_SECRET_KEY environment variable is required in production');
    process.exit(1);
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('🚨 CRITICAL: STRIPE_WEBHOOK_SECRET environment variable is required for webhook security');
    console.error('Without webhook secret verification, your application is vulnerable to webhook spoofing attacks');
    process.exit(1);
  }
  
  // Validate webhook secret format
  if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    console.error('🚨 CRITICAL: STRIPE_WEBHOOK_SECRET must start with "whsec_" - invalid format detected');
    process.exit(1);
  }
  
  console.log('✅ Webhook security validation passed - environment variables properly configured');
}

// Initialize Stripe client safely
let stripe = null;

function getStripeClientSafe() {
  try {
    const { getStripeClient } = require('../../lib/utils/stripe-client');
    return getStripeClient();
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
  const requestId = `webhook_db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set JSON content type header
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed', request_id: requestId });
  }

  // Initialize Stripe configuration at request time
  stripe = getStripeClientSafe();
  
  if (!stripe) {
    console.log('Stripe configuration invalid - returning mock webhook response:', {
      request_id: requestId
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
    // Enhanced webhook signature verification with security logging
    const { verifyWebhookSignature } = require('../../lib/utils/stripe-client');
    
    // Critical security check: Ensure we have a signature
    if (!sig) {
      log('error', 'DirectoryBolt webhook rejected - missing signature header', {
        request_id: requestId,
        security_alert: 'Webhook without signature detected - potential spoofing attempt',
        user_agent: req.headers['user-agent'] || 'unknown',
        source_ip: req.ip || req.connection?.remoteAddress || 'unknown'
      });
      
      console.error(`🚨 DirectoryBolt webhook SECURITY ALERT: Missing signature header`);
      return res.status(400).json({ 
        error: 'Missing signature - webhook rejected for security',
        request_id: requestId 
      });
    }

    // Verify signature with enhanced security features
    event = verifyWebhookSignature(buf, sig, null, req);
    
    log('info', 'DirectoryBolt webhook signature verified successfully', {
      event_type: event.type,
      event_id: event.id,
      request_id: requestId,
      signature_validated: true,
      security_status: 'verified'
    });
    
    console.log(`✅ DirectoryBolt webhook signature verified: ${event.type}`, { 
      event_id: event.id,
      request_id: requestId 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Enhanced security logging for failed verification attempts
    log('error', 'DirectoryBolt webhook signature verification FAILED', {
      error: errorMessage,
      request_id: requestId,
      has_signature: !!sig,
      signature_preview: sig ? sig.substring(0, 20) + '...' : 'none',
      body_size: buf.length,
      user_agent: req.headers['user-agent'] || 'unknown',
      source_ip: req.ip || req.connection?.remoteAddress || 'unknown',
      security_alert: 'Failed webhook verification - potential attack',
      timestamp: new Date().toISOString()
    });
    
    console.error(`🚨 DirectoryBolt SECURITY ALERT - Webhook verification failed:`, {
      error: errorMessage,
      request_id: requestId,
      security_context: 'webhook_spoofing_attempt_detected'
    });
    
    return res.status(400).json({ 
      error: 'Webhook signature verification failed',
      request_id: requestId,
      security_note: 'Request rejected for security reasons'
    });
  }

  try {
    // Handle different event types
    switch (event.type) {
      // One-time payment events
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, requestId);
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, requestId);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, requestId);
        break;
      
      // Subscription events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, requestId);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, requestId);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, requestId);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, requestId);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, requestId);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleSubscriptionTrialWillEnd(event.data.object, requestId);
        break;
        
      default:
        console.log(`ℹ️ Unhandled DirectoryBolt event type: ${event.type}`);
    }

    // Log successful webhook processing
    console.log(`✅ DirectoryBolt webhook processed successfully:`, {
      event_type: event.type,
      event_id: event.id,
      request_id: requestId
    });

    res.status(200).json({ 
      received: true, 
      event_type: event.type,
      request_id: requestId 
    });

  } catch (error) {
    console.error(`❌ DirectoryBolt webhook processing error:`, {
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

// Handle successful checkout session completion
async function handleCheckoutSessionCompleted(session, requestId) {
  const customerId = session.customer;
  const sessionId = session.id;
  const mode = session.mode; // 'payment' or 'subscription'

  console.log(`🎯 DirectoryBolt checkout completed:`, {
    session_id: sessionId,
    customer_id: customerId,
    mode: mode,
    amount_total: session.amount_total,
    currency: session.currency,
    payment_status: session.payment_status,
    request_id: requestId
  });

  if (mode === 'payment') {
    // One-time package purchase
    const packageId = session.metadata.package_id;
    const addOns = session.metadata.add_ons ? session.metadata.add_ons.split(',') : [];
    const totalDirectories = parseInt(session.metadata.total_directories || '0');

    console.log(`💰 DirectoryBolt package purchased:`, {
      session_id: sessionId,
      customer_id: customerId,
      package: packageId,
      add_ons: addOns,
      total_directories: totalDirectories,
      amount: session.amount_total
    });

    // Process package purchase
    await processPackagePurchase({
      session_id: sessionId,
      customer_id: customerId,
      package_id: packageId,
      add_ons: addOns,
      total_directories: totalDirectories,
      amount_paid: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      custom_fields: session.custom_fields
    });

  } else if (mode === 'subscription') {
    // Subscription service
    const service = session.metadata.service;
    const subscriptionId = session.subscription;

    console.log(`🔄 DirectoryBolt subscription started:`, {
      session_id: sessionId,
      customer_id: customerId,
      service: service,
      subscription_id: subscriptionId
    });

    // Initial subscription setup is handled by subscription.created event
    // This is mainly for tracking and analytics
  }

  // Send confirmation email
  await sendPurchaseConfirmationEmail(session);
}

// Handle successful payment intent (for one-time purchases)
async function handlePaymentIntentSucceeded(paymentIntent, requestId) {
  const customerId = paymentIntent.customer;
  const packageId = paymentIntent.metadata.package_id;
  const addOns = paymentIntent.metadata.add_ons ? paymentIntent.metadata.add_ons.split(',') : [];

  console.log(`💳 DirectoryBolt payment succeeded:`, {
    payment_intent_id: paymentIntent.id,
    customer_id: customerId,
    package: packageId,
    add_ons: addOns,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    request_id: requestId
  });

  // Update order status to paid and start processing
  await updateOrderStatus({
    payment_intent_id: paymentIntent.id,
    customer_id: customerId,
    package_id: packageId,
    add_ons: addOns,
    status: 'paid',
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  });
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent, requestId) {
  const customerId = paymentIntent.customer;
  const packageId = paymentIntent.metadata.package_id;

  console.log(`💸 DirectoryBolt payment failed:`, {
    payment_intent_id: paymentIntent.id,
    customer_id: customerId,
    package: packageId,
    last_payment_error: paymentIntent.last_payment_error,
    request_id: requestId
  });

  // Send payment failure notification
  await sendPaymentFailureEmail(paymentIntent);
}

// Handle new subscription creation
async function handleSubscriptionCreated(subscription, requestId) {
  const customerId = subscription.customer;
  const service = subscription.metadata.service;
  const serviceName = subscription.metadata.service_name;

  console.log(`🎉 DirectoryBolt subscription created:`, {
    subscription_id: subscription.id,
    customer_id: customerId,
    service: service,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    request_id: requestId
  });

  // Update customer record with subscription details
  await updateCustomerSubscription({
    customer_id: customerId,
    subscription_id: subscription.id,
    service: service,
    service_name: serviceName,
    status: subscription.status,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000)
  });

  // Send subscription welcome email
  await sendSubscriptionWelcomeEmail(subscription);
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription, requestId) {
  const customerId = subscription.customer;
  const service = subscription.metadata.service;

  console.log(`🔄 DirectoryBolt subscription updated:`, {
    subscription_id: subscription.id,
    customer_id: customerId,
    service: service,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    request_id: requestId
  });

  // Update subscription details
  await updateCustomerSubscription({
    customer_id: customerId,
    subscription_id: subscription.id,
    service: service,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000)
  });

  // Handle subscription cancellation
  if (subscription.cancel_at_period_end) {
    await sendSubscriptionCancellationEmail(subscription);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription, requestId) {
  const customerId = subscription.customer;
  const service = subscription.metadata.service;

  console.log(`❌ DirectoryBolt subscription deleted:`, {
    subscription_id: subscription.id,
    customer_id: customerId,
    service: service,
    ended_at: new Date(subscription.ended_at * 1000),
    request_id: requestId
  });

  // Mark subscription as cancelled
  await updateCustomerSubscription({
    customer_id: customerId,
    subscription_id: subscription.id,
    service: service,
    status: 'cancelled',
    ended_at: new Date(subscription.ended_at * 1000)
  });

  // Send subscription ended email
  await sendSubscriptionEndedEmail(subscription);
}

// Handle successful invoice payment (subscription renewals)
async function handleInvoicePaymentSucceeded(invoice, requestId) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return; // Not a subscription payment
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = subscription.customer;
  const service = subscription.metadata.service;

  console.log(`💰 DirectoryBolt subscription payment succeeded:`, {
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
    customer_id: customerId,
    service: service,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    period_start: new Date(invoice.period_start * 1000),
    period_end: new Date(invoice.period_end * 1000),
    request_id: requestId
  });

  // Update subscription period
  await updateSubscriptionPeriod({
    customer_id: customerId,
    subscription_id: subscriptionId,
    service: service,
    period_start: new Date(invoice.period_start * 1000),
    period_end: new Date(invoice.period_end * 1000),
    amount_paid: invoice.amount_paid,
    currency: invoice.currency
  });

  // Send payment confirmation
  await sendSubscriptionPaymentConfirmation(invoice, subscription);
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice, requestId) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return; // Not a subscription payment
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = subscription.customer;
  const service = subscription.metadata.service;

  console.log(`💸 DirectoryBolt subscription payment failed:`, {
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
    customer_id: customerId,
    service: service,
    amount_due: invoice.amount_due,
    attempt_count: invoice.attempt_count,
    next_payment_attempt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : null,
    request_id: requestId
  });

  // Update subscription status to past_due
  await updateCustomerSubscription({
    customer_id: customerId,
    subscription_id: subscriptionId,
    service: service,
    status: 'past_due'
  });

  // Send payment failed notification
  await sendSubscriptionPaymentFailedEmail(invoice, subscription);
}

// Handle subscription trial ending soon
async function handleSubscriptionTrialWillEnd(subscription, requestId) {
  const customerId = subscription.customer;
  const service = subscription.metadata.service;

  console.log(`⏰ DirectoryBolt trial ending soon:`, {
    subscription_id: subscription.id,
    customer_id: customerId,
    service: service,
    trial_end: new Date(subscription.trial_end * 1000),
    request_id: requestId
  });

  // Send trial ending notification
  await sendTrialEndingEmail(subscription);
}

// Database helper functions

/**
 * Queue directory submissions for a customer after successful purchase
 * This function creates a master job and individual submission tasks for the AI worker poller
 */
async function queueSubmissionsForCustomer({ customerUuid, customerCode, businessData, packageTier, packageSize }) {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  if (!customerCode) {
    throw new Error('Customer is missing external customer_id (DB identifier)');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: newJob, error: jobError } = await supabase
    .from('jobs')
    .insert({
      customer_id: customerCode, // legacy string code
      customer_uuid: customerUuid, // new UUID FK for consistency
      package_size: packageSize,
      package_type: packageTier,
      directory_limit: packageSize,
      status: 'pending',
      priority_level: 4,
      customer_name: businessData.business_name || 'Customer',
      customer_email: businessData.email || '',
      business_data: businessData,
      metadata: {
        customer_uuid: customerUuid,
        raw_business_data: businessData
      }
    })
    .select('id')
    .single();

  if (jobError) {
    console.error('❌ Error creating customer job:', jobError);
    throw jobError;
  }

  const newCustomerJobId = newJob.id;
  console.log('? Master job created: ' + newCustomerJobId);

  const tierMap = {
    starter: 1,
    growth: 2,
    professional: 3,
    enterprise: 5
  };
  const tierNumber = tierMap[packageTier] || 2;

  const { data: directoriesToSubmit, error: dirError } = await supabase
    .from('directories')
    .select('id, name, website, submission_url, tier_required, active, domain_authority')
    .eq('active', true)
    .lte('tier_required', tierNumber)
    .order('domain_authority', { ascending: false })
    .limit(packageSize);

  if (dirError) {
    console.error('❌ Error selecting directories:', dirError);
    throw dirError;
  }

  console.log('?? Selected ' + directoriesToSubmit.length + ' directories for tier ' + packageTier);

  const submissionsToInsert = directoriesToSubmit
    .map(directory => {
      const directoryUrl = directory.submission_url || directory.website;

      if (!directoryUrl) {
        console.warn('⚠️ Directory ' + directory.id + ' (' + directory.name + ') has no URL. Skipping.');
        return null;
      }

      return {
        directory_url: directoryUrl,
        status: 'pending',
        submission_queue_id: newCustomerJobId, // link to jobs.id
        customer_id: customerUuid,            // link to customers.id (UUID)
        listing_data: businessData            // per-submission payload
      };
    })
    .filter(Boolean);

  if (submissionsToInsert.length === 0) {
    console.error('❌ No directories with URLs available to queue.');
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: 'No directories with URLs available to queue'
      })
      .eq('id', newCustomerJobId);

    return {
      jobId: newCustomerJobId,
      directoriesQueued: 0
    };
  }

  const { error: submissionError } = await supabase
    .from('directory_submissions')
    .insert(submissionsToInsert);

  if (submissionError) {
    console.error('❌ Error inserting submissions:', submissionError);
    throw submissionError;
  }

  console.log('? Successfully queued ' + submissionsToInsert.length + ' submissions for job ' + newCustomerJobId);

  return {
    jobId: newCustomerJobId,
    directoriesQueued: submissionsToInsert.length
  };
}

async function processPackagePurchase(data) {
  console.log('?? Processing DirectoryBolt package purchase:', data);
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const customerEmail = data.custom_fields?.email || '';
    let customerUuid = null;
    let customerCode = null;
    
    if (customerEmail) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, customer_id')
        .eq('email', customerEmail)
        .single();
      
      if (existingCustomer) {
        customerUuid = existingCustomer.id;
        customerCode = existingCustomer.customer_id;
        console.log('?? Found existing customer: ' + customerUuid + ' (' + customerCode + ')');
      }
    }
    
    if (!customerUuid) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          email: customerEmail,
          full_name: `${data.custom_fields?.first_name || ''} ${data.custom_fields?.last_name || ''}`.trim() || 'Customer',
          company_name: data.custom_fields?.business_name || '',
          business_data: {
            phone: data.custom_fields?.phone || '',
            website: data.custom_fields?.website || '',
            address: data.custom_fields?.address || '',
            city: data.custom_fields?.city || '',
            state: data.custom_fields?.state || '',
            zip: data.custom_fields?.zip || '',
            category: data.custom_fields?.category || '',
            description: data.custom_fields?.description || ''
          },
          subscription_tier: data.package_id || 'growth',
          subscription_status: 'active',
          password_hash: 'STRIPE_CUSTOMER',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, customer_id')
        .single();
      
      if (customerError) {
        console.error('❌ Error creating customer:', customerError);
        throw customerError;
      }
      
      customerUuid = newCustomer.id;
      customerCode = newCustomer.customer_id;
      console.log('?? New customer created: ' + customerUuid + ' (' + customerCode + ')');
    }
    
    if (!customerCode) {
      throw new Error('Customer record missing customer_id (DB identifier)');
    }
    
    const businessData = {
      business_name: data.custom_fields?.business_name || '',
      email: data.custom_fields?.email || '',
      phone: data.custom_fields?.phone || '',
      website: data.custom_fields?.website || '',
      address: data.custom_fields?.address || '',
      city: data.custom_fields?.city || '',
      state: data.custom_fields?.state || '',
      zip: data.custom_fields?.zip || '',
      category: data.custom_fields?.category || '',
      description: data.custom_fields?.description || ''
    };
    
    const packageTier = data.package_id || 'growth';
    const packageSize = parseInt(data.total_directories || '100', 10);
    
    const queueResult = await queueSubmissionsForCustomer({
      customerUuid,
      customerCode,
      businessData,
      packageTier,
      packageSize
    });
    
    console.log('?? Package purchase processed successfully');
    console.log('   Customer UUID: ' + customerUuid);
    console.log('   Customer Code: ' + customerCode);
    console.log('   Master Job ID: ' + queueResult.jobId);
    console.log('   Directories Queued: ' + queueResult.directoriesQueued);
    
    return {
      success: true,
      customerId: customerUuid,
      customerCode,
      jobId: queueResult.jobId,
      directories: queueResult.directoriesQueued
    };
    
  } catch (error) {
    console.error('❌ Failed to process package purchase:', error);
    throw error;
  }
}

async function updateOrderStatus(data) {
  console.log(`💾 Updating DirectoryBolt order status:`, data);
  
  // TODO: Implement order status update
}

async function updateCustomerSubscription(data) {
  console.log(`💾 Updating DirectoryBolt customer subscription:`, data);
  
  // TODO: Implement subscription update
}

async function updateSubscriptionPeriod(data) {
  console.log(`💾 Updating DirectoryBolt subscription period:`, data);
  
  // TODO: Implement subscription period update
}

// Email helper functions (TODO: Implement with email service)

async function sendPurchaseConfirmationEmail(session) {
  console.log(`📧 Sending DirectoryBolt purchase confirmation:`, {
    session_id: session.id,
    customer_email: session.customer_details?.email
  });
  // TODO: Implement email sending
}

async function sendPaymentFailureEmail(paymentIntent) {
  console.log(`📧 Sending DirectoryBolt payment failure email:`, {
    payment_intent_id: paymentIntent.id
  });
  // TODO: Implement email sending
}

async function sendSubscriptionWelcomeEmail(subscription) {
  console.log(`📧 Sending DirectoryBolt subscription welcome email:`, {
    subscription_id: subscription.id
  });
  // TODO: Implement email sending
}

async function sendSubscriptionCancellationEmail(subscription) {
  console.log(`📧 Sending DirectoryBolt subscription cancellation email:`, {
    subscription_id: subscription.id
  });
  // TODO: Implement email sending
}

async function sendSubscriptionEndedEmail(subscription) {
  console.log(`📧 Sending DirectoryBolt subscription ended email:`, {
    subscription_id: subscription.id
  });
  // TODO: Implement email sending
}

async function sendSubscriptionPaymentConfirmation(invoice, subscription) {
  console.log(`📧 Sending DirectoryBolt subscription payment confirmation:`, {
    invoice_id: invoice.id,
    subscription_id: subscription.id
  });
  // TODO: Implement email sending
}

async function sendSubscriptionPaymentFailedEmail(invoice, subscription) {
  console.log(`📧 Sending DirectoryBolt subscription payment failed email:`, {
    invoice_id: invoice.id,
    subscription_id: subscription.id
  });
  // TODO: Implement email sending
}

async function sendTrialEndingEmail(subscription) {
  console.log(`📧 Sending DirectoryBolt trial ending email:`, {
    subscription_id: subscription.id
  });
  // TODO: Implement email sending
}