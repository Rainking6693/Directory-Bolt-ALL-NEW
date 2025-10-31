import React, { useState } from "react";
import { QueueCustomer, QueueItemActions } from "../types/queue.types";
import QueueItem from "./QueueItem";

interface QueueListProps {
  customers: QueueCustomer[];
  actions: QueueItemActions;
  isLoading?: boolean;
}

export default function QueueList({
  customers,
  actions,
  isLoading = false,
}: QueueListProps) {
  const [processingCustomers, setProcessingCustomers] = useState<Set<string>>(
    new Set(),
  );

  const handleProcessNow = async (customerId: string) => {
    setProcessingCustomers((prev) => new Set(prev).add(customerId));

    try {
      await actions.onProcessNow(customerId);
    } finally {
      // Remove from processing set after a delay to show the processing state
      setTimeout(() => {
        setProcessingCustomers((prev) => {
          const next = new Set(prev);
          next.delete(customerId);
          return next;
        });
      }, 2000);
    }
  };

  const enhancedActions: QueueItemActions = {
    ...actions,
    onProcessNow: handleProcessNow,
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-secondary-800 rounded-xl border border-secondary-700 p-4 animate-pulse"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-6 h-6 bg-secondary-600 rounded-full"></div>
              <div className="w-16 h-5 bg-secondary-600 rounded"></div>
              <div className="w-32 h-5 bg-secondary-600 rounded"></div>
              <div className="w-20 h-5 bg-secondary-600 rounded"></div>
            </div>
            <div className="w-48 h-6 bg-secondary-600 rounded mb-2"></div>
            <div className="flex space-x-4">
              <div className="w-24 h-4 bg-secondary-600 rounded"></div>
              <div className="w-20 h-4 bg-secondary-600 rounded"></div>
              <div className="w-16 h-4 bg-secondary-600 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-white mb-2">Queue is Empty!</h3>
        <p className="text-secondary-300">
          All customers have been processed. Great work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {customers.map((customer) => (
        <QueueItem
          key={customer.customerId}
          customer={customer}
          actions={enhancedActions}
          isProcessing={processingCustomers.has(customer.customerId)}
        />
      ))}
    </div>
  );
}
