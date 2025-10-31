// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { SupabaseService } from '../../../lib/services/supabase';

const LIMITS: Record<string, number> = {
  starter: 50,
  growth: 75,
  professional: 150,
  enterprise: 500,
};

function applyCors(res: NextApiResponse, req: NextApiRequest) {
  const origin = req.headers.origin;
  
  // Allow Chrome extension origins specifically
  if (origin && origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const rawCustomerId = req.query.customerId;
  const customerId = Array.isArray(rawCustomerId) ? rawCustomerId[0] : rawCustomerId;
  const cleanedId = (customerId || '').toString().trim().toUpperCase();

  if (!/^DIR-\d{8}-\d{6}$/.test(cleanedId)) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_ID_FORMAT',
      message: 'Customer ID must start with "DIR-" and match DIR-YYYYMMDD-XXXXXX.',
    });
  }

  try {
    // Initialize Supabase service
    const supabaseService = new SupabaseService();
    await supabaseService.initialize();

    // Get customer from Supabase
    const customerResult = await supabaseService.getCustomerById(cleanedId);

    if (!customerResult.found) {
      return res.status(404).json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Customer ID not found.',
      });
    }

    const customer = customerResult.customer;
    const packageTypeRaw = customer.packageType.toLowerCase();
    // Map "pro" to "professional"
    const normalizedPackage = packageTypeRaw === 'pro' ? 'professional' : packageTypeRaw;
    const directoryLimit = LIMITS[normalizedPackage] ?? LIMITS.starter;

    return res.status(200).json({
      ok: true,
      customerId: cleanedId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      package: normalizedPackage || 'starter',
      directoryLimit,
      businessName: customer.businessName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.error('[extension.validate] error', { name: err?.name, message: err?.message });
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Validation service unavailable.',
    });
  }
}
