import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })

async function getStripeCustomerIdForUser(req: NextApiRequest): Promise<string | null> {
  // TODO: Load signed-in user; return stored stripeCustomerId.
  // If missing, create Stripe customer and persist id to users table, then return it.
  let payload: Record<string, unknown> | undefined

  if (typeof req.body === 'string') {
    try {
      payload = JSON.parse(req.body)
    } catch {
      payload = {}
    }
  } else if (req.body && typeof req.body === 'object') {
    payload = req.body as Record<string, unknown>
  }

  const { customerId, email } = payload ?? {}

  if (typeof customerId === 'string' && customerId.trim().length > 0) {
    return customerId
  }

  if (typeof email === 'string' && email.trim().length > 0) {
    const existing = await stripe.customers.list({ email: email.trim(), limit: 1 })
    if (existing.data[0]) {
      return existing.data[0].id
    }

    const created = await stripe.customers.create({ email: email.trim() })
    return created.id
  }

  const created = await stripe.customers.create()
  return created.id
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const customerId = await getStripeCustomerIdForUser(req)

    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer id for user' })
    }

    const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/billing`
    })

    return res.status(200).json({ url: session.url })
  } catch (error: any) {
    return res.status(500).json({
      error: 'Stripe error',
      details: error?.message || String(error)
    })
  }
}
