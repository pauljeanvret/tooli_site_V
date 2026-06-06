import { gmail_v1, google } from 'googleapis'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret } from '@/lib/server/crypto'
import { getGoogleOAuthClient, GOOGLE_GMAIL_SCOPES } from '@/lib/google/oauth'
import type { GmailLabelResult } from './schemas'

type GmailConnectionRow = {
  id: string
  user_id: string
  gmail_email: string | null
  google_email?: string | null
  google_account_id: string | null
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  scopes: string[] | null
  scope?: string | null
  expires_at?: string | null
  connected_at: string | null
  revoked_at: string | null
  status?: string | null
}

type GmailLabelColor = {
  textColor: string
  backgroundColor: string
}

type GmailLabelWarning = {
  name: string
  message: string
}

type GmailLabelTarget = {
  categoryId: string
  name: string
  color: GmailLabelColor
}

const GMAIL_LABEL_COLORS: Record<string, GmailLabelColor> = {
  clients: { textColor: '#ffffff', backgroundColor: '#4a86e8' },
  prospects: { textColor: '#ffffff', backgroundColor: '#8e63ce' },
  factures: { textColor: '#000000', backgroundColor: '#fad165' },
  urgences: { textColor: '#ffffff', backgroundColor: '#cc3a21' },
  administratif: { textColor: '#ffffff', backgroundColor: '#0b804b' },
  fournisseurs: { textColor: '#000000', backgroundColor: '#ffad47' },
  newsletters: { textColor: '#000000', backgroundColor: '#c6f3de' },
  publicites: { textColor: '#ffffff', backgroundColor: '#666666' },
  commandes: { textColor: '#ffffff', backgroundColor: '#16a766' },
  sav: { textColor: '#ffffff', backgroundColor: '#3c78d8' },
}

const FALLBACK_GMAIL_LABEL_COLORS: GmailLabelColor[] = [
  { textColor: '#ffffff', backgroundColor: '#4a86e8' },
  { textColor: '#ffffff', backgroundColor: '#8e63ce' },
  { textColor: '#000000', backgroundColor: '#ffad47' },
  { textColor: '#ffffff', backgroundColor: '#16a766' },
  { textColor: '#ffffff', backgroundColor: '#666666' },
]

function sanitizeGmailLabelName(value: string) {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'Label'
}

function canonicalizeLabelName(value: string) {
  return sanitizeGmailLabelName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getStableLabelColor(name: string) {
  const key = canonicalizeLabelName(name)
  const knownColor = GMAIL_LABEL_COLORS[key]
  if (knownColor) return knownColor

  const hash = [...key].reduce((total, char) => total + char.charCodeAt(0), 0)
  return FALLBACK_GMAIL_LABEL_COLORS[hash % FALLBACK_GMAIL_LABEL_COLORS.length]
}

function hasLabelColor(label: gmail_v1.Schema$Label) {
  return Boolean(label.color?.textColor && label.color?.backgroundColor)
}

async function patchLabelColor(
  gmail: gmail_v1.Gmail,
  labelId: string,
  labelName: string,
  color: GmailLabelColor,
  warnings: GmailLabelWarning[],
) {
  try {
    await gmail.users.labels.patch({
      userId: 'me',
      id: labelId,
      requestBody: { color },
    })
    return true
  } catch (error) {
    warnings.push({
      name: labelName,
      message: error instanceof Error ? error.message : 'Couleur non appliquee.',
    })
    return false
  }
}

export type GmailConnectionSummary = {
  connected: boolean
  googleEmail: string | null
  hasComposeScope: boolean
  hasReadScope: boolean
  hasModifyScope: boolean
  needsScopeUpgrade: boolean
}

export const GMAIL_COMPOSE_SCOPE = 'https://www.googleapis.com/auth/gmail.compose'
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const GMAIL_MODIFY_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

function getConnectionScopes(connection: Pick<GmailConnectionRow, 'scopes' | 'scope'> | null | undefined) {
  const scopes = new Set<string>()

  for (const scope of connection?.scopes || []) {
    if (scope) scopes.add(scope)
  }

  for (const scope of (connection?.scope || '').split(' ')) {
    if (scope) scopes.add(scope)
  }

  return [...scopes]
}

export function hasGmailComposeScope(connection: Pick<GmailConnectionRow, 'scopes' | 'scope'> | null | undefined) {
  return getConnectionScopes(connection).includes(GMAIL_COMPOSE_SCOPE)
}

export function hasGmailReadonlyScope(connection: Pick<GmailConnectionRow, 'scopes' | 'scope'> | null | undefined) {
  return getConnectionScopes(connection).includes(GMAIL_READONLY_SCOPE)
}

export function hasGmailModifyScope(connection: Pick<GmailConnectionRow, 'scopes' | 'scope'> | null | undefined) {
  return getConnectionScopes(connection).includes(GMAIL_MODIFY_SCOPE)
}

export function hasRequiredGmailScopes(connection: Pick<GmailConnectionRow, 'scopes' | 'scope'> | null | undefined) {
  return hasGmailComposeScope(connection) && hasGmailReadonlyScope(connection) && hasGmailModifyScope(connection)
}

export async function saveGmailConnection(input: {
  userId: string
  googleEmail: string
  googleAccountId: string | null
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
  scopes?: string[]
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur incomplète.')

  const now = new Date().toISOString()
  await supabase
    .from('gmail_connections')
    .update({ revoked_at: now, status: 'replaced', updated_at: now })
    .eq('user_id', input.userId)
    .is('revoked_at', null)

  const { error } = await supabase.from('gmail_connections').insert({
    user_id: input.userId,
    gmail_email: input.googleEmail,
    google_email: input.googleEmail,
    google_account_id: input.googleAccountId,
    access_token_encrypted: encryptSecret(input.accessToken),
    refresh_token_encrypted: encryptSecret(input.refreshToken),
    scopes: input.scopes?.length ? input.scopes : [...GOOGLE_GMAIL_SCOPES],
    scope: (input.scopes?.length ? input.scopes : [...GOOGLE_GMAIL_SCOPES]).join(' '),
    expires_at: input.expiresAt || null,
    token_type: 'Bearer',
    connected_at: now,
    revoked_at: null,
    status: 'connected',
  })

  if (error) throw error
}

export async function getConnectedGmailConnection(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const row = data as GmailConnectionRow | null
  if (!row?.connected_at || row.status === 'disconnected') return null

  return row
}

export async function getGmailConnectionSummary(userId: string): Promise<GmailConnectionSummary> {
  const connection = await getConnectedGmailConnection(userId)
  const connected = Boolean(connection)
  const hasCompose = hasGmailComposeScope(connection)
  const hasRead = hasGmailReadonlyScope(connection)
  const hasModify = hasGmailModifyScope(connection)

  return {
    connected,
    googleEmail: connection?.google_email || connection?.gmail_email || null,
    hasComposeScope: hasCompose,
    hasReadScope: hasRead,
    hasModifyScope: hasModify,
    needsScopeUpgrade: connected && (!hasCompose || !hasRead || !hasModify),
  }
}

export async function getOAuthClientForUser(userId: string) {
  const connection = await getConnectedGmailConnection(userId)
  if (!connection) throw new Error('Gmail n’est pas connecté.')

  const accessToken = decryptSecret(connection.access_token_encrypted)
  const refreshToken = decryptSecret(connection.refresh_token_encrypted)
  if (!accessToken && !refreshToken) throw new Error('Connexion Gmail incomplète.')

  const oauth2Client = getGoogleOAuthClient()
  oauth2Client.setCredentials({
    access_token: accessToken || undefined,
    refresh_token: refreshToken || undefined,
    expiry_date: connection.expires_at ? new Date(connection.expires_at).getTime() : undefined,
  })

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0
  if (refreshToken && expiresAt && expiresAt <= Date.now() + 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    const nextAccessToken = credentials.access_token || accessToken
    const nextExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : connection.expires_at
    const supabase = getSupabaseAdminClient()

    if (supabase && nextAccessToken) {
      await supabase
        .from('gmail_connections')
        .update({
          access_token_encrypted: encryptSecret(nextAccessToken),
          expires_at: nextExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
    }

    oauth2Client.setCredentials({
      access_token: nextAccessToken || undefined,
      refresh_token: refreshToken,
      expiry_date: credentials.expiry_date || undefined,
    })
  }

  return { oauth2Client, connection }
}

export async function getActiveAutomationLabelNames(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur incomplète.')

  const { data: profileRecord, error: profileError } = await supabase
    .from('automation_profiles')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profileRecord?.id) return []

  const { data: categories, error: categoryError } = await supabase
    .from('automation_categories')
    .select('id, label')
    .eq('automation_profile_id', profileRecord.id)

  if (categoryError) throw categoryError

  return (categories || []).map((category) => {
    const name = sanitizeGmailLabelName(String(category.label || 'Label'))

    return {
      categoryId: category.id as string,
      name,
      color: getStableLabelColor(name),
    }
  })
}

export async function ensureRealGmailLabels(userId: string) {
  const { oauth2Client } = await getOAuthClientForUser(userId)
  const labelTargets: GmailLabelTarget[] = await getActiveAutomationLabelNames(userId)
  if (!labelTargets.length) throw new Error('Aucune configuration active trouvée.')

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const list = await gmail.users.labels.list({ userId: 'me' })
  const existingLabels = list.data.labels || []
  const existingByCanonicalName = new Map<string, gmail_v1.Schema$Label>()

  for (const label of existingLabels) {
    if (!label.name) continue
    const key = canonicalizeLabelName(label.name)
    if (!existingByCanonicalName.has(key)) {
      existingByCanonicalName.set(key, label)
    }
  }

  const oldPrefixedLabelsDetected = existingLabels
    .map((label) => label.name)
    .filter((name): name is string => Boolean(name?.startsWith('Toolia/')))
    .sort((a, b) => a.localeCompare(b))

  const created: GmailLabelResult[] = []
  const existing: GmailLabelResult[] = []
  const updatedColors: GmailLabelResult[] = []
  const warnings: GmailLabelWarning[] = []
  const errors: Array<{ name: string; message: string }> = []

  for (const target of labelTargets) {
    const found = existingByCanonicalName.get(canonicalizeLabelName(target.name))
    if (found?.id) {
      const foundName = found.name || target.name
      existing.push({ id: found.id, name: foundName, created: false, mode: 'live' })

      if (!hasLabelColor(found)) {
        const updated = await patchLabelColor(gmail, found.id, foundName, target.color, warnings)
        if (updated) {
          updatedColors.push({ id: found.id, name: foundName, created: false, mode: 'live' })
        }
      }

      await updateLabelMapping(userId, target.categoryId, foundName, found.id, true)
      continue
    }

    try {
      let responseData: gmail_v1.Schema$Label

      try {
        const response = await gmail.users.labels.create({
          userId: 'me',
          requestBody: {
            name: target.name,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show',
            color: target.color,
          },
        })
        responseData = response.data
      } catch (colorError) {
        warnings.push({
          name: target.name,
          message: colorError instanceof Error ? colorError.message : 'Couleur non appliquée.',
        })

        const response = await gmail.users.labels.create({
          userId: 'me',
          requestBody: {
            name: target.name,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show',
          },
        })
        responseData = response.data
      }

      const id = responseData.id || target.name
      created.push({ id, name: target.name, created: true, mode: 'live' })
      existingByCanonicalName.set(canonicalizeLabelName(target.name), {
        id,
        name: target.name,
        color: target.color,
      })
      await updateLabelMapping(userId, target.categoryId, target.name, id, true)
    } catch (error) {
      errors.push({
        name: target.name,
        message: error instanceof Error ? error.message : 'Création impossible.',
      })
    }
  }

  return {
    created,
    existing,
    updatedColors,
    oldPrefixedLabelsDetected,
    warnings,
    errors,
  }
}

async function updateLabelMapping(
  userId: string,
  categoryId: string,
  labelName: string,
  labelId: string,
  createdInGmail: boolean,
) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const { data: current } = await supabase
    .from('gmail_label_mappings')
    .select('id')
    .eq('user_id', userId)
    .eq('automation_category_id', categoryId)
    .eq('gmail_label_name', labelName)
    .limit(1)
    .maybeSingle()

  if (current?.id) {
    await supabase
      .from('gmail_label_mappings')
      .update({
        gmail_label_id: labelId,
        created_in_gmail: createdInGmail,
      })
      .eq('id', current.id)
    return
  }

  await supabase.from('gmail_label_mappings').insert({
    user_id: userId,
    automation_category_id: categoryId,
    gmail_label_id: labelId,
    gmail_label_name: labelName,
    created_in_gmail: createdInGmail,
  })
}
