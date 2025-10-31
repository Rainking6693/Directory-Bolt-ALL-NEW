'use client'
import { useState, useEffect } from 'react'
import { Transition } from '@headlessui/react'

interface PackageFeature {
  name: string
  included: boolean
  value?: string | number
}

interface Package {
  id: string
  name: string
  price: number
  annualPrice?: number
  directories: number | string
  description: string
  recommended: boolean
  popular?: boolean
  features: PackageFeature[]
  benefits: string[]
  limitations?: string[]
}

interface PackageSelectorProps {
  selectedPackage?: string
  onPackageSelect: (packageId: string) => void
  showComparison?: boolean
  billingCycle?: 'monthly' | 'annual'
  onBillingCycleChange?: (cycle: 'monthly' | 'annual') => void
  className?: string
}

const packages: Package[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29.99,
    annualPrice: 299.9, // 2 months free
    directories: 50,
    description: 'Perfect for small businesses getting started online',
    recommended: false,
    features: [
      { name: 'Directory Submissions', included: true, value: 50 },
      { name: 'Email Support', included: true },
      { name: 'Standard Processing', included: true },
      { name: 'Basic Analytics', included: true },
      { name: 'Approval Rate', included: true, value: '85%+' },
      { name: 'Phone Support', included: false },
      { name: 'Priority Processing', included: false },
      { name: 'AI Optimization', included: false },
      { name: 'API Access', included: false },
      { name: 'White-label Reports', included: false },
      { name: 'Rush Processing', included: false },
      { name: 'Dedicated Support', included: false }
    ],
    benefits: [
      'Get listed in 50 high-authority directories',
      'Professional business listings',
      'Email support included',
      'Basic performance tracking'
    ]
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 79.99,
    annualPrice: 799.9, // 2 months free
    directories: 200,
    description: 'Most popular for growing businesses',
    recommended: true,
    popular: true,
    features: [
      { name: 'Directory Submissions', included: true, value: 200 },
      { name: 'Email Support', included: true },
      { name: 'Standard Processing', included: true },
      { name: 'Basic Analytics', included: true },
      { name: 'Approval Rate', included: true, value: '90%+' },
      { name: 'Phone Support', included: false },
      { name: 'Priority Processing', included: true },
      { name: 'AI Optimization', included: true },
      { name: 'API Access', included: false },
      { name: 'White-label Reports', included: false },
      { name: 'Rush Processing', included: false },
      { name: 'Dedicated Support', included: false }
    ],
    benefits: [
      'Submit to 480+ premium directories',
      'AI-powered listing optimization',
      'Priority processing queue',
      'Advanced analytics dashboard',
      '400-600% average ROI'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149.99,
    annualPrice: 1499.9, // 2 months free
    directories: 500,
    description: 'For established businesses and agencies',
    recommended: false,
    features: [
      { name: 'Directory Submissions', included: true, value: 500 },
      { name: 'Email Support', included: true },
      { name: 'Standard Processing', included: true },
      { name: 'Basic Analytics', included: true },
      { name: 'Approval Rate', included: true, value: '95%+' },
      { name: 'Phone Support', included: true },
      { name: 'Priority Processing', included: true },
      { name: 'AI Optimization', included: true },
      { name: 'API Access', included: true },
      { name: 'White-label Reports', included: true },
      { name: 'Rush Processing', included: true },
      { name: 'Dedicated Support', included: false }
    ],
    benefits: [
      'Access to 480+ directory network',
      'Phone support included',
      'API access for integrations',
      'White-label client reports',
      'Rush processing available',
      '600-800% average ROI'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299.99,
    annualPrice: 2999.9, // 2 months free
    directories: 'Unlimited',
    description: 'For large organizations with complex needs',
    recommended: false,
    features: [
      { name: 'Directory Submissions', included: true, value: 'Unlimited' },
      { name: 'Email Support', included: true },
      { name: 'Standard Processing', included: true },
      { name: 'Basic Analytics', included: true },
      { name: 'Approval Rate', included: true, value: '98%+' },
      { name: 'Phone Support', included: true },
      { name: 'Priority Processing', included: true },
      { name: 'AI Optimization', included: true },
      { name: 'API Access', included: true },
      { name: 'White-label Reports', included: true },
      { name: 'Rush Processing', included: true },
      { name: 'Dedicated Support', included: true }
    ],
    benefits: [
      'Unlimited directory submissions',
      'Dedicated account manager',
      'Custom integration support',
      'SLA guarantee',
      'Priority queue access',
      'Custom reporting dashboard'
    ]
  }
]

const comparisonFeatures = [
  'Directory Submissions',
  'Email Support',
  'Phone Support',
  'Priority Processing',
  'AI Optimization',
  'API Access',
  'White-label Reports',
  'Rush Processing',
  'Dedicated Support',
  'Approval Rate'
]

export default function PackageSelector({
  selectedPackage = 'growth',
  onPackageSelect,
  showComparison = false,
  billingCycle = 'monthly',
  onBillingCycleChange,
  className = ''
}: PackageSelectorProps) {
  const [showComparisonTable, setShowComparisonTable] = useState(showComparison)
  const [hoveredPackage, setHoveredPackage] = useState<string | null>(null)

  const getDisplayPrice = (pkg: Package) => {
    if (billingCycle === 'annual' && pkg.annualPrice) {
      return (pkg.annualPrice / 12).toFixed(2)
    }
    return pkg.price.toFixed(2)
  }

  const getSavings = (pkg: Package) => {
    if (billingCycle === 'annual' && pkg.annualPrice) {
      const annualMonthly = pkg.annualPrice / 12
      const savings = pkg.price - annualMonthly
      return savings > 0 ? savings.toFixed(2) : null
    }
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Billing Cycle Toggle */}
      {onBillingCycleChange && (
        <div className="flex justify-center mb-8">
          <div className="bg-secondary-800 p-1 rounded-lg flex items-center">
            <button
              onClick={() => onBillingCycleChange('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-volt-500 text-secondary-900'
                  : 'text-secondary-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => onBillingCycleChange('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all relative ${
                billingCycle === 'annual'
                  ? 'bg-volt-500 text-secondary-900'
                  : 'text-secondary-300 hover:text-white'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 bg-success-500 text-white text-xs px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Package Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {packages.map((pkg) => {
          const savings = getSavings(pkg)
          const isSelected = selectedPackage === pkg.id
          const isHovered = hoveredPackage === pkg.id

          return (
            <div
              key={pkg.id}
              className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                isSelected
                  ? 'border-volt-500 bg-volt-500/10 shadow-2xl shadow-volt-500/20 scale-105'
                  : 'border-secondary-600 bg-secondary-800/50 hover:border-volt-500/50'
              } ${pkg.recommended ? 'ring-2 ring-volt-500/30' : ''}`}
              onClick={() => onPackageSelect(pkg.id)}
              onMouseEnter={() => setHoveredPackage(pkg.id)}
              onMouseLeave={() => setHoveredPackage(null)}
            >
              {/* Popular Badge */}
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-4 py-2 rounded-full text-xs shadow-lg animate-pulse">
                    🔥 MOST POPULAR
                  </span>
                </div>
              )}

              {/* Recommended Badge */}
              {pkg.recommended && !pkg.popular && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-success-500 text-white font-medium px-3 py-1 rounded-full text-xs">
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                
                <div className="mb-2">
                  <span className="text-4xl font-black text-volt-400">
                    ${getDisplayPrice(pkg)}
                  </span>
                  <span className="text-lg text-secondary-400">
                    /{billingCycle === 'annual' ? 'mo' : 'month'}
                  </span>
                  
                  {savings && (
                    <div className="text-success-400 text-sm font-medium">
                      Save ${savings}/month
                    </div>
                  )}
                </div>

                <p className="text-sm text-secondary-300 mb-1">
                  {typeof pkg.directories === 'number' 
                    ? `${pkg.directories} directories` 
                    : pkg.directories
                  }
                </p>
                <p className="text-xs text-secondary-400">{pkg.description}</p>
              </div>

              {/* Key Features */}
              <ul className="space-y-2 mb-6">
                {pkg.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start text-sm text-secondary-300">
                    <span className="text-success-400 mr-2 mt-0.5 flex-shrink-0">✓</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 bg-volt-500 text-secondary-900 p-2 rounded-full">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Hover Effect */}
              <Transition
                show={isHovered && !isSelected}
                enter="transition-opacity duration-200"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute inset-0 border-2 border-volt-500/50 rounded-2xl bg-volt-500/5 pointer-events-none" />
              </Transition>
            </div>
          )
        })}
      </div>

      {/* Comparison Toggle */}
      <div className="text-center mb-6">
        <button
          onClick={() => setShowComparisonTable(!showComparisonTable)}
          className="text-volt-400 hover:text-volt-300 font-medium underline underline-offset-4 hover:underline-offset-8 transition-all duration-300 flex items-center justify-center gap-2 mx-auto"
        >
          <span>{showComparisonTable ? 'Hide' : 'Show'} Detailed Comparison</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-300 ${showComparisonTable ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Detailed Comparison Table */}
      <Transition
        show={showComparisonTable}
        enter="transition-all duration-500"
        enterFrom="opacity-0 max-h-0"
        enterTo="opacity-100 max-h-96"
        leave="transition-all duration-500"
        leaveFrom="opacity-100 max-h-96"
        leaveTo="opacity-0 max-h-0"
      >
        <div className="overflow-hidden">
          <div className="bg-secondary-800/50 rounded-xl border border-secondary-600 p-6">
            <h3 className="text-xl font-semibold text-volt-400 mb-6 text-center">
              Feature Comparison
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-600">
                    <th className="text-left py-3 px-2 font-medium text-secondary-300">
                      Features
                    </th>
                    {packages.map((pkg) => (
                      <th 
                        key={pkg.id} 
                        className={`text-center py-3 px-2 font-medium ${
                          selectedPackage === pkg.id ? 'text-volt-400' : 'text-white'
                        }`}
                      >
                        {pkg.name}
                        {pkg.popular && (
                          <div className="text-xs text-volt-500 font-normal">Most Popular</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((featureName) => (
                    <tr key={featureName} className="border-b border-secondary-700/50">
                      <td className="py-3 px-2 text-secondary-300 font-medium">
                        {featureName}
                      </td>
                      {packages.map((pkg) => {
                        const feature = pkg.features.find(f => f.name === featureName)
                        return (
                          <td key={pkg.id} className="text-center py-3 px-2">
                            {feature?.included ? (
                              <div className="flex flex-col items-center">
                                <span className="text-success-400 text-lg">✓</span>
                                {feature.value && (
                                  <span className="text-xs text-secondary-400">
                                    {feature.value}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-secondary-500 text-lg">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  
                  {/* Pricing Row */}
                  <tr className="border-t-2 border-volt-500/30 bg-volt-500/5">
                    <td className="py-4 px-2 font-semibold text-volt-400">
                      Price ({billingCycle})
                    </td>
                    {packages.map((pkg) => (
                      <td key={pkg.id} className="text-center py-4 px-2">
                        <div className="font-bold text-volt-400">
                          ${getDisplayPrice(pkg)}
                          <span className="text-sm font-normal text-secondary-400">
                            /{billingCycle === 'annual' ? 'mo' : 'month'}
                          </span>
                        </div>
                        {getSavings(pkg) && (
                          <div className="text-xs text-success-400 mt-1">
                            Save ${getSavings(pkg)}/mo
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Transition>

      {/* Selected Package Summary */}
      {selectedPackage && (
        <div className="mt-6 p-4 bg-volt-500/10 border border-volt-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-secondary-300">Selected: </span>
              <span className="font-semibold text-volt-400">
                {packages.find(p => p.id === selectedPackage)?.name}
              </span>
            </div>
            <div className="text-right">
              <div className="font-bold text-volt-400">
                ${getDisplayPrice(packages.find(p => p.id === selectedPackage)!)}
                <span className="text-sm font-normal text-secondary-400">
                  /{billingCycle === 'annual' ? 'mo' : 'month'}
                </span>
              </div>
              {getSavings(packages.find(p => p.id === selectedPackage)!) && (
                <div className="text-xs text-success-400">
                  Save ${getSavings(packages.find(p => p.id === selectedPackage)!)}/mo
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}