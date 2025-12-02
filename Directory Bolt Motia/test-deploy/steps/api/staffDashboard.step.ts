export const config = {
  name: 'StaffDashboardAPI',
  type: 'api',
  path: '/api/staff/*',
  method: 'GET,POST',
  emits: []
};

export const handler = async (req: any, { logger }: { logger: any }) => {
  logger.info('Staff dashboard API accessed', { path: req.path });
  
  const supabase = getSupabaseClient();
  
  try {
    // Route based on the specific endpoint
    if (req.path === '/api/staff/jobs') {
      // Get all jobs with pagination
      const { limit = 100, offset = 0, status } = req.query;
      
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
    
    else if (req.path === '/api/staff/jobs/active') {
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
    
    else if (req.path.startsWith('/api/staff/jobs/') && req.path.endsWith('/results')) {
      // Extract job ID from path: /api/staff/jobs/{jobId}/results
      const jobId = req.path.split('/')[4];
      
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
    
    else if (req.path.startsWith('/api/staff/jobs/') && req.path.endsWith('/history')) {
      // Extract job ID from path: /api/staff/jobs/{jobId}/history
      const jobId = req.path.split('/')[4];
      
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
    
    else if (req.path === '/api/staff/stats') {
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

// Helper function to get Supabase client (implementation would use real credentials)
function getSupabaseClient() {
  // In a real implementation, this would initialize with actual Supabase credentials
  // For now, we're providing a mock implementation
  return {
    from: (table: string) => ({
      select: (columns: string = '*') => {
        let query: any = {
          data: [],
          error: null
        };
        
        // Add query methods
        query.eq = () => query;
        query.in = () => query;
        query.order = () => query;
        query.limit = () => query;
        query.range = () => query;
        
        return query;
      }
    })
  };
}
