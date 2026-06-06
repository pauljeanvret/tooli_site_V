import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { z } from 'zod'
import {
  ensureRealGmailLabels,
  getOAuthClientForUser,
  hasGmailModifyScope,
} from '@/lib/saas/gmail-store'
import { getGmailHeader } from '@/lib/saas/gmail-message-utils'
import { getPersistedSaasState } from '@/lib/saas/supabase-store'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePaidSaasRouteAccess } from '@/lib/saas/route-access'

const requestSchema = z
  .object({
    messageId: z.string().min(1).max(256),
    category: z.string().min(1).max(120),
  })
  .strict()

function jsonError(status: number, step: string, message: string) {
  return NextResponse.json({ ok: false, step, message }, { status })
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buildLabelMap(labels: Awaited<ReturnType<typeof ensureRealGmailLabels>>) {
  const map = new Map<string, string>()
  for (const label of [...labels.created, ...labels.existing, ...labels.updatedColors]) {
    if (label.name && label.id) map.set(normalizeName(label.name), label.id)
  }
  return map
}

async function getActiveProfileId(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const { data } = await supabase
    .from('automation_profiles')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.id || null
}

async function updateClassificationLog(input: {
  userId: string
  automationProfileId: string | null
  messageId: string
  threadId: string | null
  sender: string
  subject: string
  previousCategory: string | null
  category: string
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const processedAt = new Date().toISOString()
  const { data: existing } = await supabase
    .from('email_processing_logs')
    .select('id, predicted_category')
    .eq('user_id', input.userId)
    .eq('gmail_message_id', input.messageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    user_id: input.userId,
    automation_profile_id: input.automationProfileId,
    gmail_message_id: input.messageId,
    thread_id: input.threadId,
    sender: input.sender,
    subject: input.subject,
    predicted_category: input.category,
    confidence: 1,
    importance: 'normal',
    label_applied: true,
    draft_created: false,
    draft_id: null,
    category_key: null,
    action: 'label_only',
    status: 'processed',
    reason: 'Catégorie corrigée manuellement.',
    processed_at: processedAt,
    details: {
      type: 'manual_label_correction',
      previous_category: input.previousCategory || existing?.predicted_category || null,
      final_category: input.category,
      action_taken: 'Label appliqué manuellement',
      sent: false,
      permanentDelete: false,
      archiveApplied: false,
    },
  }

  if (existing?.id) {
    await supabase.from('email_processing_logs').update(payload).eq('id', existing.id)
    return
  }

  await supabase.from('email_processing_logs').insert(payload)
}

export async function POST(request: NextRequest) {
  const access = await requirePaidSaasRouteAccess(
    request,
    'Un abonnement Toolia actif est requis pour appliquer un label Gmail.',
  )
  if (access.response) return access.response
  const user = access.user
  if (!user?.id) {
    return jsonError(401, 'auth', 'Connectez-vous avant d’appliquer un label.')
  }

  try {
    const body = requestSchema.parse(await request.json())
    const persistedState = await getPersistedSaasState(user.id)
    if (!persistedState?.profile) {
      return jsonError(400, 'profile', 'Aucune configuration Toolia active trouvée.')
    }

    const category = persistedState.profile.categories.find((item) => item.name === body.category)
    if (!category) {
      return jsonError(400, 'category', 'Catégorie inconnue.')
    }

    const { oauth2Client, connection } = await getOAuthClientForUser(user.id)
    if (!hasGmailModifyScope(connection)) {
      return jsonError(403, 'gmail_scope', 'Autorisation Gmail à mettre à jour.')
    }

    const labels = await ensureRealGmailLabels(user.id)
    const labelId = buildLabelMap(labels).get(normalizeName(category.name))
    if (!labelId) {
      return jsonError(400, 'label_mapping', 'Mapping Gmail introuvable pour cette catégorie.')
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    await gmail.users.messages.modify({
      userId: 'me',
      id: body.messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    })

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: body.messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject'],
    })
    const automationProfileId = await getActiveProfileId(user.id)

    await updateClassificationLog({
      userId: user.id,
      automationProfileId,
      messageId: body.messageId,
      threadId: message.data.threadId || null,
      sender: getGmailHeader(message.data, 'From'),
      subject: getGmailHeader(message.data, 'Subject') || '(Sans objet)',
      previousCategory: null,
      category: category.name,
    })

    return NextResponse.json({
      ok: true,
      message: 'Label appliqué.',
      category: category.name,
      labelApplied: true,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(400, 'request_validation', 'Demande invalide.')
    }

    console.error('[gmail/classification/apply-label] Failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id,
    })

    return jsonError(500, 'server_exception', 'Erreur lors de l’application du label.')
  }
}
