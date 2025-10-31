import React from "react";
import {
  AnalyticsMetrics,
  PackageDistribution,
  DirectoryPerformance,
} from "../types/analytics.types";
import ExportModal from "./ExportModal";

interface AnalyticsDashboardProps {
  metrics: AnalyticsMetrics;
  packageDistribution: PackageDistribution;
  directoryPerformance: DirectoryPerformance[];
  onExport: () => void;
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
}

export default function AnalyticsDashboard({
  metrics,
  packageDistribution,
  directoryPerformance,
  onExport,
  showExportModal,
  setShowExportModal,
}: AnalyticsDashboardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          📈 ANALYTICS & REPORTS
        </h2>

        <div className="flex items-center space-x-3">
          <select className="bg-secondary-800 border border-secondary-600 text-white px-3 py-2 rounded-lg text-sm">
            <option value="today">📅 Today</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </select>

          <button
            onClick={onExport}
            className="bg-volt-600 hover:bg-volt-500 text-secondary-900 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-2"
          >
            <span>📊</span>
            <span>CSV⬇️</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
          <div className="text-3xl font-bold text-white">
            {metrics.totalProcessed}
          </div>
          <div className="text-secondary-400 text-sm uppercase tracking-wide mt-1">
            Total Processed
          </div>
        </div>

        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
          <div className="text-3xl font-bold text-green-400">
            {metrics.successRate}%
          </div>
          <div className="text-secondary-400 text-sm uppercase tracking-wide mt-1">
            Success Rate
          </div>
        </div>

        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
          <div className="text-3xl font-bold text-blue-400">
            {formatTime(metrics.avgTimePerCustomer)}
          </div>
          <div className="text-secondary-400 text-sm uppercase tracking-wide mt-1">
            Avg Time/Customer
          </div>
        </div>

        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
          <div className="text-3xl font-bold text-volt-400">
            {formatCurrency(metrics.revenueGenerated)}
          </div>
          <div className="text-secondary-400 text-sm uppercase tracking-wide mt-1">
            Revenue Generated
          </div>
        </div>

        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
          <div className="text-3xl font-bold text-red-400">
            {metrics.failedJobs}
          </div>
          <div className="text-secondary-400 text-sm uppercase tracking-wide mt-1">
            Failed Jobs
          </div>
        </div>

        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 text-center">
          <div className="text-3xl font-bold text-orange-400">
            {formatTime(metrics.processingHours * 60)}
          </div>
          <div className="text-secondary-400 text-sm uppercase tracking-wide mt-1">
            Processing Hours
          </div>
        </div>
      </div>

      {/* Processing Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Package Distribution */}
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            📦 Package Distribution
          </h3>

          <div className="space-y-4">
            {Object.entries(packageDistribution).map(([pkg, data]) => (
              <div key={pkg} className="flex items-center">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">{pkg}</span>
                    <span className="text-secondary-300 text-sm">
                      {data.percentage}% ({data.count})
                    </span>
                  </div>
                  <div className="w-full bg-secondary-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        pkg === "PRO"
                          ? "bg-purple-600"
                          : pkg === "GROWTH"
                            ? "bg-orange-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${data.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directory Success Rates */}
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            🎯 Directory Success Rates
          </h3>

          <div className="space-y-3">
            {directoryPerformance.slice(0, 6).map((directory, index) => (
              <div
                key={directory.directoryName}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-white font-medium">
                    {directory.directoryName}
                  </span>
                  <span className="text-secondary-400 text-sm">
                    ({directory.totalSubmissions.toLocaleString()} submissions)
                  </span>
                </div>
                <div
                  className={`font-bold ${
                    directory.successRate >= 95
                      ? "text-green-400"
                      : directory.successRate >= 85
                        ? "text-volt-400"
                        : "text-red-400"
                  }`}
                >
                  {directory.successRate}%
                </div>
              </div>
            ))}
          </div>

          {directoryPerformance.length > 6 && (
            <button className="mt-4 text-volt-400 hover:text-volt-300 text-sm font-medium">
              View all {directoryPerformance.length} directories →
            </button>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={(config) => {
            console.log("Export configuration:", config);
            // Handle export logic here
            setShowExportModal(false);
          }}
        />
      )}
    </div>
  );
}
