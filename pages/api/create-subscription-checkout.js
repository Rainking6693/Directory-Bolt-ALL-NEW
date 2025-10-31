// 🚫 DEPRECATED: DIRECTORYBOLT SUBSCRIPTION CHECKOUT
// POST /api/create-subscription-checkout - DEPRECATED - DirectoryBolt now uses ONE-TIME PAYMENTS only
// This endpoint is deprecated as of the one-time payment migration
// Use /api/create-one-time-checkout instead

import { handleApiError, ValidationError, ApiError } from '../../lib/utils/errors';
import { log } from '../../lib/utils/logger';
import { 
  SUBSCRIPTION_SERVICES,
  validateStripeConfiguration
} from '../../lib/config/directoryBoltProducts';

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

export default async function handler(req, res) {
  // DEPRECATION NOTICE: This endpoint is no longer supported
  console.warn('DEPRECATED API called: /api/create-subscription-checkout - DirectoryBolt now uses one-time payments only');
  
  return res.status(410).json({
    error: 'Endpoint deprecated',
    code: 'SUBSCRIPTION_MODEL_DEPRECATED',
    message: 'DirectoryBolt now uses one-time payments only. Subscriptions are no longer supported.',
    migration: {
      use_instead: '/api/create-one-time-checkout',
      documentation: 'https://docs.directorybolt.com/one-time-payments',
      pricing_model: 'ONE_TIME_PURCHASE',
      tiers: {
        starter: '$149 one-time',
        growth: '$299 one-time', 
        professional: '$499 one-time',
        enterprise: '$799 one-time'
      }
    },
    timestamp: new Date().toISOString()
  });
  
  // Legacy code below - no longer executed
  const requestId = `sub_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set security headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Log incoming request
  console.log('Subscription checkout request:', {
    method: req.method,
    request_id: requestId,
    body: req.body,
    user_agent: req.headers['user-agent']?.substring(0, 100)
  });

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ));
    }

    // Initialize Stripe at request time
    stripe = getStripeClientSafe();
    
    if (!stripe) {
      console.log('Stripe not configured - returning development mode response');
      return res.status(200).json({
        success: true,
        development_mode: true,
        data: {
          checkout_session: {
            id: `cs_sub_mock_${Date.now()}`,
            url: `https://checkout.stripe.com/c/pay/mock_subscription_${Date.now()}`,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          },
          note: 'Development mode - Stripe not configured'
        },
        requestId
      });
    }

    await handleCreateSubscriptionCheckout(req, res, requestId);

  } catch (error) {
    console.error('Subscription checkout error:', {
      request_id: requestId,
      error_message: error.message,
      error_type: error.constructor.name,
      error_stack: error.stack
    });
    
    const errorResponse = handleApiError(error, requestId);
    return res.status(errorResponse.error.statusCode || 500).json(errorResponse);
  }
}

async function handleCreateSubscriptionCheckout(req, res, requestId) {
  // Parse and validate request body
  let parsedBody;
  try {
    parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      parsedBody = JSON.parse(parsedBody);
    }
  } catch (parseError) {
    console.error('JSON parsing error:', {
      request_id: requestId,
      parse_error: parseError.message
    });
    throw new ValidationError('Invalid JSON in request body', 'request_body');
  }

  const {
    service = 'auto_update', // Default to auto update service
    customer_email,
    customer_name,
    customer_id, // Existing customer ID if available
    success_url,
    cancel_url,
    trial_period_days = 14, // 14-day free trial
    metadata = {}
  } = parsedBody || {};

  // Validate required parameters
  if (!parsedBody) {
    throw new ValidationError('Request body is required', 'request_body');
  }

  if (!customer_email) {
    throw new ValidationError('Customer email is required', 'customer_email');
  }

  // Validate service exists
  if (!SUBSCRIPTION_SERVICES[service]) {
    throw new ValidationError(
      `Invalid service: ${service}. Available services: ${Object.keys(SUBSCRIPTION_SERVICES).join(', ')}`,
      'service'
    );
  }

  const selectedService = SUBSCRIPTION_SERVICES[service];

  // Check Stripe configuration
  const stripeConfig = validateStripeConfiguration();
  if (!stripeConfig.configured) {
    console.error('Stripe configuration error:', {
      request_id: requestId,
      missing: stripeConfig.missing,
      message: stripeConfig.message
    });
    throw new ApiError(stripeConfig.message, 503, 'STRIPE_CONFIG_MISSING');
  }

  try {
    // Test Stripe connectivity
    const { testStripeConnection } = require('../../lib/utils/stripe-client');
    const connectionTest = await testStripeConnection();
    if (!connectionTest.connected) {
      throw new Error(connectionTest.error || 'Connection test failed');
    }

    console.log('Stripe API connectivity confirmed for subscription:', {
      request_id: requestId,
      account_id: connectionTest.accountId
    });

    // Create or retrieve Stripe customer
    let customer;
    
    if (customer_id) {
      // Try to retrieve existing customer
      try {
        customer = await stripe.customers.retrieve(customer_id);
        console.log('Retrieved existing customer:', {
          request_id: requestId,
          customer_id: customer.id
        });
      } catch (customerError) {
        console.warn('Could not retrieve customer, will create new one:', {
          request_id: requestId,
          customer_id: customer_id,
          error: customerError.message
        });
        customer = null;
      }
    }

    if (!customer) {
      // Search by email or create new customer
      const existingCustomers = await stripe.customers.list({
        email: customer_email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log('Found existing customer by email:', {
          request_id: requestId,
          customer_id: customer.id
        });
        
        // Update customer metadata for subscription
        customer = await stripe.customers.update(customer.id, {
          name: customer_name || customer.name,
          metadata: {
            ...customer.metadata,
            subscription_service: service,
            last_updated: new Date().toISOString()
          }
        });
      } else {
        console.log('Creating new customer for subscription:', {
          request_id: requestId,
          email: customer_email,
          name: customer_name
        });

        customer = await stripe.customers.create({
          email: customer_email,
          name: customer_name,
          metadata: {
            subscription_service: service,
            created_at: new Date().toISOString()
          }
        });
      }
    }

    // Check if customer already has an active subscription for this service
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 10
    });

    const hasActiveService = existingSubscriptions.data.some(sub => 
      sub.metadata.service === service && 
      ['active', 'trialing'].includes(sub.status)
    );

    if (hasActiveService) {
      console.log('Customer already has active subscription:', {
        request_id: requestId,
        customer_id: customer.id,
        service: service
      });
      
      throw new ValidationError(
        'You already have an active subscription for this service. Please manage your existing subscription instead.',
        'duplicate_subscription'
      );
    }

    console.log('Creating subscription checkout session:', {
      request_id: requestId,
      customer_id: customer.id,
      service: service,
      price_id: selectedService.stripe_price_id,
      trial_days: trial_period_days
    });

    // Create subscription checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: selectedService.stripe_price_id,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: success_url || `https://directorybolt.com/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
      cancel_url: cancel_url || `https://directorybolt.com/pricing?cancelled=true&type=subscription`,
      
      // Enhanced metadata
      metadata: {
        service: service,
        service_name: selectedService.name,
        customer_email: customer_email,
        request_id: requestId,
        ...metadata
      },
      
      // Subscription configuration
      subscription_data: {
        metadata: {
          service: service,
          service_name: selectedService.name,
          customer_email: customer_email,
          created_at: new Date().toISOString()
        },
        trial_period_days: trial_period_days > 0 ? trial_period_days : undefined
      },
      
      // UI customizations
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      
      // Tax calculation
      automatic_tax: {
        enabled: true
      },
      
      // Custom fields for business context
      custom_fields: [
        {
          key: 'business_name',
          label: {
            type: 'text',
            text: 'Business Name'
          },
          type: 'text',
          optional: false
        },
        {
          key: 'existing_package',
          label: {
            type: 'text',
            text: 'Which DirectoryBolt package did you purchase? (e.g., Starter, Growth, Pro)'
          },
          type: 'text',
          optional: true
        }
      ]
    });

    console.log('Subscription checkout session created:', {
      request_id: requestId,
      session_id: session.id,
      customer_id: customer.id,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
      trial_days: trial_period_days
    });

    // Validate session URL exists
    if (!session.url) {
      throw new ApiError(
        'Subscription session created but checkout URL is missing. Please contact support.',
        500,
        'STRIPE_SESSION_URL_MISSING'
      );
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        checkout_session: {
          id: session.id,
          url: session.url,
          expires_at: new Date(session.expires_at * 1000).toISOString()
        },
        service_details: {
          name: selectedService.name,
          price: selectedService.price,
          billing_interval: selectedService.billing_interval,
          features: selectedService.features,
          trial_period_days: trial_period_days
        },
        customer_id: customer.id,
        trial_period_days: trial_period_days
      },
      requestId
    });

  } catch (stripeError) {
    // Enhanced Stripe error handling
    const { handleStripeError } = require('../../lib/utils/stripe-client');
    const errorResponse = handleStripeError(stripeError, 'subscription-checkout-creation');
    
    console.error('Subscription checkout failed:', {
      service: service,
      customer_email: customer_email,
      error: stripeError.message,
      request_id: requestId,
      user_message: errorResponse.userMessage,
      error_code: errorResponse.errorCode
    });
    
    throw new ApiError(errorResponse.userMessage, errorResponse.statusCode, errorResponse.errorCode);
  }
}

// DEPRECATED - Export for testing legacy code only
// export { handleCreateSubscriptionCheckout };