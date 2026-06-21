import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  CREDIT_COST_BY_EVENT,
  PLAN_LIMITS,
  PREMIUM_LIMITS,
  PRO_LIMITS,
  STARTER_LIMITS,
  canUseFeature,
  getEventLimit,
  getPlanLimits,
  normalizePlanId,
  type AiUsageEventType,
  type PlanLimits,
  type TooliaPlanId,
} from './plan-config'
import { getEntitledPlanIdForUser } from './subscription-store'

export {
  STARTER_LIMITS,
  PRO_LIMITS,
  PREMIUM_LIMITS,
  getPlanLimits,
  canUseFeature,
  normalizePlanId,
  type AiUsageEventType,
  type PlanLimits,
  type TooliaPlanId,
}

export type MonthlyUsage = {
  monthKey: string
  emailsAnalyzed: number
  emailsProcessed: number
  emailsAiAnalyzed: number
  aiDraftsCreated: number
  telegramAlertsSent: number
  styleAnalysesUsed: number
  creditsUsed: number
}

export type UsageSnapshot = {
  plan: TooliaPlanId
  limits: PlanLimits
  current: MonthlyUsage
  remaining: {
    emailAnalysis: number
    aiDraft: number
    telegramAlert: number
    styleAnalysis: number
  }
}

type UsageMetadata = {
  source?: 'manual' | 'worker' | 'dashboard' | 'learning' | 'classification'
  relatedGmailMessageId?: string | null
  relatedThreadId?: string | null
}

export function getCurrentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

function zeroUsage(monthKey = getCurrentMonthKey()): MonthlyUsage {
  return {
    monthKey,
    emailsAnalyzed: 0,
    emailsProcessed: 0,
    emailsAiAnalyzed: 0,
    aiDraftsCreated: 0,
    telegramAlertsSent: 0,
    styleAnalysesUsed: 0,
    creditsUsed: 0,
  }
}

function rowToUsage(row: Record<string, unknown> | null | undefined, monthKey = getCurrentMonthKey()): MonthlyUsage {
  if (!row) return zeroUsage(monthKey)
  const emailsProcessed = Number(row.emails_processed ?? row.emails_analyzed ?? 0)
  const emailsAiAnalyzed = Number(row.emails_ai_analyzed ?? row.emails_analyzed ?? 0)

  return {
    monthKey: String(row.month_key || monthKey),
    emailsAnalyzed: emailsProcessed,
    emailsProcessed,
    emailsAiAnalyzed,
    aiDraftsCreated: Number(row.ai_drafts_created || 0),
    telegramAlertsSent: Number(row.telegram_alerts_sent || 0),
    styleAnalysesUsed: Number(row.style_analyses_used || 0),
    creditsUsed: Number(row.credits_used || 0),
  }
}

function remainingFor(limits: PlanLimits, usage: MonthlyUsage) {
  return {
    emailAnalysis: Math.max(0, limits.emailAnalysesMonthly - usage.emailsProcessed),
    aiDraft: Math.max(0, limits.aiDraftsMonthly - usage.aiDraftsCreated),
    telegramAlert: Math.max(0, limits.telegramAlertsMonthly - usage.telegramAlertsSent),
    styleAnalysis: Math.max(0, limits.styleAnalysesMonthly - usage.styleAnalysesUsed),
  }
}

function getCurrentValue(usage: MonthlyUsage, eventType: AiUsageEventType) {
  if (eventType === 'email_analysis') return usage.emailsProcessed
  if (eventType === 'ai_draft') return usage.aiDraftsCreated
  if (eventType === 'telegram_alert') return usage.telegramAlertsSent
  return usage.styleAnalysesUsed
}

function getColumnUpdates(eventType: AiUsageEventType, amount: number, creditsUsed: number, current?: MonthlyUsage) {
  const base = {
    emails_analyzed: current?.emailsAnalyzed || 0,
    emails_processed: current?.emailsProcessed || current?.emailsAnalyzed || 0,
    emails_ai_analyzed: current?.emailsAiAnalyzed || 0,
    ai_drafts_created: current?.aiDraftsCreated || 0,
    telegram_alerts_sent: current?.telegramAlertsSent || 0,
    style_analyses_used: current?.styleAnalysesUsed || 0,
    credits_used: current?.creditsUsed || 0,
  }

  if (eventType === 'email_analysis') {
    base.emails_analyzed += amount
    base.emails_processed += amount
    base.emails_ai_analyzed += amount
  }
  if (eventType === 'ai_draft') base.ai_drafts_created += amount
  if (eventType === 'telegram_alert') base.telegram_alerts_sent += amount
  if (eventType === 'style_analysis') base.style_analyses_used += amount
  base.credits_used += creditsUsed

  return base
}

export async function getUserPlanId(userId: string): Promise<TooliaPlanId> {
  return getEntitledPlanIdForUser(userId)
}

export async function getMonthlyUsage(userId: string, monthKey = getCurrentMonthKey()): Promise<MonthlyUsage> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return zeroUsage(monthKey)

  const { data, error } = await supabase
    .from('monthly_usage')
    .select('month_key, emails_analyzed, emails_processed, emails_ai_analyzed, ai_drafts_created, telegram_alerts_sent, style_analyses_used, credits_used')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
      return zeroUsage(monthKey)
    }
    if (error.code === '42703' || error.message?.toLowerCase().includes('emails_processed') || error.message?.toLowerCase().includes('emails_ai_analyzed')) {
      const legacy = await supabase
        .from('monthly_usage')
        .select('month_key, emails_analyzed, ai_drafts_created, telegram_alerts_sent, style_analyses_used, credits_used')
        .eq('user_id', userId)
        .eq('month_key', monthKey)
        .maybeSingle()

      if (!legacy.error) return rowToUsage(legacy.data, monthKey)
    }
    throw error
  }

  return rowToUsage(data, monthKey)
}

export async function getMonthlyUsageSnapshot(userId: string): Promise<UsageSnapshot> {
  const plan = await getUserPlanId(userId)
  const limits = getPlanLimits(plan)
  const current = await getMonthlyUsage(userId)

  return {
    plan,
    limits,
    current,
    remaining: remainingFor(limits, current),
  }
}

export async function checkQuota(userId: string, eventType: AiUsageEventType, amount = 1) {
  const snapshot = await getMonthlyUsageSnapshot(userId)
  const limit = getEventLimit(snapshot.limits, eventType)
  const used = getCurrentValue(snapshot.current, eventType)
  const remaining = Math.max(0, limit - used)
  const allowedAmount = Math.min(amount, remaining)

  return {
    allowed: allowedAmount >= amount && limit > 0,
    partiallyAllowed: allowedAmount > 0,
    allowedAmount,
    remaining,
    limit,
    used,
    snapshot,
    message: 'Votre limite mensuelle est atteinte pour cette action.',
  }
}

export async function recordUsage(
  userId: string,
  eventType: AiUsageEventType,
  amount = 1,
  metadata: UsageMetadata = {},
) {
  if (amount <= 0) return null

  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const monthKey = getCurrentMonthKey()
  const creditsUsed = amount * CREDIT_COST_BY_EVENT[eventType]

  const current = await getMonthlyUsage(userId, monthKey)
  const updates = getColumnUpdates(eventType, amount, creditsUsed, current)

  const { data: existing, error: lookupError } = await supabase
    .from('monthly_usage')
    .select('user_id')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (lookupError && !(lookupError.code === '42P01' || lookupError.message?.toLowerCase().includes('does not exist'))) {
    throw lookupError
  }

  if (existing?.user_id) {
    const { error } = await supabase
      .from('monthly_usage')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('month_key', monthKey)
    if (error) throw error
  } else {
    const { error } = await supabase.from('monthly_usage').insert({
      user_id: userId,
      month_key: monthKey,
      ...updates,
    })
    if (error) throw error
  }

  return getMonthlyUsageSnapshot(userId)
}

export async function recordEmailProcessed(
  userId: string,
  amount = 1,
  metadata: UsageMetadata = {},
) {
  if (amount <= 0) return null

  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const monthKey = getCurrentMonthKey()
  const current = await getMonthlyUsage(userId, monthKey)
  const updates = {
    emails_analyzed: current.emailsProcessed + amount,
    emails_processed: current.emailsProcessed + amount,
    emails_ai_analyzed: current.emailsAiAnalyzed,
    ai_drafts_created: current.aiDraftsCreated,
    telegram_alerts_sent: current.telegramAlertsSent,
    style_analyses_used: current.styleAnalysesUsed,
    credits_used: current.creditsUsed,
  }

  const { data: existing, error: lookupError } = await supabase
    .from('monthly_usage')
    .select('user_id')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (lookupError && !(lookupError.code === '42P01' || lookupError.message?.toLowerCase().includes('does not exist'))) {
    throw lookupError
  }

  if (existing?.user_id) {
    const { error } = await supabase
      .from('monthly_usage')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('month_key', monthKey)
    if (error) throw error
  } else {
    const { error } = await supabase.from('monthly_usage').insert({
      user_id: userId,
      month_key: monthKey,
      ...updates,
    })
    if (error) throw error
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[usage] email processed without AI usage event', {
      userId,
      amount,
      source: metadata.source || 'worker',
      hasMessageId: Boolean(metadata.relatedGmailMessageId),
      hasThreadId: Boolean(metadata.relatedThreadId),
    })
  }

  return getMonthlyUsageSnapshot(userId)
}

export async function validateProfileAgainstPlan(userId: string, profile: {
  categories?: Array<{ actions?: { telegram?: boolean } }>
  global_settings?: { telegram_enabled?: boolean }
}) {
  const plan = await getUserPlanId(userId)
  const limits = getPlanLimits(plan)
  const categories = profile.categories || []

  if (categories.length > limits.maxLabels) {
    return {
      ok: false,
      message: 'Vous avez atteint la limite de labels de votre offre.',
      limits,
    }
  }

  if (
    !limits.telegramCategoryAlerts &&
    (profile.global_settings?.telegram_enabled || categories.some((category) => category.actions?.telegram))
  ) {
    return {
      ok: false,
      message: 'Cette action n’est pas incluse dans votre offre actuelle. Passez à Pro pour recevoir des alertes Telegram sur vos catégories importantes.',
      limits,
    }
  }

  return { ok: true, limits }
}
