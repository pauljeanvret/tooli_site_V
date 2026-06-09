import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

import { normalizePlanId, type TooliaPlanId } from "./plan-config";
import { getPlanFromStripePriceId, getStripePlanConfig, getStripeSecretKey } from "./stripe-plans";

export type TooliaSubscriptionStatus = "demo" | "trialing" | "active" | "past_due" | "canceled";

export type TooliaSubscriptionRecord = {
  id: string;
  user_id: string;
  plan_id: string;
  status: TooliaSubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TooliaBillingState = {
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  scheduledChange: {
    type: "plan_change" | "cancellation";
    planId?: TooliaPlanId;
    planName?: string;
    effectiveAt: string | null;
  } | null;
  nextEstimatedPaymentCents: number | null;
};

export type TooliaWorkerSubscriptionAccess = {
  allowed: boolean;
  reason: string;
  subscription: TooliaSubscriptionRecord | null;
  planId: TooliaPlanId | null;
  currentPeriodEnd: string | null;
  periodEndSource: "supabase" | "stripe" | "missing";
};

export function isPaidSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function normalizeSubscriptionStatus(status: string | null | undefined): TooliaSubscriptionStatus {
  if (status === "demo" || status === "trialing" || status === "active" || status === "past_due") {
    return status;
  }

  if (status === "canceled" || status === "cancelled" || status === "incomplete_expired") {
    return "canceled";
  }

  return "past_due";
}

export function dateFromStripeTimestamp(timestamp: number | null | undefined) {
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

function getCustomerId(value: unknown) {
  if (typeof value === "string") return value;
  return stringFrom(asRecord(value).id);
}

function getMonthlySubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data.find((item) => item.price?.recurring?.interval === "month") || null;
}

function getStripeTimestamp(value: unknown, key: "current_period_end" | "cancel_at") {
  return numberFrom(asRecord(value)[key]);
}

export function getStripeSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const monthlyItem = getMonthlySubscriptionItem(subscription);
  return (
    dateFromStripeTimestamp(getStripeTimestamp(subscription, "current_period_end")) ||
    dateFromStripeTimestamp(getStripeTimestamp(monthlyItem, "current_period_end")) ||
    null
  );
}

function getPlanIdFromStripeSubscription(subscription: Stripe.Subscription, fallbackPlan?: string | null) {
  for (const item of subscription.items.data) {
    const plan = getPlanFromStripePriceId(item.price?.id);
    if (plan) return plan;
  }

  return fallbackPlan ? normalizePlanId(fallbackPlan) : null;
}

export async function getLatestSubscriptionForUser(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_end,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] latest lookup failed", { userId, message: error.message });
    return null;
  }

  return (data as TooliaSubscriptionRecord | null) || null;
}

export async function getActiveSubscriptionForUser(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_end,created_at,updated_at",
    )
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] active lookup failed", { userId, message: error.message });
    return null;
  }

  return (data as TooliaSubscriptionRecord | null) || null;
}

export async function getEntitledPlanIdForUser(userId: string): Promise<TooliaPlanId> {
  const subscription = await getActiveSubscriptionForUser(userId);
  return subscription ? normalizePlanId(subscription.plan_id) : "starter";
}

export async function getWorkerSubscriptionAccessForUser(
  userId: string,
): Promise<TooliaWorkerSubscriptionAccess> {
  const subscription = await getActiveSubscriptionForUser(userId);

  if (!subscription) {
    const latestSubscription = await getLatestSubscriptionForUser(userId);

    return {
      allowed: false,
      reason: latestSubscription?.status
        ? `Abonnement non actif (${latestSubscription.status}).`
        : "Aucun abonnement payant actif.",
      subscription: latestSubscription,
      planId: latestSubscription ? normalizePlanId(latestSubscription.plan_id) : null,
      currentPeriodEnd: latestSubscription?.current_period_end || null,
      periodEndSource: latestSubscription?.current_period_end ? "supabase" : "missing",
    };
  }

  if (!isPaidSubscriptionStatus(subscription.status)) {
    return {
      allowed: false,
      reason: `Abonnement non actif (${subscription.status}).`,
      subscription,
      planId: normalizePlanId(subscription.plan_id),
      currentPeriodEnd: subscription.current_period_end,
      periodEndSource: subscription.current_period_end ? "supabase" : "missing",
    };
  }

  let currentPeriodEnd = subscription.current_period_end;
  let periodEndSource: TooliaWorkerSubscriptionAccess["periodEndSource"] = currentPeriodEnd
    ? "supabase"
    : "missing";
  let periodEndMs = currentPeriodEnd ? Date.parse(currentPeriodEnd) : Number.NaN;
  const needsStripeSync =
    !currentPeriodEnd || !Number.isFinite(periodEndMs) || periodEndMs <= Date.now();

  if (needsStripeSync && subscription.stripe_subscription_id) {
    const stripeSecretKey = getStripeSecretKey();
    if (stripeSecretKey) {
      try {
        const stripe = new Stripe(stripeSecretKey);
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
          expand: ["items.data.price"],
        });
        const stripeStatus = normalizeSubscriptionStatus(stringFrom(asRecord(stripeSubscription).status));
        const stripePeriodEnd = getStripeSubscriptionCurrentPeriodEnd(stripeSubscription);
        const stripeCustomerId = getCustomerId(stripeSubscription.customer);
        const stripePlan = getPlanIdFromStripeSubscription(stripeSubscription, subscription.plan_id);

        if (process.env.NODE_ENV !== "production") {
          console.log("[subscriptions] worker subscription period checked", {
            userId,
            subscriptionStatus: stripeStatus,
            periodEndSource: stripePeriodEnd ? "stripe" : periodEndSource,
            hasSupabasePeriodEnd: Boolean(subscription.current_period_end),
            hasStripePeriodEnd: Boolean(stripePeriodEnd),
          });
        }

        if (!isPaidSubscriptionStatus(stripeStatus)) {
          return {
            allowed: false,
            reason: `Abonnement non actif (${stripeStatus}).`,
            subscription: {
              ...subscription,
              status: stripeStatus,
              current_period_end: stripePeriodEnd || currentPeriodEnd,
            },
            planId: stripePlan || normalizePlanId(subscription.plan_id),
            currentPeriodEnd: stripePeriodEnd || currentPeriodEnd,
            periodEndSource: stripePeriodEnd ? "stripe" : periodEndSource,
          };
        }

        if (stripePeriodEnd && stripeCustomerId && stripePlan) {
          await upsertStripeSubscription({
            userId,
            plan: stripePlan,
            status: stripeStatus,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscription.id,
            currentPeriodEnd: stripePeriodEnd,
          });

          currentPeriodEnd = stripePeriodEnd;
          periodEndSource = "stripe";
          periodEndMs = Date.parse(currentPeriodEnd);
        }
      } catch (error) {
        console.error("[subscriptions] worker Stripe period sync failed", {
          userId,
          subscriptionStatus: subscription.status,
          hasStripeSubscriptionId: Boolean(subscription.stripe_subscription_id),
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (!currentPeriodEnd) {
    return {
      allowed: false,
      reason: "Date de fin de période payée introuvable.",
      subscription,
      planId: normalizePlanId(subscription.plan_id),
      currentPeriodEnd: null,
      periodEndSource,
    };
  }

  if (!Number.isFinite(periodEndMs)) {
    return {
      allowed: false,
      reason: "Date de fin de période payée invalide.",
      subscription,
      planId: normalizePlanId(subscription.plan_id),
      currentPeriodEnd,
      periodEndSource,
    };
  }

  if (periodEndMs <= Date.now()) {
    return {
      allowed: false,
      reason: "La période payée est terminée.",
      subscription,
      planId: normalizePlanId(subscription.plan_id),
      currentPeriodEnd,
      periodEndSource,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[subscriptions] worker subscription access granted", {
      userId,
      subscriptionStatus: subscription.status,
      periodEndSource,
    });
  }

  return {
    allowed: true,
    reason: "Abonnement valide.",
    subscription,
    planId: normalizePlanId(subscription.plan_id),
    currentPeriodEnd,
    periodEndSource,
  };
}

export async function getStripeCustomerIdForUser(userId: string) {
  const activeSubscription = await getActiveSubscriptionForUser(userId);
  if (activeSubscription?.stripe_customer_id) return activeSubscription.stripe_customer_id;

  const latestSubscription = await getLatestSubscriptionForUser(userId);
  return latestSubscription?.stripe_customer_id || null;
}

export async function findSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_end,created_at,updated_at",
    )
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] stripe subscription lookup failed", {
      hasStripeSubscriptionId: Boolean(stripeSubscriptionId),
      message: error.message,
    });
    return null;
  }

  return (data as TooliaSubscriptionRecord | null) || null;
}

export async function findSubscriptionByStripeCustomerId(stripeCustomerId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan_id,status,stripe_customer_id,stripe_subscription_id,current_period_end,created_at,updated_at",
    )
    .eq("stripe_customer_id", stripeCustomerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] stripe customer lookup failed", {
      hasStripeCustomerId: Boolean(stripeCustomerId),
      message: error.message,
    });
    return null;
  }

  return (data as TooliaSubscriptionRecord | null) || null;
}

export async function upsertStripeSubscription(input: {
  userId: string;
  plan: string;
  status: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd?: string | null;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { ok: false, message: "Client Supabase serveur indisponible." };
  }

  const { data: profile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .limit(1)
    .maybeSingle();

  if (profileLookupError) {
    console.error("[subscriptions] profile lookup failed before stripe upsert", {
      userId: input.userId,
      message: profileLookupError.message,
    });
    return { ok: false, message: profileLookupError.message };
  }

  if (!profile?.id) {
    console.warn("[subscriptions] stripe upsert ignored for deleted profile", {
      userId: input.userId,
      hasStripeCustomerId: Boolean(input.stripeCustomerId),
      hasStripeSubscriptionId: Boolean(input.stripeSubscriptionId),
    });
    return { ok: true, id: null, skipped: "profile_missing" };
  }

  const planId = normalizePlanId(input.plan);
  const status = normalizeSubscriptionStatus(input.status);
  const existing = await findSubscriptionByStripeSubscriptionId(input.stripeSubscriptionId);
  const payload = {
    user_id: input.userId,
    plan_id: planId,
    status,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    current_period_end: input.currentPeriodEnd || existing?.current_period_end || null,
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? admin.from("subscriptions").update(payload).eq("id", existing.id).select("id").single()
    : admin.from("subscriptions").insert(payload).select("id").single();

  const { data, error } = await query;

  if (error) {
    console.error("[subscriptions] stripe upsert failed", {
      userId: input.userId,
      planId,
      status,
      hasStripeCustomerId: Boolean(input.stripeCustomerId),
      hasStripeSubscriptionId: Boolean(input.stripeSubscriptionId),
      message: error.message,
    });
    return { ok: false, message: error.message };
  }

  return { ok: true, id: data.id as string };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberFrom(value: unknown) {
  return typeof value === "number" ? value : null;
}

function getPriceIdFromPhase(phase: unknown) {
  const phaseRecord = asRecord(phase);
  const items = Array.isArray(phaseRecord.items) ? phaseRecord.items : [];
  for (const item of items) {
    const itemRecord = asRecord(item);
    const price = itemRecord.price;
    if (typeof price === "string") return price;
    const priceId = stringFrom(asRecord(price).id);
    if (priceId) return priceId;
  }
  return null;
}

function getScheduledPlanFromSchedule(schedule: unknown) {
  const scheduleRecord = asRecord(schedule);
  const phases = Array.isArray(scheduleRecord.phases) ? scheduleRecord.phases : [];
  const currentPhase = asRecord(scheduleRecord.current_phase);
  const currentPhaseEnd = numberFrom(currentPhase.end_date);
  const now = Math.floor(Date.now() / 1000);

  const futurePhase = phases.find((phase) => {
    const phaseStart = numberFrom(asRecord(phase).start_date);
    return Boolean(phaseStart && phaseStart >= Math.max(now, currentPhaseEnd || 0));
  });

  const priceId = getPriceIdFromPhase(futurePhase);
  const planId = getPlanFromStripePriceId(priceId);
  const effectiveAt =
    dateFromStripeTimestamp(numberFrom(asRecord(futurePhase).start_date) || currentPhaseEnd) || null;

  return planId ? { planId, effectiveAt } : null;
}

function getScheduledPlanFromPendingUpdate(subscription: Stripe.Subscription) {
  const pendingUpdate = asRecord(asRecord(subscription).pending_update);
  const items = Array.isArray(pendingUpdate.subscription_items) ? pendingUpdate.subscription_items : [];

  for (const item of items) {
    const price = asRecord(item).price;
    const priceId = typeof price === "string" ? price : stringFrom(asRecord(price).id);
    const planId = getPlanFromStripePriceId(priceId);
    if (planId) {
      return {
        planId,
        effectiveAt: getStripeSubscriptionCurrentPeriodEnd(subscription),
      };
    }
  }

  return null;
}

export async function getStripeBillingStateForUser(userId: string): Promise<TooliaBillingState | null> {
  const subscriptionRecord = await getActiveSubscriptionForUser(userId);
  if (!subscriptionRecord?.stripe_subscription_id) return null;

  const fallbackPeriodEnd = subscriptionRecord.current_period_end || null;
  const fallback: TooliaBillingState = {
    currentPeriodEnd: fallbackPeriodEnd,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    scheduledChange: null,
    nextEstimatedPaymentCents: null,
  };

  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) return fallback;

  try {
    const stripe = new Stripe(stripeSecretKey);
    const subscription = await stripe.subscriptions.retrieve(subscriptionRecord.stripe_subscription_id, {
      expand: ["items.data.price", "schedule"],
    });
    const currentPeriodEnd = getStripeSubscriptionCurrentPeriodEnd(subscription);
    const cancelAt = dateFromStripeTimestamp(getStripeTimestamp(subscription, "cancel_at"));
    const subscriptionRecordRaw = asRecord(subscription);
    const cancelAtPeriodEnd = subscriptionRecordRaw.cancel_at_period_end === true;

    let scheduledChange: TooliaBillingState["scheduledChange"] = null;

    if (cancelAtPeriodEnd || cancelAt) {
      scheduledChange = {
        type: "cancellation",
        effectiveAt: cancelAt || currentPeriodEnd || fallbackPeriodEnd,
      };
    } else {
      const schedule = subscriptionRecordRaw.schedule;
      const fromSchedule = getScheduledPlanFromSchedule(schedule);
      const fromPendingUpdate = getScheduledPlanFromPendingUpdate(subscription);
      const futurePlan = fromSchedule || fromPendingUpdate;

      if (futurePlan && futurePlan.planId !== normalizePlanId(subscriptionRecord.plan_id)) {
        const plan = getStripePlanConfig(futurePlan.planId);
        scheduledChange = {
          type: "plan_change",
          planId: futurePlan.planId,
          planName: plan.name,
          effectiveAt: futurePlan.effectiveAt || currentPeriodEnd || fallbackPeriodEnd,
        };
      }
    }

    return {
      currentPeriodEnd: currentPeriodEnd || fallbackPeriodEnd,
      cancelAtPeriodEnd,
      cancelAt,
      scheduledChange,
      nextEstimatedPaymentCents: null,
    };
  } catch (error) {
    console.error("[subscriptions] stripe billing state lookup failed", {
      userId,
      hasStripeSubscriptionId: Boolean(subscriptionRecord.stripe_subscription_id),
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}
