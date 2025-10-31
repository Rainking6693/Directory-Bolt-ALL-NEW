'use client'
import React, { useState } from 'react'

// Analysis Export Functionality - Phase 2.3 DirectoryBolt AI-Enhanced plan
// PDF business intelligence reports, CSV directory lists, white-label report generation

interface DirectoryOpportunity {
  id: string
  name: string
  category: string
  authority: number
  estimatedTraffic: number
  submissionDifficulty: string
  cost: number
  relevanceScore: number
  successProbability: number
  priority: 'high' | 'medium' | 'low'
  reasoning: string
  optimizedDescription: string
  tags: string[]
  submissionTips: string[]
}

interface BusinessProfile {
  name: string
  description: string
  category: string
  industry: string
  targetAudience: string[]
  keywords: string[]
  businessModel: string
  size: string
  stage: string
}

interface ExportData {
  businessProfile: BusinessProfile
  directoryOpportunities: DirectoryOpportunity[]
  competitorAnalysis: any
  insights: any
  aiMetrics: any
  tier: 'free' | 'professional' | 'enterprise'
  analysisDate?: Date
}

interface ExporterProps {
  data: ExportData
  userTier: 'free' | 'professional' | 'enterprise'
  onExport?: (format: 'csv' | 'pdf') => void
}

interface WhiteLabelSettings {
  companyName: string
  companyLogo: string
  brandColor: string
  includeWatermark: boolean
  customFooter: string
}

export function AnalysisExporter({ data, userTier, onExport }: ExporterProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const [showWhiteLabelModal, setShowWhiteLabelModal] = useState(false)
  const [whiteLabelSettings, setWhiteLabelSettings] = useState<WhiteLabelSettings>({
    companyName: '',
    companyLogo: '',
    brandColor: '#f59e0b',
    includeWatermark: false,
    customFooter: ''
  })

  const canExport = userTier !== 'free'
  const canWhiteLabel = userTier === 'enterprise'

  const exportFormats = [
    {
      id: 'pdf-summary',
      name: 'PDF Summary Report',
      description: 'Executive summary with key findings and top opportunities',
      icon: '📄',
      premium: false,
      fileSize: '~2MB'
    },
    {
      id: 'pdf-detailed',
      name: 'PDF Detailed Report', 
      description: 'Complete analysis with all directories, insights, and recommendations',
      icon: '📊',
      premium: true,
      fileSize: '~5MB'
    },
    {
      id: 'csv-opportunities',
      name: 'CSV Directory List',
      description: 'Spreadsheet with all directory opportunities and metadata',
      icon: '📋',
      premium: false,
      fileSize: '~0.5MB'
    },
    {
      id: 'csv-detailed',
      name: 'CSV Advanced Export',
      description: 'Complete data export with success probabilities and AI insights',
      icon: '📈',
      premium: true,
      fileSize: '~1MB'
    },
    {
      id: 'white-label-pdf',
      name: 'White-Label PDF Report',
      description: 'Professional branded report for client presentation',
      icon: '🏷️',
      premium: true,
      enterpriseOnly: true,
      fileSize: '~3MB'
    }
  ]

  const handleExport = async (format: string) => {
    if (!canExport && exportFormats.find(f => f.id === format)?.premium) {
      // Premium feature - show upgrade prompt
      return
    }

    setIsExporting(format)

    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      switch (format) {
        case 'pdf-summary':
          await generatePDFSummary()
          break
        case 'pdf-detailed':
          await generatePDFDetailed()
          break
        case 'csv-opportunities':
          await generateCSVOpportunities()
          break
        case 'csv-detailed':
          await generateCSVDetailed()
          break
        case 'white-label-pdf':
          if (canWhiteLabel) {
            await generateWhiteLabelPDF()
          }
          break
      }

      // Call parent with correct format type
      if (format.includes('csv')) {
        onExport?.('csv')
      } else if (format.includes('pdf')) {
        onExport?.('pdf')
      }
    } catch (error) {
      console.error('Export failed:', error)
      // Export failed - could notify parent here if needed
    } finally {
      setIsExporting(null)
    }
  }

  const generatePDFSummary = async () => {
    const content = generatePDFContent(false)
    downloadFile(content, `${data.businessProfile.name}_Directory_Analysis_Summary.pdf`, 'application/pdf')
  }

  const generatePDFDetailed = async () => {
    const content = generatePDFContent(true)
    downloadFile(content, `${data.businessProfile.name}_Complete_Directory_Analysis.pdf`, 'application/pdf')
  }

  const generateCSVOpportunities = async () => {
    const csvContent = generateCSVContent(false)
    downloadFile(csvContent, `${data.businessProfile.name}_Directory_Opportunities.csv`, 'text/csv')
  }

  const generateCSVDetailed = async () => {
    const csvContent = generateCSVContent(true)
    downloadFile(csvContent, `${data.businessProfile.name}_Complete_Analysis_Data.csv`, 'text/csv')
  }

  const generateWhiteLabelPDF = async () => {
    if (!showWhiteLabelModal) {
      setShowWhiteLabelModal(true)
      return
    }

    const content = generateWhiteLabelPDFContent()
    downloadFile(content, `${whiteLabelSettings.companyName || data.businessProfile.name}_Directory_Analysis.pdf`, 'application/pdf')
    setShowWhiteLabelModal(false)
  }

  const generatePDFContent = (detailed: boolean) => {
    // In a real implementation, this would use a PDF library like jsPDF or similar
    const opportunities = detailed ? data.directoryOpportunities : data.directoryOpportunities.slice(0, 10)
    
    return `
      DIRECTORY BOLT ANALYSIS REPORT
      ============================
      
      Business: ${data.businessProfile.name}
      Industry: ${data.businessProfile.industry}
      Category: ${data.businessProfile.category}
      Analysis Date: ${data.analysisDate?.toLocaleDateString() || new Date().toLocaleDateString()}
      
      EXECUTIVE SUMMARY
      ================
      ${data.insights.marketPosition}
      
      DIRECTORY OPPORTUNITIES (${opportunities.length})
      ========================
      ${opportunities.map((opp, index) => `
        ${index + 1}. ${opp.name}
        - Authority: ${opp.authority}/100
        - Success Probability: ${opp.successProbability}%
        - Est. Traffic: ${opp.estimatedTraffic.toLocaleString()}/month
        - Cost: ${opp.cost === 0 ? 'FREE' : '$' + opp.cost}
        - Reasoning: ${opp.reasoning}
        ${detailed ? `- Optimized Description: ${opp.optimizedDescription}` : ''}
      `).join('\n')}
      
      ${detailed ? `
      COMPETITIVE ANALYSIS
      ===================
      ${data.competitorAnalysis.positioningAdvice}
      
      SUCCESS FACTORS
      ==============
      ${data.insights.successFactors.map((factor: string, index: number) => `${index + 1}. ${factor}`).join('\n')}
      ` : ''}
      
      Generated by DirectoryBolt AI Analysis System
    `
  }

  const generateCSVContent = (detailed: boolean) => {
    const opportunities = detailed ? data.directoryOpportunities : data.directoryOpportunities.slice(0, 10)
    
    const headers = detailed 
      ? ['Name', 'Category', 'Authority', 'Est_Traffic', 'Success_Probability', 'Relevance_Score', 'Priority', 'Cost', 'Difficulty', 'Reasoning', 'Optimized_Description', 'Tags']
      : ['Name', 'Category', 'Authority', 'Est_Traffic', 'Success_Probability', 'Priority', 'Cost', 'Difficulty']

    const csvRows = [
      headers.join(','),
      ...opportunities.map(opp => {
        const basicRow = [
          `"${opp.name}"`,
          `"${opp.category}"`,
          opp.authority,
          opp.estimatedTraffic,
          opp.successProbability,
          `"${opp.priority}"`,
          opp.cost,
          `"${opp.submissionDifficulty}"`
        ]

        if (detailed) {
          return [
            ...basicRow.slice(0, 5),
            opp.relevanceScore,
            ...basicRow.slice(5),
            `"${opp.reasoning.replace(/"/g, '""')}"`,
            `"${opp.optimizedDescription.replace(/"/g, '""')}"`,
            `"${opp.tags.join(', ')}"`
          ].join(',')
        }

        return basicRow.join(',')
      })
    ]

    return csvRows.join('\n')
  }

  const generateWhiteLabelPDFContent = () => {
    return `
      ${whiteLabelSettings.companyName.toUpperCase()} DIRECTORY ANALYSIS REPORT
      ${'='.repeat(whiteLabelSettings.companyName.length + 30)}
      
      Prepared for: ${data.businessProfile.name}
      Prepared by: ${whiteLabelSettings.companyName}
      Analysis Date: ${data.analysisDate?.toLocaleDateString() || new Date().toLocaleDateString()}
      
      EXECUTIVE SUMMARY
      ================
      ${data.insights.marketPosition}
      
      STRATEGIC RECOMMENDATIONS
      ========================
      Based on our comprehensive AI analysis, we have identified ${data.directoryOpportunities.length} directory opportunities 
      that align with your business objectives and market position.
      
      ${data.directoryOpportunities.slice(0, 15).map((opp, index) => `
        ${index + 1}. ${opp.name} (Success Rate: ${opp.successProbability}%)
        Strategy: ${opp.reasoning}
        Optimized Description: ${opp.optimizedDescription}
      `).join('\n')}
      
      ${whiteLabelSettings.customFooter ? `\n${whiteLabelSettings.customFooter}` : ''}
      ${!whiteLabelSettings.includeWatermark ? '' : '\nPowered by DirectoryBolt AI Analysis'}
    `
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const WhiteLabelModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary-800 rounded-xl max-w-md w-full p-6 border border-volt-500/30">
        <h3 className="text-xl font-bold text-white mb-4">White-Label Report Settings</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-secondary-300 mb-2">Company Name</label>
            <input
              type="text"
              value={whiteLabelSettings.companyName}
              onChange={e => setWhiteLabelSettings(prev => ({ ...prev, companyName: e.target.value }))}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white focus:border-volt-500 outline-none"
              placeholder="Your Agency Name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-secondary-300 mb-2">Custom Footer</label>
            <textarea
              value={whiteLabelSettings.customFooter}
              onChange={e => setWhiteLabelSettings(prev => ({ ...prev, customFooter: e.target.value }))}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white focus:border-volt-500 outline-none h-20 resize-none"
              placeholder="Contact information or additional branding..."
            />
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="watermark"
              checked={whiteLabelSettings.includeWatermark}
              onChange={e => setWhiteLabelSettings(prev => ({ ...prev, includeWatermark: e.target.checked }))}
              className="rounded border-secondary-600"
            />
            <label htmlFor="watermark" className="text-sm text-secondary-300">
              Include DirectoryBolt watermark
            </label>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => generateWhiteLabelPDF()}
            disabled={!whiteLabelSettings.companyName}
            className="flex-1 bg-volt-500 hover:bg-volt-600 disabled:bg-secondary-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Generate Report
          </button>
          <button
            onClick={() => setShowWhiteLabelModal(false)}
            className="px-4 py-2 border border-secondary-600 text-secondary-300 rounded-lg hover:bg-secondary-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="bg-secondary-800/50 backdrop-blur-sm rounded-xl border border-volt-500/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Export Analysis</h3>
            <p className="text-secondary-300 text-sm mt-1">
              Download your analysis in various formats for further use
            </p>
          </div>
          <div className="text-volt-400 text-3xl">📥</div>
        </div>

        <div className="grid gap-4">
          {exportFormats.map(format => {
            const isPremiumLocked = format.premium && !canExport
            const isEnterpriseLocked = format.enterpriseOnly && userTier !== 'enterprise'
            const isLocked = isPremiumLocked || isEnterpriseLocked
            
            return (
              <div
                key={format.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  isLocked 
                    ? 'bg-secondary-700/30 border-secondary-600 opacity-60' 
                    : 'bg-secondary-700/50 border-secondary-600 hover:bg-secondary-700 hover:border-volt-500/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{format.icon}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">{format.name}</h4>
                      {format.premium && (
                        <span className="px-2 py-1 bg-volt-500/20 text-volt-400 text-xs rounded border border-volt-500/30">
                          {format.enterpriseOnly ? 'Enterprise' : 'Premium'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-secondary-300">{format.description}</p>
                    <p className="text-xs text-secondary-400 mt-1">{format.fileSize}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleExport(format.id)}
                  disabled={isExporting === format.id || isLocked}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    isLocked
                      ? 'bg-secondary-600 text-secondary-400 cursor-not-allowed'
                      : isExporting === format.id
                      ? 'bg-volt-600 text-white'
                      : 'bg-volt-500 hover:bg-volt-600 text-white'
                  }`}
                >
                  {isExporting === format.id ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Exporting...
                    </span>
                  ) : isLocked ? (
                    '🔒 Locked'
                  ) : (
                    'Export'
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {!canExport && (
          <div className="mt-6 p-4 bg-gradient-to-r from-volt-500/10 to-volt-600/10 rounded-lg border border-volt-500/30">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🚀</div>
              <div>
                <h4 className="font-bold text-volt-400">Upgrade for Export Features</h4>
                <p className="text-sm text-secondary-300">
                  Get PDF reports, CSV exports, and white-label reports with premium plans
                </p>
              </div>
              <button 
                onClick={() => {/* Upgrade button - handled by parent */}}
                className="ml-auto bg-volt-500 hover:bg-volt-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Upgrade
              </button>
            </div>
          </div>
        )}
      </div>

      {showWhiteLabelModal && <WhiteLabelModal />}
    </>
  )
}