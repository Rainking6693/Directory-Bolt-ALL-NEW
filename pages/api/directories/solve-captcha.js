/**
 * 🔓 CAPTCHA SOLVING API - Multi-Service CAPTCHA Resolution
 * 
 * POST /api/directories/solve-captcha
 * 
 * Solves CAPTCHAs using multiple services with automatic failover:
 * - CapSolver ($0.80/1000) - Primary
 * - DeathByCaptcha ($1.39/1000) - Backup
 * - Anti-Captcha ($2.00/1000) - Alternative
 * - 2Captcha ($2.99/1000) - Fallback
 * 
 * Request Body:
 * {
 *   "type": "recaptcha_v2", // recaptcha_v2, recaptcha_v3, hcaptcha, funcaptcha
 *   "siteKey": "6LdyK...",
 *   "pageUrl": "https://directory.com/submit",
 *   "minScore": 0.3, // For reCAPTCHA v3
 *   "options": {
 *     "preferredService": "capsolver",
 *     "maxCost": 0.003, // Max cost per solve
 *     "timeout": 120000 // 2 minutes
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "solution": "03AGdBq25...",
 *   "service": "CapSolver",
 *   "responseTime": 15432,
 *   "cost": 0.0008,
 *   "requestId": "cap_..."
 * }
 */

import { CaptchaServiceManager } from '../../../lib/captcha/CaptchaServiceManager';
import { handleApiError, Errors } from '../../../lib/utils/errors';

// Initialize the CAPTCHA service manager
let captchaManager = null;

function getCaptchaManager() {
  if (!captchaManager) {
    captchaManager = new CaptchaServiceManager({
      capsolverApiKey: process.env.CAPSOLVER_API_KEY,
      anticaptchaApiKey: process.env.ANTICAPTCHA_API_KEY,
      twocaptchaApiKey: process.env.TWOCAPTCHA_API_KEY,
      dbcUsername: process.env.DBC_USERNAME,
      dbcPassword: process.env.DBC_PASSWORD
    });
  }
  return captchaManager;
}

export default async function handler(req, res) {
  const requestId = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // CORS headers
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
    const { type, siteKey, pageUrl, minScore, publicKey, options = {} } = req.body;
    
    // Validate required fields
    if (!type) {
      throw Errors.required('type');
    }
    
    if (!siteKey && !publicKey) {
      throw Errors.required('siteKey or publicKey');
    }
    
    if (!pageUrl) {
      throw Errors.required('pageUrl');
    }
    
    // Validate CAPTCHA type
    const supportedTypes = ['recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'funcaptcha'];
    if (!supportedTypes.includes(type)) {
      throw Errors.invalid('type', `Must be one of: ${supportedTypes.join(', ')}`);
    }
    
    // Validate page URL
    try {
      new URL(pageUrl);
    } catch (error) {
      throw Errors.invalid('pageUrl', 'Must be a valid URL');
    }
    
    console.log(`🔓 [${requestId}] Starting CAPTCHA solve: ${type} for ${pageUrl}`);
    
    // Prepare CAPTCHA data
    const captchaData = {
      type,
      siteKey: siteKey || publicKey,
      pageUrl,
      minScore: type === 'recaptcha_v3' ? (minScore || 0.3) : undefined,
      publicKey: type === 'funcaptcha' ? (publicKey || siteKey) : undefined
    };
    
    // Check if we have any working services configured
    const manager = getCaptchaManager();
    if (manager.services.length === 0) {
      throw new Error('No CAPTCHA services configured. Please set up API keys.');
    }
    
    // Apply options
    if (options.maxCost) {
      // Filter services by max cost
      manager.services = manager.services.filter(
        service => (service.costPer1000 / 1000) <= options.maxCost
      );
      
      if (manager.services.length === 0) {
        throw new Error(`No services available within max cost of $${options.maxCost}`);
      }
    }
    
    if (options.preferredService) {
      // Reorder services to prioritize preferred service
      const preferred = manager.services.find(
        s => s.name.toLowerCase() === options.preferredService.toLowerCase()
      );
      
      if (preferred) {
        manager.services = manager.services.filter(s => s !== preferred);
        manager.services.unshift({ ...preferred, priority: 0 });
      }
    }
    
    // Set timeout if specified
    const timeout = options.timeout || 120000; // 2 minutes default
    
    // Solve the CAPTCHA with timeout
    const solvePromise = manager.solveCaptcha(captchaData);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('CAPTCHA solving timeout')), timeout);
    });
    
    const result = await Promise.race([solvePromise, timeoutPromise]);
    
    if (!result.success) {
      throw new Error('CAPTCHA solving failed');
    }
    
    console.log(`✅ [${requestId}] CAPTCHA solved successfully using ${result.service} in ${result.responseTime}ms`);
    
    // Return successful result
    return res.status(200).json({
      success: true,
      solution: result.solution,
      service: result.service,
      responseTime: result.responseTime,
      cost: result.cost,
      requestId: result.requestId,
      meta: {
        type: captchaData.type,
        pageUrl: captchaData.pageUrl,
        solvedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] CAPTCHA solving error:`, error);
    
    let statusCode = 500;
    let errorMessage = error.message;
    
    // Classify error types for appropriate status codes
    if (error.message.includes('timeout')) {
      statusCode = 408; // Request Timeout
    } else if (error.message.includes('no services')) {
      statusCode = 503; // Service Unavailable
    } else if (error.message.includes('required') || error.message.includes('invalid')) {
      statusCode = 400; // Bad Request
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}

// Health check endpoint for CAPTCHA services
export async function checkCaptchaServicesHealth() {
  try {
    const manager = getCaptchaManager();
    const stats = manager.getStats();
    
    return {
      available: manager.services.length > 0,
      services: manager.services.map(service => ({
        name: service.name,
        active: service.active,
        costPer1000: service.costPer1000,
        successRate: `${(service.successRate * 100).toFixed(1)}%`,
        avgResponseTime: `${service.avgResponseTime}ms`
      })),
      stats
    };
    
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}