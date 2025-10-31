// @ts-nocheck
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { directoryBoltSchema } from '../lib/seo/enhanced-schema'
import { generateFAQSchema, directorySubmissionFAQs } from '../lib/seo/faq-schema'

const LandingPage = dynamic(() => import('../components/NewLandingPage').then(mod => ({ default: mod.default })), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  ),
  ssr: true, // Enable SSR for SEO
})


export default function Home() {
  // Force deployment rebuild - Build timestamp: 2025-09-17T13:15:00Z
  return (
    <>
      <Head>
        <title>AI Business Intelligence Platform | $4,300 Value for $299 | DirectoryBolt</title>
        <meta name="description" content="Get $4,300 worth of AI business intelligence for $299. Competitive analysis, market research, and strategic insights that typically cost $2,000-5,000 from consultants. 93% savings guaranteed." />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href="https://directorybolt.com/" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="AI Business Intelligence Platform | $4,300 Value for $299" />
        <meta property="og:description" content="Get $4,300 worth of AI business intelligence for $299. Competitive analysis, market research, and strategic insights that typically cost $2,000-5,000 from consultants. 93% savings guaranteed." />
        <meta property="og:url" content="https://directorybolt.com/" />
        <meta property="og:image" content="https://directorybolt.com/og/hero-1200x630.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="DirectoryBolt" />
        
        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Business Intelligence Platform | $4,300 Value for $299" />
        <meta name="twitter:description" content="Get $4,300 worth of AI business intelligence for $299. Competitive analysis, market research, and strategic insights that typically cost $2,000-5,000 from consultants. 93% savings guaranteed." />
        <meta name="twitter:image" content="https://directorybolt.com/og/hero-1200x630.png" />
        <meta name="twitter:creator" content="@DirectoryBolt" />
        <meta name="twitter:site" content="@DirectoryBolt" />
        
        {/* Additional SEO Meta Tags */}
        <meta name="keywords" content="AI business intelligence platform, business intelligence software, competitive analysis tools, market research automation, strategic business insights, AI business consultant, business intelligence ROI, automated competitive intelligence, AI market analysis, business intelligence vs consultants" />
        <meta name="author" content="DirectoryBolt" />
        <meta name="publisher" content="DirectoryBolt" />
        <meta name="copyright" content="DirectoryBolt" />
        <meta name="language" content="English" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        
        {/* Business/Local SEO */}
        <meta name="geo.region" content="US" />
        <meta name="geo.country" content="United States" />
        <meta name="ICBM" content="40.7128, -74.0060" />
        <meta name="geo.position" content="40.7128;-74.0060" />
        
        {/* Mobile Optimization */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#f59e0b" />
        <meta name="msapplication-TileColor" content="#f59e0b" />
        
        {/* Enhanced Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(directoryBoltSchema.generateOrganizationSchema())
          }}
        />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(directoryBoltSchema.generateServiceSchema())
          }}
        />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(directoryBoltSchema.generateLocalBusinessSchema())
          }}
        />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateFAQSchema(directorySubmissionFAQs))
          }}
        />
        
        {/* AI Business Intelligence Platform Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "DirectoryBolt AI Business Intelligence Platform",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web Browser",
              "description": "AI-powered business intelligence platform delivering $4,300 worth of competitive analysis, market research, and strategic insights for $299",
              "url": "https://directorybolt.com",
              "offers": {
                "@type": "Offer",
                "price": "299",
                "priceCurrency": "USD",
                "description": "$4,300 worth of business intelligence for $299 - 93% savings vs traditional consultants",
                "availability": "https://schema.org/InStock",
                "validFrom": "2024-01-01",
                "priceValidUntil": "2025-12-31"
              },
              "featureList": [
                "AI-powered competitive analysis",
                "Automated market research",
                "Business intelligence reporting",
                "Strategic insights generation",
                "Real-time business analytics",
                "Competitor monitoring",
                "Industry trend analysis"
              ],
              "screenshot": "https://directorybolt.com/images/platform-screenshot.jpg",
              "softwareVersion": "2.0",
              "datePublished": "2024-01-01",
              "dateModified": "2024-12-01",
              "author": {
                "@type": "Organization",
                "name": "DirectoryBolt",
                "url": "https://directorybolt.com"
              },
              "publisher": {
                "@type": "Organization",
                "name": "DirectoryBolt",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://directorybolt.com/images/logo.png"
                }
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "247",
                "bestRating": "5",
                "worstRating": "1"
              }
            })
          }}
        />
        
        {/* Website Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org/",
              "@type": "WebSite",
              "name": "DirectoryBolt",
              "alternateName": "Directory Bolt",
              "url": "https://directorybolt.com/",
              "description": "AI-powered business intelligence platform delivering $4,300 worth of competitive analysis, market research, and strategic insights for $299. 93% savings vs traditional consultants.",
              "publisher": {
                "@type": "Organization",
                "name": "DirectoryBolt",
                "url": "https://directorybolt.com/",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://directorybolt.com/images/logo.png",
                  "width": 512,
                  "height": 512
                }
              },
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://directorybolt.com/analyze?url={search_term_string}",
                "query-input": "required name=search_term_string"
              },
              "sameAs": [
                "https://www.linkedin.com/company/directorybolt",
                "https://x.com/directorybolt",
                "https://www.facebook.com/directorybolt"
              ]
            })
          }}
        />

        {/* BreadcrumbList */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://directorybolt.com/"
                }
              ]
            })
          }}
        />
        
        
        {/* Preload critical resources */}
        <link rel="preload" as="image" href="/hero.svg" />
        
        {/* Favicon and Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>

      <LandingPage />
    </>
  )
}

// Force static generation
export async function getStaticProps() {
  return {
    props: {
      buildTime: new Date().toISOString()
    },
    revalidate: false // Static generation
  }
}