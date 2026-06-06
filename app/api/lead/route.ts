import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: 'Nom et email requis.' },
        { status: 400 },
      )
    }

    console.log('Nouvelle demande Toolia:', {
      timestamp: new Date().toISOString(),
      ...body,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Merci pour votre message. Nous reviendrons vers vous dès que possible.',
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Erreur lors du traitement du formulaire:', error)
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 },
    )
  }
}
