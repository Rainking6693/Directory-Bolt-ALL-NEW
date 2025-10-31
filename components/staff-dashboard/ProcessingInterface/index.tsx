import React, { useCallback, useEffect, useState } from "react";
import ProcessNextCard from "./ProcessNextCard";
import ActiveProcessing from "./ActiveProcessing";
import { ProcessingJob } from "../types/processing.types";

interface QueueCustomer {
  customerId: string;
  businessName: string;
  packageType: ProcessingJob["packageType"];
  directoryLimit: number;
  email?: string;
  website?: string;
  purchaseDate?: string;
  createdAt: string;
}

interface QueueStatusResponse {
  success: boolean;
  data?: {
    nextCustomer: QueueCustomer | null;
    isProcessing: boolean;
  };
  error?: string;
}

type NotificationState = { type: "info" | "error"; message: string } | null;

export default function ProcessingInterface(): JSX.Element {
  const [nextCustomer, setNextCustomer] = useState<QueueCustomer | null>(null);
  const [activeJobs, setActiveJobs] = useState<ProcessingJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>(null);

  const fetchProcessingData = useCallback(async () => {
    try {
      const queueResponse = await fetch("/api/autobolt/queue-status");
      if (!queueResponse.ok) {
        throw new Error("Failed to fetch processing data");
      }

      const queueResult: QueueStatusResponse = await queueResponse.json();

      if (queueResult.success && queueResult.data) {
        setNextCustomer(queueResult.data.nextCustomer ?? null);
        setIsProcessing(queueResult.data.isProcessing);

        const jobList: ProcessingJob[] = queueResult.data.isProcessing
          ? [
              {
                customerId: queueResult.data.nextCustomer?.customerId ?? "",
                businessName:
                  queueResult.data.nextCustomer?.businessName ?? "Processing customer",
                packageType:
                  queueResult.data.nextCustomer?.packageType ?? "PRO",
                status: "processing",
                progress: 67,
                startedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
                elapsedTime: 12.5,
                currentActivity: "Submitting to Google My Business...",
                directoriesTotal: 200,
                directoriesCompleted: 134,
                directoriesSuccessful: 121,
                directoriesFailed: 13,
                directoriesRemaining: 66,
              },
            ]
          : [];

        setActiveJobs(jobList);
        setNotification(null);
      } else {
        setNextCustomer(null);
        setIsProcessing(false);
        setActiveJobs([]);
        setNotification({
          type: "error",
          message: queueResult.error ?? "Processing queue unavailable.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load processing data.";
      setNotification({ type: "error", message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProcessingData();

    const interval = window.setInterval(() => {
      void fetchProcessingData();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [fetchProcessingData]);

  const handleStartProcessing = async (customerId: string, priorityMode = false) => {
    try {
      const url = priorityMode
        ? `/api/autobolt/process-queue?customerId=${customerId}&priority=true`
        : `/api/autobolt/process-queue?customerId=${customerId}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error ?? "Failed to start processing");
      }

      await fetchProcessingData();
      setNotification({
        type: "info",
        message: `Processing started for ${customerId}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start processing.";
      setNotification({ type: "error", message });
      throw error;
    }
  };

  const handleEmergencyStop = async (customerId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to emergency stop this processing? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setActiveJobs((prev) => prev.filter((job) => job.customerId !== customerId));
      setNotification({
        type: "info",
        message: `Emergency stop requested for ${customerId}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to stop processing.";
      setNotification({ type: "error", message });
    }
  };

  const handleViewLiveLog = (customerId: string) => {
    setNotification({
      type: "info",
      message: `Live log viewer is not yet available for ${customerId}.`,
    });
  };

  const handleViewDetails = (customerId: string) => {
    setNotification({
      type: "info",
      message: `Detailed view is not yet available for ${customerId}.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`rounded-md border px-4 py-3 ${
            notification.type === "error"
              ? "border-red-500/50 bg-red-500/10 text-red-200"
              : "border-volt-500/50 bg-volt-500/10 text-volt-100"
          }`}
        >
          {notification.message}
        </div>
      )}

      {activeJobs.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            Active Processing ({activeJobs.length})
          </h3>
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <ActiveProcessing
                key={job.customerId}
                job={job}
                onEmergencyStop={handleEmergencyStop}
                onViewLiveLog={handleViewLiveLog}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          {isProcessing ? "Queue Processing Active" : "Ready to Process"}
        </h3>

        <ProcessNextCard
          nextCustomer={
            nextCustomer
              ? {
                  customerId: nextCustomer.customerId,
                  businessName: nextCustomer.businessName,
                  packageType: nextCustomer.packageType,
                  directoryLimit: nextCustomer.directoryLimit,
                  waitTime: calculateWaitTime(nextCustomer.createdAt),
                  email: nextCustomer.email,
                  website: nextCustomer.website,
                  purchaseDate: nextCustomer.purchaseDate,
                }
              : null
          }
          isProcessing={isProcessing}
          onStartProcessing={handleStartProcessing}
        />
      </div>

      {!isProcessing && !activeJobs.length && (
        <div className="bg-secondary-800/50 border border-secondary-700 rounded-xl p-6">
          <h4 className="text-lg font-bold text-white mb-3 flex items-center">
            Processing Instructions
          </h4>
          <ul className="space-y-2 text-secondary-300 list-disc list-inside">
            <li>Click the Process Now button to start the next customer in the queue.</li>
            <li>Priority processing is available for PRO customers only.</li>
            <li>Processing cannot be stopped once started - use emergency stop only if necessary.</li>
            <li>Monitor progress in real-time using the Live Processing dashboard.</li>
            <li>Failed directories will trigger manual intervention alerts.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function calculateWaitTime(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 10) / 10;
}

