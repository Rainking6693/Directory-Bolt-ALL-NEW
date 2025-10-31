// Sample AI Analysis Data for Demo Purposes
// These showcase the full value of DirectoryBolt's AI analysis capabilities

export interface SampleAnalysisData {
  businessProfile: {
    name: string
    description: string
    category: string
    subcategory: string
    industry: string
    location: {
      city: string
      country: string
      region: string
    }
    targetAudience: string[]
    keywords: string[]
    businessModel: string
    size: string
    stage: string
  }
  recommendations: Array<{
    directoryId: string
    name: string
    relevanceScore: number
    successProbability: number
    estimatedTraffic: number
    priority: 'high' | 'medium' | 'low'
    reasoning: string
    optimizedDescription: string
    tags: string[]
    submissionTips: string[]
    estimatedValue: number
    authority: number
    category: string
  }>
  insights: {
    marketPosition: string
    competitiveAdvantages: string[]
    improvementSuggestions: string[]
    successFactors: string[]
  }
  competitorAnalysis: {
    competitors: Array<{
      name: string
      similarities: string[]
      directoryPresence: string[]
      marketAdvantages: string[]
    }>
    marketGaps: string[]
    positioningAdvice: string
  }
  seoAnalysis: {
    currentScore: number
    potentialScore: number
    keywordOpportunities: string[]
    backlinkPotential: number
  }
  projectedResults: {
    monthlyTrafficIncrease: number
    leadGeneration: number
    revenueProjection: number
    roi: number
    timeToResults: string
  }
  confidence: number
}

// Sample Analysis: Local Italian Restaurant
export const localRestaurantAnalysis: SampleAnalysisData = {
  businessProfile: {
    name: "Nonna's Kitchen",
    description: "Authentic Italian restaurant serving traditional recipes passed down through three generations. Family-owned establishment specializing in handmade pasta, wood-fired pizza, and classic Italian wines.",
    category: "Restaurant",
    subcategory: "Italian Cuisine",
    industry: "Food & Beverage",
    location: {
      city: "Austin",
      country: "United States",
      region: "Texas"
    },
    targetAudience: [
      "Local food enthusiasts",
      "Families seeking authentic dining",
      "Date night couples",
      "Italian cuisine lovers",
      "Special occasion diners"
    ],
    keywords: [
      "Italian restaurant Austin",
      "authentic pasta",
      "wood-fired pizza",
      "family restaurant",
      "Italian wine",
      "romantic dinner",
      "handmade pasta",
      "traditional Italian",
      "Austin dining"
    ],
    businessModel: "B2C Restaurant Service",
    size: "small",
    stage: "mature"
  },
  recommendations: [
    {
      directoryId: "yelp",
      name: "Yelp",
      relevanceScore: 98,
      successProbability: 95,
      estimatedTraffic: 2500,
      priority: "high" as const,
      reasoning: "Perfect match for local restaurant discovery. Yelp is the #1 platform where customers find and review restaurants. High success rate for established restaurants with authentic cuisine.",
      optimizedDescription: "Experience authentic Italian cuisine at Nonna's Kitchen! Three generations of traditional recipes, handmade pasta, wood-fired pizza, and carefully curated Italian wines. Perfect for romantic dinners and family celebrations.",
      tags: ["Italian", "Family-owned", "Authentic", "Pizza", "Pasta", "Wine"],
      submissionTips: [
        "Upload high-quality photos of signature dishes",
        "Encourage satisfied customers to leave reviews",
        "Respond to all reviews professionally",
        "Keep hours and menu information current"
      ],
      estimatedValue: 850,
      authority: 95,
      category: "Review Sites"
    },
    {
      directoryId: "google-business",
      name: "Google My Business",
      relevanceScore: 100,
      successProbability: 98,
      estimatedTraffic: 3200,
      priority: "high" as const,
      reasoning: "Essential for local search visibility. Customers searching for 'Italian restaurant near me' will find you through Google Maps and local search results.",
      optimizedDescription: "Nonna's Kitchen - Authentic Italian restaurant in Austin serving handmade pasta, wood-fired pizza & traditional Italian dishes. Family recipes passed down 3 generations. Romantic atmosphere, perfect for date nights & family dinners.",
      tags: ["Italian Restaurant", "Pasta", "Pizza", "Family Dining", "Date Night"],
      submissionTips: [
        "Claim and verify your listing immediately",
        "Add professional photos of food and interior",
        "Post regular updates about specials",
        "Manage Q&A section actively"
      ],
      estimatedValue: 1200,
      authority: 100,
      category: "Local Listings"
    },
    {
      directoryId: "tripadvisor",
      name: "TripAdvisor",
      relevanceScore: 92,
      successProbability: 88,
      estimatedTraffic: 1800,
      priority: "high" as const,
      reasoning: "Critical for tourists and visitors to Austin. TripAdvisor users specifically seek authentic local experiences and traditional cuisine recommendations.",
      optimizedDescription: "Discover Austin's hidden gem for authentic Italian cuisine! Nonna's Kitchen serves traditional family recipes with handmade pasta, wood-fired pizza, and an extensive Italian wine selection. A must-visit for authentic Italian dining.",
      tags: ["Italian", "Traditional", "Local Favorite", "Authentic", "Family Recipes"],
      submissionTips: [
        "Highlight unique family history and traditions",
        "Feature signature dishes prominently",
        "Encourage tourist reviews through excellent service"
      ],
      estimatedValue: 680,
      authority: 90,
      category: "Review Sites"
    },
    {
      directoryId: "opentable",
      name: "OpenTable",
      relevanceScore: 95,
      successProbability: 85,
      estimatedTraffic: 1500,
      priority: "high" as const,
      reasoning: "Perfect for reservation-based dining. Customers seeking special occasion dining and romantic restaurants actively use OpenTable for bookings.",
      optimizedDescription: "Reserve your table at Nonna's Kitchen for an unforgettable Italian dining experience. Romantic atmosphere, handcrafted dishes, and exceptional service make us Austin's premier destination for special occasions.",
      tags: ["Reservations", "Special Occasions", "Romantic", "Fine Dining", "Italian"],
      submissionTips: [
        "Offer prime-time availability",
        "Create special occasion packages",
        "Maintain high service standards for reviews"
      ],
      estimatedValue: 950,
      authority: 85,
      category: "Industry-specific"
    },
    {
      directoryId: "austin-eater",
      name: "Eater Austin",
      relevanceScore: 88,
      successProbability: 75,
      estimatedTraffic: 800,
      priority: "medium" as const,
      reasoning: "Local food authority for Austin. Being featured on Eater Austin establishes credibility with serious food enthusiasts and local food scene followers.",
      optimizedDescription: "Three generations of Italian tradition come alive at Nonna's Kitchen. Our handmade pasta and wood-fired pizzas represent authentic Italian cuisine in the heart of Austin's vibrant food scene.",
      tags: ["Local Austin", "Food Scene", "Authentic", "Traditional", "Italian"],
      submissionTips: [
        "Share your family's immigration and restaurant story",
        "Highlight unique preparation methods",
        "Build relationships with local food writers"
      ],
      estimatedValue: 420,
      authority: 78,
      category: "Local Listings"
    }
  ],
  insights: {
    marketPosition: "Nonna's Kitchen occupies a strong position in Austin's competitive restaurant market as an authentic, family-owned Italian establishment. The three-generation heritage and traditional recipes provide significant differentiation from chain restaurants and newer establishments.",
    competitiveAdvantages: [
      "Three generations of authentic family recipes",
      "Traditional cooking methods (handmade pasta, wood-fired pizza)",
      "Established local reputation and customer loyalty",
      "Romantic atmosphere perfect for special occasions",
      "Extensive knowledge of Italian wines and food pairings"
    ],
    improvementSuggestions: [
      "Increase online presence through food photography and social media",
      "Develop signature dishes that highlight family traditions",
      "Create special event packages for anniversaries and celebrations",
      "Implement customer loyalty program for repeat diners",
      "Partner with local wine distributors for exclusive Italian selections"
    ],
    successFactors: [
      "Consistently high-quality authentic Italian cuisine",
      "Exceptional customer service that creates memorable experiences",
      "Strong visual presentation of food for online listings",
      "Active engagement with customer reviews and feedback",
      "Seasonal menu updates featuring traditional Italian celebrations"
    ]
  },
  competitorAnalysis: {
    competitors: [
      {
        name: "Via 313",
        similarities: ["Pizza focus", "Austin-based", "Local favorite"],
        directoryPresence: ["Yelp", "Google My Business", "Austin Food & Wine"],
        marketAdvantages: ["Food truck origins story", "Unique Detroit-style pizza", "Multiple locations"]
      },
      {
        name: "North Italia",
        similarities: ["Italian cuisine", "Full-service restaurant", "Wine selection"],
        directoryPresence: ["OpenTable", "Yelp", "TripAdvisor"],
        marketAdvantages: ["Modern atmosphere", "Corporate backing", "Consistent branding"]
      },
      {
        name: "Patrizi's",
        similarities: ["Italian family restaurant", "Traditional recipes", "Local establishment"],
        directoryPresence: ["Yelp", "Google My Business", "Local dining guides"],
        marketAdvantages: ["Established since 1986", "Strong neighborhood presence", "Catering services"]
      }
    ],
    marketGaps: [
      "Limited authentic Italian restaurants with verified generational recipes",
      "Few restaurants offering traditional Italian wine education experiences",
      "Opportunity for Italian cooking classes and culinary experiences",
      "Need for authentic Italian catering services for events"
    ],
    positioningAdvice: "Position Nonna's Kitchen as Austin's most authentic Italian family restaurant, emphasizing the three-generation heritage and traditional cooking methods. Differentiate through storytelling about family immigration history and recipe authenticity. Focus on the emotional connection of family traditions and the romantic atmosphere for special occasions."
  },
  seoAnalysis: {
    currentScore: 72,
    potentialScore: 94,
    keywordOpportunities: [
      "authentic Italian restaurant Austin",
      "handmade pasta Austin",
      "wood fired pizza Texas",
      "romantic dinner Austin",
      "Italian wine pairing Austin",
      "family Italian restaurant",
      "traditional Italian recipes"
    ],
    backlinkPotential: 85
  },
  projectedResults: {
    monthlyTrafficIncrease: 1250,
    leadGeneration: 180,
    revenueProjection: 12500,
    roi: 420,
    timeToResults: "4-6 weeks"
  },
  confidence: 96
}

// Sample Analysis: SaaS Company
export const saasCompanyAnalysis: SampleAnalysisData = {
  businessProfile: {
    name: "CloudSync Pro",
    description: "Advanced file synchronization and backup solution for businesses. Secure cloud storage with real-time collaboration tools, automated backups, and enterprise-grade security features.",
    category: "Software",
    subcategory: "Cloud Storage & Sync",
    industry: "Technology",
    location: {
      city: "San Francisco",
      country: "United States",
      region: "California"
    },
    targetAudience: [
      "Small to medium businesses",
      "Remote teams",
      "IT professionals",
      "Digital agencies",
      "Startups and scale-ups"
    ],
    keywords: [
      "cloud storage",
      "file synchronization",
      "business backup",
      "team collaboration",
      "secure file sharing",
      "automated backup",
      "cloud sync",
      "enterprise storage"
    ],
    businessModel: "B2B SaaS Subscription",
    size: "startup",
    stage: "growth"
  },
  recommendations: [
    {
      directoryId: "g2",
      name: "G2",
      relevanceScore: 98,
      successProbability: 92,
      estimatedTraffic: 3500,
      priority: "high" as const,
      reasoning: "G2 is the leading platform for B2B software reviews. IT professionals and business decision-makers rely on G2 ratings when evaluating cloud storage solutions. High-intent users actively compare solutions here.",
      optimizedDescription: "CloudSync Pro delivers enterprise-grade file synchronization and backup for growing businesses. Secure cloud storage, real-time collaboration, and automated backup ensure your team's data is always protected and accessible.",
      tags: ["Cloud Storage", "File Sync", "Business Backup", "Team Collaboration", "Security"],
      submissionTips: [
        "Encourage satisfied customers to leave detailed reviews",
        "Respond to all reviews professionally and promptly",
        "Keep feature comparisons up to date",
        "Highlight unique security features"
      ],
      estimatedValue: 2400,
      authority: 95,
      category: "Review Sites"
    },
    {
      directoryId: "product-hunt",
      name: "Product Hunt",
      relevanceScore: 95,
      successProbability: 88,
      estimatedTraffic: 2200,
      priority: "high" as const,
      reasoning: "Perfect platform for tech startup visibility. Product Hunt's community of early adopters and tech enthusiasts are ideal for discovering and validating new SaaS solutions.",
      optimizedDescription: "🚀 CloudSync Pro - The smart way to sync, backup, and collaborate on files. Built for modern teams who need enterprise security without enterprise complexity. Join thousands of teams already syncing smarter!",
      tags: ["Productivity", "Cloud Storage", "Team Tools", "Backup", "SaaS"],
      submissionTips: [
        "Time launch for maximum Tuesday-Thursday visibility",
        "Prepare compelling visuals and demo videos",
        "Engage with the community beyond your launch",
        "Follow up with supporters after launch"
      ],
      estimatedValue: 1800,
      authority: 88,
      category: "Industry-specific"
    },
    {
      directoryId: "capterra",
      name: "Capterra",
      relevanceScore: 96,
      successProbability: 90,
      estimatedTraffic: 2800,
      priority: "high" as const,
      reasoning: "Capterra is where businesses actively search for software solutions. Users have high purchase intent and compare multiple options before making decisions.",
      optimizedDescription: "CloudSync Pro provides secure, reliable file synchronization and backup for businesses of all sizes. Advanced collaboration features, automated backups, and enterprise-grade security make it the smart choice for modern teams.",
      tags: ["File Management", "Cloud Backup", "Business Software", "Collaboration", "Data Security"],
      submissionTips: [
        "Provide detailed feature descriptions",
        "Include pricing information transparently",
        "Upload high-quality screenshots and demos",
        "Maintain accurate customer reviews"
      ],
      estimatedValue: 2100,
      authority: 92,
      category: "Industry-specific"
    }
  ],
  insights: {
    marketPosition: "CloudSync Pro operates in the competitive cloud storage market but can differentiate through its focus on business-specific features like advanced collaboration tools and enterprise-grade security for smaller companies.",
    competitiveAdvantages: [
      "Simplified enterprise features for SMBs",
      "Real-time collaboration capabilities",
      "Competitive pricing for business features",
      "Strong security focus",
      "User-friendly interface"
    ],
    improvementSuggestions: [
      "Develop case studies showcasing ROI for businesses",
      "Create integration partnerships with popular business tools",
      "Implement customer success stories and testimonials",
      "Offer free trials with guided onboarding",
      "Build thought leadership content around data security"
    ],
    successFactors: [
      "Strong customer reviews emphasizing reliability",
      "Clear demonstration of security features",
      "Competitive pricing strategy",
      "Excellent customer support responsiveness",
      "Regular feature updates based on user feedback"
    ]
  },
  competitorAnalysis: {
    competitors: [
      {
        name: "Dropbox Business",
        similarities: ["Cloud storage", "Team collaboration", "File sync"],
        directoryPresence: ["G2", "Capterra", "Software Advice"],
        marketAdvantages: ["Brand recognition", "Large user base", "Extensive integrations"]
      },
      {
        name: "Box",
        similarities: ["Business focus", "Security features", "Collaboration tools"],
        directoryPresence: ["G2", "Gartner", "Forrester"],
        marketAdvantages: ["Enterprise customers", "Compliance certifications", "Advanced admin controls"]
      }
    ],
    marketGaps: [
      "Simplified enterprise features for SMBs",
      "Affordable advanced security for small teams",
      "Industry-specific compliance solutions"
    ],
    positioningAdvice: "Position as the 'enterprise-grade security without enterprise complexity' solution for growing businesses."
  },
  seoAnalysis: {
    currentScore: 78,
    potentialScore: 91,
    keywordOpportunities: [
      "business cloud storage",
      "secure file sync",
      "team collaboration tools",
      "automated backup solution"
    ],
    backlinkPotential: 88
  },
  projectedResults: {
    monthlyTrafficIncrease: 2800,
    leadGeneration: 420,
    revenueProjection: 28500,
    roi: 520,
    timeToResults: "6-8 weeks"
  },
  confidence: 94
}

// Sample Analysis: E-commerce Business
export const ecommerceAnalysis: SampleAnalysisData = {
  businessProfile: {
    name: "EcoStyle Boutique",
    description: "Sustainable fashion retailer specializing in ethically-made clothing and accessories. Curated collection of eco-friendly brands committed to fair trade and environmental responsibility.",
    category: "E-commerce",
    subcategory: "Sustainable Fashion",
    industry: "Retail",
    location: {
      city: "Portland",
      country: "United States",
      region: "Oregon"
    },
    targetAudience: [
      "Environmentally conscious consumers",
      "Millennial and Gen-Z shoppers",
      "Professional women 25-45",
      "Sustainable lifestyle advocates",
      "Ethical fashion enthusiasts"
    ],
    keywords: [
      "sustainable fashion",
      "ethical clothing",
      "eco-friendly apparel",
      "fair trade fashion",
      "organic clothing",
      "sustainable boutique",
      "ethical brands",
      "conscious fashion"
    ],
    businessModel: "B2C E-commerce",
    size: "small",
    stage: "growth"
  },
  recommendations: [
    {
      directoryId: "google-shopping",
      name: "Google Shopping",
      relevanceScore: 96,
      successProbability: 92,
      estimatedTraffic: 4200,
      priority: "high" as const,
      reasoning: "Essential for e-commerce visibility. Customers searching for sustainable fashion products will see your items directly in search results with photos, prices, and reviews.",
      optimizedDescription: "Discover sustainable fashion at EcoStyle Boutique. Shop ethically-made clothing & accessories from eco-friendly brands committed to fair trade and environmental responsibility.",
      tags: ["Sustainable Fashion", "Ethical Clothing", "Eco-friendly", "Fair Trade", "Organic"],
      submissionTips: [
        "Optimize product titles with sustainable keywords",
        "Include high-quality product photos",
        "Maintain competitive pricing strategy",
        "Highlight sustainability certifications"
      ],
      estimatedValue: 3200,
      authority: 100,
      category: "Search Engines"
    },
    {
      directoryId: "etsy",
      name: "Etsy",
      relevanceScore: 88,
      successProbability: 85,
      estimatedTraffic: 2800,
      priority: "high" as const,
      reasoning: "Perfect match for sustainable and ethical products. Etsy's audience actively seeks unique, environmentally conscious items and supports small businesses with ethical practices.",
      optimizedDescription: "EcoStyle Boutique curates beautiful, sustainable fashion pieces from ethical brands. Every purchase supports fair trade practices and environmental sustainability.",
      tags: ["Sustainable", "Ethical", "Eco-friendly", "Fair Trade", "Handmade"],
      submissionTips: [
        "Emphasize the story behind each brand",
        "Use sustainability-focused keywords",
        "Share the environmental impact story",
        "Highlight certifications and ethical practices"
      ],
      estimatedValue: 1800,
      authority: 82,
      category: "E-commerce Platforms"
    }
  ],
  insights: {
    marketPosition: "EcoStyle Boutique is well-positioned in the growing sustainable fashion market, appealing to increasingly conscious consumers who prioritize ethical and environmental values in their purchasing decisions.",
    competitiveAdvantages: [
      "Curated selection of verified sustainable brands",
      "Strong environmental and ethical positioning",
      "Educational content about sustainability",
      "Transparent supply chain information",
      "Local Portland community connections"
    ],
    improvementSuggestions: [
      "Create content about sustainability impact",
      "Develop customer education about ethical fashion",
      "Implement loyalty program for repeat customers",
      "Partner with environmental organizations",
      "Showcase brand stories and maker profiles"
    ],
    successFactors: [
      "Authentic commitment to sustainability values",
      "Quality product curation and presentation",
      "Strong storytelling about ethical impact",
      "Excellent customer service and education",
      "Active community engagement around sustainability"
    ]
  },
  competitorAnalysis: {
    competitors: [
      {
        name: "Everlane",
        similarities: ["Sustainable fashion", "Transparency", "Ethical production"],
        directoryPresence: ["Google Shopping", "Social media platforms"],
        marketAdvantages: ["Brand recognition", "Direct-to-consumer model", "Marketing budget"]
      }
    ],
    marketGaps: [
      "Affordable sustainable fashion options",
      "Local sustainable brand focus",
      "Educational content about ethical fashion"
    ],
    positioningAdvice: "Position as the trusted curator of sustainable fashion, emphasizing the personal touch and education that large brands cannot provide."
  },
  seoAnalysis: {
    currentScore: 68,
    potentialScore: 89,
    keywordOpportunities: [
      "sustainable fashion Portland",
      "ethical clothing boutique",
      "eco-friendly apparel",
      "fair trade fashion"
    ],
    backlinkPotential: 76
  },
  projectedResults: {
    monthlyTrafficIncrease: 1950,
    leadGeneration: 285,
    revenueProjection: 18500,
    roi: 380,
    timeToResults: "4-6 weeks"
  },
  confidence: 91
}

// Sample Analysis: Professional Services
export const professionalServicesAnalysis: SampleAnalysisData = {
  businessProfile: {
    name: "Summit Financial Planning",
    description: "Comprehensive financial planning and investment advisory services for individuals and families. Specializing in retirement planning, wealth management, and educational funding strategies.",
    category: "Professional Services",
    subcategory: "Financial Planning",
    industry: "Financial Services",
    location: {
      city: "Denver",
      country: "United States",
      region: "Colorado"
    },
    targetAudience: [
      "Pre-retirees aged 50-65",
      "High-income professionals",
      "Young families planning for education costs",
      "Small business owners",
      "Individuals seeking wealth management"
    ],
    keywords: [
      "financial planner Denver",
      "retirement planning",
      "wealth management",
      "investment advisor",
      "financial planning services",
      "estate planning",
      "college funding",
      "portfolio management"
    ],
    businessModel: "B2C Professional Services",
    size: "small",
    stage: "mature"
  },
  recommendations: [
    {
      directoryId: "cfp-board",
      name: "CFP Board Center for Financial Planning",
      relevanceScore: 100,
      successProbability: 95,
      estimatedTraffic: 1800,
      priority: "high" as const,
      reasoning: "The gold standard directory for certified financial planners. Consumers specifically search here for qualified, credentialed professionals. Essential for credibility and professional recognition.",
      optimizedDescription: "Summit Financial Planning provides comprehensive financial planning and investment advisory services in Denver. Specializing in retirement planning, wealth management, and educational funding strategies for families and individuals.",
      tags: ["CFP", "Financial Planning", "Investment Advisory", "Retirement Planning", "Wealth Management"],
      submissionTips: [
        "Ensure CFP certification is prominently displayed",
        "Include specialization areas clearly",
        "Maintain professional headshots and credentials",
        "Keep contact information and availability current"
      ],
      estimatedValue: 2200,
      authority: 98,
      category: "Professional Networks"
    },
    {
      directoryId: "napfa",
      name: "NAPFA (National Association of Personal Financial Advisors)",
      relevanceScore: 98,
      successProbability: 92,
      estimatedTraffic: 1200,
      priority: "high" as const,
      reasoning: "Prestigious directory for fee-only financial advisors. Consumers seeking unbiased financial advice specifically search NAPFA for fiduciary advisors without conflicts of interest.",
      optimizedDescription: "Fee-only financial planning services committed to acting as your fiduciary. Summit Financial Planning provides unbiased advice on retirement planning, investment management, and comprehensive financial strategies.",
      tags: ["Fee-Only", "Fiduciary", "Financial Planning", "Investment Management", "Retirement Planning"],
      submissionTips: [
        "Emphasize fee-only and fiduciary commitment",
        "Highlight comprehensive planning approach",
        "Include client testimonials if permitted",
        "Showcase continuing education and credentials"
      ],
      estimatedValue: 1800,
      authority: 95,
      category: "Professional Networks"
    },
    {
      directoryId: "garrett-planning-network",
      name: "Garrett Planning Network",
      relevanceScore: 92,
      successProbability: 88,
      estimatedTraffic: 800,
      priority: "medium" as const,
      reasoning: "Network of hourly, fee-only financial planners. Attracts clients seeking accessible, unbiased financial planning without large asset minimums.",
      optimizedDescription: "Accessible, hourly financial planning services for individuals and families at all wealth levels. Summit Financial Planning offers comprehensive advice without asset minimums or commissioned products.",
      tags: ["Hourly Planning", "Accessible", "No Minimums", "Fee-Only", "Comprehensive Planning"],
      submissionTips: [
        "Highlight accessibility and hourly model",
        "Emphasize serving clients at all wealth levels",
        "Showcase specialized expertise areas",
        "Include information about initial consultation process"
      ],
      estimatedValue: 950,
      authority: 85,
      category: "Professional Networks"
    }
  ],
  insights: {
    marketPosition: "Summit Financial Planning operates in Denver's competitive financial services market with strong positioning as a comprehensive, fiduciary-focused firm serving both high-net-worth and accessible planning clients.",
    competitiveAdvantages: [
      "CFP certification and fiduciary commitment",
      "Comprehensive planning approach",
      "Local Denver market knowledge",
      "Fee-only structure builds trust",
      "Specialization in retirement and education planning"
    ],
    improvementSuggestions: [
      "Develop educational content marketing strategy",
      "Create client case studies and success stories",
      "Implement client referral program",
      "Build relationships with local CPAs and attorneys",
      "Offer financial planning workshops and seminars"
    ],
    successFactors: [
      "Strong professional credentials and continuing education",
      "Transparent fee structure and fiduciary commitment",
      "Excellent client service and communication",
      "Consistent results and portfolio performance",
      "Active involvement in local business community"
    ]
  },
  competitorAnalysis: {
    competitors: [
      {
        name: "Edward Jones",
        similarities: ["Financial planning", "Local presence", "Individual investors"],
        directoryPresence: ["CFP Board", "Local business directories"],
        marketAdvantages: ["Brand recognition", "Large advisor network", "Marketing resources"]
      },
      {
        name: "Local independent RIAs",
        similarities: ["Fee-only model", "Fiduciary commitment", "Personal service"],
        directoryPresence: ["NAPFA", "CFP Board", "Local directories"],
        marketAdvantages: ["Established client base", "Local referral networks", "Specialized niches"]
      }
    ],
    marketGaps: [
      "Technology-focused financial planning for younger professionals",
      "Specialized planning for Colorado outdoor industry professionals",
      "Comprehensive planning for small business owners and entrepreneurs"
    ],
    positioningAdvice: "Position Summit Financial Planning as the trusted, comprehensive financial planning firm that combines professional expertise with personal attention, emphasizing the fiduciary commitment and local Denver market knowledge."
  },
  seoAnalysis: {
    currentScore: 74,
    potentialScore: 92,
    keywordOpportunities: [
      "financial planner Denver",
      "fee-only financial advisor Colorado",
      "retirement planning Denver",
      "wealth management Colorado"
    ],
    backlinkPotential: 82
  },
  projectedResults: {
    monthlyTrafficIncrease: 680,
    leadGeneration: 45,
    revenueProjection: 35000,
    roi: 650,
    timeToResults: "8-12 weeks"
  },
  confidence: 93
}

// Export all sample analyses
export const sampleAnalyses = {
  localRestaurant: localRestaurantAnalysis,
  saasCompany: saasCompanyAnalysis,
  ecommerce: ecommerceAnalysis,
  professionalServices: professionalServicesAnalysis
}

// Industry categories for filtering
export const industryCategories = [
  "Restaurant & Food Service",
  "SaaS & Technology", 
  "E-commerce & Retail",
  "Professional Services",
  "Healthcare & Medical",
  "Real Estate",
  "Legal Services",
  "Beauty & Wellness",
  "Home Services",
  "Automotive",
  "Education",
  "Non-profit"
]