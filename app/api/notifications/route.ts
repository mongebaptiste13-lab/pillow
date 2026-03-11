import { NextRequest, NextResponse } from 'next/server'

/**
 * API route pour envoyer une notification push
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: notificationBody, userId } = body

    if (!title || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // TODO: Intégrer avec Firebase Cloud Messaging pour envoyer la notification
    console.log('Notification to send:', { title, notificationBody, userId })

    return NextResponse.json(
      { success: true, message: 'Notification envoyée' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
