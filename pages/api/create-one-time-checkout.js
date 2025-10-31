// 🔄 DIRECTORYBOLT ONE-TIME PAYMENT CHECKOUT
// POST /api/create-one-time-checkout - Create one-time payment checkout for DirectoryBolt packages
// REPLACES: create-subscription-checkout.js - Now uses ONE-TIME payments only

import { handleApiError, ValidationError, ApiError } from '../../lib/utils/errors';
import { log } from '../../lib/utils/logger';
import { 
  CORE_PACKAGES,
  ADD_ONS,
  validatePackageConfiguration,
  getOneTimeCheckoutLineItems,
  calculateTotalPrice,
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
  const requestId = `one_time_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set security headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Log incoming request
  console.log('One-time payment checkout request:', {
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
            id: `cs_one_time_mock_${Date.now()}`,
            url: `https://checkout.stripe.com/c/pay/mock_one_time_${Date.now()}`,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          },
          note: 'Development mode - Stripe not configured'
        },
        requestId
      });
    }

    await handleCreateOneTimeCheckout(req, res, requestId);

  } catch (error) {
    console.error('One-time checkout error:', {
      request_id: requestId,
      error_message: error.message,
      error_type: error.constructor.name,
      error_stack: error.stack
    });
    
    const errorResponse = handleApiError(error, requestId);
    return res.status(errorResponse.error.statusCode || 500).json(errorResponse);
  }
}

async function handleCreateOneTimeCheckout(req, res, requestId) {
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
    package_id, // Required: starter, growth, professional, enterprise
    addon_ids = [], // Optional: array of addon IDs
    customer_email,
    customer_name,
    customer_id, // Existing customer ID if available
    success_url,
    cancel_url,
    metadata = {}
  } = parsedBody || {};

  // Validate required parameters
  if (!parsedBody) {
    throw new ValidationError('Request body is required', 'request_body');
  }

  if (!package_id) {
    throw new ValidationError('Package ID is required', 'package_id');
  }

  if (!customer_email) {
    throw new ValidationError('Customer email is required', 'customer_email');
  }

  // Validate package exists
  if (!CORE_PACKAGES[package_id]) {
    throw new ValidationError(
      `Invalid package ID: ${package_id}. Available packages: ${Object.keys(CORE_PACKAGES).join(', ')}`,
      'package_id'
    );
  }

  // Validate package configuration with add-ons
  const validation = validatePackageConfiguration(package_id, addon_ids);
  if (!validation.valid) {
    throw new ValidationError(
      `Package configuration error: ${validation.errors.join(', ')}`,
      'package_configuration'
    );
  }

  const selectedPackage = CORE_PACKAGES[package_id];
  const selectedAddons = addon_ids.map(id => ADD_ONS[id]).filter(Boolean);

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

    console.log('Stripe API connectivity confirmed for one-time checkout:', {
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
        
        // Update customer metadata for one-time purchase
        customer = await stripe.customers.update(customer.id, {
          name: customer_name || customer.name,
          metadata: {
            ...customer.metadata,
            package_id: package_id,
            payment_type: 'one_time',
            last_updated: new Date().toISOString()
          }
        });
      } else {
        console.log('Creating new customer for one-time purchase:', {
          request_id: requestId,
          email: customer_email,
          name: customer_name
        });

        customer = await stripe.customers.create({
          email: customer_email,
          name: customer_name,
          metadata: {
            package_id: package_id,
            payment_type: 'one_time',
            created_at: new Date().toISOString()
          }
        });
      }
    }

    // Calculate total price
    const totalPrice = calculateTotalPrice(package_id, addon_ids);

    console.log('Creating one-time payment checkout session:', {
      request_id: requestId,
      customer_id: customer.id,
      package_id: package_id,
      addon_ids: addon_ids,
      total_price: totalPrice / 100 // Convert to dollars for logging
    });

    // Create one-time payment checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: getOneTimeCheckoutLineItems(package_id, addon_ids),
      mode: 'payment', // ONE-TIME PAYMENT (not subscription)
      success_url: success_url || `https://directorybolt.com/success?session_id={CHECKOUT_SESSION_ID}&type=one_time&package=${package_id}`,
      cancel_url: cancel_url || `https://directorybolt.com/pricing?cancelled=true&type=one_time&package=${package_id}`,
      
      // Enhanced metadata for one-time purchase tracking
      metadata: {
        package_id: package_id,
        package_name: selectedPackage.name,
        tier_access: selectedPackage.tier_access,
        addon_ids: addon_ids.join(','),
        customer_email: customer_email,
        payment_type: 'one_time',
        directory_count: selectedPackage.directory_count.toString(),
        request_id: requestId,
        ...metadata
      },
      
      // Payment intent metadata for webhook processing
      payment_intent_data: {
        metadata: {
          package_id: package_id,
          tier_access: selectedPackage.tier_access,
          addon_ids: addon_ids.join(','),
          customer_email: customer_email,
          payment_type: 'one_time',
          directory_count: selectedPackage.directory_count.toString()
        }
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
          key: 'business_website',
          label: {
            type: 'text',
            text: 'Business Website (if available)'
          },
          type: 'text',
          optional: true
        }
      ]
    });

    console.log('One-time checkout session created successfully:', {
      request_id: requestId,
      session_id: session.id,
      customer_id: customer.id,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
      payment_mode: 'payment' // One-time
    });

    // Validate session URL exists
    if (!session.url) {
      throw new ApiError(
        'One-time checkout session created but checkout URL is missing. Please contact support.',
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
        package_details: {
          id: package_id,
          name: selectedPackage.name,
          price: selectedPackage.price,
          tier_access: selectedPackage.tier_access,
          directory_count: selectedPackage.directory_count,
          payment_type: 'one_time',
          features: selectedPackage.features
        },
        addon_details: selectedAddons.map(addon => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
          description: addon.description
        })),
        total_price: totalPrice,
        customer_id: customer.id,
        payment_type: 'one_time'
      },
      requestId
    });

  } catch (stripeError) {
    // Enhanced Stripe error handling
    const { handleStripeError } = require('../../lib/utils/stripe-client');
    const errorResponse = handleStripeError(stripeError, 'one-time-checkout-creation');
    
    console.error('One-time checkout failed:', {
      package_id: package_id,
      customer_email: customer_email,
      error: stripeError.message,
      request_id: requestId,
      user_message: errorResponse.userMessage,
      error_code: errorResponse.errorCode
    });
    
    throw new ApiError(errorResponse.userMessage, errorResponse.statusCode, errorResponse.errorCode);
  }
}

// Export for testing
export { handleCreateOneTimeCheckout };