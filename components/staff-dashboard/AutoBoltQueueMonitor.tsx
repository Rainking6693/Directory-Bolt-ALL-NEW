// AutoBolt Queue Monitor Component
// Displays real-time AutoBolt processing queue and extension status

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import CustomerValidation from "./CustomerValidation";
import BatchProcessingMonitor from "./BatchProcessingMonitor";

import type {
  AutoBoltStatusResponse,
  QueueItem,
  QueueItemPayload,
  QueueSnapshotResponse,
  QueueStats,
  QueueStatsPayload,
  QueueStatus,
  RetryJobsResponse,
  WorkerStatus,
} from "./types/autobolt-monitor";

function formatPackage(size: number) {
  switch (size) {
    case 50:
      return "Starter (50)";
    case 75:
      return "Growth (75)";
    case 150:
      return "Professional (150)";
    case 500:
      return "Enterprise (500)";
    default:
      return `Custom (${size})`;
  }
}

function formatStatus(status: QueueStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In Progress";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

const EMPTY_QUEUE_STATS: QueueStats = {
  totalJobs: 0,
  pendingJobs: 0,
  inProgressJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  totalDirectories: 0,
  completedDirectories: 0,
  failedDirectories: 0,
  successRate: 0,
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    const inner = (value as { value?: unknown }).value;
    return toNumber(inner, fallback);
  }
  return fallback;
};

const readStat = (data: QueueStatsPayload, primary: keyof QueueStatsPayload | string, secondary: keyof QueueStatsPayload | string) => {
  const first = (primary as keyof QueueStatsPayload) in data ? data[primary as keyof QueueStatsPayload] : (data as Record<string, unknown>)[primary]
  if (typeof first !== 'undefined') {
    return first
  }
  const second = (secondary as keyof QueueStatsPayload) in data ? data[secondary as keyof QueueStatsPayload] : (data as Record<string, unknown>)[secondary]
  return second
}

type QueueItemStatus = QueueItem["status"];

const normalizeQueueItemStatus = (
  status: string | null | undefined,
): QueueItemStatus => {
  if (!status) {
    return "pending";
  }
  const value = status.toLowerCase().replace(/-/g, "_");
  switch (value) {
    case "pending":
      return "pending";
    case "in_progress":
    case "processing":
    case "submitted":
      return "in_progress";
    case "complete":
    case "completed":
      return "complete";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
};

const mapQueueItem = (payload: QueueItemPayload): QueueItem => {
  const directoriesTotal = toNumber(
    payload.directoriesTotal ?? payload.packageSize,
    0,
  );
  const directoriesCompleted = toNumber(payload.directoriesCompleted, 0);
  const directoriesFailed = toNumber(payload.directoriesFailed, 0);
  const rawProgress = toNumber(payload.progressPercentage, -1);
  const computedProgress =
    directoriesTotal > 0
      ? Math.min(
          100,
          Math.round((directoriesCompleted / directoriesTotal) * 100),
        )
      : 0;
  const progressPercentage =
    rawProgress >= 0 ? Math.min(100, rawProgress) : computedProgress;

  return {
    id: payload.id ?? payload.customerId ?? "unknown-job",
    customerId: payload.customerId ?? "unknown-customer",
    businessName: payload.businessName ?? null,
    email: payload.email ?? null,
    packageSize: toNumber(
      payload.packageSize ?? directoriesTotal,
      directoriesTotal,
    ),
    priorityLevel: toNumber(payload.priorityLevel, 0),
    status: normalizeQueueItemStatus(
      typeof payload.status === "string" ? payload.status : undefined,
    ),
    createdAt: payload.createdAt ?? new Date().toISOString(),
    startedAt: payload.startedAt ?? null,
    completedAt: payload.completedAt ?? null,
    errorMessage: payload.errorMessage ?? null,
    directoriesTotal,
    directoriesCompleted,
    directoriesFailed,
    progressPercentage,
  };
};

const mapQueueStats = (payload?: QueueStatsPayload | null): QueueStats => {
  const stats = { ...EMPTY_QUEUE_STATS };
  if (!payload) {
    return stats;
  }

  stats.totalJobs = toNumber(readStat(payload, 'total_jobs', 'totalJobs') ?? stats.totalJobs);
  stats.pendingJobs = toNumber(readStat(payload, 'total_queued', 'pendingJobs') ?? stats.pendingJobs);
  stats.inProgressJobs = toNumber(readStat(payload, 'total_processing', 'inProgressJobs') ?? stats.inProgressJobs);
  stats.completedJobs = toNumber(readStat(payload, 'total_completed', 'completedJobs') ?? stats.completedJobs);
  stats.failedJobs = toNumber(readStat(payload, 'total_failed', 'failedJobs') ?? stats.failedJobs);
  stats.totalDirectories = toNumber(readStat(payload, 'total_directories', 'totalDirectories') ?? stats.totalDirectories);
  stats.completedDirectories = toNumber(readStat(payload, 'completed_directories', 'completedDirectories') ?? stats.completedDirectories);
  stats.failedDirectories = toNumber(readStat(payload, 'failed_directories', 'failedDirectories') ?? stats.failedDirectories);
  stats.successRate = toNumber(readStat(payload, 'success_rate', 'successRate') ?? stats.successRate);
  return stats;
};

export default function AutoBoltQueueMonitor(): JSX.Element {
  const router = useRouter();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filteredStatus, setFilteredStatus] = useState<QueueStatus | "all">(
    "all",
  );
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showExtensionComponents, setShowExtensionComponents] = useState(true);

  // Use same-origin API to ensure cookies are sent; avoid cross-origin defaults
  const baseApiUrl = useMemo(() => '', []);

  const fetchQueueData = useCallback(async () => {
    try {
      const authResponse = await fetch("/api/staff/auth-check", { credentials: 'include' });
      if (!authResponse.ok) {
        throw new Error("Staff authentication expired or invalid");
      }

      const authData: { isAuthenticated?: boolean; authenticated?: boolean } = await authResponse.json();
      if (!(authData?.isAuthenticated ?? authData?.authenticated)) {
        throw new Error("Staff authentication required");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const queueResponse = await fetch(
        `${baseApiUrl}/api/staff/autobolt-queue`,
        {
          headers,
          method: "GET",
          credentials: 'include',
          cache: "no-store",
        },
      );

      if (!queueResponse.ok) {
        const errorText = await queueResponse.text();
        throw new Error(
          `Queue API Error: ${queueResponse.status} - ${errorText}`,
        );
      }

      const queueResult: QueueSnapshotResponse = await queueResponse.json();
      if (!queueResult.success) {
        throw new Error(queueResult.error || "Queue API returned an error");
      }

      const queueItemsPayload = Array.isArray(queueResult.data?.queueItems)
        ? queueResult.data.queueItems
        : [];
      const items = queueItemsPayload.map(mapQueueItem);
      setQueueItems(items);

      setQueueStats(
        queueResult.data?.stats ? mapQueueStats(queueResult.data.stats) : null,
      );

      try {
        const workerResponse = await fetch(
          `${baseApiUrl}/api/autobolt-status`,
          {
            headers,
            method: "GET",
            cache: "no-store",
          },
        );

        if (workerResponse.ok) {
          const workerResult: AutoBoltStatusResponse =
            await workerResponse.json();
          if (workerResult.success) {
            setWorkerStatus(workerResult.data.workers || []);
          } else {
            console.warn("Worker status request failed:", workerResult.error);
            setWorkerStatus([]);
          }
        }
      } catch (workerError) {
        console.warn("Worker status fetch failed:", workerError);
      }


      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    } catch (fetchError) {
      console.error("Failed to load AutoBolt queue:", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load queue data",
      );
      setLoading(false);
    }
  }, [baseApiUrl]);

  useEffect(() => {
    fetchQueueData();
    // Increase frequency for real-time updates during development
    const interval = setInterval(fetchQueueData, 3000);
    return () => clearInterval(interval);
  }, [fetchQueueData]);

  // Real-time status updates via Server-Sent Events (optional enhancement)
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`${baseApiUrl}/api/autobolt/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "queue_update") {
            fetchQueueData();
          } else if (data?.type === "worker_status") {
            setWorkerStatus(Array.isArray(data.workers) ? data.workers : []);
          }
        } catch (error) {
          console.error("SSE parsing error:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.warn("SSE connection error (non-critical):", error);
        eventSource?.close();
      };
    } catch (sseError) {
      console.warn("SSE initialization failed (non-critical):", sseError);
    }

    return () => {
      eventSource?.close();
    };
  }, [baseApiUrl, fetchQueueData]);

  const filteredItems = useMemo(() => {
    if (filteredStatus === "all") {
      return queueItems;
    }
    return queueItems.filter((item) => item.status === filteredStatus);
  }, [filteredStatus, queueItems]);

  const retryFailedJobs = useCallback(async () => {
    try {
      const failedJobs = queueItems.filter((item) => item.status === "failed");
      if (failedJobs.length === 0) {
        setError("No failed jobs to retry");
        return;
      }

      const authResponse = await fetch("/api/staff/auth-check");
      if (!authResponse.ok) {
        throw new Error("Staff authentication expired");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      setRetryingJobs(new Set(failedJobs.map((job) => job.id)));

      const response = await fetch(`${baseApiUrl}/api/autobolt/jobs/retry`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jobIds: failedJobs.map((job) => job.id) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retry API Error: ${response.status} - ${errorText}`);
      }

      const result: RetryJobsResponse = await response.json();
      if (result.success) {
        await fetchQueueData();
        setError(null);
        const retriedCount = result.data.retriedJobsCount ?? failedJobs.length;
        console.log(`Successfully queued ${retriedCount} jobs for retry`);
      } else {
        throw new Error(result.error || "Failed to retry jobs");
      }
    } catch (retryError) {
      console.error("Failed to retry jobs:", retryError);
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Failed to retry jobs",
      );
    } finally {
      setRetryingJobs(new Set());
    }
  }, [baseApiUrl, fetchQueueData, queueItems]);

  const pushJobNow = useCallback(
    async (jobId: string) => {
      try {
        // CSRF token
        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' })
        const csrf = await csrfRes.json()

        const res = await fetch('/api/staff/jobs/push-to-autobolt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf?.csrfToken || '' },
          credentials: 'include',
          body: JSON.stringify({ job_id: jobId })
        })
        if (!res.ok) {
          const t = await res.text()
          throw new Error(`Push failed: ${res.status} ${t}`)
        }
        await fetchQueueData()
      } catch (err) {
        console.error('Push job failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to push job')
      }
    },
    [fetchQueueData]
  )

  const retrySpecificJob = useCallback(
    async (jobId: string) => {
      try {
        const authResponse = await fetch("/api/staff/auth-check");
        if (!authResponse.ok) {
          throw new Error("Staff authentication expired");
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        setRetryingJobs((prev) => new Set([...prev, jobId]));

        const response = await fetch(`${baseApiUrl}/api/autobolt/jobs/retry`, {
          method: "POST",
          headers,
          body: JSON.stringify({ jobIds: [jobId] }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Retry API Error: ${response.status} - ${errorText}`);
        }

        const result: RetryJobsResponse = await response.json();
        if (result.success) {
          await fetchQueueData();
          setError(null);
          console.log(`Successfully queued job ${jobId} for retry`);
        } else {
          throw new Error(result.error || "Failed to retry job");
        }
      } catch (retryError) {
        console.error("Failed to retry job:", retryError);
        setError(
          retryError instanceof Error
            ? retryError.message
            : "Failed to retry job",
        );
      } finally {
        setRetryingJobs((prev) => {
          const updated = new Set(prev);
          updated.delete(jobId);
          return updated;
        });
      }
    },
    [baseApiUrl, fetchQueueData],
  );

  return (
    <div className="space-y-6">
      {/* Real-time Status Header */}
      <div className="bg-secondary-900/40 border border-secondary-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  workerStatus.some((w) => w.status === "online")
                    ? "bg-green-400 animate-pulse"
                    : "bg-red-400"
                }`}
              ></div>
              <span className="text-secondary-200 font-medium">
                {workerStatus.some((w) => w.status === "online")
                  ? "AutoBolt Active"
                  : "AutoBolt Offline"}
              </span>
            </div>
            <div className="text-secondary-400 text-sm">
              {workerStatus.length > 0 &&
                `${workerStatus.length} backend workers`}
              {error && (
                <span className="text-red-300 ml-2">
                  • Backend Connection Issue
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Backend Connection Status */}
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${error ? "bg-red-400" : "bg-green-400"}`}
              ></div>
              <span className="text-xs text-secondary-300">
                {error ? "Backend Disconnected" : "Backend Connected"}
              </span>
            </div>
            <button
              onClick={() =>
                setShowExtensionComponents(!showExtensionComponents)
              }
              className="px-3 py-1 text-xs bg-secondary-700 hover:bg-secondary-600 rounded text-secondary-200"
            >
              {showExtensionComponents ? "Hide Tools" : "Show Tools"}
            </button>
          </div>
        </div>
      </div>

      {/* Extension Migration Components */}
      {showExtensionComponents && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CustomerValidation />
          <BatchProcessingMonitor
            customerId={selectedCustomerId}
            onBatchStart={() => console.log("Batch started")}
            onBatchComplete={() => fetchQueueData()}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">AutoBolt Queue</h2>
          <p className="text-secondary-400 text-sm">
            Real-time job queue and worker status monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-secondary-400 text-sm">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString()}`
              : "Awaiting updates..."}
          </div>
          {/* Quick check: processable directories by package size */}
          <ProcessableDirectoriesWidget />
          <button
            onClick={fetchQueueData}
            disabled={loading}
            className="px-4 py-2 text-sm bg-secondary-800 hover:bg-secondary-700 disabled:opacity-50 rounded-md text-secondary-100"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          {queueItems.some((item) => item.status === "failed") && (
            <button
              onClick={retryFailedJobs}
              disabled={retryingJobs.size > 0}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md text-white font-medium"
            >
              {retryingJobs.size > 0
                ? "Retrying..."
                : `Retry ${queueItems.filter((item) => item.status === "failed").length} Failed Jobs`}
            </button>
          )}
          <button
            onClick={() => router.push("/staff-dashboard")}
            className="px-4 py-2 text-sm bg-volt-500/10 border border-volt-500/40 text-volt-300 rounded-md hover:bg-volt-500/15"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-md">
          {error}
        </div>
      )}

      {queueStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Pending Jobs"
            value={queueStats.pendingJobs}
            status="pending"
          />
          <StatCard
            label="In Progress"
            value={queueStats.inProgressJobs}
            status="in_progress"
          />
          <StatCard
            label="Completed"
            value={queueStats.completedJobs}
            status="complete"
          />
          <StatCard
            label="Failed"
            value={queueStats.failedJobs}
            status="failed"
          />
        </div>
      )}

      <div className="bg-secondary-900/60 border border-secondary-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-secondary-800 flex items-center gap-4">
          <span className="text-sm text-secondary-400">Filter status:</span>
          <select
            value={filteredStatus}
            onChange={(event) =>
              setFilteredStatus(event.target.value as QueueStatus | "all")
            }
            className="bg-secondary-800 text-secondary-100 text-sm px-3 py-2 rounded-md border border-secondary-700"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-800">
            <thead className="bg-secondary-900/80">
              <tr>
                <Th>Customer</Th>
                <Th>Email</Th>
                <Th>Package</Th>
                <Th>Status</Th>
                <Th>Progress</Th>
                <Th>Completed</Th>
                <Th>Failed</Th>
                <Th>Priority</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-6 text-center text-secondary-400"
                  >
                    Loading queue data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-6 text-center text-secondary-400"
                  >
                    No jobs match the current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-secondary-800/40 transition-colors"
                  >
                    <Td>
                      <div className="font-medium text-secondary-100">
                        {item.businessName || "Unknown Business"}
                      </div>
                      <div className="text-xs text-secondary-500">
                        {item.customerId}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-secondary-300 text-sm">
                        {item.email || "N/A"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-secondary-200 text-sm">
                        {formatPackage(item.packageSize)}
                      </span>
                    </Td>
                    <Td>
                      <StatusPill status={item.status} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-secondary-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${item.status === "complete" ? "bg-green-400" : "bg-volt-400"}`}
                            style={{ width: `${item.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-secondary-300 text-xs w-12">
                          {item.progressPercentage}%
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-secondary-200 text-sm">
                        {item.directoriesCompleted}/{item.directoriesTotal}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-red-300 text-sm">
                        {item.directoriesFailed}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-secondary-300 text-sm">
                        {item.priorityLevel}
                      </span>
                    </Td>
                    <Td>
                      <div className="text-secondary-300 text-xs">
                        <div>
                          Created: {new Date(item.createdAt).toLocaleString()}
                        </div>
                        {item.startedAt && (
                          <div>
                            Started: {new Date(item.startedAt).toLocaleString()}
                          </div>
                        )}
                        {item.completedAt && (
                          <div>
                            Completed:{" "}
                            {new Date(item.completedAt).toLocaleString()}
                          </div>
                        )}
                        {item.errorMessage && (
                          <div className="text-red-300">
                            Error: {item.errorMessage}
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td className="space-x-2">
                      {item.status === "pending" && (
                        <button
                          onClick={() => pushJobNow(item.id)}
                          className="px-3 py-1 text-xs bg-volt-500/20 hover:bg-volt-500/30 rounded border border-volt-500/40 text-volt-200"
                        >
                          Push Now
                        </button>
                      )}
                      {item.status === "failed" && (
                        <button
                          onClick={() => retrySpecificJob(item.id)}
                          disabled={retryingJobs.has(item.id)}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-white font-medium"
                        >
                          {retryingJobs.has(item.id) ? "Retrying..." : "Retry"}
                        </button>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Worker Status - New Backend Architecture */}
      <div className="bg-secondary-900/60 border border-secondary-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-secondary-800">
          <h3 className="text-secondary-200 font-medium">Worker Status</h3>
          <p className="text-secondary-500 text-sm">
            Backend worker heartbeat monitoring and performance metrics
          </p>
        </div>
        <div className="divide-y divide-secondary-800">
          {workerStatus.length === 0 ? (
            <div className="p-4 text-secondary-400 text-sm">
              No active workers detected. Backend workers will appear here once
              deployed.
            </div>
          ) : (
            workerStatus.map((worker) => (
              <div key={worker.worker_id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-secondary-100 font-medium">
                      Worker {worker.worker_id}
                    </div>
                    <div className="text-secondary-400 text-xs">
                      Last heartbeat:{" "}
                      {new Date(worker.last_heartbeat).toLocaleString()}
                      {worker.current_job_id &&
                        ` | Processing job: ${worker.current_job_id}`}
                    </div>
                    {worker.error_message && (
                      <div className="text-red-300 text-xs mt-1">
                        Error: {worker.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-secondary-200 text-sm">Uptime</div>
                      <div className="text-secondary-400 text-xs">
                        {Math.floor(worker.uptime_seconds / 3600)}h{" "}
                        {Math.floor((worker.uptime_seconds % 3600) / 60)}m
                      </div>
                    </div>
                    <WorkerStatusBadge status={worker.status} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-secondary-800/40 rounded p-2">
                    <div className="text-secondary-400">Jobs Processed</div>
                    <div className="text-secondary-200 font-medium">
                      {worker.jobs_processed}
                    </div>
                  </div>
                  <div className="bg-secondary-800/40 rounded p-2">
                    <div className="text-secondary-400">Jobs Failed</div>
                    <div className="text-red-300 font-medium">
                      {worker.jobs_failed}
                    </div>
                  </div>
                  <div className="bg-secondary-800/40 rounded p-2">
                    <div className="text-secondary-400">Proxy</div>
                    <div
                      className={`font-medium ${worker.proxy_enabled ? "text-green-300" : "text-secondary-300"}`}
                    >
                      {worker.proxy_enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <div className="bg-secondary-800/40 rounded p-2">
                    <div className="text-secondary-400">Captcha Credits</div>
                    <div className="text-secondary-200 font-medium">
                      {worker.captcha_credits}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

type WorkerStatusBadgeStatus = WorkerStatus["status"];
type StatusPillStatus = QueueStatus;

function WorkerStatusBadge({ status }: { status: WorkerStatusBadgeStatus }) {
  const colors: Record<WorkerStatusBadgeStatus, string> = {
    online: "bg-green-500/20 text-green-300 border-green-400/40",
    offline: "bg-secondary-800 text-secondary-300 border-secondary-700",
    idle: "bg-blue-500/20 text-blue-300 border-blue-400/40",
    processing: "bg-volt-500/10 text-volt-300 border-volt-500/40",
    error: "bg-red-500/10 text-red-300 border-red-500/40",
  };

  const labels: Record<WorkerStatusBadgeStatus, string> = {
    online: "Online",
    offline: "Offline",
    idle: "Idle",
    processing: "Processing",
    error: "Error",
  };

  return (
    <span className={`px-3 py-1 text-xs rounded-full border ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function StatusPill({ status }: { status: StatusPillStatus }) {
  const colors: Record<StatusPillStatus, string> = {
    pending: "bg-amber-500/10 text-amber-300 border-amber-500/40",
    in_progress: "bg-volt-500/10 text-volt-300 border-volt-500/40",
    complete: "bg-green-500/10 text-green-300 border-green-500/40",
    failed: "bg-red-500/10 text-red-300 border-red-500/40",
    cancelled: "bg-secondary-700 text-secondary-200 border-secondary-500/40",
  };

  return (
    <span className={`px-3 py-1 text-xs rounded-full border ${colors[status]}`}>
      {formatStatus(status)}
    </span>
  );
}

function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: QueueStatus;
}) {
  return (
    <div className="bg-secondary-900/60 border border-secondary-800 rounded-lg p-4">
      <div className="text-secondary-500 text-sm">{label}</div>
      <div className="text-2xl font-semibold text-secondary-100 mt-2">
        {value}
      </div>
      <div className="text-xs text-secondary-400 mt-1">
        Status: {formatStatus(status)}
      </div>
    </div>
  );
}

function ProcessableDirectoriesWidget() {
  const [size, setSize] = React.useState<number>(50)
  const [count, setCount] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [previewItems, setPreviewItems] = React.useState<any[] | null>(null)

  const check = async () => {
    try {
      setLoading(true)
      setCount(null)
      const res = await fetch(`/api/autobolt/directories?limit=${size}`)
      const json = await res.json()
      if (!res.ok && json.success === false) throw new Error(json.error || `HTTP ${res.status}`)
      setCount(json.data?.processableDirectories ?? json.data?.directories?.length ?? null)
    } catch (e) {
      setCount(null)
      console.error('Processable directories check failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const preview = async () => {
    try {
      setPreviewOpen(true)
      setPreviewItems(null)
      const res = await fetch(`/api/autobolt/directories?limit=${size}`)
      const json = await res.json()
      if (!res.ok && json.success === false) throw new Error(json.error || `HTTP ${res.status}`)
      // API returns directories array when using limit
      setPreviewItems(json.data?.directories || [])
    } catch (e) {
      console.error('Preview fetch failed:', e)
      setPreviewItems([])
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-secondary-400">Processable for</span>
      <select value={size} onChange={(e)=> setSize(Number(e.target.value))} className="bg-secondary-800 text-secondary-100 px-2 py-1 rounded border border-secondary-700">
        <option value={50}>50</option>
        <option value={100}>100</option>
        <option value={300}>300</option>
        <option value={500}>500</option>
      </select>
      <button onClick={check} className="px-2 py-1 bg-secondary-800 hover:bg-secondary-700 rounded text-secondary-100 border border-secondary-700">Check</button>
      <button onClick={preview} className="px-2 py-1 bg-secondary-800 hover:bg-secondary-700 rounded text-secondary-100 border border-secondary-700">Preview</button>
      {loading && <span className="text-secondary-400">...</span>}
      {typeof count === 'number' && (
        <span className="text-secondary-300">{count} directories</span>
      )}

      {previewOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-secondary-900 border border-secondary-700 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-3 border-b border-secondary-800">
              <div className="text-secondary-200 text-sm">Processable Directories (Top {size})</div>
              <button className="text-secondary-400 hover:text-white text-sm" onClick={()=> setPreviewOpen(false)}>Close</button>
            </div>
            <div className="p-3">
              {!previewItems && <div className="text-secondary-400 text-sm">Loading...</div>}
              {previewItems && previewItems.length === 0 && <div className="text-secondary-400 text-sm">No entries.</div>}
              {previewItems && previewItems.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-secondary-400">
                      <th className="text-left py-1">Name</th>
                      <th className="text-left py-1">URL</th>
                      <th className="text-left py-1">Category</th>
                      <th className="text-left py-1">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.slice(0, size).map((d:any, idx:number) => (
                      <tr key={idx} className="text-secondary-200">
                        <td className="py-1">{d.name}</td>
                        <td className="py-1"><a className="text-volt-300 hover:text-volt-200" href={d.url} target="_blank" rel="noreferrer">{d.url}</a></td>
                        <td className="py-1">{d.category}</td>
                        <td className="py-1">{d.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-400"
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 whitespace-nowrap align-top ${className ?? ''}`}>{children}</td>;
}
