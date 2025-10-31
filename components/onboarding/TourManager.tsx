'use client'

import { useState, useEffect } from 'react'
import FeatureTour, { Tour, TourStep } from './FeatureTour'
import { getTier } from '../../lib/config/pricing'

interface TourManagerProps {
  userId: string
  userTier: string
  onboardingCompleted: boolean
  className?: string
}

// Define all available tours
const AVAILABLE_TOURS: Tour[] = [
  {
    id: 'dashboard-basics',
    name: 'Dashboard Basics',
    description: 'Learn the essential features of your dashboard',
    category: 'onboarding',
    trigger: 'auto',
    steps: [
      {
        id: 'welcome',
        target: '[data-tour="dashboard-header"]',
        title: 'Welcome to Your Dashboard',
        content: 'This is your command center where you can track all your directory submissions and business growth.',
        position: 'bottom'
      },
      {
        id: 'stats-overview',
        target: '[data-tour="stats-cards"]',
        title: 'Track Your Progress',
        content: 'These cards show your key metrics: total directories, live listings, monthly traffic, and estimated leads.',
        position: 'bottom'
      },
      {
        id: 'progress-ring',
        target: '[data-tour="progress-ring"]',
        title: 'Completion Progress',
        content: 'Monitor your directory submission progress and see your success rate at a glance.',
        position: 'right'
      },
      {
        id: 'navigation',
        target: '[data-tour="navigation"]',
        title: 'Navigation Menu',
        content: 'Use these tabs to navigate between different sections of your dashboard.',
        position: 'bottom'
      },
      {
        id: 'notifications',
        target: '[data-tour="notifications"]',
        title: 'Stay Updated',
        content: 'Important updates about your submissions will appear here.',
        position: 'top'
      }
    ]
  },
  {
    id: 'directory-management',
    name: 'Directory Management',
    description: 'Learn how to manage your directory submissions',
    category: 'feature',
    trigger: 'manual',
    steps: [
      {
        id: 'directory-grid',
        target: '[data-tour="directory-grid"]',
        title: 'Directory Overview',
        content: 'View all your directory submissions with their current status and performance metrics.',
        position: 'top'
      },
      {
        id: 'directory-filters',
        target: '[data-tour="directory-filters"]',
        title: 'Filter Your Directories',
        content: 'Use filters to quickly find directories by status, category, or submission date.',
        position: 'bottom'
      },
      {
        id: 'directory-actions',
        target: '[data-tour="directory-actions"]',
        title: 'Take Action',
        content: 'Click on any directory to view details, update information, or check submission status.',
        position: 'left'
      }
    ]
  },
  {
    id: 'seo-tools',
    name: 'SEO Tools Tour',
    description: 'Discover powerful SEO analysis features',
    category: 'advanced',
    trigger: 'manual',
    userTier: ['professional', 'enterprise'],
    steps: [
      {
        id: 'seo-navigation',
        target: '[data-tour="seo-tools-tab"]',
        title: 'SEO Tools',
        content: 'Access advanced SEO analysis tools exclusive to Professional and Enterprise plans.',
        position: 'bottom'
      },
      {
        id: 'content-gap-analysis',
        target: '[data-tour="content-gap-analyzer"]',
        title: 'Content Gap Analysis',
        content: 'Identify content opportunities your competitors are missing to outrank them.',
        position: 'top'
      },
      {
        id: 'competitive-benchmarking',
        target: '[data-tour="competitive-benchmarking"]',
        title: 'Competitive Benchmarking',
        content: 'Get detailed insights into your competitors\' strategies and performance.',
        position: 'top'
      }
    ]
  },
  {
    id: 'business-profile',
    name: 'Business Profile',
    description: 'Manage your business information effectively',
    category: 'feature',
    trigger: 'manual',
    steps: [
      {
        id: 'profile-overview',
        target: '[data-tour="business-profile"]',
        title: 'Your Business Profile',
        content: 'Keep your business information up-to-date for better directory submissions.',
        position: 'top'
      },
      {
        id: 'edit-profile',
        target: '[data-tour="edit-profile-btn"]',
        title: 'Edit Your Information',
        content: 'Click here to update your business details, contact information, and description.',
        position: 'left'
      }
    ]
  }
]

export default function TourManager({
  userId,
  userTier,
  onboardingCompleted,
  className = ''
}: TourManagerProps) {
  const [activeTour, setActiveTour] = useState<Tour | null>(null)
  const [completedTours, setCompletedTours] = useState<string[]>([])
  const [availableTours, setAvailableTours] = useState<Tour[]>([])
  const [showTourMenu, setShowTourMenu] = useState(false)

  // Load completed tours from storage
  useEffect(() => {
    const saved = localStorage.getItem(`tours-completed-${userId}`)
    if (saved) {
      setCompletedTours(JSON.parse(saved))
    }
  }, [userId])

  // Filter tours based on user tier and completion status
  useEffect(() => {
    const filtered = AVAILABLE_TOURS.filter(tour => {
      // Check if tour is for user's tier
      if (tour.userTier && !tour.userTier.includes(userTier)) {
        return false
      }
      return true
    })
    setAvailableTours(filtered)
  }, [userTier])

  // Auto-start onboarding tour
  useEffect(() => {
    if (onboardingCompleted && completedTours.length === 0) {
      const dashboardTour = availableTours.find(t => t.id === 'dashboard-basics')
      if (dashboardTour && !completedTours.includes(dashboardTour.id)) {
        // Delay to ensure DOM elements are rendered
        setTimeout(() => {
          setActiveTour(dashboardTour)
        }, 1000)
      }
    }
  }, [onboardingCompleted, availableTours, completedTours])

  const handleTourComplete = (tourId: string) => {
    const updated = [...completedTours, tourId]
    setCompletedTours(updated)
    localStorage.setItem(`tours-completed-${userId}`, JSON.stringify(updated))
    setActiveTour(null)

    // Auto-suggest next relevant tour
    suggestNextTour(tourId)
  }

  const handleTourSkip = (tourId: string) => {
    setActiveTour(null)
    // Don't mark as completed when skipped
  }

  const suggestNextTour = (completedTourId: string) => {
    // Logic to suggest next relevant tour
    if (completedTourId === 'dashboard-basics') {
      // Suggest directory management tour
      const nextTour = availableTours.find(t => t.id === 'directory-management')
      if (nextTour && !completedTours.includes(nextTour.id)) {
        setTimeout(() => {
          if (confirm(`Would you like to take the "${nextTour.name}" tour next?`)) {
            setActiveTour(nextTour)
          }
        }, 2000)
      }
    }
  }

  const startTour = (tourId: string) => {
    const tour = availableTours.find(t => t.id === tourId)
    if (tour) {
      setActiveTour(tour)
      setShowTourMenu(false)
    }
  }

  const toggleTourMenu = () => {
    setShowTourMenu(!showTourMenu)
  }

  const tierInfo = getTier(userTier)

  return (
    <div className={className}>
      {/* Tour Menu Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={toggleTourMenu}
          className="bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-full p-3 shadow-lg transition-colors"
          title="Feature Tours"
        >
          <span className="text-xl">🎓</span>
        </button>

        {/* Tour Menu */}
        {showTourMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-80 max-w-sm">
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 mb-1">Feature Tours</h3>
              <p className="text-sm text-gray-600">
                Learn how to use DirectoryBolt effectively
              </p>
            </div>

            <div className="space-y-2">
              {availableTours.map(tour => {
                const isCompleted = completedTours.includes(tour.id)
                const isLocked = tour.userTier && !tour.userTier.includes(userTier)

                return (
                  <div
                    key={tour.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isLocked 
                        ? 'border-gray-200 bg-gray-50' 
                        : isCompleted
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                    }`}
                    onClick={() => !isLocked && startTour(tour.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`font-medium mb-1 ${
                          isLocked ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {tour.name}
                          {isLocked && ' 🔒'}
                          {isCompleted && ' ✅'}
                        </h4>
                        <p className={`text-xs ${
                          isLocked ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {tour.description}
                        </p>
                        {isLocked && (
                          <p className="text-xs text-orange-500 mt-1">
                            Requires {tour.userTier?.join(' or ')} plan
                          </p>
                        )}
                      </div>
                      
                      <div className="ml-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          isLocked 
                            ? 'bg-gray-300'
                            : isCompleted 
                            ? 'bg-green-500' 
                            : 'bg-blue-500'
                        }`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                {completedTours.length} of {availableTours.length} tours completed
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active Tour */}
      {activeTour && (
        <FeatureTour
          tour={activeTour}
          isActive={true}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
          autoStart={true}
        />
      )}
    </div>
  )
}