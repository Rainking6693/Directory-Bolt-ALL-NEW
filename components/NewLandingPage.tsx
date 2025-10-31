'use client'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import Header from './Header'
import SampleAnalysisModal from './demo/SampleAnalysisModal'

// Lazy load below-the-fold components
const TestimonialsSection = dynamic(() => import('./sections/TestimonialsSection'), { ssr: false })
const PricingPreviewSection = dynamic(() => import('./sections/PricingPreviewSection'), { ssr: false })

export default function NewLandingPage() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [showSampleModal, setShowSampleModal] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="bg-secondary-900 text-white font-sans">
      <Header />
      
      {/* Sample Analysis Preview - Prominently at Top */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 bg-gradient-to-r from-volt-500/10 to-volt-600/10 border-b border-volt-500/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-volt-400 mb-2">🤖 See What Our AI Analysis Delivers</h2>
            <p className="text-secondary-300">Real example: TechFlow Solutions analysis worth $2,000+ from consultants</p>
          </div>
          
          {/* Key Metrics Preview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4 text-center cursor-pointer hover:bg-volt-500/10 transition-all">
              <div className="text-2xl font-black text-volt-400 mb-1">34%</div>
              <div className="text-xs text-secondary-300">Visibility Score</div>
              <div className="text-xs text-volt-400 mt-1">👆 Click to explore</div>
            </div>
            <div className="bg-secondary-800/50 rounded-xl border border-success-500/30 p-4 text-center cursor-pointer hover:bg-success-500/10 transition-all">
              <div className="text-2xl font-black text-success-400 mb-1">67%</div>
              <div className="text-xs text-secondary-300">SEO Score</div>
              <div className="text-xs text-success-400 mt-1">👆 Click for details</div>
            </div>
            <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4 text-center cursor-pointer hover:bg-volt-500/10 transition-all">
              <div className="text-2xl font-black text-volt-400 mb-1">127</div>
              <div className="text-xs text-secondary-300">Opportunities</div>
              <div className="text-xs text-volt-400 mt-1">👆 View directory list</div>
            </div>
            <div className="bg-secondary-800/50 rounded-xl border border-volt-500/30 p-4 text-center cursor-pointer hover:bg-volt-500/10 transition-all">
              <div className="text-2xl font-black text-volt-400 mb-1">850</div>
              <div className="text-xs text-secondary-300">Potential Leads</div>
              <div className="text-xs text-volt-400 mt-1">👆 See breakdown</div>
            </div>
            <div className="bg-secondary-800/50 rounded-xl border border-danger-500/30 p-4 text-center cursor-pointer hover:bg-danger-500/10 transition-all">
              <div className="text-2xl font-black text-danger-400 mb-1">23%</div>
              <div className="text-xs text-secondary-300">Market Position</div>
              <div className="text-xs text-danger-400 mt-1">👆 Competitive analysis</div>
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => setShowSampleModal(true)}
              className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-6 py-3 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 mr-4"
            >
              🔍 View Complete Analysis
            </button>
            <button
              onClick={() => typeof window !== 'undefined' && (window.location.href = '/analyze')}
              className="border-2 border-volt-500 text-volt-500 font-bold px-6 py-3 rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300"
            >
              🚀 Get My Analysis
            </button>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className={`px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 text-center bg-gradient-to-r from-secondary-800 via-secondary-900 to-black text-white transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left lg:text-left">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-volt-500/20 to-volt-600/10 border border-volt-500/30 px-4 py-2 rounded-full text-sm font-bold text-volt-300 mb-6 backdrop-blur-sm">
                <span className="text-volt-400">💡</span>
                Get $4,300 Worth of Business Intelligence for $299 ONE-TIME
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6 bg-gradient-to-r from-volt-400 to-volt-600 bg-clip-text text-transparent leading-tight animate-slide-up">
                AI-Powered Business Intelligence Directory Service
              </h1>
              <h2 className="text-xl sm:text-2xl lg:text-3xl mb-6 text-secondary-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Get Listed on 500+ High-Authority Directories in Days, Not Months
              </h2>
              <p className="text-lg sm:text-xl lg:text-2xl mb-8 text-secondary-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                Stop spending 100+ hours manually submitting to directories. Our AI-powered service automates directory submissions to 500+ high-authority sites with consistent NAP data, real-time tracking, and 85%+ approval rates. <span className="text-volt-400 font-bold">Save 95% of your time and boost local SEO rankings.</span>
              </p>
              
              {/* Value Breakdown */}
              <div className="bg-secondary-800/50 border border-volt-500/20 rounded-xl p-6 mb-8 backdrop-blur-sm animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <h3 className="text-volt-400 font-bold mb-4 text-center">What You Get:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-4 bg-secondary-700/50 rounded-lg">
                    <div className="text-volt-400 font-bold text-lg mb-2">500+</div>
                    <div className="text-secondary-300">High-Authority Directory Submissions</div>
                  </div>
                  <div className="text-center p-4 bg-secondary-700/50 rounded-lg">
                    <div className="text-volt-400 font-bold text-lg mb-2">95%</div>
                    <div className="text-secondary-300">Time Savings vs Manual Submission</div>
                  </div>
                  <div className="text-center p-4 bg-secondary-700/50 rounded-lg">
                    <div className="text-volt-400 font-bold text-lg mb-2">85%+</div>
                    <div className="text-secondary-300">Directory Approval Rate</div>
                  </div>
                </div>
                <div className="text-center mt-4 text-success-400 font-bold">
                  <span className="text-xl">→ Starting at $149 (Save 100+ hours of work)</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => typeof window !== 'undefined' && (window.location.href = '/analyze')}
                  className="animate-zoom-in bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-8 py-4 rounded-xl shadow-2xl hover:shadow-volt-500/50 hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2 focus:ring-offset-secondary-900 inline-flex items-center justify-center text-lg"
                  style={{ animationDelay: '0.4s' }}
                >
                  Get My Free Directory Analysis
                  <span className="ml-2">🚀</span>
                </button>
                <button
                  onClick={() => setShowSampleModal(true)}
                  className="animate-zoom-in border-2 border-volt-500 text-volt-500 font-bold px-8 py-4 rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-volt-500 focus:ring-offset-2 focus:ring-offset-secondary-900 inline-flex items-center justify-center text-lg"
                  style={{ animationDelay: '0.5s' }}
                >
                  See Sample Analysis
                  <span className="ml-2">🔍</span>
                </button>
              </div>
              <p className="mt-4 text-sm sm:text-base text-secondary-400 animate-fade-in" style={{ animationDelay: '0.6s' }}>14-day free trial | Results in 2-3 days | 30-day money-back guarantee</p>
            </div>
            <div className="relative">
              <Image
                src="/hero.svg"
                alt="DirectoryBolt AI Directory Submission Service Dashboard showing automated directory submissions, real-time tracking, and local SEO optimization"
                width={1600}
                height={900}
                priority
                fetchPriority="high"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
                style={{ width: '100%', height: 'auto' }}
                className="rounded-xl shadow-2xl animate-slide-up"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 text-volt-400">Tired of Paying $3,000+ for Every Business Analysis Project?</h2>
        <p className="text-base sm:text-lg lg:text-xl text-secondary-300 leading-relaxed">
          Business consultants charge premium project fees for insights you could own with a one-time AI investment. Market research firms take weeks and charge thousands for what our platform generates instantly. Why rent business intelligence when you can own it forever? Make one strategic investment and replace expensive consultant projects permanently.
        </p>
      </section>

      {/* Solution Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-secondary-800 text-center">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-8 sm:mb-12 bg-gradient-to-r from-volt-400 to-volt-600 bg-clip-text text-transparent">
            DirectoryBolt: Your AI Business Intelligence Platform
          </h2>
          <ul className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:gap-8 max-w-4xl mx-auto text-left">
            <li className="flex items-start sm:items-center text-secondary-300 p-2">
              <span className="text-success-400 mr-3 mt-1 sm:mt-0 flex-shrink-0">✓</span>
              <span className="text-sm sm:text-base"><strong className="text-volt-400">AI Market Analysis</strong> that replaces $2,000+ consultant reports</span>
            </li>
            <li className="flex items-start sm:items-center text-secondary-300 p-2">
              <span className="text-success-400 mr-3 mt-1 sm:mt-0 flex-shrink-0">✓</span>
              <span className="text-sm sm:text-base"><strong className="text-volt-400">Competitor Intelligence</strong> = know exactly what your competition is doing</span>
            </li>
            <li className="flex items-start sm:items-center text-secondary-300 p-2">
              <span className="text-success-400 mr-3 mt-1 sm:mt-0 flex-shrink-0">✓</span>
              <span className="text-sm sm:text-base"><strong className="text-volt-400">500+ Directory Network</strong> for maximum online visibility</span>
            </li>
            <li className="flex items-start sm:items-center text-secondary-300 p-2">
              <span className="text-success-400 mr-3 mt-1 sm:mt-0 flex-shrink-0">✓</span>
              <span className="text-sm sm:text-base">One-time investment from <strong className="text-volt-400">$149-$799</strong> | <strong className="text-volt-400">Save 93% vs. consultant project fees</strong></span>
            </li>
            <li className="flex items-start sm:items-center text-secondary-300 p-2">
              <span className="text-success-400 mr-3 mt-1 sm:mt-0 flex-shrink-0">✓</span>
              <span className="text-sm sm:text-base"><strong className="text-volt-400">Enterprise-level insights</strong> with automated growth strategies</span>
            </li>
            <li className="flex items-start sm:items-center text-secondary-300 p-2">
              <span className="text-success-400 mr-3 mt-1 sm:mt-0 flex-shrink-0">✓</span>
              <span className="text-sm sm:text-base"><strong className="text-volt-400">Pay once, own forever</strong> | <strong className="text-volt-400">Business asset acquisition</strong> | ⭐ 4.9/5 rating</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Pricing Preview Section - Lazy loaded */}
      <PricingPreviewSection />

      {/* Features Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 max-w-6xl mx-auto bg-secondary-800">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-12 lg:mb-16 text-volt-400">Enterprise-Level Business Intelligence Features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-secondary-800 p-6 sm:p-8 rounded-lg border border-volt-400/20 hover:border-volt-400/40 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 text-volt-400">AI Market Analysis</h3>
            <p className="text-secondary-300 text-sm sm:text-base">Deep market insights that would cost $2,000+ per project from consultants. Own your competitive intelligence forever.</p>
          </div>
          <div className="bg-secondary-800 p-6 sm:p-8 rounded-lg border border-volt-400/20 hover:border-volt-400/40 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 text-volt-400">Competitor Intelligence Dashboard</h3>
            <p className="text-secondary-300 text-sm sm:text-base">Monitor competitor strategies, pricing, and positioning. Know exactly what they're doing before they do it.</p>
          </div>
          <div className="bg-secondary-800 p-6 sm:p-8 rounded-lg border border-volt-400/20 hover:border-volt-400/40 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 text-volt-400">Automated Growth Strategies</h3>
            <p className="text-secondary-300 text-sm sm:text-base">AI-powered recommendations that replace expensive strategy consultant projects. Own your growth playbook forever.</p>
          </div>
          <div className="bg-secondary-800 p-6 sm:p-8 rounded-lg border border-volt-400/20 hover:border-volt-400/40 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 text-volt-400">500+ Premium Directory Network</h3>
            <p className="text-secondary-300 text-sm sm:text-base">Comprehensive online presence optimization across high-authority platforms. Maximum visibility for your brand.</p>
          </div>
        </div>
      </section>

      {/* Testimonials - Lazy loaded */}
      <TestimonialsSection />

      {/* Final CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 text-center bg-gradient-to-r from-volt-400 to-volt-600 text-secondary-900 relative overflow-hidden">
        
        {/* Background animation */}
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-volt-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-volt-300 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Urgency banner */}
          <div className="inline-flex items-center gap-2 bg-secondary-900/20 border border-secondary-900/30 px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-secondary-900 mb-6 backdrop-blur-sm">
            <div className="w-2 h-2 bg-danger-500 rounded-full animate-ping"></div>
            🔥 Limited Time: 487 businesses upgraded this month - Join them before prices increase
          </div>
          
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6">Own Your Business Intelligence Before Competitors Do</h2>
          <p className="mb-8 text-base sm:text-lg lg:text-xl max-w-2xl mx-auto">Stop renting business insights from expensive consultants. Make one strategic investment and <span className="font-bold">own enterprise-level intelligence forever. Replace $3,000+ consultant projects with permanent business assets.</span></p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => typeof window !== 'undefined' && (window.location.href = '/analyze')}
              className="w-full sm:w-auto bg-secondary-900 text-volt-400 font-bold py-4 px-8 rounded-lg shadow-lg hover:bg-secondary-800 transition-all duration-300 transform hover:scale-105 text-lg sm:text-xl border-2 border-volt-500 hover:border-volt-400 min-h-[56px] flex items-center justify-center"
            >
              🚀 Start Free Analysis
            </button>
            
            <button
              onClick={() => typeof window !== 'undefined' && (window.location.href = '/analyze')}
              className="w-full sm:w-auto px-6 py-4 border-2 border-secondary-700 text-secondary-700 font-bold rounded-lg hover:border-secondary-800 hover:bg-secondary-800 hover:text-volt-400 transition-all duration-300 transform hover:scale-105 min-h-[56px] flex items-center justify-center"
            >
              🔍 Free Analysis First
            </button>
          </div>
          
          {/* Guarantee */}
          <div className="mt-8 bg-secondary-900/20 backdrop-blur-sm rounded-xl p-4 sm:p-6 max-w-2xl mx-auto border border-secondary-900/30">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-secondary-900 text-xl sm:text-2xl">🛡️</span>
              <span className="font-bold text-base sm:text-lg">30-Day Money-Back Guarantee</span>
            </div>
            <p className="text-sm sm:text-base opacity-90">
              Get 5 new customers in 30 days or receive a full refund. Risk-free business asset acquisition.
            </p>
          </div>
          
          <div className="mt-6 grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm opacity-90">
            <span>✅ No recurring fees</span>
            <span>✅ Lifetime access</span>
            <span>✅ Results guaranteed</span>
            <span>✅ Instant delivery</span>
          </div>
        </div>
      </section>

      {/* Sample Analysis Modal */}
      <SampleAnalysisModal 
        isOpen={showSampleModal} 
        onClose={() => setShowSampleModal(false)} 
      />
    </div>
  )
}