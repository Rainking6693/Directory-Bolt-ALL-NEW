// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseService } from '../../../lib/services/supabase';

interface BusinessInfo {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  packageType: string;
}

function generateCustomerId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `DIR-${year}${month}${day}-${random}`;
}

function applyCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ 
      ok: false, 
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    const businessInfo: BusinessInfo = req.body;

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'businessName', 'email', 'packageType'];
    const missingFields = requiredFields.filter(field => !businessInfo[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_FIELDS',
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(businessInfo.email)) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_EMAIL',
        message: 'Invalid email format'
      });
    }

    // Validate package type
    const validPackages = ['starter', 'growth', 'professional', 'enterprise'];
    if (!validPackages.includes(businessInfo.packageType.toLowerCase())) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PACKAGE',
        message: 'Invalid package type'
      });
    }

    // Generate customer ID
    const customerId = generateCustomerId();

    // Initialize Supabase service
    const supabaseService = createSupabaseService();
    await supabaseService.initialize();

    // Prepare customer data for Supabase
    const customerData = {
      customerId,
      firstName: businessInfo.firstName,
      lastName: businessInfo.lastName,
      businessName: businessInfo.businessName,
      email: businessInfo.email,
      phone: businessInfo.phone || '',
      website: businessInfo.website || '',
      address: businessInfo.address || '',
      city: businessInfo.city || '',
      state: businessInfo.state || '',
      zip: businessInfo.zip || '',
      packageType: businessInfo.packageType.toLowerCase(),
      status: 'active'
    };

    // Add to Supabase
    const result = await supabaseService.addCustomer(customerData);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return res.status(201).json({
      ok: true,
      customerId,
      message: 'Customer information submitted successfully',
      data: {
        customerId,
        firstName: businessInfo.firstName,
        lastName: businessInfo.lastName,
        businessName: businessInfo.businessName,
        email: businessInfo.email,
        packageType: businessInfo.packageType.toLowerCase()
      }
    });

  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.error('[business-info.submit] error', { name: err?.name, message: err?.message });
    
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Failed to submit business information'
    });
  }
}