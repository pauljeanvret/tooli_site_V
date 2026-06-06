import { NextRequest, NextResponse } from 'next/server'
import { google, type gmail_v1 } from 'googleapis'
import { z } from 'zod'
import { classifyIncomingEmail, cleanAiDraftBody } from '@/lib/ai/provider'
import { base64UrlEncode, buildGmailDraftMime } from '@/lib/saas/gmail-draft-mime'
import {
  ensureRealGmailLabels,
  getOAuthClientForUser,
  hasGmailModifyScope,
} from '@/lib/saas/gmail-store'
import {
  extractGmailMessageText,
  getGmailHeader,
  isLikelyAutomatedMessage,
} from '@/lib/saas/gmail-message-utils'
import { buildThreadContextForAI } from '@/lib/saas/gmail-thread'
import { getPersistedSaasState, getWritingStyleProfile } from '@/lib/saas/supabase-store'
import { checkQuota, getMonthlyUsageSnapshot, recordUsage } from '@/lib/saas/plan-limits'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePaidSaasRouteAccess } from '@/lib/saas/route-access'

const requestSchema = z
  .object({
    limit: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(5),
    includeAlreadyAnalyzed: z.boolean().default(false),
    messageId: z.string().min(1).max(256).optional(),
  })
  .strict()

type ClassificationCard = {
  messageId: string
  threadId: string | null
  sender: string
  subject: string
  category: string
  confidence: number
  importance: string
  status: 'processed' | 'needs_review' | 'skipped' | 'error'
  labelApplied: boolean
  draftCreated: boolean
  draftId: string | null
  reason: string
  skipReason?: string | null
  actionTaken: string
  threadContextUsed: boolean
  availableCategories: Array<{
    name: string
    description: string
    actions: string[]
  }>
  labelMappingStatus: 'verified' | 'created_or_verified' | 'missing' | 'not_needed'
  labelMappingWarning?: string | null
  previousCategory?: string | null
}

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

function categoryDescriptionFallback(name: string) {
  const key = normalizeName(name)
  const defaults: Record<string, string> = {
    clients: 'Emails de clients existants : questions, suivi, projets, support.',
    prospects: 'Demandes de nouveaux clients potentiels : tarifs, disponibilités, devis.',
    factures: 'Factures, paiements, comptabilité, reçus et justificatifs.',
    urgences: 'Messages sensibles ou bloquants : délai court, client mécontent, juridique, sécurité.',
    administratif: 'Documents, comptes, démarches, messages officiels ou organisation générale.',
    fournisseurs: 'Messages de partenaires, prestataires, achats ou fournisseurs.',
    commandes: 'Commandes, suivi de livraison, achats ou demandes liées à une transaction.',
    sav: 'Support après-vente, problème client, réclamation ou demande d’aide.',
    newsletters: 'Emails d’information, newsletters et contenus récurrents.',
    publicites: 'Promotions, publicités et prospection non prioritaire.',
  }

  return defaults[key] || `Emails correspondant au label Gmail “${name}”.`
}

function enabledActions(actions: Record<string, boolean>) {
  return Object.entries(actions)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
}

function extractEmailAddress(header: string) {
  const match = header.match(/<([^>]+)>/)
  return (match?.[1] || header).split(',')[0]?.trim() || header.trim()
}

function naturalReplySubject(subject: string) {
  const cleaned = subject.replace(/^\s*(re|fw|fwd)\s*:\s*/i, '').trim()
  return cleaned ? `Re: ${cleaned}` : 'Re: Votre message'
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

async function getExistingLog(userId: string, messageId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const { data } = await supabase
    .from('email_processing_logs')
    .select('id, predicted_category, draft_created, draft_id, thread_id')
    .eq('user_id', userId)
    .eq('gmail_message_id', messageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}

async function getAlreadyProcessedMessageIds(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return new Set<string>()

  const { data } = await supabase
    .from('email_processing_logs')
    .select('gmail_message_id')
    .eq('user_id', userId)
    .not('gmail_message_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)

  return new Set((data || []).map((row) => row.gmail_message_id).filter(Boolean) as string[])
}

async function hasExistingDraftLog(userId: string, messageId: string, threadId: string | null | undefined) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return false

  let query = supabase
    .from('email_processing_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('draft_created', true)
    .limit(1)

  if (threadId) query = query.eq('thread_id', threadId)
  else query = query.eq('gmail_message_id', messageId)

  const { data } = await query.maybeSingle()
  return Boolean(data?.id)
}

async function logClassification(input: {
  userId: string
  automationProfileId: string | null
  result: ClassificationCard
  categoryKey?: string | null
  updateExisting?: boolean
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const processedAt = new Date().toISOString()
  const existing = input.updateExisting ? await getExistingLog(input.userId, input.result.messageId) : null
  const payload = {
    user_id: input.userId,
    automation_profile_id: input.automationProfileId,
    gmail_message_id: input.result.messageId,
    thread_id: input.result.threadId,
    sender: input.result.sender,
    subject: input.result.subject,
    predicted_category: input.result.category,
    confidence: input.result.confidence,
    importance: input.result.importance,
    label_applied: input.result.labelApplied,
    draft_created: input.result.draftCreated,
    draft_id: input.result.draftId,
    category_key: input.categoryKey || null,
    action: input.result.draftCreated ? 'draft_reply' : input.result.labelApplied ? 'label_only' : null,
    status: input.result.status,
    reason: input.result.reason,
    skipped_reason: input.result.skipReason || null,
    processed_at: processedAt,
    details: {
      type: 'manual_classification',
      reason: input.result.reason,
      skipped_reason: input.result.skipReason || null,
      previous_category: input.result.previousCategory || existing?.predicted_category || null,
      final_category: input.result.category,
      action_taken: input.result.actionTaken,
      thread_context_used: input.result.threadContextUsed,
      available_categories: input.result.availableCategories,
      label_mapping_status: input.result.labelMappingStatus,
      label_mapping_warning: input.result.labelMappingWarning || null,
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

function buildLabelMap(labels: Awaited<ReturnType<typeof ensureRealGmailLabels>>) {
  const map = new Map<string, string>()
  for (const label of [...labels.created, ...labels.existing, ...labels.updatedColors]) {
    if (label.name && label.id) map.set(normalizeName(label.name), label.id)
  }
  return map
}

async function createReplyDraft(input: {
  gmail: gmail_v1.Gmail
  message: gmail_v1.Schema$Message
  to: string
  subject: string
  body: string
}) {
  const messageIdHeader = getGmailHeader(input.message, 'Message-ID')
  const references = [getGmailHeader(input.message, 'References'), messageIdHeader].filter(Boolean).join(' ')
  const raw = buildGmailDraftMime({
    to: input.to,
    subject: input.subject,
    body: cleanAiDraftBody(input.body),
    testDraft: false,
    inReplyTo: messageIdHeader || undefined,
    references: references || undefined,
  })

  const response = await input.gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: base64UrlEncode(raw),
        threadId: input.message.threadId || undefined,
      },
    },
  })

  return response.data.id || null
}

function makeSkippedCard(input: {
  message: gmail_v1.Schema$Message
  fallbackId: string
  sender: string
  subject: string
  skipReason: string
  availableCategories: ClassificationCard['availableCategories']
  previousCategory?: string | null
}) {
  return {
    messageId: input.message.id || input.fallbackId,
    threadId: input.message.threadId || null,
    sender: input.sender,
    subject: input.subject,
    category: input.previousCategory || 'Non analysé',
    confidence: 0,
    importance: 'low',
    status: 'skipped' as const,
    labelApplied: false,
    draftCreated: false,
    draftId: null,
    reason: input.skipReason,
    skipReason: input.skipReason,
    actionTaken: 'Ignoré',
    threadContextUsed: false,
    availableCategories: input.availableCategories,
    labelMappingStatus: 'not_needed' as const,
    previousCategory: input.previousCategory || null,
  }
}

export async function POST(request: NextRequest) {
  const access = await requirePaidSaasRouteAccess(
    request,
    'Un abonnement Toolia actif est requis pour analyser vos emails.',
  )
  if (access.response) return access.response
  const user = access.user
  if (!user?.id) {
    return jsonError(401, 'auth', 'Connectez-vous avant d’analyser vos emails.')
  }

  let analyzed = 0
  let labelsApplied = 0
  let draftsCreated = 0
  let needsReview = 0
  let skipped = 0
  let quotaNotice = ''

  try {
    const requestBody = requestSchema.parse(await request.json().catch(() => ({})))
    const persistedState = await getPersistedSaasState(user.id)
    if (!persistedState?.profile) {
      return jsonError(400, 'profile', 'Aucune configuration Toolia active trouvée.')
    }

    const { oauth2Client, connection } = await getOAuthClientForUser(user.id)
    if (!hasGmailModifyScope(connection)) {
      return jsonError(403, 'gmail_scope', 'Autorisation Gmail à mettre à jour.')
    }

    const analysisQuota = await checkQuota(user.id, 'email_analysis', requestBody.messageId ? 1 : requestBody.limit)
    if (!analysisQuota.partiallyAllowed) {
      return NextResponse.json(
        {
          ok: false,
          step: 'quota',
          message: 'Votre limite mensuelle est atteinte pour cette action.',
          upgradeRequired: true,
          usage: analysisQuota.snapshot,
        },
        { status: 403 },
      )
    }

    const effectiveLimit = requestBody.messageId ? 1 : analysisQuota.allowedAmount
    if (!requestBody.messageId && effectiveLimit < requestBody.limit) {
      quotaNotice = `Il vous reste ${effectiveLimit} analyses email ce mois-ci. Toolia va analyser ${effectiveLimit} emails maximum.`
    }

    const availableCategories = persistedState.profile.categories.map((category) => ({
      name: category.name,
      description: category.description?.trim() || categoryDescriptionFallback(category.name),
      actions: enabledActions(category.actions),
    }))

    const labelResult = await ensureRealGmailLabels(user.id)
    const labelMap = buildLabelMap(labelResult)
    const writingStyleProfile = await getWritingStyleProfile(user.id)
    const automationProfileId = await getActiveProfileId(user.id)
    const processedIds = requestBody.includeAlreadyAnalyzed ? new Set<string>() : await getAlreadyProcessedMessageIds(user.id)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const messageRefs = requestBody.messageId
      ? [{ id: requestBody.messageId }]
      : (
          await gmail.users.messages.list({
            userId: 'me',
            q: 'in:inbox -in:sent -in:spam -in:trash',
            maxResults: Math.min(effectiveLimit * 3, 50),
          })
        ).data.messages || []

    if (!messageRefs.length) {
      return jsonError(404, 'no_messages', 'Aucun email récent trouvé.')
    }

    const results: ClassificationCard[] = []

    for (const messageRef of messageRefs) {
      if (results.length >= effectiveLimit) break
      if (!messageRef.id) continue

      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: messageRef.id,
        format: 'full',
      })
      const message = messageResponse.data
      const sender = getGmailHeader(message, 'From')
      const subject = getGmailHeader(message, 'Subject') || '(Sans objet)'
      const existingLog = await getExistingLog(user.id, message.id || messageRef.id)

      if (processedIds.has(messageRef.id)) {
        const skippedCard = makeSkippedCard({
          message,
          fallbackId: messageRef.id,
          sender,
          subject,
          skipReason: 'Email déjà analysé. Cochez “Inclure les emails déjà analysés” pour le reclasser.',
          availableCategories,
          previousCategory: existingLog?.predicted_category || null,
        })
        results.push(skippedCard)
        skipped += 1
        continue
      }

      const body = extractGmailMessageText(message)
      if (!body || body.length < 20 || isLikelyAutomatedMessage(message, body)) {
        const skippedCard = makeSkippedCard({
          message,
          fallbackId: messageRef.id,
          sender,
          subject,
          skipReason: !body || body.length < 20 ? 'Email trop court pour une analyse fiable.' : 'Email probablement automatique ou newsletter.',
          availableCategories,
          previousCategory: existingLog?.predicted_category || null,
        })
        results.push(skippedCard)
        skipped += 1
        await logClassification({
          userId: user.id,
          automationProfileId,
          result: skippedCard,
          updateExisting: requestBody.includeAlreadyAnalyzed,
        })
        continue
      }

      let threadContext: ReturnType<typeof buildThreadContextForAI> | null = null
      if (message.threadId) {
        const threadResponse = await gmail.users.threads.get({
          userId: 'me',
          id: message.threadId,
          format: 'full',
        })
        threadContext = buildThreadContextForAI(threadResponse.data)
      }

      const classification = await classifyIncomingEmail({
        profile: persistedState.profile,
        writingStyleProfile,
        email: {
          from: sender,
          subject,
          body,
          snippet: message.snippet || null,
        },
        threadContext,
      })
      await recordUsage(user.id, 'email_analysis', 1, {
        source: 'classification',
        relatedGmailMessageId: message.id || messageRef.id,
        relatedThreadId: message.threadId || null,
      })

      const category = persistedState.profile.categories.find((item) => item.name === classification.result.category)
      const labelId = category ? labelMap.get(normalizeName(category.name)) : null
      const highConfidence = classification.result.confidence >= 0.75
      let labelApplied = false
      let draftId: string | null = null
      let status: ClassificationCard['status'] = highConfidence ? 'processed' : 'needs_review'
      let reason = classification.result.reason
      let labelMappingStatus: ClassificationCard['labelMappingStatus'] = category ? 'created_or_verified' : 'missing'
      let labelMappingWarning: string | null = null
      let actionTaken = highConfidence ? 'Analyse effectuée' : 'À vérifier'

      if (category && !labelId) {
        labelMappingStatus = 'missing'
        labelMappingWarning = `Mapping Gmail introuvable pour le label ${category.name}.`
        status = 'needs_review'
        reason = labelMappingWarning
      }

      if (highConfidence && classification.result.shouldApplyLabel && labelId) {
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id || messageRef.id,
            requestBody: {
              addLabelIds: [labelId],
            },
          })
          labelApplied = true
          labelsApplied += 1
          labelMappingStatus = 'verified'
          actionTaken = 'Label appliqué'
        } catch {
          status = 'error'
          reason = 'Erreur lors de l’application du label.'
          actionTaken = 'Erreur label'
        }
      }

      const duplicateDraftExists = await hasExistingDraftLog(user.id, message.id || messageRef.id, message.threadId)
      const seemsToNeedReply = !/no[- ]?reply|ne pas répondre|newsletter|unsubscribe|désabonner/i.test(`${sender} ${subject} ${body}`)
      const canCreateDraft =
        status !== 'error' &&
        highConfidence &&
        category?.actions.draft &&
        classification.result.shouldCreateDraft &&
        classification.result.draft &&
        seemsToNeedReply &&
        !duplicateDraftExists

      if (canCreateDraft && classification.result.draft) {
        try {
          const draftQuota = await checkQuota(user.id, 'ai_draft', 1)
          if (!draftQuota.allowed) {
            actionTaken = labelApplied ? 'Label appliqué, quota brouillons atteint' : 'Quota brouillons atteint'
            reason = 'Votre limite de brouillons IA est atteinte pour ce mois-ci.'
          } else {
            draftId = await createReplyDraft({
              gmail,
              message,
              to: extractEmailAddress(sender),
              subject: classification.result.draft.subject || naturalReplySubject(subject),
              body: classification.result.draft.body,
            })
            draftsCreated += draftId ? 1 : 0
            if (draftId) {
              await recordUsage(user.id, 'ai_draft', 1, {
                source: 'classification',
                relatedGmailMessageId: message.id || messageRef.id,
                relatedThreadId: message.threadId || null,
              })
            }
            actionTaken = labelApplied ? 'Label appliqué + brouillon créé' : 'Brouillon créé'
          }
        } catch {
          status = 'error'
          reason = 'Erreur lors de la création du brouillon.'
          actionTaken = 'Erreur brouillon'
        }
      } else if (duplicateDraftExists && category?.actions.draft) {
        actionTaken = labelApplied ? 'Label appliqué, brouillon déjà existant' : 'Brouillon déjà existant'
      }

      if (status === 'needs_review') needsReview += 1
      analyzed += 1

      const card: ClassificationCard = {
        messageId: message.id || messageRef.id,
        threadId: message.threadId || null,
        sender,
        subject,
        category: classification.result.category,
        confidence: classification.result.confidence,
        importance: classification.result.importance,
        status,
        labelApplied,
        draftCreated: Boolean(draftId),
        draftId,
        reason,
        skipReason: null,
        actionTaken,
        threadContextUsed: Boolean(threadContext?.messageCount),
        availableCategories,
        labelMappingStatus,
        labelMappingWarning,
        previousCategory: existingLog?.predicted_category || null,
      }
      results.push(card)
      await logClassification({
        userId: user.id,
        automationProfileId,
        result: card,
        categoryKey: category?.id,
        updateExisting: requestBody.includeAlreadyAnalyzed,
      })
    }

    if (!results.length) {
      return jsonError(404, 'no_messages', 'Aucun email récent trouvé.')
    }

    console.info('[gmail/classification/analyze-recent] Completed', {
      userId: user.id,
      fetched: messageRefs.length,
      requestedLimit: requestBody.limit,
      includeAlreadyAnalyzed: requestBody.includeAlreadyAnalyzed,
      analyzed,
      skipped,
      labelsApplied,
      draftsCreated,
      needsReview,
      hasModifyScope: true,
    })

    const usage = await getMonthlyUsageSnapshot(user.id)

    return NextResponse.json({
      ok: true,
      debug: process.env.NODE_ENV !== 'production',
      quotaNotice: quotaNotice || null,
      usage,
      summary: {
        analyzed,
        labelsApplied,
        draftsCreated,
        needsReview,
        skipped,
      },
      results,
    })
  } catch (error) {
    console.error('[gmail/classification/analyze-recent] Failed', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'Unknown error',
      analyzed,
      skipped,
      labelsApplied,
      draftsCreated,
      needsReview,
    })

    return jsonError(500, 'server_exception', 'Analyse impossible pour le moment.')
  }
}
