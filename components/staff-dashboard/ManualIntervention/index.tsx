import React from "react";
import { useAlerts } from "../../../contexts/AlertContext";

export default function ManualIntervention() {
  const { alerts, activeAlertsCount, criticalAlertsCount } = useAlerts();

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {activeAlertsCount > 0 && (
        <div className="bg-red-600/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚨</span>
              <span className="text-red-300 font-medium">
                {criticalAlertsCount} critical alert
                {criticalAlertsCount !== 1 ? "s" : ""} need
                {criticalAlertsCount === 1 ? "s" : ""} immediate attention
              </span>
            </div>
            <div className="flex space-x-2">
              <button className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm font-medium transition-colors">
                🔥 View Critical
              </button>
              <button className="border border-red-500 hover:border-red-400 text-red-300 hover:text-red-200 px-3 py-1 rounded text-sm font-medium transition-colors">
                📋 View All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts
          .filter((alert) => alert.status === "active")
          .map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 ${
                alert.severity === "critical"
                  ? "bg-red-600/10 border-red-500"
                  : alert.severity === "warning"
                    ? "bg-volt-600/10 border-volt-500"
                    : "bg-blue-600/10 border-blue-500"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xl">
                      {alert.severity === "critical"
                        ? "🚨"
                        : alert.severity === "warning"
                          ? "⚠️"
                          : "ℹ️"}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        alert.severity === "critical"
                          ? "bg-red-600 text-white"
                          : alert.severity === "warning"
                            ? "bg-volt-600 text-white"
                            : "bg-blue-600 text-white"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-secondary-300 text-sm">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <h4 className="text-white font-bold mb-1">
                    {alert.customerId} • {alert.businessName}
                  </h4>
                  <p className="text-secondary-300 text-sm mb-3">
                    {alert.description}
                  </p>

                  {alert.failedDirectories &&
                    alert.failedDirectories.length > 0 && (
                      <div className="mb-3">
                        <div className="text-secondary-400 text-xs mb-1">
                          Failed Directories:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {alert.failedDirectories.map((dir, i) => (
                            <span
                              key={i}
                              className="bg-red-600/20 text-red-300 px-2 py-1 rounded text-xs"
                            >
                              {dir}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 mt-4">
                {alert.recommendedActions.map((action) => (
                  <button
                    key={action.id}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      action.actionType === "retry"
                        ? "bg-volt-600 hover:bg-volt-500 text-secondary-900"
                        : action.actionType === "contact"
                          ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : action.actionType === "skip"
                            ? "bg-orange-600 hover:bg-orange-500 text-white"
                            : "border border-secondary-600 hover:border-secondary-500 text-secondary-300 hover:text-white"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      {activeAlertsCount === 0 && (
        <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-white mb-2">
            No Active Alerts
          </h3>
          <p className="text-secondary-300">
            All processing is running smoothly. Great work!
          </p>
        </div>
      )}
    </div>
  );
}
