// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseService } from '../../../lib/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabaseService = createSupabaseService();
    
    // Test direct service query
    const result = await supabaseService.getAllCustomers(2);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Also test direct client access with EXACT SAME QUERY as service
    await supabaseService.initialize();
    const { data: rawData, error } = await supabaseService.client
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2);
      
    if (error) {
      throw new Error(error.message);
    }
    
    return res.status(200).json({
      ok: true,
      message: 'Supabase test successful',
      serviceData: result.customers,
      rawData: rawData,
      comparison: {
        serviceCount: result.customers.length,
        rawCount: rawData.length,
        firstServiceId: result.customers[0]?.customerId,
        firstRawId: rawData[0]?.id
      }
    });
    
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}