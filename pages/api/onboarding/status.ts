import { NextRequest, NextResponse } from 'next/server'

interface OnboardingData {
  userId: string
  businessName?: string
  website?: string
  industry?: string
  description?: string
  location?: string
  phoneNumber?: string
  targetAudience?: string
  goals?: string[]
  priority?: string
  timeline?: string
  additionalNotes?: string
  discoveredFeatures?: string[]
  interestedFeatures?: string[]
  userTier?: string
  completed?: boolean
  skipped?: boolean
  completedAt?: string
  currentStep?: number
  skippedSteps?: string[]
}

// In-memory storage for demo (replace with database in production)
const onboardingData: Map<string, OnboardingData> = new Map()

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
    const userData = onboardingData.get(userId)
    
    if (!userData) {
      return NextResponse.json({
        completed: false,
        data: null
      })
    }

    return NextResponse.json({
      completed: userData.completed || false,
      data: userData
    })
  } catch (error) {
    console.error('Error checking onboarding status:', error)
    return NextResponse.json(
      { error: 'Failed to check onboarding status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, data } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
    )
    }

    // Merge with existing data
    const existingData = onboardingData.get(userId) || {}
    const updatedData = { ...existingData, ...data, userId }

    onboardingData.set(userId, updatedData)

    return NextResponse.json({
      success: true,
      data: updatedData
    })
  } catch (error) {
    console.error('Error saving onboarding status:', error)
    return NextResponse.json(
      { error: 'Failed to save onboarding status' },
      { status: 500 }
    )
  }
}