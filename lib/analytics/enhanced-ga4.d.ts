export interface EnhancedGA4Config {
  trackCoreWebVitals: () => void
  trackPurchase: (transactionData: Record<string, unknown>) => void
  trackDirectorySubmission: (directoryName: string, plan: string, status?: string) => void
  trackContentEngagement: (contentType: string, contentTitle: string, engagementType: string, value?: number) => void
  trackSearch: (searchTerm: string, searchType?: string, resultsCount?: number) => void
  trackFormInteraction: (formName: string, action: string, fieldName?: string | null) => void
  trackPricingInteraction: (planName: string, action: string, value?: number | null) => void
  trackUserJourney: (milestone: string, additionalData?: Record<string, unknown>) => void
  trackScrollDepth: () => void
  trackTimeOnPage: () => void
  trackCustomerLifecycle: (stage: string, metadata?: Record<string, unknown>) => void
  trackFeatureUsage: (featureName: string, action: string, metadata?: Record<string, unknown>) => void
  trackExternalLinks: () => void
  trackDownloads: () => void
  initializeTracking: () => void
  setupAllTracking: () => void
  trackOutboundLinks?: () => void
}

export const enhancedGA4Config: EnhancedGA4Config
export default enhancedGA4Config
