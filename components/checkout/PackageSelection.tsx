'use client'
import { useState } from 'react'

interface Package {
  id: string
  name: string
  price: number
  directories: number
  description: string
  features: string[]
  popular?: boolean
}

interface PackageSelectionProps {
  packages: Record<string, Package>
  selectedPackage: string | null
  onPackageSelect: (packageId: string) => void
}

export function PackageSelection({ packages, selectedPackage, onPackageSelect }: PackageSelectionProps) {
  const [hoveredPackage, setHoveredPackage] = useState<string | null>(null)

  const packageArray = Object.values(packages)

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
          Choose Your
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Package</span>
        </h2>
        <p className="text-lg text-secondary-300 max-w-2xl mx-auto">
          Select the perfect package for your business. All packages include premium directory submissions with guaranteed results.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        {packageArray.map((pkg, index) => (
          <div
            key={pkg.id}
            className={`relative transform transition-all duration-300 hover:scale-105 animate-slide-up cursor-pointer ${
              pkg.popular ? 'scale-105' : ''
            }`}
            style={{ animationDelay: `${index * 0.1}s` }}
            onMouseEnter={() => setHoveredPackage(pkg.id)}
            onMouseLeave={() => setHoveredPackage(null)}
            onClick={() => onPackageSelect(pkg.id)}
          >
            {/* Popular Badge */}
            {pkg.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black px-6 py-2 rounded-full text-sm shadow-lg">
                  🔥 MOST POPULAR
                </span>
              </div>
            )}

            <div className={`h-full bg-gradient-to-br backdrop-blur-sm rounded-2xl p-8 border-2 transition-all duration-300 ${
              pkg.popular
                ? 'from-volt-500/20 to-volt-600/10 border-volt-500 shadow-2xl shadow-volt-500/20'
                : selectedPackage === pkg.id || hoveredPackage === pkg.id
                  ? 'from-secondary-700/80 to-secondary-800/60 border-volt-400 shadow-xl shadow-volt-400/20'
                  : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-secondary-500'
            }`}>
              {/* Header */}
              <div className="text-center mb-6">
                <h3 className={`text-2xl font-bold mb-2 ${pkg.popular ? 'text-volt-300' : 'text-white'}`}>
                  {pkg.name}
                </h3>
                <div className="mb-4">
                  <div className="text-5xl font-black mb-2">
                    <span className={pkg.popular ? 'text-volt-400' : 'text-volt-400'}>
                      ${pkg.price}
                    </span>
                    <span className="text-lg text-secondary-400"> one-time</span>
                  </div>
                </div>
                <p className="text-secondary-300 text-sm">{pkg.description}</p>
              </div>

              {/* Directory Count Highlight */}
              <div className={`text-center mb-6 p-4 rounded-lg ${
                pkg.popular
                  ? 'bg-volt-500/10 border border-volt-500/30'
                  : 'bg-secondary-700/50 border border-secondary-600/50'
              }`}>
                <div className="text-3xl font-black text-volt-400">
                  {pkg.directories}
                </div>
                <div className="text-sm text-secondary-300">Directory Submissions</div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {pkg.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3 text-sm">
                    <span className={`${pkg.popular ? 'text-volt-400' : 'text-success-400'} text-lg flex-shrink-0 mt-0.5`}>
                      ✅
                    </span>
                    <span className="text-secondary-200">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                pkg.popular
                  ? 'bg-gradient-to-r from-volt-500 to-volt-600 hover:from-volt-400 hover:to-volt-500 text-secondary-900 shadow-2xl shadow-volt-500/50 animate-glow'
                  : 'bg-secondary-700 hover:bg-secondary-600 text-white border border-secondary-600 hover:border-volt-400'
              }`}>
                Select {pkg.name}
              </button>

              {/* Value Proposition */}
              <div className="text-center mt-4 p-3 bg-secondary-900/30 rounded-lg border border-secondary-600/30">
                <div className="text-xs font-bold text-success-400 mb-1">
                  💰 Estimated ROI: 400-600%
                </div>
                <div className="text-xs text-secondary-400">
                  Based on average customer results
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trust Indicators */}
      <div className="text-center">
        <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-secondary-400">
          <div className="flex items-center gap-2">
            <span className="text-success-400">🛡️</span>
            <span>30-Day Money-Back Guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success-400">⚡</span>
            <span>5-7 Day Completion</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success-400">📊</span>
            <span>Detailed Progress Reports</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success-400">🎯</span>
            <span>95%+ Success Rate</span>
          </div>
        </div>
      </div>
    </div>
  )
}