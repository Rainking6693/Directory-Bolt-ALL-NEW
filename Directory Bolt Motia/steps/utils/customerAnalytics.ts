// Customer analytics utility for DirectoryBolt
export class CustomerAnalytics {
  private db: any; // Database instance
  
  constructor(database: any) {
    this.db = database;
  }
  
  async getCustomerPerformanceReport(customerId: string, dateRange: { start: string; end: string }) {
    // Get all jobs for customer in date range
    const { data: jobs, error: jobsError } = await this.db
      .from('jobs')
      .select('*')
      .eq('customer_id', customerId)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at', { ascending: false });
    
    if (jobsError) throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    
    // Calculate overall statistics
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((job: any) => job.status === 'completed').length;
    const failedJobs = jobs.filter((job: any) => job.status === 'failed').length;
    const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
    
    // Get all results for these jobs
    if (jobs.length === 0) {
      return {
        period: dateRange,
        summary: {
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          successRate: 0,
          totalDirectories: 0
        },
        dailyBreakdown: [],
        topDirectories: [],
        packagePerformance: {}
      };
    }
    
    const jobIds = jobs.map((job: any) => job.id);
    
    const { data: results, error: resultsError } = await this.db
      .from('job_results')
      .select('*')
      .in('job_id', jobIds);
    
    if (resultsError) throw new Error(`Failed to fetch results: ${resultsError.message}`);
    
    // Calculate daily breakdown
    const dailyBreakdown = this.calculateDailyBreakdown(jobs, results, dateRange);
    
    // Calculate top directories
    const topDirectories = this.calculateTopDirectories(results);
    
    // Calculate package performance
    const packagePerformance = this.calculatePackagePerformance(jobs, results);
    
    return {
      period: dateRange,
      summary: {
        totalJobs,
        completedJobs,
        failedJobs,
        successRate,
        totalDirectories: results.length
      },
      dailyBreakdown,
      topDirectories,
      packagePerformance
    };
  }
  
  private calculateDailyBreakdown(jobs: any[], results: any[], dateRange: { start: string; end: string }) {
    const dailyData: Record<string, any> = {};
    
    // Initialize daily data for each day in range
    const currentDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      dailyData[dateString] = {
        date: dateString,
        jobs: 0,
        completed: 0,
        failed: 0,
        directories: 0,
        successRate: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Populate with actual data
    jobs.forEach(job => {
      const date = job.created_at.split('T')[0];
      if (dailyData[date]) {
        dailyData[date].jobs++;
        if (job.status === 'completed') dailyData[date].completed++;
        if (job.status === 'failed') dailyData[date].failed++;
      }
    });
    
    results.forEach(result => {
      const date = result.created_at.split('T')[0];
      if (dailyData[date]) {
        dailyData[date].directories++;
      }
    });
    
    // Calculate success rates
    Object.values(dailyData).forEach(day => {
      if (day.jobs > 0) {
        day.successRate = Math.round((day.completed / day.jobs) * 100);
      }
    });
    
    return Object.values(dailyData);
  }
  
  private calculateTopDirectories(results: any[]) {
    const directoryCounts: Record<string, { submitted: number; success: number }> = {};
    
    results.forEach(result => {
      if (!directoryCounts[result.directory_name]) {
        directoryCounts[result.directory_name] = { submitted: 0, success: 0 };
      }
      
      directoryCounts[result.directory_name].submitted++;
      if (result.status === 'submitted') {
        directoryCounts[result.directory_name].success++;
      }
    });
    
    // Convert to array and sort by submission count
    const topDirectories = Object.entries(directoryCounts)
      .map(([name, stats]) => ({
        name,
        submitted: stats.submitted,
        success: stats.success,
        successRate: stats.submitted > 0 ? Math.round((stats.success / stats.submitted) * 100) : 0
      }))
      .sort((a, b) => b.submitted - a.submitted)
      .slice(0, 10); // Top 10
    
    return topDirectories;
  }
  
  private calculatePackagePerformance(jobs: any[], results: any[]) {
    const packageStats: Record<string, any> = {};
    
    // Initialize package stats
    const packages = ['starter', 'growth', 'professional', 'enterprise'];
    packages.forEach(pkg => {
      packageStats[pkg] = {
        jobs: 0,
        completed: 0,
        failed: 0,
        directories: 0,
        successRate: 0
      };
    });
    
    // Calculate stats
    jobs.forEach(job => {
      if (!packageStats[job.package_type]) return;
      
      packageStats[job.package_type].jobs++;
      if (job.status === 'completed') packageStats[job.package_type].completed++;
      if (job.status === 'failed') packageStats[job.package_type].failed++;
    });
    
    results.forEach(result => {
      // Find the job for this result to get package type
      const job = jobs.find(j => j.id === result.job_id);
      if (job && packageStats[job.package_type]) {
        packageStats[job.package_type].directories++;
      }
    });
    
    // Calculate success rates
    Object.keys(packageStats).forEach(pkg => {
      if (packageStats[pkg].jobs > 0) {
        packageStats[pkg].successRate = Math.round((packageStats[pkg].completed / packageStats[pkg].jobs) * 100);
      }
    });
    
    return packageStats;
  }
  
  async getCustomerDirectorySuccessRates(customerId: string) {
    // Get all completed jobs for customer
    const { data: jobs, error: jobsError } = await this.db
      .from('jobs')
      .select('id')
      .eq('customer_id', customerId)
      .eq('status', 'completed');
    
    if (jobsError) throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    
    if (jobs.length === 0) return [];
    
    const jobIds = jobs.map((job: any) => job.id);
    
    // Get all results for completed jobs
    const { data: results, error: resultsError } = await this.db
      .from('job_results')
      .select('directory_name, status')
      .in('job_id', jobIds);
    
    if (resultsError) throw new Error(`Failed to fetch results: ${resultsError.message}`);
    
    // Calculate success rate per directory
    const directoryStats: Record<string, { total: number; success: number; successRate: number }> = {};
    
    results.forEach((result: any) => {
      if (!directoryStats[result.directory_name]) {
        directoryStats[result.directory_name] = { total: 0, success: 0, successRate: 0 };
      }
      
      directoryStats[result.directory_name].total++;
      if (result.status === 'submitted') {
        directoryStats[result.directory_name].success++;
      }
    });
    
    // Calculate success rates and convert to array
    const directorySuccessRates = Object.entries(directoryStats)
      .map(([name, stats]) => ({
        directory: name,
        totalSubmissions: stats.total,
        successfulSubmissions: stats.success,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.successRate - a.successRate);
    
    return directorySuccessRates;
  }
}