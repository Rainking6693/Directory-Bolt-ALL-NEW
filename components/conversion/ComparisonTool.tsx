import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, AlertTriangle, Calculator, TrendingUp, Users, Target, Zap, Shield, BarChart, Award } from 'lucide-react'
import { trackCustomEvent, trackConversionFunnel } from '../analytics/ConversionTracker'

interface ComparisonToolProps {
  variant?: 'full' | 'compact' | 'embedded'
  showCalculator?: boolean
  context?: string
  onConvert?: () => void
}

interface MetricData {
  metric: string
  manual: string | number
  automated: string | number
  icon: React.ReactNode
  advantage: 'manual' | 'automated' | 'neutral'
  description?: string
}

export function ComparisonTool({
  variant = 'full',
  showCalculator = true,
  context = 'guide',
  onConvert
}: ComparisonToolProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'time' | 'cost' | 'quality'>('overview')
  const [calculatorInputs, setCalculatorInputs] = useState({
    directories: 50,
    hourlyRate: 75,
    rejectionRate: 18
  })
  const [showCalculation, setShowCalculation] = useState(false)

  // Track component view
  useEffect(() => {
    trackCustomEvent('comparison_tool_view', {
      variant,
      context,
      show_calculator: showCalculator
    })
  }, [variant, context, showCalculator])

  const overviewMetrics: MetricData[] = [
    {
      metric: 'Time per Directory',
      manual: '45-60 min',
      automated: '< 2 min',
      icon: <Clock size={20} />,
      advantage: 'automated',
      description: 'Includes research, account creation, form filling, and verification'
    },
    {
      metric: 'Rejection Rate',
      manual: '15-25%',
      automated: '< 3%',
      icon: <XCircle size={20} />,
      advantage: 'automated',
      description: 'Based on improper categorization, incomplete info, or formatting errors'
    },
    {
      metric: 'Directories Completed',
      manual: '5-10 per day',
      automated: '100+ per day',
      icon: <Target size={20} />,
      advantage: 'automated',
      description: 'Realistic daily completion rates for quality submissions'
    },
    {
      metric: 'Consistency',
      manual: 'Variable',
      automated: 'Perfect',
      icon: <Shield size={20} />,
      advantage: 'automated',
      description: 'NAP consistency and brand messaging across all directories'
    },
    {
      metric: 'Tracking & Reporting',
      manual: 'Manual logs',
      automated: 'Real-time dashboard',
      icon: <BarChart size={20} />,
      advantage: 'automated',
      description: 'Submission status, approval tracking, and performance metrics'
    },
    {
      metric: 'Expertise Required',
      manual: 'High',
      automated: 'None',
      icon: <Award size={20} />,
      advantage: 'automated',
      description: 'Understanding of directory requirements and SEO best practices'
    }
  ]

  const timeMetrics: MetricData[] = [
    {
      metric: 'Initial Research',
      manual: '15-20 min',
      automated: '0 min',
      icon: <Clock size={20} />,
      advantage: 'automated',
      description: 'Finding relevant directories and understanding requirements'
    },
    {
      metric: 'Account Setup',
      manual: '5-10 min',
      automated: '0 min',
      icon: <Users size={20} />,
      advantage: 'automated',
      description: 'Creating accounts, email verification, profile setup'
    },
    {
      metric: 'Form Completion',
      manual: '20-25 min',
      automated: '< 1 min',
      icon: <CheckCircle size={20} />,
      advantage: 'automated',
      description: 'Filling out submission forms with business information'
    },
    {
      metric: 'Quality Check',
      manual: '5 min',
      automated: 'Built-in',
      icon: <Shield size={20} />,
      advantage: 'automated',
      description: 'Reviewing submission for accuracy and completeness'
    }
  ]

  const costMetrics: MetricData[] = [
    {
      metric: 'Staff Time Cost',
      manual: '$50-75/directory',
      automated: '$2-5/directory',
      icon: <Calculator size={20} />,
      advantage: 'automated',
      description: 'Based on $75/hour for skilled marketing professional'
    },
    {
      metric: 'Opportunity Cost',
      manual: 'High',
      automated: 'Minimal',
      icon: <TrendingUp size={20} />,
      advantage: 'automated',
      description: 'Time that could be spent on higher-value marketing activities'
    },
    {
      metric: 'Rejection Recovery',
      manual: '$15-25/rejection',
      automated: 'Included',
      icon: <AlertTriangle size={20} />,
      advantage: 'automated',
      description: 'Time spent researching and resubmitting rejected listings'
    }
  ]

  const qualityMetrics: MetricData[] = [
    {
      metric: 'NAP Consistency',
      manual: '70-85%',
      automated: '99.9%',
      icon: <Shield size={20} />,
      advantage: 'automated',
      description: 'Name, Address, Phone consistency across all directories'
    },
    {
      metric: 'Category Accuracy',
      manual: '60-80%',
      automated: '95%+',
      icon: <Target size={20} />,
      advantage: 'automated',
      description: 'Proper business categorization for maximum visibility'
    },
    {
      metric: 'Completion Rate',
      manual: '75-85%',
      automated: '98%+',
      icon: <CheckCircle size={20} />,
      advantage: 'automated',
      description: 'Successfully submitted and approved listings'
    }
  ]

  const getCurrentMetrics = (): MetricData[] => {
    switch (activeTab) {
      case 'time': return timeMetrics
      case 'cost': return costMetrics
      case 'quality': return qualityMetrics
      default: return overviewMetrics
    }
  }

  const calculateSavings = () => {
    const { directories, hourlyRate, rejectionRate } = calculatorInputs
    const manualTimePerDirectory = 50 // minutes
    const manualRejections = directories * (rejectionRate / 100)
    const totalManualTime = (directories * manualTimePerDirectory) + (manualRejections * 30) // 30 min to fix rejection
    const totalManualCost = (totalManualTime / 60) * hourlyRate
    
    const automatedCost = directories * 4 // $4 per directory
    const timeSaved = totalManualTime / 60 // hours
    const moneySaved = totalManualCost - automatedCost

    return {
      timeSaved: Math.round(timeSaved),
      moneySaved: Math.round(moneySaved),
      totalManualCost: Math.round(totalManualCost),
      automatedCost: Math.round(automatedCost)
    }
  }

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    trackCustomEvent('comparison_tab_changed', {
      tab,
      context,
      variant
    })
  }

  const handleCalculatorChange = (field: keyof typeof calculatorInputs, value: number) => {
    setCalculatorInputs(prev => ({
      ...prev,
      [field]: value
    }))
    setShowCalculation(true)

    trackCustomEvent('calculator_input_changed', {
      field,
      value,
      context
    })
  }

  const handleConvertClick = () => {
    trackConversionFunnel('comparison_tool_convert', {
      context,
      active_tab: activeTab,
      used_calculator: showCalculation
    })
    
    if (onConvert) {
      onConvert()
    }
  }

  const getAdvantageColor = (advantage: string) => {
    switch (advantage) {
      case 'automated': return 'text-success-400'
      case 'manual': return 'text-danger-400'
      default: return 'text-secondary-300'
    }
  }

  const getAdvantageIcon = (advantage: string) => {
    switch (advantage) {
      case 'automated': return <CheckCircle size={14} className="text-success-400" />
      case 'manual': return <XCircle size={14} className="text-danger-400" />
      default: return null
    }
  }

  const savings = showCalculation ? calculateSavings() : null

  if (variant === 'compact') {
    return (
      <div className="bg-secondary-800/50 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4 text-center">
          Manual vs DirectoryBolt
        </h4>
        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <h5 className="font-medium text-danger-400 mb-3">Manual Process</h5>
            <div className="space-y-2 text-sm text-secondary-300">
              <div className="flex items-center justify-center">
                <Clock size={16} className="mr-2" />
                45-60 min/directory
              </div>
              <div className="flex items-center justify-center">
                <XCircle size={16} className="mr-2" />
                15-25% rejection rate
              </div>
              <div className="flex items-center justify-center">
                <AlertTriangle size={16} className="mr-2" />
                High stress & errors
              </div>
            </div>
          </div>
          <div>
            <h5 className="font-medium text-success-400 mb-3">DirectoryBolt</h5>
            <div className="space-y-2 text-sm text-secondary-300">
              <div className="flex items-center justify-center">
                <Zap size={16} className="mr-2" />
                &lt; 2 min/directory
              </div>
              <div className="flex items-center justify-center">
                <CheckCircle size={16} className="mr-2" />
                &lt; 3% rejection rate
              </div>
              <div className="flex items-center justify-center">
                <Shield size={16} className="mr-2" />
                Automated accuracy
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-6">
          <button
            onClick={handleConvertClick}
            className="bg-volt-500 text-secondary-900 font-semibold px-6 py-2 rounded-lg hover:bg-volt-400 transition-colors"
          >
            See How It Works
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-secondary-800 to-secondary-900 rounded-xl p-6 border border-secondary-700">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          Manual vs Automated Directory Submission
        </h3>
        <p className="text-secondary-300">
          See why 500+ businesses chose automation over manual submission
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap justify-center mb-6 bg-secondary-800/50 rounded-lg p-1">
        {[
          { key: 'overview', label: 'Overview', icon: <BarChart size={16} /> },
          { key: 'time', label: 'Time', icon: <Clock size={16} /> },
          { key: 'cost', label: 'Cost', icon: <Calculator size={16} /> },
          { key: 'quality', label: 'Quality', icon: <Award size={16} /> }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key as typeof activeTab)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-volt-500 text-secondary-900'
                : 'text-secondary-300 hover:text-white hover:bg-secondary-700/50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-secondary-700">
              <th className="text-left py-3 px-4 text-white font-semibold">Metric</th>
              <th className="text-center py-3 px-4 text-danger-400 font-semibold">Manual Process</th>
              <th className="text-center py-3 px-4 text-success-400 font-semibold">DirectoryBolt</th>
              <th className="text-center py-3 px-4 text-white font-semibold">Winner</th>
            </tr>
          </thead>
          <tbody>
            {getCurrentMetrics().map((metric, index) => (
              <tr key={index} className="border-b border-secondary-800/50">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-volt-400">{metric.icon}</div>
                    <div>
                      <div className="text-white font-medium">{metric.metric}</div>
                      {metric.description && (
                        <div className="text-xs text-secondary-400 mt-1">{metric.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={metric.advantage === 'manual' ? 'text-success-400 font-medium' : 'text-secondary-300'}>
                    {metric.manual}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={metric.advantage === 'automated' ? 'text-success-400 font-medium' : 'text-secondary-300'}>
                    {metric.automated}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  {getAdvantageIcon(metric.advantage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calculator Section */}
      {showCalculator && (
        <div className="bg-secondary-800/50 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Calculator className="mr-2 text-volt-400" size={20} />
            Calculate Your Savings
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Number of Directories
              </label>
              <input
                type="number"
                value={calculatorInputs.directories}
                onChange={(e) => handleCalculatorChange('directories', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500"
                min="1"
                max="200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Your Hourly Rate ($)
              </label>
              <input
                type="number"
                value={calculatorInputs.hourlyRate}
                onChange={(e) => handleCalculatorChange('hourlyRate', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500"
                min="25"
                max="200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Expected Rejection Rate (%)
              </label>
              <input
                type="number"
                value={calculatorInputs.rejectionRate}
                onChange={(e) => handleCalculatorChange('rejectionRate', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white focus:outline-none focus:border-volt-500"
                min="0"
                max="50"
              />
            </div>
          </div>

          {savings && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-secondary-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-success-400">{savings.timeSaved}h</div>
                <div className="text-sm text-secondary-300">Time Saved</div>
              </div>
              <div className="bg-secondary-700/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-success-400">${savings.moneySaved}</div>
                <div className="text-sm text-secondary-300">Money Saved</div>
              </div>
              <div className="bg-secondary-700/50 rounded-lg p-4">
                <div className="text-lg font-bold text-danger-400">${savings.totalManualCost}</div>
                <div className="text-sm text-secondary-300">Manual Cost</div>
              </div>
              <div className="bg-secondary-700/50 rounded-lg p-4">
                <div className="text-lg font-bold text-volt-400">${savings.automatedCost}</div>
                <div className="text-sm text-secondary-300">DirectoryBolt Cost</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA Section */}
      <div className="text-center bg-gradient-to-r from-volt-500/10 to-volt-400/10 rounded-lg p-6 border border-volt-500/20">
        <h4 className="text-xl font-bold text-white mb-3">
          Ready to Save {savings ? `${savings.timeSaved} Hours` : '40+ Hours'}?
        </h4>
        <p className="text-secondary-300 mb-4">
          Join 500+ businesses using DirectoryBolt for automated directory submissions
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleConvertClick}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-8 py-3 rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all duration-300 transform hover:scale-105"
          >
            Start Free Analysis
          </button>
          <button className="border-2 border-volt-500 text-volt-400 font-bold px-8 py-3 rounded-lg hover:bg-volt-500/10 transition-all duration-300">
            See How It Works
          </button>
        </div>
        <p className="text-xs text-secondary-400 mt-3">
          No credit card required • 2-minute setup
        </p>
      </div>
    </div>
  )
}