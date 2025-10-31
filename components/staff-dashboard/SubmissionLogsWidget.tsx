import React, { useEffect, useMemo, useState } from 'react'

interface LogRow {
  id: string
  customer_id: string
  job_id: string
  directory_name: string
  action: string
  timestamp: string
  details: string
  success: boolean
  error_message?: string
}

export default function SubmissionLogsWidget() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<{ job_id?: string; customer_id?: string }>({})

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.job_id) params.append('job_id', filters.job_id)
      if (filters.customer_id) params.append('customer_id', filters.customer_id)
      params.append('limit', '200')

      const res = await fetch(`/api/staff/submission-logs?${params.toString()}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      setRows(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    const t = setInterval(fetchLogs, 8000)
    return () => clearInterval(t)
  }, [filters])

  const counts = useMemo(() => {
    const c = { success: 0, errors: 0, manual: 0 }
    for (const r of rows) {
      if (r.success) c.success += 1
      if (!r.success) c.errors += 1
      if ((r.details || '').toLowerCase().includes('manual_required')) c.manual += 1
    }
    return c
  }, [rows])

  return (
    <div className="bg-secondary-800 border border-secondary-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Submission Activity</h3>
        <div className="flex space-x-2">
          <input
            className="bg-secondary-900 border border-secondary-700 text-secondary-200 text-xs px-2 py-1 rounded"
            placeholder="Filter by Job ID"
            value={filters.job_id || ''}
            onChange={(e) => setFilters({ ...filters, job_id: e.target.value.trim() || undefined })}
          />
          <input
            className="bg-secondary-900 border border-secondary-700 text-secondary-200 text-xs px-2 py-1 rounded"
            placeholder="Filter by Customer ID"
            value={filters.customer_id || ''}
            onChange={(e) => setFilters({ ...filters, customer_id: e.target.value.trim() || undefined })}
          />
          <button
            onClick={fetchLogs}
            className="text-xs px-2 py-1 bg-volt-500/10 border border-volt-500/30 text-volt-300 rounded hover:bg-volt-500/20"
          >Refresh</button>
        </div>
      </div>

      <div className="text-secondary-300 text-xs mb-2">
        <span className="mr-4">Success: {counts.success}</span>
        <span className="mr-4">Errors: {counts.errors}</span>
        <span className="">2FA/Manual: {counts.manual}</span>
      </div>

      {loading && <div className="text-secondary-400 text-sm">Loading logs...</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="overflow-auto max-h-96">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-secondary-400">
              <th className="text-left py-1 pr-2">Time</th>
              <th className="text-left py-1 pr-2">Job</th>
              <th className="text-left py-1 pr-2">Customer</th>
              <th className="text-left py-1 pr-2">Directory</th>
              <th className="text-left py-1 pr-2">Status</th>
              <th className="text-left py-1 pr-2">Screenshot</th>
              <th className="text-left py-1 pr-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="text-secondary-200 border-t border-secondary-700">
                <td className="py-1 pr-2 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                <td className="py-1 pr-2">{r.job_id}</td>
                <td className="py-1 pr-2">{r.customer_id}</td>
                <td className="py-1 pr-2">{r.directory_name}</td>
                <td className="py-1 pr-2">{r.details}</td>
                <td className="py-1 pr-2">{r as any && (r as any).screenshot_url && String((r as any).screenshot_url).startsWith('http') ? (
                  <a href={(r as any).screenshot_url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(r as any).screenshot_url} alt="screenshot" className="h-10 w-auto rounded border border-secondary-700" />
                  </a>
                ) : (
                  <span className="text-secondary-500">—</span>
                )}</td>
                <td className="py-1 pr-2 text-red-300">{r.error_message || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}