'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: string
  estimatedTime: string
  completed: boolean
  action?: () => void
}

interface EnhancedSuccessOnboardingProps {
  sessionData: {
    customer_email: string
    plan_name: string
    amount_total: number
    trial_end: Date
    next_billing_date: Date
    subscription_id: string
    customer_id: string
  }
}

export default function EnhancedSuccessOnboarding({ sessionData }: EnhancedSuccessOnboardingProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [profileData, setProfileData] = useState({
    businessName: '',
    industry: '',
    location: '',
    website: '',
    description: ''
  })
  const [showQuickWins, setShowQuickWins] = useState(false)

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to DirectoryBolt!',
      description: 'Your subscription is active and ready to boost your business visibility',
      icon: '🎉',
      estimatedTime: '1 min',
      completed: false
    },
    {
      id: 'profile',
      title: 'Complete Your Business Profile',
      description: 'Help our AI create the perfect directory listings for your business',
      icon: '🏢',
      estimatedTime: '2-3 min',
      completed: false,
      action: () => setCurrentStep(1)
    },
    {
      id: 'directories',
      title: 'Select Priority Directories',
      description: 'Choose which high-value directories to submit to first',
      icon: '🎯',
      estimatedTime: '1-2 min',
      completed: false,
      action: () => setCurrentStep(2)
    },
    {
      id: 'automation',
      title: 'Set Up Automation',
      description: 'Configure automatic submissions and monitoring',
      icon: '⚡',
      estimatedTime: '1 min',
      completed: false,
      action: () => setCurrentStep(3)
    },
    {
      id: 'dashboard',
      title: 'Explore Your Dashboard',
      description: 'Learn how to track your listings and measure success',
      icon: '📊',
      estimatedTime: '2 min',
      completed: false,
      action: () => router.push('/dashboard')
    }
  ]

  const [steps, setSteps] = useState(onboardingSteps)

  useEffect(() => {
    setIsVisible(true)
    
    // Auto-progress welcome step
    const timer = setTimeout(() => {
      setSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, completed: true } : step
      ))
      setCurrentStep(1)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const completeStep = (stepIndex: number) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, completed: true } : step
    ))
    
    if (stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1)
    } else {
      setShowQuickWins(true)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In real app, this would send data to the backend
    console.log('Profile data:', profileData)
    completeStep(1)
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 text-white py-8 transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto max-w-6xl px-4">
        
        {/* Progress Header */}
        <div className="text-center mb-12">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-volt-500 rounded-full animate-ping opacity-20"></div>
            </div>
            <div className="relative text-8xl mb-4 animate-bounce">🚀</div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600 animate-glow">
              You're In!
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-secondary-300 mb-6">
            Let's get you set up for maximum directory visibility in the next 5 minutes
          </p>
          
          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex justify-between text-sm text-secondary-400 mb-2">
              <span>Setup Progress</span>
              <span>{steps.filter(s => s.completed).length}/{steps.length} Complete</span>
            </div>
            <div className="w-full bg-secondary-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-volt-500 to-volt-600 h-3 rounded-full transition-all duration-1000 animate-glow"
                style={{ width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-600 p-6 sticky top-8">
              <h3 className="text-xl font-bold text-volt-400 mb-6">Setup Steps</h3>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div 
                    key={step.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      step.completed 
                        ? 'bg-success-500/20 border-success-500/40 text-success-200'
                        : index === currentStep
                        ? 'bg-volt-500/20 border-volt-500/40 text-volt-200 animate-pulse'
                        : 'bg-secondary-800/30 border-secondary-600/30 text-secondary-400'
                    }`}
                    onClick={step.action}
                  >
                    <div className="text-2xl">
                      {step.completed ? '✅' : index === currentStep ? step.icon : '⏳'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{step.title}</h4>
                      <p className="text-xs opacity-75">{step.description}</p>
                      <span className="text-xs opacity-60">{step.estimatedTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {currentStep === 0 && (
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-600 p-8 text-center animate-slide-up">
                <h2 className="text-3xl font-bold text-volt-400 mb-6">🎉 Welcome to DirectoryBolt!</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <span className="text-secondary-400 text-sm">Plan</span>
                    <p className="text-white font-semibold text-lg">{sessionData.plan_name}</p>
                  </div>
                  <div>
                    <span className="text-secondary-400 text-sm">Monthly Investment</span>
                    <p className="text-white font-semibold text-lg">{formatCurrency(sessionData.amount_total)}</p>
                  </div>
                  <div>
                    <span className="text-secondary-400 text-sm">Free Trial Until</span>
                    <p className="text-white font-semibold text-lg">{formatDate(sessionData.trial_end)}</p>
                  </div>
                  <div>
                    <span className="text-secondary-400 text-sm">Next Billing</span>
                    <p className="text-white font-semibold text-lg">{formatDate(sessionData.next_billing_date)}</p>
                  </div>
                </div>
                <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-volt-400 mb-3">🎁 Your Free Trial is Active!</h3>
                  <p className="text-secondary-300 text-sm mb-4">
                    You have 14 days to explore all features risk-free. Cancel anytime before {formatDate(sessionData.next_billing_date)} to avoid charges.
                  </p>
                  <div className="text-xs text-secondary-400">
                    Subscription ID: {sessionData.subscription_id}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-600 p-8 animate-slide-up">
                <h2 className="text-3xl font-bold text-volt-400 mb-6">🏢 Complete Your Business Profile</h2>
                <p className="text-secondary-300 mb-8">
                  Help our AI create the perfect directory listings that attract your ideal customers
                </p>
                
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-volt-400 mb-2">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        value={profileData.businessName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, businessName: e.target.value }))}
                        className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-volt-400 focus:border-volt-400"
                        placeholder="Acme Corp"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-volt-400 mb-2">
                        Industry *
                      </label>
                      <select
                        value={profileData.industry}
                        onChange={(e) => setProfileData(prev => ({ ...prev, industry: e.target.value }))}
                        className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-volt-400 focus:border-volt-400"
                        required
                      >
                        <option value="">Select Industry</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="legal">Legal Services</option>
                        <option value="restaurant">Restaurant/Food</option>
                        <option value="retail">Retail</option>
                        <option value="technology">Technology</option>
                        <option value="consulting">Consulting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-volt-400 mb-2">
                        Location (City, State) *
                      </label>
                      <input
                        type="text"
                        value={profileData.location}
                        onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-volt-400 focus:border-volt-400"
                        placeholder="San Francisco, CA"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-volt-400 mb-2">
                        Website URL *
                      </label>
                      <input
                        type="url"
                        value={profileData.website}
                        onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                        className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-volt-400 focus:border-volt-400"
                        placeholder="https://example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-volt-400 mb-2">
                      Business Description
                    </label>
                    <textarea
                      value={profileData.description}
                      onChange={(e) => setProfileData(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-volt-400 focus:border-volt-400"
                      placeholder="Describe what your business does and what makes it unique..."
                    />
                    <p className="text-xs text-secondary-400 mt-2">
                      This helps our AI create compelling directory descriptions
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-4 px-8 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl"
                  >
                    ✅ Save Profile & Continue
                  </button>
                </form>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-600 p-8 animate-slide-up">
                <h2 className="text-3xl font-bold text-volt-400 mb-6">🎯 Select Priority Directories</h2>
                <p className="text-secondary-300 mb-8">
                  Based on your business profile, here are the highest-value directories for immediate submission
                </p>
                
                <div className="space-y-4 mb-8">
                  {[
                    { name: 'Google Business Profile', authority: 95, traffic: '50,000+', reason: 'Essential for local search visibility' },
                    { name: 'Yelp Business', authority: 88, traffic: '25,000+', reason: 'Top review platform for your industry' },
                    { name: 'Yellow Pages', authority: 82, traffic: '15,000+', reason: 'Established directory with high conversion' },
                    { name: 'Industry-Specific Directory', authority: 78, traffic: '8,000+', reason: 'Targeted audience in your niche' },
                  ].map((directory, index) => (
                    <div key={index} className="bg-secondary-900/50 border border-secondary-600 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white">{directory.name}</h3>
                        <span className="bg-volt-500/20 text-volt-400 px-3 py-1 rounded-full text-sm font-bold">
                          Authority: {directory.authority}
                        </span>
                      </div>
                      <p className="text-secondary-300 text-sm mb-3">{directory.reason}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-secondary-400">
                          Est. Monthly Traffic: {directory.traffic}
                        </span>
                        <div className="bg-success-500/20 text-success-400 px-3 py-1 rounded-full text-xs">
                          ✅ Auto-Selected
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => completeStep(2)}
                  className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-4 px-8 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl"
                >
                  🚀 Start Submissions
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-600 p-8 animate-slide-up">
                <h2 className="text-3xl font-bold text-volt-400 mb-6">⚡ Automation Settings</h2>
                <p className="text-secondary-300 mb-8">
                  Configure how DirectoryBolt handles your submissions and monitoring
                </p>
                
                <div className="space-y-6 mb-8">
                  <div className="bg-secondary-900/50 border border-secondary-600 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Automatic Submissions</h3>
                      <div className="bg-success-500/20 text-success-400 px-3 py-1 rounded-full text-sm">
                        ✅ Enabled
                      </div>
                    </div>
                    <p className="text-secondary-300 text-sm mb-3">
                      We'll automatically submit to new relevant directories as we discover them
                    </p>
                    <div className="text-xs text-secondary-400">
                      • Weekly directory discovery scans
                      • Quality check before submission
                      • Email notifications for new opportunities
                    </div>
                  </div>

                  <div className="bg-secondary-900/50 border border-secondary-600 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Listing Monitoring</h3>
                      <div className="bg-success-500/20 text-success-400 px-3 py-1 rounded-full text-sm">
                        ✅ Enabled
                      </div>
                    </div>
                    <p className="text-secondary-300 text-sm mb-3">
                      We'll monitor all your listings for changes and keep them updated
                    </p>
                    <div className="text-xs text-secondary-400">
                      • Daily listing health checks
                      • Automatic information updates
                      • Alert for any issues or changes needed
                    </div>
                  </div>

                  <div className="bg-secondary-900/50 border border-secondary-600 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Progress Reports</h3>
                      <div className="bg-success-500/20 text-success-400 px-3 py-1 rounded-full text-sm">
                        ✅ Enabled
                      </div>
                    </div>
                    <p className="text-secondary-300 text-sm mb-3">
                      Weekly email reports showing your listing progress and performance
                    </p>
                    <div className="text-xs text-secondary-400">
                      • Weekly progress summaries
                      • Performance metrics and ROI tracking
                      • Recommendations for optimization
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => completeStep(3)}
                  className="w-full bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-4 px-8 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl"
                >
                  ⚡ Activate Automation
                </button>
              </div>
            )}

            {currentStep === 4 && (
              <div className="bg-secondary-800/50 backdrop-blur-sm rounded-2xl border border-secondary-600 p-8 animate-slide-up">
                <h2 className="text-3xl font-bold text-volt-400 mb-6">📊 Your Dashboard is Ready!</h2>
                <p className="text-secondary-300 mb-8">
                  Everything is set up! Here's what happens next and how to track your progress
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-success-400 mb-3">✅ Immediate Actions</h3>
                    <ul className="text-sm text-secondary-300 space-y-2">
                      <li>• Directory submissions starting within 24 hours</li>
                      <li>• First progress email in 3-5 days</li>
                      <li>• Dashboard updates in real-time</li>
                    </ul>
                  </div>
                  
                  <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-volt-400 mb-3">📈 Expected Timeline</h3>
                    <ul className="text-sm text-secondary-300 space-y-2">
                      <li>• Week 1: First submissions completed</li>
                      <li>• Week 2-3: Listings go live</li>
                      <li>• Week 4+: Increased visibility & leads</li>
                    </ul>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-4 px-8 rounded-xl hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105 shadow-2xl mr-4"
                  >
                    📊 Open Dashboard
                  </button>
                  
                  <button
                    onClick={() => setShowQuickWins(true)}
                    className="border-2 border-volt-500 text-volt-500 font-bold py-4 px-8 rounded-xl hover:bg-volt-500 hover:text-secondary-900 transition-all duration-300 transform hover:scale-105"
                  >
                    💡 Show Quick Wins
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Wins Modal */}
        {showQuickWins && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-secondary-800 rounded-2xl border border-volt-500 p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-volt-400 mb-6">💡 Quick Wins While You Wait</h3>
              <p className="text-secondary-300 mb-6">
                Here are some things you can do right now to maximize your directory listing success:
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <span className="text-volt-400 mt-1">📸</span>
                  <div>
                    <h4 className="font-semibold text-white">Update Your Photos</h4>
                    <p className="text-sm text-secondary-300">High-quality photos increase engagement by 40%</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-volt-400 mt-1">⭐</span>
                  <div>
                    <h4 className="font-semibold text-white">Ask for Reviews</h4>
                    <p className="text-sm text-secondary-300">Fresh reviews boost directory rankings immediately</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-volt-400 mt-1">📱</span>
                  <div>
                    <h4 className="font-semibold text-white">Optimize Your Website</h4>
                    <p className="text-sm text-secondary-300">Include your NAP (Name, Address, Phone) consistently</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowQuickWins(false)}
                  className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-3 px-6 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all"
                >
                  Got It!
                </button>
                <Link
                  href="/dashboard"
                  className="border border-volt-500 text-volt-500 font-bold py-3 px-6 rounded-lg hover:bg-volt-500 hover:text-secondary-900 transition-all"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}