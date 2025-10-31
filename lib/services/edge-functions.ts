/**
 * Serverless Edge Functions for DirectoryBolt
 * Implements 2025 edge computing patterns for maximum performance
 * Provides geographic distribution, caching, and real-time processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { featureFlagService } from './feature-flags';
import type { 
  StrictUser, 
  APIResponse, 
  Result,
  NonEmptyString,
  URL as TypedURL 
} from '../types/enhanced-types';
import { makeNonEmptyString } from '@/lib/types/non-empty-string';

// Edge function configuration
export interface EdgeFunctionConfig {
  region?: 'auto' | 'global' | string[];
  cache?: {
    enabled: boolean;
    ttl: number; // seconds
    key?: (req: NextRequest) => string;
  };
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
  authentication?: boolean;
  geolocation?: boolean;
}

// Edge runtime context
export interface EdgeContext {
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: string;
    longitude?: string;
  };
  ip?: string;
  userAgent?: string;
  requestId: string;
  timestamp: number;
}

// Edge cache interface
interface EdgeCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Edge-optimized website analyzer
 * Runs at the edge for minimal latency
 */
export async function edgeWebsiteAnalyzer(
  req: NextRequest,
  config: EdgeFunctionConfig = {}
): Promise<NextResponse> {
  const context = createEdgeContext(req);
  
  try {
    // Early return if feature not available
    const flagContext = {
      environment: process.env.NODE_ENV || 'development',
      userId: req.headers.get('x-user-id') || undefined
    };

    if (!featureFlagService.isEnabled('edge_website_analysis', flagContext)) {
      return NextResponse.json({
        success: false,
        error: { message: 'Edge analysis not available' }
      }, { status: 403 });
    }

    // Rate limiting at the edge
    if (config.rateLimit) {
      const rateLimitResult = await checkEdgeRateLimit(req, config.rateLimit, context);
      if (!rateLimitResult.allowed) {
        return NextResponse.json({
          success: false,
          error: { message: 'Rate limit exceeded' }
        }, { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(config.rateLimit.requests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime)
          }
        });
      }
    }

    // Parse and validate request
    const body = await req.json();
    const { url, options = {} } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        error: { message: 'URL is required' }
      }, { status: 400 });
    }

    // Check cache at the edge
    const cacheKey = `website_analysis:${url}:${JSON.stringify(options)}`;
    const cache = getEdgeCache();
    
    if (config.cache?.enabled) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        const response = NextResponse.json(JSON.parse(cached));
        response.headers.set('X-Cache-Status', 'HIT');
        response.headers.set('X-Edge-Region', context.geo?.region || 'unknown');
        return response;
      }
    }

    // Perform analysis at the edge
    const analysis = await performEdgeAnalysis(url, options, context);
    
    // Cache the result
    if (config.cache?.enabled && analysis.success) {
      await cache.set(cacheKey, JSON.stringify(analysis), config.cache.ttl);
    }

    const response = NextResponse.json(analysis);
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Edge-Region', context.geo?.region || 'unknown');
    response.headers.set('X-Request-ID', context.requestId);
    
    return response;

  } catch (error) {
    console.error('Edge function error:', error);
    return NextResponse.json({
      success: false,
      error: { 
        message: 'Internal server error',
        requestId: context.requestId
      }
    }, { status: 500 });
  }
}

/**
 * Edge-optimized directory matching
 * Finds best directory matches based on location and business type
 */
export async function edgeDirectoryMatcher(
  req: NextRequest,
  config: EdgeFunctionConfig = {}
): Promise<NextResponse> {
  const context = createEdgeContext(req);

  try {
    const flagContext = {
      environment: process.env.NODE_ENV || 'development',
      userId: req.headers.get('x-user-id') || undefined
    };

    if (!featureFlagService.isEnabled('edge_directory_matching', flagContext)) {
      return NextResponse.json({
        success: false,
        error: { message: 'Edge directory matching not available' }
      }, { status: 403 });
    }

    const body = await req.json();
    const { businessType, category, location } = body;

    // Use geographic context for better matching
    const geoLocation = location || {
      country: context.geo?.country,
      region: context.geo?.region,
      city: context.geo?.city
    };

    const matches = await findDirectoryMatches(businessType, category, geoLocation, context);
    
    const response = NextResponse.json({
      success: true,
      data: matches,
      metadata: {
        region: context.geo?.region,
        requestId: context.requestId,
        matchCount: matches.length
      }
    });

    response.headers.set('X-Edge-Region', context.geo?.region || 'unknown');
    return response;

  } catch (error) {
    console.error('Edge directory matching error:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to match directories' }
    }, { status: 500 });
  }
}

/**
 * Edge-optimized real-time notifications
 * Delivers notifications with minimal latency
 */
export async function edgeNotificationDelivery(
  req: NextRequest,
  config: EdgeFunctionConfig = {}
): Promise<NextResponse> {
  const context = createEdgeContext(req);

  try {
    const flagContext = {
      environment: process.env.NODE_ENV || 'development',
      userId: req.headers.get('x-user-id') || undefined
    };

    if (!featureFlagService.isEnabled('edge_notifications', flagContext)) {
      return NextResponse.json({
        success: false,
        error: { message: 'Edge notifications not available' }
      }, { status: 403 });
    }

    const body = await req.json();
    const { userId, notification } = body;

    // Deliver notification via edge
    const result = await deliverEdgeNotification(userId, notification, context);
    
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        deliveredAt: new Date().toISOString(),
        region: context.geo?.region,
        latency: Date.now() - context.timestamp
      }
    });

  } catch (error) {
    console.error('Edge notification error:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to deliver notification' }
    }, { status: 500 });
  }
}

/**
 * Edge-optimized form processing
 * Processes submissions with validation at the edge
 */
export async function edgeFormProcessor(
  req: NextRequest,
  config: EdgeFunctionConfig = {}
): Promise<NextResponse> {
  const context = createEdgeContext(req);

  try {
    const flagContext = {
      environment: process.env.NODE_ENV || 'development',
      userId: req.headers.get('x-user-id') || undefined
    };

    if (!featureFlagService.isEnabled('edge_form_processing', flagContext)) {
      return NextResponse.json({
        success: false,
        error: { message: 'Edge form processing not available' }
      }, { status: 403 });
    }

    const body = await req.json();
    
    // Validate form data at the edge
    const validation = await validateFormAtEdge(body, context);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: { 
          message: 'Validation failed',
          details: validation.errors
        }
      }, { status: 400 });
    }

    // Process form submission
    const result = await processFormSubmission(body, context);
    
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        processedAt: new Date().toISOString(),
        region: context.geo?.region,
        processingTime: Date.now() - context.timestamp
      }
    });

  } catch (error) {
    console.error('Edge form processing error:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to process form' }
    }, { status: 500 });
  }
}

// Helper functions

function createEdgeContext(req: NextRequest): EdgeContext {
  const geo = {
    country: req.geo?.country,
    region: req.geo?.region,
    city: req.geo?.city,
    latitude: req.geo?.latitude,
    longitude: req.geo?.longitude
  };

  return {
    geo,
    ip: req.ip,
    userAgent: req.headers.get('user-agent') || undefined,
    requestId: crypto.randomUUID(),
    timestamp: Date.now()
  };
}

async function checkEdgeRateLimit(
  req: NextRequest,
  config: { requests: number; window: number },
  context: EdgeContext
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `rate_limit:${context.ip}:${Math.floor(Date.now() / (config.window * 1000))}`;
  const cache = getEdgeCache();
  
  const current = await cache.get(key);
  const count = current ? parseInt(current) : 0;
  
  if (count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.ceil(Date.now() / (config.window * 1000)) * config.window
    };
  }
  
  await cache.set(key, String(count + 1), config.window);
  
  return {
    allowed: true,
    remaining: config.requests - count - 1,
    resetTime: Math.ceil(Date.now() / (config.window * 1000)) * config.window
  };
}

async function performEdgeAnalysis(
  url: string,
  options: any,
  context: EdgeContext
): Promise<APIResponse<any>> {
  // Simplified edge analysis - would integrate with actual analysis service
  try {
    const startTime = Date.now();
    
    // Basic URL validation and fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DirectoryBolt-Edge-Analyzer/1.0'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const analysisTime = Date.now() - startTime;
    
    // Basic analysis
    const analysis = {
      url,
      status: response.status,
      size: html.length,
      loadTime: analysisTime,
      region: context.geo?.region,
      timestamp: new Date().toISOString(),
      basicMetrics: {
        hasTitle: html.includes('<title>'),
        hasDescription: html.includes('description'),
        hasKeywords: html.includes('keywords'),
        responsive: html.includes('viewport')
      }
    };
    
    return {
      success: true,
      data: analysis,
      error: null,
      metadata: {
        requestId: context.requestId,
        timestamp: new Date(),
        version: '1.0',
        rateLimit: null
      }
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ANALYSIS_FAILED',
        message: makeNonEmptyString(error instanceof Error ? error.message : 'Unknown error'),
        details: { url, context: context.geo },
        timestamp: new Date()
      },
      metadata: null
    };
  }
}

async function findDirectoryMatches(
  businessType: string,
  category: string,
  location: any,
  context: EdgeContext
): Promise<any[]> {
  // Edge-optimized directory matching logic
  // In a real implementation, this would query a distributed database
  
  const mockDirectories = [
    {
      id: '1',
      name: 'Local Business Directory',
      category: 'local',
      region: context.geo?.region,
      relevanceScore: 0.9
    },
    {
      id: '2',
      name: 'Tech Startup Hub',
      category: 'tech',
      region: 'global',
      relevanceScore: 0.8
    }
  ];
  
  // Filter and score based on location and business type
  return mockDirectories
    .filter(dir => 
      dir.category === category || 
      dir.region === context.geo?.region ||
      dir.region === 'global'
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

async function deliverEdgeNotification(
  userId: string,
  notification: any,
  context: EdgeContext
): Promise<any> {
  // Edge notification delivery logic
  return {
    id: crypto.randomUUID(),
    userId,
    notification,
    deliveredAt: new Date().toISOString(),
    region: context.geo?.region,
    status: 'delivered'
  };
}

async function validateFormAtEdge(
  data: any,
  context: EdgeContext
): Promise<{ valid: boolean; errors?: string[] }> {
  const errors: string[] = [];
  
  // Basic validation at the edge
  if (!data.businessName || typeof data.businessName !== 'string') {
    errors.push('Business name is required');
  }
  
  if (!data.email || !data.email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!data.website || !data.website.startsWith('http')) {
    errors.push('Valid website URL is required');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

async function processFormSubmission(
  data: any,
  context: EdgeContext
): Promise<any> {
  // Edge form processing logic
  return {
    id: crypto.randomUUID(),
    data,
    processedAt: new Date().toISOString(),
    region: context.geo?.region,
    status: 'processed'
  };
}

function getEdgeCache(): EdgeCache {
  // In a real implementation, this would connect to edge cache (Redis, etc.)
  const memoryCache = new Map<string, { value: string; expires: number }>();
  
  return {
    async get(key: string): Promise<string | null> {
      const item = memoryCache.get(key);
      if (!item || Date.now() > item.expires) {
        memoryCache.delete(key);
        return null;
      }
      return item.value;
    },
    
    async set(key: string, value: string, ttl: number): Promise<void> {
      memoryCache.set(key, {
        value,
        expires: Date.now() + (ttl * 1000)
      });
    },
    
    async delete(key: string): Promise<void> {
      memoryCache.delete(key);
    },
    
    async clear(): Promise<void> {
      memoryCache.clear();
    }
  };
}

// Middleware factory for edge functions
export function createEdgeMiddleware(config: EdgeFunctionConfig) {
  return async (req: NextRequest) => {
    const context = createEdgeContext(req);
    
    // Add edge context to request headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-edge-region', context.geo?.region || 'unknown');
    requestHeaders.set('x-request-id', context.requestId);
    
    // Apply rate limiting if configured
    if (config.rateLimit) {
      const rateLimitResult = await checkEdgeRateLimit(req, config.rateLimit, context);
      if (!rateLimitResult.allowed) {
        return new NextResponse('Rate limit exceeded', { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(config.rateLimit.requests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime)
          }
        });
      }
    }
    
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  };
}
