// Analytics related TypeScript types for Staff Dashboard

export interface AnalyticsMetrics {
  totalProcessed: number;
  successRate: number;
  avgTimePerCustomer: number; // in minutes
  revenueGenerated: number;
  failedJobs: number;
  processingHours: number;
}

export interface PackageDistribution {
  PRO: { count: number; percentage: number };
  GROWTH: { count: number; percentage: number };
  STARTER: { count: number; percentage: number };
}

export interface DirectoryPerformance {
  directoryName: string;
  totalSubmissions: number;
  successRate: number;
  avgResponseTime?: number;
  commonFailureReasons?: string[];
}

export interface FailureAnalysis {
  reason: string;
  count: number;
  percentage: number;
  trend: "increasing" | "decreasing" | "stable";
}

export interface TimeRangeData {
  label: string;
  start: string;
  end: string;
}

export interface ExportConfiguration {
  dateRange: {
    start: string;
    end: string;
  };
  includeData: {
    customerInfo: boolean;
    processingResults: boolean;
    directoryDetails: boolean;
    timingInfo: boolean;
    revenueData: boolean;
    processingLogs: boolean;
  };
  format: "CSV" | "Excel" | "JSON";
}

export interface AnalyticsDashboardData {
  metrics: AnalyticsMetrics;
  packageDistribution: PackageDistribution;
  directoryPerformance: DirectoryPerformance[];
  failureAnalysis: FailureAnalysis[];
  timeRange: TimeRangeData;
  lastUpdated: string;
}
