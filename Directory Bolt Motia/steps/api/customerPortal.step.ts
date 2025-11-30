import { DirectoryBoltDB } from '../utils/database';
import { DirectorySubmissionService } from '../utils/directorySubmission';
import { CustomerAnalytics } from '../utils/customerAnalytics';

export const config = {
  name: 'CustomerPortalAPI',
  type: 'api',
  path: '/api/customer/*',
  method: 'GET,POST',
  auth: true // Require authentication
};

export const handler = async (req: any, { logger }: { logger: any }) => {
  logger.info('Customer portal API accessed', { path: req.path });
  
  try {
    // Initialize services
    const db = new DirectoryBoltDB(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const submissionService = new DirectorySubmissionService(db);
    const analyticsService = new CustomerAnalytics(db);
    
    // Extract customer ID from auth context (in real implementation)
    const customerId = req.headers['x-customer-id'] || 'test-customer-id';
    
    // Route based on path
    if (req.path === '/api/customer/profile') {
      // Get customer profile
      const customer = await db.getCustomerById(customerId);
      return {
        status: 200,
        body: { customer }
      };
    }
    
    else if (req.path === '/api/customer/jobs') {
      // Get customer jobs
      const jobs = await db.getCustomerJobs(customerId);
      return {
        status: 200,
        body: { jobs }
      };
    }
    
    else if (req.path.startsWith('/api/customer/jobs/') && req.path.endsWith('/status')) {
      // Get specific job status
      const jobId = req.path.split('/')[4];
      const status = await submissionService.getSubmissionStatus(jobId);
      return {
        status: 200,
        body: { status }
      };
    }
    
    else if (req.path === '/api/customer/directories') {
      // Get customer directories
      const directories = await db.getCustomerDirectories(customerId);
      return {
        status: 200,
        body: { directories }
      };
    }
    
    else if (req.path === '/api/customer/stats') {
      // Get customer stats
      const stats = await db.getCustomerStats(customerId);
      return {
        status: 200,
        body: { stats }
      };
    }
    
    else if (req.path === '/api/customer/analytics/performance') {
      // Get performance report
      const { start, end } = req.query;
      
      if (!start || !end) {
        return {
          status: 400,
          body: { error: 'Start and end dates are required' }
        };
      }
      
      const report = await analyticsService.getCustomerPerformanceReport(customerId, { start, end });
      return {
        status: 200,
        body: { report }
      };
    }
    
    else if (req.path === '/api/customer/analytics/directories') {
      // Get directory success rates
      const rates = await analyticsService.getCustomerDirectorySuccessRates(customerId);
      return {
        status: 200,
        body: { rates }
      };
    }
    
    else if (req.path === '/api/customer/submission' && req.method === 'POST') {
      // Create new submission
      const { packageType, businessData } = req.body;
      
      if (!packageType || !businessData) {
        return {
          status: 400,
          body: { error: 'Package type and business data are required' }
        };
      }
      
      const result = await submissionService.createSubmissionJob(customerId, packageType, businessData);
      return {
        status: 200,
        body: { result }
      };
    }
    
    else if (req.path.startsWith('/api/customer/submission/') && req.method === 'DELETE') {
      // Cancel submission
      const jobId = req.path.split('/')[4];
      const result = await submissionService.cancelSubmission(jobId);
      return {
        status: 200,
        body: { result }
      };
    }
    
    else {
      return {
        status: 404,
        body: { error: 'Endpoint not found' }
      };
    }
  } catch (error: any) {
    logger.error('Customer portal API error:', error);
    return {
      status: 500,
      body: {
        error: error.message
      }
    };
  }
};