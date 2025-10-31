/**
 * AutoBolt Integration Service
 * Handles customer data flow from DirectoryBolt to AutoBolt extension
 * Updated to use Google Sheets instead of Airtable
 */

import { createGoogleSheetsService } from './google-sheets.js';

// Initialize Google Sheets Service
const googleSheetsService = createGoogleSheetsService();

export class AutoBoltIntegrationService {
  /**
   * Create customer record for AutoBolt processing
   */
  static async createCustomerRecord(customerData) {
    try {
      console.log('🎯 Creating AutoBolt customer record...');

      // Generate unique customer ID
      const customerId = this.generateCustomerId();

      // Validate and format business data for extension compatibility
      const formattedBusinessData = this.formatBusinessDataForExtension(customerData);

      // Determine directory limits based on package
      const directoryLimits = this.getDirectoryLimits(customerData.packageType);

      // Create Google Sheets record
      const record = await googleSheetsService.createBusinessSubmission({
        customerId: customerId,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        email: customerData.email,
        phone: customerData.phone,
        businessName: formattedBusinessData.companyName,
        companyName: formattedBusinessData.companyName,
        address: formattedBusinessData.address,
        city: formattedBusinessData.city,
        state: formattedBusinessData.state,
        zipCode: formattedBusinessData.zipCode,
        website: formattedBusinessData.website,
        businessDescription: formattedBusinessData.description,
        description: formattedBusinessData.description,
        logoUrl: formattedBusinessData.logo,
        logo: formattedBusinessData.logo,
        facebook: formattedBusinessData.facebook,
        instagram: formattedBusinessData.instagram,
        linkedin: formattedBusinessData.linkedin,
        twitter: formattedBusinessData.twitter,
        packageType: customerData.packageType,
        submissionStatus: 'pending',
        priority: this.getPriorityScore(customerData.packageType),
        directoryLimits: directoryLimits,
        totalDirectories: directoryLimits,
        completedDirectories: 0,
        successfulDirectories: 0,
        failedDirectories: 0,
        progressPercentage: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      console.log(`✅ Customer record created: ${customerId}`);

      // Send welcome notification
      await this.sendWelcomeNotification(customerId, customerData.email, formattedBusinessData.companyName);

      return {
        success: true,
        customerId: customerId,
        recordId: record.recordId,
        directoryLimits: directoryLimits,
        estimatedCompletionTime: this.estimateCompletionTime(directoryLimits)
      };

    } catch (error) {
      console.error('❌ Failed to create customer record:', error);
      throw new Error(`Customer record creation failed: ${error.message}`);
    }
  }

  /**
   * Format business data to match extension expectations
   */
  static formatBusinessDataForExtension(customerData) {
    return {
      companyName: customerData.businessName || customerData.companyName,
      email: customerData.email,
      phone: this.formatPhoneNumber(customerData.phone),
      address: customerData.address,
      city: customerData.city,
      state: customerData.state,
      zipCode: customerData.zipCode || customerData.zip,
      website: this.formatWebsiteUrl(customerData.website),
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      description: customerData.businessDescription || customerData.description || '',
      logo: customerData.logoUrl || customerData.logo || '',
      facebook: customerData.facebook || '',
      instagram: customerData.instagram || '',
      linkedin: customerData.linkedin || '',
      twitter: customerData.twitter || ''
    };
  }

  /**
   * Generate unique customer ID
   */
  static generateCustomerId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `DIR-${year}${month}${day}-${random}`;
  }

  /**
   * Get directory limits based on package type
   */
  static getDirectoryLimits(packageType) {
    const limits = {
      'Starter': 25,
      'Growth': 100,
      'Pro': 150,
      'Enterprise': 200
    };
    return limits[packageType] || 50;
  }

  /**
   * Get priority score for queue processing
   */
  static getPriorityScore(packageType) {
    const priorities = {
      'Enterprise': 4,
      'Pro': 3,
      'Growth': 2,
      'Starter': 1
    };
    return priorities[packageType] || 1;
  }

  /**
   * Format phone number consistently
   */
  static formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone; // Return original if can't format
  }

  /**
   * Format website URL consistently
   */
  static formatWebsiteUrl(website) {
    if (!website) return '';
    
    // Add https:// if no protocol specified
    if (!website.startsWith('http://') && !website.startsWith('https://')) {
      return `https://${website}`;
    }
    
    return website;
  }

  /**
   * Estimate completion time based on directory count
   */
  static estimateCompletionTime(directoryCount) {
    // Estimate 2-3 minutes per directory on average
    const avgTimePerDirectory = 2.5; // minutes
    const totalMinutes = directoryCount * avgTimePerDirectory;
    
    if (totalMinutes < 60) {
      return `${Math.round(totalMinutes)} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? `${minutes} minutes` : ''}`;
    }
  }

  /**
   * Get customer processing status
   */
  static async getCustomerStatus(customerId) {
    try {
      const record = await googleSheetsService.findByCustomerId(customerId);

      if (!record) {
        throw new Error('Customer not found');
      }
      
      return {
        customerId: record.customerID || record.customerId,
        status: record.submissionStatus,
        progress: {
          total: record.totalDirectories || 0,
          completed: record.directoriesSubmitted || 0,
          successful: record.successfulDirectories || 0,
          failed: record.directoriesFailed || 0,
          percentage: record.progressPercentage || 0
        },
        currentDirectory: record.currentDirectory,
        results: record.submissionResults ? JSON.parse(record.submissionResults) : [],
        createdAt: record.purchaseDate,
        lastUpdated: record.lastUpdated,
        completedAt: record.submissionEndDate
      };

    } catch (error) {
      console.error('❌ Failed to get customer status:', error);
      throw new Error(`Status retrieval failed: ${error.message}`);
    }
  }

  /**
   * Send welcome notification to customer
   */
  static async sendWelcomeNotification(customerId, email, businessName) {
    try {
      console.log(`📧 Sending welcome notification to ${email}`);

      const emailData = {
        to: email,
        subject: `DirectoryBolt AutoBolt Processing Started - ${businessName}`,
        template: 'autobolt-welcome',
        data: {
          customerId: customerId,
          businessName: businessName,
          dashboardUrl: `https://directorybolt.com/dashboard?customer=${customerId}`,
          supportEmail: 'support@directorybolt.com'
        }
      };

      // This would integrate with your email service (SendGrid, etc.)
      // await sendEmail(emailData);
      
      console.log(`✅ Welcome notification sent to ${email}`);

    } catch (error) {
      console.error('❌ Failed to send welcome notification:', error);
      // Don't throw - email failures shouldn't break the process
    }
  }

  /**
   * Validate customer data before processing
   */
  static validateCustomerData(customerData) {
    const required = ['firstName', 'lastName', 'email', 'businessName', 'packageType'];
    const missing = required.filter(field => !customerData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate package type
    const validPackages = ['Starter', 'Growth', 'Pro', 'Enterprise'];
    if (!validPackages.includes(customerData.packageType)) {
      throw new Error('Invalid package type');
    }

    return true;
  }

  /**
   * Get system statistics
   */
  static async getSystemStatistics() {
    try {
      const [pending, processing, completed] = await Promise.all([
        googleSheetsService.findByStatus('pending'),
        googleSheetsService.findByStatus('in-progress'),
        googleSheetsService.findByStatus('completed')
      ]);

      const totalSuccessful = completed.reduce((sum, record) => 
        sum + (record.successfulDirectories || 0), 0
      );
      
      const totalDirectories = completed.reduce((sum, record) => 
        sum + (record.totalDirectories || 0), 0
      );

      const successRate = totalDirectories > 0 ? (totalSuccessful / totalDirectories) : 0;

      return {
        customers: {
          pending: pending.length,
          processing: processing.length,
          completed: completed.length,
          total: pending.length + processing.length + completed.length
        },
        performance: {
          successRate: Math.round(successRate * 100) / 100,
          totalDirectoriesProcessed: totalDirectories,
          totalSuccessfulSubmissions: totalSuccessful
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to get system statistics:', error);
      throw new Error(`Statistics retrieval failed: ${error.message}`);
    }
  }
}