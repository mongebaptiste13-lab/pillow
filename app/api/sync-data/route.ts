import { NextRequest, NextResponse } from 'next/server'

/**
 * API route pour synchroniser les données offline
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pillLogs, cycleEntries, userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      )
    }

    console.log('Syncing data:', { userId, pillLogs, cycleEntries })

    // TODO: Intégrer avec Supabase pour synchroniser les données
    // - Sauvegarder les pill logs
    // - Sauvegarder les cycle entries

    return NextResponse.json(
      { success: true, message: 'Données synchronisées' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error syncing data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
