import Stripe from 'stripe';

// Initialize Stripe with environment variable only (secure)
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is required');
  throw new Error('Stripe configuration error - contact support');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

// Add-ons mapping for display
const ADD_ONS_MAP = {
  fasttrack: { name: 'Fast-Track Submission', price: 25, icon: '⚡' },
  premium: { name: 'Premium Directories Only', price: 15, icon: '👑' },
  qa: { name: 'Manual QA Review', price: 10, icon: '🔍' },
  csv: { name: 'CSV Export', price: 9, icon: '📊' }
};

// Plans mapping for display
const PLANS_MAP = {
  starter: { name: 'Starter Package', directories: 50, description: '50 directory submissions' },
  growth: { name: 'Growth Package', directories: 100, description: '100 directory submissions' },
  pro: { name: 'Pro Package', directories: 200, description: '200 directory submissions' }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    console.log('Fetching session details for:', session_id);
    
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'customer']
    });

    console.log('Session retrieved:', {
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      metadata: session.metadata
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Extract plan and add-ons from metadata
    const planId = session.metadata?.plan || '';
    const addonsString = session.metadata?.addons || '';
    const selectedAddons = addonsString ? addonsString.split(',').filter(Boolean) : [];

    // Prepare response data
    const responseData = {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email,
      customerName: session.metadata?.customer_name || session.customer_details?.name,
      businessName: session.metadata?.business_name,
      businessWebsite: session.metadata?.business_website,
      
      // Plan information
      planId: planId,
      planName: PLANS_MAP[planId]?.name || `${planId} Plan`,
      planDescription: PLANS_MAP[planId]?.description || 'Directory submission service',
      
      // Add-ons information
      addons: selectedAddons.map(addonId => ({
        id: addonId,
        name: ADD_ONS_MAP[addonId]?.name || addonId,
        price: ADD_ONS_MAP[addonId]?.price || 0,
        icon: ADD_ONS_MAP[addonId]?.icon || '⚡'
      })),
      
      // Pricing
      amount_total: session.amount_total,
      totalAmount: (session.amount_total / 100).toFixed(2),
      currency: session.currency?.toUpperCase() || 'USD',
      
      // Line items breakdown
      lineItems: session.line_items?.data?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        amount_total: item.amount_total,
        price: (item.amount_total / 100).toFixed(2)
      })) || [],
      
      // Session metadata
      created: session.created,
      metadata: session.metadata || {}
    };

    console.log('Sending response data:', responseData);

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error retrieving session details:', error);
    
    return res.status(500).json({
      error: 'Failed to retrieve session details',
      message: error.message
    });
  }
}