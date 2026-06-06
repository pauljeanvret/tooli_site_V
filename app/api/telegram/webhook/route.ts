import { NextRequest, NextResponse } from 'next/server'
import { consumeTelegramConnectionToken, sendTelegramMessage } from '@/lib/saas/telegram-store'

type TelegramWebhookUpdate = {
  message?: {
    text?: string
    chat?: { id?: number | string }
    from?: { username?: string }
  }
}

function validateTelegramWebhookSecret(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!expected) return true
  return request.headers.get('x-telegram-bot-api-secret-token') === expected
}

function extractStartToken(text: string | undefined) {
  const match = (text || '').trim().match(/^\/start(?:@\S+)?\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export async function POST(request: NextRequest) {
  if (!validateTelegramWebhookSecret(request)) {
    return NextResponse.json({ ok: false, message: 'Webhook Telegram refusé.' }, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as TelegramWebhookUpdate | null
  const message = update?.message
  const chatId = message?.chat?.id ? String(message.chat.id) : ''
  const token = extractStartToken(message?.text)

  if (!chatId || !token) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const result = await consumeTelegramConnectionToken({
      token,
      chatId,
      username: message?.from?.username || null,
    })

    if (!result.ok) {
      await sendTelegramMessage(
        chatId,
        'Ce lien de connexion Toolia a expiré. Retournez sur Toolia pour en générer un nouveau.',
      )
      return NextResponse.json({ ok: true, connected: false, reason: result.reason })
    }

    await sendTelegramMessage(
      chatId,
      '✅ Telegram est connecté à Toolia. Vous recevrez ici vos alertes importantes.',
    )

    return NextResponse.json({ ok: true, connected: true })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[telegram/webhook] failed', {
        message: error instanceof Error ? error.message : 'unknown',
        hasChatId: Boolean(chatId),
      })
    }

    return NextResponse.json({ ok: false, message: 'Traitement Telegram impossible.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Webhook Telegram Toolia prêt.' })
}
