import Stripe from 'stripe'

import { normalizePlanId, type TooliaPlanId } from '@/lib/saas/plan-config'
import {
  findSubscriptionByStripeCustomerId,
  findSubscriptionByStripeSubscriptionId,
} from '@/lib/saas/subscription-store'
import { getPlanFromStripePriceId } from '@/lib/saas/stripe-plans'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type RevenueEventInput = {
  stripeEventId?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripeInvoiceId?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  stripeChargeId?: string | null
  userId?: string | null
  customerEmail?: string | null
  plan?: string | null
  currency?: string | null
  amountPaidCents?: number | null
  amountDueCents?: number | null
  amountDiscountCents?: number | null
  amountRefundedCents?: number | null
  periodStart?: string | null
  periodEnd?: string | null
  stripeCreatedAt?: string | null
  source: string
  rawType?: string | null
  metadata?: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function integerFrom(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function getStripeId(value: unknown) {
  if (typeof value === 'string') return value
  return stringFrom(asRecord(value).id)
}

function stripeDate(timestamp: unknown) {
  const seconds = Number(timestamp || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function cents(value: unknown) {
  return Math.max(0, integerFrom(value))
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

function totalDiscountCents(value: unknown) {
  const discounts = Array.isArray(value) ? value : []
  return discounts.reduce((sum, item) => sum + cents(asRecord(item).amount), 0)
}

function firstMatchingPlanFromLines(lines: unknown) {
  const data = Array.isArray(asRecord(lines).data) ? (asRecord(lines).data as unknown[]) : []
  for (const item of data) {
    const priceId = getStripeId(asRecord(item).price)
    const plan = getPlanFromStripePriceId(priceId)
    if (plan) return plan
  }
  return null
}

function firstLinePeriod(lines: unknown) {
  const data = Array.isArray(asRecord(lines).data) ? (asRecord(lines).data as unknown[]) : []
  for (const item of data) {
    const period = asRecord(asRecord(item).period)
    const start = stripeDate(period.start)
    const end = stripeDate(period.end)
    if (start || end) return { start, end }
  }
  return { start: null, end: null }
}

function firstInvoicePaymentIntentId(invoice: Record<string, unknown>) {
  const payments = asRecord(invoice.payments)
  const data = Array.isArray(payments.data) ? (payments.data as unknown[]) : []
  for (const item of data) {
    const payment = asRecord(asRecord(item).payment)
    const paymentIntentId = getStripeId(payment.payment_intent)
    if (paymentIntentId) return paymentIntentId
  }
  return null
}

function firstInvoiceChargeId(invoice: Record<string, unknown>) {
  const payments = asRecord(invoice.payments)
  const data = Array.isArray(payments.data) ? (payments.data as unknown[]) : []
  for (const item of data) {
    const payment = asRecord(asRecord(item).payment)
    const chargeId = getStripeId(payment.charge)
    if (chargeId) return chargeId
  }
  return null
}

function latestChargeIdFromPaymentIntent(value: unknown) {
  const paymentIntent = asRecord(value)
  return getStripeId(paymentIntent.latest_charge)
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null
  const allowed = new Set([
    'type',
    'plan',
    'from_plan',
    'to_plan',
    'payment_status',
    'billing_reason',
    'collection_method',
    'invoice_status',
    'discount_applied',
  ])

  return Object.fromEntries(Object.entries(metadata).filter(([key]) => allowed.has(key)))
}

function payloadForUpdate<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload }
  const preserveIfNull = [
    'stripe_event_id',
    'stripe_customer_id',
    'stripe_subscription_id',
    'stripe_invoice_id',
    'stripe_checkout_session_id',
    'stripe_payment_intent_id',
    'stripe_charge_id',
    'user_id',
    'customer_email',
    'plan',
    'amount_due_cents',
    'amount_discount_cents',
    'period_start',
    'period_end',
  ]

  for (const key of preserveIfNull) {
    if (next[key] === null || next[key] === undefined) {
      delete next[key]
    }
  }

  return next
}

async function resolveOwner(input: {
  stripeSubscriptionId?: string | null
  stripeCustomerId?: string | null
  userId?: string | null
  plan?: string | null
}) {
  let userId = input.userId || null
  let plan = input.plan && input.plan !== 'unknown' ? normalizePlanId(input.plan) : null
  let stripeCustomerId = input.stripeCustomerId || null

  if ((!userId || !plan || !stripeCustomerId) && input.stripeSubscriptionId) {
    const subscription = await findSubscriptionByStripeSubscriptionId(input.stripeSubscriptionId)
    userId = userId || subscription?.user_id || null
    plan = plan || (subscription?.plan_id ? normalizePlanId(subscription.plan_id) : null)
    stripeCustomerId = stripeCustomerId || subscription?.stripe_customer_id || null
  }

  if ((!userId || !plan) && stripeCustomerId) {
    const subscription = await findSubscriptionByStripeCustomerId(stripeCustomerId)
    userId = userId || subscription?.user_id || null
    plan = plan || (subscription?.plan_id ? normalizePlanId(subscription.plan_id) : null)
  }

  return {
    userId,
    plan: plan || null,
    stripeCustomerId,
  }
}

async function findExistingRevenueEvent(input: {
  stripeInvoiceId?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  stripeChargeId?: string | null
  stripeEventId?: string | null
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const candidates = [
    input.stripeInvoiceId ? { column: 'stripe_invoice_id', value: input.stripeInvoiceId } : null,
    input.stripeCheckoutSessionId ? { column: 'stripe_checkout_session_id', value: input.stripeCheckoutSessionId } : null,
    input.stripePaymentIntentId ? { column: 'stripe_payment_intent_id', value: input.stripePaymentIntentId } : null,
    input.stripeChargeId ? { column: 'stripe_charge_id', value: input.stripeChargeId } : null,
    input.stripeEventId ? { column: 'stripe_event_id', value: input.stripeEventId } : null,
  ].filter(Boolean) as Array<{ column: string; value: string }>

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('stripe_revenue_events')
      .select('id')
      .eq(candidate.column, candidate.value)
      .limit(1)
      .maybeSingle()

    if (error) {
      if (isMissingRelationError(error)) {
        return null
      }
      throw error
    }

    if (data?.id) return data.id as string
  }

  return null
}

async function findLikelyRefundTarget(input: {
  stripeCustomerId?: string | null
  amountPaidCents: number
  amountRefundedCents: number
  stripeCreatedAt?: string | null
}) {
  if (!input.stripeCustomerId || input.amountPaidCents <= 0 || input.amountRefundedCents <= 0) return null

  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  let query = supabase
    .from('stripe_revenue_events')
    .select('id,stripe_invoice_id,stripe_checkout_session_id,stripe_created_at,created_at')
    .eq('stripe_customer_id', input.stripeCustomerId)
    .eq('amount_paid_cents', input.amountPaidCents)
    .gt('net_revenue_cents', 0)
    .order('stripe_created_at', { ascending: false, nullsFirst: false })
    .limit(10)

  if (input.stripeCreatedAt) {
    const createdAt = Date.parse(input.stripeCreatedAt)
    if (Number.isFinite(createdAt)) {
      const start = new Date(createdAt - 7 * 24 * 60 * 60 * 1000).toISOString()
      const end = new Date(createdAt + 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('stripe_created_at', start).lte('stripe_created_at', end)
    }
  }

  const { data, error } = await query
  if (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }

  const candidates = data || []
  if (candidates.length === 1) return candidates[0].id as string

  const invoiceOrSessionCandidates = candidates.filter((row) => row.stripe_invoice_id || row.stripe_checkout_session_id)
  if (invoiceOrSessionCandidates.length === 1) return invoiceOrSessionCandidates[0].id as string

  if (input.stripeCreatedAt && candidates.length > 1) {
    const referenceTime = Date.parse(input.stripeCreatedAt)
    if (Number.isFinite(referenceTime)) {
      const ranked = candidates
        .map((row) => {
          const rawDate = row.stripe_created_at || row.created_at
          const rowTime = rawDate ? Date.parse(rawDate) : Number.NaN
          return {
            id: row.id as string,
            distance: Number.isFinite(rowTime) ? Math.abs(rowTime - referenceTime) : Number.POSITIVE_INFINITY,
          }
        })
        .filter((row) => Number.isFinite(row.distance))
        .sort((a, b) => a.distance - b.distance)

      if (ranked.length > 0 && (ranked.length === 1 || ranked[0].distance < ranked[1].distance)) {
        return ranked[0].id
      }
    }
  }

  if (process.env.NODE_ENV !== 'production' && candidates.length > 1) {
    console.warn('[stripe-revenue] skipped ambiguous refund target match', {
      stripeCustomerId: input.stripeCustomerId,
      amountPaidCents: input.amountPaidCents,
      candidateCount: candidates.length,
    })
  }

  return null
}

export async function upsertStripeRevenueEvent(input: RevenueEventInput) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return { ok: false, skipped: true, message: 'Supabase admin unavailable' }

  const owner = await resolveOwner({
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeCustomerId: input.stripeCustomerId,
    userId: input.userId,
    plan: input.plan,
  })
  const amountPaidCents = cents(input.amountPaidCents)
  const amountRefundedCents = cents(input.amountRefundedCents)
  const netRevenueCents = Math.max(0, amountPaidCents - amountRefundedCents)

  const payload = {
    stripe_created_at: input.stripeCreatedAt || null,
    stripe_event_id: input.stripeEventId || null,
    stripe_customer_id: owner.stripeCustomerId || input.stripeCustomerId || null,
    stripe_subscription_id: input.stripeSubscriptionId || null,
    stripe_invoice_id: input.stripeInvoiceId || null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
    stripe_payment_intent_id: input.stripePaymentIntentId || null,
    stripe_charge_id: input.stripeChargeId || null,
    user_id: owner.userId || null,
    customer_email: input.customerEmail || null,
    plan: owner.plan || (input.plan ? normalizePlanId(input.plan) : null),
    currency: (input.currency || 'eur').toLowerCase(),
    amount_paid_cents: amountPaidCents,
    amount_due_cents: input.amountDueCents === null || input.amountDueCents === undefined ? null : cents(input.amountDueCents),
    amount_discount_cents:
      input.amountDiscountCents === null || input.amountDiscountCents === undefined ? null : cents(input.amountDiscountCents),
    amount_refunded_cents: amountRefundedCents,
    net_revenue_cents: netRevenueCents,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    source: input.source,
    raw_type: input.rawType || null,
    metadata: sanitizeMetadata(input.metadata),
  }

  const shouldPreferRefundTarget = amountRefundedCents > 0 && amountPaidCents > 0
  let existingId = shouldPreferRefundTarget
    ? await findLikelyRefundTarget({
      stripeCustomerId: payload.stripe_customer_id,
      amountPaidCents,
      amountRefundedCents,
      stripeCreatedAt: payload.stripe_created_at,
    })
    : null

  if (!existingId) {
    existingId = await findExistingRevenueEvent({
      stripeInvoiceId: payload.stripe_invoice_id,
      stripeCheckoutSessionId: payload.stripe_checkout_session_id,
      stripePaymentIntentId: payload.stripe_payment_intent_id,
      stripeChargeId: payload.stripe_charge_id,
      stripeEventId: payload.stripe_event_id,
    })
  }

  const request = existingId
    ? supabase.from('stripe_revenue_events').update(payloadForUpdate(payload)).eq('id', existingId).select('id').single()
    : supabase.from('stripe_revenue_events').insert(payload).select('id').single()

  const { data, error } = await request
  if (error) {
    if (isMissingRelationError(error)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[stripe-revenue] revenue ledger unavailable', {
          rawType: input.rawType,
          source: input.source,
          code: error.code,
        })
      }
      return { ok: false, skipped: true, message: 'Revenue ledger unavailable' }
    }
    throw error
  }

  return {
    ok: true,
    id: data?.id as string | undefined,
    amountPaidCents,
    amountRefundedCents,
    netRevenueCents,
    fullyRefunded: amountPaidCents > 0 && amountRefundedCents >= amountPaidCents,
    zeroPaid: amountPaidCents === 0,
  }
}

export async function upsertStripeRevenueFromInvoice(input: {
  invoice: Stripe.Invoice
  stripeEventId?: string | null
  source: string
  rawType: string
  refundedCents?: number | null
  stripePaymentIntentId?: string | null
  stripeChargeId?: string | null
}) {
  const invoice = asRecord(input.invoice)
  const lines = asRecord(invoice.lines)
  const period = firstLinePeriod(lines)
  const subscriptionId = getStripeId(invoice.subscription)
  const customerId = getStripeId(invoice.customer)
  const metadataPlan = stringFrom(asRecord(invoice.metadata).plan)
  const plan = firstMatchingPlanFromLines(lines) || (metadataPlan ? normalizePlanId(metadataPlan) : null)
  const amountDiscountCents = totalDiscountCents(invoice.total_discount_amounts)
  const paymentIntentId = input.stripePaymentIntentId || firstInvoicePaymentIntentId(invoice)
  const chargeId = input.stripeChargeId || firstInvoiceChargeId(invoice)

  return upsertStripeRevenueEvent({
    stripeEventId: input.stripeEventId || null,
    stripeCreatedAt: stripeDate(invoice.created),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: stringFrom(invoice.id),
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    customerEmail: stringFrom(invoice.customer_email),
    plan,
    currency: stringFrom(invoice.currency) || 'eur',
    amountPaidCents: cents(invoice.amount_paid),
    amountDueCents: cents(invoice.amount_due),
    amountDiscountCents,
    amountRefundedCents: input.refundedCents ?? cents(invoice.amount_refunded),
    periodStart: period.start || stripeDate(invoice.period_start),
    periodEnd: period.end || stripeDate(invoice.period_end),
    source: input.source,
    rawType: input.rawType,
    metadata: {
      billing_reason: stringFrom(invoice.billing_reason),
      collection_method: stringFrom(invoice.collection_method),
      invoice_status: stringFrom(invoice.status),
      discount_applied: amountDiscountCents > 0,
    },
  })
}

export async function getInvoicePaymentRefs(stripe: Stripe, invoiceId: string | null | undefined) {
  if (!invoiceId) return { stripePaymentIntentId: null, stripeChargeId: null }

  const payments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    limit: 10,
    expand: ['data.payment.payment_intent', 'data.payment.charge'],
  })

  for (const item of payments.data) {
    const payment = asRecord(asRecord(item).payment)
    const paymentIntent = payment.payment_intent
    const paymentIntentId = getStripeId(paymentIntent)
    const chargeId = getStripeId(payment.charge) || latestChargeIdFromPaymentIntent(paymentIntent)

    if (paymentIntentId || chargeId) {
      return {
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
      }
    }
  }

  return { stripePaymentIntentId: null, stripeChargeId: null }
}

export async function upsertStripeRevenueFromCheckoutSession(input: {
  session: Stripe.Checkout.Session
  stripeEventId?: string | null
  source: string
  rawType: string
}) {
  const session = asRecord(input.session)
  const metadata = asRecord(session.metadata)
  const subscriptionId = getStripeId(session.subscription) || stringFrom(metadata.stripe_subscription_id)
  const customerId = getStripeId(session.customer)
  const paymentIntentId = getStripeId(session.payment_intent)
  const chargeId = latestChargeIdFromPaymentIntent(session.payment_intent)
  const plan =
    stringFrom(metadata.to_plan) ||
    stringFrom(metadata.plan) ||
    stringFrom(metadata.from_plan)

  return upsertStripeRevenueEvent({
    stripeEventId: input.stripeEventId || null,
    stripeCreatedAt: stripeDate(session.created),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: getStripeId(session.invoice),
    stripeCheckoutSessionId: stringFrom(session.id),
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    userId: stringFrom(metadata.user_id) || stringFrom(session.client_reference_id),
    customerEmail: stringFrom(asRecord(session.customer_details).email) || stringFrom(session.customer_email),
    plan,
    currency: stringFrom(session.currency) || 'eur',
    amountPaidCents: cents(session.amount_total),
    amountDueCents: cents(session.amount_subtotal),
    amountDiscountCents: cents(session.total_details && asRecord(session.total_details).amount_discount),
    amountRefundedCents: 0,
    periodStart: null,
    periodEnd: null,
    source: input.source,
    rawType: input.rawType,
    metadata: {
      type: stringFrom(metadata.type),
      plan: stringFrom(metadata.plan),
      from_plan: stringFrom(metadata.from_plan),
      to_plan: stringFrom(metadata.to_plan),
      payment_status: stringFrom(session.payment_status),
    },
  })
}

export async function upsertStripeRevenueFromChargeRefund(input: {
  stripe: Stripe
  charge: Stripe.Charge
  stripeEventId?: string | null
  source: string
  rawType: string
}) {
  const charge = asRecord(input.charge)
  const invoiceId = getStripeId(charge.invoice)
  const chargeId = stringFrom(charge.id)
  const paymentIntentId = getStripeId(charge.payment_intent)
  if (!invoiceId) {
    return upsertStripeRevenueEvent({
      stripeEventId: input.stripeEventId || null,
      stripeCreatedAt: stripeDate(charge.created),
      stripeCustomerId: getStripeId(charge.customer),
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      amountPaidCents: cents(charge.amount),
      amountRefundedCents: cents(charge.amount_refunded),
      currency: stringFrom(charge.currency) || 'eur',
      source: input.source,
      rawType: input.rawType,
    })
  }

  const invoice = await input.stripe.invoices.retrieve(invoiceId, {
    expand: ['lines.data.price'],
  })
  return upsertStripeRevenueFromInvoice({
    invoice,
    stripeEventId: input.stripeEventId || null,
    source: input.source,
    rawType: input.rawType,
    refundedCents: cents(charge.amount_refunded),
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
  })
}
