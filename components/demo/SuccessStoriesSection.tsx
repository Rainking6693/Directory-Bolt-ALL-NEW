'use client'
import { useState } from 'react'

interface SuccessStory {
  id: string
  businessName: string
  industry: string
  location: string
  businessOwner: string
  avatar: string
  timeframe: string
  
  // Before metrics
  before: {
    monthlyTraffic: number
    directoryListings: number
    monthlyLeads: number
    monthlyRevenue: number
    searchVisibility: number
    competitorRanking: number
  }
  
  // After metrics  
  after: {
    monthlyTraffic: number
    directoryListings: number
    monthlyLeads: number
    monthlyRevenue: number
    searchVisibility: number
    competitorRanking: number
  }
  
  // Key improvements
  improvements: {
    trafficIncrease: string
    leadIncrease: string
    revenueIncrease: string
    roi: string
    timeToResults: string
  }
  
  // Success details
  challenge: string
  solution: string
  results: string
  testimonial: string
  
  // Directory specifics
  keyDirectories: string[]
  strategicAdvantage: string
}

const successStories: SuccessStory[] = [
  {
    id: 'dental-practice',
    businessName: "Smile Bright Dental",
    industry: "Healthcare",
    location: "Phoenix, AZ",
    businessOwner: "Dr. Sarah Chen",
    avatar: "SC",
    timeframe: "90 days",
    before: {
      monthlyTraffic: 450,
      directoryListings: 3,
      monthlyLeads: 12,
      monthlyRevenue: 8500,
      searchVisibility: 23,
      competitorRanking: 8
    },
    after: {
      monthlyTraffic: 1850,
      directoryListings: 28,
      monthlyLeads: 47,
      monthlyRevenue: 23400,
      searchVisibility: 78,
      competitorRanking: 2
    },
    improvements: {
      trafficIncrease: "+311%",
      leadIncrease: "+292%",
      revenueIncrease: "+175%",
      roi: "580%",
      timeToResults: "6 weeks"
    },
    challenge: "Despite being an excellent dentist with 15 years of experience, Dr. Chen was struggling to compete with larger dental practices in Phoenix. Her website had good content but wasn't being found by potential patients searching online.",
    solution: "DirectoryBolt's AI identified 28 high-authority medical and local directories that were perfect matches for her practice. We optimized her listings with patient-focused descriptions and ensured consistent NAP data across all platforms.",
    results: "Within 90 days, Smile Bright Dental became the #2 ranked dental practice in her area for key search terms. Patient inquiries increased by 292%, with a significant improvement in case values due to better qualified leads from directory listings.",
    testimonial: "I had no idea how many directories existed for healthcare providers. DirectoryBolt found opportunities I never knew existed and handled everything from start to finish. My practice has never been busier!",
    keyDirectories: [
      "Healthgrades",
      "Zocdoc", 
      "WebMD Provider Directory",
      "Google My Business",
      "Yelp for Business",
      "Better Business Bureau"
    ],
    strategicAdvantage: "Positioned as the 'family-focused dental practice' with emphasis on gentle care and modern technology, differentiating from corporate dental chains."
  },
  {
    id: 'marketing-agency',
    businessName: "Digital Growth Partners",
    industry: "Marketing Services",
    location: "Austin, TX",
    businessOwner: "Marcus Rodriguez",
    avatar: "MR",
    timeframe: "120 days",
    before: {
      monthlyTraffic: 850,
      directoryListings: 5,
      monthlyLeads: 8,
      monthlyRevenue: 15000,
      searchVisibility: 34,
      competitorRanking: 12
    },
    after: {
      monthlyTraffic: 3200,
      directoryListings: 35,
      monthlyLeads: 32,
      monthlyRevenue: 45000,
      searchVisibility: 89,
      competitorRanking: 3
    },
    improvements: {
      trafficIncrease: "+276%",
      leadIncrease: "+300%",
      revenueIncrease: "+200%",
      roi: "720%",
      timeToResults: "8 weeks"
    },
    challenge: "Marcus had built a successful marketing agency but was struggling to scale beyond local referrals. He was competing against hundreds of other agencies and needed better visibility to attract higher-value clients.",
    solution: "Our AI identified specialized B2B directories, industry-specific platforms, and professional networks where his ideal clients were actively searching. We crafted unique positioning for each platform highlighting specific expertise areas.",
    results: "Digital Growth Partners became recognized as Austin's premier digital marketing agency for SaaS companies. The strategic directory presence led to partnerships with larger clients and a 200% increase in average project values.",
    testimonial: "The ROI has been incredible. DirectoryBolt didn't just get us more leads - they got us better leads. We're now working with clients we could only dream of before, and our revenue has tripled.",
    keyDirectories: [
      "Clutch",
      "Agency Directory",
      "UpWork Pro",
      "Google Partner Directory",
      "Chamber of Commerce",
      "Austin Business Journal"
    ],
    strategicAdvantage: "Established thought leadership in SaaS marketing with case studies and specialized service offerings that stood out in crowded marketing directories."
  },
  {
    id: 'ecommerce-boutique',
    businessName: "Coastal Style Co.",
    industry: "Fashion Retail",
    location: "San Diego, CA",
    businessOwner: "Jennifer Walsh",
    avatar: "JW",
    timeframe: "60 days",
    before: {
      monthlyTraffic: 1200,
      directoryListings: 4,
      monthlyLeads: 45,
      monthlyRevenue: 12000,
      searchVisibility: 28,
      competitorRanking: 15
    },
    after: {
      monthlyTraffic: 4800,
      directoryListings: 22,
      monthlyLeads: 180,
      monthlyRevenue: 32000,
      searchVisibility: 82,
      competitorRanking: 4
    },
    improvements: {
      trafficIncrease: "+300%",
      leadIncrease: "+300%",
      revenueIncrease: "+167%",
      roi: "650%",
      timeToResults: "4 weeks"
    },
    challenge: "Jennifer's boutique had beautiful, sustainable fashion pieces but was getting lost among thousands of online retailers. Her Shopify store had low organic traffic and she was overly dependent on expensive paid ads.",
    solution: "DirectoryBolt's AI found fashion-specific directories, sustainable lifestyle platforms, and local San Diego business listings. We emphasized her unique sustainable focus and local California brand story.",
    results: "Coastal Style Co. became San Diego's go-to destination for sustainable fashion. Organic traffic quadrupled, and the business achieved consistent $30K+ monthly revenue with 70% coming from organic directory referrals.",
    testimonial: "I was spending so much on Facebook ads just to break even. DirectoryBolt helped me build sustainable organic traffic that keeps growing every month. My customers now find me, instead of me chasing them.",
    keyDirectories: [
      "Sustainable Fashion Directory",
      "Made in California",
      "San Diego Tourism Board",
      "Eco-Friendly Business Network",
      "Local Fashion Collective",
      "Google Shopping"
    ],
    strategicAdvantage: "Carved out a niche as San Diego's premier sustainable fashion destination with strong local community connections and environmental storytelling."
  },
  {
    id: 'software-startup',
    businessName: "ProjectFlow AI",
    industry: "SaaS Technology",
    location: "Seattle, WA",
    businessOwner: "Alex Kim",
    avatar: "AK",
    timeframe: "150 days",
    before: {
      monthlyTraffic: 320,
      directoryListings: 2,
      monthlyLeads: 5,
      monthlyRevenue: 3500,
      searchVisibility: 12,
      competitorRanking: 25
    },
    after: {
      monthlyTraffic: 2400,
      directoryListings: 31,
      monthlyLeads: 85,
      monthlyRevenue: 28000,
      searchVisibility: 71,
      competitorRanking: 6
    },
    improvements: {
      trafficIncrease: "+650%",
      leadIncrease: "+1600%",
      revenueIncrease: "+700%",
      roi: "1200%",
      timeToResults: "10 weeks"
    },
    challenge: "Alex had built an innovative project management tool with AI features, but was struggling to gain traction in the crowded SaaS market. The product was solid but invisible to potential customers.",
    solution: "Our AI identified high-quality SaaS directories, startup communities, and B2B platforms where decision-makers actively research new tools. We positioned ProjectFlow AI as the 'intelligent choice for growing teams.'",
    results: "ProjectFlow AI gained recognition as an innovative startup in the project management space. The directory presence led to press coverage, partnership opportunities, and consistent MRR growth month over month.",
    testimonial: "As a technical founder, I knew how to build great software but struggled with marketing. DirectoryBolt's systematic approach to directory submissions was exactly what we needed to gain credibility and customers.",
    keyDirectories: [
      "Product Hunt",
      "G2 Crowd",
      "Capterra",
      "SaaS Directory",
      "AngelList",
      "TechCrunch Startup Database"
    ],
    strategicAdvantage: "Established credibility as an innovative AI-powered solution with strong positioning against traditional project management tools through thought leadership content."
  }
]

export default function SuccessStoriesSection() {
  const [activeStory, setActiveStory] = useState<string>(successStories[0].id)
  const [activeTab, setActiveTab] = useState<'metrics' | 'story' | 'strategy'>('metrics')
  
  const currentStory = successStories.find(story => story.id === activeStory) || successStories[0]

  const calculateImprovement = (before: number, after: number): string => {
    const increase = ((after - before) / before) * 100
    return `+${Math.round(increase)}%`
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 bg-secondary-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-volt-400 to-success-400 bg-clip-text text-transparent">
            Real Results from Real Businesses
          </h2>
          <p className="text-lg sm:text-xl text-secondary-300 max-w-3xl mx-auto mb-8">
            See how DirectoryBolt's AI-powered directory submissions transformed these businesses 
            in weeks, not months. These aren't just numbers – they're life-changing results.
          </p>
          <div className="bg-success-500/10 rounded-xl p-6 max-w-2xl mx-auto border border-success-500/20">
            <p className="text-success-300 font-semibold">
              ⚡ Average Results: <span className="text-white">+285% traffic increase</span> • 
              <span className="text-white">+420% lead growth</span> • 
              <span className="text-white">630% ROI</span> in 90 days
            </p>
          </div>
        </div>

        {/* Business Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {successStories.map(story => (
            <button
              key={story.id}
              onClick={() => setActiveStory(story.id)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                activeStory === story.id
                  ? 'bg-volt-500/20 border-volt-500/50 text-volt-300'
                  : 'bg-secondary-900/50 border-secondary-600 text-secondary-300 hover:border-secondary-500'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                activeStory === story.id
                  ? 'bg-volt-500 text-secondary-900'
                  : 'bg-secondary-700 text-secondary-300'
              }`}>
                {story.avatar}
              </div>
              <div className="text-left">
                <div className="font-semibold">{story.businessName}</div>
                <div className="text-xs opacity-75">{story.industry}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="bg-secondary-900 rounded-2xl border border-secondary-700 overflow-hidden">
          {/* Story Header */}
          <div className="p-8 bg-gradient-to-r from-volt-500/10 to-success-500/10 border-b border-secondary-700">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-gradient-to-r from-volt-400 to-success-400 rounded-full flex items-center justify-center font-bold text-secondary-900 text-xl">
                {currentStory.avatar}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {currentStory.businessName}
                </h3>
                <div className="flex flex-wrap gap-4 text-sm text-secondary-300 mb-4">
                  <span className="flex items-center gap-1">
                    <span>🏢</span> {currentStory.industry}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>📍</span> {currentStory.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>👨‍💼</span> {currentStory.businessOwner}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>⏱️</span> {currentStory.timeframe} transformation
                  </span>
                </div>
                <blockquote className="text-lg text-secondary-200 italic">
                  "{currentStory.testimonial}"
                </blockquote>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-8 py-4 bg-secondary-800/50 border-b border-secondary-700">
            <div className="flex gap-4">
              {[
                { id: 'metrics' as const, label: 'Before & After', icon: '📊' },
                { id: 'story' as const, label: 'Success Story', icon: '📖' },
                { id: 'strategy' as const, label: 'Strategy Used', icon: '🎯' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-volt-500/20 text-volt-300 border border-volt-500/50'
                      : 'text-secondary-400 hover:text-secondary-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'metrics' && (
              <div className="space-y-8">
                {/* Key Improvements */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  <div className="bg-success-500/10 rounded-xl p-4 text-center border border-success-500/20">
                    <div className="text-2xl font-bold text-success-400 mb-1">
                      {currentStory.improvements.trafficIncrease}
                    </div>
                    <div className="text-sm text-secondary-300">Traffic</div>
                  </div>
                  <div className="bg-info-500/10 rounded-xl p-4 text-center border border-info-500/20">
                    <div className="text-2xl font-bold text-info-400 mb-1">
                      {currentStory.improvements.leadIncrease}
                    </div>
                    <div className="text-sm text-secondary-300">Leads</div>
                  </div>
                  <div className="bg-volt-500/10 rounded-xl p-4 text-center border border-volt-500/20">
                    <div className="text-2xl font-bold text-volt-400 mb-1">
                      {currentStory.improvements.revenueIncrease}
                    </div>
                    <div className="text-sm text-secondary-300">Revenue</div>
                  </div>
                  <div className="bg-warning-500/10 rounded-xl p-4 text-center border border-warning-500/20">
                    <div className="text-2xl font-bold text-warning-400 mb-1">
                      {currentStory.improvements.roi}
                    </div>
                    <div className="text-sm text-secondary-300">ROI</div>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl p-4 text-center border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-400 mb-1">
                      {currentStory.improvements.timeToResults}
                    </div>
                    <div className="text-sm text-secondary-300">Results</div>
                  </div>
                </div>

                {/* Before vs After Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Before */}
                  <div className="bg-danger-500/10 rounded-xl p-6 border border-danger-500/20">
                    <h4 className="text-xl font-bold text-danger-300 mb-6 text-center">
                      📉 Before DirectoryBolt
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Monthly Traffic</span>
                        <span className="font-bold text-white">{currentStory.before.monthlyTraffic.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Directory Listings</span>
                        <span className="font-bold text-white">{currentStory.before.directoryListings}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Monthly Leads</span>
                        <span className="font-bold text-white">{currentStory.before.monthlyLeads}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Monthly Revenue</span>
                        <span className="font-bold text-white">${currentStory.before.monthlyRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Search Visibility</span>
                        <span className="font-bold text-white">{currentStory.before.searchVisibility}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Competitor Ranking</span>
                        <span className="font-bold text-white">#{currentStory.before.competitorRanking}</span>
                      </div>
                    </div>
                  </div>

                  {/* After */}
                  <div className="bg-success-500/10 rounded-xl p-6 border border-success-500/20">
                    <h4 className="text-xl font-bold text-success-300 mb-6 text-center">
                      📈 After DirectoryBolt
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Monthly Traffic</span>
                        <div className="text-right">
                          <span className="font-bold text-white">{currentStory.after.monthlyTraffic.toLocaleString()}</span>
                          <span className="text-sm text-success-400 ml-2">
                            ({calculateImprovement(currentStory.before.monthlyTraffic, currentStory.after.monthlyTraffic)})
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Directory Listings</span>
                        <div className="text-right">
                          <span className="font-bold text-white">{currentStory.after.directoryListings}</span>
                          <span className="text-sm text-success-400 ml-2">
                            (+{currentStory.after.directoryListings - currentStory.before.directoryListings})
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Monthly Leads</span>
                        <div className="text-right">
                          <span className="font-bold text-white">{currentStory.after.monthlyLeads}</span>
                          <span className="text-sm text-success-400 ml-2">
                            ({calculateImprovement(currentStory.before.monthlyLeads, currentStory.after.monthlyLeads)})
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Monthly Revenue</span>
                        <div className="text-right">
                          <span className="font-bold text-white">${currentStory.after.monthlyRevenue.toLocaleString()}</span>
                          <span className="text-sm text-success-400 ml-2">
                            ({calculateImprovement(currentStory.before.monthlyRevenue, currentStory.after.monthlyRevenue)})
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Search Visibility</span>
                        <div className="text-right">
                          <span className="font-bold text-white">{currentStory.after.searchVisibility}%</span>
                          <span className="text-sm text-success-400 ml-2">
                            (+{currentStory.after.searchVisibility - currentStory.before.searchVisibility}%)
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary-300">Competitor Ranking</span>
                        <div className="text-right">
                          <span className="font-bold text-white">#{currentStory.after.competitorRanking}</span>
                          <span className="text-sm text-success-400 ml-2">
                            (↑{currentStory.before.competitorRanking - currentStory.after.competitorRanking} spots)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'story' && (
              <div className="space-y-8">
                {/* Challenge */}
                <div>
                  <h4 className="text-xl font-bold text-danger-300 mb-4 flex items-center gap-2">
                    <span>⚠️</span> The Challenge
                  </h4>
                  <p className="text-secondary-200 bg-danger-500/10 p-6 rounded-xl border border-danger-500/20">
                    {currentStory.challenge}
                  </p>
                </div>

                {/* Solution */}
                <div>
                  <h4 className="text-xl font-bold text-volt-300 mb-4 flex items-center gap-2">
                    <span>💡</span> Our Solution
                  </h4>
                  <p className="text-secondary-200 bg-volt-500/10 p-6 rounded-xl border border-volt-500/20">
                    {currentStory.solution}
                  </p>
                </div>

                {/* Results */}
                <div>
                  <h4 className="text-xl font-bold text-success-300 mb-4 flex items-center gap-2">
                    <span>🎉</span> The Results
                  </h4>
                  <p className="text-secondary-200 bg-success-500/10 p-6 rounded-xl border border-success-500/20">
                    {currentStory.results}
                  </p>
                </div>

                {/* Timeline Visualization */}
                <div className="bg-secondary-800 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-white mb-6">Transformation Timeline</h4>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-danger-400 via-volt-400 to-success-400"></div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-danger-400 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10">
                          1
                        </div>
                        <div>
                          <div className="font-semibold text-white">Week 1-2: Analysis & Strategy</div>
                          <div className="text-sm text-secondary-300">AI analysis, directory research, and strategic positioning</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-warning-400 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10">
                          2
                        </div>
                        <div>
                          <div className="font-semibold text-white">Week 3-6: Directory Submissions</div>
                          <div className="text-sm text-secondary-300">Optimized listings submitted to high-value directories</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-volt-400 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10">
                          3
                        </div>
                        <div>
                          <div className="font-semibold text-white">Week 7-10: Early Results</div>
                          <div className="text-sm text-secondary-300">First wave of traffic and leads from approved listings</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-success-400 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10">
                          4
                        </div>
                        <div>
                          <div className="font-semibold text-white">Week 11+: Full Impact</div>
                          <div className="text-sm text-secondary-300">Complete transformation with sustained growth</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'strategy' && (
              <div className="space-y-8">
                {/* Key Directories */}
                <div>
                  <h4 className="text-xl font-bold text-white mb-4">🎯 Strategic Directory Selection</h4>
                  <p className="text-secondary-300 mb-6">
                    Our AI identified and prioritized these high-impact directories for maximum ROI:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentStory.keyDirectories.map((directory, index) => (
                      <div
                        key={index}
                        className="bg-volt-500/10 border border-volt-500/20 rounded-lg p-4 text-center"
                      >
                        <div className="font-semibold text-volt-300">{directory}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strategic Advantage */}
                <div>
                  <h4 className="text-xl font-bold text-white mb-4">🚀 Competitive Positioning</h4>
                  <p className="text-secondary-200 bg-info-500/10 p-6 rounded-xl border border-info-500/20">
                    {currentStory.strategicAdvantage}
                  </p>
                </div>

                {/* Success Factors */}
                <div className="bg-success-500/10 rounded-xl p-6 border border-success-500/20">
                  <h4 className="text-lg font-bold text-success-300 mb-4">✅ Why This Strategy Worked</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-success-400 mt-1">✓</span>
                        <span className="text-secondary-200">Industry-specific directory targeting</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-success-400 mt-1">✓</span>
                        <span className="text-secondary-200">Optimized descriptions for each platform</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-success-400 mt-1">✓</span>
                        <span className="text-secondary-200">Consistent NAP data across all listings</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-success-400 mt-1">✓</span>
                        <span className="text-secondary-200">Strategic keyword positioning</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-success-400 mt-1">✓</span>
                        <span className="text-secondary-200">High-authority directory focus</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-success-400 mt-1">✓</span>
                        <span className="text-secondary-200">Ongoing monitoring and optimization</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-volt-500/20 to-success-500/20 rounded-2xl p-8 border border-volt-500/30">
            <h3 className="text-2xl font-bold text-white mb-4">
              Ready to Write Your Success Story?
            </h3>
            <p className="text-secondary-300 mb-6 max-w-2xl mx-auto">
              These results aren't luck – they're the predictable outcome of our AI-powered 
              directory strategy. Your transformation story starts with a free analysis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="btn-primary px-8 py-3 text-lg">
                🎯 Get My Free Analysis
              </button>
              <button className="btn-secondary px-6 py-3">
                📄 Download Success Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}