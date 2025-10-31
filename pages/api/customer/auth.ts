import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface AuthRequest {
  email: string
  password?: string
}

interface AuthResponse {
  success: boolean
  customerId?: string
  customerName?: string
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AuthResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { email, password }: AuthRequest = req.body

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }

    // Find customer by email
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('customer_id, business_name, email, created_at')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (customerError || !customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found. Please check your email or contact support.' 
      })
    }

    // For now, we'll allow access without password verification
    // In a production system, you'd verify the password here
    if (password && password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      })
    }

    // Return customer data
    return res.status(200).json({
      success: true,
      customerId: customer.customer_id,
      customerName: customer.business_name || 'Customer'
    })

  } catch (error) {
    console.error('[customer.auth] error', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}