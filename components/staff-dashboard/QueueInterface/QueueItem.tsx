import React from "react";
import { QueueCustomer, QueueItemActions } from "../types/queue.types";

interface QueueItemProps {
  customer: QueueCustomer;
  actions: QueueItemActions;
  isProcessing?: boolean;
}

export default function QueueItem({
  customer,
  actions,
  isProcessing = false,
}: QueueItemProps) {
  const getPriorityIndicator = (priority: number) => {
    if (priority >= 100)
      return { color: "🔴", label: "HIGH", bgColor: "bg-red-600" };
    if (priority >= 75)
      return { color: "🟡", label: "MED", bgColor: "bg-orange-500" };
    return { color: "🟢", label: "LOW", bgColor: "bg-green-600" };
  };

  const getPackageBadge = (packageType: string) => {
    const badges = {
      PRO: { bg: "bg-purple-600", text: "text-white" },
      GROWTH: { bg: "bg-orange-500", text: "text-white" },
      STARTER: { bg: "bg-blue-500", text: "text-white" },
    };
    return badges[packageType as keyof typeof badges] || badges.STARTER;
  };

  const priorityInfo = getPriorityIndicator(customer.priority);
  const packageBadge = getPackageBadge(customer.packageType);

  return (
    <div
      className={`bg-secondary-800 rounded-xl border p-4 mb-3 transition-all duration-200 ${
        isProcessing
          ? "border-volt-500/50 bg-volt-500/5"
          : "border-secondary-700 hover:bg-secondary-700 hover:border-volt-500/50"
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Customer Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            {/* Priority Indicator */}
            <span className="text-xl">{priorityInfo.color}</span>

            {/* Package Badge */}
            <span
              className={`px-3 py-1 rounded-full font-bold text-xs ${packageBadge.bg} ${packageBadge.text}`}
            >
              {customer.packageType}
            </span>

            {/* Customer ID */}
            <span className="text-secondary-300 font-mono text-sm">
              {customer.customerId}
            </span>

            {/* Wait Time */}
            <span className="text-secondary-300 text-sm flex items-center">
              ⏱️ {customer.waitTime}h
            </span>
          </div>

          {/* Business Name */}
          <h3 className="text-white font-bold text-lg mb-1">
            {customer.businessName}
          </h3>

          {/* Business Details */}
          <div className="flex items-center space-x-4 text-secondary-300 text-sm">
            <span className="flex items-center">📧 {customer.email}</span>
            <span>{customer.directoryLimit} directories</span>
            <span>Priority: {customer.priority}</span>
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="ml-4 flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-volt-500"></div>
            <span className="text-volt-400 font-medium">Processing...</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {!isProcessing && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
          <button
            onClick={() => actions.onProcessNow(customer.customerId)}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 px-4 py-2 rounded-lg font-bold text-sm hover:from-volt-400 hover:to-volt-500 hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 min-h-[44px]"
          >
            <span>🚀</span>
            <span>Process Now</span>
          </button>

          <button
            onClick={() => actions.onViewDetails(customer.customerId)}
            className="border-2 border-secondary-600 hover:border-volt-500 text-secondary-300 hover:text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 flex items-center justify-center space-x-2 min-h-[44px]"
          >
            <span>👁️</span>
            <span className="sm:inline hidden">View Details</span>
            <span className="sm:hidden">Details</span>
          </button>

          <button
            onClick={() => actions.onContact(customer.customerId)}
            className="border-2 border-blue-600 hover:border-blue-500 text-blue-300 hover:text-blue-200 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 flex items-center justify-center space-x-2 min-h-[44px]"
          >
            <span>✉️</span>
            <span>Contact</span>
          </button>
        </div>
      )}
    </div>
  );
}
