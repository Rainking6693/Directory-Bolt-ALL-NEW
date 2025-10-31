// 🚀 DIRECTORYBOLT AI BUSINESS INTELLIGENCE TYPES
// Comprehensive interfaces for the $299+ AI-powered business analysis platform

export interface BusinessIntelligence {
  // Core Business Profile
  profile: EnhancedBusinessProfile
  
  // Industry Analysis
  industryAnalysis: IndustryAnalysis
  
  // Competitive Intelligence
  competitiveAnalysis: CompetitiveAnalysis
  
  // SEO & Content Analysis
  seoAnalysis: SEOAnalysis
  
  // Directory Opportunities
  directoryOpportunities: DirectoryOpportunityMatrix
  
  // Market Positioning
  marketPositioning: MarketPositioning
  
  // Revenue Projections
  revenueProjections: RevenueProjections
  
  // Success Metrics
  successMetrics: SuccessMetrics
  
  // Confidence & Quality Scores
  confidence: number // 0-100
  qualityScore: number // 0-100
  analysisTimestamp: Date
}

export interface EnhancedBusinessProfile {
  // Basic Information
  name: string
  domain: string
  description: string
  tagline?: string
  
  // Business Classification
  primaryCategory: string
  secondaryCategories: string[]
  industryVertical: string
  businessModel: BusinessModel
  targetMarket: TargetMarket
  
  // Geographic Data
  location: BusinessLocation
  serviceAreas: string[]
  marketReach: 'local' | 'regional' | 'national' | 'international'
  
  // Business Characteristics
  size: BusinessSize
  stage: BusinessStage
  founded?: Date
  employees?: EmployeeRange
  
  // Contact & Social
  contactInfo: ContactInformation
  socialPresence: SocialMediaPresence
  
  // Technology Stack
  techStack: TechnologyStack
  
  // Content Analysis
  contentAnalysis: ContentAnalysis
}

export interface IndustryAnalysis {
  primaryIndustry: string
  subIndustries: string[]
  marketSize: number // in billions
  growthRate: number // percentage
  competitionLevel: 'low' | 'medium' | 'high' | 'saturated'
  marketTrends: string[]
  seasonality: SeasonalityPattern[]
  regulatoryFactors: string[]
  keySuccessFactors: string[]
  industryBenchmarks: IndustryBenchmarks
}

export interface CompetitiveAnalysis {
  directCompetitors: Competitor[]
  indirectCompetitors: Competitor[]
  marketGaps: MarketGap[]
  competitiveAdvantages: string[]
  weaknesses: string[]
  differentiationOpportunities: string[]
  competitorDirectoryPresence: CompetitorDirectoryMatrix
  marketShare: MarketShareAnalysis
}

export interface SEOAnalysis {
  currentScore: number // 0-100
  technicalSEO: TechnicalSEOMetrics
  contentSEO: ContentSEOMetrics
  localSEO: LocalSEOMetrics
  competitorSEOGap: number
  improvementOpportunities: SEOOpportunity[]
  keywordAnalysis: KeywordAnalysis
  backlinkAnalysis: BacklinkAnalysis
}

export interface DirectoryOpportunityMatrix {
  totalDirectories: number
  categorizedOpportunities: CategorizedOpportunities
  prioritizedSubmissions: PrioritizedSubmission[]
  estimatedResults: DirectoryResultProjections
  submissionStrategy: SubmissionStrategy
}

export interface MarketPositioning {
  currentPosition: string
  recommendedPosition: string
  valueProposition: ValueProposition
  messagingFramework: MessagingFramework
  brandingRecommendations: BrandingRecommendation[]
  audienceSegmentation: AudienceSegment[]
}

export interface RevenueProjections {
  baseline: RevenueScenario
  conservative: RevenueScenario
  optimistic: RevenueScenario
  directoryROI: DirectoryROIProjection[]
  paybackPeriod: number // months
  lifetimeValue: number
}

// Supporting Interfaces

export interface BusinessModel {
  type: 'B2B' | 'B2C' | 'B2B2C' | 'marketplace' | 'subscription' | 'freemium' | 'advertising' | 'commission'
  revenueStreams: string[]
  pricingModel: 'one-time' | 'subscription' | 'usage-based' | 'freemium' | 'commission' | 'advertising'
  customerAcquisitionModel: string[]
}

export interface TargetMarket {
  primaryAudience: string
  secondaryAudiences: string[]
  demographics: Demographics
  psychographics: Psychographics
  painPoints: string[]
  buyingBehavior: BuyingBehavior
}

export interface BusinessLocation {
  headquarters: Address
  offices: Address[]
  serviceAreas: ServiceArea[]
  timeZones: string[]
}

export interface ContactInformation {
  email?: string
  phone?: string
  address?: Address
  website: string
  socialLinks: SocialLink[]
}

export interface SocialMediaPresence {
  platforms: SocialPlatform[]
  totalFollowers: number
  engagementRate: number
  contentStrategy: string
  influenceScore: number // 0-100
}

export interface TechnologyStack {
  website: WebsiteTech
  analytics: string[]
  marketing: string[]
  ecommerce?: string[]
  cms?: string
  hosting: string[]
}

export interface ContentAnalysis {
  readabilityScore: number
  sentimentScore: number
  keyThemes: string[]
  contentGaps: string[]
  expertiseIndicators: string[]
  trustSignals: string[]
}

export interface Competitor {
  name: string
  domain: string
  description: string
  marketShare: number
  strengths: string[]
  weaknesses: string[]
  directoryPresence: string[]
  seoStrength: number
  socialFollowing: number
  estimatedRevenue?: number
}

export interface MarketGap {
  description: string
  opportunity: string
  difficulty: 'low' | 'medium' | 'high'
  timeToMarket: number // months
  potentialRevenue: number
}

export interface PrioritizedSubmission {
  directoryId: string
  directoryName: string
  category: string
  priority: number // 1-100
  successProbability: number // 0-100
  estimatedTraffic: number
  cost: number
  timeInvestment: number // hours
  expectedROI: number
  optimizedListing: DirectoryListing
  submissionTips: string[]
  timeline: SubmissionTimeline
}

export interface DirectoryListing {
  title: string
  description: string
  category: string
  tags: string[]
  images: string[]
  features: string[]
  pricing?: PricingInfo
  contactInfo: ContactInformation
}

export interface SuccessMetrics {
  visibilityScore: number // 0-100
  authorityScore: number // 0-100
  trafficPotential: number
  leadGenPotential: number
  brandExposure: number
  timeToResults: number // days
  competitiveAdvantage: number // 0-100
}

// Enums and Supporting Types

export type BusinessSize = 'startup' | 'small' | 'medium' | 'enterprise' | 'unicorn'
export type BusinessStage = 'idea' | 'mvp' | 'early' | 'growth' | 'scale' | 'mature'
export type EmployeeRange = '1' | '2-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+'

export interface Demographics {
  ageRanges: string[]
  genders: string[]
  incomes: string[]
  educations: string[]
  locations: string[]
  occupations: string[]
}

export interface Psychographics {
  values: string[]
  interests: string[]
  lifestyle: string[]
  personality: string[]
  attitudes: string[]
}

export interface BuyingBehavior {
  decisionFactors: string[]
  purchaseFrequency: string
  averageOrderValue: number
  seasonality: string
  channels: string[]
}

export interface Address {
  street?: string
  city: string
  state?: string
  country: string
  postalCode?: string
}

export interface ServiceArea {
  type: 'city' | 'region' | 'country' | 'global'
  locations: string[]
  radius?: number // miles or km
}

export interface SocialLink {
  platform: string
  url: string
  followers?: number
}

export interface SocialPlatform {
  name: string
  url: string
  followers: number
  posts: number
  engagement: number
  contentType: string[]
}

export interface WebsiteTech {
  framework?: string
  cms?: string
  ecommerce?: string
  analytics: string[]
  hosting: string
  cdn?: string
  ssl: boolean
  mobileOptimized: boolean
  pageSpeed: number
}

export interface TechnicalSEOMetrics {
  pageSpeed: number
  mobileOptimized: boolean
  sslCertificate: boolean
  xmlSitemap: boolean
  robotsTxt: boolean
  schemaMarkup: number // percentage of pages
  canonicalTags: number // percentage
  metaTags: MetaTagsAnalysis
}

export interface ContentSEOMetrics {
  titleOptimization: number // 0-100
  metaDescriptions: number // 0-100
  headingStructure: number // 0-100
  keywordDensity: number // 0-100
  contentLength: number // average words
  duplicateContent: number // percentage
  imageOptimization: number // 0-100
}

export interface LocalSEOMetrics {
  googleMyBusiness: boolean
  napConsistency: number // 0-100
  localCitations: number
  reviewCount: number
  averageRating: number
  localKeywordRankings: number // 0-100
}

export interface SEOOpportunity {
  type: 'technical' | 'content' | 'local' | 'backlinks'
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
  priority: number // 1-100
  estimatedTrafficIncrease: number
}

export interface KeywordAnalysis {
  primaryKeywords: Keyword[]
  secondaryKeywords: Keyword[]
  longTailOpportunities: Keyword[]
  competitorKeywords: Keyword[]
  keywordGaps: string[]
  seasonalKeywords: SeasonalKeyword[]
}

export interface Keyword {
  term: string
  searchVolume: number
  difficulty: number // 0-100
  currentRanking?: number
  competitorRanking: number[]
  commercialIntent: 'low' | 'medium' | 'high'
}

export interface BacklinkAnalysis {
  totalBacklinks: number
  domainAuthority: number
  linkQuality: number // 0-100
  competitorGap: number
  linkBuildingOpportunities: LinkOpportunity[]
}

export interface LinkOpportunity {
  domain: string
  authority: number
  relevance: number
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedValue: number
}

export interface CategorizedOpportunities {
  highAuthority: PrioritizedSubmission[]
  industrySpecific: PrioritizedSubmission[]
  localDirectories: PrioritizedSubmission[]
  nicheDirectories: PrioritizedSubmission[]
  freeDirectories: PrioritizedSubmission[]
  premiumDirectories: PrioritizedSubmission[]
}

export interface DirectoryResultProjections {
  totalTrafficIncrease: number
  leadIncrease: number
  brandExposureIncrease: number
  timeToResults: TimeToResults
  riskFactors: RiskFactor[]
}

export interface TimeToResults {
  immediate: number // days
  shortTerm: number // days
  mediumTerm: number // days
  longTerm: number // days
}

export interface RiskFactor {
  factor: string
  probability: number // 0-100
  impact: 'low' | 'medium' | 'high'
  mitigation: string
}

export interface SubmissionStrategy {
  totalDirectories: number
  submissionPaces: SubmissionPace[]
  budgetAllocation: BudgetAllocation[]
  timeline: SubmissionPhase[]
  successMetrics: string[]
}

export interface SubmissionPace {
  phase: string
  directoriesPerWeek: number
  duration: number // weeks
  focus: string
}

export interface BudgetAllocation {
  category: string
  amount: number
  percentage: number
  expectedROI: number
}

export interface SubmissionPhase {
  phase: string
  startDate: Date
  endDate: Date
  directories: string[]
  objectives: string[]
  successCriteria: string[]
}

export interface ValueProposition {
  primary: string
  secondary: string[]
  differentiators: string[]
  benefits: string[]
  proofPoints: string[]
}

export interface MessagingFramework {
  coreMessage: string
  audienceMessages: AudienceMessage[]
  channelMessages: ChannelMessage[]
  brandVoice: string
  keyThemes: string[]
}

export interface AudienceMessage {
  audience: string
  message: string
  tone: string
  channels: string[]
}

export interface ChannelMessage {
  channel: string
  message: string
  format: string
  cta: string
}

export interface BrandingRecommendation {
  category: string
  recommendation: string
  reasoning: string
  priority: 'high' | 'medium' | 'low'
  implementation: string
}

export interface AudienceSegment {
  name: string
  size: number
  characteristics: string[]
  painPoints: string[]
  preferredChannels: string[]
  messagingApproach: string
}

export interface RevenueScenario {
  timeframe: '3months' | '6months' | '1year' | '2years'
  projectedRevenue: number
  trafficIncrease: number
  leadIncrease: number
  conversionRate: number
  customerLifetimeValue: number
  assumptions: string[]
}

export interface DirectoryROIProjection {
  directoryName: string
  investment: number
  projectedReturn: number
  roiPercentage: number
  paybackPeriod: number // months
  riskLevel: 'low' | 'medium' | 'high'
}

export interface SubmissionTimeline {
  preparation: number // days
  submission: number // days
  review: number // days
  goLive: number // days
  optimization: number // days
  totalTime: number // total days calculated
}

export interface PricingInfo {
  model: 'free' | 'one-time' | 'recurring' | 'commission'
  amount?: number
  currency?: string
  billingCycle?: 'monthly' | 'annual'
}

export interface SeasonalityPattern {
  season: string
  impact: 'high' | 'medium' | 'low'
  months: string[]
  description: string
}

export interface IndustryBenchmarks {
  averageCAC: number // Customer Acquisition Cost
  averageLTV: number // Lifetime Value
  averageConversion: number // percentage
  averageTrafficGrowth: number // percentage
  typicalDirectoryROI: number // percentage
}

export interface MarketShareAnalysis {
  totalMarketSize: number
  currentMarketShare: number
  targetMarketShare: number
  topCompetitors: Array<{
    name: string
    marketShare: number
    growth: number
  }>
}

export interface CompetitorDirectoryMatrix {
  competitor: string
  directories: Array<{
    name: string
    listed: boolean
    ranking?: number
    traffic?: number
  }>
  totalPresence: number
  gapOpportunities: string[]
}

export interface MetaTagsAnalysis {
  titleTags: number // percentage optimized
  metaDescriptions: number // percentage present
  ogTags: number // percentage present
  schemaMarkup: number // percentage present
  canonicalTags: number // percentage correct
}

export interface SeasonalKeyword {
  keyword: string
  peakMonths: string[]
  searchVolumeVariation: number // percentage
  competitionLevel: 'low' | 'medium' | 'high'
}

// API Response Types

export interface BusinessIntelligenceResponse {
  success: boolean
  data?: BusinessIntelligence
  error?: string
  processingTime: number
  usage: {
    tokensUsed: number
    cost: number
  }
}

export interface AnalysisProgress {
  stage: string
  progress: number // 0-100
  estimatedTimeRemaining: number // seconds
  currentTask: string
}

// Configuration Types

export interface AIAnalysisConfig {
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o'
  temperature: number
  maxTokens: number
  enableScreenshots: boolean
  enableCompetitorAnalysis: boolean
  enableRevenueProjections: boolean
  analysisDepth: 'basic' | 'standard' | 'comprehensive'
  enableCache: boolean
}

export interface DirectoryAnalysisConfig {
  maxDirectoriesToAnalyze: number
  includeInternational: boolean
  includePremium: boolean
  industryFocus: string[]
  budgetRange: {
    min: number
    max: number
  }
}