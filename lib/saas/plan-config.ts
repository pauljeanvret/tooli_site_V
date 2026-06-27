export type TooliaPlanId = 'starter' | 'pro' | 'premium'
export type LegacyTooliaPlanId = TooliaPlanId | 'essential'
export type AiUsageEventType = 'email_analysis' | 'ai_draft' | 'telegram_alert' | 'style_analysis'

export type PlanLimits = {
  id: TooliaPlanId
  name: string
  monthlyPrice: number
  setupPrice: number
  maxLabels: number
  emailAnalysesMonthly: number
  aiDraftsMonthly: number
  telegramAlertsMonthly: number
  styleAnalysesMonthly: number
  automationFrequencyLabel: string
  telegramCategoryAlerts: boolean
  telegramAdvanced: boolean
}

export const PLAN_GMAIL_INTERVAL_MINUTES: Record<TooliaPlanId, number> = {
  starter: 30,
  pro: 10,
  premium: 5,
}

export function getPlanGmailIntervalMinutes(plan: string | null | undefined) {
  return PLAN_GMAIL_INTERVAL_MINUTES[normalizePlanId(plan)]
}

export function getPlanAutomationFrequencyLabel(plan: string | null | undefined) {
  return `Vérification toutes les ${getPlanGmailIntervalMinutes(plan)} min`
}

export const STARTER_LIMITS: PlanLimits = {
  id: 'starter',
  name: 'Starter',
  monthlyPrice: 29,
  setupPrice: 49,
  maxLabels: 5,
  emailAnalysesMonthly: 1500,
  aiDraftsMonthly: 100,
  telegramAlertsMonthly: 0,
  styleAnalysesMonthly: 1,
  automationFrequencyLabel: getPlanAutomationFrequencyLabel('starter'),
  telegramCategoryAlerts: false,
  telegramAdvanced: false,
}

export const PRO_LIMITS: PlanLimits = {
  id: 'pro',
  name: 'Pro',
  monthlyPrice: 69,
  setupPrice: 99,
  maxLabels: 12,
  emailAnalysesMonthly: 4000,
  aiDraftsMonthly: 400,
  telegramAlertsMonthly: 500,
  styleAnalysesMonthly: 2,
  automationFrequencyLabel: getPlanAutomationFrequencyLabel('pro'),
  telegramCategoryAlerts: true,
  telegramAdvanced: false,
}

export const PREMIUM_LIMITS: PlanLimits = {
  id: 'premium',
  name: 'Premium',
  monthlyPrice: 129,
  setupPrice: 199,
  maxLabels: 25,
  emailAnalysesMonthly: 10000,
  aiDraftsMonthly: 1200,
  telegramAlertsMonthly: 2000,
  styleAnalysesMonthly: 4,
  automationFrequencyLabel: getPlanAutomationFrequencyLabel('premium'),
  telegramCategoryAlerts: true,
  telegramAdvanced: true,
}

export const PLAN_LIMITS: Record<TooliaPlanId, PlanLimits> = {
  starter: STARTER_LIMITS,
  pro: PRO_LIMITS,
  premium: PREMIUM_LIMITS,
}

export const CREDIT_COST_BY_EVENT: Record<AiUsageEventType, number> = {
  email_analysis: 1,
  ai_draft: 5,
  telegram_alert: 2,
  style_analysis: 100,
}

export function normalizePlanId(plan: string | null | undefined): TooliaPlanId {
  if (plan === 'premium') return 'premium'
  if (plan === 'pro') return 'pro'
  return 'starter'
}

export function isTooliaPlanId(plan: string | null | undefined): plan is TooliaPlanId {
  return plan === 'starter' || plan === 'pro' || plan === 'premium'
}

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[normalizePlanId(plan)]
}

export function canUseFeature(plan: string | null | undefined, feature: 'telegram_category_alerts' | 'telegram_advanced') {
  const limits = getPlanLimits(plan)
  if (feature === 'telegram_category_alerts') return limits.telegramCategoryAlerts
  return limits.telegramAdvanced
}

export function getEventLimit(limits: PlanLimits, eventType: AiUsageEventType) {
  if (eventType === 'email_analysis') return limits.emailAnalysesMonthly
  if (eventType === 'ai_draft') return limits.aiDraftsMonthly
  if (eventType === 'telegram_alert') return limits.telegramAlertsMonthly
  return limits.styleAnalysesMonthly
}

export function estimateMonthlyEmails(emailVolume: string | null | undefined, estimatedDailyEmailCount?: number | null) {
  if (emailVolume === 'moins_20') return 450
  if (emailVolume === '20_50') return 1200
  if (emailVolume === '50_100') return 2400
  if (emailVolume === '100_plus') return Math.max(0, Math.round(Number(estimatedDailyEmailCount || 0) * 22))
  return 1200
}

export function recommendPlan(input: {
  labelsCount: number
  emailVolume?: string | null
  estimatedDailyEmailCount?: number | null
  draftCategoriesCount: number
  telegramCategoriesCount: number
}) {
  const estimatedMonthlyEmails = estimateMonthlyEmails(input.emailVolume, input.estimatedDailyEmailCount)

  if (
    input.labelsCount > PRO_LIMITS.maxLabels ||
    estimatedMonthlyEmails > PRO_LIMITS.emailAnalysesMonthly ||
    (input.draftCategoriesCount >= Math.max(1, input.labelsCount - 1) && estimatedMonthlyEmails > STARTER_LIMITS.emailAnalysesMonthly) ||
    input.telegramCategoriesCount >= 5
  ) {
    return PREMIUM_LIMITS
  }

  if (
    input.labelsCount > STARTER_LIMITS.maxLabels ||
    estimatedMonthlyEmails > STARTER_LIMITS.emailAnalysesMonthly ||
    input.telegramCategoriesCount > 0 ||
    input.draftCategoriesCount >= 4
  ) {
    return PRO_LIMITS
  }

  return STARTER_LIMITS
}
