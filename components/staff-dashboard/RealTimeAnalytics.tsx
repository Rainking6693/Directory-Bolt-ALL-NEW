// Fixed Real-Time Analytics Component for Staff Dashboard
// Displays live data from Supabase database

import React, { useState, useEffect } from "react";

interface AnalyticsData {
  overview: {
    total_customers: number;
    active_customers: number;
    pending_customers: number;
    completed_customers: number;
    recent_activity: number;
  };
  package_breakdown: Record<string, number>;
  directory_stats: {
    total_allocated: number;
    total_submitted: number;
    total_failed: number;
    completion_rate: number;
    success_rate: number;
  };
  performance_metrics: {
    avg_directories_per_customer: number;
    processing_efficiency: number;
    customer_satisfaction: number;
  };
  trends: {
    daily_submissions: Array<{
      date: string;
      customers_updated: number;
      directories_submitted: number;
    }>;
    package_performance: Record<
      string,
      {
        total_customers: number;
        total_directories_allocated: number;
        total_directories_submitted: number;
        total_directories_failed: number;
        completion_rate: number;
      }
    >;
  };
}

export default function RealTimeAnalytics(): JSX.Element {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[] | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/staff/analytics", { credentials: 'include' });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please sign in to the Staff Portal');
        }
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(result.message || "Failed to load analytics");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500"></div>
        <p className="ml-4 text-secondary-300">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-600/10 border border-red-500/20 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium">Failed to load analytics</p>
        <p className="text-red-300 text-sm mt-2">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-secondary-400 p-8">
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Real-Time Analytics</h2>
        <div className="flex items-center space-x-2 text-secondary-300">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Live"}
          </span>
        </div>
      </div>
{detail && (
        <div className="bg-secondary-800 rounded-lg border border-secondary-700 p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-secondary-200 font-medium">Details: {detail}</div>
            <button onClick={() => { setDetail(null); setDetailItems(null); setPage(1); }} className="text-secondary-400 hover:text-white text-sm">Close</button>
          </div>
          {(['Total Customers','Active Customers','Completed','Success Rate'].includes(detail)) && (
            <DetailList detail={detail} items={detailItems} setItems={setDetailItems} page={page} setPage={setPage} pageSize={pageSize} />
          )}
          {!(['Total Customers','Active Customers','Completed','Success Rate'].includes(detail)) && (
            <div className="text-secondary-300 text-sm">No list available for this tile yet.</div>
          )}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <button onClick={() => setDetail('Total Customers')} className="bg-secondary-800 rounded-xl p-6 border border-secondary-700 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-400 text-sm">Total Customers</p>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.total_customers}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </button>

        <button onClick={() => setDetail('Active Customers')} className="bg-secondary-800 rounded-xl p-6 border border-secondary-700 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-400 text-sm">Active Customers</p>
              <p className="text-3xl font-bold text-green-400">
                {analytics.overview.active_customers}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </button>

        <button onClick={() => setDetail('Completed')} className="bg-secondary-800 rounded-xl p-6 border border-secondary-700 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-400 text-sm">Completed</p>
              <p className="text-3xl font-bold text-volt-400">
                {analytics.overview.completed_customers}
              </p>
            </div>
            <div className="w-12 h-12 bg-volt-500/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </button>

        <button onClick={() => setDetail('Success Rate')} className="bg-secondary-800 rounded-xl p-6 border border-secondary-700 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-400 text-sm">Success Rate</p>
              <p className="text-3xl font-bold text-green-400">
                {analytics.directory_stats.success_rate}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
          </div>
        </button>
      </div>

      {/* Directory Statistics */}
      <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700">
        <h3 className="text-xl font-bold text-white mb-4">
          Directory Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <button onClick={() => setDetail('Total Allocated')} className="text-center">
            <p className="text-2xl font-bold text-white">
              {analytics.directory_stats.total_allocated.toLocaleString()}
            </p>
            <p className="text-secondary-400 text-sm">Total Allocated</p>
          </button>
          <button onClick={() => setDetail('Submitted')} className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {analytics.directory_stats.total_submitted.toLocaleString()}
            </p>
            <p className="text-secondary-400 text-sm">Submitted</p>
          </button>
          <button onClick={() => setDetail('Failed')} className="text-center">
            <p className="text-2xl font-bold text-red-400">
              {analytics.directory_stats.total_failed.toLocaleString()}
            </p>
            <p className="text-secondary-400 text-sm">Failed</p>
          </button>
          <button onClick={() => setDetail('Completion Rate')} className="text-center">
            <p className="text-2xl font-bold text-volt-400">
              {analytics.directory_stats.completion_rate}%
            </p>
            <p className="text-secondary-400 text-sm">Completion Rate</p>
          </button>
        </div>
      </div>

      {/* Package Breakdown */}
      <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700">
        <h3 className="text-xl font-bold text-white mb-4">
          Package Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(analytics.package_breakdown).map(
            ([packageType, count]) => (
              <button key={packageType} onClick={() => setDetail(`Package: ${packageType}`)} className="text-center">
                <p className="text-2xl font-bold text-volt-400">
                  {count as number}
                </p>
                <p className="text-secondary-400 text-sm capitalize">
                  {packageType}
                </p>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700">
        <h3 className="text-xl font-bold text-white mb-4">
          Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button onClick={() => setDetail('Recent Updates (24h)')} className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {analytics.overview.recent_activity}
            </p>
            <p className="text-secondary-400 text-sm">Recent Updates (24h)</p>
          </button>
          <button onClick={() => setDetail('Avg Directories/Customer')} className="text-center">
            <p className="text-2xl font-bold text-blue-400">
              {analytics.performance_metrics.avg_directories_per_customer}
            </p>
            <p className="text-secondary-400 text-sm">
              Avg Directories/Customer
            </p>
          </button>
          <button onClick={() => setDetail('Customer Satisfaction')} className="text-center">
            <p className="text-2xl font-bold text-volt-400">
              {analytics.performance_metrics.customer_satisfaction}%
            </p>
            <p className="text-secondary-400 text-sm">Customer Satisfaction</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailList({ detail, items, setItems, page, setPage, pageSize }:{ detail: string, items: any[] | null, setItems: (v:any[] | null)=>void, page:number, setPage:(n:number)=>void, pageSize:number }){
  React.useEffect(() => {
    const map: Record<string,string> = {
      'Total Customers': 'total_customers',
      'Active Customers': 'active_customers',
      'Completed': 'completed_customers',
      'Success Rate': 'total_customers'
    }
    const key = map[detail]
    if (!key) return
    ;(async () => {
      try {
        setItems(null)
        const res = await fetch(`/api/staff/analytics?detail=${encodeURIComponent(key)}`, { credentials: 'include' })
        const json = await res.json()
        if (res.ok && json.success !== false) {
          setItems(json.data || [])
        } else {
          setItems([])
        }
      } catch { setItems([]) }
    })()
  }, [detail, setItems])

  const total = items?.length || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = (items || []).slice(start, start + pageSize)

  return (
    <div>
      {!items && <div className="text-secondary-400 text-sm">Loading...</div>}
      {items && items.length === 0 && <div className="text-secondary-400 text-sm">No records.</div>}
      {items && items.length > 0 && (
        <>
          <table className="w-full text-sm mb-2">
            <thead>
              <tr className="text-secondary-400">
                <th className="text-left py-1">Business</th>
                <th className="text-left py-1">Email</th>
                <th className="text-left py-1">Status</th>
                <th className="text-left py-1">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r:any, idx:number) => (
                <tr key={idx} className="text-secondary-200">
                  <td className="py-1">{r.business_name || 'N/A'}</td>
                  <td className="py-1">{r.email || ''}</td>
                  <td className="py-1">{r.status || ''}</td>
                  <td className="py-1">{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between text-xs text-secondary-400">
            <span>Page {page} / {totalPages} ({total} total)</span>
            <div className="space-x-2">
              <button disabled={page<=1} onClick={()=>setPage(Math.max(1, page-1))} className="px-2 py-1 bg-secondary-800 border border-secondary-700 rounded disabled:opacity-50">Prev</button>
              <button disabled={page>=totalPages} onClick={()=>setPage(Math.min(totalPages, page+1))} className="px-2 py-1 bg-secondary-800 border border-secondary-700 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
