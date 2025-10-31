/**
 * Event-Driven Analytics System
 * Inspired by Netflix, Uber, and Amazon's architecture patterns
 * Implements real-time streaming analytics and event-driven processing
 */

import { EventEmitter } from 'events';

interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  userId?: string;
  customerId?: string;
  directoryId?: string;
  metadata: Record<string, any>;
  source: string;
  version: string;
}

interface StreamProcessor {
  name: string;
  eventTypes: string[];
  process: (event: AnalyticsEvent) => Promise<void>;
  errorHandler?: (error: Error, event: AnalyticsEvent) => void;
}

interface RealTimeMetrics {
  eventsPerSecond: number;
  averageProcessingTime: number;
  errorRate: number;
  activeStreams: number;
  memoryUsage: number;
}

export class EventDrivenAnalytics extends EventEmitter {
  private eventBuffer: AnalyticsEvent[] = [];
  private processors: Map<string, StreamProcessor[]> = new Map();
  private metrics: RealTimeMetrics = {
    eventsPerSecond: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    activeStreams: 0,
    memoryUsage: 0
  };
  private metricsInterval: NodeJS.Timeout | null = null;
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  
  // Netflix-inspired feature store for real-time features
  private featureStore = new Map<string, any>();
  
  // Uber-inspired surge detection for dynamic pricing
  private demandSupplyMetrics = new Map<string, { demand: number; supply: number; timestamp: Date }>();

  constructor() {
    super();
    this.setupMetricsCollection();
    this.setupEventBuffering();
    this.initializeCoreProcessors();
  }

  /**
   * Publish event to the analytics stream (Netflix/Amazon pattern)
   */
  async publishEvent(event: Omit<AnalyticsEvent, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date(),
      version: '1.0'
    };

    // Add to buffer for batch processing (Amazon pattern)
    this.eventBuffer.push(analyticsEvent);

    // Process real-time events immediately for critical paths
    if (this.isCriticalEvent(analyticsEvent)) {
      await this.processEventRealTime(analyticsEvent);
    }

    this.emit('event-published', analyticsEvent);
  }

  /**
   * Register stream processor (Uber's event-driven architecture pattern)
   */
  registerProcessor(processor: StreamProcessor): void {
    processor.eventTypes.forEach(eventType => {
      if (!this.processors.has(eventType)) {
        this.processors.set(eventType, []);
      }
      this.processors.get(eventType)!.push(processor);
    });

    this.metrics.activeStreams++;
    console.log(`📊 Registered processor: ${processor.name} for events: ${processor.eventTypes.join(', ')}`);
  }

  /**
   * Real-time fraud detection (Amazon-inspired pattern)
   */
  private async detectFraudulentActivity(event: AnalyticsEvent): Promise<boolean> {
    if (event.eventType !== 'submission_created' && event.eventType !== 'payment_processed') {
      return false;
    }

    const customerId = event.customerId;
    if (!customerId) return false;

    // Check for rapid successive submissions (velocity check)
    const recentEvents = this.eventBuffer
      .filter(e => e.customerId === customerId && 
                   e.eventType === event.eventType &&
                   Date.now() - e.timestamp.getTime() < 300000) // 5 minutes
      .length;

    if (recentEvents > 5) {
      await this.publishEvent({
        eventType: 'fraud_alert',
        customerId,
        source: 'fraud_detector',
        metadata: {
          alertType: 'velocity_limit_exceeded',
          eventCount: recentEvents,
          timeWindow: '5_minutes'
        }
      });
      return true;
    }

    // Check for unusual pattern deviations
    const customerHistory = this.getCustomerFeatures(customerId);
    if (this.isAnomalousActivity(event, customerHistory)) {
      await this.publishEvent({
        eventType: 'fraud_alert',
        customerId,
        source: 'fraud_detector',
        metadata: {
          alertType: 'anomalous_pattern',
          deviation: 'behavioral_anomaly'
        }
      });
      return true;
    }

    return false;
  }

  /**
   * Dynamic pricing calculation (Uber-inspired surge pricing)
   */
  private async calculateDynamicPricing(directoryType: string): Promise<number> {
    const basePrice = this.getBasePrice(directoryType);
    const demandSupply = this.demandSupplyMetrics.get(directoryType);
    
    if (!demandSupply) {
      return basePrice;
    }

    // Calculate surge multiplier based on demand/supply ratio
    const ratio = demandSupply.demand / Math.max(demandSupply.supply, 1);
    let surgeMultiplier = 1.0;

    if (ratio > 3.0) surgeMultiplier = 2.0;
    else if (ratio > 2.0) surgeMultiplier = 1.5;
    else if (ratio > 1.5) surgeMultiplier = 1.25;

    const surgePrice = basePrice * surgeMultiplier;

    // Publish pricing update event
    await this.publishEvent({
      eventType: 'pricing_updated',
      directoryId: directoryType,
      source: 'pricing_engine',
      metadata: {
        basePrice,
        surgeMultiplier,
        surgePrice,
        demandSupplyRatio: ratio
      }
    });

    return surgePrice;
  }

  /**
   * Real-time recommendation engine (Netflix-inspired)
   */
  private async generateRecommendations(customerId: string): Promise<string[]> {
    const customerFeatures = this.getCustomerFeatures(customerId);
    const recommendations: string[] = [];

    // Feature-based recommendations
    if (customerFeatures.packageType === 'starter' && customerFeatures.submissionCount > 40) {
      recommendations.push('upgrade_to_growth');
    }

    if (customerFeatures.averageSubmissionTime < 2 && customerFeatures.successRate > 0.9) {
      recommendations.push('premium_directories');
    }

    if (customerFeatures.failureRate > 0.3) {
      recommendations.push('directory_optimization_service');
    }

    // Collaborative filtering based on similar customers
    const similarCustomers = await this.findSimilarCustomers(customerId);
    const popularDirectories = this.getPopularDirectoriesForSegment(similarCustomers);
    recommendations.push(...popularDirectories.slice(0, 3));

    // Publish recommendation event
    await this.publishEvent({
      eventType: 'recommendations_generated',
      customerId,
      source: 'recommendation_engine',
      metadata: {
        recommendations,
        features: customerFeatures,
        algorithm: 'collaborative_content_hybrid'
      }
    });

    return recommendations;
  }

  /**
   * Real-time event processing
   */
  private async processEventRealTime(event: AnalyticsEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Update feature store (Netflix pattern)
      this.updateFeatureStore(event);

      // Update demand/supply metrics (Uber pattern)
      this.updateDemandSupplyMetrics(event);

      // Run fraud detection (Amazon pattern)
      const isFraud = await this.detectFraudulentActivity(event);
      if (isFraud) {
        console.warn(`🚨 Fraudulent activity detected for customer: ${event.customerId}`);
      }

      // Process through registered processors
      const processors = this.processors.get(event.eventType) || [];
      await Promise.all(processors.map(processor => 
        this.safeProcessEvent(processor, event)
      ));

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime, false);

    } catch (error) {
      console.error('Real-time event processing failed:', error);
      this.updateProcessingMetrics(Date.now() - startTime, true);
    }
  }

  /**
   * Batch event processing (Amazon pattern)
   */
  private async processBatchEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const batch = this.eventBuffer.splice(0, Math.min(100, this.eventBuffer.length));
    
    try {
      // Group events by type for efficient processing
      const eventGroups = batch.reduce((groups, event) => {
        if (!groups[event.eventType]) groups[event.eventType] = [];
        groups[event.eventType].push(event);
        return groups;
      }, {} as Record<string, AnalyticsEvent[]>);

      // Process each group
      for (const [eventType, events] of Object.entries(eventGroups)) {
        await this.processBatchEventType(eventType, events);
      }

      // Update metrics
      this.metrics.eventsPerSecond = batch.length / 1; // Events processed per second

    } catch (error) {
      console.error('Batch event processing failed:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...batch);
    }
  }

  private async processBatchEventType(eventType: string, events: AnalyticsEvent[]): Promise<void> {
    switch (eventType) {
      case 'submission_created':
        await this.processBatchSubmissions(events);
        break;
      case 'customer_behavior':
        await this.processBatchBehavior(events);
        break;
      case 'directory_performance':
        await this.processBatchPerformance(events);
        break;
      default:
        // Generic processing for custom event types
        const processors = this.processors.get(eventType) || [];
        await Promise.all(events.map(event => 
          Promise.all(processors.map(processor => this.safeProcessEvent(processor, event)))
        ));
    }
  }

  private async processBatchSubmissions(events: AnalyticsEvent[]): Promise<void> {
    // Aggregate submission data for insights
    const submissionMetrics = events.reduce((metrics, event) => {
      const directoryType = event.metadata.directoryType;
      if (!metrics[directoryType]) {
        metrics[directoryType] = { count: 0, successRate: 0, totalTime: 0 };
      }
      metrics[directoryType].count++;
      metrics[directoryType].totalTime += event.metadata.processingTime || 0;
      return metrics;
    }, {} as Record<string, any>);

    // Update demand metrics for dynamic pricing
    Object.entries(submissionMetrics).forEach(([directoryType, metrics]) => {
      this.updateDemandMetric(directoryType, metrics.count);
    });
  }

  private async processBatchBehavior(events: AnalyticsEvent[]): Promise<void> {
    // Analyze customer behavior patterns
    const behaviorPatterns = events.reduce((patterns, event) => {
      const customerId = event.customerId!;
      if (!patterns[customerId]) {
        patterns[customerId] = { actions: [], sessionDuration: 0, bounceRate: 0 };
      }
      patterns[customerId].actions.push(event.metadata.action);
      return patterns;
    }, {} as Record<string, any>);

    // Generate recommendations based on behavior
    for (const customerId of Object.keys(behaviorPatterns)) {
      await this.generateRecommendations(customerId);
    }
  }

  private async processBatchPerformance(events: AnalyticsEvent[]): Promise<void> {
    // Update directory performance metrics
    const performanceData = events.reduce((data, event) => {
      const directoryId = event.directoryId!;
      if (!data[directoryId]) {
        data[directoryId] = { submissions: 0, successRate: 0, avgResponseTime: 0 };
      }
      data[directoryId].submissions++;
      data[directoryId].avgResponseTime += event.metadata.responseTime || 0;
      return data;
    }, {} as Record<string, any>);

    // Update supply metrics for directories
    Object.keys(performanceData).forEach(directoryId => {
      this.updateSupplyMetric(directoryId, 1);
    });
  }

  // Helper methods
  private initializeCoreProcessors(): void {
    // Customer behavior processor
    this.registerProcessor({
      name: 'customer_behavior_processor',
      eventTypes: ['page_view', 'form_interaction', 'submission_created'],
      process: async (event) => {
        if (event.customerId) {
          await this.updateCustomerBehaviorProfile(event.customerId, event);
        }
      }
    });

    // Performance monitoring processor
    this.registerProcessor({
      name: 'performance_monitor',
      eventTypes: ['api_request', 'database_query', 'external_service_call'],
      process: async (event) => {
        await this.updatePerformanceMetrics(event);
      }
    });

    // Business intelligence processor
    this.registerProcessor({
      name: 'business_intelligence',
      eventTypes: ['payment_processed', 'subscription_changed', 'churn_predicted'],
      process: async (event) => {
        await this.updateBusinessMetrics(event);
      }
    });
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private isCriticalEvent(event: AnalyticsEvent): boolean {
    const criticalEvents = ['fraud_alert', 'payment_processed', 'system_error', 'security_breach'];
    return criticalEvents.includes(event.eventType);
  }

  private updateFeatureStore(event: AnalyticsEvent): void {
    if (event.customerId) {
      const key = `customer:${event.customerId}`;
      const features = this.featureStore.get(key) || {};
      
      // Update features based on event
      switch (event.eventType) {
        case 'submission_created':
          features.submissionCount = (features.submissionCount || 0) + 1;
          features.lastSubmissionTime = event.timestamp;
          break;
        case 'payment_processed':
          features.totalSpent = (features.totalSpent || 0) + (event.metadata.amount || 0);
          break;
      }
      
      this.featureStore.set(key, features);
    }
  }

  private updateDemandSupplyMetrics(event: AnalyticsEvent): void {
    if (event.eventType === 'submission_created') {
      this.updateDemandMetric(event.metadata.directoryType, 1);
    } else if (event.eventType === 'directory_available') {
      this.updateSupplyMetric(event.directoryId!, 1);
    }
  }

  private updateDemandMetric(directoryType: string, increment: number): void {
    const current = this.demandSupplyMetrics.get(directoryType) || { demand: 0, supply: 0, timestamp: new Date() };
    current.demand += increment;
    current.timestamp = new Date();
    this.demandSupplyMetrics.set(directoryType, current);
  }

  private updateSupplyMetric(directoryType: string, increment: number): void {
    const current = this.demandSupplyMetrics.get(directoryType) || { demand: 0, supply: 0, timestamp: new Date() };
    current.supply += increment;
    current.timestamp = new Date();
    this.demandSupplyMetrics.set(directoryType, current);
  }

  private getCustomerFeatures(customerId: string): any {
    return this.featureStore.get(`customer:${customerId}`) || {};
  }

  private getBasePrice(directoryType: string): number {
    const basePrices: Record<string, number> = {
      'business': 25,
      'niche': 35,
      'premium': 50,
      'enterprise': 100
    };
    return basePrices[directoryType] || 25;
  }

  private isAnomalousActivity(event: AnalyticsEvent, customerHistory: any): boolean {
    // Simple anomaly detection - can be enhanced with ML models
    if (!customerHistory.averageSubmissionTime) return false;
    
    const currentTime = event.metadata.submissionTime || 0;
    const avgTime = customerHistory.averageSubmissionTime;
    
    // Flag if submission time is 3x faster than average (potential bot behavior)
    return currentTime < avgTime * 0.33;
  }

  private async findSimilarCustomers(customerId: string): Promise<string[]> {
    // Simplified collaborative filtering
    const customerFeatures = this.getCustomerFeatures(customerId);
    const similarCustomers: string[] = [];
    
    for (const [key, features] of this.featureStore.entries()) {
      if (key.startsWith('customer:') && key !== `customer:${customerId}`) {
        const similarity = this.calculateSimilarity(customerFeatures, features);
        if (similarity > 0.7) {
          similarCustomers.push(key.replace('customer:', ''));
        }
      }
    }
    
    return similarCustomers.slice(0, 10);
  }

  private calculateSimilarity(features1: any, features2: any): number {
    // Simple cosine similarity calculation
    const keys = new Set([...Object.keys(features1), ...Object.keys(features2)]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const key of keys) {
      const val1 = features1[key] || 0;
      const val2 = features2[key] || 0;
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private getPopularDirectoriesForSegment(customers: string[]): string[] {
    // Return popular directories for similar customer segment
    return ['business_directory_1', 'niche_directory_2', 'premium_directory_3'];
  }

  private async safeProcessEvent(processor: StreamProcessor, event: AnalyticsEvent): Promise<void> {
    try {
      await processor.process(event);
    } catch (error) {
      console.error(`Processor ${processor.name} failed:`, error);
      if (processor.errorHandler) {
        processor.errorHandler(error as Error, event);
      }
    }
  }

  private updateProcessingMetrics(processingTime: number, isError: boolean): void {
    // Update average processing time
    const currentAvg = this.metrics.averageProcessingTime;
    this.metrics.averageProcessingTime = (currentAvg + processingTime) / 2;
    
    // Update error rate
    if (isError) {
      this.metrics.errorRate += 0.1; // Increase error rate
    } else {
      this.metrics.errorRate = Math.max(0, this.metrics.errorRate - 0.01); // Decrease error rate
    }
  }

  private setupMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.emit('metrics-updated', this.metrics);
    }, 10000); // Every 10 seconds
  }

  private setupEventBuffering(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.processBatchEvents();
    }, 5000); // Every 5 seconds
  }

  private collectSystemMetrics(): void {
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  private async updateCustomerBehaviorProfile(customerId: string, event: AnalyticsEvent): Promise<void> {
    // Update customer behavior profile based on event
    const features = this.getCustomerFeatures(customerId);
    features.lastActivity = event.timestamp;
    features.activityCount = (features.activityCount || 0) + 1;
    this.featureStore.set(`customer:${customerId}`, features);
  }

  private async updatePerformanceMetrics(event: AnalyticsEvent): Promise<void> {
    // Track API and database performance
    if (event.metadata.responseTime) {
      this.updateProcessingMetrics(event.metadata.responseTime, false);
    }
  }

  private async updateBusinessMetrics(event: AnalyticsEvent): Promise<void> {
    // Update business KPIs and revenue metrics
    console.log(`📈 Business metric updated: ${event.eventType}`);
  }

  /**
   * Get current analytics metrics
   */
  getRealTimeMetrics(): RealTimeMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.bufferFlushInterval) clearInterval(this.bufferFlushInterval);
    this.removeAllListeners();
  }
}

export default EventDrivenAnalytics;
