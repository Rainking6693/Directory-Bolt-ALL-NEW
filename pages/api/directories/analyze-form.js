/**
 * 🤖 FORM ANALYSIS API - AI-Powered Form Mapping Endpoint
 * 
 * POST /api/directories/analyze-form
 * 
 * Analyzes directory submission forms using AI to automatically map form fields
 * to business data fields. Integrates with the AIFormMapper system.
 * 
 * Request Body:
 * {
 *   "url": "https://directory.com/submit",
 *   "html": "<form>...</form>", // Optional: provide HTML directly
 *   "options": {
 *     "confidenceThreshold": 0.8,
 *     "useAI": true,
 *     "usePatterns": true
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "mapping": {
 *     "businessName": {
 *       "selector": "#company-name",
 *       "confidence": 0.95,
 *       "method": "pattern_matching"
 *     }
 *   },
 *   "confidence": 0.87,
 *   "processingTime": 1250,
 *   "stats": {...}
 * }
 */

import { AIFormMapper } from '../../../lib/form-mapping/AIFormMapper';
import { handleApiError, Errors } from '../../../lib/utils/errors';

// Initialize the form mapper
let formMapper = null;

function getFormMapper() {
  if (!formMapper) {
    formMapper = new AIFormMapper({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      confidenceThreshold: 0.7
    });
  }
  return formMapper;
}

export default async function handler(req, res) {
  const requestId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json(handleApiError(
      new Error('Method not allowed'),
      requestId
    ));
  }

  try {
    const { url, html, options = {} } = req.body;
    
    // Validate required fields
    if (!url && !html) {
      throw Errors.required('url or html');
    }
    
    if (url && typeof url !== 'string') {
      throw Errors.invalid('url', 'Must be a valid URL string');
    }
    
    console.log(`🔍 [${requestId}] Starting form analysis for: ${url || 'provided HTML'}`);
    
    // Prepare page data
    let pageData = {
      url: url || 'direct-html',
      html: html
    };
    
    // Fetch HTML if not provided
    if (url && !html) {
      console.log(`🌐 [${requestId}] Fetching HTML from URL`);
      pageData.html = await fetchPageHTML(url);
    }
    
    // Initialize form mapper with options
    const mapper = getFormMapper();
    if (options.confidenceThreshold) {
      mapper.confidenceThreshold = options.confidenceThreshold;
    }
    
    // Analyze the form
    const analysis = await mapper.analyzeForm(pageData);
    
    if (!analysis.success) {
      return res.status(400).json({
        success: false,
        error: analysis.error,
        requestId: analysis.requestId || requestId
      });
    }
    
    // Return successful analysis
    console.log(`✅ [${requestId}] Form analysis completed successfully`);
    
    return res.status(200).json({
      success: true,
      mapping: analysis.mapping,
      confidence: analysis.confidence,
      processingTime: analysis.processingTime,
      requestId: analysis.requestId,
      stats: analysis.stats,
      meta: {
        url: pageData.url,
        analyzedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Form analysis error:`, error);
    
    const errorResponse = handleApiError(error, requestId);
    return res.status(errorResponse.error.statusCode).json(errorResponse);
  }
}

async function fetchPageHTML(url) {
  try {
    // Validate URL
    new URL(url); // This will throw if invalid
    
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'DirectoryBolt-FormAnalyzer/1.0 (+https://directorybolt.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000,
      follow: 5 // Allow up to 5 redirects
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    if (!html || html.length === 0) {
      throw new Error('Empty response received');
    }
    
    return html;
    
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      throw new Error('Website not found. Please check the URL.');
    }
    
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Request timed out. The website may be slow to respond.');
    }
    
    throw new Error(`Failed to fetch page: ${error.message}`);
  }
}