import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateStaffRequest } from "../../../lib/auth/guards";
import { TEST_MODE_ENABLED } from "../../../lib/auth/constants";
import { getSupabaseAdminClient } from "../../../lib/server/supabaseAdmin";
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

interface PushToAutoBoltRequest {
  customerId: string;
  priority?: number;
}

interface PushToAutoBoltResponse {
  success: boolean;
  job?: any;
  jobId?: string;
  queueId?: string;
  error?: string;
  message?: string;
  notes?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PushToAutoBoltResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const auth = authenticateStaffRequest(req);

    if (!auth.ok) {
      const status = auth.reason === 'CONFIG' ? 500 : 401;
      return res.status(status).json({
        success: false,
        error: auth.reason === 'CONFIG' ? 'Configuration error' : 'Unauthorized',
        message: auth.message ?? 'Valid staff or admin authentication required',
      });
    }

    const { customerId, priority } = req.body as PushToAutoBoltRequest;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Customer ID is required",
      });
    }

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError || !customerData) {
        return res.status(404).json({
          success: false,
          error: "Customer not found",
          message: `No customer found with ID: ${customerId}`,
        });
      }

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .insert({
          customer_id: customerId,
          status: "pending",
          priority_level: priority || 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) {
        console.error("[autobolt.push] supabase insert failed", jobError);
        return res.status(500).json({
          success: false,
          error: "Database error",
          message: jobError.message,
        });
      }

      await supabase
        .from("customers")
        .update({
          status: "queued",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", customerId);

      // Send job to SQS queue for processing
      let sqsMessageId: string | null = null;
      try {
        const awsRegion = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_DEFAULT_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_DEFAULT_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
        const sqsQueueUrl = process.env.SQS_QUEUE_URL;

        // Validate AWS configuration
        if (!awsAccessKeyId) {
          console.error(`❌ AWS_DEFAULT_ACCESS_KEY_ID not configured for job ${jobData.id}`);
        }
        if (!awsSecretAccessKey) {
          console.error(`❌ AWS_DEFAULT_SECRET_ACCESS_KEY not configured for job ${jobData.id}`);
        }
        if (!sqsQueueUrl) {
          console.error(`❌ SQS_QUEUE_URL not configured for job ${jobData.id}`);
        }

        if (awsAccessKeyId && awsSecretAccessKey && sqsQueueUrl) {
          const sqsClient = new SQSClient({
            region: awsRegion,
            credentials: {
              accessKeyId: awsAccessKeyId,
              secretAccessKey: awsSecretAccessKey
            }
          });

          const messageBody = {
            job_id: jobData.id,
            customer_id: customerId,
            package_size: customerData.package_size || jobData.package_size || 100,
            priority: priority || 3,
            created_at: new Date().toISOString(),
            source: 'autobolt_push_api'
          };

          const command = new SendMessageCommand({
            QueueUrl: sqsQueueUrl,
            MessageBody: JSON.stringify(messageBody),
            MessageAttributes: {
              job_id: {
                DataType: 'String',
                StringValue: jobData.id
              },
              customer_id: {
                DataType: 'String',
                StringValue: customerId
              },
              priority: {
                DataType: 'Number',
                StringValue: (priority || 3).toString()
              }
            }
          });

          const sqsResult = await sqsClient.send(command);
          sqsMessageId = sqsResult.MessageId || null;
          console.log(`✅ Job ${jobData.id} sent to SQS queue. MessageId: ${sqsMessageId}`);
        } else {
          console.warn(`⚠️ Job ${jobData.id} created in database but NOT queued for processing`);
          console.warn(`   Missing AWS configuration - job will remain pending`);
        }
      } catch (sqsError) {
        console.error(`❌ Failed to send job ${jobData.id} to SQS:`, sqsError);
        console.error(`   Job is in database but won't be processed until message is sent`);
        // Don't fail the request - job is already in database
        // The system should retry sending the message
      }

      return res.status(201).json({
        success: true,
        job: jobData,
        jobId: jobData.id,
        queueId: jobData.id,
      });
    }

    if (!TEST_MODE_ENABLED) {
      return res.status(500).json({
        success: false,
        error: "Configuration error",
        message: "Supabase integration is not configured. Enable TEST_MODE for local queue testing.",
      });
    }

    return res.status(201).json({
      success: true,
      queueId: "test123",
      job: {
        id: "test123",
        customer_id: customerId,
        status: "pending",
        priority_level: priority || 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      jobId: "test123",
      notes: [
        "TEST_MODE enabled – returning in-memory AutoBolt queue response.",
        "Configure Supabase and AutoBolt orchestrator integration for production queues.",
      ],
    });
  } catch (error) {
    console.error("[autobolt.push] unexpected error", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
