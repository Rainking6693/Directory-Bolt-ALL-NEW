// Queue related TypeScript types for Staff Dashboard

export interface QueueStats {
  pending: number;
  processing: number;
  completedToday: number;
  totalRevenue: number;
  averageWaitTime: number;
  successRate: number;
  highPriority: number;
  todaysGoal: number;
  todaysCompleted: number;
}

export interface QueueCustomer {
  customerId: string;
  businessName: string;
  email: string;
  packageType: "STARTER" | "GROWTH" | "PRO";
  directoryLimit: number;
  priority: number;
  waitTime: number; // in hours
  submissionStatus: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  purchaseDate: string;
  website: string;
}

export interface QueueData {
  stats: QueueStats;
  customers: QueueCustomer[];
  isProcessing: boolean;
  nextCustomer: QueueCustomer | null;
  lastUpdated: string;
}

export interface QueueItemActions {
  onProcessNow: (customerId: string) => void;
  onViewDetails: (customerId: string) => void;
  onContact: (customerId: string) => void;
}

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}
