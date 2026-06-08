import { randomUUID, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { google, type gmail_v1 } from 'googleapis'
import { classifyIncomingEmailsBatch, cleanAiDraftBody, generateAiDraftReply, type DraftComplexity } from '@/lib/ai/provider'
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
import { checkQuota, getCurrentMonthKey, recordEmailProcessed, recordUsage } from '@/lib/saas/plan-limits'
import { automationProfileSchema, categoryActionsSchema, type AutomationProfile } from '@/lib/saas/schemas'
import { getWorkerSubscriptionAccessForUser } from '@/lib/saas/subscription-store'
import { getWritingStyleProfile } from '@/lib/saas/supabase-store'
import {
  getTelegramConnection,
  hasTelegramAlertForMessage,
  logTelegramAlert,
  sendTelegramMessage,
} from '@/lib/saas/telegram-store'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const DEFAULT_MAX_USERS_PER_RUN = 20
const MAX_USERS_PER_RUN = 50
const DEFAULT_MAX_EMAILS_PER_USER = Math.min(
  Math.max(Number(process.env.WORKER_MAX_EMAILS_PER_USER_DEFAULT || 5) || 5, 1),
  10,
)
const MAX_EMAILS_PER_USER = 10
const WORKER_BATCH_SIZE = Math.min(Math.max(Number(process.env.WORKER_BATCH_SIZE || 5) || 5, 1), 5)
const WORKER_LOCK_KEY = 'gmail_worker_global'
const WORKER_LOCK_TIMEOUT_SECONDS = Math.max(Number(process.env.WORKER_LOCK_TIMEOUT_SECONDS || 600) || 600, 60)

type AutomationProfileRow = {
  id: string
  user_id: string
  status: 'active' | 'paused'
  profile_json: unknown
  updated_at?: string | null
  last_worker_run_at?: string | null
  last_worker_status?: string | null
  last_worker_processed_count?: number | null
  last_worker_ai_cost_estimate?: number | null
}

type LabelResult = Awaited<ReturnType<typeof ensureRealGmailLabels>>

type WorkerUserSummary = {
  userId: string
  automationProfileId: string
  status: 'processed' | 'skipped' | 'error'
  reason: string
  fetched: number
  analyzed: number
  labelsApplied: number
  draftsCreated: number
  needsReview: number
  skippedAlreadyProcessed: number
  skippedOther: number
  debug?: WorkerDebugSummary
}

type WorkerDebugSummary = {
  skippedAlreadyProcessed: number
  skippedLowConfidence: number
  skippedNoMatchingCategory: number
  skippedNoDraftAction: number
  skippedNoReplyNeeded: number
  skippedDuplicateDraft: number
  skippedDraftQuota: number
  skippedDraftBudget: number
  skippedMissingComposeScope: number
  failedDraftCreation: number
  emailsSentToLlm: number
  llmClassificationCalls: number
  draftGenerationCalls: number
  skippedBeforeAi: number
  skippedByRules: number
  ruleClassified: number
  ruleLabelsApplied: number
  processedByWorker: number
  sentToAi: number
  aiAnalyzedUsageIncremented: number
  customerProcessedUsageIncremented: number
  classificationModels: string[]
  draftModels: string[]
  promptTokensEstimated: number
  completionTokensEstimated: number
  estimatedCost: {
    available: boolean
    currency: 'EUR'
    total: number | null
    classification: number | null
    drafts: number | null
    details: Array<{
      kind: 'classification' | 'draft'
      model: string
      inputTokens: number
      outputTokens: number
      estimatedCost: number | null
      complexity?: DraftComplexity
    }>
  }
  estimatedPromptChars: number
  categories: WorkerCategoryDebug[]
  perEmail: WorkerEmailDebug[]
}

type WorkerCategoryDebug = {
  name: string
  savedActions: Record<string, boolean>
  rawActionFields: {
    profileAction: unknown
    profileActions: unknown
    profileDraftReplyEnabled: unknown
    profileDraftReply: unknown
    profileCreateDraft: unknown
    profileResponseMode: unknown
    tableActions: unknown
    tableDraftReplyEnabled: unknown
    tableCreateDraft: unknown
    tableResponseMode: unknown
  }
  requiresDraft: boolean
  gmailLabelId: string | null
}

type WorkerEmailDebug = {
  messageId: string
  subject: string
  selectedCategory: string | null
  confidence: number | null
  status: string
  reason: string
  draftDecisionReason: string
  categoryRequiresDraft: boolean
  draftQuotaAllowed: boolean | null
  draftCreated: boolean
  classificationSource?: 'rule' | 'llm'
  ruleReason?: string | null
  draftComplexity?: DraftComplexity | null
  draftModel?: string | null
  telegramSent?: boolean
  telegramDecisionReason?: string | null
}

type PreparedEmail = {
  message: gmail_v1.Schema$Message
  messageId: string
  sender: string
  subject: string
  body: string
  snippet: string | null
  ruleCandidateCategory: string | null
  ruleReason: string | null
}

type WorkerOptions = {
  maxUsers: number
  maxEmailsPerUser: number
  force: boolean
}

type WorkerLock = {
  acquired: boolean
  lockKey: string
  ownerId: string
  lockedUntil: string | null
  existingOwnerId: string | null
  existingLockedUntil: string | null
}

type WorkerClassificationDecision = {
  category: string
  confidence: number
  importance: 'low' | 'normal' | 'high' | 'urgent'
  shouldApplyLabel: boolean
  shouldCreateDraft: boolean
  shouldNotifyTelegram: boolean
  archiveSuggested: boolean
  reason: string
  draft: null
}

function jsonError(status: number, step: string, message: string) {
  return NextResponse.json({ ok: false, step, message }, { status })
}

function safeSecretMatches(provided: string | null, expected: string | undefined) {
  const cleanExpected = expected?.trim()
  const cleanProvided = provided?.trim()
  if (!cleanExpected || !cleanProvided) return false

  const providedBuffer = Buffer.from(cleanProvided)
  const expectedBuffer = Buffer.from(cleanExpected)
  if (providedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

function normalizeWorkerLockPayload(data: unknown, fallbackOwnerId: string): WorkerLock {
  const payload =
    typeof data === 'string'
      ? JSON.parse(data) as Record<string, unknown>
      : data && typeof data === 'object' && !Array.isArray(data)
        ? data as Record<string, unknown>
        : {}

  return {
    acquired: payload.acquired === true,
    lockKey: typeof payload.lockKey === 'string' ? payload.lockKey : WORKER_LOCK_KEY,
    ownerId: typeof payload.ownerId === 'string' ? payload.ownerId : fallbackOwnerId,
    lockedUntil: typeof payload.lockedUntil === 'string' ? payload.lockedUntil : null,
    existingOwnerId: typeof payload.existingOwnerId === 'string' ? payload.existingOwnerId : null,
    existingLockedUntil: typeof payload.existingLockedUntil === 'string' ? payload.existingLockedUntil : null,
  }
}

async function acquireGlobalWorkerLock(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const ownerId = randomUUID()
  const { data, error } = await supabase.rpc('try_acquire_worker_lock', {
    p_lock_key: WORKER_LOCK_KEY,
    p_owner_id: ownerId,
    p_timeout_seconds: WORKER_LOCK_TIMEOUT_SECONDS,
    p_metadata: {
      source: 'process-gmail',
      timeoutSeconds: WORKER_LOCK_TIMEOUT_SECONDS,
    },
  })

  if (error) throw error

  return normalizeWorkerLockPayload(data, ownerId)
}

async function releaseGlobalWorkerLock(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  lock: WorkerLock,
) {
  if (!lock.acquired) return

  const { error } = await supabase.rpc('release_worker_lock', {
    p_lock_key: lock.lockKey,
    p_owner_id: lock.ownerId,
  })

  if (error) {
    console.warn('[worker/process-gmail] global lock release failed', {
      lockKey: lock.lockKey,
      ownerId: lock.ownerId,
      message: error.message,
    })
  }
}

async function getWorkerOptions(request: NextRequest): Promise<WorkerOptions> {
  const url = new URL(request.url)
  const body =
    request.method === 'POST'
      ? await request.json().catch(() => ({} as Record<string, unknown>))
      : ({} as Record<string, unknown>)

  const rawMaxUsers = Number(body.maxUsers || url.searchParams.get('maxUsers') || DEFAULT_MAX_USERS_PER_RUN)
  const rawMaxEmails = Number(
    body.maxEmailsPerUser || url.searchParams.get('maxEmailsPerUser') || DEFAULT_MAX_EMAILS_PER_USER,
  )

  return {
    maxUsers: Math.min(Math.max(Number.isFinite(rawMaxUsers) ? rawMaxUsers : DEFAULT_MAX_USERS_PER_RUN, 1), MAX_USERS_PER_RUN),
    maxEmailsPerUser: Math.min(
      Math.max(Number.isFinite(rawMaxEmails) ? rawMaxEmails : DEFAULT_MAX_EMAILS_PER_USER, 1),
      MAX_EMAILS_PER_USER,
    ),
    force: body.force === true || body.force === '1' || url.searchParams.get('force') === '1',
  }
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buildLabelMap(labels: LabelResult) {
  const map = new Map<string, string>()
  for (const label of [...labels.created, ...labels.existing, ...labels.updatedColors]) {
    if (label.name && label.id) map.set(normalizeName(label.name), label.id)
  }
  return map
}

function extractEmailAddress(header: string) {
  const match = header.match(/<([^>]+)>/)
  return (match?.[1] || header).split(',')[0]?.trim() || header.trim()
}

function naturalReplySubject(subject: string) {
  const cleaned = subject.replace(/^\s*(re|fw|fwd)\s*:\s*/i, '').trim()
  return cleaned ? `Re: ${cleaned}` : 'Re: Votre message'
}

function enabledActions(actions: Record<string, boolean>) {
  return Object.entries(actions)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
}

function actionsFromRecord(value: unknown) {
  const parsed = categoryActionsSchema.safeParse(value)
  const base = parsed.success ? parsed.data : { label: true, draft: false, telegram: false, archive: false }
  const draft = base.draft || valueHasDraftSignal(value)
  if (base.archive) return { label: false, draft: false, telegram: false, archive: true }
  return { ...base, draft }
}

function draftStringSignal(value: string) {
  const normalized = normalizeName(value).replace(/[\s_-]+/g, '')
  return [
    'draft',
    'draftreply',
    'labeldraft',
    'label+draft',
    'labeldraftreply',
    'brouillon',
    'labelbrouillon',
  ].includes(normalized)
}

function valueHasDraftSignal(value: unknown): boolean {
  if (!value) return false
  if (typeof value === 'string') return draftStringSignal(value)
  if (Array.isArray(value)) return value.some((item) => valueHasDraftSignal(item))
  if (typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  if (record.draft === true) return true
  if (record.create_draft === true) return true
  if (record.draft_reply_enabled === true) return true
  if (record.response_mode && typeof record.response_mode === 'string' && draftStringSignal(record.response_mode)) return true
  if (record.action && typeof record.action === 'string' && draftStringSignal(record.action)) return true
  if (record.actions && valueHasDraftSignal(record.actions)) return true

  const draftReply = record.draft_reply
  if (draftReply && typeof draftReply === 'object' && !Array.isArray(draftReply)) {
    const draftReplyRecord = draftReply as Record<string, unknown>
    if (draftReplyRecord.enabled === true) return true
    if (draftReplyRecord.create_draft === true) return true
  }

  return false
}

function categoryRequiresDraftFromConfig(input: {
  profileCategory: AutomationProfile['categories'][number]
  rawProfileCategory?: Record<string, unknown> | null
  row?: {
    actions?: unknown
    draft_reply_enabled?: boolean | null
    create_draft?: boolean | null
    response_mode?: string | null
    raw?: Record<string, unknown> | null
  } | null
}) {
  const rowActions = input.row ? actionsFromRecord(input.row.actions) : null
  return Boolean(
    input.profileCategory.actions.draft ||
      input.profileCategory.draft_reply.enabled ||
      valueHasDraftSignal(input.rawProfileCategory) ||
      rowActions?.draft ||
      input.row?.draft_reply_enabled ||
      input.row?.create_draft ||
      valueHasDraftSignal(input.row?.response_mode || null) ||
      valueHasDraftSignal(input.row?.raw || null),
  )
}

type RuntimeCategoryRow = {
  id: string
  actions: Record<string, boolean>
  draft_reply_enabled: boolean
  create_draft?: boolean | null
  response_mode?: string | null
  raw?: Record<string, unknown> | null
}

function getRawProfileCategoryMap(rawProfile: unknown) {
  const rawCategories =
    rawProfile && typeof rawProfile === 'object' && !Array.isArray(rawProfile)
      ? (rawProfile as { categories?: unknown }).categories
      : null

  const byId = new Map<string, Record<string, unknown>>()
  const byName = new Map<string, Record<string, unknown>>()

  if (!Array.isArray(rawCategories)) return { byId, byName }

  for (const category of rawCategories) {
    if (!category || typeof category !== 'object' || Array.isArray(category)) continue
    const record = category as Record<string, unknown>
    if (record.id) byId.set(String(record.id), record)
    if (record.name) byName.set(normalizeName(String(record.name)), record)
    if (record.gmail_label) byName.set(normalizeName(String(record.gmail_label)), record)
  }

  return { byId, byName }
}

function rawActionFields(input: {
  profileCategory: AutomationProfile['categories'][number]
  rawProfileCategory?: Record<string, unknown> | null
  row?: RuntimeCategoryRow | null
}) {
  return {
    profileAction: input.rawProfileCategory?.action ?? null,
    profileActions: input.rawProfileCategory?.actions ?? input.profileCategory.actions,
    profileDraftReplyEnabled:
      input.rawProfileCategory?.draft_reply_enabled ??
      ((input.rawProfileCategory?.draft_reply &&
        typeof input.rawProfileCategory.draft_reply === 'object' &&
        !Array.isArray(input.rawProfileCategory.draft_reply))
        ? (input.rawProfileCategory.draft_reply as Record<string, unknown>).enabled
        : input.profileCategory.draft_reply.enabled),
    profileDraftReply: input.rawProfileCategory?.draft_reply ?? input.profileCategory.draft_reply,
    profileCreateDraft: input.rawProfileCategory?.create_draft ?? null,
    profileResponseMode: input.rawProfileCategory?.response_mode ?? null,
    tableActions: input.row?.raw?.actions ?? input.row?.actions ?? null,
    tableDraftReplyEnabled: input.row?.raw?.draft_reply_enabled ?? input.row?.draft_reply_enabled ?? null,
    tableCreateDraft: input.row?.raw?.create_draft ?? input.row?.create_draft ?? null,
    tableResponseMode: input.row?.raw?.response_mode ?? input.row?.response_mode ?? null,
  }
}

async function buildRuntimeProfile(profileId: string, profile: AutomationProfile, rawProfile?: unknown) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return {
      profile,
      rowsByCategoryName: new Map<string, RuntimeCategoryRow>(),
      rawCategoriesByName: new Map<string, Record<string, unknown>>(),
    }
  }

  const rawCategoryMap = getRawProfileCategoryMap(rawProfile)
  const { data, error } = await supabase
    .from('automation_categories')
    .select('*')
    .eq('automation_profile_id', profileId)

  if (error) throw error

  const rowsByKey = new Map<string, RuntimeCategoryRow>()
  const rowsByLabel = new Map<string, RuntimeCategoryRow>()

  for (const row of data || []) {
    const rowActions = actionsFromRecord(row.actions)
    const normalizedRow = {
      id: String(row.id),
      actions: {
        ...rowActions,
        draft: Boolean(rowActions.draft || row.draft_reply_enabled),
        telegram: Boolean(rowActions.telegram || row.telegram_notify),
        archive: Boolean(rowActions.archive || row.archive_enabled),
      },
      draft_reply_enabled: Boolean(row.draft_reply_enabled),
      create_draft: row.create_draft === true,
      response_mode: typeof row.response_mode === 'string' ? row.response_mode : null,
      raw: row as Record<string, unknown>,
    }
    if (row.key) rowsByKey.set(String(row.key), normalizedRow)
    if (row.label) rowsByLabel.set(normalizeName(String(row.label)), normalizedRow)
  }

  const categories = profile.categories.map((category) => {
    const row = rowsByKey.get(category.id) || rowsByLabel.get(normalizeName(category.name))
    const rawProfileCategory = rawCategoryMap.byId.get(category.id) || rawCategoryMap.byName.get(normalizeName(category.name))
    const requiresDraft = categoryRequiresDraftFromConfig({ profileCategory: category, rawProfileCategory, row })
    const actions = row
      ? {
          ...category.actions,
          ...row.actions,
          draft: requiresDraft,
        }
      : {
          ...category.actions,
          draft: requiresDraft,
        }

    if (actions.archive) {
      actions.label = false
      actions.draft = false
      actions.telegram = false
    }

    return {
      ...category,
      actions,
      draft_reply: {
        ...category.draft_reply,
        enabled: actions.draft,
      },
    }
  })

  return {
    profile: automationProfileSchema.parse({
      ...profile,
      categories,
    }),
    rowsByCategoryName: new Map(categories.map((category) => {
      const row = rowsByKey.get(category.id) || rowsByLabel.get(normalizeName(category.name))
      return [
        category.name,
        {
          id: row?.id || category.id,
          actions: category.actions,
          draft_reply_enabled: category.draft_reply.enabled,
          create_draft: row?.create_draft ?? null,
          response_mode: row?.response_mode ?? null,
          raw: row?.raw || null,
        },
      ]
    })),
    rawCategoriesByName: new Map(categories.map((category) => {
      const rawCategory = rawCategoryMap.byId.get(category.id) || rawCategoryMap.byName.get(normalizeName(category.name))
      return [category.name, rawCategory || {}]
    })),
  }
}

function findCategoryByKeyword(profile: AutomationProfile, keywords: string[]) {
  return profile.categories.find((category) => {
    const haystack = normalizeName(`${category.id} ${category.name} ${category.description}`)
    return keywords.some((keyword) => haystack.includes(keyword))
  })?.name || null
}

function hasStrongInvoiceSignal(text: string) {
  return /\b(facture|invoice|recu|receipt|paiement|payment|montant|tva|echeance|devis|abonnement facture|prelevement|transaction|commande payee)\b/.test(text)
}

function inferRuleCandidateCategory(profile: AutomationProfile, input: { sender: string; subject: string; body: string }) {
  const text = normalizeName(`${input.sender} ${input.subject} ${input.body.slice(0, 900)}`)

  if (/\b(urgence|urgent|urgente|bloquant|blocage|critique|reponse rapide|delai critique|mecontent)\b/i.test(text)) {
    const urgent = findCategoryByKeyword(profile, ['urgence', 'urgent'])
    if (urgent) return { category: urgent, reason: 'Mots-clés d’urgence détectés.' }
  }

  if (hasStrongInvoiceSignal(text)) {
    const invoice = findCategoryByKeyword(profile, ['facture', 'comptabilite'])
    if (invoice) return { category: invoice, reason: 'Mots-clés facture ou paiement détectés.' }
  }

  if (/\b(client|commande|livraison|delai de livraison|sav|support|projet)\b/i.test(text)) {
    const client = findCategoryByKeyword(profile, ['client', 'commande', 'sav'])
    if (client) return { category: client, reason: 'Mots-clés client, commande ou support détectés.' }
  }

  return { category: null, reason: null }
}

function hasCategory(profile: AutomationProfile, categoryName: string | null) {
  return Boolean(categoryName && profile.categories.some((category) => category.name === categoryName))
}

function lowValueEmailReason(input: { sender: string; subject: string; body: string }) {
  const text = normalizeName(`${input.sender} ${input.subject} ${input.body.slice(0, 1200)}`)
  const sender = normalizeName(input.sender)
  const isExplicitInvoice = hasStrongInvoiceSignal(text)
  const socialOrNotification =
    /\b(instagram|facebook|tiktok|linkedin|pinterest|x-twitter|twitter|reseau social|social activity|activite sociale|stories|story|publications manquees|rattrapez|suggestions de publications|notification uniquement|notification-only)\b/.test(text) ||
    /\b(instagram|facebook|linkedin|tiktok|pinterest|x-twitter|twitter)\b/.test(sender)

  if (socialOrNotification) {
    return 'Notification sociale ou newsletter, ignorée avant IA.'
  }

  if (/\b(no[- ]?reply|noreply|do[- ]?not[- ]?reply|nepasrepondre|merci de ne pas repondre|ne pas repondre)\b/.test(text) && !isExplicitInvoice) {
    return 'Email automatique no-reply, ignoré avant IA.'
  }

  if (/\b(newsletter|unsubscribe|desabonner|desinscription|promotion|promo|soldes|publicite|marketing email|notification d'activite|activity notification)\b/.test(text) && !isExplicitInvoice) {
    return 'Newsletter ou email promotionnel, ignoré avant IA.'
  }

  if (/\b(verification code|code de verification|security alert|alerte de securite|connexion detectee|notification de compte|account notification)\b/.test(text) && !isExplicitInvoice) {
    return 'Notification de sécurité automatique, ignorée avant IA.'
  }

  return null
}

function buildRuleDecision(input: {
  profile: AutomationProfile
  sender: string
  subject: string
  body: string
}): { type: 'skip'; reason: string } | { type: 'classify'; decision: WorkerClassificationDecision; reason: string } | { type: 'none' } {
  const skipReason = lowValueEmailReason(input)
  if (skipReason) return { type: 'skip', reason: skipReason }

  const text = normalizeName(`${input.sender} ${input.subject} ${input.body.slice(0, 1200)}`)
  const ruleCandidate = inferRuleCandidateCategory(input.profile, input)
  const needsReply = seemsToNeedReply(input)

  if (ruleCandidate.category && hasCategory(input.profile, ruleCandidate.category)) {
    const urgentSignals = /\b(urgence|urgent|urgente|bloquant|blocage|critique|reponse rapide|delai critique)\b/.test(text)
    const invoiceSignals = hasStrongInvoiceSignal(text)

    if (urgentSignals || invoiceSignals) {
      return {
        type: 'classify',
        reason: ruleCandidate.reason || 'Classification déterministe sûre.',
        decision: {
          category: ruleCandidate.category,
          confidence: urgentSignals ? 0.95 : 0.9,
          importance: urgentSignals ? 'urgent' : 'normal',
          shouldApplyLabel: true,
          shouldCreateDraft: needsReply,
          shouldNotifyTelegram: false,
          archiveSuggested: false,
          reason: ruleCandidate.reason || 'Classification déterministe sûre.',
          draft: null,
        },
      }
    }
  }

  if (/\b(client|commande|livraison|sav|support|projet)\b/.test(text)) {
    const client = findCategoryByKeyword(input.profile, ['client', 'commande', 'sav'])
    if (client) {
      return {
        type: 'classify',
        reason: 'Email client évident, classé sans appel IA.',
        decision: {
          category: client,
          confidence: 0.86,
          importance: 'normal',
          shouldApplyLabel: true,
          shouldCreateDraft: needsReply,
          shouldNotifyTelegram: false,
          archiveSuggested: false,
          reason: 'Email client évident, classé sans appel IA.',
          draft: null,
        },
      }
    }
  }

  return { type: 'none' }
}

function makeDebugSummary(): WorkerDebugSummary {
  return {
    skippedAlreadyProcessed: 0,
    skippedLowConfidence: 0,
    skippedNoMatchingCategory: 0,
    skippedNoDraftAction: 0,
    skippedNoReplyNeeded: 0,
    skippedDuplicateDraft: 0,
    skippedDraftQuota: 0,
    skippedDraftBudget: 0,
    skippedMissingComposeScope: 0,
    failedDraftCreation: 0,
    emailsSentToLlm: 0,
    llmClassificationCalls: 0,
    draftGenerationCalls: 0,
    skippedBeforeAi: 0,
    skippedByRules: 0,
    ruleClassified: 0,
    ruleLabelsApplied: 0,
    processedByWorker: 0,
    sentToAi: 0,
    aiAnalyzedUsageIncremented: 0,
    customerProcessedUsageIncremented: 0,
    classificationModels: [],
    draftModels: [],
    promptTokensEstimated: 0,
    completionTokensEstimated: 0,
    estimatedCost: {
      available: false,
      currency: 'EUR',
      total: null,
      classification: null,
      drafts: null,
      details: [],
    },
    estimatedPromptChars: 0,
    categories: [],
    perEmail: [],
  }
}

function addUnique(value: string[], item: string | null | undefined) {
  if (item && !value.includes(item)) value.push(item)
}

function sumNullable(a: number | null, b: number | null) {
  if (a === null && b === null) return null
  return (a || 0) + (b || 0)
}

function estimateTokensFromChars(chars: number) {
  return Math.max(1, Math.ceil(chars / 4))
}

function readCostPerMillion(envName: string) {
  const raw = process.env[envName]
  if (!raw?.trim()) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function costEnvNames(kind: 'classification' | 'draft', complexity?: DraftComplexity) {
  if (kind === 'classification') {
    return {
      input: 'LLM_CLASSIFICATION_INPUT_COST_PER_1M',
      output: 'LLM_CLASSIFICATION_OUTPUT_COST_PER_1M',
    }
  }

  const prefix =
    complexity === 'small'
      ? 'LLM_DRAFT_SMALL'
      : complexity === 'complex'
        ? 'LLM_DRAFT_COMPLEX'
        : 'LLM_DRAFT_MEDIUM'

  return {
    input: `${prefix}_INPUT_COST_PER_1M`,
    output: `${prefix}_OUTPUT_COST_PER_1M`,
  }
}

function addCostEstimate(input: {
  debug: WorkerDebugSummary
  kind: 'classification' | 'draft'
  model: string
  inputChars: number
  outputChars: number
  complexity?: DraftComplexity
}) {
  const inputTokens = estimateTokensFromChars(input.inputChars)
  const outputTokens = estimateTokensFromChars(input.outputChars)
  const names = costEnvNames(input.kind, input.complexity)
  const inputCostPerMillion = readCostPerMillion(names.input)
  const outputCostPerMillion = readCostPerMillion(names.output)
  const estimatedCost =
    inputCostPerMillion === null || outputCostPerMillion === null
      ? null
      : (inputTokens * inputCostPerMillion + outputTokens * outputCostPerMillion) / 1_000_000

  input.debug.promptTokensEstimated += inputTokens
  input.debug.completionTokensEstimated += outputTokens
  input.debug.estimatedCost.details.push({
    kind: input.kind,
    model: input.model,
    inputTokens,
    outputTokens,
    estimatedCost,
    complexity: input.complexity,
  })

  if (estimatedCost === null) return

  input.debug.estimatedCost.available = true
  input.debug.estimatedCost.total = (input.debug.estimatedCost.total || 0) + estimatedCost
  if (input.kind === 'classification') {
    input.debug.estimatedCost.classification = (input.debug.estimatedCost.classification || 0) + estimatedCost
  } else {
    input.debug.estimatedCost.drafts = (input.debug.estimatedCost.drafts || 0) + estimatedCost
  }
}

function pushEmailDebug(debug: WorkerDebugSummary, item: WorkerEmailDebug) {
  if (debug.perEmail.length < 50) {
    debug.perEmail.push(item)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[worker/process-gmail] email decision', item)
  }
}

function aggregateDebugSummaries(summaries: WorkerUserSummary[]): WorkerDebugSummary {
  const aggregate = makeDebugSummary()

  for (const summary of summaries) {
    if (!summary.debug) continue

    aggregate.skippedAlreadyProcessed += summary.debug.skippedAlreadyProcessed
    aggregate.skippedLowConfidence += summary.debug.skippedLowConfidence
    aggregate.skippedNoMatchingCategory += summary.debug.skippedNoMatchingCategory
    aggregate.skippedNoDraftAction += summary.debug.skippedNoDraftAction
    aggregate.skippedNoReplyNeeded += summary.debug.skippedNoReplyNeeded
    aggregate.skippedDuplicateDraft += summary.debug.skippedDuplicateDraft
    aggregate.skippedDraftQuota += summary.debug.skippedDraftQuota
    aggregate.skippedDraftBudget += summary.debug.skippedDraftBudget
    aggregate.skippedMissingComposeScope += summary.debug.skippedMissingComposeScope
    aggregate.failedDraftCreation += summary.debug.failedDraftCreation
    aggregate.emailsSentToLlm += summary.debug.emailsSentToLlm
    aggregate.llmClassificationCalls += summary.debug.llmClassificationCalls
    aggregate.draftGenerationCalls += summary.debug.draftGenerationCalls
    aggregate.skippedBeforeAi += summary.debug.skippedBeforeAi
    aggregate.skippedByRules += summary.debug.skippedByRules
    aggregate.ruleClassified += summary.debug.ruleClassified
    aggregate.ruleLabelsApplied += summary.debug.ruleLabelsApplied
    aggregate.processedByWorker += summary.debug.processedByWorker
    aggregate.sentToAi += summary.debug.sentToAi
    aggregate.aiAnalyzedUsageIncremented += summary.debug.aiAnalyzedUsageIncremented
    aggregate.customerProcessedUsageIncremented += summary.debug.customerProcessedUsageIncremented
    aggregate.promptTokensEstimated += summary.debug.promptTokensEstimated
    aggregate.completionTokensEstimated += summary.debug.completionTokensEstimated
    for (const model of summary.debug.classificationModels) addUnique(aggregate.classificationModels, model)
    for (const model of summary.debug.draftModels) addUnique(aggregate.draftModels, model)
    aggregate.estimatedCost.available = aggregate.estimatedCost.available || summary.debug.estimatedCost.available
    aggregate.estimatedCost.classification = sumNullable(
      aggregate.estimatedCost.classification,
      summary.debug.estimatedCost.classification,
    )
    aggregate.estimatedCost.drafts = sumNullable(aggregate.estimatedCost.drafts, summary.debug.estimatedCost.drafts)
    aggregate.estimatedCost.total = sumNullable(aggregate.estimatedCost.total, summary.debug.estimatedCost.total)
    aggregate.estimatedCost.details.push(...summary.debug.estimatedCost.details.slice(0, Math.max(0, 100 - aggregate.estimatedCost.details.length)))
    aggregate.estimatedPromptChars += summary.debug.estimatedPromptChars
    aggregate.categories.push(...summary.debug.categories.slice(0, Math.max(0, 100 - aggregate.categories.length)))
    aggregate.perEmail.push(...summary.debug.perEmail.slice(0, Math.max(0, 50 - aggregate.perEmail.length)))
  }

  return aggregate
}

function hideDebug(summary: WorkerUserSummary) {
  const { debug, ...publicSummary } = summary
  void debug
  return publicSummary
}

function seemsToNeedReply(input: { sender: string; subject: string; body: string }) {
  return !/no[- ]?reply|ne pas répondre|newsletter|unsubscribe|désabonner|désinscription/i.test(
    `${input.sender} ${input.subject} ${input.body}`,
  )
}

function chooseDraftComplexity(input: {
  subject: string
  body: string
  importance?: string | null
  threadMessageCount?: number
}): DraftComplexity {
  const text = normalizeName(`${input.subject} ${input.body}`)
  const bodyLength = input.body.length
  const questionCount = (input.body.match(/\?/g) || []).length
  const sensitive =
    /\b(plainte|reclamation|litige|juridique|legal|avocat|contrat|resiliation|remboursement|mecontent|colere)\b/.test(text)

  if (sensitive || bodyLength > 2500 || (input.threadMessageCount || 0) >= 6) return 'complex'
  if (bodyLength > 900 || questionCount >= 3 || input.importance === 'urgent' || input.importance === 'high') return 'medium'
  return 'small'
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

async function getCandidateAutomationProfiles(maxUsers: number) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur indisponible.')

  const { data, error } = await supabase
    .from('automation_profiles')
    .select('id,user_id,status,profile_json,updated_at,last_worker_run_at,last_worker_status,last_worker_processed_count,last_worker_ai_cost_estimate')
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(maxUsers * 3)

  if (error) throw error

  const byUser = new Map<string, AutomationProfileRow>()
  for (const row of (data || []) as AutomationProfileRow[]) {
    if (!row.user_id || byUser.has(row.user_id)) continue
    byUser.set(row.user_id, row)
    if (byUser.size >= maxUsers) break
  }

  return [...byUser.values()]
}

function minMinutesBetweenRuns(plan: string | null | undefined) {
  const normalizedPlan = plan === 'premium' ? 'PREMIUM' : plan === 'pro' ? 'PRO' : 'STARTER'
  const fallback = normalizedPlan === 'PREMIUM' ? 5 : normalizedPlan === 'PRO' ? 10 : 30
  const value = Number(process.env[`WORKER_MIN_MINUTES_BETWEEN_RUNS_${normalizedPlan}`] || fallback)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function shouldSkipForWorkerInterval(row: AutomationProfileRow, plan: string | null | undefined, force: boolean) {
  if (force) return { skip: false, reason: null as string | null, elapsedMinutes: null as number | null, requiredMinutes: 0 }
  if (!row.last_worker_run_at) {
    return { skip: false, reason: null as string | null, elapsedMinutes: null as number | null, requiredMinutes: minMinutesBetweenRuns(plan) }
  }

  const lastRun = new Date(row.last_worker_run_at).getTime()
  if (!Number.isFinite(lastRun)) {
    return { skip: false, reason: null as string | null, elapsedMinutes: null as number | null, requiredMinutes: minMinutesBetweenRuns(plan) }
  }

  const elapsedMinutes = (Date.now() - lastRun) / 60_000
  const requiredMinutes = minMinutesBetweenRuns(plan)
  if (elapsedMinutes >= requiredMinutes) {
    return { skip: false, reason: null as string | null, elapsedMinutes, requiredMinutes }
  }

  return {
    skip: true,
    reason: `Dernier traitement automatique trop récent. Prochain passage possible dans ${Math.ceil(requiredMinutes - elapsedMinutes)} minute(s).`,
    elapsedMinutes,
    requiredMinutes,
  }
}

async function updateWorkerRunTracking(input: {
  automationProfileId: string
  status: string
  processedCount: number
  estimatedCost: number | null
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const { error } = await supabase
    .from('automation_profiles')
    .update({
      last_worker_run_at: new Date().toISOString(),
      last_worker_status: input.status,
      last_worker_processed_count: input.processedCount,
      last_worker_ai_cost_estimate: input.estimatedCost,
    })
    .eq('id', input.automationProfileId)

  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[worker/process-gmail] worker tracking update failed', {
      automationProfileId: input.automationProfileId,
      message: error.message,
    })
  }
}

async function addMonthlyEstimatedAiCost(userId: string, estimatedCost: number | null) {
  if (estimatedCost === null || estimatedCost <= 0) return
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const monthKey = getCurrentMonthKey()
  const { data, error: lookupError } = await supabase
    .from('monthly_usage')
    .select('estimated_ai_cost_eur')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (lookupError) return

  const current = Number((data as { estimated_ai_cost_eur?: unknown } | null)?.estimated_ai_cost_eur || 0)
  const { error } = await supabase
    .from('monthly_usage')
    .update({
      estimated_ai_cost_eur: current + estimatedCost,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('month_key', monthKey)

  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[worker/process-gmail] monthly cost update failed', { userId, message: error.message })
  }
}

function getPlanAiBudgetEur(plan: string | null | undefined) {
  if (plan === 'premium') return 30
  if (plan === 'pro') return 15
  return 5
}

async function getMonthlyEstimatedAiCost(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return 0

  const { data, error } = await supabase
    .from('monthly_usage')
    .select('estimated_ai_cost_eur')
    .eq('user_id', userId)
    .eq('month_key', getCurrentMonthKey())
    .maybeSingle()

  if (error) return 0
  return Number((data as { estimated_ai_cost_eur?: unknown } | null)?.estimated_ai_cost_eur || 0)
}

function maskEmailForLog(email: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain) return 'adresse masquée'
  return `${local.slice(0, 2)}***@${domain}`
}

function compactSenderForAi(header: string) {
  const email = extractEmailAddress(header).toLowerCase()
  const domain = email.split('@')[1]
  return domain ? `***@${domain}` : maskEmailForLog(email)
}

async function warnDuplicateGmailConnections(rows: AutomationProfileRow[]) {
  if (process.env.NODE_ENV === 'production' || rows.length < 2) return

  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
  if (userIds.length < 2) return

  const { data, error } = await supabase
    .from('gmail_connections')
    .select('user_id,gmail_email,google_email,status,revoked_at,connected_at')
    .in('user_id', userIds)
    .is('revoked_at', null)

  if (error) {
    console.warn('[worker/process-gmail] duplicate Gmail check failed', { message: error.message })
    return
  }

  const usersByEmail = new Map<string, Set<string>>()
  for (const connection of data || []) {
    if (connection.status && connection.status !== 'connected') continue
    const email = String(connection.google_email || connection.gmail_email || '').trim().toLowerCase()
    if (!email) continue
    const users = usersByEmail.get(email) || new Set<string>()
    users.add(String(connection.user_id))
    usersByEmail.set(email, users)
  }

  for (const [email, users] of usersByEmail) {
    if (users.size < 2) continue
    console.warn('[worker/process-gmail] duplicate Gmail connection detected', {
      gmailEmail: maskEmailForLog(email),
      userCount: users.size,
      userIds: [...users],
      message: 'Plusieurs utilisateurs actifs semblent connectés à la même boîte Gmail. Cela peut multiplier les coûts en test local.',
    })
  }
}

async function getAlreadyProcessedMessageIds(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return new Set<string>()

  const { data, error } = await supabase
    .from('email_processing_logs')
    .select('gmail_message_id')
    .eq('user_id', userId)
    .not('gmail_message_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) throw error

  return new Set((data || []).map((row) => row.gmail_message_id).filter(Boolean) as string[])
}

async function hasExistingDraftLog(userId: string, messageId: string, threadId: string | null | undefined) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return false

  let query = supabase.from('email_processing_logs').select('id').eq('user_id', userId).eq('draft_created', true).limit(1)
  query = threadId ? query.eq('thread_id', threadId) : query.eq('gmail_message_id', messageId)

  const { data, error } = await query.maybeSingle()
  if (error) return false

  return Boolean(data?.id)
}

async function logWorkerEvent(input: {
  userId: string
  automationProfileId: string | null
  gmailMessageId?: string | null
  threadId?: string | null
  sender?: string | null
  subject?: string | null
  predictedCategory?: string | null
  confidence?: number | null
  importance?: string | null
  labelApplied?: boolean
  draftCreated?: boolean
  draftId?: string | null
  categoryKey?: string | null
  action?: 'label_only' | 'draft_reply' | 'notify_telegram' | 'archive' | null
  status: string
  reason: string
  skippedReason?: string | null
  details?: Record<string, unknown>
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  const now = new Date().toISOString()
  const { error } = await supabase.from('email_processing_logs').insert({
    user_id: input.userId,
    automation_profile_id: input.automationProfileId,
    gmail_message_id: input.gmailMessageId || null,
    thread_id: input.threadId || null,
    sender: input.sender || null,
    subject: input.subject || null,
    predicted_category: input.predictedCategory || null,
    confidence: input.confidence ?? null,
    importance: input.importance || null,
    label_applied: input.labelApplied || false,
    draft_created: input.draftCreated || false,
    draft_id: input.draftId || null,
    category_key: input.categoryKey || null,
    action: input.action || null,
    status: input.status,
    reason: input.reason,
    skipped_reason: input.skippedReason || null,
    processed_at: now,
    details: {
      type: 'automatic_worker',
      message: input.reason,
      sent: false,
      permanentDelete: false,
      archiveApplied: false,
      ...(input.details || {}),
    },
  })

  if (error) {
    console.error('[worker/process-gmail] log insert failed', {
      userId: input.userId,
      automationProfileId: input.automationProfileId,
      hasGmailMessageId: Boolean(input.gmailMessageId),
      status: input.status,
      message: error.message,
    })
  }
}

function makeSkippedSummary(row: AutomationProfileRow, reason: string): WorkerUserSummary {
  return {
    userId: row.user_id,
    automationProfileId: row.id,
    status: 'skipped',
    reason,
    fetched: 0,
    analyzed: 0,
    labelsApplied: 0,
    draftsCreated: 0,
    needsReview: 0,
    skippedAlreadyProcessed: 0,
    skippedOther: 0,
  }
}

function makeIncomingEmailForDraft(input: {
  sender: string
  subject: string
  body: string
  categoryName: string
  classificationReason: string
}) {
  return [
    `De : ${input.sender}`,
    `Objet : ${input.subject}`,
    `Catégorie Toolia retenue : ${input.categoryName}`,
    `Raison de classification : ${input.classificationReason}`,
    '',
    input.body,
  ].join('\n')
}

function buildTelegramAlertText(input: {
  categoryName: string
  subject: string
  labelApplied: boolean
  draftCreated: boolean
  urgent: boolean
}) {
  const actionParts = [
    input.labelApplied ? 'label appliqué' : null,
    input.draftCreated ? 'brouillon préparé' : null,
  ].filter(Boolean)
  const action = actionParts.length ? actionParts.join(' + ') : 'à vérifier dans Gmail'

  return [
    input.urgent ? '🚨 Email urgent détecté' : '🔔 Email important détecté',
    `Catégorie : ${input.categoryName}`,
    `Objet : ${input.subject.slice(0, 140)}`,
    `Action : ${action}`,
    'Ouvrez Gmail pour valider la réponse.',
  ].join('\n')
}

async function processUserProfile(row: AutomationProfileRow, options: Pick<WorkerOptions, 'maxEmailsPerUser' | 'force'>): Promise<WorkerUserSummary> {
  const maxEmailsPerUser = options.maxEmailsPerUser
  const debug = makeDebugSummary()
  const subscriptionAccess = await getWorkerSubscriptionAccessForUser(row.user_id)
  if (!subscriptionAccess.allowed) {
    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      status: 'worker_skipped_subscription',
      reason: subscriptionAccess.reason,
      skippedReason: subscriptionAccess.reason,
      details: {
        subscriptionStatus: subscriptionAccess.subscription?.status || null,
        currentPeriodEnd: subscriptionAccess.currentPeriodEnd,
      },
    })
    return { ...makeSkippedSummary(row, subscriptionAccess.reason), debug }
  }

  const subscriptionPlan = subscriptionAccess.planId || subscriptionAccess.subscription?.plan_id || null
  const intervalDecision = shouldSkipForWorkerInterval(row, subscriptionPlan, options.force)
  if (intervalDecision.skip) {
    const reason = intervalDecision.reason || 'Traitement automatique trop récent.'
    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      status: 'worker_skipped_interval',
      reason,
      skippedReason: reason,
      details: {
        plan: subscriptionPlan,
        elapsedMinutes: intervalDecision.elapsedMinutes,
        requiredMinutes: intervalDecision.requiredMinutes,
      },
    })
    return { ...makeSkippedSummary(row, reason), debug }
  }

  if (row.status !== 'active') {
    const reason = 'Automatisation en pause.'
    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      status: 'worker_skipped_paused',
      reason,
      skippedReason: reason,
    })
    return { ...makeSkippedSummary(row, reason), debug }
  }

  const profileResult = automationProfileSchema.safeParse(row.profile_json)
  if (!profileResult.success) {
    const reason = 'Configuration Toolia invalide.'
    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      status: 'worker_skipped_invalid_profile',
      reason,
      skippedReason: reason,
      details: { issues: profileResult.error.issues.slice(0, 3) },
    })
    return { ...makeSkippedSummary(row, reason), debug }
  }

  const runtimeProfile = await buildRuntimeProfile(row.id, profileResult.data, row.profile_json)
  const profile = runtimeProfile.profile
  const { oauth2Client, connection } = await getOAuthClientForUser(row.user_id).catch((error) => {
    throw new Error(error instanceof Error ? error.message : 'Gmail non connecté.')
  })

  if (!hasGmailModifyScope(connection)) {
    const reason = 'Autorisation Gmail à mettre à jour.'
    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      status: 'worker_skipped_gmail_scope',
      reason,
      skippedReason: reason,
    })
    return { ...makeSkippedSummary(row, reason), debug }
  }

  const initialQuota = await checkQuota(row.user_id, 'email_analysis', maxEmailsPerUser)
  if (!initialQuota.partiallyAllowed) {
    const reason = 'Votre limite mensuelle est atteinte pour cette action.'
    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      status: 'worker_quota_blocked',
      reason,
      skippedReason: reason,
      details: {
        eventType: 'email_analysis',
        remaining: initialQuota.remaining,
        limit: initialQuota.limit,
        used: initialQuota.used,
      },
    })
    return { ...makeSkippedSummary(row, reason), debug }
  }

  const effectiveLimit = Math.min(maxEmailsPerUser, initialQuota.allowedAmount)
  const monthlyEstimatedAiCost = await getMonthlyEstimatedAiCost(row.user_id)
  const monthlyAiBudget = getPlanAiBudgetEur(subscriptionPlan)
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const labelResult = await ensureRealGmailLabels(row.user_id)
  const labelMap = buildLabelMap(labelResult)
  const writingStyleProfile = await getWritingStyleProfile(row.user_id)
  const telegramConnection = await getTelegramConnection(row.user_id)
  const processedIds = await getAlreadyProcessedMessageIds(row.user_id)
  const availableCategories = profile.categories.map((category) => ({
    name: category.name,
    description: category.description,
    actions: enabledActions(category.actions),
  }))
  debug.categories = profile.categories.map((category) => ({
    name: category.name,
    savedActions: category.actions,
    rawActionFields: rawActionFields({
      profileCategory: category,
      rawProfileCategory: runtimeProfile.rawCategoriesByName.get(category.name) || null,
      row: runtimeProfile.rowsByCategoryName.get(category.name) || null,
    }),
    requiresDraft: categoryRequiresDraftFromConfig({
      profileCategory: category,
      rawProfileCategory: runtimeProfile.rawCategoriesByName.get(category.name) || null,
      row: runtimeProfile.rowsByCategoryName.get(category.name) || null,
    }),
    gmailLabelId: labelMap.get(normalizeName(category.name)) || null,
  }))

  if (process.env.NODE_ENV !== 'production') {
    console.info('[worker/process-gmail] loaded category config', {
      userId: row.user_id,
      automationProfileId: row.id,
      categories: debug.categories,
    })
  }

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox is:unread -in:sent -in:spam -in:trash newer_than:14d',
    maxResults: Math.min(effectiveLimit * 8, 40),
  })
  const messageRefs = listResponse.data.messages || []

  let analyzed = 0
  let labelsApplied = 0
  let draftsCreated = 0
  let needsReview = 0
  let skippedAlreadyProcessed = 0
  let skippedOther = 0
  let quotaStopped = false
  let selectedForProcessing = 0
  const preparedEmails: PreparedEmail[] = []

  async function recordCustomerProcessedEmail(input: {
    messageId?: string | null
    threadId?: string | null
    source?: 'worker'
  }) {
    await recordEmailProcessed(row.user_id, 1, {
      source: input.source || 'worker',
      relatedGmailMessageId: input.messageId || null,
      relatedThreadId: input.threadId || null,
    })
    debug.processedByWorker += 1
    debug.customerProcessedUsageIncremented += 1
  }

  async function processClassifiedEmail(input: {
    item: PreparedEmail
    classification: WorkerClassificationDecision
    source: 'rule' | 'llm'
    provider?: string | null
    model?: string | null
  }) {
    const { item, classification, source } = input
    const message = item.message
    const messageId = item.messageId
    const sender = item.sender
    const subject = item.subject
    const body = item.body
    if (source === 'rule') {
      await recordCustomerProcessedEmail({
        messageId,
        threadId: message.threadId || null,
      })
    }
    const category = profile.categories.find((candidate) => candidate.name === classification.category)
    const labelId = category ? labelMap.get(normalizeName(category.name)) : null
    const highConfidence = classification.confidence >= 0.75
    const categoryRequiresDraft = category
      ? categoryRequiresDraftFromConfig({
          profileCategory: category,
          rawProfileCategory: runtimeProfile.rawCategoriesByName.get(category.name) || null,
          row: runtimeProfile.rowsByCategoryName.get(category.name) || null,
        })
      : false
    let labelApplied = false
    let draftId: string | null = null
    let status = highConfidence ? 'processed' : 'needs_review'
    let reason = classification.reason
    let action: 'label_only' | 'draft_reply' | null = null
    let draftDecisionReason = 'Brouillon non demandé par cette catégorie.'
    let draftQuotaAllowed: boolean | null = null
    let draftComplexity: DraftComplexity | null = null
    let draftModel: string | null = null
    let telegramSent = false
    let telegramDecisionReason: string | null = null

    if (!category || !labelId) {
      status = 'needs_review'
      reason = category ? `Mapping Gmail introuvable pour le label ${category.name}.` : 'Catégorie non reconnue.'
      if (!category) debug.skippedNoMatchingCategory += 1
    }

    if (!highConfidence) {
      debug.skippedLowConfidence += 1
      draftDecisionReason = `Confiance insuffisante (${classification.confidence}).`
    }

    if (highConfidence && category && labelId && classification.shouldApplyLabel) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { addLabelIds: [labelId] },
        })
        labelApplied = true
        labelsApplied += 1
        if (source === 'rule') debug.ruleLabelsApplied += 1
        action = 'label_only'
      } catch {
        status = 'error'
        reason = 'Erreur lors de l’application du label.'
      }
    } else if (highConfidence && category && labelId && !classification.shouldApplyLabel) {
      status = 'needs_review'
      reason = classification.reason || 'Classification à vérifier avant application du label.'
    }

    const duplicateDraftExists = await hasExistingDraftLog(row.user_id, messageId, message.threadId)
    const emailNeedsReply = seemsToNeedReply({ sender, subject, body })
    const canCreateDraft =
      status === 'processed' &&
      highConfidence &&
      categoryRequiresDraft &&
      emailNeedsReply &&
      !duplicateDraftExists

    if (!categoryRequiresDraft && category && highConfidence) {
      debug.skippedNoDraftAction += 1
    } else if (categoryRequiresDraft && !emailNeedsReply) {
      debug.skippedNoReplyNeeded += 1
      draftDecisionReason = 'Email détecté comme ne nécessitant pas de réponse.'
    } else if (categoryRequiresDraft && duplicateDraftExists) {
      debug.skippedDuplicateDraft += 1
      draftDecisionReason = 'Un brouillon existe déjà pour ce message ou ce fil.'
    }

    if (canCreateDraft && category) {
      if (!hasGmailModifyScope(connection)) {
        reason = 'Autorisation Gmail à mettre à jour.'
        draftDecisionReason = reason
        debug.skippedMissingComposeScope += 1
      } else {
        const budgetReached = monthlyEstimatedAiCost + (debug.estimatedCost.total || 0) >= monthlyAiBudget
        if (budgetReached && classification.importance !== 'urgent') {
          reason = 'Budget IA interne atteint pour les brouillons non urgents.'
          draftDecisionReason = reason
          debug.skippedDraftBudget += 1
        } else {
        const draftQuota = await checkQuota(row.user_id, 'ai_draft', 1)
        draftQuotaAllowed = draftQuota.allowed
        if (!draftQuota.allowed) {
          reason = 'Votre limite de brouillons IA est atteinte pour ce mois-ci.'
          draftDecisionReason = reason
          debug.skippedDraftQuota += 1
        } else {
          try {
            debug.draftGenerationCalls += 1
            const incomingEmailForDraft = makeIncomingEmailForDraft({
              sender,
              subject,
              body,
              categoryName: category.name,
              classificationReason: classification.reason,
            })
            draftComplexity = chooseDraftComplexity({
              subject,
              body,
              importance: classification.importance,
            })
            debug.estimatedPromptChars += incomingEmailForDraft.length
            const draftContent = await generateAiDraftReply({
              profile,
              writingStyleProfile,
              incomingEmail: incomingEmailForDraft,
              complexity: draftComplexity,
            })
            draftModel = draftContent.model
            addUnique(debug.draftModels, draftContent.model)
            addCostEstimate({
              debug,
              kind: 'draft',
              model: draftContent.model,
              inputChars: incomingEmailForDraft.length + 1800,
              outputChars: `${draftContent.subject}\n${draftContent.body}`.length,
              complexity: draftComplexity,
            })

            draftId = await createReplyDraft({
              gmail,
              message,
              to: extractEmailAddress(sender),
              subject: draftContent.subject || naturalReplySubject(subject),
              body: draftContent.body,
            })

            if (draftId) {
              draftsCreated += 1
              action = 'draft_reply'
              draftDecisionReason = 'Brouillon créé via génération IA dédiée car la catégorie le demande.'
              await recordUsage(row.user_id, 'ai_draft', 1, {
                source: 'worker',
                relatedGmailMessageId: messageId,
                relatedThreadId: message.threadId || null,
              })
            }
          } catch (error) {
            status = 'error'
            reason = 'Erreur lors de la création du brouillon.'
            draftDecisionReason = error instanceof Error ? error.message : reason
            debug.failedDraftCreation += 1
          }
        }
        }
      }
    }

    const telegramAllowedByPlan = subscriptionPlan === 'pro' || subscriptionPlan === 'premium'
    const telegramPreference = profile.global_settings.telegram_preference || (profile.global_settings.telegram_enabled ? 'important_only' : 'none')
    const categoryWantsTelegram = telegramPreference === 'all_selected' && Boolean(category?.actions.telegram)
    const urgentGlobalTelegram = telegramPreference === 'important_only' && classification.importance === 'urgent'
    const shouldAttemptTelegram =
      status === 'processed' &&
      highConfidence &&
      Boolean(category) &&
      (categoryWantsTelegram || urgentGlobalTelegram)

    if (shouldAttemptTelegram && category) {
      if (!telegramAllowedByPlan) {
        telegramDecisionReason = 'Telegram non inclus dans cette offre.'
      } else if (!telegramConnection.connected || !telegramConnection.chatId) {
        telegramDecisionReason = 'Telegram non connecté.'
      } else {
        const duplicateTelegramAlert = await hasTelegramAlertForMessage(row.user_id, messageId)
        if (duplicateTelegramAlert) {
          telegramDecisionReason = 'Alerte Telegram déjà envoyée pour ce message.'
        } else {
          const telegramQuota = await checkQuota(row.user_id, 'telegram_alert', 1)
          if (!telegramQuota.allowed) {
            telegramDecisionReason = 'Quota Telegram mensuel atteint.'
          } else {
            try {
              const telegramMessageId = await sendTelegramMessage(
                telegramConnection.chatId,
                buildTelegramAlertText({
                  categoryName: category.name,
                  subject,
                  labelApplied,
                  draftCreated: Boolean(draftId),
                  urgent: classification.importance === 'urgent',
                }),
              )
              await recordUsage(row.user_id, 'telegram_alert', 1, {
                source: 'worker',
                relatedGmailMessageId: messageId,
                relatedThreadId: message.threadId || null,
              })
              await logTelegramAlert({
                userId: row.user_id,
                gmailMessageId: messageId,
                telegramMessageId,
                category: category.name,
                status: 'sent',
              })
              telegramSent = true
              telegramDecisionReason = 'Alerte Telegram envoyée.'
            } catch {
              telegramDecisionReason = 'Erreur lors de l’envoi Telegram.'
              await logTelegramAlert({
                userId: row.user_id,
                gmailMessageId: messageId,
                category: category.name,
                status: 'error',
              })
            }
          }
        }
      }
    }

    if (status === 'needs_review') needsReview += 1
    analyzed += 1

    pushEmailDebug(debug, {
      messageId,
      subject,
      selectedCategory: classification.category,
      confidence: classification.confidence,
      status: draftId ? 'draft_created' : labelApplied ? 'labeled' : status,
      reason,
      draftDecisionReason,
      categoryRequiresDraft,
      draftQuotaAllowed,
      draftCreated: Boolean(draftId),
      classificationSource: source,
      ruleReason: source === 'rule' ? classification.reason : item.ruleReason,
      draftComplexity,
      draftModel,
      telegramSent,
      telegramDecisionReason,
    })

    await logWorkerEvent({
      userId: row.user_id,
      automationProfileId: row.id,
      gmailMessageId: messageId,
      threadId: message.threadId || null,
      sender,
      subject,
      predictedCategory: classification.category,
      confidence: classification.confidence,
      importance: classification.importance,
      labelApplied,
      draftCreated: Boolean(draftId),
      draftId,
      categoryKey: category?.id || null,
      action,
      status,
      reason,
      skippedReason: status === 'needs_review' ? 'Confiance insuffisante ou mapping à vérifier.' : null,
      details: {
        availableCategories,
        threadContextUsed: false,
        classificationSource: source,
        draftDecisionReason,
        categoryRequiresDraft,
        draftQuotaAllowed,
        draftComplexity,
        draftModel,
        aiShouldCreateDraft: classification.shouldCreateDraft,
        aiReturnedDraft: false,
        duplicateDraftExists,
        emailNeedsReply,
        shouldNotifyTelegram: false,
        telegramSent,
        telegramDecisionReason,
        archiveSuggested: Boolean(classification.archiveSuggested),
        provider: input.provider || null,
        model: input.model || null,
      },
    })
    processedIds.add(messageId)
  }

  for (const messageRef of messageRefs) {
    if (selectedForProcessing >= effectiveLimit) break
    if (!messageRef.id) continue

    if (processedIds.has(messageRef.id)) {
      skippedAlreadyProcessed += 1
      debug.skippedAlreadyProcessed += 1
      continue
    }

    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageRef.id,
      format: 'full',
    })
    const message = messageResponse.data
    const messageId = message.id || messageRef.id
    const sender = getGmailHeader(message, 'From')
    const subject = getGmailHeader(message, 'Subject') || '(Sans objet)'
    const body = extractGmailMessageText(message)
    selectedForProcessing += 1

    if (!body || body.length < 20 || isLikelyAutomatedMessage(message, body)) {
      const reason = !body || body.length < 20 ? 'Email trop court pour une analyse fiable.' : 'Email probablement automatique ou newsletter.'
      skippedOther += 1
      debug.skippedBeforeAi += 1
      pushEmailDebug(debug, {
        messageId,
        subject,
        selectedCategory: null,
        confidence: null,
        status: 'skipped',
        reason,
        draftDecisionReason: reason,
        categoryRequiresDraft: false,
        draftQuotaAllowed: null,
        draftCreated: false,
      })
      await logWorkerEvent({
        userId: row.user_id,
        automationProfileId: row.id,
        gmailMessageId: messageId,
        threadId: message.threadId || null,
        sender,
        subject,
        status: 'skipped',
        reason,
        skippedReason: reason,
        details: { availableCategories },
      })
      await recordCustomerProcessedEmail({
        messageId,
        threadId: message.threadId || null,
      })
      processedIds.add(messageId)
      continue
    }

    const ruleDecision = buildRuleDecision({ profile, sender, subject, body })
    if (ruleDecision.type === 'skip') {
      skippedOther += 1
      debug.skippedBeforeAi += 1
      debug.skippedByRules += 1
      pushEmailDebug(debug, {
        messageId,
        subject,
        selectedCategory: null,
        confidence: null,
        status: 'skipped',
        reason: ruleDecision.reason,
        draftDecisionReason: ruleDecision.reason,
        categoryRequiresDraft: false,
        draftQuotaAllowed: null,
        draftCreated: false,
        classificationSource: 'rule',
        ruleReason: ruleDecision.reason,
      })
      await logWorkerEvent({
        userId: row.user_id,
        automationProfileId: row.id,
        gmailMessageId: messageId,
        threadId: message.threadId || null,
        sender,
        subject,
        status: 'skipped',
        reason: ruleDecision.reason,
        skippedReason: ruleDecision.reason,
        details: { availableCategories, classificationSource: 'rule' },
      })
      await recordCustomerProcessedEmail({
        messageId,
        threadId: message.threadId || null,
      })
      processedIds.add(messageId)
      continue
    }

    if (ruleDecision.type === 'classify') {
      debug.ruleClassified += 1
      await processClassifiedEmail({
        item: {
          message,
          messageId,
          sender,
          subject,
          body,
          snippet: message.snippet || null,
          ruleCandidateCategory: ruleDecision.decision.category,
          ruleReason: ruleDecision.reason,
        },
        classification: ruleDecision.decision,
        source: 'rule',
      })
      continue
    }

    const ruleCandidate = inferRuleCandidateCategory(profile, { sender, subject, body })
    preparedEmails.push({
      message,
      messageId,
      sender,
      subject,
      body,
      snippet: message.snippet || null,
      ruleCandidateCategory: ruleCandidate.category,
      ruleReason: ruleCandidate.reason,
    })
  }

  for (let start = 0; start < preparedEmails.length; start += WORKER_BATCH_SIZE) {
    const batch = preparedEmails.slice(start, start + WORKER_BATCH_SIZE)
    const currentQuota = await checkQuota(row.user_id, 'email_analysis', batch.length)
    if (!currentQuota.partiallyAllowed) {
      const reason = 'Votre limite mensuelle est atteinte pour cette action.'
      quotaStopped = true
      await logWorkerEvent({
        userId: row.user_id,
        automationProfileId: row.id,
        status: 'worker_quota_blocked',
        reason,
        skippedReason: reason,
        details: {
          eventType: 'email_analysis',
          remaining: currentQuota.remaining,
          limit: currentQuota.limit,
          used: currentQuota.used,
        },
      })
      break
    }

    const allowedBatch = batch.slice(0, currentQuota.allowedAmount)
    if (allowedBatch.length < batch.length) quotaStopped = true

    try {
      const batchInput = allowedBatch.map((item) => ({
        id: item.messageId,
        from: compactSenderForAi(item.sender),
        subject: item.subject,
        snippet: item.snippet,
        bodyPreview: item.body.slice(0, 700),
        ruleCandidateCategory: item.ruleCandidateCategory,
        ruleReason: item.ruleReason,
      }))
      debug.emailsSentToLlm += allowedBatch.length
      debug.sentToAi += allowedBatch.length
      debug.llmClassificationCalls += 1
      debug.estimatedPromptChars += JSON.stringify(batchInput).length

      const batchClassification = await classifyIncomingEmailsBatch({
        profile,
        writingStyleProfile,
        emails: batchInput,
      })
      addUnique(debug.classificationModels, batchClassification.model)
      addCostEstimate({
        debug,
        kind: 'classification',
        model: batchClassification.model,
        inputChars: JSON.stringify({
          categories: availableCategories,
          emails: batchInput,
        }).length,
        outputChars: JSON.stringify(batchClassification.results).length,
      })

      for (const item of allowedBatch) {
        await recordUsage(row.user_id, 'email_analysis', 1, {
          source: 'worker',
          relatedGmailMessageId: item.messageId,
          relatedThreadId: item.message.threadId || null,
        })
        debug.processedByWorker += 1
        debug.customerProcessedUsageIncremented += 1
        debug.aiAnalyzedUsageIncremented += 1
      }

      const resultsById = new Map(batchClassification.results.map((result) => [result.email_id, result]))

      for (const item of allowedBatch) {
        const classification = resultsById.get(item.messageId)
        const message = item.message
        const messageId = item.messageId
        const sender = item.sender
        const subject = item.subject
        const body = item.body

        if (!classification) {
          skippedOther += 1
          analyzed += 1
          needsReview += 1
          debug.skippedNoMatchingCategory += 1
          pushEmailDebug(debug, {
            messageId,
            subject,
            selectedCategory: null,
            confidence: null,
            status: 'needs_review',
            reason: 'Aucun résultat de classification retourné pour cet email.',
            draftDecisionReason: 'Classification batch incomplète.',
            categoryRequiresDraft: false,
            draftQuotaAllowed: null,
            draftCreated: false,
          })
          await logWorkerEvent({
            userId: row.user_id,
            automationProfileId: row.id,
            gmailMessageId: messageId,
            threadId: message.threadId || null,
            sender,
            subject,
            status: 'needs_review',
            reason: 'Aucun résultat de classification retourné pour cet email.',
            skippedReason: 'Classification batch incomplète.',
            details: { availableCategories },
          })
          processedIds.add(messageId)
          continue
        }

      const category = profile.categories.find((candidate) => candidate.name === classification.category)
      const labelId = category ? labelMap.get(normalizeName(category.name)) : null
      const highConfidence = classification.confidence >= 0.75
      const categoryRequiresDraft = category
        ? categoryRequiresDraftFromConfig({
            profileCategory: category,
            rawProfileCategory: runtimeProfile.rawCategoriesByName.get(category.name) || null,
            row: runtimeProfile.rowsByCategoryName.get(category.name) || null,
          })
        : false
      let labelApplied = false
      let draftId: string | null = null
      let status = highConfidence ? 'processed' : 'needs_review'
      let reason = classification.reason
      let action: 'label_only' | 'draft_reply' | null = null
      let draftDecisionReason = 'Brouillon non demandé par cette catégorie.'
      let draftQuotaAllowed: boolean | null = null
      let draftComplexity: DraftComplexity | null = null
      let draftModel: string | null = null
      let telegramSent = false
      let telegramDecisionReason: string | null = null

      if (!category || !labelId) {
        status = 'needs_review'
        reason = category ? `Mapping Gmail introuvable pour le label ${category.name}.` : 'Catégorie non reconnue.'
        if (!category) debug.skippedNoMatchingCategory += 1
      }

      if (!highConfidence) {
        debug.skippedLowConfidence += 1
        draftDecisionReason = `Confiance insuffisante (${classification.confidence}).`
      }

      if (highConfidence && category && labelId && classification.shouldApplyLabel) {
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: { addLabelIds: [labelId] },
          })
          labelApplied = true
          labelsApplied += 1
          action = 'label_only'
        } catch {
          status = 'error'
          reason = 'Erreur lors de l’application du label.'
        }
      } else if (highConfidence && category && labelId && !classification.shouldApplyLabel) {
        status = 'needs_review'
        reason = classification.reason || 'Classification à vérifier avant application du label.'
      }

      const duplicateDraftExists = await hasExistingDraftLog(row.user_id, messageId, message.threadId)
      const emailNeedsReply = seemsToNeedReply({ sender, subject, body })
      const canCreateDraft =
        status === 'processed' &&
        highConfidence &&
        categoryRequiresDraft &&
        emailNeedsReply &&
        !duplicateDraftExists

      if (!categoryRequiresDraft && category && highConfidence) {
        debug.skippedNoDraftAction += 1
      } else if (categoryRequiresDraft && !emailNeedsReply) {
        debug.skippedNoReplyNeeded += 1
        draftDecisionReason = 'Email détecté comme ne nécessitant pas de réponse.'
      } else if (categoryRequiresDraft && duplicateDraftExists) {
        debug.skippedDuplicateDraft += 1
        draftDecisionReason = 'Un brouillon existe déjà pour ce message ou ce fil.'
      }

      if (canCreateDraft && category) {
        if (!hasGmailModifyScope(connection)) {
          reason = 'Autorisation Gmail à mettre à jour.'
          draftDecisionReason = reason
          debug.skippedMissingComposeScope += 1
        } else {
          const budgetReached = monthlyEstimatedAiCost + (debug.estimatedCost.total || 0) >= monthlyAiBudget
          if (budgetReached && classification.importance !== 'urgent') {
            reason = 'Budget IA interne atteint pour les brouillons non urgents.'
            draftDecisionReason = reason
            debug.skippedDraftBudget += 1
          } else {
          const draftQuota = await checkQuota(row.user_id, 'ai_draft', 1)
          draftQuotaAllowed = draftQuota.allowed
          if (!draftQuota.allowed) {
            reason = 'Votre limite de brouillons IA est atteinte pour ce mois-ci.'
            draftDecisionReason = reason
            debug.skippedDraftQuota += 1
          } else {
            try {
              debug.draftGenerationCalls += 1
              const incomingEmailForDraft = makeIncomingEmailForDraft({
                sender,
                subject,
                body,
                categoryName: category.name,
                classificationReason: classification.reason,
              })
              draftComplexity = chooseDraftComplexity({
                subject,
                body,
                importance: classification.importance,
              })
              debug.estimatedPromptChars += incomingEmailForDraft.length
              const draftContent = await generateAiDraftReply({
                profile,
                writingStyleProfile,
                incomingEmail: incomingEmailForDraft,
                complexity: draftComplexity,
              })
              draftModel = draftContent.model
              addUnique(debug.draftModels, draftContent.model)
              addCostEstimate({
                debug,
                kind: 'draft',
                model: draftContent.model,
                inputChars: incomingEmailForDraft.length + 1800,
                outputChars: `${draftContent.subject}\n${draftContent.body}`.length,
                complexity: draftComplexity,
              })

              draftId = await createReplyDraft({
                gmail,
                message,
                to: extractEmailAddress(sender),
                subject: draftContent.subject || naturalReplySubject(subject),
                body: draftContent.body,
              })

              if (draftId) {
                draftsCreated += 1
                action = 'draft_reply'
                draftDecisionReason = 'Brouillon créé via génération IA dédiée car la catégorie le demande.'
                await recordUsage(row.user_id, 'ai_draft', 1, {
                  source: 'worker',
                  relatedGmailMessageId: messageId,
                  relatedThreadId: message.threadId || null,
                })
              }
            } catch {
              status = 'error'
              reason = 'Erreur lors de la création du brouillon.'
              draftDecisionReason = reason
              debug.failedDraftCreation += 1
            }
          }
        }
      }
      }

      const telegramAllowedByPlan = subscriptionPlan === 'pro' || subscriptionPlan === 'premium'
      const telegramPreference = profile.global_settings.telegram_preference || (profile.global_settings.telegram_enabled ? 'important_only' : 'none')
      const categoryWantsTelegram = telegramPreference === 'all_selected' && Boolean(category?.actions.telegram)
      const urgentGlobalTelegram = telegramPreference === 'important_only' && classification.importance === 'urgent'
      const shouldAttemptTelegram =
        status === 'processed' &&
        highConfidence &&
        Boolean(category) &&
        (categoryWantsTelegram || urgentGlobalTelegram)

      if (shouldAttemptTelegram && category) {
        if (!telegramAllowedByPlan) {
          telegramDecisionReason = 'Telegram non inclus dans cette offre.'
        } else if (!telegramConnection.connected || !telegramConnection.chatId) {
          telegramDecisionReason = 'Telegram non connecté.'
        } else {
          const duplicateTelegramAlert = await hasTelegramAlertForMessage(row.user_id, messageId)
          if (duplicateTelegramAlert) {
            telegramDecisionReason = 'Alerte Telegram déjà envoyée pour ce message.'
          } else {
            const telegramQuota = await checkQuota(row.user_id, 'telegram_alert', 1)
            if (!telegramQuota.allowed) {
              telegramDecisionReason = 'Quota Telegram mensuel atteint.'
            } else {
              try {
                const telegramMessageId = await sendTelegramMessage(
                  telegramConnection.chatId,
                  buildTelegramAlertText({
                    categoryName: category.name,
                    subject,
                    labelApplied,
                    draftCreated: Boolean(draftId),
                    urgent: classification.importance === 'urgent',
                  }),
                )
                await recordUsage(row.user_id, 'telegram_alert', 1, {
                  source: 'worker',
                  relatedGmailMessageId: messageId,
                  relatedThreadId: message.threadId || null,
                })
                await logTelegramAlert({
                  userId: row.user_id,
                  gmailMessageId: messageId,
                  telegramMessageId,
                  category: category.name,
                  status: 'sent',
                })
                telegramSent = true
                telegramDecisionReason = 'Alerte Telegram envoyée.'
              } catch {
                telegramDecisionReason = 'Erreur lors de l’envoi Telegram.'
                await logTelegramAlert({
                  userId: row.user_id,
                  gmailMessageId: messageId,
                  category: category.name,
                  status: 'error',
                })
              }
            }
          }
        }
      }

      if (status === 'needs_review') needsReview += 1
      analyzed += 1

      pushEmailDebug(debug, {
        messageId,
        subject,
        selectedCategory: classification.category,
        confidence: classification.confidence,
        status: draftId ? 'draft_created' : labelApplied ? 'labeled' : status,
        reason,
        draftDecisionReason,
        categoryRequiresDraft,
        draftQuotaAllowed,
        draftCreated: Boolean(draftId),
        classificationSource: 'llm',
        ruleReason: item.ruleReason,
        draftComplexity,
        draftModel,
        telegramSent,
        telegramDecisionReason,
      })

      await logWorkerEvent({
        userId: row.user_id,
        automationProfileId: row.id,
        gmailMessageId: messageId,
        threadId: message.threadId || null,
        sender,
        subject,
        predictedCategory: classification.category,
        confidence: classification.confidence,
        importance: classification.importance,
        labelApplied,
        draftCreated: Boolean(draftId),
        draftId,
        categoryKey: category?.id || null,
        action,
        status,
        reason,
        skippedReason: status === 'needs_review' ? 'Confiance insuffisante ou mapping à vérifier.' : null,
        details: {
          availableCategories,
          threadContextUsed: false,
          draftDecisionReason,
          categoryRequiresDraft,
          draftComplexity,
          draftModel,
          categoryRawActionFields: category
            ? rawActionFields({
                profileCategory: category,
                rawProfileCategory: runtimeProfile.rawCategoriesByName.get(category.name) || null,
                row: runtimeProfile.rowsByCategoryName.get(category.name) || null,
              })
            : null,
          draftQuotaAllowed,
          aiShouldCreateDraft: classification.shouldCreateDraft,
          aiReturnedDraft: false,
          duplicateDraftExists,
          emailNeedsReply,
          shouldNotifyTelegram: false,
          telegramSent,
          telegramDecisionReason,
          archiveSuggested: Boolean(classification.archiveSuggested),
          provider: batchClassification.provider,
          model: batchClassification.model,
        },
      })
      processedIds.add(messageId)
      }
    } catch (error) {
      const safeErrorMessage = error instanceof Error ? error.message : 'Erreur IA ou Gmail.'
      for (const item of allowedBatch) {
        skippedOther += 1
        pushEmailDebug(debug, {
          messageId: item.messageId,
          subject: item.subject,
          selectedCategory: null,
          confidence: null,
          status: 'error',
          reason: 'Analyse impossible pour le moment.',
          draftDecisionReason: safeErrorMessage,
          categoryRequiresDraft: false,
          draftQuotaAllowed: null,
          draftCreated: false,
        })
        await logWorkerEvent({
          userId: row.user_id,
          automationProfileId: row.id,
          gmailMessageId: item.messageId,
          threadId: item.message.threadId || null,
          sender: item.sender,
          subject: item.subject,
          status: 'error',
          reason: 'Analyse impossible pour le moment.',
          skippedReason: 'Erreur IA ou Gmail.',
          details: {
            message: safeErrorMessage,
          },
        })
        processedIds.add(item.messageId)
      }
    }
  }

  const reason = quotaStopped
    ? 'Traitement arrêté car le quota mensuel est atteint.'
    : `Traitement automatique terminé : ${analyzed} email(s) analysé(s).`
  await logWorkerEvent({
    userId: row.user_id,
    automationProfileId: row.id,
    status: quotaStopped ? 'worker_quota_blocked' : 'worker_run_completed',
    reason,
    details: {
      fetched: messageRefs.length,
      analyzed,
      labelsApplied,
      draftsCreated,
      needsReview,
      skippedAlreadyProcessed,
      skippedOther,
      maxEmailsPerUser,
      debug,
    },
  })

  await addMonthlyEstimatedAiCost(row.user_id, debug.estimatedCost.total)
  await updateWorkerRunTracking({
    automationProfileId: row.id,
    status: quotaStopped ? 'worker_quota_blocked' : 'worker_run_completed',
    processedCount: analyzed,
    estimatedCost: debug.estimatedCost.total,
  })

  return {
    userId: row.user_id,
    automationProfileId: row.id,
    status: quotaStopped ? 'skipped' : 'processed',
    reason,
    fetched: messageRefs.length,
    analyzed,
    labelsApplied,
    draftsCreated,
    needsReview,
    skippedAlreadyProcessed,
    skippedOther,
    debug,
  }
}

async function handleWorker(request: NextRequest) {
  const expectedSecret = process.env.WORKER_SECRET
  if (!expectedSecret?.trim()) {
    return jsonError(503, 'worker_secret', 'WORKER_SECRET n’est pas configuré.')
  }

  if (!safeSecretMatches(request.headers.get('x-worker-secret'), expectedSecret)) {
    return jsonError(401, 'worker_secret', 'Accès worker refusé.')
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return jsonError(503, 'supabase', 'Configuration Supabase serveur indisponible.')
  }

  const options = await getWorkerOptions(request)
  let lock: WorkerLock

  try {
    lock = await acquireGlobalWorkerLock(supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verrou worker indisponible.'
    console.warn('[worker/process-gmail] global lock unavailable', { message })
    return jsonError(503, 'worker_lock', 'Verrou global du worker indisponible. Appliquez la migration Supabase du verrou.')
  }

  if (!lock.acquired) {
    console.info('[worker/process-gmail] run skipped because lock is active', {
      lockKey: lock.lockKey,
      existingOwnerId: lock.existingOwnerId,
      existingLockedUntil: lock.existingLockedUntil,
    })

    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'worker_already_running',
      message: 'Un autre traitement Gmail est deja en cours.',
      lock: {
        lockKey: lock.lockKey,
        lockedUntil: lock.existingLockedUntil,
      },
      force: options.force,
      sent: false,
      permanentDelete: false,
    })
  }

  try {
    const rows = await getCandidateAutomationProfiles(options.maxUsers)
    await warnDuplicateGmailConnections(rows)
    const summaries: WorkerUserSummary[] = []
    let processedUsers = 0
    let skippedUsers = 0
    let erroredUsers = 0

    for (const row of rows) {
      try {
        const summary = await processUserProfile(row, {
          maxEmailsPerUser: options.maxEmailsPerUser,
          force: options.force,
        })
        summaries.push(summary)
        if (summary.status === 'processed') processedUsers += 1
        else skippedUsers += 1
      } catch (error) {
        erroredUsers += 1
        const reason = error instanceof Error ? error.message : 'Erreur worker inconnue.'
        await logWorkerEvent({
          userId: row.user_id,
          automationProfileId: row.id,
          status: 'worker_error',
          reason: 'Traitement automatique impossible pour ce compte.',
          skippedReason: reason,
        })
        summaries.push({
          ...makeSkippedSummary(row, 'Traitement automatique impossible pour ce compte.'),
          status: 'error',
          reason,
        })
      }
    }

    console.info('[worker/process-gmail] run completed', {
      candidateUsers: rows.length,
      processedUsers,
      skippedUsers,
      erroredUsers,
      maxEmailsPerUser: options.maxEmailsPerUser,
      lockOwnerId: lock.ownerId,
    })

    const isDev = process.env.NODE_ENV !== 'production'

    return NextResponse.json({
      ok: true,
      processedUsers,
      skippedUsers,
      erroredUsers,
      maxEmailsPerUser: options.maxEmailsPerUser,
      force: options.force,
      lock: isDev
        ? {
            lockKey: lock.lockKey,
            ownerId: lock.ownerId,
            lockedUntil: lock.lockedUntil,
          }
        : undefined,
      users: isDev ? summaries : summaries.map(hideDebug),
      debug: isDev ? aggregateDebugSummaries(summaries) : undefined,
      sent: false,
      permanentDelete: false,
    })
  } finally {
    await releaseGlobalWorkerLock(supabase, lock)
  }
}

export async function POST(request: NextRequest) {
  return handleWorker(request)
}

export async function GET(request: NextRequest) {
  return handleWorker(request)
}

