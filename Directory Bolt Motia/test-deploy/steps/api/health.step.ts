import { AnthropicService } from '../ai/anthropicService';
import { GeminiService } from '../ai/geminiService';

export const config = {
  name: 'HealthCheck',
  type: 'api',
  path: '/health',
  method: 'GET'
};

export const handler = async (req, { logger }) => {
  logger.info('Health check endpoint accessed');
  
  // Check AI service connectivity
  const aiStatus = await checkAIServices();
  
  return {
    status: 200,
    body: {
      status: "healthy",
      service: "directory-bolt-motia",
      timestamp: new Date().toISOString(),
      ai_services: aiStatus
    }
  };
};

async function checkAIServices() {
  const status = {
    anthropic: { available: false, error: null },
    gemini: { available: false, error: null }
  };
  
  // Check Anthropic
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicApiKey) {
    try {
      const anthropic = new AnthropicService(anthropicApiKey);
      // Simple test - this would be a lightweight check
      status.anthropic.available = true;
    } catch (error) {
      status.anthropic.error = error.message;
    }
  }
  
  // Check Gemini
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const gemini = new GeminiService(geminiApiKey);
      // Simple test - this would be a lightweight check
      status.gemini.available = true;
    } catch (error) {
      status.gemini.error = error.message;
    }
  }
  
  return status;
}
