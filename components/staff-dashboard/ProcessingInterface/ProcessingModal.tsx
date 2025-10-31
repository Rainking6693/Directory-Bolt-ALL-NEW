import React, { useEffect } from "react";
import { ProcessingModalData } from "../types/processing.types";

interface ProcessingModalProps {
  customer: ProcessingModalData;
  onConfirm: (priorityMode?: boolean) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function ProcessingModal({
  customer,
  onConfirm,
  onCancel,
  isProcessing = false,
}: ProcessingModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel, isProcessing]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-md w-full animate-scale-in"
        style={{
          animation: "scale-in 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div className="bg-orange-500/10 border-b border-orange-500/20 p-6 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚠️</span>
            <h3 className="text-xl font-bold text-white">
              Start Processing: {customer.businessName}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-secondary-300 mb-4">
            This will begin automated directory submission for:
          </p>

          <div className="bg-secondary-900/50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary-400">Customer:</span>
              <span className="text-white font-medium">
                {customer.customerId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-400">Package:</span>
              <span className="text-white font-medium">
                {customer.packageType} ({customer.directoryCount} directories)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-400">Estimated time:</span>
              <span className="text-white font-medium">
                {customer.estimatedTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-400">Status updates:</span>
              <span className="text-white font-medium">Real-time tracking</span>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">
              <strong>⚠️ Important:</strong> Processing cannot be stopped once
              started.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex space-x-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 border-2 border-secondary-600 hover:border-secondary-500 text-secondary-300 hover:text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <span>❌</span>
            <span>Cancel</span>
          </button>

          {customer.canPriorityProcess && (
            <button
              onClick={() => onConfirm(true)}
              disabled={isProcessing}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-lg font-bold transition-all duration-200 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Priority Mode</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => onConfirm(false)}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 py-3 px-4 rounded-lg font-bold transition-all duration-200 hover:from-volt-400 hover:to-volt-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary-900"></div>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Start Processing</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
