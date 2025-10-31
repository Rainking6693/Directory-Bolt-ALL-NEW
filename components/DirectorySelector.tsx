'use client'
import { useState, useEffect } from 'react'

interface Directory {
  id: string
  name: string
  category: string
  authority: number
  estimatedTraffic: number
  timeToApproval: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  price: number
  features: string[]
  popular: boolean
  recommended: boolean
}

const mockDirectories: Directory[] = [
  {
    id: '1',
    name: 'Google Business Profile',
    category: 'Search Engines',
    authority: 100,
    estimatedTraffic: 50000,
    timeToApproval: 'Instant',
    difficulty: 'Easy',
    price: 0,
    features: ['Local SEO', 'Reviews', 'Photos', 'Posts'],
    popular: true,
    recommended: true
  },
  {
    id: '2',
    name: 'Yelp',
    category: 'Review Sites',
    authority: 95,
    estimatedTraffic: 25000,
    timeToApproval: '1-2 days',
    difficulty: 'Easy',
    price: 0,
    features: ['Customer Reviews', 'Business Info', 'Photos'],
    popular: true,
    recommended: true
  },
  {
    id: '3',
    name: 'Facebook Business',
    category: 'Social Media',
    authority: 98,
    estimatedTraffic: 35000,
    timeToApproval: 'Instant',
    difficulty: 'Easy',
    price: 0,
    features: ['Social Presence', 'Customer Messaging', 'Events'],
    popular: true,
    recommended: true
  },
  {
    id: '4',
    name: 'Yellow Pages',
    category: 'Directories',
    authority: 85,
    estimatedTraffic: 15000,
    timeToApproval: '2-3 days',
    difficulty: 'Medium',
    price: 29,
    features: ['Directory Listing', 'Enhanced Profile'],
    popular: true,
    recommended: false
  },
  {
    id: '5',
    name: 'Better Business Bureau',
    category: 'Trust & Safety',
    authority: 90,
    estimatedTraffic: 8000,
    timeToApproval: '5-7 days',
    difficulty: 'Medium',
    price: 0,
    features: ['Trust Badge', 'Complaint Resolution', 'Accreditation'],
    popular: false,
    recommended: true
  },
  {
    id: '6',
    name: 'Apple Maps',
    category: 'Maps',
    authority: 92,
    estimatedTraffic: 18000,
    timeToApproval: '3-5 days',
    difficulty: 'Medium',
    price: 0,
    features: ['Apple Maps Presence', 'Business Hours', 'Contact Info'],
    popular: true,
    recommended: true
  }
]

export function DirectorySelector() {
  const [selectedDirectories, setSelectedDirectories] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'free' | 'recommended' | 'popular'>('recommended')
  const [showPricing, setShowPricing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-select recommended directories
  useEffect(() => {
    const recommendedIds = mockDirectories
      .filter(dir => dir.recommended)
      .map(dir => dir.id)
    setSelectedDirectories(recommendedIds)
  }, [])

  const filteredDirectories = mockDirectories.filter(directory => {
    switch (filter) {
      case 'free':
        return directory.price === 0
      case 'recommended':
        return directory.recommended
      case 'popular':
        return directory.popular
      default:
        return true
    }
  })

  const toggleDirectory = (directoryId: string) => {
    setSelectedDirectories(prev => 
      prev.includes(directoryId) 
        ? prev.filter(id => id !== directoryId)
        : [...prev, directoryId]
    )
  }

  const totalEstimatedTraffic = selectedDirectories
    .reduce((sum, id) => {
      const dir = mockDirectories.find(d => d.id === id)
      return sum + (dir?.estimatedTraffic || 0)
    }, 0)

  const totalPrice = selectedDirectories
    .reduce((sum, id) => {
      const dir = mockDirectories.find(d => d.id === id)
      return sum + (dir?.price || 0)
    }, 0)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setShowPricing(true)
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen px-4 py-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-slide-down">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">
              📋 Choose Your Directories
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-secondary-300 mb-8">
            We&apos;ll submit your business to these high-authority directories
          </p>
          
          {/* Stats Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-success-900/30 to-success-800/20 p-4 rounded-xl border border-success-500/30">
              <div className="text-2xl font-bold text-success-400">{selectedDirectories.length}</div>
              <div className="text-sm text-secondary-400">Directories Selected</div>
            </div>
            
            <div className="bg-gradient-to-br from-volt-900/30 to-volt-800/20 p-4 rounded-xl border border-volt-500/30">
              <div className="text-2xl font-bold text-volt-400">{totalEstimatedTraffic.toLocaleString()}</div>
              <div className="text-sm text-secondary-400">Estimated Monthly Traffic</div>
            </div>
            
            <div className="bg-gradient-to-br from-secondary-700/30 to-secondary-800/20 p-4 rounded-xl border border-secondary-600">
              <div className="text-2xl font-bold text-white">${totalPrice}</div>
              <div className="text-sm text-secondary-400">Total Directory Fees</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8 animate-zoom-in">
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { key: 'recommended', label: '⭐ Recommended', count: mockDirectories.filter(d => d.recommended).length },
              { key: 'popular', label: '🔥 Popular', count: mockDirectories.filter(d => d.popular).length },
              { key: 'free', label: '💚 Free', count: mockDirectories.filter(d => d.price === 0).length },
              { key: 'all', label: '📋 All Directories', count: mockDirectories.length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                  filter === tab.key
                    ? 'bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 shadow-lg'
                    : 'bg-secondary-800 text-secondary-300 hover:bg-secondary-700 hover:text-white'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredDirectories.map((directory, index) => (
            <DirectoryCard
              key={directory.id}
              directory={directory}
              isSelected={selectedDirectories.includes(directory.id)}
              onToggle={() => toggleDirectory(directory.id)}
              animationDelay={index * 100}
            />
          ))}
        </div>

        {/* Submit Section */}
        {!showPricing ? (
          <div className="text-center animate-slide-up">
            <div className="bg-secondary-800 p-8 rounded-2xl border border-secondary-700 backdrop-blur-sm max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-volt-400 mb-4">
                🚀 Ready to Dominate Local Search?
              </h3>
              <p className="text-lg text-secondary-200 mb-6">
                We&apos;ll submit your business to {selectedDirectories.length} directories and track the results
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success-400">
                    +{Math.floor(totalEstimatedTraffic / 1000)}K
                  </div>
                  <div className="text-sm text-secondary-400">Monthly Visitors</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-volt-400">
                    2-14 days
                  </div>
                  <div className="text-sm text-secondary-400">Average Approval Time</div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={selectedDirectories.length === 0 || isSubmitting}
                className="group relative px-8 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 disabled:opacity-50 disabled:cursor-not-allowed animate-glow"
              >
                <span className="relative z-10">
                  {isSubmitting ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-secondary-900 border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    '⚡ Start My Directory Submissions'
                  )}
                </span>
              </button>
              
              <div className="mt-4 text-sm text-secondary-400">
                💯 30-day money-back guarantee • ⚡ Results in 2-14 days
              </div>
            </div>
          </div>
        ) : (
          /* Pricing Display */
          <PricingDisplay 
            selectedCount={selectedDirectories.length}
            totalTraffic={totalEstimatedTraffic}
            directoryFees={totalPrice}
          />
        )}
      </div>
    </div>
  )
}

interface DirectoryCardProps {
  directory: Directory
  isSelected: boolean
  onToggle: () => void
  animationDelay: number
}

function DirectoryCard({ directory, isSelected, onToggle, animationDelay }: DirectoryCardProps) {
  return (
    <div 
      className={`relative p-6 rounded-xl border backdrop-blur-sm cursor-pointer transition-all duration-300 transform hover:scale-105 animate-slide-up ${
        isSelected
          ? 'bg-gradient-to-br from-volt-900/30 to-volt-800/20 border-volt-500/50 shadow-lg shadow-volt-500/20'
          : 'bg-secondary-800/50 border-secondary-700 hover:border-secondary-600'
      }`}
      onClick={onToggle}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Selection Indicator */}
      <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 transition-all duration-300 ${
        isSelected 
          ? 'bg-volt-500 border-volt-500' 
          : 'border-secondary-500'
      }`}>
        {isSelected && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-3 h-3 bg-secondary-900 rounded-full"></div>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-2 mb-4">
        {directory.recommended && (
          <span className="px-2 py-1 bg-volt-500 text-secondary-900 text-xs font-bold rounded">
            ⭐ RECOMMENDED
          </span>
        )}
        {directory.popular && (
          <span className="px-2 py-1 bg-success-600 text-white text-xs font-bold rounded">
            🔥 POPULAR
          </span>
        )}
        {directory.price === 0 && (
          <span className="px-2 py-1 bg-secondary-600 text-white text-xs font-bold rounded">
            FREE
          </span>
        )}
      </div>

      {/* Directory Info */}
      <h3 className="text-xl font-bold text-white mb-2">{directory.name}</h3>
      <p className="text-secondary-400 text-sm mb-4">{directory.category}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-lg font-bold text-volt-400">{directory.authority}</div>
          <div className="text-xs text-secondary-500">Authority Score</div>
        </div>
        <div>
          <div className="text-lg font-bold text-success-400">
            {directory.estimatedTraffic.toLocaleString()}
          </div>
          <div className="text-xs text-secondary-500">Monthly Traffic</div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-2 mb-4">
        {directory.features.slice(0, 3).map((feature, index) => (
          <div key={index} className="flex items-center gap-2 text-sm text-secondary-300">
            <div className="w-1.5 h-1.5 bg-volt-500 rounded-full"></div>
            {feature}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-secondary-700">
        <div>
          <div className="text-lg font-bold text-white">
            {directory.price === 0 ? 'FREE' : `$${directory.price}`}
          </div>
          <div className="text-xs text-secondary-500">Directory fee</div>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-semibold text-white">{directory.timeToApproval}</div>
          <div className={`text-xs ${
            directory.difficulty === 'Easy' ? 'text-success-400' :
            directory.difficulty === 'Medium' ? 'text-volt-400' :
            'text-danger-400'
          }`}>
            {directory.difficulty}
          </div>
        </div>
      </div>
    </div>
  )
}

interface PricingDisplayProps {
  selectedCount: number
  totalTraffic: number
  directoryFees: number
}

function PricingDisplay({ selectedCount, totalTraffic, directoryFees }: PricingDisplayProps) {
  const servicePrice = 99 // Base service price
  const totalPrice = servicePrice + directoryFees

  return (
    <div className="text-center animate-zoom-in">
      <div className="bg-gradient-to-r from-volt-500/20 to-volt-600/20 p-8 rounded-2xl border border-volt-500/50 backdrop-blur-sm max-w-2xl mx-auto">
        <h3 className="text-3xl font-black text-volt-400 mb-6">
          🎯 Your Directory Domination Package
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="text-3xl font-black text-white">{selectedCount}</div>
            <div className="text-secondary-400">Directories</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-black text-success-400">+{Math.floor(totalTraffic / 1000)}K</div>
            <div className="text-secondary-400">Monthly Traffic</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-black text-volt-400">${totalPrice}</div>
            <div className="text-secondary-400">Total Investment</div>
          </div>
        </div>

        <div className="bg-secondary-800/50 p-6 rounded-xl mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-secondary-300">DirectoryBolt Service Fee:</span>
            <span className="text-xl font-bold text-white">${servicePrice}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-secondary-300">Directory Submission Fees:</span>
            <span className="text-xl font-bold text-white">${directoryFees}</span>
          </div>
          <div className="border-t border-secondary-700 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-volt-400">Total Investment:</span>
              <span className="text-2xl font-black text-volt-400">${totalPrice}</span>
            </div>
          </div>
        </div>

        <button className="group relative px-8 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-glow">
          <span className="relative z-10">💳 Secure Checkout - ${totalPrice}</span>
        </button>
        
        <div className="mt-6 text-sm text-secondary-400">
          🔒 Secure payment • 💯 30-day guarantee • ⚡ Results in 2-14 days
        </div>
      </div>
    </div>
  )
}