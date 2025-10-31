import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import RealTimeQueue from '../components/staff-dashboard/RealTimeQueue';
import RealTimeAnalytics from '../components/staff-dashboard/RealTimeAnalytics';
import AutoBoltQueueMonitor from '../components/staff-dashboard/AutoBoltQueueMonitor';
import SubmissionLogsWidget from '../components/staff-dashboard/SubmissionLogsWidget';
import DirectorySettings from '../components/staff-dashboard/DirectorySettings';
import TwoFAQueueWidget from '../components/staff-dashboard/TwoFAQueueWidget';
import JobProgressMonitor from '../components/staff/JobProgressMonitor';
import { useRequireStaffAuth } from '../hooks/useStaffAuth';

type TabKey = 'queue' | 'jobs' | 'analytics' | 'autobolt' | 'activity' | 'manual' | 'settings';

const TABS: Array<{ key: TabKey; label: string; fullLabel: string }> = [
  { key: 'queue', label: 'Queue', fullLabel: 'Customer Queue' },
  { key: 'jobs', label: 'Jobs', fullLabel: 'Job Progress Monitor' },
  { key: 'analytics', label: 'Analytics', fullLabel: 'Real-Time Analytics' },
  { key: 'autobolt', label: 'AutoBolt', fullLabel: 'AutoBolt Monitor' },
  { key: 'activity', label: 'Activity', fullLabel: 'Submission Activity' },
  { key: 'manual', label: '2FA Queue', fullLabel: 'Manual / 2FA Queue' },
  { key: 'settings', label: 'Settings', fullLabel: 'Directory Settings' },
];

export default function StaffDashboard() {
  const { user, loading, isAuthenticated, logout } = useRequireStaffAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('queue');

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-volt-500 mx-auto mb-4"></div>
          <p className="text-secondary-300">Checking staff access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-secondary-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-secondary-300 mb-4">You need staff privileges to access this dashboard.</p>
          <button
            onClick={() => {
              window.location.href = '/staff-login';
            }}
            className="bg-volt-500 text-secondary-900 px-4 py-2 rounded-md hover:bg-volt-400 font-medium"
          >
            Go to Staff Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      title="Staff Dashboard - DirectoryBolt"
      description="Staff dashboard for managing customer queue and monitoring processing"
    >
      <div className="min-h-screen bg-secondary-900">
        <header className="bg-secondary-800 border-b border-secondary-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between py-4 lg:h-20 space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <h1 className="text-xl lg:text-2xl font-black text-white">Staff Dashboard</h1>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-secondary-300 text-sm">Live Data</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-secondary-300 text-sm">Welcome, {user?.username}</span>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/staff/create-test-customer', { method: 'POST', credentials: 'include' })
                      const json = await res.json()
                      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
                      alert(`✅ Test customer created. Customer ID: ${json.data?.customer_id}\nJob ID: ${json.data?.job_id}`)
                      // Refresh queue by switching tabs briefly
                      setActiveTab('queue')
                      window.location.reload()
                    } catch (e) {
                      alert(`Failed to create test customer: ${e instanceof Error ? e.message : String(e)}`)
                    }
                  }}
                  className="px-3 py-2 text-xs bg-volt-500/10 border border-volt-500/40 text-volt-300 rounded hover:bg-volt-500/15"
                >
                  + Create Test Customer
                </button>
                <button
                  onClick={() => { void logout(); }}
                  className="text-secondary-400 hover:text-red-400 text-sm transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
            <nav className="flex space-x-2 sm:space-x-8 -mb-px overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 px-3 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-volt-500 text-volt-400'
                      : 'border-transparent text-secondary-400 hover:text-secondary-300 hover:border-secondary-300'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.fullLabel}</span>
                  <span className="sm:hidden">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'queue' && <RealTimeQueue />}
          {activeTab === 'jobs' && <JobProgressMonitor />}
          {activeTab === 'analytics' && <RealTimeAnalytics />}
          {activeTab === 'autobolt' && <AutoBoltQueueMonitor />}
          {activeTab === 'activity' && <SubmissionLogsWidget />}
          {activeTab === 'manual' && <TwoFAQueueWidget />}
          {activeTab === 'settings' && <DirectorySettings />}
        </main>
      </div>
    </Layout>
  );
}
