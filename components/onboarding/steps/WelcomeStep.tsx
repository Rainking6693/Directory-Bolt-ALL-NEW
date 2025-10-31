'use client'

import { motion } from 'framer-motion'
import { OnboardingStepProps } from '../OnboardingFlow'

export default function WelcomeStep({
  onNext,
  data,
  updateData
}: OnboardingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-8 text-center">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-white mb-4">
            Welcome to DirectoryBolt! 🚀
          </h3>
          <p className="text-secondary-300 text-lg leading-relaxed">
            You're about to transform your business visibility with AI-powered directory submissions. 
            Let's get you set up for maximum success!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-3xl mb-2">🎯</div>
            <h4 className="font-semibold text-white mb-1">Targeted Growth</h4>
            <p className="text-sm text-secondary-400">
              AI finds the perfect directories for your business
            </p>
          </div>
          
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-3xl mb-2">⚡</div>
            <h4 className="font-semibold text-white mb-1">Lightning Fast</h4>
            <p className="text-sm text-secondary-400">
              Automated submissions save 40+ hours of work
            </p>
          </div>
          
          <div className="bg-secondary-700/50 rounded-lg p-4">
            <div className="text-3xl mb-2">📈</div>
            <h4 className="font-semibold text-white mb-1">Proven Results</h4>
            <p className="text-sm text-secondary-400">
              Average 300% increase in online visibility
            </p>
          </div>
        </div>

        <div className="bg-volt-500/10 border border-volt-500/30 rounded-lg p-6 mb-6">
          <h4 className="font-bold text-volt-400 mb-2 flex items-center gap-2">
            ⏰ Quick Setup (2-3 minutes)
          </h4>
          <p className="text-secondary-300 text-sm">
            We'll gather some basic information about your business and goals to personalize your experience.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onNext}
            className="bg-volt-500 hover:bg-volt-400 text-secondary-900 font-bold py-3 px-8 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Let's Get Started! →
          </button>
        </div>
      </div>
    </motion.div>
  )
}