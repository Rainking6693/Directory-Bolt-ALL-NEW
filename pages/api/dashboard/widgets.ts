import { NextRequest, NextResponse } from 'next/server'

interface CustomWidget {
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

interface DashboardLayout {
  userId: string
  widgets: CustomWidget[]
  layout: 'fixed' | 'fluid'
  theme: string
  lastModified: string
}

// In-memory storage for demo (replace with database in production)
const dashboardLayouts: Map<string, DashboardLayout> = new Map()

// Default widgets for new users
const getDefaultWidgets = (userTier: string): CustomWidget[] => {
  const baseWidgets: CustomWidget[] = [
    {
      id: 'quick-stats-default',
      type: 'stats',
      title: 'Quick Stats',
      description: 'Overview of key metrics',
      size: 'medium',
      position: { x: 0, y: 0 },
      data: {},
      settings: { 
        metrics: ['total_directories', 'live_listings', 'pending_submissions'],
        showPercentages: true 
      },
      refreshInterval: 300,
      isVisible: true
    },
    {
      id: 'submission-progress-default',
      type: 'chart',
      title: 'Submission Progress',
      description: 'Track directory submission progress',
      size: 'large',
      position: { x: 2, y: 0 },
      data: {},
      settings: { chartType: 'donut', showLabels: true },
      refreshInterval: 300,
      isVisible: true
    },
    {
      id: 'recent-activities-default',
      type: 'list',
      title: 'Recent Activities',
      description: 'Latest directory submissions',
      size: 'medium',
      position: { x: 0, y: 1 },
      data: {},
      settings: { itemCount: 5, showTimestamps: true },
      refreshInterval: 60,
      isVisible: true
    },
    {
      id: 'quick-actions-default',
      type: 'action',
      title: 'Quick Actions',
      description: 'Frequently used actions',
      size: 'small',
      position: { x: 2, y: 1 },
      data: {},
      settings: { 
        actions: ['submit_directory', 'update_profile', 'view_analytics'],
        layout: 'grid' 
      },
      isVisible: true
    }
  ]

  // Add tier-specific widgets
  if (userTier === 'professional' || userTier === 'enterprise') {
    baseWidgets.push({
      id: 'seo-performance-default',
      type: 'chart',
      title: 'SEO Performance',
      description: 'Track your SEO metrics',
      size: 'large',
      position: { x: 0, y: 2 },
      data: {},
      settings: { chartType: 'line', timeframe: '30d' },
      refreshInterval: 3600,
      isVisible: true
    })
  }

  if (userTier === 'enterprise') {
    baseWidgets.push({
      id: 'competitive-insights-default',
      type: 'chart',
      title: 'Competitive Insights',
      description: 'Compare with competitors',
      size: 'xl',
      position: { x: 0, y: 3 },
      data: {},
      settings: { chartType: 'bar', competitors: [] },
      refreshInterval: 3600,
      isVisible: true
    })
  }

  return baseWidgets
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const userTier = url.searchParams.get('userTier') || 'starter'

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  try {
    let layout = dashboardLayouts.get(userId)
    
    // Create default layout for new users
    if (!layout) {
      layout = {
        userId,
        widgets: getDefaultWidgets(userTier),
        layout: 'fluid',
        theme: 'default',
        lastModified: new Date().toISOString()
      }
      dashboardLayouts.set(userId, layout)
    }

    return NextResponse.json({
      success: true,
      layout
    })
  } catch (error) {
    console.error('Error retrieving dashboard layout:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve dashboard layout' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, widgets, layout: layoutType, theme } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const existingLayout = dashboardLayouts.get(userId)
    
    const updatedLayout: DashboardLayout = {
      userId,
      widgets: widgets || existingLayout?.widgets || [],
      layout: layoutType || existingLayout?.layout || 'fluid',
      theme: theme || existingLayout?.theme || 'default',
      lastModified: new Date().toISOString()
    }

    dashboardLayouts.set(userId, updatedLayout)

    // Log layout changes for analytics
    console.log(`Dashboard layout updated for user ${userId}:`, {
      widgetCount: updatedLayout.widgets.length,
      layout: updatedLayout.layout,
      visibleWidgets: updatedLayout.widgets.filter(w => w.isVisible).length
    })

    return NextResponse.json({
      success: true,
      layout: updatedLayout,
      message: 'Dashboard layout saved successfully'
    })
  } catch (error) {
    console.error('Error saving dashboard layout:', error)
    return NextResponse.json(
      { error: 'Failed to save dashboard layout' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, widgetId, updates } = body

    if (!userId || !widgetId) {
      return NextResponse.json(
        { error: 'User ID and widget ID are required' },
        { status: 400 }
      )
    }

    const layout = dashboardLayouts.get(userId)
    if (!layout) {
      return NextResponse.json(
        { error: 'Dashboard layout not found' },
        { status: 404 }
      )
    }

    // Update specific widget
    const updatedWidgets = layout.widgets.map(widget =>
      widget.id === widgetId 
        ? { ...widget, ...updates, lastUpdated: new Date().toISOString() }
        : widget
    )

    const updatedLayout = {
      ...layout,
      widgets: updatedWidgets,
      lastModified: new Date().toISOString()
    }

    dashboardLayouts.set(userId, updatedLayout)

    return NextResponse.json({
      success: true,
      layout: updatedLayout,
      message: 'Widget updated successfully'
    })
  } catch (error) {
    console.error('Error updating widget:', error)
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const widgetId = url.searchParams.get('widgetId')

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  try {
    if (widgetId) {
      // Delete specific widget
      const layout = dashboardLayouts.get(userId)
      if (!layout) {
        return NextResponse.json(
          { error: 'Dashboard layout not found' },
          { status: 404 }
        )
      }

      const updatedWidgets = layout.widgets.filter(widget => widget.id !== widgetId)
      const updatedLayout = {
        ...layout,
        widgets: updatedWidgets,
        lastModified: new Date().toISOString()
      }

      dashboardLayouts.set(userId, updatedLayout)

      return NextResponse.json({
        success: true,
        layout: updatedLayout,
        message: 'Widget deleted successfully'
      })
    } else {
      // Delete entire dashboard layout
      const deleted = dashboardLayouts.delete(userId)
      
      if (!deleted) {
        return NextResponse.json(
          { error: 'Dashboard layout not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Dashboard layout deleted successfully'
      })
    }
  } catch (error) {
    console.error('Error deleting dashboard layout/widget:', error)
    return NextResponse.json(
      { error: 'Failed to delete dashboard layout/widget' },
      { status: 500 }
    )
  }
}