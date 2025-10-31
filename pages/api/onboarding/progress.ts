import { NextRequest, NextResponse } from 'next/server'

interface ProgressData {
  userId: string
  currentStep: number
  data: Record<string, any>
  timestamp: string
}

// In-memory storage for demo (replace with database in production)
const progressData: Map<string, ProgressData> = new Map()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentStep, data } = body

    if (!userId || currentStep === undefined) {
      return NextResponse.json(
        { error: 'User ID and current step are required' },
        { status: 400 }
      )
    }

    const progressInfo: ProgressData = {
      userId,
      currentStep,
      data: data || {},
      timestamp: new Date().toISOString()
    }

    progressData.set(userId, progressInfo)

    // Log progress for monitoring
    console.log(`Onboarding progress saved for user ${userId}: step ${currentStep}`, data)

    return NextResponse.json({
      success: true,
      currentStep,
      timestamp: progressInfo.timestamp
    })
  } catch (error) {
    console.error('Error saving onboarding progress:', error)
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    )
  }
}

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
    const progress = progressData.get(userId)
    
    if (!progress) {
      return NextResponse.json({
        currentStep: 0,
        data: {},
        timestamp: null
      })
    }

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error retrieving progress:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve progress' },
      { status: 500 }
    )
  }
}