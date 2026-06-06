import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { isTooliaPlanId, normalizePlanId, type TooliaPlanId } from "@/lib/saas/plan-config";
import {
  findSubscriptionByStripeCustomerId,
  findSubscriptionByStripeSubscriptionId,
  getStripeSubscriptionCurrentPeriodEnd,
  normalizeSubscriptionStatus,
  upsertStripeSubscription,
} from "@/lib/saas/subscription-store";
import {
  getPlanFromStripePriceId,
  getStripePlanConfig,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "@/lib/saas/stripe-plans";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function getSubscriptionId(value: unknown) {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return stringFrom(record.id);
}

function getCustomerId(value: unknown) {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return stringFrom(record.id);
}

function getPlanFromMetadata(metadata: unknown) {
  const record = asRecord(metadata);
  const plan = stringFrom(record.plan);
  return isTooliaPlanId(plan) ? plan : null;
}

async function getPlanFromSubscriptionItems(subscription: Stripe.Subscription) {
  const item = subscription.items.data.find((subscriptionItem) => {
    const priceId = subscriptionItem.price?.id;
    return Boolean(getPlanFromStripePriceId(priceId));
  });

  return getPlanFromStripePriceId(item?.price?.id) || null;
}

function getMonthlySubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data.find((item) => item.price?.recurring?.interval === "month") || null;
}

async function persistSubscriptionFromStripe(input: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  fallbackUserId?: string | null;
  fallbackPlan?: TooliaPlanId | null;
}) {
  const subscriptionRecord = asRecord(input.subscription);
  const customerId = getCustomerId(subscriptionRecord.customer);
  const subscriptionId = stringFrom(subscriptionRecord.id);
  const metadataPlan = getPlanFromMetadata(subscriptionRecord.metadata);
  const planFromPrice = await getPlanFromSubscriptionItems(input.subscription);
  const plan = planFromPrice || metadataPlan || input.fallbackPlan;

  let userId = stringFrom(asRecord(subscriptionRecord.metadata).user_id) || input.fallbackUserId || null;

  if (!userId && subscriptionId) {
    const existing = await findSubscriptionByStripeSubscriptionId(subscriptionId);
    userId = existing?.user_id || null;
  }

  if (!userId && customerId) {
    const existing = await findSubscriptionByStripeCustomerId(customerId);
    userId = existing?.user_id || null;
  }

  if (!userId || !subscriptionId || !customerId || !plan) {
    console.warn("[stripe/webhook] subscription ignored: missing mapping", {
      hasUserId: Boolean(userId),
      hasStripeSubscriptionId: Boolean(subscriptionId),
      hasStripeCustomerId: Boolean(customerId),
      hasPlan: Boolean(plan),
    });
    return;
  }

  const status = normalizeSubscriptionStatus(stringFrom(subscriptionRecord.status));
  const currentPeriodEnd = getStripeSubscriptionCurrentPeriodEnd(input.subscription);

  if (process.env.NODE_ENV !== "production") {
    console.log("[stripe/webhook] persisting subscription", {
      userId,
      status,
      plan: normalizePlanId(plan),
      hasCurrentPeriodEnd: Boolean(currentPeriodEnd),
      periodEndSource: subscriptionRecord.current_period_end ? "subscription" : currentPeriodEnd ? "subscription_item" : "missing",
    });
  }

  await upsertStripeSubscription({
    userId,
    plan: normalizePlanId(plan),
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    currentPeriodEnd,
  });
}

function hasPendingTooliaUpgrade(subscription: Stripe.Subscription) {
  return subscription.metadata?.toolia_pending_upgrade === "true";
}

async function clearPendingTooliaUpgrade(stripe: Stripe, subscription: Stripe.Subscription) {
  if (!hasPendingTooliaUpgrade(subscription)) return;

  await stripe.subscriptions.update(subscription.id, {
    metadata: {
      toolia_pending_upgrade: "",
      toolia_upgrade_setup_delta: "",
      from_plan: "",
      to_plan: "",
    },
  });
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.metadata?.type === "toolia_plan_upgrade") {
    await handleUpgradeCheckoutCompleted(stripe, session);
    return;
  }

  const subscriptionId = getSubscriptionId(session.subscription);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  await persistSubscriptionFromStripe({
    stripe,
    subscription,
    fallbackUserId: stringFrom(session.metadata?.user_id) || stringFrom(session.client_reference_id),
    fallbackPlan: getPlanFromMetadata(session.metadata),
  });
}

async function handleUpgradeCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const metadata = asRecord(session.metadata);
  const userId = stringFrom(metadata.user_id) || stringFrom(session.client_reference_id);
  const subscriptionId = stringFrom(metadata.stripe_subscription_id);
  const targetPlan = stringFrom(metadata.to_plan);
  const fromPlan = stringFrom(metadata.from_plan);

  if (process.env.NODE_ENV !== "production") {
    console.log("[stripe/webhook] upgrade session received", {
      userId,
      fromPlan,
      toPlan: targetPlan,
      subscriptionId,
      paymentStatus: session.payment_status,
    });
  }

  if (!userId || !subscriptionId || !isTooliaPlanId(targetPlan) || targetPlan === "starter") {
    console.warn("[stripe/webhook] upgrade checkout ignored: missing metadata", {
      hasUserId: Boolean(userId),
      hasSubscriptionId: Boolean(subscriptionId),
      targetPlan,
    });
    return;
  }

  if (session.payment_status !== "paid") {
    console.warn("[stripe/webhook] upgrade checkout ignored: payment not paid", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const targetConfig = getStripePlanConfig(targetPlan);
  if (!targetConfig.monthlyPriceId) {
    throw new Error(`Configuration Stripe incomplète : ${targetConfig.monthlyPriceEnvKey} manquant.`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const monthlyItem = getMonthlySubscriptionItem(subscription);
  const customerId = getCustomerId(subscription.customer);

  if (!monthlyItem || !customerId) {
    console.warn("[stripe/webhook] upgrade checkout ignored: invalid subscription", {
      hasMonthlyItem: Boolean(monthlyItem),
      hasCustomerId: Boolean(customerId),
      subscriptionId,
    });
    return;
  }

  const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: monthlyItem.id, price: targetConfig.monthlyPriceId }],
    proration_behavior: "none",
    metadata: {
      ...subscription.metadata,
      user_id: userId,
      plan: targetPlan,
      toolia_last_upgrade_checkout_session: session.id,
      toolia_pending_upgrade: "",
      toolia_upgrade_setup_delta: "",
      from_plan: "",
      to_plan: "",
    },
    expand: ["items.data.price"],
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[stripe/webhook] upgrade subscription updated", {
      userId,
      fromPlan,
      toPlan: targetPlan,
      subscriptionId: updatedSubscription.id,
    });
  }

  const customerIdAfterUpdate = getCustomerId(updatedSubscription.customer) || customerId;
  const subscriptionRecord = asRecord(updatedSubscription);
  const currentPeriodEnd = getStripeSubscriptionCurrentPeriodEnd(updatedSubscription);
  const result = await upsertStripeSubscription({
    userId,
    plan: targetPlan,
    status: normalizeSubscriptionStatus(stringFrom(subscriptionRecord.status)),
    stripeCustomerId: customerIdAfterUpdate,
    stripeSubscriptionId: updatedSubscription.id,
    currentPeriodEnd,
  });

  if (!result.ok) {
    console.error("[stripe/webhook] upgrade Supabase update failed", {
      userId,
      fromPlan,
      toPlan: targetPlan,
      hasStripeCustomerId: Boolean(customerIdAfterUpdate),
      hasStripeSubscriptionId: Boolean(updatedSubscription.id),
      message: result.message,
    });
    throw new Error(`Supabase subscription update failed: ${result.message}`);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[stripe/webhook] upgrade Supabase updated", {
      userId,
      fromPlan,
      toPlan: targetPlan,
      subscriptionId: updatedSubscription.id,
    });
  }
}

async function handleInvoiceEvent(stripe: Stripe, invoice: Stripe.Invoice, status: "active" | "past_due") {
  const invoiceRecord = asRecord(invoice);
  const subscriptionId = getSubscriptionId(invoiceRecord.subscription);
  const customerId = getCustomerId(invoiceRecord.customer);

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    if (status === "past_due" && hasPendingTooliaUpgrade(subscription)) {
      const existing = await findSubscriptionByStripeSubscriptionId(subscription.id);
      if (existing) {
        await upsertStripeSubscription({
          userId: existing.user_id,
          plan: existing.plan_id,
          status: existing.status,
          stripeCustomerId: existing.stripe_customer_id || getCustomerId(subscription.customer) || "",
          stripeSubscriptionId: existing.stripe_subscription_id || subscription.id,
          currentPeriodEnd: existing.current_period_end,
        });
      }
      return;
    }

    await persistSubscriptionFromStripe({ stripe, subscription });
    if (status === "active") {
      await clearPendingTooliaUpgrade(stripe, subscription);
    }
    return;
  }

  if (!customerId) return;

  const existing = await findSubscriptionByStripeCustomerId(customerId);
  if (!existing?.stripe_subscription_id) return;

  await upsertStripeSubscription({
    userId: existing.user_id,
    plan: existing.plan_id,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: existing.stripe_subscription_id,
    currentPeriodEnd: existing.current_period_end,
  });
}

export async function POST(request: NextRequest) {
  const stripeSecretKey = getStripeSecretKey();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { ok: false, message: "Configuration Stripe webhook incomplète." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Signature Stripe manquante." }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook] invalid signature", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, message: "Signature Stripe invalide." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      if (event.type === "customer.subscription.updated" && hasPendingTooliaUpgrade(subscription)) {
        return NextResponse.json({ ok: true, skipped: "pending_upgrade_waiting_for_invoice" });
      }

      await persistSubscriptionFromStripe({
        stripe,
        subscription,
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      await handleInvoiceEvent(stripe, event.data.object as Stripe.Invoice, "active");
    }

    if (event.type === "invoice.payment_failed") {
      await handleInvoiceEvent(stripe, event.data.object as Stripe.Invoice, "past_due");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stripe/webhook] processing failed", {
      eventType: event.type,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: "Traitement du webhook Stripe impossible." },
      { status: 500 },
    );
  }
}
