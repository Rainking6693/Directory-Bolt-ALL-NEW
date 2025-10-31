/**
 * Feature Store Manager
 * Netflix/Amazon-inspired feature store for real-time ML inference
 * Implements feature engineering, versioning, and serving patterns
 */

interface Feature {
  name: string;
  type: 'categorical' | 'numerical' | 'boolean' | 'timestamp' | 'array';
  value: any;
  timestamp: Date;
  version: string;
  ttl?: number; // Time to live in seconds
}

interface FeatureGroup {
  name: string;
  features: Feature[];
  entityId: string;
  entityType: 'customer' | 'directory' | 'business' | 'global';
  lastUpdated: Date;
  schema: FeatureSchema;
}

interface FeatureSchema {
  version: string;
  features: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    validations?: any[];
  }[];
}

interface MLFeatureVector {
  entityId: string;
  features: Record<string, any>;
  timestamp: Date;
  modelVersion: string;
}

export class FeatureStoreManager {
  private featureGroups = new Map<string, FeatureGroup>();
  private featureSchemas = new Map<string, FeatureSchema>();
  private featureHistory = new Map<string, Feature[]>();
  private computedFeatures = new Map<string, any>();
  
  // Feature transformations (Netflix-style feature engineering)
  private transformations = new Map<string, (value: any) => any>();
  
  // Real-time feature computation cache
  private computationCache = new Map<string, { value: any; timestamp: Date; ttl: number }>();

  constructor() {
    this.initializeStandardFeatures();
    this.setupFeatureTransformations();
    this.startFeatureRefreshCycle();
  }

  /**
   * Register a feature group with schema validation
   */
  registerFeatureGroup(name: string, schema: FeatureSchema): void {
    this.featureSchemas.set(name, schema);
    console.log(`📊 Registered feature group: ${name} (v${schema.version})`);
  }

  /**
   * Compute and store customer features (Netflix pattern)
   */
  async computeCustomerFeatures(customerId: string): Promise<FeatureGroup> {
    const features: Feature[] = [];

    // Behavioral features
    features.push(await this.computeEngagementScore(customerId));
    features.push(await this.computeSubmissionVelocity(customerId));
    features.push(await this.computeSuccessRate(customerId));
    features.push(await this.computeChurnProbability(customerId));
    features.push(await this.computeLifetimeValue(customerId));
    
    // Temporal features
    features.push(await this.computeHourOfDayPreference(customerId));
    features.push(await this.computeDayOfWeekActivity(customerId));
    features.push(await this.computeSeasonality(customerId));
    
    // Contextual features
    features.push(await this.computeDirectoryPreferences(customerId));
    features.push(await this.computePackageUtilization(customerId));
    features.push(await this.computeSocialSignals(customerId));

    const featureGroup: FeatureGroup = {
      name: 'customer_features',
      features,
      entityId: customerId,
      entityType: 'customer',
      lastUpdated: new Date(),
      schema: this.featureSchemas.get('customer_features')!
    };

    this.featureGroups.set(`customer:${customerId}`, featureGroup);
    return featureGroup;
  }

  /**
   * Compute directory performance features (Amazon pattern)
   */
  async computeDirectoryFeatures(directoryId: string): Promise<FeatureGroup> {
    const features: Feature[] = [];

    // Performance features
    features.push(await this.computeAcceptanceRate(directoryId));
    features.push(await this.computeAverageResponseTime(directoryId));
    features.push(await this.computeQualityScore(directoryId));
    features.push(await this.computeCompetitivePosition(directoryId));
    
    // Traffic features
    features.push(await this.computeSubmissionVelocity(directoryId));
    
    // Content features

    const featureGroup: FeatureGroup = {
      name: 'directory_features',
      features,
      entityId: directoryId,
      entityType: 'directory',
      lastUpdated: new Date(),
      schema: this.featureSchemas.get('directory_features')!
    };

    this.featureGroups.set(`directory:${directoryId}`, featureGroup);
    return featureGroup;
  }

  /**
   * Get feature vector for ML inference (real-time serving)
   */
  async getFeatureVector(entityId: string, entityType: string, modelVersion: string = 'v1'): Promise<MLFeatureVector> {
    const cacheKey = `${entityType}:${entityId}:${modelVersion}`;
    
    // Check cache first
    const cached = this.computationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl * 1000) {
      return {
        entityId,
        features: cached.value,
        timestamp: cached.timestamp,
        modelVersion
      };
    }

    // Compute features based on entity type
    let featureGroup: FeatureGroup;
    switch (entityType) {
      case 'customer':
        featureGroup = await this.computeCustomerFeatures(entityId);
        break;
      case 'directory':
        featureGroup = await this.computeDirectoryFeatures(entityId);
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Transform features to ML format
    const features = this.transformToMLFormat(featureGroup, modelVersion);
    
    // Cache result
    this.computationCache.set(cacheKey, {
      value: features,
      timestamp: new Date(),
      ttl: 300 // 5 minutes
    });

    return {
      entityId,
      features,
      timestamp: new Date(),
      modelVersion
    };
  }

  /**
   * Real-time feature computation methods
   */
  private async computeEngagementScore(customerId: string): Promise<Feature> {
    // Simulate engagement score calculation
    const recentActivity = await this.getRecentActivity(customerId);
    const sessionCount = recentActivity.sessions || 0;
    const avgSessionDuration = recentActivity.avgDuration || 0;
    const pageViews = recentActivity.pageViews || 0;
    
    const engagementScore = Math.min(100, 
      (sessionCount * 0.3) + 
      (avgSessionDuration * 0.1) + 
      (pageViews * 0.05)
    );

    return {
      name: 'engagement_score',
      type: 'numerical',
      value: engagementScore,
      timestamp: new Date(),
      version: '1.0',
      ttl: 3600 // 1 hour
    };
  }

  private async computeSubmissionVelocity(customerId: string): Promise<Feature> {
    const submissions = await this.getSubmissionHistory(customerId);
    const last30Days = submissions.filter(s => 
      Date.now() - s.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000
    );
    
    const velocity = last30Days.length / 30; // submissions per day

    return {
      name: 'submission_velocity',
      type: 'numerical',
      value: velocity,
      timestamp: new Date(),
      version: '1.0',
      ttl: 7200 // 2 hours
    };
  }

  private async computeSuccessRate(customerId: string): Promise<Feature> {
    const submissions = await this.getSubmissionHistory(customerId);
    const successful = submissions.filter(s => s.status === 'accepted').length;
    const successRate = submissions.length > 0 ? successful / submissions.length : 0;

    return {
      name: 'success_rate',
      type: 'numerical',
      value: successRate,
      timestamp: new Date(),
      version: '1.0',
      ttl: 3600
    };
  }

  private async computeChurnProbability(customerId: string): Promise<Feature> {
    const profile = await this.getCustomerProfile(customerId);
    const lastActivity = profile.lastActivity || new Date(0);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
    
    // Simple churn probability model
    let churnProb = 0;
    if (daysSinceActivity > 30) churnProb += 0.3;
    if (daysSinceActivity > 60) churnProb += 0.4;
    if (daysSinceActivity > 90) churnProb += 0.3;
    
    // Factor in engagement and success rate
    const engagementFactor = Math.max(0, 1 - (profile.engagementScore || 0) / 100);
    churnProb = Math.min(1, churnProb + engagementFactor * 0.2);

    return {
      name: 'churn_probability',
      type: 'numerical',
      value: churnProb,
      timestamp: new Date(),
      version: '1.0',
      ttl: 1800 // 30 minutes
    };
  }

  private async computeLifetimeValue(customerId: string): Promise<Feature> {
    const transactions = await this.getTransactionHistory(customerId);
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avgMonthlySpend = totalSpent / Math.max(1, this.getCustomerAgeMonths(customerId));
    
    // Project LTV based on churn probability
    const churnProb = await this.computeChurnProbability(customerId);
    const expectedLifespanMonths = 1 / Math.max(0.01, churnProb.value / 12);
    const ltv = avgMonthlySpend * expectedLifespanMonths;

    return {
      name: 'lifetime_value',
      type: 'numerical',
      value: ltv,
      timestamp: new Date(),
      version: '1.0',
      ttl: 7200
    };
  }

  private async computeHourOfDayPreference(customerId: string): Promise<Feature> {
    const activities = await this.getActivityHistory(customerId);
    const hourCounts = new Array(24).fill(0);
    
    activities.forEach(activity => {
      const hour = activity.timestamp.getHours();
      hourCounts[hour]++;
    });
    
    const preferredHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      name: 'preferred_hour',
      type: 'numerical',
      value: preferredHour,
      timestamp: new Date(),
      version: '1.0',
      ttl: 86400 // 24 hours
    };
  }

  private async computeDayOfWeekActivity(customerId: string): Promise<Feature> {
    const activities = await this.getActivityHistory(customerId);
    const dayCounts = new Array(7).fill(0);
    
    activities.forEach(activity => {
      const day = activity.timestamp.getDay();
      dayCounts[day]++;
    });
    
    const mostActiveDay = dayCounts.indexOf(Math.max(...dayCounts));

    return {
      name: 'most_active_day',
      type: 'numerical',
      value: mostActiveDay,
      timestamp: new Date(),
      version: '1.0',
      ttl: 86400
    };
  }

  private async computeSeasonality(customerId: string): Promise<Feature> {
    const activities = await this.getActivityHistory(customerId);
    const monthCounts = new Array(12).fill(0);
    
    activities.forEach(activity => {
      const month = activity.timestamp.getMonth();
      monthCounts[month]++;
    });
    
    // Calculate seasonality index
    const avgActivity = monthCounts.reduce((a, b) => a + b, 0) / 12;
    const currentMonth = new Date().getMonth();
    const seasonalityIndex = monthCounts[currentMonth] / Math.max(1, avgActivity);

    return {
      name: 'seasonality_index',
      type: 'numerical',
      value: seasonalityIndex,
      timestamp: new Date(),
      version: '1.0',
      ttl: 86400
    };
  }

  // Directory feature computation methods
  private async computeAcceptanceRate(directoryId: string): Promise<Feature> {
    const submissions = await this.getDirectorySubmissions(directoryId);
    const accepted = submissions.filter(s => s.status === 'accepted').length;
    const acceptanceRate = submissions.length > 0 ? accepted / submissions.length : 0;

    return {
      name: 'acceptance_rate',
      type: 'numerical',
      value: acceptanceRate,
      timestamp: new Date(),
      version: '1.0',
      ttl: 3600
    };
  }

  private async computeAverageResponseTime(directoryId: string): Promise<Feature> {
    const submissions = await this.getDirectorySubmissions(directoryId);
    const responseTimes = submissions
      .filter(s => s.responseTime)
      .map(s => s.responseTime);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return {
      name: 'avg_response_time',
      type: 'numerical',
      value: avgResponseTime,
      timestamp: new Date(),
      version: '1.0',
      ttl: 7200
    };
  }

  private async computeQualityScore(directoryId: string): Promise<Feature> {
    const acceptanceRate = await this.computeAcceptanceRate(directoryId);
    const responseTime = await this.computeAverageResponseTime(directoryId);
    
    // Normalize response time (lower is better)
    const normalizedResponseTime = Math.max(0, 1 - responseTime.value / 86400); // 24 hours max
    
    const qualityScore = (acceptanceRate.value * 0.7) + (normalizedResponseTime * 0.3);

    return {
      name: 'quality_score',
      type: 'numerical',
      value: qualityScore,
      timestamp: new Date(),
      version: '1.0',
      ttl: 3600
    };
  }

  private async computeCompetitivePosition(directoryId: string): Promise<Feature> {
    // Simplified competitive analysis
    const directoryMetrics = await this.getDirectoryMetrics(directoryId);
    const categoryAverage = await this.getCategoryAverageMetrics(directoryMetrics.category);
    
    const relativePerformance = directoryMetrics.performance / Math.max(1, categoryAverage.performance);

    return {
      name: 'competitive_position',
      type: 'numerical',
      value: relativePerformance,
      timestamp: new Date(),
      version: '1.0',
      ttl: 7200
    };
  }

  // Additional feature computation methods
  private async computeDirectoryPreferences(customerId: string): Promise<Feature> {
    const submissions = await this.getSubmissionHistory(customerId);
    const categories = submissions.map(s => s.category);
    const categoryCount = categories.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const preferredCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'general';

    return {
      name: 'preferred_directory_category',
      type: 'categorical',
      value: preferredCategory,
      timestamp: new Date(),
      version: '1.0',
      ttl: 7200
    };
  }

  private async computePackageUtilization(customerId: string): Promise<Feature> {
    const profile = await this.getCustomerProfile(customerId);
    const packageLimit = this.getPackageLimit(profile.packageType);
    const currentUsage = profile.submissionsThisMonth || 0;
    const utilization = currentUsage / packageLimit;

    return {
      name: 'package_utilization',
      type: 'numerical',
      value: utilization,
      timestamp: new Date(),
      version: '1.0',
      ttl: 3600
    };
  }

  private async computeSocialSignals(customerId: string): Promise<Feature> {
    const profile = await this.getCustomerProfile(customerId);
    let socialScore = 0;
    
    if (profile.website) socialScore += 0.3;
    if (profile.socialMedia?.length > 0) socialScore += 0.4;
    if (profile.reviews?.length > 0) socialScore += 0.3;

    return {
      name: 'social_signals',
      type: 'numerical',
      value: socialScore,
      timestamp: new Date(),
      version: '1.0',
      ttl: 86400
    };
  }

  // Transform features to ML format
  private transformToMLFormat(featureGroup: FeatureGroup, modelVersion: string): Record<string, any> {
    const mlFeatures: Record<string, any> = {};
    
    featureGroup.features.forEach(feature => {
      const transformKey = `${feature.name}_${modelVersion}`;
      const transformation = this.transformations.get(transformKey) || 
                            this.transformations.get(feature.name) ||
                            ((x: any) => x);
      
      mlFeatures[feature.name] = transformation(feature.value);
    });

    return mlFeatures;
  }

  // Setup feature transformations
  private setupFeatureTransformations(): void {
    // Numerical transformations
    this.transformations.set('engagement_score', (value: number) => Math.log(value + 1));
    this.transformations.set('submission_velocity', (value: number) => Math.sqrt(value));
    this.transformations.set('lifetime_value', (value: number) => Math.log(value + 1));
    
    // Categorical encoding
    this.transformations.set('preferred_directory_category', (value: string) => {
      const categories = ['business', 'niche', 'premium', 'general'];
      return categories.indexOf(value);
    });
    
    // Boolean transformations
    this.transformations.set('churn_probability', (value: number) => value > 0.5 ? 1 : 0);
  }

  // Initialize standard feature schemas
  private initializeStandardFeatures(): void {
    // Customer features schema
    this.registerFeatureGroup('customer_features', {
      version: '1.0',
      features: [
        { name: 'engagement_score', type: 'numerical', required: true, description: 'Customer engagement score 0-100' },
        { name: 'submission_velocity', type: 'numerical', required: true, description: 'Submissions per day' },
        { name: 'success_rate', type: 'numerical', required: true, description: 'Submission success rate 0-1' },
        { name: 'churn_probability', type: 'numerical', required: true, description: 'Probability of churn 0-1' },
        { name: 'lifetime_value', type: 'numerical', required: true, description: 'Predicted customer LTV' },
        { name: 'preferred_hour', type: 'numerical', required: false, description: 'Preferred hour of day 0-23' },
        { name: 'most_active_day', type: 'numerical', required: false, description: 'Most active day of week 0-6' }
      ]
    });

    // Directory features schema
    this.registerFeatureGroup('directory_features', {
      version: '1.0',
      features: [
        { name: 'acceptance_rate', type: 'numerical', required: true, description: 'Directory acceptance rate 0-1' },
        { name: 'avg_response_time', type: 'numerical', required: true, description: 'Average response time in seconds' },
        { name: 'quality_score', type: 'numerical', required: true, description: 'Overall quality score 0-1' },
        { name: 'competitive_position', type: 'numerical', required: true, description: 'Relative performance vs category average' }
      ]
    });
  }

  // Start feature refresh cycle
  private startFeatureRefreshCycle(): void {
    setInterval(() => {
      this.refreshExpiredFeatures();
    }, 60000); // Every minute
  }

  private refreshExpiredFeatures(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.computationCache.entries()) {
      if (now - cached.timestamp.getTime() > cached.ttl * 1000) {
        this.computationCache.delete(key);
      }
    }
  }

  // Data access methods (these would connect to your actual data sources)
  private async getRecentActivity(customerId: string): Promise<any> {
    // Mock implementation - replace with actual data access
    return {
      sessions: Math.floor(Math.random() * 10),
      avgDuration: Math.floor(Math.random() * 600),
      pageViews: Math.floor(Math.random() * 50)
    };
  }

  private async getSubmissionHistory(customerId: string): Promise<any[]> {
    // Mock implementation
    return [];
  }

  private async getTransactionHistory(customerId: string): Promise<any[]> {
    // Mock implementation
    return [];
  }

  private async getCustomerProfile(customerId: string): Promise<any> {
    // Mock implementation
    return {
      packageType: 'starter',
      lastActivity: new Date(),
      submissionsThisMonth: Math.floor(Math.random() * 50)
    };
  }

  private async getActivityHistory(customerId: string): Promise<any[]> {
    // Mock implementation
    return [];
  }

  private async getDirectorySubmissions(directoryId: string): Promise<any[]> {
    // Mock implementation
    return [];
  }

  private async getDirectoryMetrics(directoryId: string): Promise<any> {
    // Mock implementation
    return { category: 'business', performance: Math.random() };
  }

  private async getCategoryAverageMetrics(category: string): Promise<any> {
    // Mock implementation
    return { performance: 0.7 };
  }

  private getCustomerAgeMonths(customerId: string): number {
    // Mock implementation
    return 12;
  }

  private getPackageLimit(packageType: string): number {
    const limits: Record<string, number> = {
      starter: 50,
      growth: 75,
      professional: 150,
      enterprise: 500
    };
    return limits[packageType] || 50;
  }

  /**
   * Get all features for an entity
   */
  getFeatures(entityType: string, entityId: string): FeatureGroup | null {
    return this.featureGroups.get(`${entityType}:${entityId}`) || null;
  }

  /**
   * Get feature history for analysis
   */
  getFeatureHistory(featureName: string): Feature[] {
    return this.featureHistory.get(featureName) || [];
  }

  /**
   * Clear cache and reset
   */
  clearCache(): void {
    this.computationCache.clear();
    this.featureGroups.clear();
    console.log('🧹 Feature store cache cleared');
  }
}

export default FeatureStoreManager;
