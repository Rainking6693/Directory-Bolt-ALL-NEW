// 🚀 STRIPE CHECKOUT SESSION CREATION - PHASE 2 PRICING
// Complete Stripe integration with new pricing structure ($149, $299, $499, $799)

import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

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

// Phase 2 Pricing Configuration
const PRICING_PLANS = {
  starter: {
    name: 'Starter Intelligence',
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    price: 149,
    description: 'AI Market Analysis + 100 Directory Submissions',
    features: [
      'AI Market Analysis (Worth $1,500)',
      '100 Directory Submissions (Worth $400)', 
      'Competitor Intelligence (Worth $800)',
      'Basic optimization reports',
      'Email support'
    ]
  },
  growth: {
    name: 'Growth Intelligence',
    priceId: process.env.STRIPE_GROWTH_PRICE_ID!,
    price: 299,
    description: 'Full AI Business Intelligence + 250 Premium Directories',
    features: [
      'Full AI Business Intelligence (Worth $2,000)',
      '250 Premium Directory Submissions (Worth $1,000)',
      'Advanced Competitor Analysis (Worth $1,200)',
      'Growth Strategy Reports (Worth $800)',
      'Priority support & optimization'
    ]
  },
  professional: {
    name: 'Professional Intelligence',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
    price: 499,
    description: 'Enterprise AI Intelligence + 400 Premium Directories',
    features: [
      'Enterprise AI Intelligence Suite (Worth $3,000)',
      '400 Premium Directory Network (Worth $1,500)',
      'Deep Market Intelligence (Worth $2,000)',
      'White-label Reports (Worth $1,000)',
      'Dedicated account manager'
    ]
  },
  enterprise: {
    name: 'Enterprise Intelligence',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    price: 799,
    description: 'Complete AI Intelligence Platform + 500+ Directories',
    features: [
      'Complete AI Intelligence Platform (Worth $4,000)',
      '500+ Premium Directory Network (Worth $2,000)',
      'Advanced Market Intelligence (Worth $2,500)',
      'Custom White-label Reports (Worth $1,200)',
      'Dedicated success manager + SLA'
    ]
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

    // For testing purposes, use mock price IDs if not configured
    if (!selectedPlan.priceId) {
      logger.warn(`Price ID not configured for plan: ${plan}, using mock implementation`)
      // Return mock success response for testing
      return res.status(200).json({
        success: true,
        sessionId: `mock_session_${Date.now()}`,
        checkoutUrl: `/checkout-mock?plan=${plan}&amount=${selectedPlan.price}`,
        plan: selectedPlan,
        requestId: `checkout_${Date.now()}`,
        mock: true,
        message: 'Mock checkout session created (Stripe not fully configured)'
      })
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: selectedPlan.priceId,
        quantity: 1,
      }
    ]

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

    // Initialize Stripe with error handling
    let stripe: Stripe
    try {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-08-16',
      })
    } catch (error) {
      logger.error('Failed to initialize Stripe', {}, error as Error)
      return res.status(500).json({
        error: 'Payment system initialization failed',
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