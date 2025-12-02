import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { getSupabaseClient } from '../utils/supabaseClient';

export const config: ApiRouteConfig = {
  name: 'StaffDashboardAPI',
  type: 'api',
  path: '/api/staff/*',
  method: 'GET',
  flows: ['directory-bolt'],
  emits: [],
  bodySchema: z.object({})
};

export const handler: Handlers['StaffDashboardAPI'] = async (req, { logger }) => {
  const requestPath = (req as any).path ?? (req as any).url ?? ''
  const queryParams = ((req as any).query ?? {}) as any

  logger.info('Staff dashboard API accessed', { path: requestPath });

  const supabase = getSupabaseClient();

  try {
    // Route based on the specific endpoint
    if (requestPath === '/api/staff/jobs') {
      // Get all jobs with pagination
      const { limit = 100, offset = 0, status } = queryParams;

      let query: any = supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error }: any = await query;

      if (error) {
        throw new Error(`Failed to fetch jobs: ${error.message}`);
      }

      return {
        status: 200,
        body: {
          jobs: data,
          count: data.length
        }
      };
    }

    else if (requestPath === '/api/staff/jobs/active') {
      // Get active jobs (pending or in_progress)
      const { data, error }: any = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch active jobs: ${error.message}`);
      }

      return {
        status: 200,
        body: {
          jobs: data
        }
      };
    }

    else if (requestPath.startsWith('/api/staff/jobs/') && requestPath.endsWith('/results')) {
      // Extract job ID from path: /api/staff/jobs/{jobId}/results
      const jobId = requestPath.split('/')[4];

      const { data, error }: any = await supabase
        .from('job_results')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch job results: ${error.message}`);
      }

      return {
        status: 200,
        body: {
          results: data
        }
      };
    }

    else if (requestPath.startsWith('/api/staff/jobs/') && requestPath.endsWith('/history')) {
      // Extract job ID from path: /api/staff/jobs/{jobId}/history
      const jobId = requestPath.split('/')[4];

      const { data, error }: any = await supabase
        .from('queue_history')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to fetch job history: ${error.message}`);
      }

      return {
        status: 200,
        body: {
          history: data
        }
      };
    }

    else if (requestPath === '/api/staff/stats') {
      // Get statistics
      const { data: allJobs, error }: any = await supabase
        .from('jobs')
        .select('status');

      if (error) {
        throw new Error(`Failed to fetch job stats: ${error.message}`);
      }

      const stats = {
        total: allJobs.length,
        pending: allJobs.filter((j: any) => j.status === 'pending').length,
        in_progress: allJobs.filter((j: any) => j.status === 'in_progress').length,
        completed: allJobs.filter((j: any) => j.status === 'completed').length,
        failed: allJobs.filter((j: any) => j.status === 'failed').length
      };

      return {
        status: 200,
        body: {
          stats
        }
      };
    }

    else {
      return {
        status: 404,
        body: {
          error: 'Endpoint not found'
        }
      };
    }
  } catch (error: any) {
    logger.error('Staff dashboard API error:', error);
    return {
      status: 500,
      body: {
        error: error.message
      }
    };
  }
};
