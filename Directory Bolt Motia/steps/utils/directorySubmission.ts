// Directory submission utility for DirectoryBolt customers
export class DirectorySubmissionService {
  private db: any; // Database instance
  private brainServiceUrl: string;
  
  constructor(database: any, brainServiceUrl: string = 'http://localhost:3000') {
    this.db = database;
    this.brainServiceUrl = brainServiceUrl;
  }
  
  async createSubmissionJob(customerId: string, packageType: string, businessData: any) {
    // Validate package type
    const validPackages = ['starter', 'growth', 'professional', 'enterprise'];
    if (!validPackages.includes(packageType)) {
      throw new Error(`Invalid package type. Must be one of: ${validPackages.join(', ')}`);
    }
    
    // Determine package size based on package type
    const packageSizes: Record<string, number> = {
      'starter': 10,
      'growth': 25,
      'professional': 50,
      'enterprise': 100
    };
    
    const packageSize = packageSizes[packageType];
    
    // Create job record
    const jobId = this.generateUUID();
    
    const jobData = {
      id: jobId,
      customer_id: customerId,
      status: 'pending',
      package_type: packageType,
      directories_total: packageSize,
      directories_done: 0,
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Save job to database
    const { data, error } = await this.db
      .from('jobs')
      .insert(jobData);
    
    if (error) throw new Error(`Failed to create job: ${error.message}`);
    
    // Save customer business data if not already present
    await this.saveBusinessProfile(customerId, businessData);
    
    // Enqueue job for processing
    await this.enqueueJob(jobId, customerId, packageSize, packageType);
    
    return {
      jobId,
      status: 'pending',
      packageType,
      directoriesTotal: packageSize
    };
  }
  
  private async saveBusinessProfile(customerId: string, businessData: any) {
    // Check if customer already has business data
    const { data: existing } = await this.db
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single();
    
    if (existing) {
      // Update existing customer data
      const { error } = await this.db
        .from('customers')
        .update({
          business_name: businessData.name,
          business_address: businessData.address,
          business_phone: businessData.phone,
          business_email: businessData.email,
          business_website: businessData.website,
          business_description: businessData.description,
          business_categories: businessData.categories ? businessData.categories.join(',') : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);
      
      if (error) throw new Error(`Failed to update customer: ${error.message}`);
    } else {
      // Create new customer record
      const { error } = await this.db
        .from('customers')
        .insert({
          id: customerId,
          email: businessData.email,
          business_name: businessData.name,
          business_address: businessData.address,
          business_phone: businessData.phone,
          business_email: businessData.email,
          business_website: businessData.website,
          business_description: businessData.description,
          business_categories: businessData.categories ? businessData.categories.join(',') : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw new Error(`Failed to create customer: ${error.message}`);
    }
  }
  
  private async enqueueJob(jobId: string, customerId: string, packageSize: number, packageType: string) {
    // In a real implementation, this would enqueue the job to SQS or trigger an event
    // For now, we'll emit an event that our job processor can listen to
    console.log(`Enqueuing job ${jobId} for customer ${customerId}`);
    
    // This would typically call an API endpoint or emit an event
    // For now, we'll simulate by calling the job processor directly
    return { message: 'Job enqueued successfully' };
  }
  
  async getSubmissionStatus(jobId: string) {
    const { data, error } = await this.db
      .from('jobs')
      .select(`
        id,
        status,
        package_type,
        directories_total,
        directories_done,
        progress,
        created_at,
        started_at,
        completed_at,
        error_message
      `)
      .eq('id', jobId)
      .single();
    
    if (error) throw new Error(`Failed to fetch job status: ${error.message}`);
    
    // Get recent results
    const { data: results } = await this.db
      .from('job_results')
      .select('directory_name, status, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return {
      ...data,
      recentResults: results || []
    };
  }
  
  async cancelSubmission(jobId: string) {
    // Check if job can be cancelled
    const { data: job } = await this.db
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .single();
    
    if (!job) throw new Error('Job not found');
    
    const cancellableStatuses = ['pending', 'in_progress'];
    if (!cancellableStatuses.includes(job.status)) {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }
    
    // Update job status to cancelled
    const { error } = await this.db
      .from('jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    if (error) throw new Error(`Failed to cancel job: ${error.message}`);
    
    return { message: 'Job cancelled successfully' };
  }
  
  private generateUUID(): string {
    // Simple UUID generator (in real implementation, use a proper library)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}