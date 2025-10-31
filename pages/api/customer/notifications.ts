import { NextApiRequest, NextApiResponse } from 'next';

interface NotificationRequest {
  customerId: string;
  milestone: number; // 25, 50, 75, 100
  type: 'progress' | 'completion' | 'issue';
  message?: string;
}

interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerId, milestone, type, message }: NotificationRequest = req.body;

    if (!customerId || !milestone || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get customer data
    const customerData = await getCustomerData(customerId);
    if (!customerData) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Generate email template based on milestone and type
    const emailTemplate = generateEmailTemplate(customerData, milestone, type, message);

    // Send email notification
    const emailSent = await sendEmailNotification(customerData.email, emailTemplate);

    if (emailSent) {
      // Log notification in database
      await logNotification(customerId, milestone, type, 'sent');
      
      res.status(200).json({ 
        success: true, 
        message: 'Notification sent successfully' 
      });
    } else {
      throw new Error('Failed to send email notification');
    }

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getCustomerData(customerId: string) {
  // This would fetch from your database
  // For demo purposes, return mock data
  return {
    id: customerId,
    businessName: 'Demo Business LLC',
    email: 'demo@example.com',
    packageType: 'Growth',
    directoryLimit: 100
  };
}

function generateEmailTemplate(customerData: any, milestone: number, type: string, message?: string): EmailTemplate {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://directorybolt.com';
  const portalUrl = `${baseUrl}/customer-portal?customerId=${customerData.id}`;

  switch (type) {
    case 'progress':
      return {
        subject: `🎉 ${milestone}% Complete - ${customerData.businessName} Directory Submissions`,
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset=\"utf-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>Progress Update - DirectoryBolt</title>
          </head>
          <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">
            <div style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;\">
              <h1 style=\"color: white; margin: 0; font-size: 28px;\">DirectoryBolt</h1>
              <p style=\"color: #f0f0f0; margin: 10px 0 0 0;\">Directory Submission Progress Update</p>
            </div>
            
            <div style=\"background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;\">
              <h2 style=\"color: #333; margin-top: 0;\">Great News, ${customerData.businessName}!</h2>
              
              <div style=\"background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;\">
                <h3 style=\"color: #28a745; margin: 0 0 10px 0; font-size: 24px;\">🎉 ${milestone}% Complete!</h3>
                <p style=\"margin: 0; color: #666;\">Your directory submissions are progressing smoothly</p>
              </div>
              
              <p>We're excited to update you on the progress of your ${customerData.packageType} package directory submissions.</p>
              
              <div style=\"background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;\">
                <h4 style=\"margin: 0 0 10px 0; color: #1976d2;\">📊 Current Status:</h4>
                <ul style=\"margin: 0; padding-left: 20px;\">
                  <li>Progress: ${milestone}% complete</li>
                  <li>Package: ${customerData.packageType} (${customerData.directoryLimit} directories)</li>
                  <li>Estimated completion: Within 5-7 business days</li>
                </ul>
              </div>
              
              <p>You can track your real-time progress and view detailed submission status in your customer portal:</p>
              
              <div style=\"text-align: center; margin: 30px 0;\">
                <a href=\"${portalUrl}\" style=\"background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;\">View Progress Dashboard</a>
              </div>
              
              <p>If you have any questions or concerns, please don't hesitate to reach out to our support team.</p>
              
              <p>Best regards,<br>The DirectoryBolt Team</p>
            </div>
            
            <div style=\"background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;\">
              <p style=\"margin: 0; color: #666; font-size: 14px;\">
                Need help? Contact us at <a href=\"mailto:support@directorybolt.com\" style=\"color: #007bff;\">support@directorybolt.com</a>
              </p>
            </div>
          </body>
          </html>
        `,
        textContent: `
DirectoryBolt - Progress Update

Great News, ${customerData.businessName}!

🎉 ${milestone}% Complete!

Your directory submissions are progressing smoothly. We're excited to update you on the progress of your ${customerData.packageType} package directory submissions.

Current Status:
- Progress: ${milestone}% complete
- Package: ${customerData.packageType} (${customerData.directoryLimit} directories)
- Estimated completion: Within 5-7 business days

You can track your real-time progress and view detailed submission status in your customer portal: ${portalUrl}

If you have any questions or concerns, please don't hesitate to reach out to our support team.

Best regards,
The DirectoryBolt Team

Need help? Contact us at support@directorybolt.com
        `
      };

    case 'completion':
      return {
        subject: `🎊 Complete! ${customerData.businessName} Directory Submissions Finished`,
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset=\"utf-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>Submissions Complete - DirectoryBolt</title>
          </head>
          <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">
            <div style=\"background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;\">
              <h1 style=\"color: white; margin: 0; font-size: 28px;\">DirectoryBolt</h1>
              <p style=\"color: #f0f0f0; margin: 10px 0 0 0;\">Mission Accomplished!</p>
            </div>
            
            <div style=\"background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;\">
              <h2 style=\"color: #333; margin-top: 0;\">🎊 Congratulations, ${customerData.businessName}!</h2>
              
              <div style=\"background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #c3e6cb;\">
                <h3 style=\"color: #155724; margin: 0 0 10px 0; font-size: 24px;\">✅ 100% Complete!</h3>
                <p style=\"margin: 0; color: #155724;\">All directory submissions have been completed successfully</p>
              </div>
              
              <p>We're thrilled to announce that your ${customerData.packageType} package directory submissions have been completed!</p>
              
              <div style=\"background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;\">
                <h4 style=\"margin: 0 0 10px 0; color: #856404;\">📈 What's Next:</h4>
                <ul style=\"margin: 0; padding-left: 20px; color: #856404;\">
                  <li>Directory approvals typically take 1-4 weeks</li>
                  <li>You'll start seeing improved online visibility</li>
                  <li>Monitor your business listings for accuracy</li>
                  <li>Track your local SEO improvements</li>
                </ul>
              </div>
              
              <p>You can view your complete submission report and track approval status in your customer portal:</p>
              
              <div style=\"text-align: center; margin: 30px 0;\">
                <a href=\"${portalUrl}\" style=\"background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;\">View Complete Report</a>
              </div>
              
              <p>Thank you for choosing DirectoryBolt. We're confident these submissions will significantly boost your online presence and help drive more customers to your business.</p>
              
              <p>Best regards,<br>The DirectoryBolt Team</p>
            </div>
            
            <div style=\"background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;\">
              <p style=\"margin: 0; color: #666; font-size: 14px;\">
                Questions? We're here to help at <a href=\"mailto:support@directorybolt.com\" style=\"color: #007bff;\">support@directorybolt.com</a>
              </p>
            </div>
          </body>
          </html>
        `,
        textContent: `
DirectoryBolt - Submissions Complete!

🎊 Congratulations, ${customerData.businessName}!

✅ 100% Complete!
All directory submissions have been completed successfully

We're thrilled to announce that your ${customerData.packageType} package directory submissions have been completed!

What's Next:
- Directory approvals typically take 1-4 weeks
- You'll start seeing improved online visibility
- Monitor your business listings for accuracy
- Track your local SEO improvements

You can view your complete submission report and track approval status in your customer portal: ${portalUrl}

Thank you for choosing DirectoryBolt. We're confident these submissions will significantly boost your online presence and help drive more customers to your business.

Best regards,
The DirectoryBolt Team

Questions? We're here to help at support@directorybolt.com
        `
      };

    case 'issue':
      return {
        subject: `⚠️ Action Required - ${customerData.businessName} Directory Submissions`,
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset=\"utf-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>Action Required - DirectoryBolt</title>
          </head>
          <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">
            <div style=\"background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;\">
              <h1 style=\"color: white; margin: 0; font-size: 28px;\">DirectoryBolt</h1>
              <p style=\"color: #f0f0f0; margin: 10px 0 0 0;\">Action Required</p>
            </div>
            
            <div style=\"background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;\">
              <h2 style=\"color: #333; margin-top: 0;\">⚠️ Attention Required, ${customerData.businessName}</h2>
              
              <div style=\"background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;\">
                <h3 style=\"color: #856404; margin: 0 0 10px 0;\">Manual Review Needed</h3>
                <p style=\"margin: 0; color: #856404;\">Some directory submissions require additional information</p>
              </div>
              
              <p>We've encountered some directories that require manual verification or additional information for your ${customerData.packageType} package submissions.</p>
              
              ${message ? `<div style=\"background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;\">
                <h4 style=\"margin: 0 0 10px 0; color: #495057;\">📝 Details:</h4>
                <p style=\"margin: 0; color: #495057;\">${message}</p>
              </div>` : ''}
              
              <p><strong>What we're doing:</strong></p>
              <ul>
                <li>Our team is manually reviewing the affected submissions</li>
                <li>We'll handle any required verifications on your behalf</li>
                <li>No additional cost to you for manual processing</li>
                <li>We'll update you once resolved</li>
              </ul>
              
              <p>You can monitor the status of all submissions in your customer portal:</p>
              
              <div style=\"text-align: center; margin: 30px 0;\">
                <a href=\"${portalUrl}\" style=\"background: #ffc107; color: #212529; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;\">Check Status</a>
              </div>
              
              <p>If you have any questions or additional information that might help, please contact our support team.</p>
              
              <p>Best regards,<br>The DirectoryBolt Team</p>
            </div>
            
            <div style=\"background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;\">
              <p style=\"margin: 0; color: #666; font-size: 14px;\">
                Need immediate assistance? Contact us at <a href=\"mailto:support@directorybolt.com\" style=\"color: #007bff;\">support@directorybolt.com</a>
              </p>
            </div>
          </body>
          </html>
        `,
        textContent: `
DirectoryBolt - Action Required

⚠️ Attention Required, ${customerData.businessName}

Manual Review Needed
Some directory submissions require additional information

We've encountered some directories that require manual verification or additional information for your ${customerData.packageType} package submissions.

${message ? `Details: ${message}` : ''}

What we're doing:
- Our team is manually reviewing the affected submissions
- We'll handle any required verifications on your behalf
- No additional cost to you for manual processing
- We'll update you once resolved

You can monitor the status of all submissions in your customer portal: ${portalUrl}

If you have any questions or additional information that might help, please contact our support team.

Best regards,
The DirectoryBolt Team

Need immediate assistance? Contact us at support@directorybolt.com
        `
      };

    default:
      throw new Error('Invalid notification type');
  }
}

async function sendEmailNotification(email: string, template: EmailTemplate): Promise<boolean> {
  try {
    // This would integrate with your email service (SendGrid, Mailchimp, etc.)
    // For demo purposes, we'll simulate sending
    
    console.log('Sending email notification:', {
      to: email,
      subject: template.subject,
      // In real implementation, you'd send the actual email here
    });

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;

  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function logNotification(customerId: string, milestone: number, type: string, status: string) {
  try {
    // This would log the notification in your database
    console.log('Logging notification:', {
      customerId,
      milestone,
      type,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

// Real implementation with SendGrid would look like this:
/*
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

async function sendEmailNotification(email: string, template: EmailTemplate): Promise<boolean> {
  try {
    const msg = {
      to: email,
      from: 'notifications@directorybolt.com',
      subject: template.subject,
      text: template.textContent,
      html: template.htmlContent,
    };

    await sgMail.send(msg);
    return true;

  } catch (error) {
    console.error('SendGrid error:', error);
    return false;
  }
}
*/