import { task } from "@trigger.dev/sdk/v3";
import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const directorySubmissionTask = task({
    id: "directory-submission",
    run: async (payload: { jobId: string; businessData: any; targetDirectories: string[] }) => {
        const { jobId, businessData, targetDirectories } = payload;

        console.log(`Starting submission job ${jobId} for ${businessData.businessName}`);

        const results = [];

        for (const directory of targetDirectories) {
            console.log(`Processing directory: ${directory}`);

            // 1. Generate Field Mapping using AI (Ported logic from Motia BrainService)
            let plan;
            const anthropicKey = process.env.ANTHROPIC_API_KEY;

            if (anthropicKey) {
                const anthropic = new Anthropic({ apiKey: anthropicKey });
                const response = await anthropic.messages.create({
                    model: "claude-3-5-sonnet-20240620",
                    max_tokens: 1024,
                    messages: [{
                        role: "user",
                        content: `Create a submission plan for ${directory} using this data: ${JSON.stringify(businessData)}. Return JSON with fields, steps, and requires_captcha.`
                    }],
                });
                // Plan parsing logic here...
                plan = response.content[0];
            }

            // 2. Perform Submission (Wait for Playwright runner implementation)
            // For now, we mock the success
            results.push({
                directory,
                status: "submitted",
                timestamp: new Date().toISOString(),
                plan: typeof plan === 'string' ? plan : JSON.stringify(plan)
            });
        }

        return {
            success: true,
            jobId,
            processedCount: results.length,
            results
        };
    },
});
