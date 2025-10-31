import { NextRequest, NextResponse } from 'next/server'

interface CompletionData {
  userId: string
  data: Record<string, any>
  completedAt: string
  completed: boolean
}

// In-memory storage for demo (replace with database in production)
const completedOnboarding: Map<string, CompletionData> = new Map()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, data } = body

    if (!userId || !data) {
      return NextResponse.json(
        { error: 'User ID and data are required' },
        { status: 400 }
      )
    }

    const completionInfo: CompletionData = {
      userId,
      data: {
        ...data,
        completed: true,
        completedAt: data.completedAt || new Date().toISOString()
      },
      completedAt: new Date().toISOString(),
      completed: true
    }

    completedOnboarding.set(userId, completionInfo)

    // Log completion for analytics
    console.log(`Onboarding completed for user ${userId}`, {
      userTier: data.userTier,
      businessName: data.businessName,
      industry: data.industry,
      goals: data.goals,
      completedAt: completionInfo.completedAt
    })

    // Here you would typically:
    // 1. Update user profile in database
    // 2. Send welcome email
    // 3. Trigger initial AI analysis
    // 4. Set up user dashboard
    // 5. Start directory submission process

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: completionInfo.data
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
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
    const completion = completedOnboarding.get(userId)
    
    if (!completion) {
      return NextResponse.json({
        completed: false,
        data: null
      })
    }

    return NextResponse.json({
      completed: true,
      data: completion.data,
      completedAt: completion.completedAt
    })
  } catch (error) {
    console.error('Error retrieving completion status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve completion status' },
      { status: 500 }
    )
  }
}