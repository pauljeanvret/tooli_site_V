import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createTelegramConnectionToken, getTelegramBotUsername } from '@/lib/saas/telegram-store'
import { getWorkerSubscriptionAccessForUser } from '@/lib/saas/subscription-store'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    const access = await getWorkerSubscriptionAccessForUser(auth.user.id)
    if (!access.allowed) {
      return NextResponse.json({ ok: false, message: 'Une offre active est nécessaire pour connecter Telegram.' }, { status: 403 })
    }

    if (access.planId === 'starter') {
      return NextResponse.json(
        { ok: false, message: 'Les alertes Telegram sont disponibles à partir de l’offre Pro.' },
        { status: 403 },
      )
    }

    const botUsername = getTelegramBotUsername()
    const missingTelegramEnvVars = [
      process.env.TELEGRAM_BOT_TOKEN?.trim() ? null : 'TELEGRAM_BOT_TOKEN',
      botUsername ? null : 'TELEGRAM_BOT_USERNAME',
    ].filter(Boolean)

    if (missingTelegramEnvVars.length) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[telegram/connect/start] missing env vars', { missingTelegramEnvVars })
      }

      return NextResponse.json(
        {
          ok: false,
          message: `Configuration Telegram incomplète : ${missingTelegramEnvVars.join(', ')} manquant.`,
        },
        { status: 500 },
      )
    }

    const connection = await createTelegramConnectionToken(auth.user.id)
    const qrCodeDataUrl = await QRCode.toDataURL(connection.botLink, {
      margin: 1,
      width: 240,
      color: {
        dark: '#0B1220',
        light: '#FFFFFF',
      },
    })

    return NextResponse.json({
      ok: true,
      botLink: connection.botLink,
      botUsername,
      startCommand: `/start ${connection.token}`,
      qrData: connection.botLink,
      qrCodeDataUrl,
      expiresAt: connection.expiresAt,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Connexion Telegram impossible.' },
      { status: 500 },
    )
  }
}
