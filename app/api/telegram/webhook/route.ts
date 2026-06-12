import { NextRequest, NextResponse } from 'next/server'
import { consumeTelegramConnectionToken, sendTelegramMessage } from '@/lib/saas/telegram-store'

type TelegramWebhookUpdate = {
  message?: {
    text?: string
    chat?: { id?: number | string; username?: string; first_name?: string }
    from?: { username?: string; first_name?: string }
  }
}

function logTelegramWebhook(event: string, details: Record<string, unknown>) {
  console.log(`[telegram:webhook] ${event}`, details)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function sanitizeTelegramText(text: string | undefined) {
  const raw = (text || '').trim()
  if (!raw) return null
  if (extractStartToken(raw)) return raw.replace(/^(\/start(?:@\S+)?(?:\s+|=))(\S+)/i, '$1[payload-redacted]')
  return raw.slice(0, 160)
}

function validateTelegramWebhookSecret(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!expected) return true
  return request.headers.get('x-telegram-bot-api-secret-token') === expected
}

function extractStartToken(text: string | undefined) {
  const match = (text || '').trim().match(/^\/start(?:@\S+)?(?:\s+|=)(\S+)/i)
  return match?.[1]?.trim() || null
}

function isStartCommand(text: string | undefined) {
  return /^\/start(?:@\S+)?(?:\s|=|$)/i.test((text || '').trim())
}

export async function POST(request: NextRequest) {
  if (!validateTelegramWebhookSecret(request)) {
    logTelegramWebhook('invalid secret header', {
      hasExpectedSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
      hasProvidedSecret: Boolean(request.headers.get('x-telegram-bot-api-secret-token')),
    })

    return NextResponse.json({ ok: false, message: 'Webhook Telegram refusé.' }, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as TelegramWebhookUpdate | null
  const message = update?.message
  const chatId = message?.chat?.id ? String(message.chat.id) : ''
  const token = extractStartToken(message?.text)

  logTelegramWebhook('received update', {
    hasMessage: Boolean(message),
    text: sanitizeTelegramText(message?.text),
    chatId: message?.chat?.id || null,
    username: message?.chat?.username || message?.from?.username || null,
    firstName: message?.chat?.first_name || message?.from?.first_name || null,
  })

  logTelegramWebhook('parsed start payload', {
    hasPayload: Boolean(token),
    payloadLength: token?.length || 0,
  })

  if (!chatId) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    if (!token) {
      if (isStartCommand(message?.text)) {
        await sendTelegramMessage(
          chatId,
          'Pour connecter Telegram à Toolia, ouvrez le QR code depuis Toolia ou envoyez la commande complète /start affichée dans votre tableau de bord.',
        )
        logTelegramWebhook('missing start payload', {
          chatId,
          reason: 'start_command_without_payload',
        })
        return NextResponse.json({ ok: true, ignored: true, reason: 'missing_start_token' })
      }

      return NextResponse.json({ ok: true, ignored: true })
    }

    const result = await consumeTelegramConnectionToken({
      token,
      chatId,
      username: message?.from?.username || null,
    })

    if (!result.ok) {
      logTelegramWebhook('link result', {
        success: false,
        reason: result.reason,
        chatId,
      })

      await sendTelegramMessage(
        chatId,
        'Ce lien de connexion Toolia a expiré. Retournez sur Toolia pour en générer un nouveau.',
      )
      return NextResponse.json({ ok: true, connected: false, reason: result.reason })
    }

    try {
      await sendTelegramMessage(
        chatId,
        '✅ Telegram est connecté à Toolia. Vous recevrez ici vos alertes importantes.',
      )
    } catch (sendError) {
      console.error('[telegram:webhook] confirmation send failed', {
        message: errorMessage(sendError),
        userId: result.userId,
        chatId,
      })

      logTelegramWebhook('link result', {
        success: true,
        userId: result.userId,
        profileId: result.userId,
        chatId,
        confirmationSent: false,
      })

      return NextResponse.json({ ok: true, connected: true, confirmationSent: false })
    }

    logTelegramWebhook('link result', {
      success: true,
      userId: result.userId,
      profileId: result.userId,
      chatId,
      confirmationSent: true,
    })

    return NextResponse.json({ ok: true, connected: true })
  } catch (error) {
    console.error('[telegram:webhook] error', {
      message: errorMessage(error),
      hasChatId: Boolean(chatId),
    })

    return NextResponse.json({ ok: false, message: 'Traitement Telegram impossible.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Webhook Telegram Toolia prêt.' })
}
