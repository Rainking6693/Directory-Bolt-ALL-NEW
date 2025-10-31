import { NextApiRequest, NextApiResponse } from 'next';

interface DirectorySubmission {
  id: string;
  directoryName: string;
  status: 'pending' | 'submitted' | 'approved' | 'failed';
  submissionDate?: string;
  approvalDate?: string;
  directoryUrl: string;
  notes?: string;
}

interface SubmissionsData {
  customerId: string;
  submissions: DirectorySubmission[];
  totalSubmissions: number;
  successfulSubmissions: number;
  pendingSubmissions: number;
  failedSubmissions: number;
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

    // Fetch submissions data from database
    const submissionsData = await getSubmissionsData(customerId);

    if (!submissionsData) {
      return res.status(404).json({ error: 'Submissions data not found' });
    }

    res.status(200).json(submissionsData);

  } catch (error) {
    console.error('Error fetching submissions data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getSubmissionsData(customerId: string): Promise<SubmissionsData | null> {
  try {
    // This would typically query your Google Sheets or database
    // For demo purposes, we'll simulate realistic submissions data
    
    // Validate Customer ID format
    if (!customerId.match(/^DIR-2025-[A-Z0-9]{6}$/)) {
      return null;
    }

    // Sample directory data
    const sampleDirectories = [
      { name: 'Google My Business', url: 'https://business.google.com' },
      { name: 'Yelp', url: 'https://yelp.com' },
      { name: 'Facebook Business', url: 'https://facebook.com/business' },
      { name: 'Better Business Bureau', url: 'https://bbb.org' },
      { name: 'Yellow Pages', url: 'https://yellowpages.com' },
      { name: 'Foursquare', url: 'https://foursquare.com' },
      { name: 'Bing Places', url: 'https://bing.com/places' },
      { name: 'Apple Maps', url: 'https://mapsconnect.apple.com' },
      { name: 'TripAdvisor', url: 'https://tripadvisor.com' },
      { name: 'Angie\'s List', url: 'https://angieslist.com' },
      { name: 'Thumbtack', url: 'https://thumbtack.com' },
      { name: 'HomeAdvisor', url: 'https://homeadvisor.com' },
      { name: 'Nextdoor', url: 'https://nextdoor.com' },
      { name: 'Citysearch', url: 'https://citysearch.com' },
      { name: 'Superpages', url: 'https://superpages.com' }
    ];

    // Calculate realistic progress based on time since purchase
    const purchaseDate = new Date();
    purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 10)); // Random date within last 10 days
    
    const daysSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const progressPercentage = Math.min(Math.floor((daysSincePurchase / 7) * 100), 100); // 7 days for completion
    
    // Generate submissions based on progress
    const totalDirectoriesToShow = Math.min(15, Math.floor((progressPercentage / 100) * 15) + 3); // Show at least 3
    const submissions: DirectorySubmission[] = [];

    for (let i = 0; i < totalDirectoriesToShow; i++) {
      const directory = sampleDirectories[i];
      const submissionDate = new Date(purchaseDate.getTime() + i * 12 * 60 * 60 * 1000); // Stagger submissions every 12 hours
      
      let status: DirectorySubmission['status'];
      let approvalDate: string | undefined;
      let notes: string | undefined;

      // Determine status based on how long ago it was submitted
      const hoursAgo = (Date.now() - submissionDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 0) {
        status = 'pending';
      } else if (hoursAgo < 24) {
        status = 'submitted';
      } else if (Math.random() > 0.1) { // 90% success rate
        status = 'approved';
        approvalDate = new Date(submissionDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else {
        status = 'failed';
        notes = 'Manual review required - will be resubmitted';
      }

      submissions.push({
        id: `sub-${customerId}-${i + 1}`,
        directoryName: directory.name,
        status: status,
        submissionDate: hoursAgo >= 0 ? submissionDate.toISOString() : undefined,
        approvalDate: approvalDate,
        directoryUrl: directory.url,
        notes: notes
      });
    }

    // Calculate statistics
    const successfulSubmissions = submissions.filter(s => s.status === 'approved').length;
    const pendingSubmissions = submissions.filter(s => s.status === 'pending' || s.status === 'submitted').length;
    const failedSubmissions = submissions.filter(s => s.status === 'failed').length;

    const submissionsData: SubmissionsData = {
      customerId: customerId,
      submissions: submissions,
      totalSubmissions: submissions.length,
      successfulSubmissions: successfulSubmissions,
      pendingSubmissions: pendingSubmissions,
      failedSubmissions: failedSubmissions
    };

    return submissionsData;

  } catch (error) {
    console.error('Error getting submissions data:', error);
    return null;
  }
}

// Real implementation using Google Sheets:
/*
import { createGoogleSheetsService } from '../../../lib/services/google-sheets.js';

async function getSubmissionsData(customerId: string): Promise<SubmissionsData | null> {
  try {
    const googleSheetsService = createGoogleSheetsService();
    
    // Get customer record which contains submission results
    const customer = await googleSheetsService.findByCustomerId(customerId);

    if (!customer) {
      return null;
    }

    // Parse submission results from the customer record
    let submissions: DirectorySubmission[] = [];
    
    if (customer.submissionResults) {
      try {
        const submissionResults = JSON.parse(customer.submissionResults);
        submissions = submissionResults.map((result: any, index: number) => ({
          id: `${customerId}-${index}`,
          directoryName: result.directoryName || result.directory,
          status: result.status || 'pending',
          submissionDate: result.submissionDate || customer.submissionStartDate,
          approvalDate: result.approvalDate,
          directoryUrl: result.directoryUrl || result.url,
          notes: result.notes || result.error
        }));
      } catch (parseError) {
        console.warn('Failed to parse submission results:', parseError);
      }
    }

    // Calculate statistics
    const successfulSubmissions = submissions.filter(s => s.status === 'approved' || s.status === 'success').length;
    const pendingSubmissions = submissions.filter(s => s.status === 'pending' || s.status === 'submitted').length;
    const failedSubmissions = submissions.filter(s => s.status === 'failed' || s.status === 'error').length;

    return {
      customerId: customerId,
      submissions: submissions,
      totalSubmissions: submissions.length,
      successfulSubmissions: successfulSubmissions,
      pendingSubmissions: pendingSubmissions,
      failedSubmissions: failedSubmissions
    };

  } catch (error) {
    console.error('Google Sheets submissions data error:', error);
    return null;
  }
}
*/