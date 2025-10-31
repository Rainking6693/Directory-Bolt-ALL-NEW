import React, { useEffect, useState } from 'react'

interface Row { id: string; name: string; category: string; enabled: boolean; pacing_min_ms: number | null; pacing_max_ms: number | null; max_retries: number | null }

export default function DirectorySettings() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/staff/directory-settings', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      setRows(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const save = async (row: Row) => {
    try {
      const payload = {
        directory_id: row.id,
        enabled: row.enabled,
        pacing_min_ms: row.pacing_min_ms ? Number(row.pacing_min_ms) : null,
        pacing_max_ms: row.pacing_max_ms ? Number(row.pacing_max_ms) : null,
        max_retries: row.max_retries ? Number(row.max_retries) : null,
      }
      const res = await fetch('/api/staff/directory-overrides/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
      fetchData()
      alert('Saved')
    } catch (e: any) {
      alert('Save failed: ' + e?.message)
    }
  }

  return (
    <div className="bg-secondary-800 border border-secondary-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Directory Settings</h3>
        <button className="text-xs px-2 py-1 bg-volt-500/10 border border-volt-500/30 text-volt-300 rounded hover:bg-volt-500/20" onClick={fetchData}>Refresh</button>
      </div>
      {loading && <div className="text-secondary-400 text-sm">Loading...</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="overflow-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-secondary-400">
              <th className="text-left py-1 pr-2">Directory</th>
              <th className="text-left py-1 pr-2">Category</th>
              <th className="text-left py-1 pr-2">Enabled</th>
              <th className="text-left py-1 pr-2">Pacing Min (ms)</th>
              <th className="text-left py-1 pr-2">Pacing Max (ms)</th>
              <th className="text-left py-1 pr-2">Retries</th>
              <th className="text-left py-1 pr-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="text-secondary-200 border-t border-secondary-700">
                <td className="py-1 pr-2">{r.name}</td>
                <td className="py-1 pr-2">{r.category}</td>
                <td className="py-1 pr-2">
                  <input type="checkbox" checked={r.enabled} onChange={(e) => setRows(prev => prev.map(x => x.id===r.id ? { ...x, enabled: e.target.checked } : x))} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" className="bg-secondary-900 border border-secondary-700 text-secondary-200 px-2 py-1 rounded w-28" value={r.pacing_min_ms || 0}
                    onChange={(e) => setRows(prev => prev.map(x => x.id===r.id ? { ...x, pacing_min_ms: Number(e.target.value) } : x))} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" className="bg-secondary-900 border border-secondary-700 text-secondary-200 px-2 py-1 rounded w-28" value={r.pacing_max_ms || 0}
                    onChange={(e) => setRows(prev => prev.map(x => x.id===r.id ? { ...x, pacing_max_ms: Number(e.target.value) } : x))} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" className="bg-secondary-900 border border-secondary-700 text-secondary-200 px-2 py-1 rounded w-20" value={r.max_retries || 1}
                    onChange={(e) => setRows(prev => prev.map(x => x.id===r.id ? { ...x, max_retries: Number(e.target.value) } : x))} />
                </td>
                <td className="py-1 pr-2">
                  <button className="text-xs px-2 py-1 bg-volt-500/10 border border-volt-500/30 text-volt-300 rounded hover:bg-volt-500/20" onClick={() => save(r)}>Save</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
