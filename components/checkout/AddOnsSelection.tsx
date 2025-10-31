'use client'
import { useState } from 'react'

interface AddOn {
  id: string
  name: string
  price: number
  description: string
  icon: string
}

interface Package {
  id: string
  name: string
  price: number
  directories: number
}

interface AddOnsSelectionProps {
  addOns: Record<string, AddOn>
  selectedAddOns: string[]
  onComplete: (selectedAddOns: string[]) => void
  onGoBack: () => void
  selectedPackage: Package
}

export function AddOnsSelection({ 
  addOns, 
  selectedAddOns, 
  onComplete, 
  onGoBack, 
  selectedPackage 
}: AddOnsSelectionProps) {
  const [currentSelection, setCurrentSelection] = useState<string[]>(selectedAddOns)
  
  const addOnArray = Object.values(addOns)
  const totalAddOnPrice = currentSelection.reduce((total, addOnId) => {
    return total + (addOns[addOnId]?.price || 0)
  }, 0)

  const handleAddOnToggle = (addOnId: string) => {
    setCurrentSelection(prev => {
      if (prev.includes(addOnId)) {
        return prev.filter(id => id !== addOnId)
      } else {
        return [...prev, addOnId]
      }
    })
  }

  const handleContinue = () => {
    onComplete(currentSelection)
  }

  const handleSkip = () => {
    onComplete([])
  }

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
          Boost Your
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> Results</span>
        </h2>
        <p className="text-lg text-secondary-300 max-w-2xl mx-auto mb-4">
          Add optional services to maximize your directory submission impact. Each add-on is designed to accelerate your results.
        </p>
        <div className="bg-secondary-800/50 border border-secondary-600 rounded-lg p-4 max-w-md mx-auto">
          <div className="text-sm text-secondary-400">Selected Package:</div>
          <div className="font-bold text-volt-400">
            {selectedPackage.name} - ${selectedPackage.price} ({selectedPackage.directories} directories)
          </div>
        </div>
      </div>

      {/* Add-Ons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {addOnArray.map((addOn, index) => {
          const isSelected = currentSelection.includes(addOn.id)
          
          return (
            <div
              key={addOn.id}
              className={`relative transform transition-all duration-300 hover:scale-102 animate-slide-up cursor-pointer`}
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => handleAddOnToggle(addOn.id)}
            >
              <div className={`h-full bg-gradient-to-br backdrop-blur-sm rounded-xl p-6 border-2 transition-all duration-300 ${
                isSelected
                  ? 'from-volt-500/20 to-volt-600/10 border-volt-500 shadow-xl shadow-volt-500/20'
                  : 'from-secondary-800/80 to-secondary-900/60 border-secondary-600 hover:border-secondary-500 hover:shadow-lg'
              }`}>
                {/* Add-on Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{addOn.icon}</div>
                    <div>
                      <h3 className={`text-lg font-bold ${isSelected ? 'text-volt-300' : 'text-white'}`}>
                        {addOn.name}
                      </h3>
                      <div className={`text-2xl font-black ${isSelected ? 'text-volt-400' : 'text-volt-400'}`}>
                        +${addOn.price}
                      </div>
                    </div>
                  </div>
                  
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded border-2 transition-all duration-300 flex items-center justify-center ${
                    isSelected 
                      ? 'bg-volt-500 border-volt-500' 
                      : 'border-secondary-500 hover:border-volt-400'
                  }`}>
                    {isSelected && (
                      <svg className="w-4 h-4 text-secondary-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-secondary-300 text-sm leading-relaxed">
                  {addOn.description}
                </p>

                {/* Value Indicator */}
                <div className={`mt-4 p-3 rounded-lg text-xs ${
                  isSelected
                    ? 'bg-volt-500/10 border border-volt-500/30'
                    : 'bg-secondary-700/50 border border-secondary-600/50'
                }`}>
                  {addOn.id === 'fast_track' && (
                    <div className="text-success-400 font-medium">⏱️ Save 3-5 business days</div>
                  )}
                  {addOn.id === 'premium_directories' && (
                    <div className="text-success-400 font-medium">📈 Higher SEO impact</div>
                  )}
                  {addOn.id === 'manual_qa' && (
                    <div className="text-success-400 font-medium">🎯 99%+ accuracy guarantee</div>
                  )}
                  {addOn.id === 'csv_export' && (
                    <div className="text-success-400 font-medium">📊 Track all results</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pricing Summary */}
      {currentSelection.length > 0 && (
        <div className="bg-gradient-to-r from-volt-500/10 to-volt-600/10 border border-volt-500/30 rounded-xl p-6 mb-8">
          <div className="text-center">
            <h3 className="text-xl font-bold text-volt-300 mb-2">Selected Add-ons</h3>
            <div className="space-y-2 mb-4">
              {currentSelection.map(addOnId => (
                <div key={addOnId} className="flex items-center justify-between text-sm">
                  <span className="text-secondary-200">{addOns[addOnId].name}</span>
                  <span className="text-volt-400 font-bold">+${addOns[addOnId].price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-volt-500/30 pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-white">Total Add-ons:</span>
                <span className="text-volt-400">+${totalAddOnPrice}</span>
              </div>
              <div className="flex items-center justify-between text-2xl font-black mt-2">
                <span className="text-white">Package + Add-ons:</span>
                <span className="text-volt-400">${selectedPackage.price + totalAddOnPrice}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <button
          onClick={onGoBack}
          className="px-6 py-3 border border-secondary-600 text-secondary-300 font-medium rounded-xl hover:bg-secondary-700 hover:border-secondary-500 transition-all duration-300"
        >
          ← Back to Packages
        </button>
        
        <button
          onClick={handleSkip}
          className="px-8 py-3 border border-secondary-600 text-secondary-300 font-medium rounded-xl hover:bg-secondary-700 hover:border-secondary-500 transition-all duration-300"
        >
          Skip Add-ons
        </button>
        
        <button
          onClick={handleContinue}
          className="px-10 py-4 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-black text-lg rounded-xl hover:from-volt-400 hover:to-volt-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-volt-500/50 animate-glow"
        >
          Continue →
        </button>
      </div>

      {/* Benefits Reminder */}
      <div className="mt-8 text-center">
        <div className="bg-secondary-800/50 border border-secondary-600/50 rounded-lg p-4 max-w-2xl mx-auto">
          <div className="text-sm text-secondary-300 mb-2">💡 <strong>Pro Tip:</strong></div>
          <div className="text-sm text-secondary-400">
            Our customers who add Fast-track Submission see results 5x faster, 
            and those with Manual QA Review have 99%+ approval rates across all directories.
          </div>
        </div>
      </div>
    </div>
  )
}