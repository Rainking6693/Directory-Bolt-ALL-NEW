import React from "react";
import { QueueStats } from "../types/queue.types";

interface QueueHeaderProps {
  stats: QueueStats;
  isConnected: boolean;
}

export default function QueueHeader({ stats, isConnected }: QueueHeaderProps) {
  return (
    <div className="bg-secondary-800 border-b border-secondary-700 p-6 rounded-t-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white flex items-center">
          📊 Customer Queue
        </h2>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-volt-500"
              }`}
            ></div>
            <span className="text-secondary-300 text-sm">
              {isConnected ? "Live Updates" : "Reconnecting..."}
            </span>
          </div>

          <div className="bg-volt-500 px-3 py-1 rounded-full">
            <span className="text-secondary-900 text-sm font-bold">
              🔄 Auto-refresh: ON
            </span>
          </div>
        </div>
      </div>

      {/* Queue Summary */}
      <div className="text-secondary-300">
        <span className="font-medium">{stats.pending} pending</span>
        <span className="mx-2">•</span>
        <span className="font-medium">{stats.processing} in progress</span>
        <span className="mx-2">•</span>
        <span className="font-medium">
          {stats.completedToday} completed today
        </span>
      </div>
    </div>
  );
}
