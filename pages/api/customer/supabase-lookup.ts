/**
 * Supabase Customer Lookup API
 * 
 * Provides backward-compatible customer lookup for migrated customers
 * Maps original Google Sheets customer IDs to Supabase customer records
 * 
 * Used by:
 * - Chrome Extension validation
 * - Staff Dashboard customer loading
 * - Queue processing system
 * - Customer authentication
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for customer lookup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CustomerLookupResponse {
  found: boolean;
  customer?: {
    id: string;
    customerId: string; // Original customer ID for backward compatibility
    firstName: string;
    lastName: string;
    fullName: string;
    businessName: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    packageType: string;
    subscriptionTier: string;
    status: string;
    creditsRemaining: number;
    creditsLimit: number;
    isActive: boolean;
    isVerified: boolean;
    created: string;
    businessData: any;
  };
  error?: string;
  source: 'supabase' | 'google_sheets_fallback';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CustomerLookupResponse>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      found: false,
      error: 'Method not allowed',
      source: 'supabase'
    });
  }

  try {
    const customerId = req.method === 'GET' 
      ? req.query.customerId as string
      : req.body.customerId;

    if (!customerId) {
      return res.status(400).json({
        found: false,
        error: 'Customer ID is required',
        source: 'supabase'
      });
    }

    console.log(`🔍 Looking up customer: ${customerId}`);

    // Validate customer ID format
    if (!isValidCustomerId(customerId)) {
      return res.status(400).json({
        found: false,
        error: 'Invalid customer ID format',
        source: 'supabase'
      });
    }

    // Lookup customer in Supabase by original customer ID
    const customer = await findCustomerInSupabase(customerId);

    if (customer) {
      console.log(`✅ Customer found in Supabase: ${customer.fullName}`);
      
      return res.status(200).json({
        found: true,
        customer,
        source: 'supabase'
      });
    }

    // Fallback to Google Sheets for customers not yet migrated
    console.log(`⚠️  Customer not found in Supabase, checking Google Sheets fallback...`);
    
    const fallbackCustomer = await findCustomerInGoogleSheetsFallback(customerId);
    
    if (fallbackCustomer) {
      console.log(`✅ Customer found in Google Sheets fallback: ${fallbackCustomer.fullName}`);
      
      return res.status(200).json({
        found: true,
        customer: fallbackCustomer,
        source: 'google_sheets_fallback'
      });
    }

    // Customer not found in either source
    console.log(`❌ Customer not found: ${customerId}`);
    
    return res.status(404).json({
      found: false,
      error: 'Customer not found',
      source: 'supabase'
    });

  } catch (error) {
    console.error('❌ Customer lookup error:', error);
    
    return res.status(500).json({
      found: false,
      error: 'Internal server error during customer lookup',
      source: 'supabase'
    });
  }
}

async function findCustomerInSupabase(customerId: string): Promise<CustomerLookupResponse['customer'] | null> {
  try {
    // Query only fields that exist in the actual customers table schema
    let { data, error } = await supabase
      .from('customers')
      .select('customer_id,business_name,email,phone,website,address,city,state,zip,package_type,created_at,description,category')
      .eq('customer_id', customerId.trim().toUpperCase())
      .single();

    // If not found by direct customer_id match, return null
    // (removed metadata search as those fields don't exist in current schema)

    if (error || !data) {
      return null;
    }

    // Transform Supabase customer to expected format using actual schema fields
    return {
      id: data.customer_id, // Use customer_id as the ID
      customerId: data.customer_id,
      firstName: '', // Not stored separately in current schema
      lastName: '', // Not stored separately in current schema
      fullName: data.business_name, // Use business name as full name
      businessName: data.business_name || '',
      email: data.email || '',
      phone: data.phone || '',
      website: data.website || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      packageType: data.package_type || 'starter',
      subscriptionTier: mapPackageToTier(data.package_type || 'starter'),
      status: 'active', // Default to active since status column doesn't exist
      creditsRemaining: 0, // Not tracked in current schema
      creditsLimit: 0, // Not tracked in current schema
      isActive: true, // Default to true
      isVerified: true, // Default to true
      created: data.created_at,
      businessData: {
        description: data.description,
        category: data.category
      }
    };

  } catch (error) {
    console.error('Error finding customer in Supabase:', error);
    return null;
  }
}

async function findCustomerInGoogleSheetsFallback(customerId: string): Promise<CustomerLookupResponse['customer'] | null> {
  try {
    // Import Google Sheets service for fallback
    const { createGoogleSheetsService } = require('../../../lib/services/google-sheets.js');
    
    const googleSheetsService = createGoogleSheetsService();
    await googleSheetsService.initialize();
    
    const result = await googleSheetsService.getCustomerById(customerId);
    
    if (!result.found || !result.customer) {
      return null;
    }

    const customer = result.customer;
    
    // Transform Google Sheets customer to expected format
    return {
      id: customer.customerId, // Use customer ID as ID for fallback
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: `${customer.firstName} ${customer.lastName}`.trim() || customer.businessName,
      businessName: customer.businessName,
      email: customer.email,
      phone: customer.phone,
      website: customer.website,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
      packageType: customer.packageType,
      subscriptionTier: mapPackageToTier(customer.packageType),
      status: customer.status,
      creditsRemaining: getPackageCredits(customer.packageType),
      creditsLimit: getPackageCredits(customer.packageType),
      isActive: customer.status === 'active' || customer.status === 'pending',
      isVerified: true,
      created: customer.created,
      businessData: {
        original_customer_id: customer.customerId,
        source: 'google_sheets_fallback'
      }
    };

  } catch (error) {
    console.error('Error in Google Sheets fallback lookup:', error);
    return null;
  }
}

function isValidCustomerId(customerId: string): boolean {
  // Support multiple customer ID formats for backward compatibility
  const patterns = [
    /^DIR-\d{8}-\d{6}$/, // DIR-20250917-000001
    /^DIR-\d{4}-\d{6}$/,  // DIR-2025-001234
    /^DB-\d+$/,           // DB-123456
    /^TEST-.*$/           // TEST-CUSTOMER-123
  ];
  
  return patterns.some(pattern => pattern.test(customerId));
}

function extractFirstName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || '';
}

function extractLastName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(1).join(' ') || '';
}

function mapTierToPackage(tier: string): string {
  const tierToPackageMap: { [key: string]: string } = {
    'basic': 'starter',
    'pro': 'professional',
    'enterprise': 'enterprise'
  };
  
  return tierToPackageMap[tier] || 'starter';
}

function mapPackageToTier(packageType: string): string {
  const packageToTierMap: { [key: string]: string } = {
    'starter': 'basic',
    'growth': 'pro',
    'professional': 'pro',
    'enterprise': 'enterprise'
  };
  
  return packageToTierMap[packageType?.toLowerCase()] || 'basic';
}

function mapSupabaseStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'active': 'active',
    'trialing': 'pending',
    'past_due': 'past_due',
    'cancelled': 'cancelled',
    'unpaid': 'unpaid'
  };
  
  return statusMap[status] || 'pending';
}

function getPackageCredits(packageType: string): number {
  const packageCredits: { [key: string]: number } = {
    'starter': 100,
    'growth': 500,
    'professional': 1000,
    'enterprise': 2000
  };
  
  return packageCredits[packageType?.toLowerCase()] || 100;
}