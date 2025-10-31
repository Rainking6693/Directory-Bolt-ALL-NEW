import React, { useCallback, useEffect, useMemo, useState } from "react";

type QueueFilter = "all" | "pending" | "in-progress" | "manual-review";
type SortOption = "priority" | "date" | "progress";

interface QueueCustomer {
  id: string;
  businessName: string;
  email: string;
  packageType: string;
  directoryLimit: number;
  status: "pending" | "in-progress" | "completed" | "manual-review";
  progress: number;
  submittedDirectories: number;
  priority: number;
  purchaseDate: string;
  assignedStaff?: string;
  estimatedCompletion: string;
  lastActivity: string;
}

interface CustomerQueueProps {
  staffId?: string;
  showAssignedOnly?: boolean;
}

const CustomerQueue: React.FC<CustomerQueueProps> = ({
  staffId,
  showAssignedOnly = false,
}) => {
  const [customers, setCustomers] = useState<QueueCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("priority");

  const fetchQueueData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (staffId) {
        params.append("staffId", staffId);
      }
      if (showAssignedOnly) {
        params.append("assignedOnly", "true");
      }

      const query = params.toString();
      const response = await fetch(
        query ? `/api/staff/queue?${query}` : "/api/staff/queue",
      );

      const data = await response.json();
      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : "Failed to fetch queue data.";
        throw new Error(message);
      }

      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load queue data.",
      );
    } finally {
      setLoading(false);
    }
  }, [showAssignedOnly, staffId]);

  useEffect(() => {
    void fetchQueueData();

    if (typeof window === "undefined") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void fetchQueueData();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [fetchQueueData]);

  const handleAssignCustomer = useCallback(
    async (customerId: string, staffMember: string) => {
      if (!staffMember) {
        return;
      }

      try {
        const response = await fetch("/api/staff/assign-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, staffId: staffMember }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Failed to assign customer.";
          throw new Error(message);
        }

        setError(null);
        await fetchQueueData();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to assign customer.",
        );
      }
    },
    [fetchQueueData],
  );

  const handleUpdateStatus = useCallback(
    async (customerId: string, newStatus: string) => {
      try {
        const response = await fetch("/api/staff/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, status: newStatus }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Failed to update status.";
          throw new Error(message);
        }

        setError(null);
        await fetchQueueData();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to update status.",
        );
      }
    },
    [fetchQueueData],
  );

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-100";
      case "in-progress":
        return "text-blue-600 bg-blue-100";
      case "pending":
        return "text-volt-600 bg-volt-100";
      case "manual-review":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getPriorityColor = (priority: number): string => {
    if (priority >= 150) return "text-red-600 bg-red-100";
    if (priority >= 100) return "text-orange-600 bg-orange-100";
    if (priority >= 50) return "text-blue-600 bg-blue-100";
    return "text-gray-600 bg-gray-100";
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (filter === "all") {
        return true;
      }
      return customer.status === filter;
    });
  }, [customers, filter]);

  const sortedCustomers = useMemo(() => {
    const snapshot = [...filteredCustomers];
    snapshot.sort((a, b) => {
      switch (sortBy) {
        case "priority":
          return b.priority - a.priority;
        case "date":
          return (
            new Date(a.purchaseDate).getTime() -
            new Date(b.purchaseDate).getTime()
          );
        case "progress":
          return a.progress - b.progress;
        default:
          return 0;
      }
    });
    return snapshot;
  }, [filteredCustomers, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-volt-500" />
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Customer Queue
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Monitor and assign directory processing jobs.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as QueueFilter)
              }
              className="bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="manual-review">Manual Review</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as SortOption)
              }
              className="bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm"
            >
              <option value="priority">Priority</option>
              <option value="date">Purchase Date</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Package
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {customer.businessName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {customer.email}
                      </div>
                      <div className="text-xs text-gray-400">{customer.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {customer.packageType}
                    </div>
                    <div className="text-xs text-gray-500">
                      {customer.directoryLimit} directories
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                        customer.priority,
                      )}`}
                    >
                      {customer.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        customer.status,
                      )}`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${customer.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">
                        {customer.progress}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {customer.submittedDirectories}/{customer.directoryLimit}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {customer.assignedStaff || "Unassigned"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() =>
                        window.open(
                          `/customer-portal?customerId=${customer.id}`,
                          "_blank",
                        )
                      }
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>

                    {customer.status === "pending" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(customer.id, "in-progress")
                        }
                        className="text-green-600 hover:text-green-900"
                      >
                        Start
                      </button>
                    )}

                    {customer.status === "in-progress" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(customer.id, "manual-review")
                        }
                        className="text-volt-600 hover:text-volt-900"
                      >
                        Review
                      </button>
                    )}

                    <select
                      onChange={(event) =>
                        handleAssignCustomer(customer.id, event.target.value)
                      }
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                      defaultValue=""
                    >
                      <option value="">Assign...</option>
                      <option value="staff1">John Doe</option>
                      <option value="staff2">Jane Smith</option>
                      <option value="staff3">Mike Johnson</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sortedCustomers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {filter === "all"
              ? "No customers in queue"
              : `No customers with status: ${filter}`}
          </div>
        </div>
      )}

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
            Live updates active
          </div>
          <div>Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
};

export default CustomerQueue;
