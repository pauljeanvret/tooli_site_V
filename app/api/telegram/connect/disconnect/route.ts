import { NextRequest, NextResponse } from 'next/server'
import { disconnectTelegram } from '@/lib/saas/telegram-store'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    await disconnectTelegram(auth.user.id)

    return NextResponse.json({
      ok: true,
      message: 'Telegram est déconnecté de Toolia.',
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Déconnexion Telegram impossible.' },
      { status: 500 },
    )
  }
}
