'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

export interface CustomWidget {
  id: string
  type: 'stats' | 'chart' | 'list' | 'text' | 'action'
  title: string
  description?: string
  size: 'small' | 'medium' | 'large' | 'xl'
  position: { x: number; y: number }
  data: Record<string, any>
  settings: Record<string, any>
  refreshInterval?: number
  lastUpdated?: string
  isVisible: boolean
  isLocked?: boolean
}

export interface WidgetTemplate {
  id: string
  name: string
  description: string
  type: CustomWidget['type']
  defaultSize: CustomWidget['size']
  defaultSettings: Record<string, any>
  dataSource: string
  category: 'analytics' | 'directories' | 'seo' | 'business' | 'system'
  tierRequirement?: string[]
  icon: string
}

// Available widget templates
const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: 'quick-stats',
    name: 'Quick Stats',
    description: 'Overview of key metrics',
    type: 'stats',
    defaultSize: 'medium',
    defaultSettings: { 
      metrics: ['total_directories', 'live_listings', 'pending_submissions'],
      showPercentages: true,
      colorScheme: 'default'
    },
    dataSource: '/api/analytics/quick-stats',
    category: 'analytics',
    icon: '📊'
  },
  {
    id: 'submission-progress',
    name: 'Submission Progress',
    description: 'Track directory submission progress',
    type: 'chart',
    defaultSize: 'large',
    defaultSettings: {
      chartType: 'donut',
      showLabels: true,
      animate: true
    },
    dataSource: '/api/analytics/submission-progress',
    category: 'directories',
    icon: '📈'
  },
  {
    id: 'recent-activities',
    name: 'Recent Activities',
    description: 'Latest directory submissions and updates',
    type: 'list',
    defaultSize: 'medium',
    defaultSettings: {
      itemCount: 5,
      showTimestamps: true,
      groupByDate: false
    },
    dataSource: '/api/analytics/recent-activities',
    category: 'directories',
    icon: '🔄'
  },
  {
    id: 'seo-performance',
    name: 'SEO Performance',
    description: 'Track your SEO metrics and rankings',
    type: 'chart',
    defaultSize: 'large',
    defaultSettings: {
      chartType: 'line',
      timeframe: '30d',
      metrics: ['rankings', 'traffic', 'keywords']
    },
    dataSource: '/api/analytics/seo-performance',
    category: 'seo',
    tierRequirement: ['professional', 'enterprise'],
    icon: '🔍'
  },
  {
    id: 'competitive-insights',
    name: 'Competitive Insights',
    description: 'Compare performance with competitors',
    type: 'chart',
    defaultSize: 'xl',
    defaultSettings: {
      competitors: [],
      metrics: ['visibility', 'listings', 'traffic'],
      chartType: 'bar'
    },
    dataSource: '/api/analytics/competitive-insights',
    category: 'seo',
    tierRequirement: ['professional', 'enterprise'],
    icon: '⚔️'
  },
  {
    id: 'business-health',
    name: 'Business Health Score',
    description: 'Overall business presence score',
    type: 'stats',
    defaultSize: 'small',
    defaultSettings: {
      showBreakdown: true,
      includeRecommendations: true
    },
    dataSource: '/api/analytics/business-health',
    category: 'business',
    icon: '💚'
  },
  {
    id: 'quick-actions',
    name: 'Quick Actions',
    description: 'Frequently used actions and shortcuts',
    type: 'action',
    defaultSize: 'small',
    defaultSettings: {
      actions: ['submit_directory', 'update_profile', 'view_analytics', 'contact_support'],
      layout: 'grid'
    },
    dataSource: '',
    category: 'system',
    icon: '⚡'
  },
  {
    id: 'custom-notes',
    name: 'Custom Notes',
    description: 'Personal notes and reminders',
    type: 'text',
    defaultSize: 'medium',
    defaultSettings: {
      editable: true,
      markdown: true,
      maxLength: 1000
    },
    dataSource: '/api/user/notes',
    category: 'system',
    icon: '📝'
  }
]

interface CustomDashboardProps {
  userId: string
  userTier: string
  widgets: CustomWidget[]
  onWidgetsChange: (widgets: CustomWidget[]) => void
  className?: string
}

export default function CustomDashboard({
  userId,
  userTier,
  widgets,
  onWidgetsChange,
  className = ''
}: CustomDashboardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false)
  const [selectedWidget, setSelectedWidget] = useState<CustomWidget | null>(null)
  const [gridLayout, setGridLayout] = useState<'fixed' | 'fluid'>('fluid')

  // Filter templates based on user tier
  const availableTemplates = WIDGET_TEMPLATES.filter(template => 
    !template.tierRequirement || template.tierRequirement.includes(userTier)
  )

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(widgets)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    onWidgetsChange(items)
  }

  const addWidget = (template: WidgetTemplate) => {
    const newWidget: CustomWidget = {
      id: `${template.id}-${Date.now()}`,
      type: template.type,
      title: template.name,
      description: template.description,
      size: template.defaultSize,
      position: { x: 0, y: widgets.length },
      data: {},
      settings: template.defaultSettings,
      refreshInterval: 300, // 5 minutes
      isVisible: true,
      isLocked: false
    }

    onWidgetsChange([...widgets, newWidget])
    setShowWidgetLibrary(false)
  }

  const removeWidget = (widgetId: string) => {
    onWidgetsChange(widgets.filter(w => w.id !== widgetId))
  }

  const updateWidget = (widgetId: string, updates: Partial<CustomWidget>) => {
    onWidgetsChange(widgets.map(w => 
      w.id === widgetId ? { ...w, ...updates } : w
    ))
  }

  const toggleWidgetVisibility = (widgetId: string) => {
    updateWidget(widgetId, { isVisible: !widgets.find(w => w.id === widgetId)?.isVisible })
  }

  const duplicateWidget = (widget: CustomWidget) => {
    const duplicate: CustomWidget = {
      ...widget,
      id: `${widget.id}-copy-${Date.now()}`,
      title: `${widget.title} (Copy)`,
      position: { x: 0, y: widgets.length }
    }
    onWidgetsChange([...widgets, duplicate])
  }

  const getSizeClasses = (size: CustomWidget['size']) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1'
      case 'medium': return 'col-span-2 row-span-1'
      case 'large': return 'col-span-2 row-span-2'
      case 'xl': return 'col-span-4 row-span-2'
      default: return 'col-span-2 row-span-1'
    }
  }

  return (
    <div className={`${className}`}>
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Custom Dashboard</h2>
          <p className="text-secondary-400">Personalize your workspace with custom widgets</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGridLayout(gridLayout === 'fixed' ? 'fluid' : 'fixed')}
            className="px-3 py-2 rounded-lg border border-secondary-600 text-secondary-300 hover:text-white transition-colors"
            title="Toggle Grid Layout"
          >
            {gridLayout === 'fixed' ? '📐' : '🌊'}
          </button>

          <button
            onClick={() => setShowWidgetLibrary(true)}
            className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
          >
            + Add Widget
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isEditing
                ? 'bg-success-500 hover:bg-success-400 text-white'
                : 'bg-secondary-700 hover:bg-secondary-600 text-secondary-300'
            }`}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Widgets Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`grid gap-6 ${
                gridLayout === 'fixed' 
                  ? 'grid-cols-4 auto-rows-fr' 
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}
            >
              {widgets.filter(w => w.isVisible).map((widget, index) => (
                <Draggable
                  key={widget.id}
                  draggableId={widget.id}
                  index={index}
                  isDragDisabled={!isEditing}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={provided.draggableProps.style}
                      className={`${
                        gridLayout === 'fixed' ? getSizeClasses(widget.size) : ''
                      }`}
                    >
                      <motion.div
                        layout
                        className={`bg-secondary-800 border border-secondary-700 rounded-xl relative ${
                          snapshot.isDragging ? 'shadow-2xl rotate-2' : ''
                        } ${
                          isEditing ? 'ring-2 ring-volt-500/50' : ''
                        }`}
                      >
                        {/* Widget Header */}
                        <div className="p-4 border-b border-secondary-700 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-white text-sm">{widget.title}</h3>
                            {widget.description && (
                              <p className="text-xs text-secondary-400 mt-1">{widget.description}</p>
                            )}
                          </div>

                          {isEditing && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedWidget(widget)}
                                className="text-secondary-400 hover:text-white p-1"
                                title="Settings"
                              >
                                ⚙️
                              </button>
                              <button
                                onClick={() => duplicateWidget(widget)}
                                className="text-secondary-400 hover:text-white p-1"
                                title="Duplicate"
                              >
                                📋
                              </button>
                              <button
                                onClick={() => removeWidget(widget.id)}
                                className="text-secondary-400 hover:text-red-400 p-1"
                                title="Remove"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Widget Content */}
                        <div className="p-4">
                          <WidgetRenderer widget={widget} userTier={userTier} />
                        </div>

                        {/* Last Updated */}
                        {widget.lastUpdated && (
                          <div className="absolute bottom-2 right-2 text-xs text-secondary-500">
                            Updated {new Date(widget.lastUpdated).toLocaleTimeString()}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Widget Library Modal */}
      <AnimatePresence>
        {showWidgetLibrary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowWidgetLibrary(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-secondary-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Widget Library</h3>
                    <p className="text-secondary-400 mt-1">Choose widgets to add to your dashboard</p>
                  </div>
                  <button
                    onClick={() => setShowWidgetLibrary(false)}
                    className="text-secondary-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Categories */}
                {['analytics', 'directories', 'seo', 'business', 'system'].map(category => {
                  const categoryTemplates = availableTemplates.filter(t => t.category === category)
                  if (categoryTemplates.length === 0) return null

                  return (
                    <div key={category} className="mb-8">
                      <h4 className="font-semibold text-white mb-4 capitalize">{category}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryTemplates.map(template => (
                          <div
                            key={template.id}
                            className="bg-secondary-700/50 border border-secondary-600 rounded-lg p-4 hover:border-volt-500/50 transition-colors cursor-pointer group"
                            onClick={() => addWidget(template)}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <span className="text-2xl">{template.icon}</span>
                              <div className="flex-1">
                                <h5 className="font-medium text-white group-hover:text-volt-400 transition-colors">
                                  {template.name}
                                </h5>
                                <p className="text-sm text-secondary-400 mt-1">
                                  {template.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="bg-secondary-600 text-secondary-300 px-2 py-1 rounded">
                                {template.defaultSize}
                              </span>
                              {template.tierRequirement && (
                                <span className="text-volt-400">
                                  {template.tierRequirement.join(' • ')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget Settings Modal */}
      <AnimatePresence>
        {selectedWidget && (
          <WidgetSettingsModal
            widget={selectedWidget}
            onSave={(updatedWidget) => {
              updateWidget(selectedWidget.id, updatedWidget)
              setSelectedWidget(null)
            }}
            onClose={() => setSelectedWidget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Widget Renderer Component
function WidgetRenderer({ widget, userTier }: { widget: CustomWidget; userTier: string }) {
  const [data, setData] = useState(widget.data)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch widget data based on type
  useEffect(() => {
    if (widget.type === 'action' || widget.type === 'text') return

    fetchWidgetData()
  }, [widget.id])

  const fetchWidgetData = async () => {
    setIsLoading(true)
    try {
      // Fetch data based on widget type and settings
      // This would connect to actual APIs in production
      setData({
        // Mock data for demo
        stats: { value: 42, change: 12, trend: 'up' },
        chartData: [10, 20, 30, 40, 50],
        listItems: ['Item 1', 'Item 2', 'Item 3']
      })
    } catch (error) {
      console.error('Failed to fetch widget data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-secondary-700 rounded"></div>
      </div>
    )
  }

  // Render different widget types
  switch (widget.type) {
    case 'stats':
      return (
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{data.stats?.value || 0}</div>
          <div className="text-sm text-secondary-400">Sample Metric</div>
        </div>
      )

    case 'chart':
      return (
        <div className="h-32 bg-secondary-700 rounded flex items-center justify-center">
          <span className="text-secondary-400">Chart Widget</span>
        </div>
      )

    case 'list':
      return (
        <div className="space-y-2">
          {(data.listItems || []).map((item: string, index: number) => (
            <div key={index} className="text-sm text-secondary-300 p-2 bg-secondary-700/50 rounded">
              {item}
            </div>
          ))}
        </div>
      )

    case 'text':
      return (
        <div className="text-sm text-secondary-300">
          Custom text content goes here. This widget can be edited.
        </div>
      )

    case 'action':
      return (
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-volt-500/20 text-volt-400 p-2 rounded text-sm">Action 1</button>
          <button className="bg-volt-500/20 text-volt-400 p-2 rounded text-sm">Action 2</button>
        </div>
      )

    default:
      return <div className="text-secondary-400">Unknown widget type</div>
  }
}

// Widget Settings Modal Component
function WidgetSettingsModal({
  widget,
  onSave,
  onClose
}: {
  widget: CustomWidget
  onSave: (widget: Partial<CustomWidget>) => void
  onClose: () => void
}) {
  const [settings, setSettings] = useState(widget.settings)
  const [title, setTitle] = useState(widget.title)
  const [size, setSize] = useState(widget.size)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-secondary-700">
          <h3 className="text-lg font-bold text-white">Widget Settings</h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
            />
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as CustomWidget['size'])}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-secondary-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, size, settings })}
            className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}