import React from "react";
import ActiveJobs from "./ActiveJobs";
import SystemHealth from "./SystemHealth";
import ActivityFeed from "./ActivityFeed";
import {
  ProcessingJob,
  SystemHealth as SystemHealthType,
  ActivityFeedItem,
} from "../types/processing.types";

interface LiveDashboardProps {
  activeJobs: ProcessingJob[];
  systemHealth: SystemHealthType;
  activityFeed: ActivityFeedItem[];
  isConnected: boolean;
}

export default function LiveDashboard({
  activeJobs,
  systemHealth,
  activityFeed,
  isConnected,
}: LiveDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          📊 LIVE PROCESSING STATUS
        </h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-volt-500"
            }`}
          ></div>
          <span className="text-secondary-300 text-sm font-medium">
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Active Jobs Section */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          🔄 Active Jobs ({activeJobs.length})
        </h3>
        {activeJobs.length > 0 ? (
          <ActiveJobs jobs={activeJobs} />
        ) : (
          <div className="bg-secondary-800/50 border border-secondary-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">😴</div>
            <h4 className="text-lg font-bold text-white mb-2">
              No Active Processing
            </h4>
            <p className="text-secondary-300">
              All processing tasks are complete. Queue is ready for new jobs.
            </p>
          </div>
        )}
      </div>

      {/* System Health Section */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          🔧 System Performance
        </h3>
        <SystemHealth health={systemHealth} />
      </div>

      {/* Activity Feed Section */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          📝 Recent Activity Feed
        </h3>
        <ActivityFeed activities={activityFeed} />
      </div>
    </div>
  );
}
