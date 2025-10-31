// 🚀 EXPORT UTILITIES - PDF & CSV GENERATION
// Phase 2 export functionality for analysis results

import { BusinessIntelligence } from '../types/business-intelligence'

// PDF Export using jsPDF (client-side)
export const generatePDFReport = async (analysisData: any, businessName: string) => {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import('jspdf')
  
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 20

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return y + (lines.length * fontSize * 0.4)
  }

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('DirectoryBolt AI Business Intelligence Report', 20, yPosition)
  yPosition += 15

  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text(`Analysis for: ${businessName}`, 20, yPosition)
  yPosition += 10

  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition)
  yPosition += 20

  // Business Profile Section
  if (analysisData.aiAnalysis?.businessProfile) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Business Profile', 20, yPosition)
    yPosition += 10

    const profile = analysisData.aiAnalysis.businessProfile
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    yPosition = addText(`Industry: ${profile.industry || 'N/A'}`, 20, yPosition, pageWidth - 40)
    yPosition = addText(`Category: ${profile.category || 'N/A'}`, 20, yPosition, pageWidth - 40)
    yPosition = addText(`Business Model: ${profile.businessModel || 'N/A'}`, 20, yPosition, pageWidth - 40)
    yPosition += 10
  }

  // Key Metrics Section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Key Metrics', 20, yPosition)
  yPosition += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  yPosition = addText(`Visibility Score: ${Math.round(analysisData.visibility || 0)}%`, 20, yPosition, pageWidth - 40)
  yPosition = addText(`SEO Score: ${Math.round(analysisData.seoScore || 0)}%`, 20, yPosition, pageWidth - 40)
  yPosition = addText(`Directory Opportunities: ${analysisData.directoryOpportunities?.length || 0}`, 20, yPosition, pageWidth - 40)
  yPosition = addText(`Potential Monthly Leads: ${(analysisData.potentialLeads || 0).toLocaleString()}`, 20, yPosition, pageWidth - 40)
  yPosition += 15

  // Directory Opportunities Section
  if (analysisData.directoryOpportunities?.length > 0) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Top Directory Opportunities', 20, yPosition)
    yPosition += 10

    analysisData.directoryOpportunities.slice(0, 10).forEach((dir: any, index: number) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      yPosition = addText(`${index + 1}. ${dir.name}`, 20, yPosition, pageWidth - 40, 12)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      yPosition = addText(`Authority: ${dir.authority || 0}/100 | Traffic: ${(dir.estimatedTraffic || 0).toLocaleString()}/month`, 25, yPosition, pageWidth - 50)
      yPosition = addText(`Difficulty: ${dir.submissionDifficulty || 'Medium'} | Cost: ${dir.cost === 0 ? 'FREE' : `$${dir.cost}`}`, 25, yPosition, pageWidth - 50)
      yPosition += 8
    })
  }

  // AI Insights Section
  if (analysisData.aiAnalysis?.insights) {
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('AI Insights & Recommendations', 20, yPosition)
    yPosition += 10

    const insights = analysisData.aiAnalysis.insights
    
    if (insights.competitiveAdvantages?.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Competitive Advantages:', 20, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      insights.competitiveAdvantages.forEach((advantage: string) => {
        yPosition = addText(`• ${advantage}`, 25, yPosition, pageWidth - 50)
      })
      yPosition += 5
    }

    if (insights.improvementSuggestions?.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Improvement Suggestions:', 20, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      insights.improvementSuggestions.forEach((suggestion: string) => {
        yPosition = addText(`• ${suggestion}`, 25, yPosition, pageWidth - 50)
      })
    }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`DirectoryBolt.com - AI Business Intelligence Platform`, 20, pageHeight - 10)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, pageHeight - 10)
  }

  // Generate filename
  const filename = `DirectoryBolt-Analysis-${businessName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
  
  // Save the PDF
  doc.save(filename)
  
  return filename
}

// CSV Export for directory opportunities
export const generateCSVExport = (analysisData: any, businessName: string) => {
  if (!analysisData.directoryOpportunities?.length) {
    throw new Error('No directory opportunities to export')
  }

  // CSV Headers
  const headers = [
    'Directory Name',
    'Domain Authority',
    'Estimated Monthly Traffic',
    'Submission Difficulty',
    'Cost',
    'Success Probability',
    'Category',
    'Submission URL',
    'AI Reasoning'
  ]

  // Convert data to CSV rows
  const rows = analysisData.directoryOpportunities.map((dir: any) => [
    dir.name || '',
    dir.authority || 0,
    dir.estimatedTraffic || 0,
    dir.submissionDifficulty || 'Medium',
    dir.cost === 0 ? 'FREE' : `$${dir.cost || 0}`,
    `${dir.successProbability || 0}%`,
    dir.category || 'General',
    dir.submissionUrl || '',
    (dir.reasoning || '').replace(/"/g, '""') // Escape quotes
  ])

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row: any[]) => 
      row.map(cell => 
        typeof cell === 'string' && cell.includes(',') 
          ? `"${cell}"` 
          : cell
      ).join(',')
    )
  ].join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    const filename = `DirectoryBolt-Opportunities-${businessName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
    return filename
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = csvContent
    document.body.appendChild(textArea)
    textArea.select()
    
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('CSV data copied to clipboard. Please paste into a text file and save as .csv')
      return 'clipboard_copy.csv'
    } catch (err) {
      document.body.removeChild(textArea)
      throw new Error('CSV export not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.')
    }
  }
}

// Sample PDF generation for demo
export const generateSamplePDF = async () => {
  const sampleData = {
    aiAnalysis: {
      businessProfile: {
        name: 'TechFlow Solutions',
        industry: 'Software Development',
        category: 'B2B SaaS',
        businessModel: 'Subscription SaaS'
      },
      insights: {
        competitiveAdvantages: [
          'Developer-focused feature set',
          'Competitive pricing model',
          'Strong technical documentation'
        ],
        improvementSuggestions: [
          'Increase directory presence by 73%',
          'Optimize for local SEO opportunities',
          'Expand content marketing strategy'
        ]
      }
    },
    visibility: 34,
    seoScore: 67,
    potentialLeads: 850,
    directoryOpportunities: [
      {
        name: 'Product Hunt',
        authority: 91,
        estimatedTraffic: 5000,
        submissionDifficulty: 'Medium',
        cost: 0,
        successProbability: 87,
        reasoning: 'Perfect fit for tech product launches with high developer engagement'
      },
      {
        name: 'G2.com',
        authority: 89,
        estimatedTraffic: 4200,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 92,
        reasoning: 'Strong category match for B2B software with excellent review potential'
      }
    ]
  }

  return generatePDFReport(sampleData, 'TechFlow Solutions')
}

// Sample CSV generation for demo
export const generateSampleCSV = () => {
  const sampleData = {
    directoryOpportunities: [
      {
        name: 'Product Hunt',
        authority: 91,
        estimatedTraffic: 5000,
        submissionDifficulty: 'Medium',
        cost: 0,
        successProbability: 87,
        category: 'Tech Launch Platforms',
        submissionUrl: 'https://producthunt.com',
        reasoning: 'Perfect fit for tech product launches with high developer engagement'
      },
      {
        name: 'G2.com',
        authority: 89,
        estimatedTraffic: 4200,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 92,
        category: 'Software Reviews',
        submissionUrl: 'https://g2.com',
        reasoning: 'Strong category match for B2B software with excellent review potential'
      }
    ]
  }

  return generateCSVExport(sampleData, 'TechFlow Solutions')
}