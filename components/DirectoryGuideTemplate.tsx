import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { CheckCircle, Clock, Users, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react'

interface DirectoryGuideProps {
  guide: {
    slug: string
    title: string
    metaDescription: string
    industry: string[]
    difficulty: 'easy' | 'moderate' | 'challenging'
    estimatedTime: string
    authorityScore: number
    approvalRate: string
    requirements: string[]
    contentSections: ContentSection[]
    relatedDirectories: string[]
    lastUpdated: string
  }
}

interface ContentSection {
  type: 'overview' | 'requirements' | 'process' | 'tips' | 'troubleshooting'
  title: string
  content: string
  conversionElements?: ConversionElement[]
  checklist?: string[]
  screenshots?: string[]
}

interface ConversionElement {
  type: 'insight' | 'comparison' | 'cta'
  content: string
  action?: string
  priority: 'low' | 'medium' | 'high'
}

export default function DirectoryGuideTemplate({ guide }: DirectoryGuideProps) {
  const [readingProgress, setReadingProgress] = useState(0)
  const [activeSection, setActiveSection] = useState(0)
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({})

  // Reading progress tracking
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (window.pageYOffset / totalHeight) * 100
      setReadingProgress(progress)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-success-500 bg-success-500/10'
      case 'moderate': return 'text-volt-500 bg-volt-500/10'
      case 'challenging': return 'text-danger-500 bg-danger-500/10'
      default: return 'text-secondary-400'
    }
  }

  const toggleChecklistItem = (itemId: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
    
    // Analytics tracking
    if (typeof gtag !== 'undefined') {
      gtag('event', 'checklist_interaction', {
        event_category: 'user_engagement',
        event_label: guide.slug,
        custom_parameters: { item_id: itemId }
      })
    }
  }

  return (
    <>
      <Head>
        <title>{guide.title} | DirectoryBolt</title>
        <meta name="description" content={guide.metaDescription} />
        <meta name="keywords" content={`${guide.title.toLowerCase()}, directory submission, business listing`} />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content={guide.title} />
        <meta property="og:description" content={guide.metaDescription} />
        <meta property="og:type" content="article" />
        
        {/* Schema Markup for HowTo */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              "name": guide.title,
              "description": guide.metaDescription,
              "totalTime": guide.estimatedTime,
              "estimatedCost": "Free",
              "step": guide.contentSections.map((section, index) => ({
                "@type": "HowToStep",
                "position": index + 1,
                "name": section.title,
                "text": section.content.substring(0, 200) + "..."
              }))
            })
          }}
        />
      </Head>

      <div className="min-h-screen bg-secondary-900 text-white">
        {/* Reading Progress Bar */}
        <div className="fixed top-0 left-0 w-full h-1 bg-secondary-800 z-50">
          <div
            className="h-full bg-gradient-to-r from-volt-500 to-volt-400 transition-all duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Navigation Header */}
        <nav className="bg-secondary-800/90 backdrop-blur border-b border-secondary-700 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <a href="/directory-guides" className="text-secondary-400 hover:text-white">
                  Directory Guides
                </a>
                <span className="text-secondary-600">/</span>
                <span className="text-volt-400 font-medium">{guide.title}</span>
              </div>
              
              <button className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-4 py-2 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105">
                Try DirectoryBolt Free
              </button>
            </div>
          </div>
        </nav>

        {/* Guide Hero Section */}
        <section className="bg-gradient-to-b from-secondary-800 to-secondary-900 py-12 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              {/* Industry Tags */}
              <div className="flex justify-center space-x-2 mb-4">
                {guide.industry.map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1 bg-volt-500/20 text-volt-400 rounded-full text-sm font-medium capitalize"
                  >
                    {category}
                  </span>
                ))}
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                {guide.title}
              </h1>
              
              <p className="text-xl text-secondary-300 mb-8 max-w-3xl mx-auto">
                {guide.metaDescription}
              </p>

              {/* Guide Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="bg-secondary-800/50 rounded-lg p-4">
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(guide.difficulty)}`}>
                    {guide.difficulty}
                  </div>
                  <p className="text-secondary-400 text-xs mt-1">Difficulty</p>
                </div>
                
                <div className="bg-secondary-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-center text-volt-400">
                    <Clock size={16} className="mr-1" />
                    <span className="font-medium">{guide.estimatedTime}</span>
                  </div>
                  <p className="text-secondary-400 text-xs mt-1">Time Required</p>
                </div>
                
                <div className="bg-secondary-800/50 rounded-lg p-4">
                  <div className="text-success-400 font-medium">
                    {guide.approvalRate}
                  </div>
                  <p className="text-secondary-400 text-xs mt-1">Approval Rate</p>
                </div>
                
                <div className="bg-secondary-800/50 rounded-lg p-4">
                  <div className="text-volt-400 font-medium">
                    DA {guide.authorityScore}
                  </div>
                  <p className="text-secondary-400 text-xs mt-1">Authority Score</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="lg:grid lg:grid-cols-4 lg:gap-12">
            {/* Table of Contents - Sidebar */}
            <div className="lg:col-span-1 mb-8 lg:mb-0">
              <div className="sticky top-24">
                <h3 className="text-lg font-bold text-white mb-4">Guide Contents</h3>
                <nav className="space-y-2">
                  {guide.contentSections.map((section, index) => (
                    <a
                      key={index}
                      href={`#section-${index}`}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === index
                          ? 'bg-volt-500/20 text-volt-400 border-l-2 border-volt-500'
                          : 'text-secondary-400 hover:text-white hover:bg-secondary-800/50'
                      }`}
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>

                {/* Requirements Quick Reference */}
                <div className="mt-8 p-4 bg-secondary-800/50 rounded-lg">
                  <h4 className="font-semibold text-white mb-3 flex items-center">
                    <CheckCircle size={16} className="mr-2 text-success-400" />
                    Quick Requirements
                  </h4>
                  <ul className="space-y-2">
                    {guide.requirements.map((req, index) => (
                      <li key={index} className="text-sm text-secondary-300 flex items-start">
                        <span className="w-2 h-2 bg-volt-400 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <article className="prose prose-invert prose-lg max-w-none">
                {guide.contentSections.map((section, sectionIndex) => (
                  <section key={sectionIndex} id={`section-${sectionIndex}`} className="mb-16">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 border-l-4 border-volt-500 pl-4">
                      {section.title}
                    </h2>
                    
                    <div className="text-secondary-300 leading-relaxed mb-6">
                      {section.content}
                    </div>

                    {/* Interactive Checklist */}
                    {section.checklist && (
                      <div className="bg-secondary-800/30 rounded-lg p-6 my-8">
                        <h4 className="text-lg font-semibold text-white mb-4">
                          Step-by-Step Checklist
                        </h4>
                        <div className="space-y-3">
                          {section.checklist.map((item, itemIndex) => {
                            const itemId = `${sectionIndex}-${itemIndex}`
                            return (
                              <label
                                key={itemIndex}
                                className="flex items-start space-x-3 cursor-pointer group"
                              >
                                <div className="relative mt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={checkedItems[itemId] || false}
                                    onChange={() => toggleChecklistItem(itemId)}
                                    className="sr-only"
                                  />
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                      checkedItems[itemId]
                                        ? 'bg-success-500 border-success-500'
                                        : 'border-secondary-600 group-hover:border-volt-400'
                                    }`}
                                  >
                                    {checkedItems[itemId] && (
                                      <CheckCircle size={12} className="text-white" />
                                    )}
                                  </div>
                                </div>
                                <span
                                  className={`text-sm ${
                                    checkedItems[itemId]
                                      ? 'text-secondary-400 line-through'
                                      : 'text-secondary-300 group-hover:text-white'
                                  }`}
                                >
                                  {item}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Conversion Elements */}
                    {section.conversionElements?.map((element, elementIndex) => (
                      <ConversionElement key={elementIndex} element={element} guideSlug={guide.slug} />
                    ))}
                  </section>
                ))}

                {/* Final Conversion Section */}
                <section className="mt-16 bg-gradient-to-r from-volt-500/10 to-volt-400/10 rounded-xl p-8 border border-volt-500/20">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">
                      Save 40+ Hours of Manual Directory Work
                    </h3>
                    <p className="text-secondary-300 mb-6 max-w-2xl mx-auto">
                      You've seen how complex manual directory submissions can be. DirectoryBolt automates 
                      this entire process across 100+ directories, preventing rejections and saving you weeks of work.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-8 py-3 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105">
                        Start Free Analysis
                      </button>
                      <button className="border-2 border-volt-500 text-volt-400 font-bold px-8 py-3 rounded-lg hover:bg-volt-500/10 transition-all duration-300">
                        See How It Works
                      </button>
                    </div>
                    
                    <p className="text-xs text-secondary-400 mt-4">
                      No credit card required • Free analysis in under 2 minutes
                    </p>
                  </div>
                </section>

                {/* Related Directories */}
                <section className="mt-16">
                  <h3 className="text-xl font-bold text-white mb-6">Related Directory Guides</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {guide.relatedDirectories.map((relatedSlug) => (
                      <div key={relatedSlug} className="bg-secondary-800/50 rounded-lg p-4 hover:bg-secondary-800/70 transition-colors">
                        <h4 className="font-semibold text-white mb-2 capitalize">
                          {relatedSlug.replace('-', ' ')} Guide
                        </h4>
                        <p className="text-secondary-400 text-sm mb-3">
                          Complete submission guide and requirements
                        </p>
                        <a
                          href={`/directory-guides/${relatedSlug}`}
                          className="inline-flex items-center text-volt-400 hover:text-volt-300 text-sm font-medium"
                        >
                          Read Guide <ArrowRight size={14} className="ml-1" />
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              </article>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Conversion Element Component
function ConversionElement({ element, guideSlug }: { element: ConversionElement; guideSlug: string }) {
  const handleConversionClick = (action: string) => {
    // Analytics tracking
    if (typeof gtag !== 'undefined') {
      gtag('event', 'conversion_element_click', {
        event_category: 'conversion',
        event_label: guideSlug,
        custom_parameters: {
          element_type: element.type,
          action: action,
          priority: element.priority
        }
      })
    }
  }

  switch (element.type) {
    case 'insight':
      return (
        <div className="bg-volt-500/10 border-l-4 border-volt-500 p-6 my-8">
          <div className="flex items-start">
            <Lightbulb className="text-volt-400 mr-3 mt-1 flex-shrink-0" size={20} />
            <div>
              <h4 className="font-semibold text-volt-400 mb-2">Time-Saving Insight</h4>
              <p className="text-secondary-300">{element.content}</p>
            </div>
          </div>
        </div>
      )

    case 'comparison':
      return (
        <div className="bg-secondary-800/50 rounded-lg p-6 my-8">
          <h4 className="text-lg font-semibold text-white mb-4 text-center">
            Manual vs Automated Submission
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <h5 className="font-medium text-danger-400 mb-3">Manual Process</h5>
              <div className="space-y-2 text-sm text-secondary-300">
                <div>⏱️ 45-60 min per directory</div>
                <div>❌ 15-20% rejection rate</div>
                <div>😰 High stress, easy mistakes</div>
                <div>📊 Hard to track progress</div>
              </div>
            </div>
            <div className="text-center">
              <h5 className="font-medium text-success-400 mb-3">DirectoryBolt</h5>
              <div className="space-y-2 text-sm text-secondary-300">
                <div>⚡ 5 min setup for all</div>
                <div>✅ &lt;2% rejection rate</div>
                <div>😌 Stress-free automation</div>
                <div>📈 Complete tracking dashboard</div>
              </div>
            </div>
          </div>
          {element.action && (
            <div className="text-center mt-6">
              <button
                onClick={() => handleConversionClick(element.action!)}
                className="bg-volt-500 text-secondary-900 font-semibold px-6 py-2 rounded-lg hover:bg-volt-400 transition-colors"
              >
                {element.action}
              </button>
            </div>
          )}
        </div>
      )

    case 'cta':
      return (
        <div className="bg-gradient-to-r from-secondary-800/50 to-secondary-700/50 rounded-lg p-6 my-8 text-center">
          <p className="text-secondary-300 mb-4">{element.content}</p>
          {element.action && (
            <button
              onClick={() => handleConversionClick(element.action!)}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105"
            >
              {element.action}
            </button>
          )}
        </div>
      )

    default:
      return null
  }
}