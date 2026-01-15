/**
 * Enhanced PDF Report Generator (Phase 3)
 * 
 * Generates PDF reports with "Modern Artifact" aesthetic:
 * - Premium editorial layout
 * - Uses real AI analysis data
 * - White-label support
 * - Clean, professional design
 */

import type { BusinessIntelligenceResponse, AIInsights } from '../types/ai.types'
import { logger } from '../utils/logger'

// Dynamic import to avoid SSR issues
const getJsPDF = async () => {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

export interface PDFGenerationOptions {
  branding?: {
    companyName?: string
    logo?: string
    primaryColor?: string
    secondaryColor?: string
  }
  includeCharts?: boolean
  includeCompetitiveAnalysis?: boolean
  includeGrowthRoadmap?: boolean
}

/**
 * Enhanced PDF Generator with Modern Artifact aesthetic
 */
export class EnhancedPDFGenerator {
  /**
   * Generate PDF report from analysis data
   */
  static async generateReport(
    analysisData: BusinessIntelligenceResponse,
    options: PDFGenerationOptions = {}
  ): Promise<Blob> {
    try {
      logger.info('Generating PDF report', { url: analysisData.url })

      // Dynamic import to avoid SSR issues
      const jsPDF = await getJsPDF()
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      let yPosition = margin

      // Helper: Check page break
      const checkPageBreak = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }
      }

      // Helper: Add wrapped text
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number => {
        doc.setFontSize(fontSize)
        const lines = doc.splitTextToSize(text, maxWidth)
        doc.text(lines, x, y)
        return lines.length * (fontSize * 0.4)
      }

      // Header (Modern Artifact style)
      doc.setFillColor(250, 255, 235) // Volt-50
      doc.rect(0, 0, pageWidth, 30, 'F')
      
      doc.setDrawColor(229, 255, 153) // Volt-200
      doc.setLineWidth(1)
      doc.line(0, 30, pageWidth, 30)

      // Title (Neutral text, not Volt)
      doc.setTextColor(23, 23, 23) // Neutral-900
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Business Intelligence Report', margin, 20)

      // Business name
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Analysis for: ${analysisData.url}`, margin, 28)
      yPosition = 40

      // Date (serif accent for artifact moment)
      doc.setFont('times', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(82, 82, 82) // Neutral-600
      doc.text(`Generated: ${new Date(analysisData.timestamp).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`, margin, yPosition)
      yPosition += 15

      // Metrics Section
      checkPageBreak(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(23, 23, 23)
      doc.text('Key Metrics', margin, yPosition)
      yPosition += 10

      doc.setFont('courier', 'normal') // Monospace for numbers
      doc.setFontSize(11)
      yPosition += addWrappedText(`Visibility Score: ${analysisData.visibility}%`, margin, yPosition, pageWidth - 40)
      yPosition += addWrappedText(`SEO Score: ${analysisData.seoScore}%`, margin, yPosition, pageWidth - 40)
      yPosition += addWrappedText(`Directory Opportunities: ${analysisData.directoryOpportunities?.length || 0}`, margin, yPosition, pageWidth - 40)
      yPosition += addWrappedText(`Potential Monthly Leads: ${(analysisData.potentialLeads || 0).toLocaleString()}`, margin, yPosition, pageWidth - 40)
      yPosition += 15

      // Business Profile Section (if available)
      if (analysisData.aiAnalysis?.businessProfile) {
        checkPageBreak(60)
        const profile = analysisData.aiAnalysis.businessProfile
        
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(23, 23, 23)
        doc.text('Business Profile', margin, yPosition)
        yPosition += 10

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(82, 82, 82) // Neutral-600
        
        yPosition += addWrappedText(`Industry: ${profile.industry}`, margin, yPosition, pageWidth - 40)
        yPosition += addWrappedText(`Category: ${profile.category}`, margin, yPosition, pageWidth - 40)
        yPosition += addWrappedText(`Business Model: ${profile.businessModel}`, margin, yPosition, pageWidth - 40)
        
        if (profile.description) {
          yPosition += 5
          yPosition += addWrappedText(profile.description, margin, yPosition, pageWidth - 40)
        }

        if (profile.keyServices && profile.keyServices.length > 0) {
          yPosition += 5
          doc.setFont('helvetica', 'semibold')
          doc.text('Key Services:', margin, yPosition)
          yPosition += 7
          doc.setFont('helvetica', 'normal')
          profile.keyServices.slice(0, 5).forEach(service => {
            yPosition += addWrappedText(`• ${service}`, margin + 5, yPosition, pageWidth - 45)
          })
        }
        yPosition += 15
      }

      // Insights Section
      if (analysisData.aiAnalysis?.insights) {
        checkPageBreak(50)
        const insights = analysisData.aiAnalysis.insights

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(23, 23, 23)
        doc.text('Strategic Insights', margin, yPosition)
        yPosition += 10

        if (insights.competitiveAdvantages && Array.isArray(insights.competitiveAdvantages) && insights.competitiveAdvantages.length > 0) {
          doc.setFont('helvetica', 'semibold')
          doc.setFontSize(11)
          doc.text('Competitive Advantages:', margin, yPosition)
          yPosition += 7

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(82, 82, 82)
          insights.competitiveAdvantages.slice(0, 5).forEach((advantage: string) => {
            yPosition += addWrappedText(`• ${advantage}`, margin + 5, yPosition, pageWidth - 45)
          })
          yPosition += 5
        }

        if (insights.improvementSuggestions && Array.isArray(insights.improvementSuggestions) && insights.improvementSuggestions.length > 0) {
          doc.setFont('helvetica', 'semibold')
          doc.setFontSize(11)
          doc.setTextColor(23, 23, 23)
          doc.text('Recommendations:', margin, yPosition)
          yPosition += 7

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(82, 82, 82)
          insights.improvementSuggestions.slice(0, 5).forEach((suggestion: string) => {
            yPosition += addWrappedText(`• ${suggestion}`, margin + 5, yPosition, pageWidth - 45)
          })
        }
        yPosition += 15
      }
      
      // Competitive Analysis Section (if using legacy structure)
      if (analysisData.aiAnalysis?.competitiveAnalysis) {
        checkPageBreak(50)
        const compAnalysis = analysisData.aiAnalysis.competitiveAnalysis

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(23, 23, 23)
        doc.text('Competitive Analysis', margin, yPosition)
        yPosition += 10

        if (compAnalysis.competitiveAdvantages && Array.isArray(compAnalysis.competitiveAdvantages) && compAnalysis.competitiveAdvantages.length > 0) {
          doc.setFont('helvetica', 'semibold')
          doc.setFontSize(11)
          doc.text('Competitive Advantages:', margin, yPosition)
          yPosition += 7

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(82, 82, 82)
          compAnalysis.competitiveAdvantages.slice(0, 5).forEach((advantage: string) => {
            yPosition += addWrappedText(`• ${advantage}`, margin + 5, yPosition, pageWidth - 45)
          })
          yPosition += 5
        }

        if (compAnalysis.recommendedStrategies && Array.isArray(compAnalysis.recommendedStrategies) && compAnalysis.recommendedStrategies.length > 0) {
          doc.setFont('helvetica', 'semibold')
          doc.setFontSize(11)
          doc.setTextColor(23, 23, 23)
          doc.text('Recommended Strategies:', margin, yPosition)
          yPosition += 7

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(82, 82, 82)
          compAnalysis.recommendedStrategies.slice(0, 5).forEach((strategy: string) => {
            yPosition += addWrappedText(`• ${strategy}`, margin + 5, yPosition, pageWidth - 45)
          })
        }
        yPosition += 15
      }

      // Directory Opportunities Section
      if (analysisData.directoryOpportunities && analysisData.directoryOpportunities.length > 0) {
        checkPageBreak(80)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(23, 23, 23)
        doc.text('Top Directory Opportunities', margin, yPosition)
        yPosition += 10

        analysisData.directoryOpportunities.slice(0, 10).forEach((dir: any, index: number) => {
          checkPageBreak(25)
          
          // Directory name (bold)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.setTextColor(23, 23, 23)
          yPosition += addWrappedText(`${index + 1}. ${dir.name}`, margin, yPosition, pageWidth - 40)

          // Directory details (monospace for metrics)
          doc.setFont('courier', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(115, 115, 115) // Neutral-500
          const details = `Authority: ${dir.authority}/100 | Traffic: ${(dir.estimatedTraffic || 0).toLocaleString()}/mo | Success: ${dir.successProbability}%`
          yPosition += addWrappedText(details, margin + 5, yPosition, pageWidth - 45)
          yPosition += 3
        })
        yPosition += 10
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFont('times', 'normal') // Serif for artifact feel
        doc.setFontSize(8)
        doc.setTextColor(163, 163, 163) // Neutral-400
        const footerText = options.branding?.companyName || 'DirectoryBolt'
        doc.text(`${footerText} - Business Intelligence Report`, margin, pageHeight - 10)
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10)
      }

      // Generate PDF blob
      const pdfBlob = doc.output('blob')
      
      logger.info('PDF report generated successfully', {
        url: analysisData.url,
        pages: totalPages
      })

      return pdfBlob

    } catch (error) {
      logger.error('PDF generation failed', {
        url: analysisData.url,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
      throw new Error('Failed to generate PDF report')
    }
  }

  /**
   * Generate white-label PDF with custom branding
   */
  static async generateWhiteLabelPDF(
    analysisData: BusinessIntelligenceResponse,
    brandingOptions: Required<PDFGenerationOptions['branding']>
  ): Promise<Blob> {
    return this.generateReport(analysisData, {
      branding: brandingOptions,
      includeCharts: true,
      includeCompetitiveAnalysis: true
    })
  }
}
