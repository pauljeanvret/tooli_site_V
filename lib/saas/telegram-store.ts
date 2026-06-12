import crypto from 'crypto'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export type TelegramConnection = {
  connected: boolean
  enabled: boolean
  username: string | null
  connectedAt: string | null
  status: string
  chatId: string | null
}

export function getTelegramBotUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim()
}

export function hasTelegramBotConfig() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && getTelegramBotUsername())
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createConnectionToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function getTelegramTokenTtlMinutes() {
  const value = Number(process.env.TELEGRAM_CONNECTION_TOKEN_TTL_MINUTES || 15)
  return Number.isFinite(value) && value > 0 ? value : 15
}

export async function createTelegramConnectionToken(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur indisponible.')

  const username = getTelegramBotUsername()
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim() || !username) {
    throw new Error('Telegram n’est pas encore configuré côté serveur.')
  }

  const token = createConnectionToken()
  const expiresAt = new Date(Date.now() + getTelegramTokenTtlMinutes() * 60_000).toISOString()

  const { error } = await supabase.from('telegram_connection_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  })

  if (error) throw error

  return {
    token,
    expiresAt,
    botLink: `https://t.me/${username}?start=${encodeURIComponent(token)}`,
  }
}

export async function getTelegramConnection(userId: string): Promise<TelegramConnection> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return { connected: false, enabled: false, username: null, connectedAt: null, status: 'disconnected', chatId: null }
  }

  const { data } = await supabase
    .from('telegram_connections')
    .select('telegram_chat_id, chat_id_encrypted, telegram_username, username, telegram_connected_at, tested_at, telegram_enabled, enabled, telegram_connection_status')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const chatId = String(data?.telegram_chat_id || data?.chat_id_encrypted || '').trim() || null
  const connected = Boolean(chatId && (data?.telegram_enabled || data?.enabled))

  return {
    connected,
    enabled: Boolean(data?.telegram_enabled || data?.enabled),
    username: String(data?.telegram_username || data?.username || '').trim() || null,
    connectedAt: String(data?.telegram_connected_at || data?.tested_at || '').trim() || null,
    status: String(data?.telegram_connection_status || (connected ? 'connected' : 'disconnected')),
    chatId,
  }
}

async function upsertTelegramConnection(input: {
  userId: string
  chatId: string
  username?: string | null
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur indisponible.')

  const { data: existing } = await supabase
    .from('telegram_connections')
    .select('id')
    .eq('user_id', input.userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    telegram_chat_id: input.chatId,
    chat_id_encrypted: input.chatId,
    telegram_username: input.username || null,
    username: input.username || null,
    telegram_connected_at: new Date().toISOString(),
    telegram_enabled: true,
    enabled: true,
    telegram_connection_status: 'connected',
    tested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabase.from('telegram_connections').update(payload).eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('telegram_connections').insert({
    user_id: input.userId,
    ...payload,
  })
  if (error) throw error
}

export async function consumeTelegramConnectionToken(input: {
  token: string
  chatId: string
  username?: string | null
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur indisponible.')

  const { data: tokenRow, error } = await supabase
    .from('telegram_connection_tokens')
    .select('id,user_id,expires_at,consumed_at')
    .eq('token_hash', hashToken(input.token))
    .maybeSingle()

  if (error || !tokenRow?.id) return { ok: false as const, reason: 'invalid' as const }
  if (tokenRow.consumed_at) return { ok: false as const, reason: 'consumed' as const }
  if (new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return { ok: false as const, reason: 'expired' as const }

  await upsertTelegramConnection({
    userId: String(tokenRow.user_id),
    chatId: input.chatId,
    username: input.username || null,
  })

  const { error: updateError } = await supabase
    .from('telegram_connection_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  if (updateError) throw updateError

  return { ok: true as const, userId: String(tokenRow.user_id) }
}

export async function disconnectTelegram(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur indisponible.')

  const { error } = await supabase
    .from('telegram_connections')
    .update({
      telegram_chat_id: null,
      chat_id_encrypted: null,
      telegram_username: null,
      username: null,
      telegram_connected_at: null,
      telegram_enabled: false,
      enabled: false,
      telegram_connection_status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken) throw new Error('Telegram n’est pas configuré côté serveur.')

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || 'Envoi Telegram impossible.')
  }

  return String(data.result?.message_id || '')
}

export async function hasTelegramAlertForMessage(userId: string, gmailMessageId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return false

  const { data } = await supabase
    .from('telegram_alert_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('gmail_message_id', gmailMessageId)
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle()

  return Boolean(data?.id)
}

export async function logTelegramAlert(input: {
  userId: string
  gmailMessageId: string
  telegramMessageId?: string | null
  category?: string | null
  status: string
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  await supabase.from('telegram_alert_logs').upsert(
    {
      user_id: input.userId,
      gmail_message_id: input.gmailMessageId,
      telegram_message_id: input.telegramMessageId || null,
      category: input.category || null,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
      status: input.status,
    },
    { onConflict: 'user_id,gmail_message_id' },
  )
}
