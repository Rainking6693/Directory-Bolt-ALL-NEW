import React from "react";
import { ProcessingJob } from "../types/processing.types";

interface ActiveProcessingProps {
  job: ProcessingJob;
  onEmergencyStop: (customerId: string) => void;
  onViewLiveLog: (customerId: string) => void;
  onViewDetails: (customerId: string) => void;
}

export default function ActiveProcessing({
  job,
  onEmergencyStop,
  onViewLiveLog,
  onViewDetails,
}: ActiveProcessingProps) {
  const getElapsedTimeString = (elapsedMinutes: number) => {
    if (elapsedMinutes < 60) {
      return `${Math.floor(elapsedMinutes)}m ${Math.floor((elapsedMinutes % 1) * 60)}s`;
    }
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = Math.floor(elapsedMinutes % 60);
    return `${hours}h ${minutes}m`;
  };

  const getEstimatedCompletion = (job: ProcessingJob) => {
    if (job.progress === 0) return "Calculating...";

    const remainingMinutes =
      (job.elapsedTime / job.progress) * (100 - job.progress);
    const completionTime = new Date(Date.now() + remainingMinutes * 60 * 1000);

    return completionTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="bg-gradient-to-br from-volt-500/10 to-volt-600/5 border-2 border-volt-500/30 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center">
            🔄 PROCESSING: {job.businessName}
          </h3>
          <div className="text-secondary-300 text-sm mt-1">
            Started: {new Date(job.startedAt).toLocaleTimeString()} • Elapsed:{" "}
            {getElapsedTimeString(job.elapsedTime)} • ETA:{" "}
            {getEstimatedCompletion(job)}
          </div>
        </div>

        {job.status === "processing" && (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-volt-500"></div>
            <span className="text-volt-400 font-medium">Active</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">
            Progress: {job.progress}% ({job.directoriesCompleted}/
            {job.directoriesTotal})
          </span>
        </div>

        <div className="relative">
          <div className="w-full bg-secondary-700 rounded-full h-4 border border-secondary-600">
            <div
              className="bg-gradient-to-r from-volt-500 to-volt-600 h-full rounded-full transition-all duration-500 relative overflow-hidden"
              style={{ width: `${job.progress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Activity */}
      <div className="mb-6">
        <div className="bg-secondary-800/50 rounded-lg p-4">
          <div className="text-sm text-secondary-400 mb-1">
            Current Activity:
          </div>
          <div className="text-white font-medium flex items-center">
            <div className="flex space-x-1 mr-3">
              <div className="w-2 h-2 bg-volt-500 rounded-full animate-pulse"></div>
              <div
                className="w-2 h-2 bg-volt-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 bg-volt-500 rounded-full animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
            {job.currentActivity}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {job.directoriesSuccessful}
          </div>
          <div className="text-xs text-secondary-400 uppercase tracking-wide">
            ✅ Successful
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">
            {job.directoriesFailed}
          </div>
          <div className="text-xs text-secondary-400 uppercase tracking-wide">
            ❌ Failed
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-volt-400">
            {job.directoriesRemaining}
          </div>
          <div className="text-xs text-secondary-400 uppercase tracking-wide">
            ⏳ Remaining
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={() => onEmergencyStop(job.customerId)}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <span>🛑</span>
          <span>Emergency Stop</span>
        </button>

        <button
          onClick={() => onViewLiveLog(job.customerId)}
          className="border-2 border-secondary-600 hover:border-volt-500 text-secondary-300 hover:text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <span>👁️</span>
          <span>Live Log</span>
        </button>

        <button
          onClick={() => onViewDetails(job.customerId)}
          className="border-2 border-blue-600 hover:border-blue-500 text-blue-300 hover:text-blue-200 px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <span>📊</span>
          <span>Details</span>
        </button>
      </div>
    </div>
  );
}
