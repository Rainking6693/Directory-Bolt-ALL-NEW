/**
 * Send Job to SQS Queue API
 * 
 * This endpoint sends jobs to AWS SQS where the Python backend subscriber
 * picks them up and processes them with Prefect + Playwright.
 * 
 * This replaces the mock processing functions that were doing nothing.
 */

import { NextApiRequest, NextApiResponse } from 'next'
// Use AWS SDK v3 for better tree-shaking and smaller bundle
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

interface SendToSQSRequest {
  job_id: string
  customer_id: string
  package_size: number
  priority?: number
}

interface SendToSQSResponse {
  success: boolean
  messageId?: string
  error?: string
  message?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendToSQSResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const { job_id, customer_id, package_size, priority } = req.body as SendToSQSRequest

    // Validate required fields
    if (!job_id || !customer_id || !package_size) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: job_id, customer_id, package_size'
      })
    }

    // Get AWS credentials from environment
    const awsRegion = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1'
    const awsAccessKeyId = process.env.AWS_DEFAULT_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
    const awsSecretAccessKey = process.env.AWS_DEFAULT_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
    const sqsQueueUrl = process.env.SQS_QUEUE_URL

    if (!awsAccessKeyId || !awsSecretAccessKey || !sqsQueueUrl) {
      console.error('[send-to-sqs] Missing AWS configuration:', {
        hasAccessKey: !!awsAccessKeyId,
        hasSecretKey: !!awsSecretAccessKey,
        hasQueueUrl: !!sqsQueueUrl
      })
      return res.status(503).json({
        success: false,
        error: 'AWS SQS not configured',
        message: 'Backend processing service is not available. Jobs will be queued for later processing.'
      })
    }

    // Initialize SQS client (AWS SDK v3)
    const sqsClient = new SQSClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    })

    // Determine priority level from package size
    const priorityLevel = priority || getPriorityFromPackageSize(package_size)

    // Create SQS message
    const messageBody = {
      job_id,
      customer_id,
      package_size,
      priority: priorityLevel,
      created_at: new Date().toISOString(),
      source: 'netlify_frontend'
    }

    // Send message to SQS
    const command = new SendMessageCommand({
      QueueUrl: sqsQueueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageAttributes: {
        job_id: {
          DataType: 'String',
          StringValue: job_id
        },
        customer_id: {
          DataType: 'String',
          StringValue: customer_id
        },
        priority: {
          DataType: 'Number',
          StringValue: priorityLevel.toString()
        }
      }
    })

    const result = await sqsClient.send(command)

    console.log(`✅ Job ${job_id} sent to SQS queue. MessageId: ${result.MessageId}`)

    return res.status(200).json({
      success: true,
      messageId: result.MessageId,
      message: 'Job sent to processing queue'
    })

  } catch (error) {
    console.error('[send-to-sqs] Error sending job to SQS:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // If AWS credentials are wrong, return specific error
    if (errorMessage.includes('credentials') || errorMessage.includes('AccessDenied')) {
      return res.status(503).json({
        success: false,
        error: 'AWS credentials invalid',
        message: 'Backend processing service configuration error. Please contact support.'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to send job to queue',
      message: errorMessage
    })
  }
}

/**
 * Get priority level from package size
 */
function getPriorityFromPackageSize(packageSize: number): number {
  if (packageSize >= 500) return 1 // Enterprise
  if (packageSize >= 400) return 2 // Professional
  if (packageSize >= 250) return 3 // Growth
  return 4 // Starter
}

