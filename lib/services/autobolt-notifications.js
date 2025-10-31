/**
 * AutoBolt Notification Service
 * Handles email notifications for customer progress and completion
 */

import nodemailer from 'nodemailer';

export class AutoBoltNotificationService {
  static transporter = null;

  /**
   * Initialize email transporter
   */
  static initializeTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
    return this.transporter;
  }

  /**
   * Send progress update notification
   */
  static async sendProgressUpdate(customerId, progress, customerEmail, businessName) {
    try {
      console.log(`📧 Sending progress update to ${customerEmail}`);

      const transporter = this.initializeTransporter();
      
      const progressPercentage = Math.round((progress.completed / progress.totalDirectories) * 100);
      const successRate = progress.completed > 0 
        ? Math.round((progress.successful / progress.completed) * 100) 
        : 0;

      const emailHtml = this.generateProgressEmailTemplate({
        businessName,
        customerId,
        progress: {
          ...progress,
          percentage: progressPercentage,
          successRate: successRate
        },
        dashboardUrl: `https://directorybolt.com/dashboard?customer=${customerId}`
      });

      const mailOptions = {
        from: `"DirectoryBolt AutoBolt" <${process.env.SMTP_FROM_EMAIL}>`,
        to: customerEmail,
        subject: `Directory Submission Progress Update - ${businessName} (${progressPercentage}% Complete)`,
        html: emailHtml
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Progress update sent to ${customerEmail}`);

    } catch (error) {
      console.error('❌ Failed to send progress update:', error);
      throw new Error(`Progress notification failed: ${error.message}`);
    }
  }

  /**
   * Send completion report notification
   */
  static async sendCompletionReport(customerId, results, customerEmail, businessName) {
    try {
      console.log(`📧 Sending completion report to ${customerEmail}`);

      const transporter = this.initializeTransporter();
      
      const successfulSubmissions = results.filter(r => r.status === 'success');
      const failedSubmissions = results.filter(r => r.status === 'failed');
      const successRate = Math.round((successfulSubmissions.length / results.length) * 100);

      const emailHtml = this.generateCompletionEmailTemplate({
        businessName,
        customerId,
        totalSubmissions: results.length,
        successfulCount: successfulSubmissions.length,
        failedCount: failedSubmissions.length,
        successRate: successRate,
        successfulListings: successfulSubmissions,
        failedListings: failedSubmissions,
        reportUrl: `https://directorybolt.com/reports/${customerId}`,
        dashboardUrl: `https://directorybolt.com/dashboard?customer=${customerId}`
      });

      const mailOptions = {
        from: `"DirectoryBolt AutoBolt" <${process.env.SMTP_FROM_EMAIL}>`,
        to: customerEmail,
        subject: `Directory Submission Complete - ${businessName} (${successfulSubmissions.length} Successful Listings)`,
        html: emailHtml
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Completion report sent to ${customerEmail}`);

    } catch (error) {
      console.error('❌ Failed to send completion report:', error);
      throw new Error(`Completion notification failed: ${error.message}`);
    }
  }

  /**
   * Send error notification
   */
  static async sendErrorNotification(customerId, error, customerEmail, businessName) {
    try {
      console.log(`📧 Sending error notification to ${customerEmail}`);

      const transporter = this.initializeTransporter();

      const emailHtml = this.generateErrorEmailTemplate({
        businessName,
        customerId,
        error: error,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@directorybolt.com',
        dashboardUrl: `https://directorybolt.com/dashboard?customer=${customerId}`
      });

      const mailOptions = {
        from: `"DirectoryBolt AutoBolt" <${process.env.SMTP_FROM_EMAIL}>`,
        to: customerEmail,
        subject: `Directory Submission Issue - ${businessName} (Action Required)`,
        html: emailHtml
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Error notification sent to ${customerEmail}`);

    } catch (error) {
      console.error('❌ Failed to send error notification:', error);
      throw new Error(`Error notification failed: ${error.message}`);
    }
  }

  /**
   * Send welcome notification
   */
  static async sendWelcomeNotification(customerId, customerEmail, businessName, packageType) {
    try {
      console.log(`📧 Sending welcome notification to ${customerEmail}`);

      const transporter = this.initializeTransporter();

      const directoryLimits = this.getDirectoryLimits(packageType);
      const estimatedTime = this.estimateCompletionTime(directoryLimits);

      const emailHtml = this.generateWelcomeEmailTemplate({
        businessName,
        customerId,
        packageType,
        directoryLimits,
        estimatedTime,
        dashboardUrl: `https://directorybolt.com/dashboard?customer=${customerId}`,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@directorybolt.com'
      });

      const mailOptions = {
        from: `"DirectoryBolt AutoBolt" <${process.env.SMTP_FROM_EMAIL}>`,
        to: customerEmail,
        subject: `DirectoryBolt AutoBolt Processing Started - ${businessName}`,
        html: emailHtml
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome notification sent to ${customerEmail}`);

    } catch (error) {
      console.error('❌ Failed to send welcome notification:', error);
      throw new Error(`Welcome notification failed: ${error.message}`);
    }
  }

  /**
   * Generate progress email template
   */
  static generateProgressEmailTemplate(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Directory Submission Progress Update</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4285f4; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .progress-bar { background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
            .progress-fill { background: #4285f4; height: 100%; transition: width 0.3s ease; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat { text-align: center; padding: 10px; background: white; border-radius: 5px; }
            .stat-number { font-size: 24px; font-weight: bold; color: #4285f4; }
            .button { display: inline-block; padding: 12px 24px; background: #4285f4; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Directory Submission Progress Update</h1>
                <p>DirectoryBolt AutoBolt Service</p>
            </div>
            
            <div class="content">
                <h2>Hello ${data.businessName}!</h2>
                
                <p>We're making great progress on your directory submissions. Here's your current status:</p>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${data.progress.percentage}%"></div>
                </div>
                <p style="text-align: center; font-weight: bold;">${data.progress.percentage}% Complete</p>
                
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number">${data.progress.totalDirectories}</div>
                        <div>Total Directories</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${data.progress.completed}</div>
                        <div>Processed</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${data.progress.successful}</div>
                        <div>Successful</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${data.progress.successRate}%</div>
                        <div>Success Rate</div>
                    </div>
                </div>
                
                ${data.progress.currentDirectory ? `<p><strong>Currently processing:</strong> ${data.progress.currentDirectory}</p>` : ''}
                
                <p>You can view detailed progress and results in your dashboard:</p>
                <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
                
                <p>We'll send you another update when processing is complete.</p>
            </div>
            
            <div class="footer">
                <p>Customer ID: ${data.customerId}</p>
                <p>DirectoryBolt AutoBolt Service | support@directorybolt.com</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate completion email template
   */
  static generateCompletionEmailTemplate(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Directory Submission Complete</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4caf50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .summary { display: flex; justify-content: space-around; margin: 20px 0; }
            .summary-item { text-align: center; padding: 15px; background: white; border-radius: 5px; }
            .summary-number { font-size: 28px; font-weight: bold; color: #4caf50; }
            .directory-list { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .directory-item { padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
            .status-success { color: #4caf50; font-weight: bold; }
            .status-failed { color: #f44336; font-weight: bold; }
            .button { display: inline-block; padding: 12px 24px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button-secondary { background: #2196f3; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Directory Submission Complete!</h1>
                <p>DirectoryBolt AutoBolt Service</p>
            </div>
            
            <div class="content">
                <h2>Congratulations ${data.businessName}!</h2>
                
                <p>Your directory submission campaign has been completed successfully. Here are your results:</p>
                
                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-number">${data.totalSubmissions}</div>
                        <div>Total Directories</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-number">${data.successfulCount}</div>
                        <div>Successful</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-number">${data.successRate}%</div>
                        <div>Success Rate</div>
                    </div>
                </div>
                
                <h3>Successful Submissions</h3>
                <div class="directory-list">
                    ${data.successfulListings.map(listing => `
                        <div class="directory-item">
                            <span>${listing.directoryName}</span>
                            <span class="status-success">✓ Success</span>
                        </div>
                    `).join('')}
                </div>
                
                ${data.failedCount > 0 ? `
                <h3>Failed Submissions</h3>
                <div class="directory-list">
                    ${data.failedListings.map(listing => `
                        <div class="directory-item">
                            <span>${listing.directoryName}</span>
                            <span class="status-failed">✗ Failed</span>
                        </div>
                    `).join('')}
                </div>
                <p><em>Failed submissions may require manual verification or additional information. Our support team will follow up if needed.</em></p>
                ` : ''}
                
                <p>Access your complete results and submission details:</p>
                <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
                <a href="${data.reportUrl}" class="button button-secondary">Download Report</a>
                
                <h3>What's Next?</h3>
                <ul>
                    <li>Monitor your new directory listings for increased visibility</li>
                    <li>Keep your business information updated across all platforms</li>
                    <li>Respond to customer reviews and inquiries promptly</li>
                    <li>Consider additional marketing strategies to maximize your online presence</li>
                </ul>
                
                <p>Thank you for choosing DirectoryBolt AutoBolt for your business directory needs!</p>
            </div>
            
            <div class="footer">
                <p>Customer ID: ${data.customerId}</p>
                <p>DirectoryBolt AutoBolt Service | support@directorybolt.com</p>
                <p>Need help? Contact our support team for assistance.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate error email template
   */
  static generateErrorEmailTemplate(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Directory Submission Issue</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .error-box { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Directory Submission Issue</h1>
                <p>DirectoryBolt AutoBolt Service</p>
            </div>
            
            <div class="content">
                <h2>Hello ${data.businessName},</h2>
                
                <p>We encountered an issue while processing your directory submissions. Our team has been notified and is working to resolve this.</p>
                
                <div class="error-box">
                    <strong>Error Details:</strong><br>
                    ${data.error}
                </div>
                
                <h3>What We're Doing:</h3>
                <ul>
                    <li>Our technical team has been automatically notified</li>
                    <li>We're investigating the issue and will resolve it promptly</li>
                    <li>Your submission will be retried once the issue is fixed</li>
                </ul>
                
                <h3>What You Can Do:</h3>
                <ul>
                    <li>Check your dashboard for any updates</li>
                    <li>Contact our support team if you have questions</li>
                    <li>We'll email you once processing resumes</li>
                </ul>
                
                <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
                
                <p>We apologize for any inconvenience and appreciate your patience.</p>
                
                <p><strong>Need immediate assistance?</strong><br>
                Contact our support team at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
            </div>
            
            <div class="footer">
                <p>Customer ID: ${data.customerId}</p>
                <p>DirectoryBolt AutoBolt Service | ${data.supportEmail}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate welcome email template
   */
  static generateWelcomeEmailTemplate(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DirectoryBolt AutoBolt Processing Started</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4285f4; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .package-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #4285f4; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 AutoBolt Processing Started!</h1>
                <p>DirectoryBolt AutoBolt Service</p>
            </div>
            
            <div class="content">
                <h2>Welcome ${data.businessName}!</h2>
                
                <p>Thank you for choosing DirectoryBolt AutoBolt. We've received your business information and have started processing your directory submissions.</p>
                
                <div class="package-info">
                    <h3>Your Package Details:</h3>
                    <ul>
                        <li><strong>Package:</strong> ${data.packageType}</li>
                        <li><strong>Directories:</strong> Up to ${data.directoryLimits} submissions</li>
                        <li><strong>Estimated Time:</strong> ${data.estimatedTime}</li>
                        <li><strong>Customer ID:</strong> ${data.customerId}</li>
                    </ul>
                </div>
                
                <h3>What Happens Next:</h3>
                <ol>
                    <li>Our AutoBolt system will automatically submit your business to relevant directories</li>
                    <li>You'll receive progress updates as submissions are completed</li>
                    <li>We'll send you a detailed report when all submissions are finished</li>
                    <li>You can track progress in real-time through your dashboard</li>
                </ol>
                
                <a href="${data.dashboardUrl}" class="button">View Progress Dashboard</a>
                
                <h3>Important Notes:</h3>
                <ul>
                    <li>Some directories may require manual verification after submission</li>
                    <li>Processing typically completes within ${data.estimatedTime}</li>
                    <li>You'll receive email updates at key milestones</li>
                    <li>Our support team is available if you have any questions</li>
                </ul>
                
                <p>Thank you for trusting DirectoryBolt with your business directory needs!</p>
                
                <p><strong>Questions?</strong> Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
            </div>
            
            <div class="footer">
                <p>Customer ID: ${data.customerId}</p>
                <p>DirectoryBolt AutoBolt Service | ${data.supportEmail}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Helper methods
  static getDirectoryLimits(packageType) {
    const limits = {
      'Starter': 25,
      'Growth': 100,
      'Pro': 150,
      'Enterprise': 200
    };
    return limits[packageType] || 50;
  }

  static estimateCompletionTime(directoryCount) {
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
}