import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateStaffRequest } from '../../../lib/auth/guards';
import {
  TEST_MODE_ENABLED,
} from '../../../lib/auth/constants';
import { getSupabaseAdminClient } from '../../../lib/server/supabaseAdmin';
import { enqueueCustomerForAutoBolt } from '../../../lib/server/autoboltQueueSync';
import {
  getTestCustomerStore,
  upsertTestCustomer,
} from '../../../lib/testData/customers';

interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone?: string;
  website?: string;
  packageType?: string;
  directoryLimit?: number;
}

interface CreateCustomerResponse {
  success: boolean;
  customer?: any;
  customerId?: string;
  error?: string;
  message?: string;
  notes?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateCustomerResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const auth = authenticateStaffRequest(req);

    if (!auth.ok) {
      const status = auth.reason === 'CONFIG' ? 500 : 401;
      return res.status(status).json({
        success: false,
        error: auth.reason === 'CONFIG' ? 'Configuration error' : 'Unauthorized',
        message: auth.message ?? 'Valid staff or admin authentication required',
      });
    }

    const data: CreateCustomerRequest = req.body;

    if (!data?.firstName || !data?.lastName || !data?.businessName || !data?.email) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'First name, last name, business name, and email are required',
      });
    }

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      const { data: customerData, error } = await supabase
        .from('customers')
        .insert({
          firstName: data.firstName,
          lastName: data.lastName,
          businessName: data.businessName,
          email: data.email,
          phone: data.phone || null,
          website: data.website || null,
          packageType: data.packageType || 'STARTER',
          directoryLimit: data.directoryLimit || 25,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[customers.create] supabase insert failed', error);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: error.message,
        });
      }

      // AutoBolt enqueue (server-side) — logs success/failure
      const enqueue = await enqueueCustomerForAutoBolt(supabase as any, customerData as any)
      if (!enqueue.success) {
        console.warn('[customers.create] AutoBolt enqueue deferred/failed:', enqueue.message)
      }

      return res.status(201).json({
        success: true,
        customer: customerData,
        customerId: customerData.id,
        notes: enqueue.success ? ['Enqueued to AutoBolt processing queue'] : [
          'AutoBolt enqueue deferred or failed',
          enqueue.message,
        ],
      });
    }

    if (!TEST_MODE_ENABLED) {
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'Supabase credentials are missing. Enable TEST_MODE for local in-memory testing.',
      });
    }

    const store = getTestCustomerStore();
    const customerId = 'test-customer-' + Date.now();
    const customer = upsertTestCustomer({
      id: customerId,
      firstName: data.firstName,
      lastName: data.lastName,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone || null,
      website: data.website || null,
      packageType: data.packageType || 'STARTER',
      directoryLimit: data.directoryLimit || 25,
    });
    store.set(customerId, customer);

    return res.status(201).json({
      success: true,
      customer,
      customerId,
      notes: [
        'TEST_MODE enabled – using in-memory customer store.',
        'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist customers.',
      ],
    });
  } catch (error) {
    console.error('[customers.create] unexpected error', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
