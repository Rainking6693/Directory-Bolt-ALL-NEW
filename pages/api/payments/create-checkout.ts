// @ts-nocheck
// 🔒 JORDAN'S PAYMENT API - Secure Stripe integration with comprehensive error handling
// POST /api/payments/create-checkout - Create Stripe checkout sessions for credit purchases

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError, Errors, ExternalServiceError } from '../../../lib/utils/errors'
import { getStripeClient, handleStripeError, testStripeConnection } from '../../../lib/utils/stripe-client'
// Removed broken import: stripe-environment-validator
import type { User, Payment } from '../../../lib/database/schema'

// Initialize Stripe client and configuration safely at runtime
let stripe: any = null
let config: any = null

function initializeStripeComponents() {
  if (!stripe || !config) {
    try {
      stripe = getStripeClient()
      config = {
        nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000'
      }
    } catch (error) {
      console.warn('Stripe initialization failed:', error instanceof Error ? error.message : 'Unknown error')
      // Return defaults for build time
      stripe = null
      config = {
        nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000'
      }
    }
  }
  return { stripe, config }
}

// Credit packages configuration
const CREDIT_PACKAGES = {
  starter: {
    credits: 50,
    price: 1999, // $19.99 in cents
    name: 'Starter Package',
    description: '50 directory submissions'
  },
  professional: {
    credits: 200,
    price: 4999, // $49.99 in cents
    name: 'Professional Package',
    description: '200 directory submissions + priority support'
  },
  enterprise: {
    credits: 500,
    price: 9999, // $99.99 in cents
    name: 'Enterprise Package',
    description: '500 directory submissions + dedicated support'
  },
  bulk: {
    credits: 1000,
    price: 17999, // $179.99 in cents
    name: 'Bulk Package',
    description: '1000 directory submissions + premium features'
  }
} as const

type CreditPackage = keyof typeof CREDIT_PACKAGES

interface CreateCheckoutRequest {
  package: CreditPackage
  success_url?: string
  cancel_url?: string
}

interface CheckoutResponse {
  success: true
  data: {
    checkout_session: {
      id: string
      url: string
      expires_at: string
    }
    package_details: {
      credits: number
      price: number
      name: string
      description: string
    }
    payment_intent_id: string
  }
  requestId: string
}

// 🔒 SECURITY: Secure CORS configuration for payment endpoints
function getSecureCorsHeaders(req: NextApiRequest) {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://directorybolt.netlify.app', 'https://directorybolt.com']
    : ['http://localhost:3000', 'http://localhost:3001'];
    
  const origin = req.headers.origin;
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin', // Important for caching
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckoutResponse | any>
) {
  // Prevent execution during build time - Next.js static generation fix
  if (!req || !res || typeof res.status !== 'function') {
    console.warn('API route called during build time - skipping execution')
    return { notFound: true }
  }
  
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 🔒 SECURITY FIX: Apply secure CORS headers (CORS-007)
  const corsHeaders = getSecureCorsHeaders(req);
  applyCorsHeaders(res, corsHeaders);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method !== 'POST') {
      try {
        res.setHeader('Allow', ['POST'])
      } catch (headerError) {
        console.warn('Unable to set headers during build time:', headerError instanceof Error ? headerError.message : 'Unknown error')
      }
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }
    
    await handleCreateCheckout(req, res, requestId)
    
  } catch (error) {
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode).json(errorResponse)
  }
}

async function handleCreateCheckout(
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
) {
  // Initialize Stripe components at request time
  const { stripe: stripeClient, config: stripeConfig } = initializeStripeComponents()
  
  // TODO: Extract from authenticated session
  const userId = 'usr_test_123' // Replace with actual user ID from auth middleware
  
  const data: CreateCheckoutRequest = req.body
  
  // Validate package
  if (!data.package || !CREDIT_PACKAGES[data.package]) {
    throw new Error('Invalid credit package selected')
  }
  
  const packageDetails = CREDIT_PACKAGES[data.package]
  
  // Get user information
  const user = await getUserById(userId)
  if (!user) {
    throw Errors.userNotFound()
  }
  
  // Ensure user has Stripe customer ID
  let stripeCustomerId = user.stripe_customer_id
  if (!stripeCustomerId) {
    stripeCustomerId = await createStripeCustomer(user)
    await updateUserStripeCustomerId(userId, stripeCustomerId)
  }
  
  try {
    // Create Stripe checkout session
    const checkoutSession = await createStripeCheckoutSession({
      customerId: stripeCustomerId,
      packageDetails,
      userId,
      successUrl: data.success_url || `${stripeConfig.nextAuthUrl}/payment/success`,
      cancelUrl: data.cancel_url || `${stripeConfig.nextAuthUrl}/pricing`,
      requestId
    })
    
    // Create payment record
    const payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      stripe_payment_intent_id: checkoutSession.payment_intent_id,
      amount: packageDetails.price,
      currency: 'usd',
      status: 'pending',
      description: `Purchase of ${packageDetails.name}`,
      payment_type: 'credits', // One-time credit purchase
      credits_purchased: packageDetails.credits,
      payment_method_type: 'card' // Will be updated after payment
    }
    
    await createPaymentRecord(payment)
    
    // Log payment attempt
    await logPaymentAttempt(userId, packageDetails.name, packageDetails.price, 'CHECKOUT_CREATED')
    
    const response: CheckoutResponse = {
      success: true,
      data: {
        checkout_session: {
          id: checkoutSession.id,
          url: checkoutSession.url,
          expires_at: checkoutSession.expires_at
        },
        package_details: packageDetails,
        payment_intent_id: checkoutSession.payment_intent_id
      },
      requestId
    }
    
    res.status(200).json(response)
    
  } catch (error) {
    // Stripe checkout creation error logged
    
    await logPaymentAttempt(
      userId, 
      packageDetails.name, 
      packageDetails.price, 
      'CHECKOUT_FAILED',
      error instanceof Error ? error.message : 'Unknown error'
    )
    
    // Use our enhanced error handling
    const stripeError = handleStripeError(error, 'credit-checkout-creation')
    
    throw new ExternalServiceError(
      'Stripe',
      stripeError.userMessage,
      error instanceof Error ? error : undefined
    )
  }
}

// Stripe integration functions (mock implementations)
async function createStripeCustomer(user: User): Promise<string> {
  // TODO: Implement actual Stripe customer creation
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
  // const customer = await stripe.customers.create({
  //   email: user.email,
  //   name: user.full_name,
  //   metadata: {
  //     user_id: user.id,
  //     company_name: user.company_name || ''
  //   }
  // })
  // return customer.id
  
  // Mock Stripe customer ID
  const customerId = `cus_mock_${Date.now()}`
  // Stripe customer created
  return customerId
}

async function createStripeCheckoutSession(_options: {
  customerId: string
  packageDetails: typeof CREDIT_PACKAGES[CreditPackage]
  userId: string
  successUrl: string
  cancelUrl: string
  requestId: string
}): Promise<{
  id: string
  url: string
  expires_at: string
  payment_intent_id: string
}> {
  // TODO: Implement actual Stripe checkout session creation
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
  // const session = await stripe.checkout.sessions.create({
  //   customer: options.customerId,
  //   payment_method_types: ['card'],
  //   line_items: [{
  //     price_data: {
  //       currency: 'usd',
  //       product_data: {
  //         name: options.packageDetails.name,
  //         description: options.packageDetails.description,
  //         images: ['https://directorybolt.com/images/credits-icon.png']
  //       },
  //       unit_amount: options.packageDetails.price,
  //     },
  //     quantity: 1,
  //   }],
  //   mode: 'payment',
  //   success_url: `${options.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
  //   cancel_url: options.cancelUrl,
  //   metadata: {
  //     user_id: options.userId,
  //     credits: options.packageDetails.credits.toString(),
  //     request_id: options.requestId
  //   },
  //   expires_at: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000) // 24 hours
  // })
  // 
  // return {
  //   id: session.id,
  //   url: session.url!,
  //   expires_at: new Date(session.expires_at * 1000).toISOString(),
  //   payment_intent_id: session.payment_intent as string
  // }
  
  // Mock Stripe session for development
  const sessionId = `cs_mock_${Date.now()}`
  const paymentIntentId = `pi_mock_${Date.now()}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  
  // Stripe checkout session created
  
  return {
    id: sessionId,
    url: `https://checkout.stripe.com/pay/${sessionId}`, // Mock URL
    expires_at: expiresAt.toISOString(),
    payment_intent_id: paymentIntentId
  }
}

// Database functions (mock implementations)
async function getUserById(userId: string): Promise<User | null> {
  // TODO: Implement actual database query
  // return await db.users.findFirst({ where: { id: userId } })
  
  // Mock user data
  if (userId === 'usr_test_123') {
    return {
      id: userId,
      email: 'test@directorybolt.com',
      password_hash: 'hashed',
      full_name: 'Test User',
      company_name: 'Test Company',
      subscription_tier: 'professional',
      credits_remaining: 25,
      is_verified: true,
      failed_login_attempts: 0,
      stripe_customer_id: undefined, // Will be created
      created_at: new Date('2024-01-01'),
      updated_at: new Date(),
      // New required fields
      directories_used_this_period: 10,
      directory_limit: 100
    } as User
  }
  
  return null
}

async function updateUserStripeCustomerId(userId: string, customerId: string): Promise<void> {
  // TODO: Implement database update
  // await db.users.update({
  //   where: { id: userId },
  //   data: { 
  //     stripe_customer_id: customerId,
  //     updated_at: new Date()
  //   }
  // })
  
  // User updated with Stripe customer ID
}

async function createPaymentRecord(payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<Payment> {
  // TODO: Implement database save
  // const paymentRecord = await db.payments.create({
  //   data: {
  //     ...payment,
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   }
  // })
  // return paymentRecord
  
  // Mock payment record
  const paymentRecord: Payment = {
    ...payment,
    id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date(),
    updated_at: new Date()
  }
  
  // Payment record created
  return paymentRecord
}

// Audit logging
async function logPaymentAttempt(
  userId: string,
  packageName: string,
  amount: number,
  status: string,
  error?: string
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'payment_attempt',
    user_id: userId,
    package_name: packageName,
    amount_cents: amount,
    amount_usd: (amount / 100).toFixed(2),
    status,
    error
  }
  
  // Payment attempt logged
  
  // TODO: Save to audit log database
  // await db.audit_logs.create({ data: logEntry })
}