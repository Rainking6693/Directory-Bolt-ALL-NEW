'use client'
import { useState } from 'react'
import { DirectoryBrowser } from './directories/DirectoryBrowser'
import { FormWizard } from './directories/FormWizard'
import { ProgressTracker } from './directories/ProgressTracker'
import type { Directory } from '../lib/types/directory'

interface BusinessAnalysis {
  businessType: string
  industry: string
  targetAudience: string
  location?: string
  businessModel: 'B2B' | 'B2C' | 'B2B2C'
  stage: 'startup' | 'growth' | 'established'
  budget: 'low' | 'medium' | 'high'
  goals: string[]
}

// Mock business analysis data
const mockBusinessAnalysis: BusinessAnalysis = {
  businessType: 'Technology Company',
  industry: 'technology',
  targetAudience: 'Small to medium businesses',
  location: 'San Francisco, CA',
  businessModel: 'B2B',
  stage: 'growth',
  budget: 'medium',
  goals: ['increase_visibility', 'generate_leads', 'build_authority']
}

// Mock submissions for progress tracking
const mockSubmissions = [
  {
    id: 'sub_1',
    directoryId: 'dir_1',
    directoryName: 'Google Business Profile',
    status: 'approved' as const,
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    actualApprovalTime: 3,
    retryCount: 0,
    maxRetries: 3
  },
  {
    id: 'sub_2',
    directoryId: 'dir_2',
    directoryName: 'Yelp Business',
    status: 'in_progress' as const,
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    estimatedApprovalTime: 3,
    retryCount: 0,
    maxRetries: 3
  },
  {
    id: 'sub_3',
    directoryId: 'dir_3',
    directoryName: 'Better Business Bureau',
    status: 'submitted' as const,
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    estimatedApprovalTime: 7,
    retryCount: 0,
    maxRetries: 3
  },
  {
    id: 'sub_4',
    directoryId: 'dir_4',
    directoryName: 'Yellow Pages',
    status: 'pending' as const,
    submittedAt: new Date(),
    estimatedApprovalTime: 5,
    retryCount: 0,
    maxRetries: 3
  }
]

export function EnhancedDirectorySelector() {
  const [selectedDirectories, setSelectedDirectories] = useState<string[]>([])
  const [currentView, setCurrentView] = useState<'browse' | 'form' | 'progress'>('browse')
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissions] = useState(mockSubmissions)

  // Handle directory selection changes
  const handleDirectorySelection = (directoryIds: string[]) => {
    setSelectedDirectories(directoryIds)
  }

  // Handle form submission
  const handleFormSubmit = async (data: Record<string, any>) => {
    setIsSubmitting(true)
    setFormData(data)
    
    try {
      // Simulate API submission
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Move to progress view
      setCurrentView('progress')
    } catch (error) {
      console.error('Submission failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle form save (draft)
  const handleFormSave = (data: Record<string, any>) => {
    setFormData(data)
    // Save to localStorage or API
    localStorage.setItem('directory-form-draft', JSON.stringify(data))
  }

  // Get selected directories for form
  const getSelectedDirectoriesData = (): Directory[] => {
    // In real implementation, this would fetch from the DirectoryBrowser
    // For now, return empty array as it will be populated by the browser component
    return []
  }

  // Handle proceeding to form
  const handleProceedToForm = () => {
    if (selectedDirectories.length > 0) {
      setCurrentView('form')
    }
  }

  // Render different views based on current state
  const renderCurrentView = () => {
    switch (currentView) {
      case 'browse':
        return (
          <DirectoryBrowser
            selectedDirectories={selectedDirectories}
            onDirectorySelect={(id) => {
              setSelectedDirectories(prev => 
                prev.includes(id) 
                  ? prev.filter(x => x !== id)
                  : [...prev, id]
              )
            }}
            onBatchSelect={handleDirectorySelection}
            businessAnalysis={mockBusinessAnalysis}
            showRecommendations={true}
          />
        )
      
      case 'form':
        return (
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6">
              <button
                onClick={() => setCurrentView('browse')}
                className="flex items-center gap-2 text-volt-400 hover:text-volt-300 transition-colors mb-4"
              >
                ← Back to Directory Selection
              </button>
            </div>
            
            <FormWizard
              selectedDirectories={getSelectedDirectoriesData()}
              businessData={formData}
              onSubmit={handleFormSubmit}
              onSave={handleFormSave}
              isSubmitting={isSubmitting}
            />
          </div>
        )
      
      case 'progress':
        return (
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Submission Progress</h1>
              <p className="text-secondary-400">
                Track the progress of your directory submissions in real-time
              </p>
            </div>
            
            <ProgressTracker
              submissions={submissions}
              onRetrySubmission={(id) => {
                console.log('Retry submission:', id)
              }}
              onViewDetails={(submission) => {
                console.log('View details:', submission)
              }}
              realTimeEnabled={true}
            />
            
            <div className="mt-8 text-center">
              <button
                onClick={() => setCurrentView('browse')}
                className="px-6 py-3 bg-volt-500 text-secondary-900 font-bold rounded-lg hover:bg-volt-400 transition-colors"
              >
                Submit to More Directories
              </button>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
      {renderCurrentView()}
      
      {/* Floating Action Button for Form Access */}
      {currentView === 'browse' && selectedDirectories.length > 0 && (
        <div className="fixed bottom-8 right-8 z-50">
          <button
            onClick={handleProceedToForm}
            className="group relative px-6 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-full hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-pulse"
          >
            <span className="relative z-10 flex items-center gap-3">
              <span>Submit {selectedDirectories.length} Directories</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}