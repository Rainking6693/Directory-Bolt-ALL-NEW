import Head from 'next/head'
import { ReactNode } from 'react'
import Header from '../Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
  title?: string
  description?: string
  canonical?: string
  noIndex?: boolean
  ogImage?: string
  jsonLd?: object[]
}

export default function Layout({
  children,
  title,
  description,
  canonical,
  noIndex = false,
  ogImage,
  jsonLd = []
}: LayoutProps) {
  const defaultTitle = 'DirectoryBolt | AI-Powered Directory Submission Service'
  const defaultDescription = 'Get your business listed on 480+ directories with our AI-powered submission service. Boost local SEO and increase online visibility.'
  const defaultOgImage = 'https://directorybolt.com/images/og-default.jpg'

  const pageTitle = title || defaultTitle
  const pageDescription = description || defaultDescription
  const pageOgImage = ogImage || defaultOgImage

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Robots */}
        <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
        <meta name="googlebot" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />

        {/* Canonical URL */}
        {canonical && <link rel="canonical" href={canonical} />}

        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={pageOgImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="DirectoryBolt" />
        {canonical && <meta property="og:url" content={canonical} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={pageOgImage} />
        <meta name="twitter:creator" content="@DirectoryBolt" />
        <meta name="twitter:site" content="@DirectoryBolt" />

        {/* Additional Meta Tags */}
        <meta name="author" content="DirectoryBolt" />
        <meta name="publisher" content="DirectoryBolt" />
        <meta name="copyright" content="DirectoryBolt" />
        <meta name="language" content="English" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />

        {/* Mobile Optimization */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#609fae" />
        <meta name="msapplication-TileColor" content="#609fae" />

        {/* Favicons */}
        <link rel="icon" href="/logo.jpg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <link rel="icon" type="image/jpeg" sizes="32x32" href="/logo.jpg" />
        <link rel="icon" type="image/jpeg" sizes="16x16" href="/logo.jpg" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* JSON-LD Structured Data */}
        {jsonLd.map((schema, index) => (
          <script
            key={`jsonld-${index}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </Head>

      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </>
  )
}