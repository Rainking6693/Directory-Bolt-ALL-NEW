/**
 * Axiom Observability Integration
 * Advanced observability and logging solution for DirectoryBolt
 * Implements AI-powered monitoring, tracing, and analytics
 */

interface AxiomEvent {
  _time: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  service: string;
  version: string;
  environment: string;
  userId?: string;
  customerId?: string;
  traceId?: string;
  spanId?: string;
  duration?: number;
  metadata: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

interface BusinessMetric {
  metric: string;
  value: number;
  dimensions: Record<string, string>;
  timestamp: string;
}

export class AxiomObservability {
  private apiToken: string;
  private orgId: string;
  private dataset: string;
  private baseURL = 'https://api.axiom.co';
  private batchEvents: AxiomEvent[] = [];
  private batchSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.apiToken = process.env.AXIOM_API_TOKEN || '';
    this.orgId = process.env.AXIOM_ORG_ID || '';
    this.dataset = process.env.AXIOM_DATASET || 'directorybolt-logs';
    
    if (!this.apiToken || !this.orgId) {
      console.warn('⚠️ Axiom configuration missing. Observability features will be limited.');
    }

    this.startBatchProcessor();
  }

  /**
   * Log application events with structured data
   */
  async log(level: AxiomEvent['level'], message: string, metadata: Record<string, any> = {}): Promise<void> {
    const event: AxiomEvent = {
      _time: new Date().toISOString(),
      level,
      message,
      service: 'directorybolt',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      traceId: this.generateTraceId(),
      metadata
    };

    this.addEventToBatch(event);
  }

  /**
   * Track performance metrics with automatic APM
   */
  async trackPerformance(name: string, value: number, unit: string, tags: Record<string, string> = {}): Promise<void> {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags: {
        service: 'directorybolt',
        environment: process.env.NODE_ENV || 'development',
        ...tags
      }
    };

    await this.log('info', `Performance metric: ${name}`, {
      metric_type: 'performance',
      metric_name: name,
      metric_value: value,
      metric_unit: unit,
      metric_tags: tags
    });
  }

  /**
   * Track business metrics and KPIs
   */
  async trackBusinessMetric(metric: string, value: number, dimensions: Record<string, string> = {}): Promise<void> {
    const businessMetric: BusinessMetric = {
      metric,
      value,
      dimensions: {
        service: 'directorybolt',
        ...dimensions
      },
      timestamp: new Date().toISOString()
    };

    await this.log('info', `Business metric: ${metric}`, {
      metric_type: 'business',
      metric_name: metric,
      metric_value: value,
      dimensions
    });
  }

  /**
   * Trace function execution with automatic timing
   */
  async trace<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    const startTime = Date.now();

    await this.log('debug', `Starting operation: ${operation}`, {
      trace_type: 'start',
      trace_id: traceId,
      span_id: spanId,
      operation,
      ...metadata
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      await this.log('debug', `Completed operation: ${operation}`, {
        trace_type: 'complete',
        trace_id: traceId,
        span_id: spanId,
        operation,
        duration_ms: duration,
        status: 'success',
        ...metadata
      });

      await this.trackPerformance(`operation.${operation}.duration`, duration, 'ms', {
        status: 'success'
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.log('error', `Failed operation: ${operation}`, {
        trace_type: 'error',
        trace_id: traceId,
        span_id: spanId,
        operation,
        duration_ms: duration,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        ...metadata
      });

      await this.trackPerformance(`operation.${operation}.duration`, duration, 'ms', {
        status: 'error'
      });

      throw error;
    }
  }

  /**
   * Track customer journey and behavior
   */
  async trackCustomerEvent(
    customerId: string,
    event: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.log('info', `Customer event: ${event}`, {
      event_type: 'customer_behavior',
      customer_id: customerId,
      event_name: event,
      properties,
      user_agent: properties.userAgent,
      ip_address: properties.ipAddress,
      session_id: properties.sessionId
    });

    // Track business metrics based on customer events
    switch (event) {
      case 'submission_created':
        await this.trackBusinessMetric('submissions.created', 1, {
          customer_id: customerId,
          package_type: properties.packageType
        });
        break;
      case 'payment_completed':
        await this.trackBusinessMetric('revenue.generated', properties.amount || 0, {
          customer_id: customerId,
          payment_method: properties.paymentMethod
        });
        break;
      case 'customer_churn':
        await this.trackBusinessMetric('customers.churned', 1, {
          customer_id: customerId,
          churn_reason: properties.reason
        });
        break;
    }
  }

  /**
   * Monitor API endpoints automatically
   */
  createAPIMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const traceId = this.generateTraceId();
      
      // Add trace ID to request for downstream use
      req.traceId = traceId;

      const originalEnd = res.end;
      res.end = (...args: any[]) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        this.log(statusCode >= 400 ? 'error' : 'info', `API Request: ${req.method} ${req.path}`, {
          event_type: 'api_request',
          trace_id: traceId,
          method: req.method,
          path: req.path,
          status_code: statusCode,
          duration_ms: duration,
          user_agent: req.headers['user-agent'],
          ip_address: req.ip || req.connection.remoteAddress,
          query_params: req.query,
          customer_id: req.headers['x-customer-id'],
          request_size: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0
        });

        this.trackPerformance(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}`, duration, 'ms', {
          status_code: statusCode.toString(),
          method: req.method
        });

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Monitor database operations
   */
  async trackDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected: number = 0,
    error?: Error
  ): Promise<void> {
    await this.log(error ? 'error' : 'debug', `Database operation: ${operation} on ${table}`, {
      event_type: 'database_operation',
      operation,
      table,
      duration_ms: duration,
      rows_affected: rowsAffected,
      status: error ? 'error' : 'success',
      error_message: error?.message,
      error_stack: error?.stack
    });

    await this.trackPerformance(`database.${operation}.${table}`, duration, 'ms', {
      status: error ? 'error' : 'success',
      operation,
      table
    });
  }

  /**
   * Security event monitoring
   */
  async trackSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ): Promise<void> {
    await this.log('warn', `Security event: ${event}`, {
      event_type: 'security',
      security_event: event,
      severity,
      ip_address: details.ipAddress,
      user_agent: details.userAgent,
      customer_id: details.customerId,
      attempted_action: details.action,
      risk_score: details.riskScore,
      ...details
    });

    // Alert for high severity events
    if (severity === 'critical' || severity === 'high') {
      await this.sendAlert({
        title: `Security Alert: ${event}`,
        message: `High severity security event detected`,
        severity,
        details
      });
    }
  }

  /**
   * Application health monitoring
   */
  async trackHealthMetrics(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    await this.trackPerformance('system.memory.heap_used', memoryUsage.heapUsed / 1024 / 1024, 'MB');
    await this.trackPerformance('system.memory.heap_total', memoryUsage.heapTotal / 1024 / 1024, 'MB');
    await this.trackPerformance('system.memory.external', memoryUsage.external / 1024 / 1024, 'MB');
    await this.trackPerformance('system.cpu.user', cpuUsage.user / 1000, 'ms');
    await this.trackPerformance('system.cpu.system', cpuUsage.system / 1000, 'ms');

    // Track uptime
    await this.trackPerformance('system.uptime', process.uptime(), 'seconds');
  }

  /**
   * Error tracking with context
   */
  async trackError(
    error: Error,
    context: Record<string, any> = {},
    customerId?: string
  ): Promise<void> {
    await this.log('error', error.message, {
      event_type: 'error',
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      customer_id: customerId,
      ...context
    });

    // Track error rate metric
    await this.trackBusinessMetric('errors.count', 1, {
      error_type: error.name,
      service: 'directorybolt'
    });
  }

  /**
   * AI-powered query suggestions (using Axiom's natural language features)
   */
  async suggestQueries(description: string): Promise<string[]> {
    if (!this.apiToken) {
      return ['Event logs data analysis queries not available without Axiom configuration'];
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/datasets/${this.dataset}/ai/suggest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description,
          timerange: '24h'
        })
      });

      if (!response.ok) {
        throw new Error(`Axiom AI query suggestion failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.queries || [];
    } catch (error) {
      console.error('Failed to get AI query suggestions:', error);
      return [];
    }
  }

  /**
   * Generate dashboard from natural language
   */
  async generateDashboard(description: string): Promise<any> {
    if (!this.apiToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/datasets/${this.dataset}/ai/dashboard`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description,
          timerange: '7d'
        })
      });

      if (!response.ok) {
        throw new Error(`Dashboard generation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to generate dashboard:', error);
      return null;
    }
  }

  /**
   * Query logs with APL (Axiom Processing Language)
   */
  async query(aplQuery: string, timeRange: string = '24h'): Promise<any> {
    if (!this.apiToken) {
      throw new Error('Axiom API token not configured');
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/datasets/${this.dataset}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apl: aplQuery,
          startTime: this.getTimeRangeStart(timeRange),
          endTime: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Axiom query failed:', error);
      throw error;
    }
  }

  /**
   * Get real-time alerts and anomalies
   */
  async getAlerts(): Promise<any[]> {
    if (!this.apiToken) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/orgs/${this.orgId}/alerts`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.statusText}`);
      }

      const result = await response.json();
      return result.alerts || [];
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      return [];
    }
  }

  // Private helper methods
  private addEventToBatch(event: AxiomEvent): void {
    this.batchEvents.push(event);

    if (this.batchEvents.length >= this.batchSize) {
      this.flushBatch();
    }
  }

  private startBatchProcessor(): void {
    this.flushTimer = setInterval(() => {
      if (this.batchEvents.length > 0) {
        this.flushBatch();
      }
    }, this.flushInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchEvents.length === 0 || !this.apiToken) {
      return;
    }

    const events = [...this.batchEvents];
    this.batchEvents = [];

    try {
      const response = await fetch(`${this.baseURL}/v1/datasets/${this.dataset}/ingest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(events)
      });

      if (!response.ok) {
        console.error(`Failed to send events to Axiom: ${response.statusText}`);
        // Re-add events to batch for retry
        this.batchEvents.unshift(...events);
      }
    } catch (error) {
      console.error('Failed to send events to Axiom:', error);
      // Re-add events to batch for retry
      this.batchEvents.unshift(...events);
    }
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getTimeRangeStart(timeRange: string): string {
    const now = new Date();
    const ranges: Record<string, number> = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const milliseconds = ranges[timeRange] || ranges['24h'];
    return new Date(now.getTime() - milliseconds).toISOString();
  }

  private async sendAlert(alert: {
    title: string;
    message: string;
    severity: string;
    details: Record<string, any>;
  }): Promise<void> {
    // Implementation depends on your alerting system
    // Could integrate with Slack, PagerDuty, email, etc.
    console.warn(`🚨 ALERT [${alert.severity}]: ${alert.title} - ${alert.message}`);
  }

  /**
   * Get observability insights and recommendations
   */
  async getInsights(): Promise<{
    performance: any;
    errors: any;
    business: any;
    recommendations: string[];
  }> {
    const insights = {
      performance: await this.getPerformanceInsights(),
      errors: await this.getErrorInsights(),
      business: await this.getBusinessInsights(),
      recommendations: await this.getRecommendations()
    };

    return insights;
  }

  private async getPerformanceInsights(): Promise<any> {
    const query = `
      ['directorybolt-logs']
      | where event_type == "api_request"
      | summarize 
        avg_duration = avg(duration_ms),
        p95_duration = percentile(duration_ms, 95),
        error_rate = countif(status_code >= 400) / count() * 100
      by bin(_time, 1h)
    `;

    try {
      return await this.query(query, '24h');
    } catch (error) {
      return { avg_duration: 0, p95_duration: 0, error_rate: 0 };
    }
  }

  private async getErrorInsights(): Promise<any> {
    const query = `
      ['directorybolt-logs']
      | where level == "error"
      | summarize count = count() by error_name
      | sort by count desc
      | take 10
    `;

    try {
      return await this.query(query, '24h');
    } catch (error) {
      return [];
    }
  }

  private async getBusinessInsights(): Promise<any> {
    const query = `
      ['directorybolt-logs']
      | where event_type == "customer_behavior"
      | summarize 
        total_submissions = countif(event_name == "submission_created"),
        total_revenue = sumif(properties.amount, event_name == "payment_completed"),
        unique_customers = dcount(customer_id)
      by bin(_time, 1d)
    `;

    try {
      return await this.query(query, '7d');
    } catch (error) {
      return { total_submissions: 0, total_revenue: 0, unique_customers: 0 };
    }
  }

  private async getRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Get recent performance data to generate recommendations
    try {
      const performanceData = await this.getPerformanceInsights();
      
      if (performanceData.avg_duration > 1000) {
        recommendations.push('Consider optimizing API response times - average duration exceeds 1 second');
      }
      
      if (performanceData.error_rate > 5) {
        recommendations.push('High error rate detected - investigate error patterns and implement better error handling');
      }
      
      recommendations.push('Set up automated alerts for critical performance thresholds');
      recommendations.push('Consider implementing caching for frequently accessed data');
      
    } catch (error) {
      recommendations.push('Configure Axiom API token to enable advanced insights and recommendations');
    }

    return recommendations;
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush remaining events
    if (this.batchEvents.length > 0) {
      this.flushBatch();
    }
  }
}

export default AxiomObservability;
