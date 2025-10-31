import React from "react";
import { ActivityFeedItem } from "../types/processing.types";

interface ActivityFeedProps {
  activities: ActivityFeedItem[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const getStatusColor = (
    status: "success" | "failed" | "processing" | "started",
  ) => {
    switch (status) {
      case "success":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      case "processing":
        return "text-volt-400";
      case "started":
        return "text-blue-400";
      default:
        return "text-secondary-400";
    }
  };

  const getStatusIcon = (
    status: "success" | "failed" | "processing" | "started",
  ) => {
    switch (status) {
      case "success":
        return "✅";
      case "failed":
        return "❌";
      case "processing":
        return "🔄";
      case "started":
        return "🚀";
      default:
        return "📝";
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (activities.length === 0) {
    return (
      <div className="bg-secondary-800 border border-secondary-700 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">📭</div>
        <h4 className="text-lg font-bold text-white mb-2">
          No Recent Activity
        </h4>
        <p className="text-secondary-300">
          Processing activity will appear here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-secondary-800 border border-secondary-700 rounded-xl p-6">
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start space-x-3 p-3 bg-secondary-900/30 rounded-lg border border-secondary-700/50 hover:bg-secondary-900/50 transition-colors"
          >
            {/* Time */}
            <div className="text-secondary-400 text-sm font-mono min-w-[4rem] text-right">
              {formatTime(activity.timestamp)}
            </div>

            {/* Status Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <span className="text-lg">{getStatusIcon(activity.status)}</span>
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-secondary-300 font-mono text-sm">
                  {activity.customerId}
                </span>
                <span className="text-secondary-500">→</span>
                <span className="text-white font-medium">
                  {activity.directoryName}
                </span>
                <span
                  className={`font-medium ${getStatusColor(activity.status)}`}
                >
                  {activity.status}
                </span>
              </div>

              {activity.message && (
                <div className="text-secondary-300 text-sm mt-1 truncate">
                  {activity.message}
                </div>
              )}
            </div>

            {/* Processing indicator for active items */}
            {activity.status === "processing" && (
              <div className="flex-shrink-0">
                <div className="animate-spin rounded-full h-3 w-3 border border-volt-500 border-t-transparent"></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Auto-refresh indicator */}
      <div className="mt-4 pt-3 border-t border-secondary-700 flex items-center justify-between text-xs">
        <span className="text-secondary-400">
          Showing last {activities.length} activities
        </span>
        <div className="flex items-center space-x-1">
          <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-secondary-400">Live updates</span>
        </div>
      </div>
    </div>
  );
}
