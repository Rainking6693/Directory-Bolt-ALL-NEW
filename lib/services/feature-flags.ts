/**
 * Modern Feature Flags System for DirectoryBolt
 * Enables rapid deployment, A/B testing, and organization-level targeting
 * Based on 2025 SaaS best practices for development velocity
 */

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number;
  organizationTargeting?: {
    enabledOrganizations?: string[];
    disabledOrganizations?: string[];
    tierRestrictions?: string[];
  };
  userTargeting?: {
    enabledUsers?: string[];
    disabledUsers?: string[];
  };
  environment?: 'development' | 'staging' | 'production' | 'all';
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface FeatureFlagContext {
  userId?: string;
  organizationId?: string;
  userTier?: string;
  environment: string;
  userAgent?: string;
  customAttributes?: Record<string, any>;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: Map<string, { result: boolean; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeDefaultFlags();
  }

  /**
   * Initialize default feature flags for DirectoryBolt
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'ai_enhanced_analysis',
        enabled: true,
        description: 'AI-powered website analysis with advanced insights',
        rolloutPercentage: 100,
        organizationTargeting: {
          tierRestrictions: ['premium', 'enterprise']
        },
        environment: 'all'
      },
      {
        key: 'real_time_queue_processing',
        enabled: false,
        description: 'Real-time directory submission processing',
        rolloutPercentage: 25,
        environment: 'production'
      },
      {
        key: 'advanced_competitor_analysis',
        enabled: true,
        description: 'Enhanced competitor analysis with market positioning',
        organizationTargeting: {
          tierRestrictions: ['enterprise']
        },
        environment: 'all'
      },
      {
        key: 'white_label_customization',
        enabled: false,
        description: 'White-label branding options for enterprise clients',
        organizationTargeting: {
          tierRestrictions: ['enterprise']
        },
        environment: 'all'
      },
      {
        key: 'bulk_directory_operations',
        enabled: true,
        description: 'Bulk operations for managing multiple directory submissions',
        rolloutPercentage: 80,
        environment: 'all'
      },
      {
        key: 'predictive_analytics_dashboard',
        enabled: false,
        description: 'AI-powered predictive analytics for business growth',
        rolloutPercentage: 10,
        organizationTargeting: {
          tierRestrictions: ['premium', 'enterprise']
        },
        environment: 'production'
      },
      {
        key: 'automated_verification_system',
        enabled: true,
        description: 'Automated business verification through multiple channels',
        rolloutPercentage: 50,
        environment: 'all'
      },
      {
        key: 'enhanced_pdf_reports',
        enabled: true,
        description: 'AI-generated comprehensive PDF reports',
        organizationTargeting: {
          tierRestrictions: ['premium', 'enterprise']
        },
        environment: 'all'
      }
    ];

    defaultFlags.forEach(flag => this.flags.set(flag.key, flag));
  }

  /**
   * Check if a feature is enabled for a given context
   */
  public isEnabled(flagKey: string, context: FeatureFlagContext): boolean {
    const cacheKey = this.getCacheKey(flagKey, context);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    const result = this.evaluateFlag(flagKey, context);
    this.cache.set(cacheKey, { result, timestamp: Date.now() });
    
    return result;
  }

  /**
   * Evaluate a feature flag against the given context
   */
  private evaluateFlag(flagKey: string, context: FeatureFlagContext): boolean {
    const flag = this.flags.get(flagKey);
    
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found, defaulting to false`);
      return false;
    }

    // Environment check
    if (flag.environment && flag.environment !== 'all' && flag.environment !== context.environment) {
      return false;
    }

    // Expiration check
    if (flag.expiresAt && new Date() > flag.expiresAt) {
      return false;
    }

    // Base enabled check
    if (!flag.enabled) {
      return false;
    }

    // User targeting
    if (flag.userTargeting) {
      if (context.userId) {
        if (flag.userTargeting.disabledUsers?.includes(context.userId)) {
          return false;
        }
        if (flag.userTargeting.enabledUsers?.includes(context.userId)) {
          return true;
        }
      }
    }

    // Organization targeting
    if (flag.organizationTargeting && context.organizationId) {
      if (flag.organizationTargeting.disabledOrganizations?.includes(context.organizationId)) {
        return false;
      }
      if (flag.organizationTargeting.enabledOrganizations?.includes(context.organizationId)) {
        return true;
      }
      
      // Tier restrictions
      if (flag.organizationTargeting.tierRestrictions && context.userTier) {
        if (!flag.organizationTargeting.tierRestrictions.includes(context.userTier)) {
          return false;
        }
      }
    }

    // Rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashString(`${flagKey}_${context.userId || context.organizationId || 'anonymous'}`);
      const percentage = (hash % 100) + 1;
      return percentage <= flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Update a feature flag
   */
  public updateFlag(flagKey: string, updates: Partial<FeatureFlag>): void {
    const existingFlag = this.flags.get(flagKey);
    if (!existingFlag) {
      throw new Error(`Feature flag '${flagKey}' not found`);
    }

    const updatedFlag = { ...existingFlag, ...updates };
    this.flags.set(flagKey, updatedFlag);
    this.clearCache(flagKey);
  }

  /**
   * Create a new feature flag
   */
  public createFlag(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag);
  }

  /**
   * Delete a feature flag
   */
  public deleteFlag(flagKey: string): void {
    this.flags.delete(flagKey);
    this.clearCache(flagKey);
  }

  /**
   * Get all feature flags
   */
  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get flags enabled for a specific context
   */
  public getEnabledFlags(context: FeatureFlagContext): string[] {
    return Array.from(this.flags.keys()).filter(key => this.isEnabled(key, context));
  }

  /**
   * Clear cache for a specific flag or all flags
   */
  private clearCache(flagKey?: string): void {
    if (flagKey) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(flagKey));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Generate cache key for flag evaluation
   */
  private getCacheKey(flagKey: string, context: FeatureFlagContext): string {
    return `${flagKey}_${context.userId || 'anonymous'}_${context.organizationId || 'no-org'}_${context.userTier || 'no-tier'}`;
  }

  /**
   * Simple hash function for rollout percentage calculations
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * A/B Testing support - get variant for a feature
   */
  public getVariant(flagKey: string, context: FeatureFlagContext, variants: string[]): string {
    if (!this.isEnabled(flagKey, context) || variants.length === 0) {
      return variants[0] || 'control';
    }

    const hash = this.hashString(`${flagKey}_variant_${context.userId || context.organizationId || 'anonymous'}`);
    const variantIndex = hash % variants.length;
    return variants[variantIndex];
  }

  /**
   * Get flag analytics data
   */
  public getFlagAnalytics(flagKey: string): {
    evaluations: number;
    enabledEvaluations: number;
    rolloutPercentage: number;
  } {
    // In a real implementation, this would integrate with analytics service
    const flag = this.flags.get(flagKey);
    return {
      evaluations: 0, // Would track actual evaluations
      enabledEvaluations: 0, // Would track enabled evaluations
      rolloutPercentage: flag?.rolloutPercentage || 0
    };
  }
}

// Singleton instance
export const featureFlagService = new FeatureFlagService();

// React hook for feature flags
import React from 'react'

export function useFeatureFlag(flagKey: string, context?: Partial<FeatureFlagContext>) {
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fullContext: FeatureFlagContext = {
      environment: process.env.NODE_ENV || 'development',
      ...context
    };

    const enabled = featureFlagService.isEnabled(flagKey, fullContext);
    setIsEnabled(enabled);
    setLoading(false);
  }, [flagKey, context]);

  return { isEnabled, loading };
}

// Export types for external use
