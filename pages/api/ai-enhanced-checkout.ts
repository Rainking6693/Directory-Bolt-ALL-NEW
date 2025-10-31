// @ts-nocheck
/**
 * AI-Enhanced Checkout API
 * Handles checkout sessions for the new AI-powered pricing tiers
 * POST /api/ai-enhanced-checkout
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, ValidationError, ApiError } from '../../lib/utils/errors'
import { CORE_PACKAGES, calculateBusinessValue, getGrandfatherPricing } from '../../lib/config/directoryBoltProducts'

// Initialize Stripe safely
let stripe: any = null
let config: any = null

function getStripeClientSafe() {
  try {
    const { getStripeClient } = require('../../lib/utils/stripe-client')
    return getStripeClient()
  } catch (error) {
    return null
  }
}

function getStripeConfigSafe() {
  return { nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000' }
}

interface AICheckoutRequest {
  plan: 'starter' | 'growth' | 'professional' | 'enterprise'
  billing_period: 'monthly' | 'annual'
  user_email: string
  user_id: string
  customer_profile?: {
    currentPlan?: string
    monthlyRevenue?: number
    businessType?: string
  }
  success_url?: string
  cancel_url?: string
  apply_grandfathering?: boolean
}

interface AICheckoutResponse {
  success: true
  data: {
    checkout_session: {
      id: string
      url: string
      expires_at: string
    }
    plan_details: {
      name: string
      price: number
      ai_features: string[]
      value_proposition: any
    }
    customer_id: string
    applied_discount?: {
      original_price: number
      discounted_price: number
      discount_percentage: number
      reason: string
    }
    business_value: {
      consultant_savings: string
      roi_multiple: number
      savings_percentage: string
    }
  }
  requestId: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AICheckoutResponse | any>
) {
  // Prevent build-time execution
  if (!req || !res || typeof res.status !== 'function') {
    console.warn('API route called during build time - skipping execution')
    return { notFound: true }
  }

  const requestId = `ai_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }

    await handleAIEnhancedCheckout(req, res, requestId)

  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode || 500).json(errorResponse)
  }
}

async function handleAIEnhancedCheckout(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  // Initialize Stripe components
  stripe = getStripeClientSafe()
  config = getStripeConfigSafe()

  const data: AICheckoutRequest = req.body

  // Validate request
  if (!data.plan || !CORE_PACKAGES[data.plan]) {
    throw new ValidationError(`Invalid plan: ${data.plan}. Available plans: ${Object.keys(CORE_PACKAGES).join(', ')}`, 'plan')
  }

  if (!data.user_email || !data.user_id) {
    throw new ValidationError('User email and ID are required', !data.user_email ? 'user_email' : 'user_id')
  }

  const selectedPlan = CORE_PACKAGES[data.plan]
  const isAnnual = data.billing_period === 'annual'
  
  // Calculate business value for the selected plan
  const businessValue = calculateBusinessValue(data.plan)
  if (!businessValue) {
    throw new ApiError('Unable to calculate business value for selected plan', 500, 'BUSINESS_VALUE_ERROR')
  }

  // Check for grandfathering if applicable
  let appliedDiscount = null
  let finalPrice = selectedPlan.price
  
  if (data.apply_grandfathering && data.customer_profile?.currentPlan) {
    const grandfatherPricing = getGrandfatherPricing(data.customer_profile.currentPlan, data.plan)
    if (grandfatherPricing) {
      appliedDiscount = {
        original_price: grandfatherPricing.original_price,
        discounted_price: grandfatherPricing.grandfathered_price,
        discount_percentage: grandfatherPricing.discount_percentage,
        reason: `Grandfathered pricing for existing ${data.customer_profile.currentPlan} customers`
      }
      finalPrice = grandfatherPricing.grandfathered_price
    }
  }

  // Development mode check
  const isDevelopmentMode = !stripe || !config || 
                           !process.env.STRIPE_SECRET_KEY ||
                           process.env.NODE_ENV !== 'production'

  console.log('AI-Enhanced checkout request:', {
    request_id: requestId,
    plan: data.plan,
    billing_period: data.billing_period,
    user_email: data.user_email,
    final_price_cents: finalPrice,
    applied_discount: appliedDiscount,
    development_mode: isDevelopmentMode
  })

  if (isDevelopmentMode) {
    // Return mock response for development
    return res.status(200).json({
      success: true,
      data: {
        checkout_session: {
          id: `cs_ai_mock_${Date.now()}`,
          url: `https://checkout.stripe.com/c/pay/ai_mock_session_${Date.now()}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        plan_details: {
          name: selectedPlan.name,
          price: finalPrice,
          ai_features: selectedPlan.ai_features || [],
          value_proposition: selectedPlan.value_proposition
        },
        customer_id: `cus_ai_mock_${Date.now()}`,
        applied_discount: appliedDiscount,
        business_value: {
          consultant_savings: businessValue.consultant_savings,
          roi_multiple: businessValue.roi_multiple,
          savings_percentage: businessValue.savings_percentage
        },
        development_mode: true
      },
      requestId
    })
  }

  try {
    // Create or retrieve Stripe customer
    let customer
    const existingCustomers = await stripe.customers.list({
      email: data.user_email,
      limit: 1
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
      
      // Update customer metadata
      customer = await stripe.customers.update(customer.id, {
        metadata: {
          user_id: data.user_id,
          plan_tier: data.plan,
          billing_period: data.billing_period,
          ai_enhanced: 'true',
          last_updated: new Date().toISOString()
        }
      })
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: data.user_email,
        metadata: {
          user_id: data.user_id,
          plan_tier: data.plan,
          billing_period: data.billing_period,
          ai_enhanced: 'true',
          created_at: new Date().toISOString()
        }
      })
    }

    // Create dynamic price for grandfathered customers if needed
    let priceId = selectedPlan.stripe_price_id
    
    if (appliedDiscount) {
      // Create one-time price for discounted amount
      const dynamicPrice = await stripe.prices.create({
        unit_amount: appliedDiscount.discounted_price,
        currency: 'usd',
        recurring: { interval: 'month' },
        product_data: {
          name: `${selectedPlan.name} Plan (Grandfathered)`,
          description: `AI-Enhanced ${selectedPlan.description} - Special grandfathered pricing`,
          metadata: {
            original_plan: data.plan,
            discount_applied: appliedDiscount.discount_percentage.toString(),
            grandfathered: 'true'
          }
        },
        metadata: {
          original_price_id: selectedPlan.stripe_price_id,
          grandfathered: 'true',
          discount_percentage: appliedDiscount.discount_percentage.toString()
        }
      })
      priceId = dynamicPrice.id
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: data.success_url || `${config.nextAuthUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: data.cancel_url || `${config.nextAuthUrl}/pricing?cancelled=true&plan=${data.plan}`,
      metadata: {
        user_id: data.user_id,
        plan_tier: data.plan,
        billing_period: data.billing_period,
        ai_enhanced: 'true',
        request_id: requestId,
        applied_discount: appliedDiscount ? 'true' : 'false',
        business_value_roi: businessValue.roi_multiple.toString()
      },
      subscription_data: {
        metadata: {
          user_id: data.user_id,
          plan_tier: data.plan,
          billing_period: data.billing_period,
          ai_enhanced: 'true',
          directory_limit: selectedPlan.directory_count.toString(),
          consultant_equivalent_value: businessValue.consultant_savings,
          roi_multiple: businessValue.roi_multiple.toString()
        },
        trial_period_days: 14, // AI enhancement trial
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      automatic_tax: {
        enabled: true,
      },
    })

    // Log successful session creation
    console.log('AI-Enhanced checkout session created:', {
      request_id: requestId,
      session_id: session.id,
      customer_id: customer.id,
      plan: data.plan,
      final_price: finalPrice,
      discount_applied: !!appliedDiscount,
      roi_multiple: businessValue.roi_multiple
    })

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        checkout_session: {
          id: session.id,
          url: session.url!,
          expires_at: new Date(session.expires_at * 1000).toISOString()
        },
        plan_details: {
          name: selectedPlan.name,
          price: finalPrice,
          ai_features: selectedPlan.ai_features || [],
          value_proposition: selectedPlan.value_proposition
        },
        customer_id: customer.id,
        applied_discount: appliedDiscount,
        business_value: {
          consultant_savings: businessValue.consultant_savings,
          roi_multiple: businessValue.roi_multiple,
          savings_percentage: businessValue.savings_percentage
        }
      },
      requestId
    })

  } catch (stripeError: any) {
    // Enhanced Stripe error handling
    console.error('AI-Enhanced checkout failed:', {
      request_id: requestId,
      user_id: data.user_id,
      plan: data.plan,
      error: stripeError.message,
      error_type: stripeError.type,
      error_code: stripeError.code
    })

    const { handleStripeError } = require('../../lib/utils/stripe-client')
    const errorResponse = handleStripeError(stripeError, 'ai-enhanced-checkout')
    
    throw new ApiError(errorResponse.userMessage, errorResponse.statusCode, errorResponse.errorCode)
  }
}