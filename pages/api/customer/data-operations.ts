// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseService } from '../../../lib/services/supabase';

interface CustomerData {
  customerId: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  packageType: string;
  status?: string;
  created?: string;
}

// Utility functions (previously from googleSheets)
function validateCustomerId(id: string): boolean {
  return /^DIR-\d{8}-\d{6}$/.test(id);
}

function generateCustomerId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `DIR-${dateStr}-${randomNum}`;
}

function getPackageLimit(packageType: string): number {
  const limits: Record<string, number> = {
    'starter': 50,
    'growth': 150,
    'professional': 300,
    'pro': 300,
    'enterprise': 500
  };
  return limits[packageType.toLowerCase()] || 50;
}

function validatePackageType(packageType: string): boolean {
  const validTypes = ['starter', 'growth', 'professional', 'pro', 'enterprise'];
  return validTypes.includes(packageType.toLowerCase());
}

function authenticateRequest(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const adminKey = process.env.ADMIN_API_KEY;
  const staffKey = process.env.STAFF_API_KEY;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === adminKey || token === staffKey;
}

function applyCors(res: NextApiResponse) {
  // SECURITY: Restrict CORS to specific allowed origins
  const allowedOrigins = [
    'https://directorybolt.com',
    'https://www.directorybolt.com',
    'https://directorybolt.netlify.app',
    'http://localhost:3000', // Development only
    'http://localhost:3001'  // Development only
  ];
  
  const origin = res.req?.headers.origin;
  
  // Only allow specific origins in production
  if (process.env.NODE_ENV === 'production') {
    const prodOrigins = allowedOrigins.filter(o => o.startsWith('https://'));
    if (origin && prodOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // Don't set CORS header for unauthorized origins
      return;
    }
  } else {
    // Development: Allow configured origins
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Check authentication
  if (!authenticateRequest(req)) {
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Admin or staff authentication required'
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetCustomers(req, res);
      case 'POST':
        return handleCreateCustomer(req, res);
      case 'PUT':
        return handleUpdateCustomer(req, res);
      case 'DELETE':
        return handleDeleteCustomer(req, res);
      default:
        res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
        return res.status(405).json({
          ok: false,
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed'
        });
    }
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    console.error('[customer.data-operations] error', { name: err?.name, message: err?.message });
    
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Customer data operation failed'
    });
  }
}

async function handleGetCustomers(req: NextApiRequest, res: NextApiResponse) {
  const { customerId, limit = '100' } = req.query;
  
  try {
    const supabaseService = createSupabaseService();
    
    // If specific customer ID requested
    if (customerId) {
      const customer = await supabaseService.findByCustomerId(customerId.toString());
      
      if (!customer) {
        return res.status(404).json({
          ok: false,
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found'
        });
      }

      return res.status(200).json({
        ok: true,
        customer: {
          ...customer,
          directoryLimit: getPackageLimit(customer.packageType)
        }
      });
    }

    // Get all customers with limit
    const limitNum = parseInt(limit.toString(), 10);
    const result = await supabaseService.getAllCustomers(limitNum);

    if (!result.success) {
      throw new Error(result.error);
    }

    return res.status(200).json({
      ok: true,
      customers: result.customers.map(customer => ({
        ...customer,
        directoryLimit: getPackageLimit(customer.packageType)
      })),
      total: result.customers.length
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({
      ok: false,
      code: 'SUPABASE_ERROR',
      message: `Failed to retrieve customers: ${err.message}`
    });
  }
}

async function handleCreateCustomer(req: NextApiRequest, res: NextApiResponse) {
  const customerData: Partial<CustomerData> = req.body;

  // Validate required fields
  const requiredFields = ['firstName', 'lastName', 'businessName', 'email', 'packageType'];
  const missingFields = requiredFields.filter(field => !customerData[field as keyof CustomerData]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_FIELDS',
      message: `Missing required fields: ${missingFields.join(', ')}`
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerData.email!)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_EMAIL',
      message: 'Invalid email format'
    });
  }

  // Validate package type
  if (!validatePackageType(customerData.packageType!)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_PACKAGE',
      message: 'Invalid package type'
    });
  }

  try {
    const supabaseService = createSupabaseService();
    
    // Generate customer ID
    const customerId = customerData.customerId || generateCustomerId();
    const timestamp = new Date().toISOString();

    // Create customer in Supabase
    const newCustomer = {
      customerId,
      firstName: customerData.firstName!,
      lastName: customerData.lastName!,
      businessName: customerData.businessName!,
      email: customerData.email!,
      phone: customerData.phone || '',
      website: customerData.website || '',
      address: customerData.address || '',
      city: customerData.city || '',
      state: customerData.state || '',
      zip: customerData.zip || '',
      packageType: customerData.packageType!,
      submissionStatus: customerData.status || 'pending',
      purchaseDate: timestamp
    };

    const result = await supabaseService.createBusinessSubmission(newCustomer);

    return res.status(201).json({
      ok: true,
      message: 'Customer created successfully',
      customer: {
        customerId,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        businessName: customerData.businessName,
        email: customerData.email,
        packageType: customerData.packageType,
        directoryLimit: getPackageLimit(customerData.packageType!),
        status: customerData.status || 'pending',
        created: timestamp
      }
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({
      ok: false,
      code: 'SUPABASE_ERROR',
      message: `Failed to create customer: ${err.message}`
    });
  }
}

async function handleUpdateCustomer(req: NextApiRequest, res: NextApiResponse) {
  const { customerId } = req.query;
  const updateData = req.body;

  if (!customerId) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_CUSTOMER_ID',
      message: 'Customer ID is required'
    });
  }

  if (!validateCustomerId(customerId.toString())) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_CUSTOMER_ID',
      message: 'Invalid customer ID format'
    });
  }

  // Validate package type if provided
  if (updateData.packageType && !validatePackageType(updateData.packageType)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_PACKAGE',
      message: 'Invalid package type'
    });
  }

  // Validate email format if provided
  if (updateData.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updateData.email)) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_EMAIL',
        message: 'Invalid email format'
      });
    }
  }

  try {
    const supabaseService = createSupabaseService();
    
    // Check if customer exists
    const existingCustomer = await supabaseService.findByCustomerId(customerId.toString());
    
    if (!existingCustomer) {
      return res.status(404).json({
        ok: false,
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      });
    }

    // Prepare update object with only allowed fields
    const allowedFields = ['firstName', 'lastName', 'businessName', 'email', 'phone', 
                          'website', 'address', 'city', 'state', 'zip', 'packageType', 'status'];
    
    const filteredUpdate: any = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredUpdate[field] = updateData[field];
      }
    }

    // Perform update
    const result = await supabaseService.updateCustomer(customerId.toString(), filteredUpdate);

    if (!result || !result.success) {
      throw new Error(result?.error || 'Update failed');
    }

    // Get updated customer data
    const updatedCustomer = await supabaseService.findByCustomerId(customerId.toString());

    return res.status(200).json({
      ok: true,
      message: 'Customer updated successfully',
      customer: {
        ...updatedCustomer,
        directoryLimit: getPackageLimit(updatedCustomer.packageType)
      }
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({
      ok: false,
      code: 'UPDATE_ERROR',
      message: `Failed to update customer: ${err.message}`
    });
  }
}

async function handleDeleteCustomer(req: NextApiRequest, res: NextApiResponse) {
  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_CUSTOMER_ID',
      message: 'Customer ID is required'
    });
  }

  if (!validateCustomerId(customerId.toString())) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_CUSTOMER_ID',
      message: 'Invalid customer ID format'
    });
  }

  try {
    const supabaseService = createSupabaseService();
    
    // Check if customer exists
    const existingCustomer = await supabaseService.findByCustomerId(customerId.toString());
    
    if (!existingCustomer) {
      return res.status(404).json({
        ok: false,
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found'
      });
    }

    // Perform soft delete by updating status to 'deleted'
    // This preserves data for audit trails while marking it as deleted
    const result = await supabaseService.updateCustomer(customerId.toString(), {
      status: 'deleted',
      deletedAt: new Date().toISOString()
    });

    if (!result || !result.success) {
      throw new Error(result?.error || 'Deletion failed');
    }

    return res.status(200).json({
      ok: true,
      message: 'Customer deleted successfully',
      customerId: customerId.toString(),
      deletedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    return res.status(500).json({
      ok: false,
      code: 'DELETE_ERROR',
      message: `Failed to delete customer: ${err.message}`
    });
  }
}
