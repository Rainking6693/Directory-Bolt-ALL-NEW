import { NextApiRequest, NextApiResponse } from 'next';

interface CustomerData {
  id: string;
  businessName: string;
  email: string;
  website: string;
  packageType: string;
  directoryLimit: number;
  status: string;
  progress: number;
  submittedDirectories: number;
  purchaseDate: string;
  estimatedCompletion: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerId } = req.query;

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    // Fetch customer data from database
    const customerData = await getCustomerData(customerId);

    if (!customerData) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(200).json(customerData);

  } catch (error) {
    console.error('Error fetching customer data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getCustomerData(customerId: string): Promise<CustomerData | null> {
  try {
    // This would typically query your Google Sheets or database
    // For demo purposes, we'll simulate realistic customer data
    
    // Validate Customer ID format
    if (!customerId.match(/^DIR-2025-[A-Z0-9]{6}$/)) {
      return null;
    }

    // Calculate realistic progress based on time since purchase
    const purchaseDate = new Date();
    purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 10)); // Random date within last 10 days
    
    const daysSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const progress = Math.min(Math.floor((daysSincePurchase / 7) * 100), 100); // 7 days for completion
    
    // Determine package details
    const packages = {
      'Starter': { limit: 50, price: 197 },
      'Growth': { limit: 100, price: 297 },
      'Professional': { limit: 200, price: 497 },
      'Enterprise': { limit: 480, price: 799 }
    };
    
    const packageTypes = Object.keys(packages);
    const packageType = packageTypes[Math.floor(Math.random() * packageTypes.length)];
    const packageInfo = packages[packageType as keyof typeof packages];
    
    const submittedDirectories = Math.floor((progress / 100) * packageInfo.limit);
    
    // Calculate estimated completion
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(purchaseDate.getDate() + 7);

    const mockCustomerData: CustomerData = {
      id: customerId,
      businessName: 'Demo Business LLC',
      email: 'demo@example.com',
      website: 'https://demo-business.com',
      packageType: packageType,
      directoryLimit: packageInfo.limit,
      status: progress === 100 ? 'completed' : progress > 0 ? 'in-progress' : 'pending',
      progress: progress,
      submittedDirectories: submittedDirectories,
      purchaseDate: purchaseDate.toISOString(),
      estimatedCompletion: estimatedCompletion.toLocaleDateString()
    };

    return mockCustomerData;

  } catch (error) {
    console.error('Error getting customer data:', error);
    return null;
  }
}

// Real implementation using Google Sheets:
/*
import { createGoogleSheetsService } from '../../../lib/services/google-sheets.js';

async function getCustomerData(customerId: string): Promise<CustomerData | null> {
  try {
    const googleSheetsService = createGoogleSheetsService();
    
    const customer = await googleSheetsService.findByCustomerId(customerId);

    if (!customer) {
      return null;
    }
    
    // Calculate progress based on submitted directories
    const submittedDirectories = customer.directoriesSubmitted || 0;
    const directoryLimit = customer.totalDirectories || 100;
    const progress = Math.floor((submittedDirectories / directoryLimit) * 100);
    
    return {
      id: customer.customerID || customer.customerId,
      businessName: customer.businessName,
      email: customer.email,
      website: customer.website,
      packageType: customer.packageType,
      directoryLimit: directoryLimit,
      status: customer.submissionStatus,
      progress: progress,
      submittedDirectories: submittedDirectories,
      purchaseDate: customer.purchaseDate,
      estimatedCompletion: customer.submissionEndDate || 'TBD'
    };

  } catch (error) {
    console.error('Google Sheets customer data error:', error);
    return null;
  }
}
*/