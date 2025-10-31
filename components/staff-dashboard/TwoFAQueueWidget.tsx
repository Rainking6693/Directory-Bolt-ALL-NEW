import React, { useEffect, useState } from 'react'

interface QueueItem {
  job_id: string
  customer_id: string
  directory_name: string
  last_seen: string
}

function getGuidedUrl(directory_name: string, job_id: string, customer_id: string) {
  const name = (directory_name || '').toLowerCase()
  const qp = `?jobId=${encodeURIComponent(job_id)}&customerId=${encodeURIComponent(customer_id)}`
  if (name.includes('google')) return `https://business.google.com/create${qp}`
  if (name.includes('yelp')) return `https://biz.yelp.com/signup${qp}`
  if (name.includes('facebook')) return `https://www.facebook.com/pages/creation/${qp}`
  if (name.includes('apple')) return `https://mapsconnect.apple.com/${qp}`
  return `https://www.google.com/search${qp}`
}

export default function TwoFAQueueWidget() {
  const [rows, setRows] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/staff/2fa-queue', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      setRows(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load 2FA queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
    const t = setInterval(fetchQueue, 10000)
    return () => clearInterval(t)
  }, [])

  const resume = async (job_id: string) => {
    try {
      const res = await fetch('/api/staff/jobs/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId: job_id })
      })
      const json = await res.json()
      if (res.status === 202 && json.success) {
        alert('Job re-queued successfully')
        fetchQueue()
      } else {
        alert('Failed to resume: ' + (json.error || res.statusText))
      }
    } catch (e: any) {
      alert('Resume failed: ' + e?.message)
    }
  }

  return (
    <div className="bg-secondary-800 border border-secondary-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Manual / 2FA Queue</h3>
        <button className="text-xs px-2 py-1 bg-volt-500/10 border border-volt-500/30 text-volt-300 rounded hover:bg-volt-500/20" onClick={fetchQueue}>Refresh</button>
      </div>
      {loading && <div className="text-secondary-400 text-sm">Loading...</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="overflow-auto max-h-96">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-secondary-400">
              <th className="text-left py-1 pr-2">Last Seen</th>
              <th className="text-left py-1 pr-2">Job</th>
              <th className="text-left py-1 pr-2">Customer</th>
              <th className="text-left py-1 pr-2">Directory</th>
              <th className="text-left py-1 pr-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.job_id}-${r.directory_name}`} className="text-secondary-200 border-t border-secondary-700">
                <td className="py-1 pr-2 whitespace-nowrap">{new Date(r.last_seen).toLocaleString()}</td>
                <td className="py-1 pr-2">{r.job_id}</td>
                <td className="py-1 pr-2">{r.customer_id}</td>
                <td className="py-1 pr-2">{r.directory_name}</td>
                <td className="py-1 pr-2 space-x-2">
                  <a
                    href={getGuidedUrl(r.directory_name, r.job_id, r.customer_id)}
                    className="text-xs px-2 py-1 bg-secondary-900 border border-secondary-700 text-secondary-300 rounded hover:bg-secondary-800"
                    target="_blank"
                    rel="noreferrer"
                  >Open</a>
                  <button className="text-xs px-2 py-1 bg-volt-500/10 border border-volt-500/30 text-volt-300 rounded hover:bg-volt-500/20" onClick={() => resume(r.job_id)}>Resume</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}