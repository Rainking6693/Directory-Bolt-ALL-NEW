import React, { useState, useEffect } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import SuccessFailureChart from "./SuccessFailureChart";
import { AnalyticsDashboardData } from "../types/analytics.types";

export default function CompletionReports() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [dashboardData, setDashboardData] = useState<AnalyticsDashboardData>({
    metrics: {
      totalProcessed: 156,
      successRate: 94.2,
      avgTimePerCustomer: 47,
      revenueGenerated: 12847,
      failedJobs: 9,
      processingHours: 24.5,
    },
    packageDistribution: {
      PRO: { count: 70, percentage: 45 },
      GROWTH: { count: 55, percentage: 35 },
      STARTER: { count: 31, percentage: 20 },
    },
    directoryPerformance: [
      {
        directoryName: "Google My Business",
        totalSubmissions: 523,
        successRate: 98.2,
      },
      {
        directoryName: "LinkedIn Company",
        totalSubmissions: 489,
        successRate: 96.7,
      },
      {
        directoryName: "Facebook Business",
        totalSubmissions: 445,
        successRate: 94.1,
      },
      { directoryName: "Yelp", totalSubmissions: 234, successRate: 67.3 },
      {
        directoryName: "Yellow Pages",
        totalSubmissions: 198,
        successRate: 71.2,
      },
      { directoryName: "Local.com", totalSubmissions: 167, successRate: 89.2 },
      { directoryName: "CitySearch", totalSubmissions: 143, successRate: 82.5 },
      { directoryName: "MapQuest", totalSubmissions: 132, successRate: 91.8 },
    ],
    failureAnalysis: [
      {
        reason: "Captcha Required",
        count: 89,
        percentage: 28,
        trend: "increasing",
      },
      { reason: "Login Required", count: 60, percentage: 19, trend: "stable" },
      {
        reason: "Form Structure Changes",
        count: 51,
        percentage: 16,
        trend: "decreasing",
      },
      {
        reason: "Site Down/Maintenance",
        count: 38,
        percentage: 12,
        trend: "stable",
      },
      {
        reason: "Duplicate Listing",
        count: 79,
        percentage: 25,
        trend: "decreasing",
      },
    ],
    timeRange: {
      label: "Today",
      start: new Date().toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    },
    lastUpdated: new Date().toISOString(),
  });

  const [isLoading, setIsLoading] = useState(false);

  // Simulate data refresh
  const refreshData = async () => {
    setIsLoading(true);
    // In a real app, this would fetch from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const totalSubmissions = dashboardData.directoryPerformance.reduce(
    (sum, dir) => sum + dir.totalSubmissions,
    0,
  );
  const totalSuccessful = dashboardData.directoryPerformance.reduce(
    (sum, dir) =>
      sum + Math.floor(dir.totalSubmissions * (dir.successRate / 100)),
    0,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Dashboard */}
      <AnalyticsDashboard
        metrics={dashboardData.metrics}
        packageDistribution={dashboardData.packageDistribution}
        directoryPerformance={dashboardData.directoryPerformance}
        onExport={handleExport}
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
      />

      {/* Success/Failure Analysis */}
      <SuccessFailureChart
        failureAnalysis={dashboardData.failureAnalysis}
        totalSubmissions={totalSubmissions}
        successfulSubmissions={totalSuccessful}
      />

      {/* Data Refresh Info */}
      <div className="text-center text-secondary-400 text-sm">
        Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
        <button
          onClick={refreshData}
          className="ml-3 text-volt-400 hover:text-volt-300 font-medium"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
