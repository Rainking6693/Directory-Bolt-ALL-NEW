import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ValidateResponse {
  success: boolean
  customer?: {
    id: string
    business_name: string
    email: string
  }
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ValidateResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { customerId } = req.query

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ success: false, error: 'Customer ID is required' })
    }

    // Validate customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('customer_id, business_name, email, created_at')
      .eq('customer_id', customerId)
      .single()

    if (customerError || !customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found' 
      })
    }

    // Return customer data
    return res.status(200).json({
      success: true,
      customer: {
        id: customer.customer_id,
        business_name: customer.business_name,
        email: customer.email
      }
    })

  } catch (error) {
    console.error('[customer.validate] error', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}