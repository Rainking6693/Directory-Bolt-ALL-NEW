// 🚀 STRIPE CHECKOUT SESSION CREATION - PHASE 2 PRICING
// Complete Stripe integration with new pricing structure ($149, $299, $499, $799)

import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { PRICING_TIERS, STRIPE_PRICE_IDS } from '../../../lib/config/pricing'

// Simple logger fallback
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg: string, meta?: any, error?: Error) => console.error(`[ERROR] ${msg}`, meta || '', error || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || '')
}

// Import validated Stripe client
import { getStripeClient, handleStripeError } from '../../../lib/utils/stripe-client'

// Get Stripe client (validated on initialization)
const getStripe = () => {
  try {
    return getStripeClient()
  } catch (error) {
    throw new Error(`Stripe initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Phase 2 Pricing Configuration - Uses centralized pricing config
const PRICING_PLANS = {
  starter: {
    name: PRICING_TIERS.starter.name,
    priceId: STRIPE_PRICE_IDS.starter,
    price: PRICING_TIERS.starter.price,
    description: PRICING_TIERS.starter.description,
    features: PRICING_TIERS.starter.features,
    directories: PRICING_TIERS.starter.directories
  },
  growth: {
    name: PRICING_TIERS.growth.name,
    priceId: STRIPE_PRICE_IDS.growth,
    price: PRICING_TIERS.growth.price,
    description: PRICING_TIERS.growth.description,
    features: PRICING_TIERS.growth.features,
    directories: PRICING_TIERS.growth.directories
  },
  professional: {
    name: PRICING_TIERS.professional.name,
    priceId: STRIPE_PRICE_IDS.professional,
    price: PRICING_TIERS.professional.price,
    description: PRICING_TIERS.professional.description,
    features: PRICING_TIERS.professional.features,
    directories: PRICING_TIERS.professional.directories
  },
  enterprise: {
    name: PRICING_TIERS.enterprise.name,
    priceId: STRIPE_PRICE_IDS.enterprise,
    price: PRICING_TIERS.enterprise.price,
    description: PRICING_TIERS.enterprise.description,
    features: PRICING_TIERS.enterprise.features,
    directories: PRICING_TIERS.enterprise.directories
  }
}

interface CheckoutRequest {
  plan: keyof typeof PRICING_PLANS
  customerEmail?: string
  successUrl?: string
  cancelUrl?: string
  metadata?: Record<string, string>
  addons?: string[]
}

// 🔒 SECURITY: Secure CORS configuration for Stripe endpoints
function getSecureCorsHeaders(req: NextApiRequest) {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://directorybolt.netlify.app', 'https://directorybolt.com']
    : ['http://localhost:3000', 'http://localhost:3001'];
    
  const origin = req.headers.origin;
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  // 🔒 SECURITY FIX: Apply secure CORS headers (CORS-008)
  const corsHeaders = getSecureCorsHeaders(req);
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
    setTimeout(() => reject(new Error('Stripe API timeout')), 30000) // 30 second timeout
  })

  try {
    const result = await Promise.race([
      handleStripeCheckout(req, res),
      timeoutPromise
    ])
    return result
  } catch (error) {
    logger.error('Stripe checkout session creation failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        plan: req.body?.plan
      }
    }, error instanceof Error ? error : new Error(String(error)))

    // Handle specific errors
    if (error instanceof Error && error.message === 'Stripe API timeout') {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.'
      })
    }

    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleStripeCheckout(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      plan,
      customerEmail,
      successUrl,
      cancelUrl,
      metadata = {},
      addons = []
    }: CheckoutRequest = req.body

    // Validate plan
    if (!plan || !PRICING_PLANS[plan]) {
      return res.status(400).json({
        error: 'Invalid plan selected',
        availablePlans: Object.keys(PRICING_PLANS)
      })
    }

    const selectedPlan = PRICING_PLANS[plan]

    // Validate required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.error('Stripe secret key not configured')
      return res.status(500).json({ error: 'Payment system not configured' })
    }

    // Note: We'll use price_data fallback if price IDs not configured, so no need for mock response
    if (!selectedPlan.priceId || !selectedPlan.priceId.startsWith('price_')) {
      logger.warn(`Price ID not configured for plan: ${plan}, using price_data fallback`)
    }

    // Build line items - Use price_data for one-time payments if priceId not configured
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    
    if (selectedPlan.priceId && selectedPlan.priceId.startsWith('price_')) {
      // Use existing Stripe price ID
      lineItems.push({
        price: selectedPlan.priceId,
        quantity: 1,
      })
    } else {
      // Create price_data for one-time payment (fallback if price IDs not configured)
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: selectedPlan.price * 100, // Convert to cents
          product_data: {
            name: selectedPlan.name,
            description: selectedPlan.description,
            metadata: {
              plan: plan,
              directories: selectedPlan.directories?.toString() || '0',
              payment_type: 'one_time'
            }
          }
        },
        quantity: 1,
      })
    }

    // Add any selected add-ons
    const ADDON_PRICE_IDS = {
      fast_track: process.env.STRIPE_FAST_TRACK_PRICE_ID,
      premium_directories: process.env.STRIPE_PREMIUM_DIRECTORIES_PRICE_ID,
      manual_qa: process.env.STRIPE_MANUAL_QA_PRICE_ID,
      csv_export: process.env.STRIPE_CSV_EXPORT_PRICE_ID
    }

    for (const addon of addons) {
      const addonPriceId = ADDON_PRICE_IDS[addon as keyof typeof ADDON_PRICE_IDS]
      if (addonPriceId) {
        lineItems.push({
          price: addonPriceId,
          quantity: 1,
        })
      }
    }

    // Get Stripe client (already validated)
    let stripe: Stripe
    try {
      stripe = getStripe()
    } catch (error) {
      const stripeError = handleStripeError(error, 'checkout_session_creation')
      logger.error('Failed to initialize Stripe', {}, error as Error)
      return res.status(stripeError.statusCode).json({
        error: stripeError.userMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Create checkout session with timeout protection
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment', // One-time payment
      customer_email: customerEmail,
      success_url: successUrl || `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: cancelUrl || `${req.headers.origin}/pricing?cancelled=true&plan=${plan}`,
      metadata: {
        plan,
        planName: selectedPlan.name,
        planPrice: selectedPlan.price.toString(),
        addons: addons.join(','),
        source: 'directorybolt_checkout',
        ...metadata
      },
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI']
      },
      custom_text: {
        submit: {
          message: `Complete your ${selectedPlan.name} purchase and get instant access to AI business intelligence.`
        }
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `DirectoryBolt ${selectedPlan.name} - AI Business Intelligence Platform`,
          metadata: {
            plan,
            planName: selectedPlan.name
          }
        }
      }
    })

    logger.info('Stripe checkout session created', {
      metadata: {
        sessionId: session.id,
        plan,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        customerEmail,
        addons
      }
    })

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      plan: selectedPlan,
      requestId: `checkout_${Date.now()}`
    })

  } catch (error) {
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      logger.error('Stripe API error', { metadata: { type: error.type, code: error.code } })
      return res.status(400).json({
        error: 'Payment setup failed',
        details: error.message,
        type: error.type,
        code: error.code
      })
    }

    // Generic error handling
    throw error
  }
}