'use client'
import { useState, useEffect, useCallback } from 'react'

interface InteractiveDemoProps {
  onNext: () => void
}

export function InteractiveDemo({ onNext }: InteractiveDemoProps) {
  const [currentView, setCurrentView] = useState<'before' | 'after'>('before')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showStats, setShowStats] = useState(false)

  const toggleView = useCallback(async () => {
    setIsAnimating(true)
    
    // Smooth transition delay
    setTimeout(() => {
      setCurrentView(prev => {
        const newView = prev === 'before' ? 'after' : 'before'
        setIsAnimating(false)
        
        // Show stats after transformation
        if (newView === 'after') {
          setTimeout(() => setShowStats(true), 500)
        } else {
          setShowStats(false)
        }
        
        return newView
      })
    }, 300)
  }, [])

  useEffect(() => {
    // Auto-demo every 4 seconds
    const interval = setInterval(() => {
      toggleView()
    }, 4000)

    return () => clearInterval(interval)
  }, [toggleView])

  const beforeData = {
    googleResults: 0,
    directoryListings: 3,
    monthlyLeads: 12,
    visibility: 15,
    competitors: 8
  }

  const afterData = {
    googleResults: 847,
    directoryListings: 127,
    monthlyLeads: 156,
    visibility: 89,
    competitors: 2
  }

  const currentData = currentView === 'before' ? beforeData : afterData

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-6xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12 animate-slide-down">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
              ⚡ See The Transformation
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-secondary-300">
            Watch what happens when we list your business everywhere
          </p>
        </div>

        {/* Interactive Toggle */}
        <div className="mb-8 animate-zoom-in">
          <div className="inline-flex bg-secondary-800 rounded-xl p-2 shadow-2xl">
            <button
              onClick={() => setCurrentView('before')}
              className={`px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 ${
                currentView === 'before'
                  ? 'bg-danger-600 text-white shadow-lg'
                  : 'text-secondary-400 hover:text-white'
              }`}
            >
              😰 BEFORE
            </button>
            <button
              onClick={() => setCurrentView('after')}
              className={`px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 ${
                currentView === 'after'
                  ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 shadow-lg'
                  : 'text-secondary-400 hover:text-white'
              }`}
            >
              🚀 AFTER
            </button>
          </div>
        </div>

        {/* Demo Content */}
        <div className={`relative transition-all duration-500 ${isAnimating ? 'scale-95 opacity-70' : 'scale-100 opacity-100'}`}>
          {/* Before/After Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Search Results Mockup */}
            <div className={`bg-gradient-to-br ${currentView === 'before' ? 'from-danger-900/30 to-danger-800/20 border-danger-500/30' : 'from-success-900/30 to-success-800/20 border-success-500/30'} p-6 rounded-xl border backdrop-blur-sm transform transition-all duration-700`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="w-4 h-4 bg-secondary-500 rounded-full"></div>
                <div className="h-6 bg-secondary-700 rounded flex-1"></div>
                <div className="w-16 h-6 bg-secondary-600 rounded"></div>
              </div>
              
              <div className="space-y-4">
                {currentView === 'before' ? (
                  // BEFORE - Competitors dominate
                  <>
                    <div className="p-4 bg-secondary-800 rounded-lg">
                      <div className="h-4 bg-secondary-600 rounded mb-2"></div>
                      <div className="h-3 bg-secondary-700 rounded w-3/4"></div>
                      <div className="text-xs text-success-400 mt-2">💰 Competitor #1 - Ad</div>
                    </div>
                    <div className="p-4 bg-secondary-800 rounded-lg">
                      <div className="h-4 bg-secondary-600 rounded mb-2"></div>
                      <div className="h-3 bg-secondary-700 rounded w-2/3"></div>
                      <div className="text-xs text-success-400 mt-2">💰 Competitor #2 - Ad</div>
                    </div>
                    <div className="p-2 bg-secondary-900/50 rounded border border-secondary-700">
                      <div className="text-sm text-secondary-500">Your business: Page 3, Result #47</div>
                    </div>
                  </>
                ) : (
                  // AFTER - You dominate
                  <>
                    <div className="p-4 bg-gradient-to-r from-volt-600/20 to-volt-500/20 border border-volt-500/50 rounded-lg">
                      <div className="h-4 bg-volt-500 rounded mb-2"></div>
                      <div className="h-3 bg-volt-400 rounded w-4/5"></div>
                      <div className="text-xs text-volt-400 mt-2 font-bold">🏆 YOUR BUSINESS - Top Result!</div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-volt-600/10 to-volt-500/10 border border-volt-500/30 rounded-lg">
                      <div className="h-4 bg-volt-400 rounded mb-2"></div>
                      <div className="h-3 bg-volt-300 rounded w-3/4"></div>
                      <div className="text-xs text-volt-400 mt-2">🔥 Your Directory Listing #1</div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-volt-600/10 to-volt-500/10 border border-volt-500/30 rounded-lg">
                      <div className="h-4 bg-volt-400 rounded mb-2"></div>
                      <div className="h-3 bg-volt-300 rounded w-2/3"></div>
                      <div className="text-xs text-volt-400 mt-2">⚡ Your Directory Listing #2</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats Panel */}
            <div className="space-y-4">
              <StatCard 
                title="Google Search Results"
                value={currentData.googleResults}
                suffix={currentView === 'after' ? ' results' : ' results'}
                trend={currentView === 'after' ? 'up' : 'down'}
                delay={0}
              />
              <StatCard 
                title="Directory Listings"
                value={currentData.directoryListings}
                suffix=" listings"
                trend={currentView === 'after' ? 'up' : 'down'}
                delay={100}
              />
              <StatCard 
                title="Monthly Leads"
                value={currentData.monthlyLeads}
                suffix=" leads"
                trend={currentView === 'after' ? 'up' : 'down'}
                delay={200}
              />
              <StatCard 
                title="Online Visibility"
                value={currentData.visibility}
                suffix="%"
                trend={currentView === 'after' ? 'up' : 'down'}
                delay={300}
              />
            </div>
          </div>

          {/* Impact Statement */}
          {showStats && (
            <div className="animate-zoom-in bg-gradient-to-r from-volt-500/20 to-volt-600/20 p-6 rounded-xl border border-volt-500/50 backdrop-blur-sm">
              <div className="text-2xl md:text-3xl font-bold text-volt-400 mb-2">
                📈 +1,300% More Visibility
              </div>
              <p className="text-lg text-secondary-200">
                This is what happens when you&apos;re listed in 480+ directories instead of just 3
              </p>
            </div>
          )}
        </div>

        {/* CTA Section */}
        <div className="mt-12 animate-slide-up">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={onNext}
              className="group relative px-8 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-glow"
            >
              <span className="relative z-10">⚡ Get This For My Business</span>
            </button>
            
            <button 
              onClick={toggleView}
              className="px-6 py-3 border-2 border-volt-500 text-volt-500 font-bold rounded-xl hover:bg-volt-500 hover:text-secondary-900 transform hover:scale-105 transition-all duration-300"
            >
              🔄 Toggle Demo
            </button>
          </div>
          
          <div className="mt-6 text-sm text-secondary-400">
            ⚡ Setup takes less than 2 minutes • No technical skills required
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  suffix: string
  trend: 'up' | 'down'
  delay: number
}

function StatCard({ title, value, suffix, trend, delay }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      // Animate number counting
      const increment = value / 30 // 30 steps
      let current = 0
      const interval = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(interval)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, 50)
      
      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <div 
      className={`p-6 rounded-xl border backdrop-blur-sm transition-all duration-700 transform ${
        trend === 'up'
          ? 'bg-gradient-to-br from-success-900/30 to-success-800/20 border-success-500/30'
          : 'bg-gradient-to-br from-danger-900/30 to-danger-800/20 border-danger-500/30'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-secondary-300">{title}</h3>
        <div className={`text-lg ${trend === 'up' ? 'text-success-400' : 'text-danger-400'}`}>
          {trend === 'up' ? '📈' : '📉'}
        </div>
      </div>
      
      <div className={`text-3xl font-black ${trend === 'up' ? 'text-success-400' : 'text-danger-400'}`}>
        {displayValue.toLocaleString()}{suffix}
      </div>
      
      <div className={`text-xs mt-2 ${trend === 'up' ? 'text-success-300' : 'text-danger-300'}`}>
        {trend === 'up' ? '🚀 After DirectoryBolt' : '😰 Current state'}
      </div>
    </div>
  )
}