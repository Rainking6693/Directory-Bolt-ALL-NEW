import Head from 'next/head'
import { SEOMetaTags } from '../../lib/seo/metaTagGenerator'

interface SEOHeadProps {
  metaTags: SEOMetaTags
  additionalTags?: Array<{
    name?: string
    property?: string
    content: string
  }>
}

export default function SEOHead({ metaTags, additionalTags = [] }: SEOHeadProps) {
  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{metaTags.title}</title>
      <meta name="title" content={metaTags.title} />
      <meta name="description" content={metaTags.description} />
      <meta name="keywords" content={metaTags.keywords} />
      <link rel="canonical" href={metaTags.canonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={metaTags.ogUrl} />
      <meta property="og:title" content={metaTags.ogTitle} />
      <meta property="og:description" content={metaTags.ogDescription} />
      <meta property="og:image" content={metaTags.ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="DirectoryBolt" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={metaTags.ogUrl} />
      <meta property="twitter:title" content={metaTags.twitterTitle} />
      <meta property="twitter:description" content={metaTags.twitterDescription} />
      <meta property="twitter:image" content={metaTags.twitterImage} />

      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="DirectoryBolt" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* Performance and Technical Tags */}
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="format-detection" content="telephone=no" />
      
      {/* Favicon and Icons */}
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.json" />
      
      {/* Preconnect to external domains for performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      
      {/* Additional custom tags */}
      {additionalTags.map((tag, index) => {
        if (tag.property) {
          return <meta key={index} property={tag.property} content={tag.content} />
        } else if (tag.name) {
          return <meta key={index} name={tag.name} content={tag.content} />
        }
        return null
      })}

      {/* JSON-LD Structured Data */}
      {metaTags.jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(metaTags.jsonLd) }}
        />
      )}
    </Head>
  )
}