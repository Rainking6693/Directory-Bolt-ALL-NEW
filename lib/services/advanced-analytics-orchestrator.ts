/**
 * Advanced Analytics Orchestrator
 * Orchestrates all advanced learning implementations for DirectoryBolt
 * Combines Supabase optimization, event-driven analytics, feature store, and observability
 */

import SupabaseOptimizer from './enhanced-supabase-optimizer';
import EventDrivenAnalytics from './event-driven-analytics';
import FeatureStoreManager from './feature-store-manager';
import AxiomObservability from './axiom-observability';

interface AnalyticsConfig {
  enableSupabaseOptimization: boolean;
  enableEventDrivenAnalytics: boolean;
  enableFeatureStore: boolean;
  enableAxiomObservability: boolean;
  batchSize: number;
  flushInterval: number;
}

interface AnalyticsInsight {
  type: 'performance' | 'business' | 'customer' | 'system';
  title: string;
  description: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export class AdvancedAnalyticsOrchestrator {
  private supabaseOptimizer: SupabaseOptimizer | null = null;
  private eventAnalytics: EventDrivenAnalytics | null = null;
  private featureStore: FeatureStoreManager | null = null;
  private observability: AxiomObservability | null = null;
  
  private config: AnalyticsConfig;
  private isInitialized = false;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enableSupabaseOptimization: true,
      enableEventDrivenAnalytics: true,
      enableFeatureStore: true,
      enableAxiomObservability: true,
      batchSize: 100,
      flushInterval: 5000,
      ...config
    };
  }

  /**
   * Initialize all analytics services
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.enableSupabaseOptimization) {
        this.supabaseOptimizer = new SupabaseOptimizer();
        console.log('✅ Supabase Optimizer initialized');
      }

      if (this.config.enableEventDrivenAnalytics) {
        this.eventAnalytics = new EventDrivenAnalytics();
        console.log('✅ Event-Driven Analytics initialized');
      }

      if (this.config.enableFeatureStore) {
        this.featureStore = new FeatureStoreManager();
        console.log('✅ Feature Store Manager initialized');
      }

      if (this.config.enableAxiomObservability) {
        this.observability = new AxiomObservability();
        console.log('✅ Axiom Observability initialized');
      }

      // Setup integrations between services
      await this.setupServiceIntegrations();
      
      this.isInitialized = true;
      console.log('🚀 Advanced Analytics Orchestrator fully initialized');

      // Track initialization success
      await this.trackEvent('system_initialized', {
        services_enabled: this.getEnabledServices(),
        initialization_time: Date.now()
      });

    } catch (error) {
      console.error('❌ Failed to initialize Analytics Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Setup integrations between different analytics services
   */
  private async setupServiceIntegrations(): Promise<void> {
    if (this.eventAnalytics && this.featureStore) {
      // Connect event analytics to feature store for real-time feature updates
      this.eventAnalytics.registerProcessor({
        name: 'feature_store_updater',
        eventTypes: ['customer_behavior', 'submission_created', 'payment_processed'],
        process: async (event) => {
          if (event.customerId && this.featureStore) {
            await this.featureStore.computeCustomerFeatures(event.customerId);
          }
        }
      });
    }

    if (this.eventAnalytics && this.observability) {
      // Forward critical events to observability
      this.eventAnalytics.registerProcessor({
        name: 'observability_forwarder',
        eventTypes: ['fraud_alert', 'system_error', 'performance_degradation'],
        process: async (event) => {
          if (this.observability) {
            await this.observability.log('warn', `Critical event: ${event.eventType}`, {
              event_data: event.metadata,
              customer_id: event.customerId,
              source: 'event_analytics'
            });
          }
        }
      });
    }

    if (this.supabaseOptimizer && this.observability) {
      // Track database performance metrics
      setInterval(async () => {
        if (this.supabaseOptimizer && this.observability) {
          const performance = await this.supabaseOptimizer.getConnectionPoolHealth();
          await this.observability.trackPerformance(
            'database.connection_pool_utilization',
            performance.utilization_percentage,
            'percent'
          );
        }
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Comprehensive analytics tracking for customer actions
   */
  async trackCustomerAction(
    customerId: string,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Analytics Orchestrator not initialized');
      return;
    }

    const timestamp = new Date();
    const enrichedMetadata = {
      ...metadata,
      timestamp,
      session_id: metadata.sessionId || this.generateSessionId(),
      user_agent: metadata.userAgent,
      ip_address: metadata.ipAddress
    };

    // Track in event analytics
    if (this.eventAnalytics) {
      await this.eventAnalytics.publishEvent({
        eventType: 'customer_behavior',
        customerId,
        source: 'customer_action_tracker',
        metadata: {
          action,
          ...enrichedMetadata
        }
      });
    }

    // Track in observability
    if (this.observability) {
      await this.observability.trackCustomerEvent(customerId, action, enrichedMetadata);
    }

    // Update feature store
    if (this.featureStore) {
      await this.featureStore.computeCustomerFeatures(customerId);
    }
  }

  /**
   * Track business operations with performance monitoring
   */
  async trackBusinessOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Use observability tracing if available
      if (this.observability) {
        return await this.observability.trace(operation, fn, metadata);
      }

      // Fallback to manual tracking
      const result = await fn();
      const duration = Date.now() - startTime;

      await this.trackEvent('business_operation_completed', {
        operation,
        duration_ms: duration,
        status: 'success',
        ...metadata
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.trackEvent('business_operation_failed', {
        operation,
        duration_ms: duration,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        ...metadata
      });

      throw error;
    }
  }

  /**
   * Get AI-powered customer recommendations
   */
  async getCustomerRecommendations(customerId: string): Promise<{
    recommendations: string[];
    confidence: number;
    reasoning: string[];
  }> {
    if (!this.featureStore) {
      return {
        recommendations: ['Enable feature store for personalized recommendations'],
        confidence: 0,
        reasoning: ['Feature store not initialized']
      };
    }

    try {
      // Get customer feature vector
      const featureVector = await this.featureStore.getFeatureVector(customerId, 'customer');
      
      const recommendations: string[] = [];
      const reasoning: string[] = [];
      let confidence = 0.7; // Base confidence

      // Analyze features for recommendations
      const features = featureVector.features;

      // Package upgrade recommendations
      if (features.package_utilization > 0.8) {
        recommendations.push('upgrade_package');
        reasoning.push('High package utilization detected (>80%)');
        confidence += 0.1;
      }

      // Engagement recommendations
      if (features.engagement_score < 50) {
        recommendations.push('engagement_boost');
        reasoning.push('Low engagement score detected');
        confidence += 0.05;
      }

      // Churn prevention
      if (features.churn_probability > 0.7) {
        recommendations.push('churn_prevention');
        reasoning.push('High churn probability detected');
        confidence += 0.15;
      }

      // Success rate improvement
      if (features.success_rate < 0.6) {
        recommendations.push('success_optimization');
        reasoning.push('Low submission success rate');
        confidence += 0.1;
      }

      // Track recommendation generation
      await this.trackEvent('recommendations_generated', {
        customer_id: customerId,
        recommendation_count: recommendations.length,
        confidence,
        features_analyzed: Object.keys(features).length
      });

      return {
        recommendations,
        confidence: Math.min(confidence, 1.0),
        reasoning
      };

    } catch (error) {
      console.error('Failed to generate customer recommendations:', error);
      return {
        recommendations: ['Unable to generate recommendations'],
        confidence: 0,
        reasoning: ['Recommendation engine error']
      };
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  async getDashboardData(): Promise<{
    performance: any;
    business: any;
    system: any;
    insights: AnalyticsInsight[];
    recommendations: string[];
  }> {
    const dashboardData = {
      performance: {
        database: null as unknown,
        events: null as unknown
      },
      business: {} as Record<string, unknown>,
      system: {} as Record<string, unknown>,
      insights: [] as AnalyticsInsight[],
      recommendations: [] as string[]
    };

    try {
      // Gather performance data
      if (this.supabaseOptimizer) {
        const dbReport = await this.supabaseOptimizer.generatePerformanceReport();
        dashboardData.performance.database = dbReport;
      }

      if (this.eventAnalytics) {
        const eventMetrics = this.eventAnalytics.getRealTimeMetrics();
        dashboardData.performance.events = eventMetrics;
      }

      // Gather business data
      if (this.observability) {
        const businessInsights = await this.observability.getInsights();
        dashboardData.business = businessInsights.business;
        dashboardData.recommendations.push(...businessInsights.recommendations);
      }

      // Gather system data
      if (this.observability) {
        const systemMetrics = await this.observability.getInsights();
        dashboardData.system = systemMetrics.performance;
      }

      // Generate insights
      dashboardData.insights = await this.generateInsights(dashboardData);

      return dashboardData;

    } catch (error) {
      console.error('Failed to generate dashboard data:', error);
      return dashboardData;
    }
  }

  /**
   * Generate actionable insights from collected data
   */
  private async generateInsights(data: any): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Database performance insights
    if (data.performance.database) {
      const dbHealth = data.performance.database;
      
      if (dbHealth.overall_health === 'critical') {
        insights.push({
          type: 'performance',
          title: 'Database Performance Critical',
          description: 'Database performance requires immediate attention',
          value: 0,
          unit: 'health_score',
          trend: 'down',
          severity: 'critical',
          recommendations: dbHealth.optimization_recommendations?.recommendations || []
        });
      }

      if (dbHealth.connection_pool.utilization_percentage > 80) {
        insights.push({
          type: 'system',
          title: 'High Connection Pool Utilization',
          description: 'Database connection pool is running at high capacity',
          value: dbHealth.connection_pool.utilization_percentage,
          unit: 'percent',
          trend: 'up',
          severity: 'high',
          recommendations: ['Scale connection pool', 'Optimize query efficiency']
        });
      }
    }

    // Event analytics insights
    if (data.performance.events) {
      const eventMetrics = data.performance.events;
      
      if (eventMetrics.errorRate > 5) {
        insights.push({
          type: 'system',
          title: 'High Event Processing Error Rate',
          description: 'Event processing is experiencing higher than normal error rates',
          value: eventMetrics.errorRate,
          unit: 'percent',
          trend: 'up',
          severity: 'medium',
          recommendations: ['Review event processing logs', 'Implement error recovery mechanisms']
        });
      }
    }

    return insights;
  }

  /**
   * Track custom events across all systems
   */
  private async trackEvent(eventType: string, metadata: Record<string, any>): Promise<void> {
    if (this.eventAnalytics) {
      await this.eventAnalytics.publishEvent({
        eventType,
        source: 'analytics_orchestrator',
        metadata
      });
    }

    if (this.observability) {
      await this.observability.log('info', `Analytics event: ${eventType}`, {
        event_type: 'analytics',
        ...metadata
      });
    }
  }

  /**
   * Optimize customer query performance automatically
   */
  async optimizeCustomerQuery(customerId: string): Promise<{
    optimized: boolean;
    improvements: string[];
    performance_gain: number;
  }> {
    if (!this.supabaseOptimizer) {
      return {
        optimized: false,
        improvements: ['Supabase optimizer not available'],
        performance_gain: 0
      };
    }

    try {
      const query = `SELECT * FROM customers WHERE customer_id = '${customerId}'`;
      const analysis = await this.supabaseOptimizer.analyzeQueryPerformance(query);
      
      let performanceGain = 0;
      const improvements: string[] = [];

      // Apply index recommendations
      for (const recommendation of analysis.index_recommendations) {
        if (recommendation.cost_reduction > 20) {
          improvements.push(`Create ${recommendation.index_type} index on ${recommendation.column_names.join(', ')}`);
          performanceGain += recommendation.cost_reduction;
        }
      }

      return {
        optimized: improvements.length > 0,
        improvements,
        performance_gain: Math.min(performanceGain, 100)
      };

    } catch (error) {
      console.error('Query optimization failed:', error);
      return {
        optimized: false,
        improvements: ['Query optimization failed'],
        performance_gain: 0
      };
    }
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'critical';
    services: Record<string, boolean>;
  } {
    const services = {
      supabase_optimizer: !!this.supabaseOptimizer,
      event_analytics: !!this.eventAnalytics,
      feature_store: !!this.featureStore,
      observability: !!this.observability
    };

    const enabledServices = Object.values(services).filter(enabled => enabled).length;
    const totalServices = Object.keys(services).length;

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (enabledServices < totalServices * 0.5) {
      overall = 'critical';
    } else if (enabledServices < totalServices * 0.8) {
      overall = 'degraded';
    }

    return {
      overall,
      services
    };
  }

  /**
   * Get enabled services list
   */
  private getEnabledServices(): string[] {
    const services: string[] = [];
    if (this.supabaseOptimizer) services.push('supabase_optimizer');
    if (this.eventAnalytics) services.push('event_analytics');
    if (this.featureStore) services.push('feature_store');
    if (this.observability) services.push('observability');
    return services;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cleanup and shutdown all services
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Analytics Orchestrator...');

    if (this.observability) {
      this.observability.destroy();
    }

    if (this.eventAnalytics) {
      this.eventAnalytics.destroy();
    }

    if (this.featureStore) {
      this.featureStore.clearCache();
    }

    this.isInitialized = false;
    console.log('✅ Analytics Orchestrator shutdown complete');
  }
}

export default AdvancedAnalyticsOrchestrator;
