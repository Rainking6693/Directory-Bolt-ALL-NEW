// Alert system related TypeScript types for Staff Dashboard

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface ManualInterventionAlert {
  id: string;
  customerId: string;
  businessName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  failedDirectories?: string[];
  recommendedActions: RecommendedAction[];
  createdAt: string;
  lastUpdatedAt: string;
  assignedTo?: string;
  resolutionNotes?: string;
}

export interface RecommendedAction {
  id: string;
  label: string;
  actionType: "retry" | "contact" | "skip" | "escalate" | "review";
  successProbability?: "high" | "medium" | "low";
  estimatedTime?: string;
  requiresApproval?: boolean;
}

export interface AlertAction {
  alertId: string;
  actionType:
    | "retry"
    | "contact"
    | "skip"
    | "escalate"
    | "acknowledge"
    | "resolve";
  notes?: string;
  customData?: Record<string, any>;
}

export interface AlertFilters {
  severity?: AlertSeverity[];
  status?: AlertStatus[];
  dateRange?: {
    start: string;
    end: string;
  };
  assignedTo?: string[];
}

export interface AlertStats {
  totalActive: number;
  bySeverity: Record<AlertSeverity, number>;
  byStatus: Record<AlertStatus, number>;
  avgResolutionTime: number; // in minutes
  escalationRate: number;
}
