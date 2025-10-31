'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ReportConfig {
  id: string
  name: string
  description: string
  type: 'performance' | 'analytics' | 'directories' | 'competitive' | 'custom'
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly'
  format: 'pdf' | 'csv' | 'json' | 'excel'
  sections: ReportSection[]
  filters: ReportFilter[]
  branding: {
    includeLogo: boolean
    customHeader: string
    customFooter: string
    whiteLabel: boolean
  }
  recipients: string[]
  isActive: boolean
  lastGenerated?: string
  nextScheduled?: string
}

interface ReportSection {
  id: string
  type: 'summary' | 'chart' | 'table' | 'text' | 'image'
  title: string
  dataSource: string
  configuration: Record<string, any>
  order: number
}

interface ReportFilter {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in'
  value: any
  label: string
}

interface AdvancedReportingProps {
  organizationId: string
  userTier: string
  className?: string
}

const REPORT_TEMPLATES: Record<
  'performance' | 'analytics' | 'competitive',
  {
    name: string
    description: string
    sections: Array<Pick<ReportSection, 'type' | 'title' | 'dataSource'> & { configuration?: Record<string, any> }>
  }
> = {
  performance: {
    name: 'Performance Dashboard',
    description: 'Comprehensive business performance metrics',
    sections: [
      { type: 'summary', title: 'Executive Summary', dataSource: '/api/reports/performance-summary' },
      { type: 'chart', title: 'Directory Growth', dataSource: '/api/reports/directory-growth' },
      { type: 'table', title: 'Top Performing Directories', dataSource: '/api/reports/top-directories' },
      { type: 'chart', title: 'Traffic Trends', dataSource: '/api/reports/traffic-trends' }
    ]
  },
  analytics: {
    name: 'Analytics Deep Dive',
    description: 'Detailed analytics and insights report',
    sections: [
      { type: 'summary', title: 'Analytics Overview', dataSource: '/api/reports/analytics-summary' },
      { type: 'chart', title: 'User Engagement', dataSource: '/api/reports/user-engagement' },
      { type: 'chart', title: 'Conversion Funnel', dataSource: '/api/reports/conversion-funnel' },
      { type: 'table', title: 'Key Metrics', dataSource: '/api/reports/key-metrics' }
    ]
  },
  competitive: {
    name: 'Competitive Analysis',
    description: 'Market position and competitor insights',
    sections: [
      { type: 'summary', title: 'Market Position', dataSource: '/api/reports/market-position' },
      { type: 'chart', title: 'Competitive Landscape', dataSource: '/api/reports/competitive-landscape' },
      { type: 'table', title: 'Competitor Comparison', dataSource: '/api/reports/competitor-comparison' },
      { type: 'chart', title: 'Market Share Trends', dataSource: '/api/reports/market-share' }
    ]
  }
}

export default function AdvancedReporting({
  organizationId,
  userTier,
  className = ''
}: AdvancedReportingProps) {
  const [reports, setReports] = useState<ReportConfig[]>([])
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'reports' | 'templates' | 'scheduled'>('reports')

  const hasAdvancedReporting = ['professional', 'enterprise'].includes(userTier)

  useEffect(() => {
    if (hasAdvancedReporting) {
      loadReports()
    }
  }, [organizationId, hasAdvancedReporting])

  const loadReports = async () => {
    try {
      const response = await fetch(`/api/enterprise/reports?organizationId=${organizationId}`)
      if (response.ok) {
        const { reports } = await response.json()
        setReports(reports || [])
      }
    } catch (error) {
      console.error('Failed to load reports:', error)
    }
  }

  const generateReport = async (reportId: string) => {
    setIsGenerating(reportId)
    try {
      const response = await fetch('/api/enterprise/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, reportId })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${reportId}-${Date.now()}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setIsGenerating(null)
    }
  }

  const createReportFromTemplate = async (templateKey: string) => {
    const template = REPORT_TEMPLATES[templateKey as keyof typeof REPORT_TEMPLATES]
    if (!template) return

    const newReport: Omit<ReportConfig, 'id'> = {
      name: template.name,
      description: template.description,
      type: templateKey as ReportConfig['type'],
      schedule: 'manual',
      format: 'pdf',
      sections: template.sections.map((section, index) => ({
        ...section,
        id: `section-${index}`,
        order: index,
        configuration: section.configuration ?? {}
      })),
      filters: [],
      branding: {
        includeLogo: true,
        customHeader: '',
        customFooter: '',
        whiteLabel: userTier === 'enterprise'
      },
      recipients: [],
      isActive: true
    }

    try {
      const response = await fetch('/api/enterprise/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, report: newReport })
      })

      if (response.ok) {
        loadReports()
        setShowCreateModal(false)
      }
    } catch (error) {
      console.error('Failed to create report:', error)
    }
  }

  if (!hasAdvancedReporting) {
    return (
      <div className={`${className} bg-secondary-800 rounded-xl border border-secondary-700 p-8 text-center`}>
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Advanced Reporting</h3>
        <p className="text-secondary-400 mb-6">
          Generate comprehensive business reports with custom branding
        </p>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-blue-400 text-sm">
            Advanced reporting is available for Professional and Enterprise plans
          </p>
        </div>
        <button className="bg-volt-500 hover:bg-volt-400 text-secondary-900 px-6 py-3 rounded-lg font-medium transition-colors">
          Upgrade for Advanced Reporting
        </button>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 Advanced Reporting
          </h2>
          <p className="text-secondary-400">
            Generate custom reports with your branding
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
        >
          + Create Report
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        {[
          { id: 'reports', label: 'My Reports', icon: '📋' },
          { id: 'templates', label: 'Templates', icon: '📑' },
          { id: 'scheduled', label: 'Scheduled', icon: '⏰' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-volt-500/20 text-volt-400'
                : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700">
        {activeTab === 'reports' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Custom Reports</h3>
            
            {reports.length > 0 ? (
              <div className="space-y-4">
                {reports.map(report => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 bg-secondary-700/50 rounded-lg hover:bg-secondary-700 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-xl">📊</span>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-white">{report.name}</h4>
                        <p className="text-sm text-secondary-400 mb-1">{report.description}</p>
                        <div className="flex items-center gap-4 text-xs text-secondary-500">
                          <span>Type: {report.type}</span>
                          <span>Format: {report.format.toUpperCase()}</span>
                          <span>Schedule: {report.schedule}</span>
                          {report.lastGenerated && (
                            <span>Last: {new Date(report.lastGenerated).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="p-2 text-secondary-400 hover:text-white transition-colors"
                        title="Edit Report"
                      >
                        ✏️
                      </button>
                      
                      <button
                        onClick={() => generateReport(report.id)}
                        disabled={isGenerating === report.id}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isGenerating === report.id ? 'Generating...' : 'Generate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📊</span>
                <h3 className="text-lg font-semibold text-white mb-2">No reports yet</h3>
                <p className="text-secondary-400 mb-6">
                  Create your first custom report from our templates
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-volt-500 hover:bg-volt-400 text-secondary-900 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create Your First Report
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Report Templates</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(REPORT_TEMPLATES).map(([key, template]) => (
                <div
                  key={key}
                  className="bg-secondary-700/50 border border-secondary-600 rounded-lg p-6 hover:border-volt-500/50 transition-colors"
                >
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-volt-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl">📊</span>
                    </div>
                    <h4 className="font-semibold text-white mb-2">{template.name}</h4>
                    <p className="text-sm text-secondary-400 mb-4">{template.description}</p>
                  </div>

                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-white mb-2">Includes:</h5>
                    <ul className="text-xs text-secondary-400 space-y-1">
                      {template.sections.map((section, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-volt-400 rounded-full" />
                          {section.title}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => createReportFromTemplate(key)}
                    className="w-full bg-volt-500/20 hover:bg-volt-500/30 text-volt-400 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Scheduled Reports</h3>
            
            <div className="space-y-4">
              {reports.filter(r => r.schedule !== 'manual').map(report => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-secondary-700/50 rounded-lg"
                >
                  <div>
                    <h4 className="font-semibold text-white">{report.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-secondary-400 mt-1">
                      <span>📅 {report.schedule}</span>
                      <span>📧 {report.recipients.length} recipients</span>
                      {report.nextScheduled && (
                        <span>⏰ Next: {new Date(report.nextScheduled).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={report.isActive}
                        onChange={(e) => {
                          // Update report active status
                          console.log('Toggle report:', report.id, e.target.checked)
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-secondary-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-volt-500"></div>
                    </label>
                  </div>
                </div>
              ))}

              {reports.filter(r => r.schedule !== 'manual').length === 0 && (
                <div className="text-center py-8">
                  <span className="text-4xl mb-4 block">⏰</span>
                  <h3 className="text-lg font-semibold text-white mb-2">No scheduled reports</h3>
                  <p className="text-secondary-400">
                    Set up automatic report generation and delivery
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Report Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-secondary-700">
                <h3 className="text-xl font-bold text-white">Create New Report</h3>
                <p className="text-secondary-400 mt-1">Choose a template to get started</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(REPORT_TEMPLATES).map(([key, template]) => (
                    <div
                      key={key}
                      onClick={() => createReportFromTemplate(key)}
                      className="bg-secondary-700/50 border border-secondary-600 rounded-lg p-6 hover:border-volt-500/50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-volt-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-xl">📊</span>
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-semibold text-white group-hover:text-volt-400 transition-colors">
                            {template.name}
                          </h4>
                          <p className="text-sm text-secondary-400 mt-1 mb-3">
                            {template.description}
                          </p>
                          
                          <div className="space-y-1">
                            {template.sections.slice(0, 3).map((section, index) => (
                              <div key={index} className="text-xs text-secondary-500 flex items-center gap-2">
                                <span className="w-1 h-1 bg-volt-400 rounded-full" />
                                {section.title}
                              </div>
                            ))}
                            {template.sections.length > 3 && (
                              <div className="text-xs text-secondary-500">
                                +{template.sections.length - 3} more sections
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-secondary-700 flex justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-secondary-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}