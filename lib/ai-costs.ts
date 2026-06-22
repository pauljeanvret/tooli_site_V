import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { CREDIT_COST_BY_EVENT, normalizePlanId, type AiUsageEventType } from '@/lib/saas/plan-config'

export type AiCostActionType =
  | 'email_classification'
  | 'draft_generation'
  | 'style_analysis'
  | 'telegram_summary'
  | 'profile_generation'
  | 'other'

export type AiCostUsageInput = {
  userId: string
  customerId?: string | null
  stripeCustomerId?: string | null
  plan?: string | null
  source?: string
  actionType: AiCostActionType
  provider?: string | null
  model?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  inputCostEur?: number | null
  outputCostEur?: number | null
  totalCostEur?: number | null
  currency?: string
  metadata?: Record<string, unknown> | null
  runId?: string | null
  gmailMessageCount?: number | null
  success?: boolean
  errorCode?: string | null
  relatedGmailMessageId?: string | null
  relatedThreadId?: string | null
}

type CostBreakdown = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  inputCostEur: number
  outputCostEur: number
  totalCostEur: number
  currency: 'EUR'
}

const MODEL_COSTS_EUR_PER_1M: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o-mini': { input: 0.14, output: 0.57 },
  'gpt-4o-mini': { input: 0.14, output: 0.57 },
  'openai/gpt-4.1-mini': { input: 0.38, output: 1.52 },
  'gpt-4.1-mini': { input: 0.38, output: 1.52 },
  'openai/gpt-4.1-nano': { input: 0.095, output: 0.38 },
  'gpt-4.1-nano': { input: 0.095, output: 0.38 },
  'openai/gpt-4o': { input: 4.75, output: 14.25 },
  'gpt-4o': { input: 4.75, output: 14.25 },
}

function nonNegativeInteger(value: number | null | undefined) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0
}

function nonNegativeNumber(value: number | null | undefined) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0
}

function eventTypeForAction(actionType: AiCostActionType): AiUsageEventType {
  if (actionType === 'draft_generation') return 'ai_draft'
  if (actionType === 'style_analysis') return 'style_analysis'
  if (actionType === 'telegram_summary') return 'telegram_alert'
  return 'email_analysis'
}

function numberEnv(name: string) {
  const value = Number(process.env[name] || 0)
  return Number.isFinite(value) && value > 0 ? value : null
}

function getModelCost(model: string | null | undefined) {
  const defaultInput = numberEnv('LLM_DEFAULT_INPUT_COST_PER_1M')
  const defaultOutput = numberEnv('LLM_DEFAULT_OUTPUT_COST_PER_1M')
  const defaultCost = defaultInput && defaultOutput ? { input: defaultInput, output: defaultOutput } : null

  if (!model) return defaultCost
  return MODEL_COSTS_EUR_PER_1M[model] || MODEL_COSTS_EUR_PER_1M[model.toLowerCase()] || defaultCost
}

export function estimateTokensFromChars(chars: number) {
  return Math.max(1, Math.ceil(Math.max(0, chars) / 4))
}

export function calculateAiCost(input: {
  model?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  inputCostEur?: number | null
  outputCostEur?: number | null
  totalCostEur?: number | null
}): CostBreakdown {
  const promptTokens = nonNegativeInteger(input.promptTokens)
  const completionTokens = nonNegativeInteger(input.completionTokens)
  const providedInputCost = nonNegativeNumber(input.inputCostEur)
  const providedOutputCost = nonNegativeNumber(input.outputCostEur)
  const providedTotalCost = nonNegativeNumber(input.totalCostEur)

  if (providedTotalCost > 0 || providedInputCost > 0 || providedOutputCost > 0) {
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCostEur: providedInputCost,
      outputCostEur: providedOutputCost,
      totalCostEur: providedTotalCost || providedInputCost + providedOutputCost,
      currency: 'EUR',
    }
  }

  const modelCost = getModelCost(input.model)
  if (!modelCost) {
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCostEur: 0,
      outputCostEur: 0,
      totalCostEur: 0,
      currency: 'EUR',
    }
  }

  const inputCostEur = (promptTokens * modelCost.input) / 1_000_000
  const outputCostEur = (completionTokens * modelCost.output) / 1_000_000

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    inputCostEur,
    outputCostEur,
    totalCostEur: inputCostEur + outputCostEur,
    currency: 'EUR',
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null
  const forbidden = new Set(['prompt', 'body', 'subject', 'content', 'email', 'token', 'secret', 'apiKey', 'api_key'])
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !forbidden.has(key)))
}

export async function recordAiCostUsage(input: AiCostUsageInput) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const eventType = eventTypeForAction(input.actionType)
  const breakdown = calculateAiCost(input)
  const gmailMessageCount = nonNegativeInteger(input.gmailMessageCount)
  const isEmptyPlaceholder =
    input.actionType === 'other' &&
    !input.errorCode &&
    !input.provider &&
    !input.model &&
    breakdown.promptTokens === 0 &&
    breakdown.completionTokens === 0 &&
    breakdown.totalCostEur === 0

  if (isEmptyPlaceholder) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[ai-costs] skipped empty placeholder event', {
        userId: input.userId,
        source: input.source || 'gmail_worker',
      })
    }
    return null
  }

  const { error } = await supabase.from('ai_usage_events').insert({
    user_id: input.userId,
    customer_id: input.customerId || input.userId,
    stripe_customer_id: input.stripeCustomerId || null,
    plan: normalizePlanId(input.plan),
    event_type: eventType,
    amount: Math.max(1, gmailMessageCount || 1),
    credits_used: 0,
    source: input.source || 'gmail_worker',
    related_gmail_message_id: input.relatedGmailMessageId || null,
    related_thread_id: input.relatedThreadId || null,
    action_type: input.actionType,
    provider: input.provider || 'unknown',
    model: input.model || 'unknown',
    prompt_tokens: breakdown.promptTokens,
    completion_tokens: breakdown.completionTokens,
    total_tokens: breakdown.totalTokens,
    input_cost_eur: breakdown.inputCostEur,
    output_cost_eur: breakdown.outputCostEur,
    total_cost_eur: breakdown.totalCostEur,
    currency: input.currency || breakdown.currency,
    metadata: sanitizeMetadata(input.metadata),
    run_id: input.runId || null,
    gmail_message_count: gmailMessageCount || null,
    success: input.success !== false,
    error_code: input.errorCode || null,
  })

  if (error) {
    if (error.code === '42P01' || error.code === '42703' || error.message?.toLowerCase().includes('does not exist')) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[ai-costs] cost ledger unavailable', {
          userId: input.userId,
          actionType: input.actionType,
          code: error.code,
          message: error.message,
        })
      }
      return null
    }

    throw error
  }

  return breakdown
}

export function creditCostForAiAction(actionType: AiCostActionType) {
  return CREDIT_COST_BY_EVENT[eventTypeForAction(actionType)]
}
