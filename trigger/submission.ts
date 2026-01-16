import { task } from "@trigger.dev/sdk/v3";
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { AutoBoltNotificationService } from "../lib/services/autobolt-notifications";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const directorySubmissionTask = task({
    id: "directory-submission",
    run: async (payload: {
        jobId: string;
        businessData: any;
        targetDirectories: string[];
        batchIndex?: number;
        totalBatches?: number;
    }) => {
        const { jobId, businessData, targetDirectories } = payload;
        console.log(`Starting submission job ${jobId} (Batch ${payload.batchIndex}/${payload.totalBatches}) for ${businessData.business_name}`);

        const results = [];

        // Launch Browser
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });

            for (const directoryName of targetDirectories) {
                console.log(`Processing directory: ${directoryName}`);
                let status = 'failed';
                let screenshotUrl = null;
                let errorMessage = null;

                try {
                    // MVP: simulate visiting the directory
                    const targetUrl = `https://www.google.com/search?q=submit+site+to+${encodeURIComponent(directoryName)}`;
                    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

                    // Simulate "filling form" time
                    await new Promise(r => setTimeout(r, 2000));

                    // Take Screenshot
                    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });

                    // Upload to Supabase Storage
                    const fileName = `${jobId}/${Date.now()}_${directoryName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
                    const { data: uploadData, error: uploadError } = await supabase
                        .storage
                        .from('submission-proofs')
                        .upload(fileName, screenshotBuffer, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    // Get Public URL
                    const { data: { publicUrl } } = supabase
                        .storage
                        .from('submission-proofs')
                        .getPublicUrl(fileName);

                    screenshotUrl = publicUrl;
                    status = 'success';

                } catch (err: any) {
                    console.error(`Failed to process ${directoryName}:`, err);
                    errorMessage = err.message;
                    status = 'failed';
                }

                // Log result to DB for Dashboard
                await supabase.from('autobolt_submission_logs').insert({
                    job_id: jobId,
                    customer_id: businessData.customer_id,
                    directory_name: directoryName,
                    status: status === 'success' ? 'submitted' : 'failed',
                    success: status === 'success',
                    screenshot_url: screenshotUrl,
                    error_message: errorMessage,
                    timestamp: new Date().toISOString()
                });

                results.push({
                    directory: directoryName,
                    status,
                    screenshotUrl,
                    error: errorMessage
                });
            }

            // Check if entire job is complete (across all batches)
            const { count: currentLogsCount } = await supabase
                .from('autobolt_submission_logs')
                .select('*', { count: 'exact', head: true })
                .eq('job_id', jobId);

            const { data: jobData } = await supabase
                .from('jobs')
                .select('directory_limit, email, business_name, customer_id')
                .eq('id', jobId)
                .single();

            if (jobData && currentLogsCount && currentLogsCount >= jobData.directory_limit) {
                console.log(`Job ${jobId} is now 100% complete! Sending report...`);

                // Update master job status
                await supabase.from('jobs').update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                }).eq('id', jobId);

                // Fetch all results for the report
                const { data: allLogs } = await supabase
                    .from('autobolt_submission_logs')
                    .select('directory_name, success, screenshot_url')
                    .eq('job_id', jobId);

                // Send Completion Report
                if (jobData.email) {
                    await AutoBoltNotificationService.sendCompletionReport(
                        jobData.customer_id,
                        (allLogs || []).map(l => ({
                            directoryName: l.directory_name,
                            status: l.success ? 'success' : 'failed'
                        })),
                        jobData.email,
                        jobData.business_name
                    ).catch(err => console.error('Failed to send completion email:', err));
                }
            }

        } finally {
            await browser.close();
        }

        return {
            success: true,
            jobId,
            processedCount: results.length,
            results
        };
    },
});
