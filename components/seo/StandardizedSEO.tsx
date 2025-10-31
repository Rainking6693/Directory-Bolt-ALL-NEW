import Head from 'next/head'

interface SEOProps {
  title?: string
  description?: string
  canonicalUrl: string
  ogType?: 'website' | 'article'
  ogImage?: string
  noIndex?: boolean
  additionalMetaTags?: Array<{
    name?: string
    property?: string
    content: string
  }>
  structuredData?: object[]
}

const SITE_CONFIG = {
  siteName: 'DirectoryBolt',
  defaultTitle: 'AI Directory Submissions to 500+ Sites | DirectoryBolt',
  defaultDescription: 'Get listed on 500+ high-authority directories in days, not months. 14-day free trial. Consistent NAP, AI-optimized profiles, real-time tracking.',
  defaultOgImage: 'https://directorybolt.com/og/hero-1200x630.png',
  twitterHandle: '@directorybolt',
  organizationSchema: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DirectoryBolt",
    "url": "https://directorybolt.com",
    "logo": "https://directorybolt.com/logo.png",
    "sameAs": [
      "https://www.linkedin.com/company/directorybolt",
      "https://x.com/directorybolt"
    ]
  },
  serviceSchema: {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Automated Directory Submissions",
    "provider": { "@type": "Organization", "name": "DirectoryBolt" },
    "areaServed": "US",
    "description": "AI-optimized submissions to 500+ high-authority directories with ongoing maintenance.",
    "offers": [
      {
        "@type": "Offer",
        "name": "Starter",
        "priceCurrency": "USD",
        "price": "49",
        "url": "https://directorybolt.com/pricing"
      },
      {
        "@type": "Offer",
        "name": "Growth",
        "priceCurrency": "USD",
        "price": "89",
        "url": "https://directorybolt.com/pricing"
      },
      {
        "@type": "Offer",
        "name": "Pro",
        "priceCurrency": "USD",
        "price": "159",
        "url": "https://directorybolt.com/pricing"
      }
    ]
  }
}

export default function StandardizedSEO({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  ogImage,
  noIndex = false,
  additionalMetaTags = [],
  structuredData = []
}: SEOProps) {
  const finalTitle = title || SITE_CONFIG.defaultTitle
  const finalDescription = description || SITE_CONFIG.defaultDescription
  const finalOgImage = ogImage || SITE_CONFIG.defaultOgImage

  // Ensure title is ≤60 chars, description ≤155 chars
  const truncatedTitle = finalTitle.length > 60 ? finalTitle.substring(0, 57) + '...' : finalTitle
  const truncatedDescription = finalDescription.length > 155 ? finalDescription.substring(0, 152) + '...' : finalDescription

  // Default structured data includes Organization and Service schemas
  const defaultStructuredData = [
    SITE_CONFIG.organizationSchema,
    SITE_CONFIG.serviceSchema,
    ...structuredData
  ]

  return (
    <Head>
      {/* Essential Meta Tags */}
      <title>{truncatedTitle}</title>
      <meta name="description" content={truncatedDescription} />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content="AI Directory Submissions to 500+ Sites" />
      <meta property="og:description" content="Automate listings on 480+ directories. 14-day free trial. Money-back guarantee." />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:site_name" content={SITE_CONFIG.siteName} />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="AI Directory Submissions to 500+ Sites" />
      <meta name="twitter:description" content="Automate listings on 480+ directories. 14-day free trial. Money-back guarantee." />
      <meta name="twitter:image" content={finalOgImage} />
      <meta name="twitter:creator" content={SITE_CONFIG.twitterHandle} />
      <meta name="twitter:site" content={SITE_CONFIG.twitterHandle} />

      {/* Additional Meta Tags */}
      <meta name="author" content="DirectoryBolt" />
      <meta name="publisher" content="DirectoryBolt" />
      <meta name="language" content="English" />
      <meta name="geo.region" content="US" />
      <meta name="geo.country" content="United States" />

      {/* Mobile Optimization */}
      <meta name="theme-color" content="#f59e0b" />
      <meta name="msapplication-TileColor" content="#f59e0b" />

      {/* Custom Additional Meta Tags */}
      {additionalMetaTags.map((tag, index) => (
        <meta
          key={index}
          {...(tag.name ? { name: tag.name } : {})}
          {...(tag.property ? { property: tag.property } : {})}
          content={tag.content}
        />
      ))}

      {/* Structured Data */}
      {defaultStructuredData.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema)
          }}
        />
      ))}

      {/* Preconnect for Performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/site.webmanifest" />
    </Head>
  )
}

// Helper function to create FAQ schema
export function createFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
}

// Helper function to create BreadcrumbList schema
export function createBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((breadcrumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": breadcrumb.name,
      "item": breadcrumb.url
    }))
  }
}