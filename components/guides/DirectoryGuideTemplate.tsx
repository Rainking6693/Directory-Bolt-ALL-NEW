import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { DirectoryGuideData } from '../../lib/guides/contentManager'
import { ShareButton } from './ShareButton'
import { BookmarkButton } from './BookmarkButton'
import { Breadcrumbs } from './Breadcrumbs'
import { TableOfContents } from './TableOfContents'
import { RelatedGuides } from './RelatedGuides'
import { ProgressTracker } from './ProgressTracker'
import { ConversionTracker } from '../analytics/ConversionTracker'

interface DirectoryGuideTemplateProps {
  guide: DirectoryGuideData
  relatedGuides: DirectoryGuideData[]
}

export default function DirectoryGuideTemplate({ guide, relatedGuides }: DirectoryGuideTemplateProps) {
  const [readingProgress, setReadingProgress] = useState(0)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (window.scrollY / totalHeight) * 100
      setReadingProgress(Math.min(100, Math.max(0, progress)))

      // Track active section for table of contents
      const sections = guide.content.sections
      const sectionElements = sections.map(section => 
        document.getElementById(section.id)
      ).filter(Boolean)

      let currentSection = ''
      for (const element of sectionElements) {
        if (element && element.getBoundingClientRect().top <= 100) {
          currentSection = element.id
        }
      }
      setActiveSection(currentSection)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [guide.content.sections])

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.title,
    description: guide.description,
    image: guide.featuredImage,
    totalTime: guide.estimatedReadTime,
    supply: guide.content.requirements?.map(req => ({
      '@type': 'HowToSupply',
      name: req
    })) || [],
    tool: guide.content.tools?.map(tool => ({
      '@type': 'HowToTool',
      name: tool
    })) || [],
    step: guide.content.sections.map((section, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: section.title,
      text: section.content,
      image: section.image || guide.featuredImage
    })),
    author: {
      '@type': 'Organization',
      name: 'DirectoryBolt',
      url: 'https://directorybolt.com'
    },
    publisher: {
      '@type': 'Organization',
      name: 'DirectoryBolt',
      logo: {
        '@type': 'ImageObject',
        url: 'https://directorybolt.com/logo.png'
      }
    },
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt
  }

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <meta property="og:title" content={guide.seo.title} />
        <meta property="og:description" content={guide.seo.description} />
        <meta property="og:image" content={guide.featuredImage} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://directorybolt.com/guides/${guide.slug}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={guide.seo.title} />
        <meta name="twitter:description" content={guide.seo.description} />
        <meta name="twitter:image" content={guide.featuredImage} />
        <link rel="canonical" href={`https://directorybolt.com/guides/${guide.slug}`} />
      </Head>

      <ConversionTracker event="guide_view" data={{ guide: guide.slug, category: guide.category }} />
      
      <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        {/* Progress Bar */}
        <ProgressTracker progress={readingProgress} />

        {/* Breadcrumbs */}
        <Breadcrumbs guide={guide} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Table of Contents - Sticky Sidebar */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="sticky top-8">
                <TableOfContents 
                  sections={guide.content.sections}
                  activeSection={activeSection}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <article className="bg-secondary-800/30 backdrop-blur-sm border border-secondary-700/50 rounded-xl p-8">
                {/* Article Header */}
                <header className="mb-8">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-volt-500/20 text-volt-400 border border-volt-500/30">
                      {guide.category}
                    </span>
                    <span className="text-secondary-400 text-sm">
                      {guide.estimatedReadTime} read
                    </span>
                    <span className="text-secondary-400 text-sm">
                      Updated {new Date(guide.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                    {guide.title}
                  </h1>

                  <p className="text-xl text-secondary-300 mb-6 leading-relaxed">
                    {guide.description}
                  </p>

                  {guide.featuredImage && (
                    <div className="mb-6 rounded-lg overflow-hidden">
                      <img 
                        src={guide.featuredImage}
                        alt={guide.title}
                        className="w-full h-64 object-cover"
                        loading="eager"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-secondary-700">
                    <ShareButton guide={guide} />
                    <BookmarkButton guide={guide} />
                    <div className="flex items-center gap-2 text-secondary-400 text-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                      </svg>
                      {guide.viewCount} views
                    </div>
                  </div>
                </header>

                {/* Prerequisites */}
                {guide.content.requirements && guide.content.requirements.length > 0 && (
                  <div className="mb-8 p-6 bg-volt-500/10 border border-volt-500/20 rounded-lg">
                    <h2 className="text-lg font-semibold text-volt-400 mb-4">What You'll Need</h2>
                    <ul className="space-y-2">
                      {guide.content.requirements.map((req, index) => (
                        <li key={index} className="flex items-start gap-3 text-secondary-300">
                          <svg className="w-5 h-5 text-volt-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                          </svg>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Guide Content */}
                <div className="prose prose-lg prose-invert max-w-none">
                  {guide.content.sections.map((section, index) => (
                    <section key={section.id} id={section.id} className="mb-12">
                      <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-volt-500 text-secondary-900 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        {section.title}
                      </h2>
                      
                      {section.image && (
                        <div className="mb-6 rounded-lg overflow-hidden">
                          <img 
                            src={section.image}
                            alt={section.title}
                            className="w-full h-48 object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div 
                        className="text-secondary-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />

                      {section.tips && section.tips.length > 0 && (
                        <div className="mt-6 p-4 bg-secondary-700/30 border-l-4 border-volt-500 rounded-r-lg">
                          <h3 className="text-volt-400 font-semibold mb-2">💡 Pro Tips</h3>
                          <ul className="space-y-1 text-secondary-300">
                            {section.tips.map((tip, tipIndex) => (
                              <li key={tipIndex} className="text-sm">• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  ))}
                </div>

                {/* CTA Section */}
                <div className="mt-12 p-8 bg-gradient-to-r from-volt-500/20 to-volt-600/20 border border-volt-500/30 rounded-xl text-center">
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Ready to Submit to {guide.directoryName}?
                  </h3>
                  <p className="text-secondary-300 mb-6">
                    Let DirectoryBolt handle the entire submission process for you. Our AI-powered system ensures perfect submissions every time.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link 
                      href="/analyze"
                      className="inline-flex items-center justify-center px-6 py-3 bg-volt-500 text-secondary-900 font-semibold rounded-lg hover:bg-volt-400 transition-colors"
                      onClick={() => {
                        // Track conversion
                        if (typeof window !== 'undefined' && window.gtag) {
                          window.gtag('event', 'guide_cta_click', {
                            guide_name: guide.slug,
                            cta_type: 'analyze'
                          })
                        }
                      }}
                    >
                      Get Started Free
                    </Link>
                    <Link 
                      href="/pricing"
                      className="inline-flex items-center justify-center px-6 py-3 border border-volt-500 text-volt-400 font-semibold rounded-lg hover:bg-volt-500/10 transition-colors"
                      onClick={() => {
                        // Track conversion
                        if (typeof window !== 'undefined' && window.gtag) {
                          window.gtag('event', 'guide_cta_click', {
                            guide_name: guide.slug,
                            cta_type: 'pricing'
                          })
                        }
                      }}
                    >
                      View Premium Plans
                    </Link>
                  </div>
                </div>
              </article>

              {/* Related Guides */}
              {relatedGuides.length > 0 && (
                <div className="mt-8">
                  <RelatedGuides guides={relatedGuides} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}