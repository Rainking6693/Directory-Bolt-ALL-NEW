/**
 * Enhanced CSV Exporter (Phase 3)
 * 
 * Exports directory submission status list as CSV:
 * - All directory opportunities
 * - Submission status
 * - Metrics and metadata
 * - Clean, structured format
 */

import type { BusinessIntelligenceResponse } from '../types/ai.types'
import { logger } from '../utils/logger'

export interface CSVExportOptions {
  includeStatus?: boolean
  includeMetrics?: boolean
  includeAIReasoning?: boolean
}

/**
 * Enhanced CSV Exporter
 */
export class EnhancedCSVExporter {
  /**
   * Export directory opportunities as CSV
   */
  static exportDirectories(
    analysisData: BusinessIntelligenceResponse,
    options: CSVExportOptions = {}
  ): string {
    try {
      logger.info('Generating CSV export', { url: analysisData.url })

      if (!analysisData.directoryOpportunities || analysisData.directoryOpportunities.length === 0) {
        throw new Error('No directory opportunities to export')
      }

      const {
        includeStatus = false,
        includeMetrics = true,
        includeAIReasoning = false
      } = options

      // Build CSV headers
      const headers = [
        'Directory Name',
        'Category',
        'Authority Score',
        'Estimated Monthly Traffic',
        'Submission Difficulty',
        'Cost',
        'Success Probability (%)',
        'Submission URL'
      ]

      if (includeStatus) {
        headers.push('Status', 'Submitted Date', 'Notes')
      }

      if (includeAIReasoning) {
        headers.push('AI Recommendation')
      }

      // Build CSV rows
      const rows = analysisData.directoryOpportunities.map((dir: any, index: number) => {
        const row = [
          dir.name || '',
          dir.category || 'General Business',
          dir.authority || 0,
          dir.estimatedTraffic || 0,
          dir.submissionDifficulty || 'Medium',
          dir.cost === 0 || dir.cost === 'Free' ? 'Free' : `$${dir.cost || 0}`,
          dir.successProbability || 0,
          dir.submissionUrl || `https://${dir.name?.toLowerCase().replace(/\s+/g, '')}.com` || ''
        ]

        if (includeStatus) {
          row.push('Pending', '', '') // Status, Date, Notes
        }

        if (includeAIReasoning) {
          row.push(dir.reasoning || dir.aiReasoning || 'High authority directory with good traffic potential')
        }

        return row
      })

      // Escape CSV values
      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      // Build CSV content
      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n')

      // Add BOM for Excel compatibility
      const bom = '\uFEFF'
      const csvWithBom = bom + csvContent

      logger.info('CSV export generated successfully', {
        url: analysisData.url,
        rowCount: rows.length
      })

      return csvWithBom

    } catch (error) {
      logger.error('CSV export failed', {
        url: analysisData.url,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
      throw new Error('Failed to generate CSV export')
    }
  }

  /**
   * Download CSV file (client-side)
   */
  static downloadCSV(csvContent: string, filename: string): void {
    if (typeof window === 'undefined') {
      throw new Error('CSV download is only available in browser environment')
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  /**
   * Generate filename for CSV export
   */
  static generateFilename(businessName: string, includeDate: boolean = true): string {
    const sanitized = businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    const date = includeDate ? `-${new Date().toISOString().slice(0, 10)}` : ''
    return `DirectoryBolt-Opportunities-${sanitized}${date}.csv`
  }
}
