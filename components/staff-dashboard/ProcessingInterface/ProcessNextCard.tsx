import React, { useState } from "react";
import { ProcessingModalData } from "../types/processing.types";
import ProcessingModal from "./ProcessingModal";

interface ProcessNextCardProps {
  nextCustomer?: {
    customerId: string;
    businessName: string;
    packageType: string;
    directoryLimit: number;
    waitTime: number;
    email?: string;
    website?: string;
    purchaseDate?: string;
  } | null;
  isProcessing?: boolean;
  onStartProcessing: (
    customerId: string,
    priorityMode?: boolean,
  ) => Promise<void>;
}

export default function ProcessNextCard({
  nextCustomer,
  isProcessing = false,
  onStartProcessing,
}: ProcessNextCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleProcessNow = () => {
    if (nextCustomer) {
      setShowModal(true);
    }
  };

  const handleConfirmProcessing = async (priorityMode = false) => {
    if (!nextCustomer) return;

    setIsStarting(true);
    try {
      await onStartProcessing(nextCustomer.customerId, priorityMode);
      setShowModal(false);
    } catch (error) {
      console.error("Failed to start processing:", error);
      // Error handling is done in parent component
    } finally {
      setIsStarting(false);
    }
  };

  const handleReviewDetails = () => {
    if (!nextCustomer) return;

    // Create detailed customer information display
    const details = `
Customer Details:

ID: ${nextCustomer.customerId}
Business: ${nextCustomer.businessName}
Email: ${nextCustomer.email || "Not provided"}
Website: ${nextCustomer.website || "Not provided"}
Package: ${nextCustomer.packageType}
Directory Limit: ${nextCustomer.directoryLimit}
Wait Time: ${nextCustomer.waitTime} hours
Purchase Date: ${nextCustomer.purchaseDate ? new Date(nextCustomer.purchaseDate).toLocaleDateString() : "Not provided"}

Processing Information:
Estimated Time: ${getEstimatedTime(nextCustomer.directoryLimit, nextCustomer.packageType)}
Priority: ${nextCustomer.packageType === "PRO" ? "High" : nextCustomer.packageType === "GROWTH" ? "Medium" : "Standard"}
    `;
    alert(details);
  };

  const handleSchedule = () => {
    if (!nextCustomer) return;

    // Simple scheduling interface
    const scheduleTime = prompt(
      `Schedule processing for ${nextCustomer.businessName}\n\nEnter delay in hours (e.g., 2 for 2 hours from now):

Current time: ${new Date().toLocaleString()}
Customer: ${nextCustomer.businessName} (${nextCustomer.customerId})`,
      "1",
    );

    if (scheduleTime && !isNaN(Number(scheduleTime))) {
      const hours = Number(scheduleTime);
      const scheduledDate = new Date(Date.now() + hours * 60 * 60 * 1000);

      alert(
        `✅ Processing scheduled for ${nextCustomer.businessName}\n\n` +
          `Scheduled Time: ${scheduledDate.toLocaleString()}\n` +
          `Customer: ${nextCustomer.customerId}\n` +
          `Package: ${nextCustomer.packageType}\n` +
          `Directories: ${nextCustomer.directoryLimit}\n\n` +
          `Note: This is a demo implementation. In production, this would integrate with your scheduling system.`,
      );
    } else if (scheduleTime !== null) {
      alert("Invalid time entered. Please enter a number of hours.");
    }
  };

  const getEstimatedTime = (directoryLimit: number, packageType: string) => {
    const baseTimePerDirectory =
      packageType === "PRO" ? 2.5 : packageType === "GROWTH" ? 2 : 1.5;
    const totalMinutes = directoryLimit * baseTimePerDirectory;

    if (totalMinutes < 60) {
      return `${Math.round(totalMinutes)} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);
      return `${hours}h ${minutes}m`;
    }
  };

  if (isProcessing) {
    return (
      <div className="bg-gradient-to-br from-volt-500/10 to-volt-600/5 border-2 border-volt-500/30 rounded-xl p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-volt-500 mx-auto mb-6"></div>
        <h3 className="text-xl font-bold text-volt-400 mb-2">
          🔄 Processing in Progress
        </h3>
        <p className="text-secondary-300">
          Queue processing is currently active. Check the Live Processing tab
          for details.
        </p>
      </div>
    );
  }

  if (!nextCustomer) {
    return (
      <div className="bg-secondary-800/50 border border-secondary-700 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-white mb-2">
          No Customers in Queue
        </h3>
        <p className="text-secondary-300">
          All customers have been processed. Queue is empty!
        </p>
      </div>
    );
  }

  const estimatedTime = getEstimatedTime(
    nextCustomer.directoryLimit,
    nextCustomer.packageType,
  );

  return (
    <>
      <div className="bg-gradient-to-br from-volt-500/10 to-volt-600/5 border-2 border-volt-500/30 rounded-xl p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-volt-400 mb-2">
            🎯 NEXT IN QUEUE
          </div>
        </div>

        {/* Customer Info */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white mb-2">
            {nextCustomer.businessName}
          </h3>
          <div className="text-secondary-300 space-x-4">
            <span className="font-medium">{nextCustomer.customerId}</span>
            <span>•</span>
            <span
              className={`px-2 py-1 rounded text-xs font-bold ${
                nextCustomer.packageType === "PRO"
                  ? "bg-purple-600 text-white"
                  : nextCustomer.packageType === "GROWTH"
                    ? "bg-orange-500 text-white"
                    : "bg-blue-500 text-white"
              }`}
            >
              {nextCustomer.packageType} Package
            </span>
            <span>•</span>
            <span>{nextCustomer.directoryLimit} directories</span>
            <span>•</span>
            <span>⏱️ {nextCustomer.waitTime}h wait</span>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mb-6">
          <button
            onClick={handleProcessNow}
            disabled={isStarting}
            className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 py-4 px-6 rounded-xl font-black text-lg hover:from-volt-400 hover:to-volt-500 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
          >
            {isStarting ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary-900"></div>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>PROCESS NOW - START SUBMISSION QUEUE</span>
              </>
            )}
          </button>

          <div className="text-center mt-3 text-secondary-300 text-sm">
            Estimated completion: {estimatedTime}
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="flex space-x-3">
          <button
            onClick={handleReviewDetails}
            className="flex-1 border-2 border-secondary-600 hover:border-volt-500 text-secondary-300 hover:text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <span>📋</span>
            <span>Review Details</span>
          </button>

          <button
            onClick={() => handleConfirmProcessing(true)}
            disabled={isStarting}
            className="flex-1 border-2 border-orange-600 hover:border-orange-500 text-orange-300 hover:text-orange-200 py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>⚡</span>
            <span>Priority Process</span>
          </button>

          <button
            onClick={handleSchedule}
            className="flex-1 border-2 border-blue-600 hover:border-blue-500 text-blue-300 hover:text-blue-200 py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <span>⏰</span>
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {/* Processing Modal */}
      {showModal && nextCustomer && (
        <ProcessingModal
          customer={{
            customerId: nextCustomer.customerId,
            businessName: nextCustomer.businessName,
            packageType: nextCustomer.packageType,
            directoryCount: nextCustomer.directoryLimit,
            estimatedTime,
            canPriorityProcess: nextCustomer.packageType === "PRO",
          }}
          onConfirm={(priorityMode) => handleConfirmProcessing(priorityMode)}
          onCancel={() => setShowModal(false)}
          isProcessing={isStarting}
        />
      )}
    </>
  );
}
