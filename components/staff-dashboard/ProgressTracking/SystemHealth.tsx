import React from "react";
import { SystemHealth as SystemHealthType } from "../types/processing.types";

interface SystemHealthProps {
  health: SystemHealthType;
}

export default function SystemHealth({ health }: SystemHealthProps) {
  const getStatusColor = (status: "operational" | "degraded" | "down") => {
    switch (status) {
      case "operational":
        return "text-green-400";
      case "degraded":
        return "text-volt-400";
      case "down":
        return "text-red-400";
      default:
        return "text-secondary-400";
    }
  };

  const getStatusIcon = (status: "operational" | "degraded" | "down") => {
    switch (status) {
      case "operational":
        return "✅";
      case "degraded":
        return "⚠️";
      case "down":
        return "❌";
      default:
        return "❓";
    }
  };

  const getStatusText = (status: "operational" | "degraded" | "down") => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "down":
        return "Down";
      default:
        return "Unknown";
    }
  };

  // Calculate processing speed per minute
  const processingSpeedPerMin =
    Math.round((health.processingCapacity * 60) / 100) / 10;

  // Mock performance metrics (in a real app, these would come from the API)
  const performanceMetrics = [
    {
      label: "Processing Speed",
      value: `${processingSpeedPerMin} dirs/min`,
      icon: "⚡",
      color: "text-volt-400",
    },
    {
      label: "Success Rate",
      value: "94.2%",
      icon: "🎯",
      color: "text-green-400",
    },
    { label: "Error Rate", value: "5.8%", icon: "🚨", color: "text-red-400" },
    {
      label: "Queue Depth",
      value: `${health.queueDepth} pending`,
      icon: "📊",
      color: "text-blue-400",
    },
  ];

  return (
    <div className="bg-secondary-800 border border-secondary-700 rounded-xl p-6">
      {/* Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {performanceMetrics.map((metric, index) => (
          <div key={index} className="text-center">
            <div className="text-2xl mb-1">{metric.icon}</div>
            <div className={`text-lg font-bold ${metric.color}`}>
              {metric.value}
            </div>
            <div className="text-xs text-secondary-400 uppercase tracking-wide">
              {metric.label}
            </div>
          </div>
        ))}
      </div>

      {/* API Health Status */}
      <div>
        <h4 className="text-white font-bold mb-3 flex items-center">
          🌐 API Health Status
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(health.apiStatus).map(([api, status]) => (
            <div
              key={api}
              className="flex items-center justify-between p-3 bg-secondary-900/50 rounded-lg border border-secondary-700"
            >
              <div className="flex items-center space-x-2">
                <span>{getStatusIcon(status)}</span>
                <span className="text-white font-medium">{api}</span>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(status)}`}>
                {getStatusText(status)}
              </span>
            </div>
          ))}
        </div>

        {/* Overall Status */}
        <div className="mt-4 p-3 bg-green-600/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-400 text-xl">🌟</span>
              <span className="text-green-300 font-medium">
                All systems operational
              </span>
            </div>
            <div className="text-secondary-400 text-sm">
              Last checked:{" "}
              {new Date(health.lastHealthCheck).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
