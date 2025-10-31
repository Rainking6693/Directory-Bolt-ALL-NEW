import React from "react";
import { ProcessingJob } from "../types/processing.types";

interface ActiveJobsProps {
  jobs: ProcessingJob[];
}

export default function ActiveJobs({ jobs }: ActiveJobsProps) {
  const getElapsedTime = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.floor(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="bg-secondary-800 border border-secondary-700 rounded-xl p-6">
      <div className="space-y-4">
        {jobs.map((job) => (
          <div
            key={job.customerId}
            className="flex items-center justify-between p-4 bg-secondary-900/50 rounded-lg border border-secondary-700"
          >
            {/* Job Info */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-volt-500"></div>
                <span className="text-volt-400 font-bold">🔄</span>
              </div>

              <div>
                <div className="text-white font-bold">{job.businessName}</div>
                <div className="text-secondary-300 text-sm">
                  {job.customerId} • {job.packageType}
                </div>
              </div>
            </div>

            {/* Progress Info */}
            <div className="flex items-center space-x-6">
              {/* Progress Bar */}
              <div className="flex items-center space-x-3">
                <div className="w-24 bg-secondary-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-volt-500 to-volt-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
                <span className="text-volt-400 font-bold text-sm min-w-[3rem]">
                  {job.progress}%
                </span>
              </div>

              {/* Stats */}
              <div className="text-right text-sm">
                <div className="text-white font-medium">
                  {job.directoriesCompleted}/{job.directoriesTotal} dirs
                </div>
                <div className="text-secondary-300">
                  {getElapsedTime(job.elapsedTime)} elapsed
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
