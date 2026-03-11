import { NextRequest, NextResponse } from 'next/server'

/**
 * API route pour enregistrer la prise de pilule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, date } = body

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // TODO: Intégrer avec Supabase pour sauvegarder la prise de pilule
    console.log('Pill logged:', { userId, date })

    return NextResponse.json(
      { success: true, message: 'Pilule enregistrée' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error logging pill:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
