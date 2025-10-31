import { NextApiRequest, NextApiResponse } from 'next';

interface ProgressMilestone {
  percentage: number;
  label: string;
  completed: boolean;
  date?: string;
}

interface ProgressData {
  customerId: string;
  currentProgress: number;
  milestones: ProgressMilestone[];
  lastUpdated: string;
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

    // Fetch progress data from database
    const progressData = await getProgressData(customerId);

    if (!progressData) {
      return res.status(404).json({ error: 'Progress data not found' });
    }

    res.status(200).json(progressData);

  } catch (error) {
    console.error('Error fetching progress data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProgressData(customerId: string): Promise<ProgressData | null> {
  try {
    // This would typically query your Google Sheets or database
    // For demo purposes, we'll simulate realistic progress data
    
    // Validate Customer ID format
    if (!customerId.match(/^DIR-2025-[A-Z0-9]{6}$/)) {
      return null;
    }

    // Calculate realistic progress based on time since purchase
    const purchaseDate = new Date();
    purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 10)); // Random date within last 10 days
    
    const daysSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentProgress = Math.min(Math.floor((daysSincePurchase / 7) * 100), 100); // 7 days for completion
    
    // Generate milestone data based on current progress
    const milestones: ProgressMilestone[] = [
      {
        percentage: 0,
        label: 'Order Received & Processing Started',
        completed: currentProgress >= 0,
        date: currentProgress >= 0 ? purchaseDate.toLocaleDateString() : undefined
      },
      {
        percentage: 25,
        label: 'Business Analysis Complete',
        completed: currentProgress >= 25,
        date: currentProgress >= 25 ? new Date(purchaseDate.getTime() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString() : undefined
      },
      {
        percentage: 50,
        label: 'Directory Submissions Started',
        completed: currentProgress >= 50,
        date: currentProgress >= 50 ? new Date(purchaseDate.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString() : undefined
      },
      {
        percentage: 75,
        label: 'Majority of Submissions Complete',
        completed: currentProgress >= 75,
        date: currentProgress >= 75 ? new Date(purchaseDate.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString() : undefined
      },
      {
        percentage: 100,
        label: 'All Submissions Complete',
        completed: currentProgress >= 100,
        date: currentProgress >= 100 ? new Date(purchaseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString() : undefined
      }
    ];

    const progressData: ProgressData = {
      customerId: customerId,
      currentProgress: currentProgress,
      milestones: milestones,
      lastUpdated: new Date().toISOString()
    };

    return progressData;

  } catch (error) {
    console.error('Error getting progress data:', error);
    return null;
  }
}

// Real implementation using Google Sheets:
/*
import { createGoogleSheetsService } from '../../../lib/services/google-sheets.js';

async function getProgressData(customerId: string): Promise<ProgressData | null> {
  try {
    const googleSheetsService = createGoogleSheetsService();
    
    // Get customer record
    const customer = await googleSheetsService.findByCustomerId(customerId);

    if (!customer) {
      return null;
    }

    const currentProgress = customer.successRate || 0;
    
    // Generate milestone data based on customer progress
    const milestones: ProgressMilestone[] = [
      {
        percentage: 0,
        label: 'Processing Started',
        completed: true,
        date: customer.submissionStartDate
      },
      {
        percentage: 25,
        label: 'Initial Submissions',
        completed: currentProgress >= 25,
        date: currentProgress >= 25 ? customer.submissionStartDate : undefined
      },
      {
        percentage: 50,
        label: 'Half Complete',
        completed: currentProgress >= 50,
        date: currentProgress >= 50 ? customer.submissionStartDate : undefined
      },
      {
        percentage: 75,
        label: 'Nearly Complete',
        completed: currentProgress >= 75,
        date: currentProgress >= 75 ? customer.submissionStartDate : undefined
      },
      {
        percentage: 100,
        label: 'All Submissions Complete',
        completed: currentProgress >= 100,
        date: currentProgress >= 100 ? customer.submissionEndDate : undefined
      }
    ];

    return {
      customerId: customerId,
      currentProgress: currentProgress,
      milestones: milestones,
      lastUpdated: customer.lastUpdated || new Date().toISOString()
    };

  } catch (error) {
    console.error('Google Sheets progress data error:', error);
    return null;
  }
}
*/