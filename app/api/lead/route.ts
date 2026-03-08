import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic validation
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: 'Nom et email requis' },
        { status: 400 }
      )
    }

    // Mock: Log to console (in production, you'd send this to Resend, Formspree, or your own backend)
    console.log('📧 Nouvelle demande de démo:', {
      timestamp: new Date().toISOString(),
      ...body,
    })

    // Mock response
    return NextResponse.json(
      {
        success: true,
        message: 'Merci pour votre demande. On vous recontacte sous 24h.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur lors du traitement du formulaire:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
