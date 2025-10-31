// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '../../../lib/googleSheets';
import { createSupabaseService } from '../../../lib/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabaseService = createSupabaseService();
    const healthCheck = await supabaseService.healthCheck();
    
    if (!healthCheck) {
      throw new Error('Supabase health check failed');
    }
    
    return res.status(200).json({ ok: true, database: 'supabase' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, reason: err?.message || 'unknown' });
  }
}