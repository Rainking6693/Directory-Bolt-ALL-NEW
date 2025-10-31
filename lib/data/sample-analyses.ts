// 📊 SAMPLE ANALYSIS DATA
// Multiple industry examples for demo purposes

export interface SampleAnalysis {
  id: string
  businessProfile: {
    name: string
    industry: string
    category: string
    description: string
    targetAudience: string[]
    businessModel: string
    website: string
  }
  metrics: {
    visibilityScore: number
    seoScore: number
    directoryOpportunities: number
    potentialLeads: number
    competitorAdvantage: number
  }
  aiInsights: {
    marketPosition: string
    competitiveAdvantages: string[]
    improvementSuggestions: string[]
    successFactors: string[]
  }
  directoryOpportunities: Array<{
    name: string
    authority: number
    estimatedTraffic: number
    successProbability: number
    difficulty: 'Easy' | 'Medium' | 'Hard'
    cost: number
    reasoning: string
  }>
  revenueProjections: {
    conservative: {
      projectedRevenue: number
      trafficIncrease: number
      leadIncrease: number
      conversionRate: number
    }
    optimistic: {
      projectedRevenue: number
      trafficIncrease: number
      leadIncrease: number
      conversionRate: number
    }
  }
}

export const SAMPLE_ANALYSES: Record<string, SampleAnalysis> = {
  saas: {
    id: 'saas',
    businessProfile: {
      name: 'TechFlow Solutions',
      industry: 'Technology',
      category: 'B2B SaaS',
      description: 'Cloud-based project management platform for development teams',
      targetAudience: ['Software developers', 'Project managers', 'Tech startups'],
      businessModel: 'Subscription SaaS',
      website: 'https://techflow-solutions.com'
    },
    metrics: {
      visibilityScore: 34,
      seoScore: 67,
      directoryOpportunities: 127,
      potentialLeads: 850,
      competitorAdvantage: 23
    },
    aiInsights: {
      marketPosition: 'Emerging player in competitive project management space',
      competitiveAdvantages: [
        'Developer-focused feature set',
        'Competitive pricing model',
        'Strong technical documentation'
      ],
      improvementSuggestions: [
        'Increase directory presence by 73%',
        'Optimize for local SEO opportunities',
        'Expand content marketing strategy'
      ],
      successFactors: [
        'Product-market fit validation',
        'Strong user retention metrics',
        'Growing developer community'
      ]
    },
    directoryOpportunities: [
      {
        name: 'Product Hunt',
        authority: 91,
        estimatedTraffic: 5000,
        successProbability: 87,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Perfect fit for tech product launches with high developer engagement'
      },
      {
        name: 'G2.com',
        authority: 89,
        estimatedTraffic: 4200,
        successProbability: 92,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Strong category match for B2B software with excellent review potential'
      },
      {
        name: 'Capterra',
        authority: 85,
        estimatedTraffic: 3800,
        successProbability: 89,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'High-intent buyers actively searching for project management solutions'
      },
      {
        name: 'AngelList',
        authority: 83,
        estimatedTraffic: 2500,
        successProbability: 78,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Excellent for startup visibility and potential investor connections'
      },
      {
        name: 'Indie Hackers',
        authority: 72,
        estimatedTraffic: 2200,
        successProbability: 85,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Strong community of developers and entrepreneurs, perfect audience match'
      }
    ],
    revenueProjections: {
      conservative: {
        projectedRevenue: 45000,
        trafficIncrease: 120,
        leadIncrease: 85,
        conversionRate: 2.8
      },
      optimistic: {
        projectedRevenue: 78000,
        trafficIncrease: 220,
        leadIncrease: 150,
        conversionRate: 4.2
      }
    }
  },

  restaurant: {
    id: 'restaurant',
    businessProfile: {
      name: 'Bella Vista Italian Kitchen',
      industry: 'Food & Beverage',
      category: 'Local Business',
      description: 'Authentic Italian restaurant serving traditional recipes with modern flair',
      targetAudience: ['Local diners', 'Food enthusiasts', 'Families', 'Date night couples'],
      businessModel: 'Restaurant',
      website: 'https://bellavista-kitchen.com'
    },
    metrics: {
      visibilityScore: 28,
      seoScore: 45,
      directoryOpportunities: 89,
      potentialLeads: 1200,
      competitorAdvantage: 15
    },
    aiInsights: {
      marketPosition: 'Well-regarded local restaurant with growth potential',
      competitiveAdvantages: [
        'Authentic Italian recipes',
        'Family-owned heritage',
        'Prime downtown location'
      ],
      improvementSuggestions: [
        'Improve online review presence',
        'Optimize for local search terms',
        'Expand delivery platform presence'
      ],
      successFactors: [
        'Strong local reputation',
        'Consistent food quality',
        'Excellent customer service'
      ]
    },
    directoryOpportunities: [
      {
        name: 'Google My Business',
        authority: 98,
        estimatedTraffic: 8000,
        successProbability: 95,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Essential for local restaurant discovery and customer reviews'
      },
      {
        name: 'Yelp',
        authority: 93,
        estimatedTraffic: 6500,
        successProbability: 88,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Primary platform for restaurant reviews and local dining decisions'
      },
      {
        name: 'TripAdvisor',
        authority: 91,
        estimatedTraffic: 4200,
        successProbability: 82,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Important for tourist and visitor dining recommendations'
      },
      {
        name: 'OpenTable',
        authority: 87,
        estimatedTraffic: 3500,
        successProbability: 90,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Direct reservation system integration increases booking convenience'
      },
      {
        name: 'Zomato',
        authority: 78,
        estimatedTraffic: 2800,
        successProbability: 85,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Growing platform for food discovery and delivery integration'
      }
    ],
    revenueProjections: {
      conservative: {
        projectedRevenue: 32000,
        trafficIncrease: 95,
        leadIncrease: 110,
        conversionRate: 3.2
      },
      optimistic: {
        projectedRevenue: 58000,
        trafficIncrease: 180,
        leadIncrease: 200,
        conversionRate: 4.8
      }
    }
  },

  healthcare: {
    id: 'healthcare',
    businessProfile: {
      name: 'Wellness First Medical Center',
      industry: 'Healthcare',
      category: 'Professional Services',
      description: 'Comprehensive family medicine practice with preventive care focus',
      targetAudience: ['Families', 'Health-conscious individuals', 'Seniors', 'Chronic care patients'],
      businessModel: 'Medical Practice',
      website: 'https://wellnessfirst-medical.com'
    },
    metrics: {
      visibilityScore: 42,
      seoScore: 58,
      directoryOpportunities: 76,
      potentialLeads: 650,
      competitorAdvantage: 31
    },
    aiInsights: {
      marketPosition: 'Established practice with strong patient satisfaction',
      competitiveAdvantages: [
        'Comprehensive care approach',
        'Experienced medical team',
        'Modern facility and equipment'
      ],
      improvementSuggestions: [
        'Enhance online appointment booking',
        'Improve healthcare directory presence',
        'Develop patient education content'
      ],
      successFactors: [
        'High patient retention rate',
        'Insurance network participation',
        'Community trust and reputation'
      ]
    },
    directoryOpportunities: [
      {
        name: 'Healthgrades',
        authority: 89,
        estimatedTraffic: 4500,
        successProbability: 92,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Leading platform for physician ratings and patient reviews'
      },
      {
        name: 'WebMD',
        authority: 95,
        estimatedTraffic: 3800,
        successProbability: 85,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Trusted medical information source with provider directory'
      },
      {
        name: 'Vitals.com',
        authority: 82,
        estimatedTraffic: 2200,
        successProbability: 88,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Comprehensive physician directory with patient scheduling'
      },
      {
        name: 'Zocdoc',
        authority: 84,
        estimatedTraffic: 3200,
        successProbability: 90,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Online appointment booking platform with high patient engagement'
      },
      {
        name: 'Psychology Today',
        authority: 79,
        estimatedTraffic: 1800,
        successProbability: 75,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Relevant for mental health and wellness services'
      }
    ],
    revenueProjections: {
      conservative: {
        projectedRevenue: 28000,
        trafficIncrease: 85,
        leadIncrease: 75,
        conversionRate: 2.5
      },
      optimistic: {
        projectedRevenue: 48000,
        trafficIncrease: 160,
        leadIncrease: 130,
        conversionRate: 3.8
      }
    }
  },

  ecommerce: {
    id: 'ecommerce',
    businessProfile: {
      name: 'EcoStyle Boutique',
      industry: 'Retail',
      category: 'E-commerce',
      description: 'Sustainable fashion retailer specializing in eco-friendly clothing and accessories',
      targetAudience: ['Environmentally conscious consumers', 'Fashion enthusiasts', 'Millennials', 'Gen Z shoppers'],
      businessModel: 'E-commerce',
      website: 'https://ecostyle-boutique.com'
    },
    metrics: {
      visibilityScore: 31,
      seoScore: 52,
      directoryOpportunities: 94,
      potentialLeads: 1100,
      competitorAdvantage: 18
    },
    aiInsights: {
      marketPosition: 'Growing sustainable fashion brand with niche appeal',
      competitiveAdvantages: [
        'Sustainable product focus',
        'Curated fashion selection',
        'Strong brand values alignment'
      ],
      improvementSuggestions: [
        'Expand marketplace presence',
        'Improve product discovery SEO',
        'Develop influencer partnerships'
      ],
      successFactors: [
        'Growing sustainability trend',
        'Unique product curation',
        'Strong social media presence'
      ]
    },
    directoryOpportunities: [
      {
        name: 'Google Shopping',
        authority: 96,
        estimatedTraffic: 12000,
        successProbability: 88,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Essential for product discovery and comparison shopping'
      },
      {
        name: 'Amazon Marketplace',
        authority: 94,
        estimatedTraffic: 15000,
        successProbability: 85,
        difficulty: 'Hard',
        cost: 0,
        reasoning: 'Largest e-commerce platform with massive customer base'
      },
      {
        name: 'Etsy',
        authority: 88,
        estimatedTraffic: 5500,
        successProbability: 92,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Perfect fit for sustainable and handcrafted fashion items'
      },
      {
        name: 'Pinterest Business',
        authority: 85,
        estimatedTraffic: 4200,
        successProbability: 90,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Visual platform ideal for fashion discovery and inspiration'
      },
      {
        name: 'Facebook Shop',
        authority: 92,
        estimatedTraffic: 6800,
        successProbability: 87,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Social commerce integration with targeted advertising potential'
      }
    ],
    revenueProjections: {
      conservative: {
        projectedRevenue: 38000,
        trafficIncrease: 110,
        leadIncrease: 95,
        conversionRate: 2.2
      },
      optimistic: {
        projectedRevenue: 72000,
        trafficIncrease: 210,
        leadIncrease: 180,
        conversionRate: 3.5
      }
    }
  },

  consulting: {
    id: 'consulting',
    businessProfile: {
      name: 'Strategic Growth Partners',
      industry: 'Professional Services',
      category: 'B2B Consulting',
      description: 'Management consulting firm helping mid-market companies accelerate growth',
      targetAudience: ['Mid-market executives', 'Business owners', 'Private equity firms', 'Growth companies'],
      businessModel: 'Professional Services',
      website: 'https://strategic-growth-partners.com'
    },
    metrics: {
      visibilityScore: 38,
      seoScore: 61,
      directoryOpportunities: 68,
      potentialLeads: 420,
      competitorAdvantage: 28
    },
    aiInsights: {
      marketPosition: 'Respected boutique consulting firm with specialized expertise',
      competitiveAdvantages: [
        'Deep industry expertise',
        'Proven growth methodologies',
        'Strong client relationships'
      ],
      improvementSuggestions: [
        'Enhance thought leadership content',
        'Expand professional network presence',
        'Develop case study portfolio'
      ],
      successFactors: [
        'High client satisfaction scores',
        'Strong referral network',
        'Measurable client results'
      ]
    },
    directoryOpportunities: [
      {
        name: 'LinkedIn Company',
        authority: 95,
        estimatedTraffic: 3500,
        successProbability: 95,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Essential professional network for B2B consulting visibility'
      },
      {
        name: 'Clutch.co',
        authority: 87,
        estimatedTraffic: 2200,
        successProbability: 90,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Leading B2B service provider directory with verified reviews'
      },
      {
        name: 'Expertise.com',
        authority: 82,
        estimatedTraffic: 1800,
        successProbability: 85,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Professional services directory focusing on expertise and credentials'
      },
      {
        name: 'GoodFirms',
        authority: 78,
        estimatedTraffic: 1200,
        successProbability: 88,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'B2B service provider platform with research-based rankings'
      },
      {
        name: 'UpCity',
        authority: 75,
        estimatedTraffic: 950,
        successProbability: 82,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Local business directory with professional service categories'
      }
    ],
    revenueProjections: {
      conservative: {
        projectedRevenue: 52000,
        trafficIncrease: 75,
        leadIncrease: 65,
        conversionRate: 4.2
      },
      optimistic: {
        projectedRevenue: 95000,
        trafficIncrease: 140,
        leadIncrease: 120,
        conversionRate: 6.8
      }
    }
  },

  realestate: {
    id: 'realestate',
    businessProfile: {
      name: 'Premier Properties Group',
      industry: 'Real Estate',
      category: 'Local Business',
      description: 'Full-service real estate agency specializing in luxury residential properties',
      targetAudience: ['Home buyers', 'Home sellers', 'Luxury property investors', 'Relocating professionals'],
      businessModel: 'Real Estate Services',
      website: 'https://premier-properties-group.com'
    },
    metrics: {
      visibilityScore: 35,
      seoScore: 48,
      directoryOpportunities: 72,
      potentialLeads: 890,
      competitorAdvantage: 22
    },
    aiInsights: {
      marketPosition: 'Established luxury real estate specialist with strong local presence',
      competitiveAdvantages: [
        'Luxury market expertise',
        'Extensive local network',
        'Premium service approach'
      ],
      improvementSuggestions: [
        'Enhance online property showcase',
        'Improve local SEO rankings',
        'Expand social media presence'
      ],
      successFactors: [
        'Strong referral network',
        'Market knowledge expertise',
        'High-value transaction focus'
      ]
    },
    directoryOpportunities: [
      {
        name: 'Zillow',
        authority: 94,
        estimatedTraffic: 8500,
        successProbability: 92,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Leading real estate platform for property search and agent discovery'
      },
      {
        name: 'Realtor.com',
        authority: 93,
        estimatedTraffic: 7200,
        successProbability: 90,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Official MLS platform with high buyer and seller traffic'
      },
      {
        name: 'Trulia',
        authority: 89,
        estimatedTraffic: 4800,
        successProbability: 88,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Popular real estate search platform with neighborhood insights'
      },
      {
        name: 'Redfin',
        authority: 86,
        estimatedTraffic: 3200,
        successProbability: 85,
        difficulty: 'Medium',
        cost: 0,
        reasoning: 'Technology-focused real estate platform with agent referrals'
      },
      {
        name: 'Homes.com',
        authority: 81,
        estimatedTraffic: 2100,
        successProbability: 83,
        difficulty: 'Easy',
        cost: 0,
        reasoning: 'Comprehensive real estate portal with agent profiles'
      }
    ],
    revenueProjections: {
      conservative: {
        projectedRevenue: 42000,
        trafficIncrease: 90,
        leadIncrease: 80,
        conversionRate: 3.5
      },
      optimistic: {
        projectedRevenue: 78000,
        trafficIncrease: 170,
        leadIncrease: 150,
        conversionRate: 5.2
      }
    }
  }
}

export function getSampleAnalysis(industry: string): SampleAnalysis {
  const industryMap: Record<string, string> = {
    'technology': 'saas',
    'saas': 'saas',
    'software': 'saas',
    'food': 'restaurant',
    'restaurant': 'restaurant',
    'dining': 'restaurant',
    'healthcare': 'healthcare',
    'medical': 'healthcare',
    'health': 'healthcare',
    'retail': 'ecommerce',
    'ecommerce': 'ecommerce',
    'fashion': 'ecommerce',
    'consulting': 'consulting',
    'professional': 'consulting',
    'services': 'consulting',
    'realestate': 'realestate',
    'real estate': 'realestate',
    'property': 'realestate'
  }

  const key = industryMap[industry.toLowerCase()] || 'saas'
  return SAMPLE_ANALYSES[key]
}

export function getAllSampleAnalyses(): SampleAnalysis[] {
  return Object.values(SAMPLE_ANALYSES)
}