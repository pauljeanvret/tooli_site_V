import { NextRequest, NextResponse } from 'next/server'
import { checkQuota, recordUsage } from '@/lib/saas/plan-limits'
import { getWorkerSubscriptionAccessForUser } from '@/lib/saas/subscription-store'
import { getTelegramConnection, sendTelegramMessage } from '@/lib/saas/telegram-store'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    const access = await getWorkerSubscriptionAccessForUser(auth.user.id)
    if (!access.allowed) {
      return NextResponse.json({ ok: false, message: 'Une offre active est nécessaire pour envoyer une alerte Telegram.' }, { status: 403 })
    }

    if (access.planId === 'starter') {
      return NextResponse.json(
        { ok: false, message: 'Les alertes Telegram sont disponibles à partir de l’offre Pro.' },
        { status: 403 },
      )
    }

    const connection = await getTelegramConnection(auth.user.id)
    if (!connection.connected || !connection.chatId) {
      return NextResponse.json({
        ok: false,
        message: 'Connectez Telegram avant d’envoyer une alerte test.',
      })
    }

    const quota = await checkQuota(auth.user.id, 'telegram_alert', 1)
    if (!quota.allowed) {
      return NextResponse.json({
        ok: false,
        message: 'Votre limite mensuelle d’alertes Telegram est atteinte.',
      })
    }

    const telegramMessageId = await sendTelegramMessage(
      connection.chatId,
      '✅ Test Toolia réussi\nVos alertes Telegram sont bien connectées.',
    )

    await recordUsage(auth.user.id, 'telegram_alert', 1, { source: 'dashboard' })

    return NextResponse.json({
      ok: true,
      sent: true,
      telegramMessageId,
      message: 'Alerte test envoyée dans Telegram.',
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Envoi Telegram impossible.' },
      { status: 500 },
    )
  }
}
