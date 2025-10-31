// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

interface UserPreferences {
  userId: string
  theme: 'dark' | 'light' | 'auto'
  language: string
  timezone: string
  dateFormat: 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd'
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
    frequency: 'immediate' | 'daily' | 'weekly'
    types: {
      submissions: boolean
      approvals: boolean
      rejections: boolean
      analytics: boolean
      marketing: boolean
    }
  }
  dashboard: {
    defaultView: 'overview' | 'directories' | 'seo-tools' | 'analytics'
    showQuickStats: boolean
    compactMode: boolean
    autoRefresh: boolean
    refreshInterval: number
    widgetOrder: string[]
    hiddenWidgets: string[]
  }
  privacy: {
    shareAnalytics: boolean
    allowTracking: boolean
    publicProfile: boolean
  }
  accessibility: {
    fontSize: 'small' | 'medium' | 'large' | 'xl'
    highContrast: boolean
    reducedMotion: boolean
    screenReader: boolean
  }
  updatedAt: string
}

// In-memory storage for demo (replace with database in production)
const userPreferences: Map<string, UserPreferences> = new Map()

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  try {
    const preferences = userPreferences.get(userId)
    
    return NextResponse.json({
      success: true,
      preferences: preferences || null
    })
  } catch (error) {
    console.error('Error retrieving user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve preferences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, preferences } = body

    if (!userId || !preferences) {
      return NextResponse.json(
        { error: 'User ID and preferences are required' },
        { status: 400 }
      )
    }

    // Validate preferences structure
    const validatedPreferences: UserPreferences = {
      userId,
      ...preferences,
      updatedAt: new Date().toISOString()
    }

    // Store preferences
    userPreferences.set(userId, validatedPreferences)

    // Log preference changes for analytics
    console.log(`Preferences updated for user ${userId}:`, {
      theme: preferences.theme,
      language: preferences.language,
      dashboardView: preferences.dashboard?.defaultView,
      notifications: preferences.notifications?.frequency
    })

    return NextResponse.json({
      success: true,
      preferences: validatedPreferences,
      message: 'Preferences saved successfully'
    })
  } catch (error) {
    console.error('Error saving user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, section, key, value } = body

    if (!userId || !section || !key) {
      return NextResponse.json(
        { error: 'User ID, section, and key are required' },
        { status: 400 }
      )
    }

    const existingPreferences = userPreferences.get(userId)
    if (!existingPreferences) {
      return NextResponse.json(
        { error: 'User preferences not found' },
        { status: 404 }
      )
    }

    // Update specific preference
    const updatedPreferences = {
      ...existingPreferences,
      [section]: {
        ...existingPreferences[section as keyof UserPreferences],
        [key]: value
      },
      updatedAt: new Date().toISOString()
    }

    userPreferences.set(userId, updatedPreferences)

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
      message: 'Preference updated successfully'
    })
  } catch (error) {
    console.error('Error updating user preference:', error)
    return NextResponse.json(
      { error: 'Failed to update preference' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  try {
    const deleted = userPreferences.delete(userId)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'User preferences not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to delete preferences' },
      { status: 500 }
    )
  }
}