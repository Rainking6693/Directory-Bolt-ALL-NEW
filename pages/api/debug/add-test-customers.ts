import { NextApiRequest, NextApiResponse } from 'next';

const { createGoogleSheetsService } = require('../../../lib/services/google-sheets.js');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const googleSheetsService = createGoogleSheetsService();
    
    // Test customers with pending status
    const testCustomers = [
      {
        customerId: 'DIR-20250917-000001',
        firstName: 'John',
        lastName: 'Smith',
        businessName: 'TechStart Solutions',
        email: 'john@techstart.com',
        phone: '+1-555-0101',
        website: 'https://techstart.com',
        address: '123 Tech Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        packageType: 'pro',
        status: 'pending'
      },
      {
        customerId: 'DIR-20250917-000002',
        firstName: 'Sarah',
        lastName: 'Johnson',
        businessName: 'Local Cafe & Bistro',
        email: 'sarah@localcafe.com',
        phone: '+1-555-0102',
        website: 'https://localcafe.com',
        address: '456 Main Street',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
        packageType: 'growth',
        status: 'pending'
      }
    ];

    const results = [];
    for (const customer of testCustomers) {
      try {
        const result = await googleSheetsService.addCustomer(customer);
        results.push({ customerId: customer.customerId, success: result.success });
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
      message: 'Test customers added',
      results
    });

  } catch (error) {
    console.error('Error adding test customers:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}