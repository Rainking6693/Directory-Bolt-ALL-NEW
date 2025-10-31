// Lead Capture Components
export { LeadCaptureForm } from './LeadCaptureForm'

// Comparison Tools
export { ComparisonTool } from './ComparisonTool'

// Assessment Forms
export { BusinessAssessment } from './BusinessAssessment'

// Exit Intent System
export { ExitIntentPopup, useExitIntent, ExitIntentProvider } from './ExitIntentPopup'

// Newsletter Components
export { 
  NewsletterSignup, 
  FloatingNewsletterWidget, 
  NewsletterBanner,
  useNewsletterPopup
} from './NewsletterSignup'

// A/B Testing Framework
export {
  ABTestProvider,
  ABTestComponent,
  useABTest,
  useSimpleABTest,
  useConversionTracking,
  ABTestConfig,
  CONVERSION_TESTS
} from './ABTestFramework'

// Conversion Optimization
export { 
  ConversionOptimizer,
  useConversionOptimization
} from './ConversionOptimizer'

// Enhanced Analytics (re-export from analytics)
export {
  ConversionTracker,
  useGuideEngagement,
  trackConversionFunnel,
  trackABTest,
  trackCustomEvent,
  trackFormInteraction,
  trackButtonClick,
  trackModalInteraction,
  trackUserFlow,
  trackEngagementMetrics,
  trackConversionFunnelDropoff,
  trackPersonalizationEvent,
  trackRevenue,
  UserSessionTracker,
  HeatmapTracker,
  AttributionTracker
} from '../analytics/ConversionTracker'