// PDF Generation for Sample Analysis Reports
// This would integrate with a PDF generation service like jsPDF, PDFKit, or Puppeteer

import { SampleAnalysisData } from '../data/sample-analysis-data'

export interface PDFGenerationOptions {
  includeCharts?: boolean
  includeBranding?: boolean
  watermark?: string
  format?: 'A4' | 'Letter'
  orientation?: 'portrait' | 'landscape'
}

export class PDFGenerator {
  static async generateSampleReport(
    analysis: SampleAnalysisData,
    options: PDFGenerationOptions = {}
  ): Promise<Blob | string> {
    const {
      includeCharts = true,
      includeBranding = true,
      watermark = 'SAMPLE REPORT - Get your real analysis at DirectoryBolt.com',
      format = 'A4',
      orientation = 'portrait'
    } = options

    // In a real implementation, this would use a PDF library
    // For now, we'll return a structured HTML that could be converted to PDF
    const htmlContent = this.generateHTMLReport(analysis, {
      includeCharts,
      includeBranding,
      watermark,
      format,
      orientation
    })

    // In production, this would be converted to PDF using:
    // - Puppeteer (server-side)
    // - jsPDF (client-side)
    // - PDFKit (Node.js)
    // - External API service

    return new Blob([htmlContent], { type: 'text/html' })
  }

  private static generateHTMLReport(
    analysis: SampleAnalysisData,
    options: PDFGenerationOptions
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${analysis.businessProfile.name} - AI Analysis Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }
        
        .page {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            position: relative;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            color: rgba(0, 0, 0, 0.1);
            font-weight: bold;
            z-index: -1;
            white-space: nowrap;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #6366f1;
        }
        
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 10px;
        }
        
        .title {
            font-size: 32px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: #6b7280;
            font-size: 18px;
        }
        
        .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .business-profile {
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
        }
        
        .business-name {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 12px;
        }
        
        .business-description {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 20px;
        }
        
        .business-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        
        .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .detail-icon {
            font-size: 16px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border-radius: 12px;
        }
        
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .metric-label {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .recommendation-item {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
        }
        
        .recommendation-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }
        
        .recommendation-title {
            font-size: 20px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 8px;
        }
        
        .recommendation-metrics {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            font-size: 14px;
            color: #6b7280;
        }
        
        .priority-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .priority-high {
            background: #dcfce7;
            color: #166534;
        }
        
        .priority-medium {
            background: #fef3c7;
            color: #92400e;
        }
        
        .priority-low {
            background: #f3f4f6;
            color: #4b5563;
        }
        
        .reasoning {
            color: #4b5563;
            margin-bottom: 16px;
        }
        
        .optimized-description {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }
        
        .description-label {
            font-size: 14px;
            font-weight: semibold;
            color: #0284c7;
            margin-bottom: 8px;
        }
        
        .tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .tag {
            background: #e0e7ff;
            color: #3730a3;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
        }
        
        .insights-list {
            list-style: none;
            margin-bottom: 20px;
        }
        
        .insights-list li {
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .insights-list li:last-child {
            border-bottom: none;
        }
        
        .insight-icon {
            font-size: 16px;
            margin-top: 2px;
        }
        
        .competitor-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }
        
        .competitor-name {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 12px;
        }
        
        .competitor-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }
        
        .detail-section {
            background: white;
            padding: 12px;
            border-radius: 6px;
        }
        
        .detail-section h4 {
            font-size: 14px;
            font-weight: semibold;
            color: #4b5563;
            margin-bottom: 8px;
        }
        
        .detail-section ul {
            list-style: none;
            font-size: 14px;
            color: #6b7280;
        }
        
        .detail-section li {
            margin-bottom: 4px;
        }
        
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #e5e7eb;
            color: #6b7280;
        }
        
        .cta {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 24px;
            border-radius: 12px;
            text-align: center;
            margin-top: 40px;
        }
        
        .cta-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 12px;
        }
        
        .cta-text {
            font-size: 16px;
            margin-bottom: 20px;
            opacity: 0.9;
        }
        
        .cta-button {
            display: inline-block;
            background: white;
            color: #6366f1;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
        }
        
        @media print {
            .page {
                margin: 0;
                padding: 20px;
            }
            
            .watermark {
                display: none;
            }
            
            .cta {
                display: none;
            }
        }
    </style>
</head>
<body>
    ${options.watermark ? `<div class="watermark">${options.watermark}</div>` : ''}
    
    <div class="page">
        ${options.includeBranding ? `
        <div class="header">
            <div class="logo">⚡ DirectoryBolt</div>
            <h1 class="title">AI Business Analysis Report</h1>
            <p class="subtitle">Comprehensive Directory Strategy & Market Intelligence</p>
        </div>
        ` : ''}
        
        <!-- Business Profile Section -->
        <div class="section">
            <div class="business-profile">
                <h2 class="business-name">${analysis.businessProfile.name}</h2>
                <p class="business-description">${analysis.businessProfile.description}</p>
                
                <div class="business-details">
                    <div class="detail-item">
                        <span class="detail-icon">🏢</span>
                        <span><strong>Category:</strong> ${analysis.businessProfile.category}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🎯</span>
                        <span><strong>Industry:</strong> ${analysis.businessProfile.industry}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">📍</span>
                        <span><strong>Location:</strong> ${analysis.businessProfile.location.city}, ${analysis.businessProfile.location.region}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">📊</span>
                        <span><strong>Business Size:</strong> ${analysis.businessProfile.size}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Key Metrics -->
        <div class="section">
            <h2 class="section-title">Analysis Results</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${analysis.recommendations.length}</div>
                    <div class="metric-label">Directory Matches</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${analysis.confidence}%</div>
                    <div class="metric-label">AI Confidence</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">+${analysis.projectedResults.monthlyTrafficIncrease.toLocaleString()}</div>
                    <div class="metric-label">Monthly Traffic</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">$${analysis.projectedResults.revenueProjection.toLocaleString()}</div>
                    <div class="metric-label">Revenue Potential</div>
                </div>
            </div>
        </div>
        
        <!-- Directory Recommendations -->
        <div class="section">
            <h2 class="section-title">Top Directory Recommendations</h2>
            ${analysis.recommendations.slice(0, 5).map((rec, index) => `
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div>
                        <h3 class="recommendation-title">#${index + 1} ${rec.name}</h3>
                        <div class="recommendation-metrics">
                            <span>🎯 ${rec.relevanceScore}% Match</span>
                            <span>📈 ${rec.successProbability}% Success Rate</span>
                            <span>👥 ${rec.estimatedTraffic.toLocaleString()} Monthly Visitors</span>
                        </div>
                    </div>
                    <div class="priority-badge priority-${rec.priority}">
                        ${rec.priority} Priority
                    </div>
                </div>
                
                <p class="reasoning">${rec.reasoning}</p>
                
                <div class="optimized-description">
                    <div class="description-label">Optimized Description:</div>
                    <p>"${rec.optimizedDescription}"</p>
                </div>
                
                <div class="tags">
                    ${rec.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
            `).join('')}
        </div>
        
        <!-- Strategic Insights -->
        <div class="section">
            <h2 class="section-title">Strategic Insights</h2>
            
            <h3 style="margin-bottom: 16px; color: #1f2937;">Market Position</h3>
            <p style="margin-bottom: 24px; color: #4b5563;">${analysis.insights.marketPosition}</p>
            
            <h3 style="margin-bottom: 12px; color: #1f2937;">Competitive Advantages</h3>
            <ul class="insights-list">
                ${analysis.insights.competitiveAdvantages.map(advantage => `
                <li>
                    <span class="insight-icon">✅</span>
                    <span>${advantage}</span>
                </li>
                `).join('')}
            </ul>
            
            <h3 style="margin-bottom: 12px; color: #1f2937;">Improvement Opportunities</h3>
            <ul class="insights-list">
                ${analysis.insights.improvementSuggestions.map(suggestion => `
                <li>
                    <span class="insight-icon">💡</span>
                    <span>${suggestion}</span>
                </li>
                `).join('')}
            </ul>
        </div>
        
        <!-- Competitive Analysis -->
        <div class="section">
            <h2 class="section-title">Competitive Landscape</h2>
            
            ${analysis.competitorAnalysis.competitors.map(competitor => `
            <div class="competitor-card">
                <h3 class="competitor-name">${competitor.name}</h3>
                <div class="competitor-details">
                    <div class="detail-section">
                        <h4>Similarities</h4>
                        <ul>
                            ${competitor.similarities.map(similarity => `<li>• ${similarity}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h4>Directory Presence</h4>
                        <ul>
                            ${competitor.directoryPresence.map(directory => `<li>• ${directory}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h4>Market Advantages</h4>
                        <ul>
                            ${competitor.marketAdvantages.map(advantage => `<li>• ${advantage}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            `).join('')}
            
            <h3 style="margin-top: 32px; margin-bottom: 16px; color: #1f2937;">Strategic Positioning</h3>
            <p style="background: #f0f9ff; padding: 20px; border-radius: 8px; color: #1f2937; border: 1px solid #bae6fd;">
                ${analysis.competitorAnalysis.positioningAdvice}
            </p>
        </div>
        
        ${options.includeBranding ? `
        <div class="cta">
            <h3 class="cta-title">Ready to Get Your Real Analysis?</h3>
            <p class="cta-text">
                This sample shows just a fraction of what our full AI analysis provides. 
                Get your complete business analysis with live data, custom recommendations, 
                and actionable strategies.
            </p>
            <a href="https://directorybolt.com/analyze" class="cta-button">
                Start Your Real Analysis
            </a>
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Report generated by DirectoryBolt AI Analysis Engine</p>
            <p style="font-size: 14px; margin-top: 8px;">
                This is a sample report demonstrating our analysis capabilities. 
                Actual results may vary based on real business data and market conditions.
            </p>
        </div>
    </div>
</body>
</html>
    `
  }

  static downloadHTMLAsPDF(htmlContent: string, filename: string): void {
    // Create a blob and download link
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.html`
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  static async generateAndDownload(
    analysis: SampleAnalysisData,
    options: PDFGenerationOptions = {}
  ): Promise<void> {
    const htmlContent = this.generateHTMLReport(analysis, options)
    const filename = `${analysis.businessProfile.name.replace(/\s+/g, '_')}_DirectoryBolt_Analysis_Sample`
    
    // For demo purposes, download as HTML
    // In production, this would be converted to PDF first
    this.downloadHTMLAsPDF(htmlContent, filename)
    
    // Show success message
    if (typeof window !== 'undefined') {
      console.log(`Sample report downloaded: ${filename}`)
      
      // Optional: Show a toast notification
      const event = new CustomEvent('pdf-download-success', {
        detail: { filename, analysis: analysis.businessProfile.name }
      })
      window.dispatchEvent(event)
    }
  }
}

// Convenience function for easy use in components
export const downloadSampleReport = async (
  analysis: SampleAnalysisData,
  options: PDFGenerationOptions = {}
): Promise<void> => {
  return PDFGenerator.generateAndDownload(analysis, {
    includeBranding: true,
    includeCharts: false, // Charts would require more complex implementation
    watermark: 'SAMPLE REPORT - Get your real analysis at DirectoryBolt.com',
    ...options
  })
}

// Future enhancement: Integration with actual PDF services
export const PDFServices = {
  // Puppeteer integration for server-side PDF generation
  async generateWithPuppeteer(htmlContent: string): Promise<Buffer> {
    throw new Error('Puppeteer integration not implemented - requires server-side setup')
  },
  
  // jsPDF integration for client-side PDF generation
  async generateWithJSPDF(analysis: SampleAnalysisData): Promise<Blob> {
    throw new Error('jsPDF integration not implemented - requires jspdf library')
  },
  
  // External API service integration
  async generateWithAPI(htmlContent: string): Promise<Blob> {
    throw new Error('External PDF API integration not implemented')
  }
}