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

  const usageRows = ((usageData || []) as AiUsageCostRow[]).filter((row) => row.action_type && row.action_type !== 'other')
  const userIds = Array.from(
    new Set([
      ...Array.from(latestSubscriptions.keys()),
      ...usageRows.map((row) => row.user_id).filter(Boolean),
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

  const rows = userIds
    .map((userId) => {
      const subscription = latestSubscriptions.get(userId) || null
      const plan = normalizePlanId(subscription?.plan_id || usageRows.find((row) => row.user_id === userId)?.plan || null)
      const limits = getPlanLimits(plan)
      const profile = profiles.get(userId) || null
      const events = eventsByUser.get(userId) || []
      const totalCost = events.reduce((sum, event) => sum + numberValue(event.total_cost_eur), 0)
      const promptTokens = events.reduce((sum, event) => sum + numberValue(event.prompt_tokens), 0)
      const completionTokens = events.reduce((sum, event) => sum + numberValue(event.completion_tokens), 0)
      const gmailMessageCount = events.reduce((sum, event) => sum + numberValue(event.gmail_message_count), 0)
      const revenue = subscription && isPaidSubscriptionStatus(subscription.status) ? limits.monthlyPrice : 0
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
        aiCostEur: roundCurrency(totalCost),
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
          totalCostEur: roundCurrency(numberValue(event.total_cost_eur)),
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
  const totalCost = rows.reduce((sum, row) => sum + row.aiCostEur, 0)
  const mostExpensiveCustomer = rows.reduce<(typeof rows)[number] | null>(
    (current, row) => (!current || row.aiCostEur > current.aiCostEur ? row : current),
    null,
  )

  return NextResponse.json({
    ok: true,
    monthKey,
    revenueMode: 'estimated_from_active_subscription_plan',
    summary: {
      activeCustomers: activeCustomerCount,
      totalCustomers: rows.length,
      estimatedRevenueEur: roundCurrency(totalRevenue),
      aiCostEur: roundCurrency(totalCost),
      estimatedProfitEur: roundCurrency(totalRevenue - totalCost),
      averageAiCostPerActiveCustomerEur: activeCustomerCount ? roundCurrency(totalCost / activeCustomerCount) : 0,
      aiCalls: rows.reduce((sum, row) => sum + row.aiCalls, 0),
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
