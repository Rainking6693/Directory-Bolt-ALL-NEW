import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { DirectoryBoltDB } from '../utils/database';
import { DirectorySubmissionService } from '../utils/directorySubmission';
import { CustomerAnalytics } from '../utils/customerAnalytics';

export const config: ApiRouteConfig = {
  name: 'CustomerPortalAPI',
  type: 'api',
  path: '/api/customer/*',
  method: ['GET', 'POST'] as any,
  flows: ['directory-bolt'],
  emits: [],
  bodySchema: z.object({
    packageType: z.string().optional(),
    businessData: z.record(z.string(), z.any()).optional()
  })
};

export const handler: Handlers['CustomerPortalAPI'] = async (req, { logger }) => {
  const requestPath = (req as any).path ?? (req as any).url ?? ''
  const requestMethod = (req as any).method ?? (req as any).httpMethod ?? ''
  const queryParams = ((req as any).query ?? {}) as any

  logger.info('Customer portal API accessed', { path: requestPath });

  try {
    // Initialize services
    const db = new DirectoryBoltDB(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const submissionService = new DirectorySubmissionService(db);
    const analyticsService = new CustomerAnalytics(db);

    // Extract customer ID from auth context (in real implementation)
    const customerId = (req.headers['x-customer-id'] as string) || 'test-customer-id';

    // Route based on path
    if (requestPath === '/api/customer/profile') {
      // Get customer profile
      const customer = await db.getCustomerById(customerId);
      return {
        status: 200,
        body: { customer }
      };
    }

    else if (requestPath === '/api/customer/jobs') {
      // Get customer jobs
      const jobs = await db.getCustomerJobs(customerId);
      return {
        status: 200,
        body: { jobs }
      };
    }

    else if (requestPath.startsWith('/api/customer/jobs/') && requestPath.endsWith('/status')) {
      // Get specific job status
      const jobId = requestPath.split('/')[4];
      const status = await submissionService.getSubmissionStatus(jobId);
      return {
        status: 200,
        body: { status }
      };
    }

    else if (requestPath === '/api/customer/directories') {
      // Get customer directories
      const directories = await db.getCustomerDirectories(customerId);
      return {
        status: 200,
        body: { directories }
      };
    }

    else if (requestPath === '/api/customer/stats') {
      // Get customer stats
      const stats = await db.getCustomerStats(customerId);
      return {
        status: 200,
        body: { stats }
      };
    }

    else if (requestPath === '/api/customer/analytics/performance') {
      // Get performance report
      const { start, end } = queryParams;

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

    else if (requestPath === '/api/customer/analytics/directories') {
      // Get directory success rates
      const rates = await analyticsService.getCustomerDirectorySuccessRates(customerId);
      return {
        status: 200,
        body: { rates }
      };
    }

    else if (requestPath === '/api/customer/submission' && requestMethod === 'POST') {
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

    else if (requestPath.startsWith('/api/customer/submission/') && requestMethod === 'DELETE') {
      // Cancel submission
      const jobId = requestPath.split('/')[4];
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
