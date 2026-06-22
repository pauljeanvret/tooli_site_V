import { NextRequest, NextResponse } from 'next/server'

import { getPlanLimits, normalizePlanId } from '@/lib/saas/plan-config'
import { isPaidSubscriptionStatus } from '@/lib/saas/subscription-store'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export const dynamic = 'force-dynamic'

type SubscriptionRow = {
  id: string
  user_id: string
  plan_id: string
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  company_name: string | null
}

type AiUsageCostRow = {
  id: string
  created_at: string
  user_id: string
  customer_id: string | null
  stripe_customer_id: string | null
  plan: string | null
  source: string | null
  action_type: string | null
  provider: string | null
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  input_cost_eur: number | string | null
  output_cost_eur: number | string | null
  total_cost_eur: number | string | null
  currency: string | null
  run_id: string | null
  gmail_message_count: number | null
  success: boolean | null
  error_code: string | null
}

type StripeRevenueRow = {
  id: string
  created_at: string
  stripe_created_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_invoice_id: string | null
  stripe_checkout_session_id: string | null
  user_id: string | null
  customer_email: string | null
  plan: string | null
  currency: string | null
  amount_paid_cents: number | null
  amount_due_cents: number | null
  amount_discount_cents: number | null
  amount_refunded_cents: number | null
  net_revenue_cents: number | null
  period_start: string | null
  period_end: string | null
  source: string | null
  raw_type: string | null
}

const AI_COST_ENV_VARS = [
  'LLM_DEFAULT_INPUT_COST_PER_1M',
  'LLM_DEFAULT_OUTPUT_COST_PER_1M',
  'LLM_CLASSIFICATION_INPUT_COST_PER_1M',
  'LLM_CLASSIFICATION_OUTPUT_COST_PER_1M',
  'LLM_DRAFT_SMALL_INPUT_COST_PER_1M',
  'LLM_DRAFT_SMALL_OUTPUT_COST_PER_1M',
  'LLM_DRAFT_MEDIUM_INPUT_COST_PER_1M',
  'LLM_DRAFT_MEDIUM_OUTPUT_COST_PER_1M',
  'LLM_DRAFT_COMPLEX_INPUT_COST_PER_1M',
  'LLM_DRAFT_COMPLEX_OUTPUT_COST_PER_1M',
]

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function isAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const adminEmails = getAdminEmails()
  return adminEmails.length > 0 && adminEmails.includes(email.toLowerCase())
}

async function requireAdmin(request: NextRequest) {
  const auth = await requireAuthenticatedRouteUser(request)
  if (auth.response) return { user: null, response: auth.response }

  if (!isAdminEmail(auth.user.email)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          ok: false,
          message: 'Acces admin non autorise.',
        },
        { status: 403 },
      ),
    }
  }

  return { user: auth.user, response: null }
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

function getMonthRange(monthKey: string | null) {
  const safeMonth = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : currentMonthKey()
  const start = new Date(`${safeMonth}-01T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)

  return {
    monthKey: safeMonth,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function centsToEur(value: number | string | null | undefined) {
  return numberValue(value) / 100
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function latestByUser(rows: SubscriptionRow[]) {
  const byUser = new Map<string, SubscriptionRow>()
  for (const row of rows) {
    const existing = byUser.get(row.user_id)
    if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
      byUser.set(row.user_id, row)
    }
  }
  return byUser
}

function isMissingRelationError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('could not find table') ||
    message.includes('relation')
  )
}

function isZeroPlaceholderUsageEvent(row: AiUsageCostRow) {
  const actionType = (row.action_type || '').toLowerCase()
  const provider = (row.provider || 'unknown').toLowerCase()
  const model = (row.model || 'unknown').toLowerCase()

  return (
    (!actionType || actionType === 'other') &&
    provider === 'unknown' &&
    model === 'unknown' &&
    numberValue(row.prompt_tokens) === 0 &&
    numberValue(row.completion_tokens) === 0 &&
    numberValue(row.total_tokens) === 0 &&
    numberValue(row.total_cost_eur) === 0 &&
    !row.error_code
  )
}

function isRevenueInMonth(row: StripeRevenueRow, startIso: string, endIso: string) {
  const date = row.period_start || row.stripe_created_at || row.created_at
  const time = new Date(date).getTime()
  return time >= new Date(startIso).getTime() && time < new Date(endIso).getTime()
}

function pushRevenueMap(map: Map<string, StripeRevenueRow[]>, key: string | null | undefined, row: StripeRevenueRow) {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  map.get(key)!.push(row)
}

function mergeRevenueEvents(...groups: Array<StripeRevenueRow[] | undefined>) {
  const seen = new Set<string>()
  const events: StripeRevenueRow[] = []
  for (const group of groups) {
    for (const event of group || []) {
      if (seen.has(event.id)) continue
      seen.add(event.id)
      events.push(event)
    }
  }
  return events
}

function connectionMap<T extends { user_id: string }>(rows: T[] | null | undefined, isConnected: (row: T) => boolean) {
  const map = new Map<string, boolean>()
  for (const row of rows || []) {
    if (!map.has(row.user_id)) map.set(row.user_id, isConnected(row))
    else map.set(row.user_id, Boolean(map.get(row.user_id) || isConnected(row)))
  }
  return map
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, message: 'Client Supabase serveur indisponible.' },
      { status: 500 },
    )
  }

  const { monthKey, startIso, endIso } = getMonthRange(request.nextUrl.searchParams.get('month'))
  const planFilter = request.nextUrl.searchParams.get('plan')
  const statusFilter = request.nextUrl.searchParams.get('status')
  const sort = request.nextUrl.searchParams.get('sort') || 'cost_desc'

  const { data: subscriptionData, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('id,user_id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_end,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (subscriptionError) {
    console.error('[admin/finance] subscriptions failed', {
      message: subscriptionError.message,
      code: subscriptionError.code,
    })
    return NextResponse.json({ ok: false, message: 'Impossible de charger les abonnements.' }, { status: 500 })
  }

  const subscriptions = (subscriptionData || []) as SubscriptionRow[]
  const latestSubscriptions = latestByUser(subscriptions)

  const { data: usageData, error: usageError } = await admin
    .from('ai_usage_events')
    .select(
      'id,created_at,user_id,customer_id,stripe_customer_id,plan,source,action_type,provider,model,prompt_tokens,completion_tokens,total_tokens,input_cost_eur,output_cost_eur,total_cost_eur,currency,run_id,gmail_message_count,success,error_code',
    )
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (usageError) {
    console.error('[admin/finance] usage failed', {
      message: usageError.message,
      code: usageError.code,
    })
    return NextResponse.json(
      {
        ok: false,
        message: 'Impossible de charger les couts IA. Verifiez que la migration ai_usage_cost_ledger est appliquee.',
      },
      { status: 500 },
    )
  }

  const allUsageRows = (usageData || []) as AiUsageCostRow[]
  const ignoredZeroPlaceholderEvents = allUsageRows.filter(isZeroPlaceholderUsageEvent)
  const ignoredOtherEvents = allUsageRows.filter((row) => !row.action_type || row.action_type === 'other')
  const usageRows = allUsageRows.filter((row) => row.action_type && row.action_type !== 'other')

  let stripeRevenueAvailable = true
  let stripeRevenueTableMissing = false
  let stripeRevenueLoadMessage: string | null = null
  let revenueRowsAll: StripeRevenueRow[] = []
  let revenueRows: StripeRevenueRow[] = []
  const { data: revenueData, error: revenueError } = await admin
    .from('stripe_revenue_events')
    .select(
      'id,created_at,stripe_created_at,stripe_customer_id,stripe_subscription_id,stripe_invoice_id,stripe_checkout_session_id,user_id,customer_email,plan,currency,amount_paid_cents,amount_due_cents,amount_discount_cents,amount_refunded_cents,net_revenue_cents,period_start,period_end,source,raw_type',
    )
    .order('created_at', { ascending: false })
    .limit(5000)

  if (revenueError) {
    stripeRevenueAvailable = false
    stripeRevenueTableMissing = isMissingRelationError(revenueError)
    stripeRevenueLoadMessage = isMissingRelationError(revenueError)
      ? 'Table stripe_revenue_events introuvable ou non exposée via Supabase. Appliquez la migration 20260621120000_stripe_revenue_events.sql, puis relancez la synchronisation Stripe.'
      : `Impossible de charger les revenus Stripe exacts : le revenu réel est affiché à 0 tant que les paiements ne sont pas synchronisés. Code Supabase : ${revenueError.code || 'inconnu'}.`
    console.warn('[admin/finance] stripe revenue unavailable', {
      message: revenueError.message,
      code: revenueError.code,
    })
  } else {
    revenueRowsAll = (revenueData || []) as StripeRevenueRow[]
    revenueRows = revenueRowsAll.filter((row) => isRevenueInMonth(row, startIso, endIso))
  }

  const latestSubscriptionRows = Array.from(latestSubscriptions.values())
  const knownStripeCustomerIds = Array.from(
    new Set(latestSubscriptionRows.map((row) => String(row.stripe_customer_id || '').trim()).filter(Boolean)),
  )
  const subscriptionsMissingStripeCustomerId = latestSubscriptionRows.filter((row) => !row.stripe_customer_id).length
  const stripeRevenueDebugMessage =
    stripeRevenueLoadMessage ||
    (!process.env.STRIPE_SECRET_KEY
      ? 'STRIPE_SECRET_KEY est absent côté serveur : la synchronisation Stripe ne peut pas interroger les paiements.'
      : knownStripeCustomerIds.length === 0
        ? 'Aucun stripe_customer_id connu dans les abonnements : la synchronisation Stripe ne peut pas rattacher de revenus exacts.'
        : stripeRevenueAvailable && revenueRows.length === 0
          ? 'Aucun revenu Stripe exact trouvé pour ce mois. Cliquez sur Synchroniser Stripe ou vérifiez que les webhooks Stripe alimentent stripe_revenue_events.'
          : null)

  const userIds = Array.from(
    new Set([
      ...Array.from(latestSubscriptions.keys()),
      ...usageRows.map((row) => row.user_id).filter(Boolean),
      ...(revenueRows.map((row) => row.user_id).filter(Boolean) as string[]),
    ]),
  )

  const { data: profileRows } = userIds.length
    ? await admin.from('profiles').select('id,full_name,email,company_name').in('id', userIds)
    : { data: [] }
  const profiles = new Map((profileRows || []).map((profile: ProfileRow) => [profile.id, profile]))

  const { data: gmailRows } = userIds.length
    ? await admin.from('gmail_connections').select('user_id,status,revoked_at,connected_at').in('user_id', userIds)
    : { data: [] }
  const gmailConnected = connectionMap(gmailRows as Array<{ user_id: string; status: string | null; revoked_at: string | null; connected_at: string | null }>, (row) =>
    Boolean(row.connected_at && !row.revoked_at && row.status !== 'disconnected'),
  )

  const { data: telegramRows } = userIds.length
    ? await admin
        .from('telegram_connections')
        .select('user_id,telegram_chat_id,chat_id_encrypted,telegram_enabled,enabled,telegram_connection_status')
        .in('user_id', userIds)
    : { data: [] }
  const telegramConnected = connectionMap(
    telegramRows as Array<{
      user_id: string
      telegram_chat_id: string | null
      chat_id_encrypted: string | null
      telegram_enabled: boolean | null
      enabled: boolean | null
      telegram_connection_status: string | null
    }>,
    (row) =>
      Boolean((row.telegram_chat_id || row.chat_id_encrypted) && (row.telegram_enabled || row.enabled) && row.telegram_connection_status !== 'disconnected'),
  )

  const eventsByUser = new Map<string, AiUsageCostRow[]>()
  for (const row of usageRows) {
    if (!eventsByUser.has(row.user_id)) eventsByUser.set(row.user_id, [])
    eventsByUser.get(row.user_id)!.push(row)
  }

  const revenueByUser = new Map<string, StripeRevenueRow[]>()
  const revenueByCustomer = new Map<string, StripeRevenueRow[]>()
  for (const row of revenueRows) {
    pushRevenueMap(revenueByUser, row.user_id, row)
    pushRevenueMap(revenueByCustomer, row.stripe_customer_id, row)
  }

  const zeroCostEventsWithTokens = usageRows.filter(
    (event) => numberValue(event.total_tokens) > 0 && numberValue(event.total_cost_eur) === 0,
  )

  const rows = userIds
    .map((userId) => {
      const subscription = latestSubscriptions.get(userId) || null
      const matchingRevenue = revenueRows.find(
        (row) => row.user_id === userId || Boolean(subscription?.stripe_customer_id && row.stripe_customer_id === subscription.stripe_customer_id),
      )
      const plan = normalizePlanId(
        subscription?.plan_id || usageRows.find((row) => row.user_id === userId)?.plan || matchingRevenue?.plan || null,
      )
      const limits = getPlanLimits(plan)
      const profile = profiles.get(userId) || null
      const events = eventsByUser.get(userId) || []
      const revenueEvents = mergeRevenueEvents(
        revenueByUser.get(userId),
        revenueByCustomer.get(subscription?.stripe_customer_id || events[0]?.stripe_customer_id || ''),
      )
      const totalCost = events.reduce((sum, event) => sum + numberValue(event.total_cost_eur), 0)
      const promptTokens = events.reduce((sum, event) => sum + numberValue(event.prompt_tokens), 0)
      const completionTokens = events.reduce((sum, event) => sum + numberValue(event.completion_tokens), 0)
      const gmailMessageCount = events.reduce((sum, event) => sum + numberValue(event.gmail_message_count), 0)
      const estimatedPlanRevenue = subscription && isPaidSubscriptionStatus(subscription.status) ? limits.monthlyPrice : 0
      const exactRevenue = revenueEvents.reduce((sum, event) => sum + centsToEur(event.net_revenue_cents), 0)
      const stripeAmountPaid = revenueEvents.reduce((sum, event) => sum + centsToEur(event.amount_paid_cents), 0)
      const stripeDiscount = revenueEvents.reduce((sum, event) => sum + centsToEur(event.amount_discount_cents), 0)
      const stripeRefunded = revenueEvents.reduce((sum, event) => sum + centsToEur(event.amount_refunded_cents), 0)
      const hasExactStripeRevenue = revenueEvents.length > 0
      const hasStripeRefund = stripeRefunded > 0
      const isFullyRefunded = hasExactStripeRevenue && stripeAmountPaid > 0 && exactRevenue <= 0 && stripeRefunded >= stripeAmountPaid
      const isZeroPaidStripe = hasExactStripeRevenue && stripeAmountPaid === 0
      const revenue = exactRevenue
      const profit = revenue - totalCost
      const margin = revenue > 0 ? (profit / revenue) * 100 : null
      const actionBreakdown = events.reduce<Record<string, { count: number; cost: number }>>((acc, event) => {
        const key = event.action_type || 'unknown'
        if (!acc[key]) acc[key] = { count: 0, cost: 0 }
        acc[key].count += 1
        acc[key].cost += numberValue(event.total_cost_eur)
        return acc
      }, {})

      return {
        userId,
        customerEmail: profile?.email || null,
        customerName: profile?.full_name || null,
        companyName: profile?.company_name || null,
        stripeCustomerId: subscription?.stripe_customer_id || events[0]?.stripe_customer_id || null,
        stripeSubscriptionId: subscription?.stripe_subscription_id || null,
        plan,
        planName: limits.name,
        subscriptionStatus: subscription?.status || 'missing',
        currentPeriodEnd: subscription?.current_period_end || null,
        monthlyPriceEur: limits.monthlyPrice,
        setupPriceEur: limits.setupPrice,
        estimatedRevenueEur: roundCurrency(revenue),
        estimatedPlanRevenueEur: roundCurrency(estimatedPlanRevenue),
        exactStripeRevenueEur: roundCurrency(exactRevenue),
        revenueSource: hasExactStripeRevenue ? (isFullyRefunded ? 'exact_stripe_refunded' : 'exact_stripe') : 'none',
        hasExactStripeRevenue,
        hasStripeRefund,
        isFullyRefunded,
        isZeroPaidStripe,
        revenueEventsCount: revenueEvents.length,
        stripeAmountPaidEur: roundCurrency(stripeAmountPaid),
        stripeDiscountEur: roundCurrency(stripeDiscount),
        stripeRefundedEur: roundCurrency(stripeRefunded),
        aiCostEur: totalCost,
        profitEur: roundCurrency(profit),
        marginPercent: margin === null ? null : Math.round(margin * 10) / 10,
        aiCalls: events.length,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        gmailMessageCount,
        lastAiUsageAt: events[0]?.created_at || null,
        gmailConnected: Boolean(gmailConnected.get(userId)),
        telegramConnected: Boolean(telegramConnected.get(userId)),
        actionBreakdown,
        recentEvents: events.slice(0, 8).map((event) => ({
          id: event.id,
          createdAt: event.created_at,
          source: event.source,
          actionType: event.action_type,
          provider: event.provider,
          model: event.model,
          promptTokens: numberValue(event.prompt_tokens),
          completionTokens: numberValue(event.completion_tokens),
          totalCostEur: numberValue(event.total_cost_eur),
          gmailMessageCount: event.gmail_message_count || null,
          success: event.success !== false,
          errorCode: event.error_code || null,
        })),
      }
    })
    .filter((row) => {
      if (planFilter && planFilter !== 'all' && row.plan !== planFilter) return false
      if (statusFilter && statusFilter !== 'all' && row.subscriptionStatus !== statusFilter) return false
      return true
    })

  rows.sort((a, b) => {
    if (sort === 'revenue_desc') return b.estimatedRevenueEur - a.estimatedRevenueEur
    if (sort === 'profit_asc') return a.profitEur - b.profitEur
    if (sort === 'margin_asc') return (a.marginPercent ?? -999) - (b.marginPercent ?? -999)
    if (sort === 'last_usage_desc') {
      return new Date(b.lastAiUsageAt || 0).getTime() - new Date(a.lastAiUsageAt || 0).getTime()
    }
    return b.aiCostEur - a.aiCostEur
  })

  const activeCustomerCount = rows.filter((row) => isPaidSubscriptionStatus(row.subscriptionStatus)).length
  const totalRevenue = rows.reduce((sum, row) => sum + row.estimatedRevenueEur, 0)
  const exactRevenueTotal = rows.reduce((sum, row) => sum + row.exactStripeRevenueEur, 0)
  const estimatedPlanRevenueTotal = rows.reduce((sum, row) => sum + row.estimatedPlanRevenueEur, 0)
  const refundedRevenueTotal = rows.reduce((sum, row) => sum + row.stripeRefundedEur, 0)
  const customersWithExactStripeRevenue = rows.filter((row) => row.hasExactStripeRevenue).length
  const customersMissingExactStripeRevenue = rows.filter((row) => !row.hasExactStripeRevenue).length
  const customersWithRefundedStripeRevenue = rows.filter((row) => row.hasStripeRefund).length
  const fullyRefundedPaymentsDetected = rows.filter((row) => row.isFullyRefunded).length
  const zeroPaidExactInvoices = rows.filter((row) => row.isZeroPaidStripe).length
  const totalCost = rows.reduce((sum, row) => sum + row.aiCostEur, 0)
  const mostExpensiveCustomer = rows.reduce<(typeof rows)[number] | null>(
    (current, row) => (!current || row.aiCostEur > current.aiCostEur ? row : current),
    null,
  )

  return NextResponse.json({
    ok: true,
    monthKey,
    revenueMode: stripeRevenueAvailable ? 'exact_stripe_net_only' : 'stripe_revenue_unavailable',
    warnings: {
      stripeRevenueAvailable,
      stripeRevenueTableMissing,
      stripeRevenueLoadMessage,
      stripeRevenueDebugMessage,
      stripeRevenueEventsLoaded: revenueRowsAll.length,
      stripeRevenueEventsInMonth: revenueRows.length,
      knownStripeCustomers: knownStripeCustomerIds.length,
      subscriptionsMissingStripeCustomerId,
      stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      aiCostPricingMissing: zeroCostEventsWithTokens.length > 0,
      aiCostPricingMessage:
        zeroCostEventsWithTokens.length > 0
          ? 'Coûts IA non configurés pour certains modèles : ajoutez les variables de coût modèle pour calculer ces coûts.'
          : null,
      aiCostPricingEnvVars: AI_COST_ENV_VARS,
      zeroCostEventsWithTokens: zeroCostEventsWithTokens.length,
      ignoredOtherEvents: ignoredOtherEvents.length,
      ignoredZeroPlaceholderEvents: ignoredZeroPlaceholderEvents.length,
      customersMissingExactStripeRevenue,
      customersWithRefundedStripeRevenue,
      fullyRefundedPaymentsDetected,
      zeroPaidExactInvoices,
      stripeRefundedRevenueEur: roundCurrency(refundedRevenueTotal),
    },
    summary: {
      activeCustomers: activeCustomerCount,
      totalCustomers: rows.length,
      estimatedRevenueEur: roundCurrency(totalRevenue),
      exactStripeRevenueEur: roundCurrency(exactRevenueTotal),
      estimatedPlanRevenueEur: roundCurrency(estimatedPlanRevenueTotal),
      theoreticalMrrEur: roundCurrency(estimatedPlanRevenueTotal),
      stripeRefundedRevenueEur: roundCurrency(refundedRevenueTotal),
      customersWithExactStripeRevenue,
      customersMissingExactStripeRevenue,
      customersWithRefundedStripeRevenue,
      fullyRefundedPaymentsDetected,
      zeroPaidExactInvoices,
      aiCostEur: totalCost,
      estimatedProfitEur: roundCurrency(totalRevenue - totalCost),
      averageAiCostPerActiveCustomerEur: activeCustomerCount ? roundCurrency(totalCost / activeCustomerCount) : 0,
      aiCalls: rows.reduce((sum, row) => sum + row.aiCalls, 0),
      latestAiUsageAt:
        rows
          .map((row) => row.lastAiUsageAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null,
      totalTokens: rows.reduce((sum, row) => sum + row.totalTokens, 0),
      gmailMessageCount: rows.reduce((sum, row) => sum + row.gmailMessageCount, 0),
      mostExpensiveCustomer: mostExpensiveCustomer
        ? {
            userId: mostExpensiveCustomer.userId,
            email: mostExpensiveCustomer.customerEmail,
            plan: mostExpensiveCustomer.plan,
            aiCostEur: mostExpensiveCustomer.aiCostEur,
          }
        : null,
    },
    customers: rows,
  })
}
