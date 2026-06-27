import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

import { isAdminEmail } from '@/lib/admin'
import { getPlanFromStripePriceId, getStripeSecretKey } from '@/lib/saas/stripe-plans'
import {
  getInvoicePaymentRefs,
  upsertStripeRevenueFromChargeRefund,
  upsertStripeRevenueFromCheckoutSession,
  upsertStripeRevenueFromInvoice,
} from '@/lib/saas/stripe-revenue-store'
import {
  getStripeSubscriptionCurrentPeriodEnd,
  normalizeSubscriptionStatus,
  upsertStripeSubscription,
} from '@/lib/saas/subscription-store'
import { normalizePlanId } from '@/lib/saas/plan-config'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    maxCustomers: z.number().int().min(1).max(500).optional(),
  })
  .strict()

async function requireAdmin(request: NextRequest) {
  const auth = await requireAuthenticatedRouteUser(request)
  if (auth.response) return { response: auth.response }

  if (!isAdminEmail(auth.user.email)) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          message: 'Accès admin non autorisé.',
        },
        { status: 403 },
      ),
    }
  }

  return { response: null }
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

function monthRange(monthKey: string | null | undefined) {
  const safeMonth = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : currentMonthKey()
  const start = new Date(`${safeMonth}-01T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)

  return {
    monthKey: safeMonth,
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  }
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

function isMissingRevenueSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    isMissingRelationError(error) ||
    message.includes('stripe_payment_intent_id') ||
    message.includes('stripe_charge_id')
  )
}

function integerFrom(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function cents(value: unknown) {
  return Math.max(0, integerFrom(value))
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function getStripeId(value: unknown) {
  if (typeof value === 'string') return value
  return stringFrom(asRecord(value).id)
}

function getPlanFromSubscription(subscription: Stripe.Subscription, fallbackPlan?: string | null) {
  for (const item of subscription.items.data) {
    const plan = getPlanFromStripePriceId(item.price?.id)
    if (plan) return plan
  }

  return fallbackPlan ? normalizePlanId(fallbackPlan) : 'starter'
}

async function syncStripeFinance(request: NextRequest) {
  const adminAuth = await requireAdmin(request)
  if (adminAuth.response) return adminAuth.response

  const stripeSecretKey = getStripeSecretKey()
  if (!stripeSecretKey) {
    return NextResponse.json(
      { ok: false, message: 'Configuration Stripe incomplète : STRIPE_SECRET_KEY manquant.' },
      { status: 500 },
    )
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: 'Client Supabase serveur indisponible.' },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const parsed = requestSchema.safeParse({
    ...body,
    month: body.month || request.nextUrl.searchParams.get('month') || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Paramètres de synchronisation invalides.' }, { status: 400 })
  }

  const { monthKey, startUnix, endUnix } = monthRange(parsed.data.month)
  const maxCustomers = parsed.data.maxCustomers || 250

  const { error: revenueTableError } = await supabase
    .from('stripe_revenue_events')
    .select('id,stripe_payment_intent_id,stripe_charge_id')
    .limit(1)
  if (revenueTableError) {
    const missingTable = isMissingRelationError(revenueTableError)
    const missingSchema = isMissingRevenueSchemaError(revenueTableError)
    console.warn('[admin/finance/sync-stripe] revenue table preflight failed', {
      code: revenueTableError.code,
      missingTable,
      missingSchema,
    })

    return NextResponse.json(
      {
        ok: false,
        code: revenueTableError.code || 'stripe_revenue_schema_unavailable',
        tableMissing: missingTable,
        schemaMissing: missingSchema,
        message: missingSchema
          ? 'Table stripe_revenue_events introuvable ou colonnes Stripe manquantes. Appliquez les migrations 20260621120000_stripe_revenue_events.sql et 20260621123000_stripe_revenue_payment_refs.sql, puis relancez la synchronisation Stripe.'
          : 'Impossible d’accéder à la table stripe_revenue_events pour synchroniser Stripe.',
      },
      { status: 500 },
    )
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id,user_id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_end')
    .order('created_at', { ascending: false })
    .limit(maxCustomers)

  if (error) {
    console.error('[admin/finance/sync-stripe] subscription customer lookup failed', {
      message: error.message,
      code: error.code,
    })
    return NextResponse.json({ ok: false, message: 'Impossible de charger les clients Stripe connus.' }, { status: 500 })
  }

  const subscriptionRows = data || []
  const subscriptionsMissingStripeCustomerId = subscriptionRows.filter((row) => !row.stripe_customer_id).length
  const customerIds = Array.from(new Set(subscriptionRows.map((row) => String(row.stripe_customer_id || '').trim()).filter(Boolean)))
  if (customerIds.length === 0) {
    return NextResponse.json({
      ok: true,
      monthKey,
      adminAuthOk: true,
      message: 'Aucun client Stripe connu dans les abonnements. Aucun revenu exact ne peut être synchronisé pour le moment.',
      subscriptionsScanned: subscriptionRows.length,
      subscriptionsMissingStripeCustomerId,
      subscriptionsWithStripeCustomerId: 0,
      customersChecked: 0,
      invoicesFetched: 0,
      checkoutSessionsFetched: 0,
      chargesFetched: 0,
      refundsFound: 0,
      fullyRefundedPaymentsDetected: 0,
      zeroPaidInvoicesDetected: 0,
      rowsUpdatedDueToRefunds: 0,
      subscriptionsChecked: 0,
      subscriptionsUpdated: 0,
      subscriptionsActive: 0,
      subscriptionsTrialing: 0,
      subscriptionsCanceled: 0,
      subscriptionsPaused: 0,
      subscriptionsPastDue: 0,
      subscriptionsIncomplete: 0,
      subscriptionsUnpaid: 0,
      subscriptionsUnknown: 0,
      subscriptionsFailed: 0,
      revenueEventsSaved: 0,
    })
  }

  const stripe = new Stripe(stripeSecretKey)
  let invoicesFetched = 0
  let checkoutSessionsFetched = 0
  let chargesFetched = 0
  let refundsFound = 0
  let fullyRefundedPaymentsDetected = 0
  let zeroPaidInvoicesDetected = 0
  let rowsUpdatedDueToRefunds = 0
  let revenueEventsSaved = 0
  let subscriptionsChecked = 0
  let subscriptionsUpdated = 0
  let subscriptionsActive = 0
  let subscriptionsTrialing = 0
  let subscriptionsCanceled = 0
  let subscriptionsPaused = 0
  let subscriptionsPastDue = 0
  let subscriptionsIncomplete = 0
  let subscriptionsUnpaid = 0
  let subscriptionsUnknown = 0
  let subscriptionsFailed = 0

  for (const row of subscriptionRows) {
    const stripeSubscriptionId = String(row.stripe_subscription_id || '').trim()
    const userId = String(row.user_id || '').trim()
    if (!stripeSubscriptionId || !userId) continue

    subscriptionsChecked += 1
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data.price'],
      })
      const stripeStatus = normalizeSubscriptionStatus(stringFrom(asRecord(stripeSubscription).status))
      const stripePlan = getPlanFromSubscription(stripeSubscription, row.plan_id)
      const stripeCustomerId = getStripeId(stripeSubscription.customer) || row.stripe_customer_id
      const currentPeriodEnd = getStripeSubscriptionCurrentPeriodEnd(stripeSubscription) || row.current_period_end || null

      if (stripeStatus === 'active') subscriptionsActive += 1
      else if (stripeStatus === 'trialing') subscriptionsTrialing += 1
      else if (stripeStatus === 'canceled') subscriptionsCanceled += 1
      else if (stripeStatus === 'paused') subscriptionsPaused += 1
      else if (stripeStatus === 'past_due') subscriptionsPastDue += 1
      else if (stripeStatus === 'incomplete') subscriptionsIncomplete += 1
      else if (stripeStatus === 'unpaid') subscriptionsUnpaid += 1
      else subscriptionsUnknown += 1

      const changed =
        stripeStatus !== row.status ||
        stripePlan !== normalizePlanId(row.plan_id) ||
        currentPeriodEnd !== (row.current_period_end || null) ||
        stripeCustomerId !== row.stripe_customer_id

      if (stripeCustomerId) {
        const result = await upsertStripeSubscription({
          userId,
          plan: stripePlan,
          status: stripeStatus,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          currentPeriodEnd,
        })

        if (result.ok && changed) {
          subscriptionsUpdated += 1
        } else if (!result.ok) {
          subscriptionsFailed += 1
        }
      }
    } catch (error) {
      subscriptionsUnknown += 1
      subscriptionsFailed += 1
      console.warn('[admin/finance/sync-stripe] subscription status sync failed', {
        hasStripeSubscriptionId: Boolean(stripeSubscriptionId),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const customer of customerIds) {
    const invoices = await stripe.invoices.list({
      customer,
      limit: 100,
      created: {
        gte: startUnix,
        lt: endUnix,
      },
      expand: ['data.lines.data.price'],
    })

    for (const invoice of invoices.data) {
      invoicesFetched += 1
      if (cents(invoice.amount_paid) === 0) zeroPaidInvoicesDetected += 1
      const paymentRefs = await getInvoicePaymentRefs(stripe, invoice.id)
      const result = await upsertStripeRevenueFromInvoice({
        invoice,
        source: 'admin_sync',
        rawType: 'admin.sync_invoice',
        ...paymentRefs,
      })
      if (result.ok) revenueEventsSaved += 1
    }

    const checkoutSessions = await stripe.checkout.sessions.list({
      customer,
      limit: 100,
      created: {
        gte: startUnix,
        lt: endUnix,
      },
    })

    for (const session of checkoutSessions.data) {
      const mode = typeof session.mode === 'string' ? session.mode : null
      const isUpgradePayment = session.metadata?.type === 'toolia_plan_upgrade'
      const shouldStoreSession =
        session.payment_status === 'paid' &&
        (isUpgradePayment || mode === 'payment' || !session.subscription)

      if (!shouldStoreSession) continue

      checkoutSessionsFetched += 1
      const result = await upsertStripeRevenueFromCheckoutSession({
        session,
        source: 'admin_sync',
        rawType: 'admin.sync_checkout_session',
      })
      if (result.ok) revenueEventsSaved += 1
    }

    const charges = await stripe.charges.list({
      customer,
      limit: 100,
      created: {
        lt: endUnix,
      },
      expand: ['data.refunds'],
    })

    for (const charge of charges.data) {
      chargesFetched += 1
      const refundedCents = cents(charge.amount_refunded)
      if (refundedCents <= 0) continue

      const chargeRefunds = asRecord(charge).refunds
      const refundItems = Array.isArray(asRecord(chargeRefunds).data) ? (asRecord(chargeRefunds).data as unknown[]) : []
      refundsFound += Math.max(1, refundItems.length)
      if (cents(charge.amount) > 0 && refundedCents >= cents(charge.amount)) {
        fullyRefundedPaymentsDetected += 1
      }

      const result = await upsertStripeRevenueFromChargeRefund({
        stripe,
        charge,
        source: 'admin_sync',
        rawType: 'admin.sync_charge_refund',
      })
      if (result.ok) {
        revenueEventsSaved += 1
        rowsUpdatedDueToRefunds += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    adminAuthOk: true,
    message:
      revenueEventsSaved > 0
        ? 'Synchronisation Stripe terminée.'
        : 'Synchronisation Stripe terminée : aucun paiement Stripe trouvé pour ce mois.',
    subscriptionsScanned: subscriptionRows.length,
    subscriptionsMissingStripeCustomerId,
    subscriptionsWithStripeCustomerId: customerIds.length,
    customersChecked: customerIds.length,
    invoicesFetched,
    checkoutSessionsFetched,
    chargesFetched,
    refundsFound,
    fullyRefundedPaymentsDetected,
    zeroPaidInvoicesDetected,
    rowsUpdatedDueToRefunds,
    subscriptionsChecked,
    subscriptionsUpdated,
    subscriptionsActive,
    subscriptionsTrialing,
    subscriptionsCanceled,
    subscriptionsPaused,
    subscriptionsPastDue,
    subscriptionsIncomplete,
    subscriptionsUnpaid,
    subscriptionsUnknown,
    subscriptionsFailed,
    revenueEventsSaved,
  })
}

export async function POST(request: NextRequest) {
  try {
    return await syncStripeFinance(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[admin/finance/sync-stripe] sync failed', {
      message,
    })

    return NextResponse.json(
      {
        ok: false,
        message: `Synchronisation Stripe impossible : ${message}`,
      },
      { status: 500 },
    )
  }
}
