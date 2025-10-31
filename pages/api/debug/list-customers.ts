import { NextApiRequest, NextApiResponse } from 'next';

const { createGoogleSheetsService } = require('../../../lib/services/google-sheets.js');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const googleSheetsService = createGoogleSheetsService();
    
    // Get all customers
    const allCustomers = await googleSheetsService.getAllCustomers(50);
    
    if (!allCustomers.success) {
      return res.status(500).json({
        success: false,
        error: allCustomers.error,
        customers: []
      });
    }

    // Also test finding by status
    const pendingCustomers = await googleSheetsService.findByStatus('pending');
    
    return res.status(200).json({
      success: true,
      totalCustomers: allCustomers.total,
      allCustomers: allCustomers.customers,
      pendingCustomers: pendingCustomers
    });

  } catch (error) {
    console.error('Error listing customers:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      customers: []
    });
  }
}