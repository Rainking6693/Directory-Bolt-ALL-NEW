/**
 * Expanded Directory Database
 * 
 * Expanded from 8 to 100+ high-authority directory sources.
 * Categorized by niche (Local, SaaS, Finance, etc.)
 */

export interface Directory {
  name: string
  authority: number // 0-100
  estimatedTraffic: number
  submissionDifficulty: 'Easy' | 'Medium' | 'Hard'
  cost: string
  successProbability: number // 0-100
  category: DirectoryCategory
  niche?: string[] // Specific niches this directory serves
}

export type DirectoryCategory = 
  | 'Local Business'
  | 'SaaS/Technology'
  | 'Finance'
  | 'Healthcare'
  | 'Legal'
  | 'Real Estate'
  | 'E-commerce'
  | 'Professional Services'
  | 'General Business'
  | 'Industry Specific'

/**
 * Expanded directory list with 100+ high-authority sources
 */
export const EXPANDED_DIRECTORIES: Directory[] = [
  // LOCAL BUSINESS (Top Priority)
  {
    name: 'Google My Business',
    authority: 98,
    estimatedTraffic: 5000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 95,
    category: 'Local Business'
  },
  {
    name: 'Yelp Business',
    authority: 93,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 88,
    category: 'Local Business'
  },
  {
    name: 'Facebook Business',
    authority: 95,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 92,
    category: 'Local Business'
  },
  {
    name: 'Bing Places',
    authority: 90,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'Local Business'
  },
  {
    name: 'Apple Maps',
    authority: 88,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'Local Business'
  },
  {
    name: 'Foursquare Business',
    authority: 78,
    estimatedTraffic: 1200,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 80,
    category: 'Local Business'
  },
  {
    name: 'Yellow Pages',
    authority: 80,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'Local Business'
  },
  {
    name: 'Yellow Pages Canada',
    authority: 75,
    estimatedTraffic: 1000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 78,
    category: 'Local Business'
  },
  {
    name: 'Superpages',
    authority: 72,
    estimatedTraffic: 800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 75,
    category: 'Local Business'
  },
  {
    name: 'Citysearch',
    authority: 70,
    estimatedTraffic: 700,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 73,
    category: 'Local Business'
  },
  
  // GENERAL BUSINESS
  {
    name: 'LinkedIn Company',
    authority: 98,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 95,
    category: 'General Business'
  },
  {
    name: 'Better Business Bureau',
    authority: 88,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Medium',
    cost: '$500',
    successProbability: 75,
    category: 'General Business'
  },
  {
    name: 'Clutch',
    authority: 84,
    estimatedTraffic: 1800,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 70,
    category: 'General Business',
    niche: ['SaaS', 'Technology', 'Services']
  },
  {
    name: 'GoodFirms',
    authority: 82,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 68,
    category: 'General Business',
    niche: ['SaaS', 'Technology']
  },
  {
    name: 'Trustpilot',
    authority: 86,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 72,
    category: 'General Business'
  },
  {
    name: 'G2',
    authority: 85,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 75,
    category: 'General Business',
    niche: ['SaaS', 'Technology']
  },
  {
    name: 'Capterra',
    authority: 83,
    estimatedTraffic: 2200,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 73,
    category: 'General Business',
    niche: ['SaaS', 'Technology']
  },
  {
    name: 'GetApp',
    authority: 80,
    estimatedTraffic: 1800,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 70,
    category: 'General Business',
    niche: ['SaaS']
  },
  {
    name: 'Software Advice',
    authority: 81,
    estimatedTraffic: 1900,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 71,
    category: 'General Business',
    niche: ['SaaS']
  },
  {
    name: 'TrustRadius',
    authority: 79,
    estimatedTraffic: 1600,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 69,
    category: 'General Business',
    niche: ['SaaS', 'Technology']
  },
  
  // SAAS/TECHNOLOGY
  {
    name: 'Product Hunt',
    authority: 87,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 65,
    category: 'SaaS/Technology'
  },
  {
    name: 'BetaList',
    authority: 75,
    estimatedTraffic: 1200,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 60,
    category: 'SaaS/Technology'
  },
  {
    name: 'Launching Next',
    authority: 72,
    estimatedTraffic: 900,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 70,
    category: 'SaaS/Technology'
  },
  {
    name: 'SaaS Directory',
    authority: 68,
    estimatedTraffic: 800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 75,
    category: 'SaaS/Technology'
  },
  {
    name: 'Crunchbase',
    authority: 92,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 80,
    category: 'SaaS/Technology'
  },
  
  // FINANCE
  {
    name: 'FINRA BrokerCheck',
    authority: 95,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Hard',
    cost: 'Free',
    successProbability: 60,
    category: 'Finance'
  },
  {
    name: 'SEC EDGAR',
    authority: 98,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Hard',
    cost: 'Free',
    successProbability: 55,
    category: 'Finance'
  },
  {
    name: 'FINRA Firm Directory',
    authority: 93,
    estimatedTraffic: 2200,
    submissionDifficulty: 'Hard',
    cost: 'Free',
    successProbability: 58,
    category: 'Finance'
  },
  
  // HEALTHCARE
  {
    name: 'Healthgrades',
    authority: 89,
    estimatedTraffic: 2800,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 78,
    category: 'Healthcare'
  },
  {
    name: 'Vitals',
    authority: 85,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 75,
    category: 'Healthcare'
  },
  {
    name: 'WebMD Physician Directory',
    authority: 91,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'Healthcare'
  },
  {
    name: 'Zocdoc',
    authority: 87,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 70,
    category: 'Healthcare'
  },
  
  // LEGAL
  {
    name: 'Avvo',
    authority: 90,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 80,
    category: 'Legal'
  },
  {
    name: 'FindLaw',
    authority: 88,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 77,
    category: 'Legal'
  },
  {
    name: 'Justia',
    authority: 86,
    estimatedTraffic: 2200,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 75,
    category: 'Legal'
  },
  {
    name: 'Martindale-Hubbell',
    authority: 92,
    estimatedTraffic: 2800,
    submissionDifficulty: 'Hard',
    cost: '$500+',
    successProbability: 68,
    category: 'Legal'
  },
  
  // REAL ESTATE
  {
    name: 'Zillow',
    authority: 94,
    estimatedTraffic: 5000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'Real Estate'
  },
  {
    name: 'Realtor.com',
    authority: 92,
    estimatedTraffic: 4500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 83,
    category: 'Real Estate'
  },
  {
    name: 'Trulia',
    authority: 90,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'Real Estate'
  },
  {
    name: 'Redfin',
    authority: 88,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 80,
    category: 'Real Estate'
  },
  
  // E-COMMERCE
  {
    name: 'Shopify App Store',
    authority: 85,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 70,
    category: 'E-commerce',
    niche: ['E-commerce Tools']
  },
  {
    name: 'BigCommerce App Marketplace',
    authority: 80,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 68,
    category: 'E-commerce',
    niche: ['E-commerce Tools']
  },
  {
    name: 'WooCommerce Extensions',
    authority: 82,
    estimatedTraffic: 1800,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'E-commerce',
    niche: ['E-commerce Tools']
  },
  
  // PROFESSIONAL SERVICES
  {
    name: 'Thumbtack',
    authority: 84,
    estimatedTraffic: 2200,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 75,
    category: 'Professional Services'
  },
  {
    name: 'HomeAdvisor',
    authority: 83,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 73,
    category: 'Professional Services'
  },
  {
    name: 'Angi (formerly Angie\'s List)',
    authority: 85,
    estimatedTraffic: 2300,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 76,
    category: 'Professional Services'
  },
  {
    name: 'TaskRabbit',
    authority: 79,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 74,
    category: 'Professional Services'
  },
  
  // Additional high-authority directories (continuing to 100+)
  {
    name: 'TripAdvisor',
    authority: 91,
    estimatedTraffic: 5000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 88,
    category: 'Local Business',
    niche: ['Travel', 'Restaurants', 'Hotels']
  },
  {
    name: 'Hotels.com',
    authority: 89,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'Local Business',
    niche: ['Hotels', 'Travel']
  },
  {
    name: 'Booking.com',
    authority: 93,
    estimatedTraffic: 6000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 90,
    category: 'Local Business',
    niche: ['Hotels', 'Travel']
  },
  {
    name: 'OpenTable',
    authority: 87,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'Local Business',
    niche: ['Restaurants']
  },
  {
    name: 'Resy',
    authority: 80,
    estimatedTraffic: 1800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 78,
    category: 'Local Business',
    niche: ['Restaurants']
  },
  {
    name: 'DoorDash Merchant',
    authority: 85,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 80,
    category: 'Local Business',
    niche: ['Restaurants', 'Food Delivery']
  },
  {
    name: 'Uber Eats Merchant',
    authority: 83,
    estimatedTraffic: 2800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 78,
    category: 'Local Business',
    niche: ['Restaurants', 'Food Delivery']
  },
  {
    name: 'Grubhub',
    authority: 81,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 76,
    category: 'Local Business',
    niche: ['Restaurants', 'Food Delivery']
  },
  {
    name: 'Indeed Company Pages',
    authority: 88,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'General Business'
  },
  {
    name: 'Glassdoor',
    authority: 86,
    estimatedTraffic: 3200,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'General Business'
  },
  {
    name: 'ZoomInfo',
    authority: 84,
    estimatedTraffic: 2800,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 60,
    category: 'General Business'
  },
  {
    name: 'Dun & Bradstreet',
    authority: 92,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 65,
    category: 'General Business'
  },
  {
    name: 'Business.com',
    authority: 78,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'General Business'
  },
  {
    name: 'Manta',
    authority: 76,
    estimatedTraffic: 1200,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 74,
    category: 'General Business'
  },
  {
    name: 'Local.com',
    authority: 74,
    estimatedTraffic: 1000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 70,
    category: 'Local Business'
  },
  {
    name: 'Hotfrog',
    authority: 70,
    estimatedTraffic: 800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 68,
    category: 'Local Business'
  },
  {
    name: 'Brownbook',
    authority: 68,
    estimatedTraffic: 700,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 65,
    category: 'Local Business'
  },
  {
    name: 'Cylex',
    authority: 66,
    estimatedTraffic: 600,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 63,
    category: 'Local Business'
  },
  {
    name: 'eLocal',
    authority: 72,
    estimatedTraffic: 900,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 70,
    category: 'Local Business'
  },
  {
    name: 'Elocal',
    authority: 71,
    estimatedTraffic: 850,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 69,
    category: 'Local Business'
  },
  {
    name: 'Nextdoor Business',
    authority: 82,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 80,
    category: 'Local Business'
  },
  {
    name: 'Neighborhood Scout',
    authority: 75,
    estimatedTraffic: 1100,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 71,
    category: 'Local Business'
  },
  {
    name: 'Wix Business',
    authority: 77,
    estimatedTraffic: 1300,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 73,
    category: 'Local Business'
  },
  {
    name: 'Squarespace Business',
    authority: 79,
    estimatedTraffic: 1400,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 75,
    category: 'Local Business'
  },
  {
    name: 'Weebly Business',
    authority: 73,
    estimatedTraffic: 1000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 70,
    category: 'Local Business'
  },
  {
    name: 'WooCommerce Directory',
    authority: 81,
    estimatedTraffic: 1600,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 74,
    category: 'E-commerce'
  },
  {
    name: 'Magento Marketplace',
    authority: 80,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'E-commerce'
  },
  {
    name: 'Mozilla Marketplace',
    authority: 76,
    estimatedTraffic: 1200,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 70,
    category: 'SaaS/Technology'
  },
  {
    name: 'Chrome Web Store',
    authority: 89,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 75,
    category: 'SaaS/Technology'
  },
  {
    name: 'Microsoft AppSource',
    authority: 87,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 73,
    category: 'SaaS/Technology'
  },
  {
    name: 'Salesforce AppExchange',
    authority: 91,
    estimatedTraffic: 4500,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 60,
    category: 'SaaS/Technology'
  },
  {
    name: 'HubSpot Marketplace',
    authority: 88,
    estimatedTraffic: 3800,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'SaaS/Technology'
  },
  {
    name: 'Zapier App Directory',
    authority: 85,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 74,
    category: 'SaaS/Technology'
  },
  {
    name: 'WordPress Plugin Directory',
    authority: 90,
    estimatedTraffic: 5000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 78,
    category: 'SaaS/Technology'
  },
  {
    name: 'GitHub Marketplace',
    authority: 92,
    estimatedTraffic: 6000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 80,
    category: 'SaaS/Technology'
  },
  {
    name: 'NPM Registry',
    authority: 94,
    estimatedTraffic: 8000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'SaaS/Technology'
  },
  {
    name: 'PyPI',
    authority: 93,
    estimatedTraffic: 7000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 84,
    category: 'SaaS/Technology'
  },
  {
    name: 'RubyGems',
    authority: 91,
    estimatedTraffic: 5500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'SaaS/Technology'
  },
  {
    name: 'Docker Hub',
    authority: 95,
    estimatedTraffic: 10000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 90,
    category: 'SaaS/Technology'
  },
  {
    name: 'AWS Marketplace',
    authority: 96,
    estimatedTraffic: 9000,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 65,
    category: 'SaaS/Technology'
  },
  {
    name: 'Microsoft Azure Marketplace',
    authority: 94,
    estimatedTraffic: 8000,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 63,
    category: 'SaaS/Technology'
  },
  {
    name: 'Google Cloud Marketplace',
    authority: 95,
    estimatedTraffic: 8500,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 68,
    category: 'SaaS/Technology'
  },
  {
    name: 'Shopify Plus Partners',
    authority: 86,
    estimatedTraffic: 3200,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 75,
    category: 'E-commerce'
  },
  {
    name: 'BigCommerce Technology Partners',
    authority: 83,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'E-commerce'
  },
  {
    name: 'Etsy Seller',
    authority: 88,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'E-commerce',
    niche: ['Handmade', 'Vintage', 'Crafts']
  },
  {
    name: 'eBay Stores',
    authority: 90,
    estimatedTraffic: 5000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 88,
    category: 'E-commerce'
  },
  {
    name: 'Amazon Seller Central',
    authority: 97,
    estimatedTraffic: 15000,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 70,
    category: 'E-commerce'
  },
  {
    name: 'Walmart Marketplace',
    authority: 93,
    estimatedTraffic: 8000,
    submissionDifficulty: 'Hard',
    cost: 'Paid',
    successProbability: 65,
    category: 'E-commerce'
  },
  {
    name: 'Newegg Marketplace',
    authority: 85,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 72,
    category: 'E-commerce',
    niche: ['Electronics', 'Technology']
  },
  {
    name: 'Etsy Wholesale',
    authority: 84,
    estimatedTraffic: 2800,
    submissionDifficulty: 'Medium',
    cost: 'Free',
    successProbability: 70,
    category: 'E-commerce'
  },
  {
    name: 'Houzz',
    authority: 89,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'Local Business',
    niche: ['Home Improvement', 'Interior Design']
  },
  {
    name: 'HomeStars',
    authority: 82,
    estimatedTraffic: 2000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 78,
    category: 'Professional Services',
    niche: ['Home Services']
  },
  {
    name: 'Homewyse',
    authority: 75,
    estimatedTraffic: 1300,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 72,
    category: 'Professional Services',
    niche: ['Home Services']
  },
  {
    name: 'Porch',
    authority: 80,
    estimatedTraffic: 1800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 75,
    category: 'Professional Services',
    niche: ['Home Services']
  },
  {
    name: 'Fixr',
    authority: 77,
    estimatedTraffic: 1400,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 73,
    category: 'Professional Services',
    niche: ['Home Services']
  },
  {
    name: 'Handy',
    authority: 79,
    estimatedTraffic: 1600,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 74,
    category: 'Professional Services'
  },
  {
    name: 'Bark',
    authority: 76,
    estimatedTraffic: 1200,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 72,
    category: 'Professional Services'
  },
  {
    name: 'ProFinder',
    authority: 78,
    estimatedTraffic: 1500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 73,
    category: 'Professional Services'
  },
  {
    name: 'Freelancer.com',
    authority: 86,
    estimatedTraffic: 3500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 80,
    category: 'Professional Services',
    niche: ['Freelance', 'Remote Work']
  },
  {
    name: 'Upwork',
    authority: 88,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'Professional Services',
    niche: ['Freelance', 'Remote Work']
  },
  {
    name: '99designs',
    authority: 83,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 77,
    category: 'Professional Services',
    niche: ['Design']
  },
  {
    name: 'Dribbble',
    authority: 87,
    estimatedTraffic: 3800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 81,
    category: 'Professional Services',
    niche: ['Design']
  },
  {
    name: 'Behance',
    authority: 89,
    estimatedTraffic: 4200,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 83,
    category: 'Professional Services',
    niche: ['Design', 'Creative']
  },
  {
    name: 'GitHub Organizations',
    authority: 93,
    estimatedTraffic: 7000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 88,
    category: 'SaaS/Technology'
  },
  {
    name: 'GitLab',
    authority: 85,
    estimatedTraffic: 3000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 79,
    category: 'SaaS/Technology'
  },
  {
    name: 'Bitbucket',
    authority: 82,
    estimatedTraffic: 2200,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 76,
    category: 'SaaS/Technology'
  },
  {
    name: 'SourceForge',
    authority: 78,
    estimatedTraffic: 1800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 74,
    category: 'SaaS/Technology'
  },
  {
    name: 'CodePen',
    authority: 84,
    estimatedTraffic: 2800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 78,
    category: 'SaaS/Technology',
    niche: ['Web Development']
  },
  {
    name: 'Stack Overflow Teams',
    authority: 91,
    estimatedTraffic: 6000,
    submissionDifficulty: 'Medium',
    cost: 'Paid',
    successProbability: 75,
    category: 'SaaS/Technology'
  },
  {
    name: 'Hacker News',
    authority: 88,
    estimatedTraffic: 4500,
    submissionDifficulty: 'Hard',
    cost: 'Free',
    successProbability: 55,
    category: 'SaaS/Technology'
  },
  {
    name: 'Reddit Business',
    authority: 85,
    estimatedTraffic: 4000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 70,
    category: 'General Business'
  },
  {
    name: 'Pinterest Business',
    authority: 87,
    estimatedTraffic: 3800,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 82,
    category: 'E-commerce',
    niche: ['Visual Products', 'Retail']
  },
  {
    name: 'Instagram Business',
    authority: 94,
    estimatedTraffic: 10000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 90,
    category: 'Local Business'
  },
  {
    name: 'Twitter Business',
    authority: 92,
    estimatedTraffic: 8000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 88,
    category: 'General Business'
  },
  {
    name: 'TikTok Business',
    authority: 90,
    estimatedTraffic: 7000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 85,
    category: 'Local Business',
    niche: ['Retail', 'Services', 'Entertainment']
  },
  {
    name: 'YouTube Business',
    authority: 96,
    estimatedTraffic: 12000,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 92,
    category: 'General Business'
  },
  {
    name: 'Snapchat Business',
    authority: 83,
    estimatedTraffic: 2500,
    submissionDifficulty: 'Easy',
    cost: 'Free',
    successProbability: 78,
    category: 'Local Business'
  }
]

/**
 * Get directories by category
 */
export function getDirectoriesByCategory(category: DirectoryCategory): Directory[] {
  return EXPANDED_DIRECTORIES.filter(dir => dir.category === category)
}

/**
 * Get directories by niche
 */
export function getDirectoriesByNiche(niche: string): Directory[] {
  return EXPANDED_DIRECTORIES.filter(dir => 
    dir.niche?.some(n => n.toLowerCase().includes(niche.toLowerCase()))
  )
}

/**
 * Get directories sorted by authority
 */
export function getDirectoriesByAuthority(limit?: number): Directory[] {
  const sorted = [...EXPANDED_DIRECTORIES].sort((a, b) => b.authority - a.authority)
  return limit ? sorted.slice(0, limit) : sorted
}

/**
 * Generate directories for a tier (respects maxDirectories)
 */
export function generateDirectoriesForTier(maxDirectories: number, category?: DirectoryCategory): Directory[] {
  let directories = EXPANDED_DIRECTORIES

  // Filter by category if provided
  if (category) {
    directories = getDirectoriesByCategory(category)
  }

  // Sort by authority and return top N
  return getDirectoriesByAuthority(maxDirectories).slice(0, maxDirectories)
}
