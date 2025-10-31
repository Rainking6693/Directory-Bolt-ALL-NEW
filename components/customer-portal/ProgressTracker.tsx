import React, { useState, useEffect } from 'react';

interface ProgressTrackerProps {
  customerId: string;
  showFullDetails?: boolean;
  className?: string;
}

interface ProgressData {
  currentProgress: number;
  status: string;
  submittedDirectories: number;
  directoryLimit: number;
  estimatedCompletion: string;
  lastUpdated: string;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ 
  customerId, 
  showFullDetails = false,
  className = ''
}) => {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      fetchProgressData();
      
      // Set up polling for real-time updates every 30 seconds
      const interval = setInterval(fetchProgressData, 30000);
      return () => clearInterval(interval);
    }

    return () => {};
  }, [customerId]);

  const fetchProgressData = async () => {
    try {
      const response = await fetch(`/api/customer/data?customerId=${customerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch progress data');
      }
      
      const data = await response.json();
      setProgressData({
        currentProgress: data.progress,
        status: data.status,
        submittedDirectories: data.submittedDirectories,
        directoryLimit: data.directoryLimit,
        estimatedCompletion: data.estimatedCompletion,
        lastUpdated: new Date().toISOString()
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-volt-600 bg-volt-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'pending': return '⏳';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !progressData) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="text-red-600 text-sm">
          ⚠️ Unable to load progress data
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {getStatusIcon(progressData.status)} Submission Progress
        </h3>
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(progressData.status)}`}>
          {progressData.status}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{progressData.currentProgress}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressData.currentProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {progressData.submittedDirectories}
          </div>
          <div className="text-xs text-gray-600">Submitted</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {progressData.directoryLimit - progressData.submittedDirectories}
          </div>
          <div className="text-xs text-gray-600">Remaining</div>
        </div>
      </div>

      {showFullDetails && (
        <>
          {/* Estimated Completion */}
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estimated Completion:</span>
              <span className="font-medium text-gray-900">{progressData.estimatedCompletion}</span>
            </div>
          </div>

          {/* Last Updated */}
          <div className="mt-2 text-xs text-gray-500">
            Last updated: {new Date(progressData.lastUpdated).toLocaleTimeString()}
          </div>

          {/* Action Button */}
          <div className="mt-4">
            <a
              href="/customer-portal"
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              View Full Dashboard
            </a>
          </div>
        </>
      )}

      {/* Real-time indicator */}
      <div className="flex items-center justify-center mt-3 pt-3 border-t">
        <div className="flex items-center text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
          Live tracking active
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;