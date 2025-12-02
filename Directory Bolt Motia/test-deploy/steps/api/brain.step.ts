import { AnthropicService } from '../ai/anthropicService';
import { GeminiService } from '../ai/geminiService';

export const config = {
  name: 'BrainService',
  type: 'api',
  path: '/plan',
  method: 'POST',
  emits: []
};

export const handler = async (req: any, { logger }: { logger: any }) => {
  logger.info('Brain service - field mapping request received');
  
  // Extract business data and directory info from request
  const { businessData, directory, useAI = true } = req.body;
  
  try {
    let plan;
    
    if (useAI) {
      // Use AI to generate field mapping plan
      plan = await generateAIFieldMapping(businessData, directory);
    } else {
      // Use rule-based approach (fallback)
      plan = generateRuleBasedPlan(businessData, directory);
    }
    
    return {
      status: 200,
      body: plan
    };
  } catch (error: any) {
    logger.error('Error generating field mapping plan:', error);
    return {
      status: 500,
      body: {
        error: `Failed to generate field mapping plan: ${error.message}`
      }
    };
  }
};

async function generateAIFieldMapping(businessData: any, directory: string) {
  // Initialize AI services based on environment variables
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  let aiService;
  
  // Prefer Anthropic if available, otherwise use Gemini
  if (anthropicApiKey) {
    aiService = new AnthropicService(anthropicApiKey);
  } else if (geminiApiKey) {
    aiService = new GeminiService(geminiApiKey);
  } else {
    throw new Error('No AI API key configured');
  }
  
  // Prompt for field mapping
  const prompt = `
    Analyze this business directory website and create a submission plan.
    
    Return a JSON object with this structure:
    {
      "url": "the directory website URL",
      "fields": {
        "field_name": "mapped_value_from_business_data"
      },
      "steps": [
        "step 1 description",
        "step 2 description"
      ],
      "requires_captcha": boolean,
      "submission_method": "form_post|api|email|other"
    }
    
    Focus on mapping these business data fields to the directory form fields:
    - Business Name
    - Address
    - Phone
    - Email
    - Website
    - Description
    - Categories/Keywords
  `;
  
  const aiResponse = await aiService.generateFieldMapping(prompt, businessData, { url: directory });
  
  try {
    // Try to parse the AI response as JSON
    return JSON.parse(aiResponse);
  } catch (parseError: any) {
    // If parsing fails, create a basic plan
    console.log('Failed to parse AI response as JSON, creating basic plan');
    return {
      url: `https://${directory}`,
      fields: {},
      steps: [`Visit ${directory}`, "Fill form with business data"],
      requires_captcha: false,
      submission_method: "form_post"
    };
  }
}

function generateRuleBasedPlan(businessData: any, directory: string) {
  // Fallback rule-based approach when AI is not available
  return {
    url: `https://${directory}`,
    fields: {
      "business_name": businessData.name || businessData.business_name,
      "address": businessData.address,
      "phone": businessData.phone,
      "email": businessData.email,
      "website": businessData.website,
      "description": businessData.description || businessData.business_description,
      "categories": businessData.categories ? businessData.categories.join(", ") : ""
    },
    steps: [
      "Navigate to directory submission page",
      "Fill form fields with business data",
      "Submit form"
    ],
    requires_captcha: false,
    submission_method: "form_post"
  };
}
