'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface CompetitiveAnalysisData {
  marketGaps: Array<{
    gap: string
    opportunity: number // 0-100
    difficulty: number // 0-100
    timeToMarket: string
  }>
  positioningAdvantages: Array<{
    advantage: string
    strength: number // 0-100
    marketValue: number // 0-100
    sustainability: number // 0-100
  }>
  competitorCount: number
  marketSaturation: number
  differentiationScore: number
}

interface DirectoryOpportunityData {
  directories: Array<{
    name: string
    domain: string
    authority: number // Domain Authority 0-100
    industry: string
    successRate: number // 0-100
    competition: number // 0-100 (lower is better)
    estimatedTraffic: number
    monthlyValue: number
    priority: 'high' | 'medium' | 'low'
    submissionComplexity: number // 0-100
  }>
  totalOpportunities: number
  estimatedMonthlyValue: number
}

interface DataVisualizationsProps {
  competitiveData: CompetitiveAnalysisData
  directoryData: DirectoryOpportunityData
  userTier: 'free' | 'starter' | 'growth' | 'professional'
  onUpgrade: () => void
}

export default function DataVisualizations({
  competitiveData,
  directoryData,
  userTier,
  onUpgrade
}: DataVisualizationsProps) {
  const [activeChart, setActiveChart] = useState('opportunity-matrix')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
  const isLocked = userTier === 'free'

  // Opportunity Matrix Visualization
  const OpportunityMatrix = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">Directory Opportunity Matrix</h3>
        <p className="text-secondary-400">Success Rate vs Competition Level</p>
      </div>

      <div className="relative bg-secondary-900/50 rounded-2xl p-8 min-h-[500px]">
        {/* Chart Axes */}
        <div className="absolute bottom-8 left-8 right-8 top-8">
          {/* Y-axis */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-secondary-600"></div>
          <div className="absolute left-0 top-0 -ml-8 text-xs text-secondary-400 transform -rotate-90 origin-center">
            Success Rate %
          </div>
          
          {/* X-axis */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-secondary-600"></div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-6 text-xs text-secondary-400">
            Competition Level
          </div>

          {/* Grid lines */}
          {[25, 50, 75].map(percent => (
            <div key={`y-${percent}`}>
              <div 
                className="absolute left-0 right-0 h-px bg-secondary-700/50"
                style={{ bottom: `${percent}%` }}
              ></div>
              <div 
                className="absolute -left-6 text-xs text-secondary-500"
                style={{ bottom: `${percent - 2}%` }}
              >
                {percent}
              </div>
            </div>
          ))}

          {[25, 50, 75].map(percent => (
            <div key={`x-${percent}`}>
              <div 
                className="absolute top-0 bottom-0 w-px bg-secondary-700/50"
                style={{ left: `${percent}%` }}
              ></div>
              <div 
                className="absolute -bottom-6 text-xs text-secondary-500"
                style={{ left: `${percent - 2}%` }}
              >
                {percent}
              </div>
            </div>
          ))}

          {/* Data Points */}
          {directoryData.directories.slice(0, isLocked ? 5 : undefined).map((directory, index) => {
            const x = directory.competition
            const y = directory.successRate
            const size = Math.max(8, directory.authority / 5) // Size based on domain authority
            
            const priorityColors = {
              high: 'bg-success-500 border-success-400',
              medium: 'bg-volt-500 border-volt-400', 
              low: 'bg-orange-500 border-orange-400'
            }

            return (
              <motion.div
                key={directory.domain}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`absolute rounded-full cursor-pointer ${priorityColors[directory.priority]} border-2 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-all duration-300 shadow-lg`}
                style={{
                  left: `${x}%`,
                  bottom: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`
                }}
                onMouseEnter={() => setHoveredItem(directory.domain)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {hoveredItem === directory.domain && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-secondary-800 border border-secondary-600 rounded-lg p-3 shadow-2xl min-w-[200px] z-10">
                    <div className="text-white font-semibold text-sm mb-2">{directory.name}</div>
                    <div className="space-y-1 text-xs text-secondary-300">
                      <div>Authority: {directory.authority}/100</div>
                      <div>Success Rate: {directory.successRate}%</div>
                      <div>Competition: {directory.competition}%</div>
                      <div className="text-success-400 font-semibold">
                        Est. Value: ${directory.monthlyValue * 12}/year
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}

          {/* Blur overlay for locked content */}
          {isLocked && directoryData.directories.length > 5 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary-900/80 to-secondary-900 backdrop-blur-sm rounded-xl flex items-center justify-end pr-8">
              <div className="text-center">
                <div className="text-4xl mb-2">🔒</div>
                <div className="text-volt-400 font-bold mb-2">
                  +{directoryData.directories.length - 5} More Opportunities
                </div>
                <button
                  onClick={onUpgrade}
                  className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-2 px-4 rounded-lg text-sm hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
                >
                  Unlock Full Matrix
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-secondary-800/80 rounded-lg p-4 backdrop-blur-sm">
          <div className="text-xs font-semibold text-white mb-2">Priority Level</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success-500"></div>
              <span className="text-secondary-300">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-volt-500"></div>
              <span className="text-secondary-300">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-secondary-300">Strategic</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Competitive Landscape Bar Chart
  const CompetitiveLandscape = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">Competitive Landscape Analysis</h3>
        <p className="text-secondary-400">Market Gaps & Positioning Advantages</p>
      </div>

      {isLocked && (
        <div className="bg-gradient-to-r from-danger-500/10 to-volt-500/10 rounded-xl border border-volt-500/50 p-4 text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🔒</span>
            <span className="text-volt-400 font-bold">Premium Competitive Analysis</span>
          </div>
          <p className="text-secondary-300 text-sm mb-3">
            Unlock detailed competitor insights, market gaps, and positioning strategies
          </p>
          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold py-2 px-4 rounded-lg text-sm hover:from-volt-400 hover:to-volt-500 transition-all duration-300"
          >
            Upgrade Now
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${isLocked ? 'filter blur-sm opacity-50' : ''}`}>
        {/* Market Gaps */}
        <div className="bg-secondary-900/50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-danger-400 mb-6 flex items-center gap-2">
            <span>🎯</span>
            Market Gaps Identified
          </h4>
          <div className="space-y-4">
            {competitiveData.marketGaps.slice(0, 4).map((gap, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-secondary-200 text-sm font-medium">{gap.gap}</span>
                  <span className="text-xs text-secondary-400">{gap.timeToMarket}</span>
                </div>
                <div className="flex gap-2">
                  {/* Opportunity Level */}
                  <div className="flex-1">
                    <div className="text-xs text-secondary-400 mb-1">Opportunity</div>
                    <div className="bg-secondary-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-success-500 to-success-400 rounded-full h-2 transition-all duration-1000"
                        style={{ width: `${gap.opportunity}%` }}
                      ></div>
                    </div>
                  </div>
                  {/* Difficulty Level */}
                  <div className="flex-1">
                    <div className="text-xs text-secondary-400 mb-1">Difficulty</div>
                    <div className="bg-secondary-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-danger-500 to-orange-400 rounded-full h-2 transition-all duration-1000"
                        style={{ width: `${gap.difficulty}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Positioning Advantages */}
        <div className="bg-secondary-900/50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-success-400 mb-6 flex items-center gap-2">
            <span>⚡</span>
            Your Positioning Advantages
          </h4>
          <div className="space-y-4">
            {competitiveData.positioningAdvantages.slice(0, 4).map((advantage, index) => (
              <div key={index} className="space-y-2">
                <div className="text-secondary-200 text-sm font-medium">{advantage.advantage}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-secondary-400 mb-1">Strength</div>
                    <div className="bg-secondary-700 rounded-full h-2">
                      <div 
                        className="bg-volt-500 rounded-full h-2 transition-all duration-1000"
                        style={{ width: `${advantage.strength}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-secondary-400 mb-1">Value</div>
                    <div className="bg-secondary-700 rounded-full h-2">
                      <div 
                        className="bg-success-500 rounded-full h-2 transition-all duration-1000"
                        style={{ width: `${advantage.marketValue}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-secondary-400 mb-1">Sustain</div>
                    <div className="bg-secondary-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 rounded-full h-2 transition-all duration-1000"
                        style={{ width: `${advantage.sustainability}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Market Overview */}
      <div className={`bg-secondary-900/50 rounded-xl p-6 ${isLocked ? 'filter blur-sm opacity-50' : ''}`}>
        <h4 className="text-lg font-semibold text-volt-400 mb-6">Market Overview</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-black text-danger-400 mb-2">
              {competitiveData.competitorCount}
            </div>
            <div className="text-secondary-400 text-sm">Active Competitors</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-orange-400 mb-2">
              {competitiveData.marketSaturation}%
            </div>
            <div className="text-secondary-400 text-sm">Market Saturation</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-success-400 mb-2">
              {competitiveData.differentiationScore}%
            </div>
            <div className="text-secondary-400 text-sm">Differentiation Score</div>
          </div>
        </div>
      </div>
    </div>
  )

  // ROI Timeline Visualization
  const ROITimeline = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">Revenue Impact Timeline</h3>
        <p className="text-secondary-400">Projected monthly revenue from directory listings</p>
      </div>

      <div className="bg-secondary-900/50 rounded-xl p-8">
        <div className="relative">
          {/* Timeline */}
          <div className="flex justify-between items-end h-64 mb-6">
            {[1, 2, 3, 6, 12].map(month => {
              const value = Math.round(directoryData.estimatedMonthlyValue * (month <= 3 ? month * 0.3 : month <= 6 ? month * 0.6 : month * 0.8))
              const height = (value / (directoryData.estimatedMonthlyValue * 0.8)) * 100
              
              return (
                <div key={month} className="flex-1 px-2">
                  <div className="relative">
                    <div 
                      className="bg-gradient-to-t from-volt-600 to-volt-400 rounded-t mx-auto transition-all duration-1000 hover:from-volt-500 hover:to-volt-300"
                      style={{ 
                        height: `${Math.max(height, 10)}%`,
                        width: '80%'
                      }}
                    ></div>
                    <div className="text-center mt-2">
                      <div className="text-white font-bold text-sm">${value.toLocaleString()}</div>
                      <div className="text-secondary-400 text-xs">Month {month}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Milestones */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-success-400">
              <div className="w-2 h-2 bg-success-400 rounded-full"></div>
              <span>Month 1-2: Initial directory approvals and traffic</span>
            </div>
            <div className="flex items-center gap-3 text-volt-400">
              <div className="w-2 h-2 bg-volt-400 rounded-full"></div>
              <span>Month 3-6: Established presence and lead generation</span>
            </div>
            <div className="flex items-center gap-3 text-orange-400">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              <span>Month 6+: Compounding returns and market dominance</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-success-400 mb-1">
            {Math.round((directoryData.estimatedMonthlyValue * 12) / 299)}x
          </div>
          <div className="text-success-300 font-medium text-sm">Annual ROI</div>
        </div>
        <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-volt-400 mb-1">14</div>
          <div className="text-volt-300 font-medium text-sm">Days to Payback</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-orange-400 mb-1">
            ${Math.round(directoryData.estimatedMonthlyValue / 30)}
          </div>
          <div className="text-orange-300 font-medium text-sm">Daily Revenue</div>
        </div>
        <div className="bg-secondary-600/30 border border-secondary-600/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-secondary-300 mb-1">
            ${(directoryData.estimatedMonthlyValue * 12).toLocaleString()}
          </div>
          <div className="text-secondary-400 font-medium text-sm">Annual Value</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Chart Navigation */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[
          { id: 'opportunity-matrix', label: 'Opportunity Matrix', icon: '📊' },
          { id: 'competitive', label: 'Competitive Analysis', icon: '⚔️', locked: isLocked },
          { id: 'roi-timeline', label: 'ROI Timeline', icon: '📈' }
        ].map(chart => (
          <button
            key={chart.id}
            onClick={() => !chart.locked && setActiveChart(chart.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              activeChart === chart.id
                ? 'bg-volt-500 text-secondary-900'
                : chart.locked
                  ? 'bg-secondary-800 text-secondary-500 cursor-not-allowed'
                  : 'bg-secondary-800 text-secondary-300 hover:bg-secondary-700 hover:text-white'
            }`}
          >
            {chart.locked && (
              <span className="absolute -top-1 -right-1 text-xs">🔒</span>
            )}
            <span>{chart.icon}</span>
            <span>{chart.label}</span>
          </button>
        ))}
      </div>

      {/* Chart Content */}
      <motion.div
        key={activeChart}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-secondary-800/30 rounded-2xl border border-secondary-700 p-8"
      >
        {activeChart === 'opportunity-matrix' && <OpportunityMatrix />}
        {activeChart === 'competitive' && <CompetitiveLandscape />}
        {activeChart === 'roi-timeline' && <ROITimeline />}
      </motion.div>

      {/* Chart Insights */}
      <div className="bg-gradient-to-r from-volt-500/10 to-success-500/10 rounded-2xl border border-volt-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">💡</span>
          <h3 className="text-xl font-bold text-volt-400">Key Insights</h3>
        </div>
        
        {activeChart === 'opportunity-matrix' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-success-400 font-semibold mb-2">High-Priority Opportunities</div>
              <p className="text-secondary-300">
                {directoryData.directories.filter(d => d.priority === 'high').length} directories with 90%+ success rates and low competition.
              </p>
            </div>
            <div>
              <div className="text-volt-400 font-semibold mb-2">Quick Wins Available</div>
              <p className="text-secondary-300">
                Focus on high-authority, low-competition directories for immediate impact.
              </p>
            </div>
          </div>
        )}

        {activeChart === 'competitive' && !isLocked && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-danger-400 font-semibold mb-2">Market Gaps</div>
              <p className="text-secondary-300">
                {competitiveData.marketGaps.length} identified gaps with average {Math.round(competitiveData.marketGaps.reduce((acc, gap) => acc + gap.opportunity, 0) / competitiveData.marketGaps.length)}% opportunity score.
              </p>
            </div>
            <div>
              <div className="text-success-400 font-semibold mb-2">Your Advantages</div>
              <p className="text-secondary-300">
                {competitiveData.positioningAdvantages.length} key advantages with {competitiveData.differentiationScore}% differentiation score.
              </p>
            </div>
          </div>
        )}

        {activeChart === 'roi-timeline' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-success-400 font-semibold mb-2">Revenue Acceleration</div>
              <p className="text-secondary-300">
                Expect 30% monthly growth in directory-driven revenue for first 6 months.
              </p>
            </div>
            <div>
              <div className="text-volt-400 font-semibold mb-2">Break-Even Timeline</div>
              <p className="text-secondary-300">
                Most businesses recover investment cost within 14-21 days of first submissions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}