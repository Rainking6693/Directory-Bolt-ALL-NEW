import { NextApiRequest, NextApiResponse } from 'next';

const { createGoogleSheetsService } = require('../../../lib/services/google-sheets.js');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const googleSheetsService = createGoogleSheetsService();
    
    // Get all customers
    const allCustomers = await googleSheetsService.getAllCustomers(50);
    
    if (!allCustomers.success) {
      return res.status(500).json({
        success: false,
        error: allCustomers.error
      });
    }

    const results = [];
    
    // Update first 2 customers to pending status
    for (let i = 0; i < Math.min(2, allCustomers.customers.length); i++) {
      const customer = allCustomers.customers[i];
      try {
        const result = await googleSheetsService.updateCustomer(customer.customerId, { status: 'pending' });
        results.push({ 
          customerId: customer.customerId, 
          success: result.success,
          businessName: customer.businessName 
        });
      } catch (error) {
        results.push({ 
          customerId: customer.customerId, 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Updated customers to pending status',
      results
    });

  } catch (error) {
    console.error('Error updating customer status:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}