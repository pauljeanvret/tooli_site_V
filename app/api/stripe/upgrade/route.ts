import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { isTooliaPlanId, normalizePlanId, type TooliaPlanId } from "@/lib/saas/plan-config";
import { getPersistedSaasState } from "@/lib/saas/supabase-store";
import { getActiveSubscriptionForUser } from "@/lib/saas/subscription-store";
import {
  getPlanFromStripePriceId,
  getPublicAppUrl,
  getStripePlanConfig,
  getStripeSecretKey,
} from "@/lib/saas/stripe-plans";
import { requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const planRank: Record<TooliaPlanId, number> = {
  starter: 0,
  pro: 1,
  premium: 2,
};

const setupDeltaCents: Record<string, number> = {
  "starter:pro": 5000,
  "starter:premium": 15000,
  "pro:premium": 10000,
};

const monthlyDeltaCents: Record<string, number> = {
  "starter:pro": 4000,
  "starter:premium": 10000,
  "pro:premium": 6000,
};

function safeStripeError(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const message =
    typeof record?.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : String(error);

  return {
    type: typeof record?.type === "string" ? record.type : null,
    code: typeof record?.code === "string" ? record.code : null,
    message: message.replace(/price_[A-Za-z0-9_]+/g, "[Price ID]"),
    statusCode: typeof record?.statusCode === "number" ? record.statusCode : null,
  };
}

function getCustomerId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return "";
}

function getMonthlySubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data.find((item) => item.price?.recurring?.interval === "month") || null;
}

function getStripeTimestamp(value: unknown, key: "current_period_start" | "current_period_end") {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return typeof record[key] === "number" ? record[key] : null;
}

function getBillingPeriod(subscription: Stripe.Subscription, monthlyItem: Stripe.SubscriptionItem) {
  const start =
    getStripeTimestamp(monthlyItem, "current_period_start") ||
    getStripeTimestamp(subscription, "current_period_start");
  const end =
    getStripeTimestamp(monthlyItem, "current_period_end") ||
    getStripeTimestamp(subscription, "current_period_end");

  return { start, end };
}

function calculateUpgradeAmount(input: {
  fromPlan: TooliaPlanId;
  toPlan: TooliaPlanId;
  subscriptionCurrentPeriodStart: number | null;
  subscriptionCurrentPeriodEnd: number | null;
}) {
  const key = `${input.fromPlan}:${input.toPlan}`;
  const setupDelta = setupDeltaCents[key] || 0;
  const monthlyDifference = monthlyDeltaCents[key] || 0;
  const periodStart = input.subscriptionCurrentPeriodStart;
  const periodEnd = input.subscriptionCurrentPeriodEnd;

  if (!periodStart || !periodEnd || periodEnd <= periodStart) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[stripe/upgrade] missing billing period, using full monthly delta", {
        fromPlan: input.fromPlan,
        toPlan: input.toPlan,
        hasPeriodStart: Boolean(periodStart),
        hasPeriodEnd: Boolean(periodEnd),
      });
    }

    return {
      setupDeltaCents: setupDelta,
      monthlyDeltaCents: monthlyDifference,
      prorataCents: monthlyDifference,
      totalDueNowCents: setupDelta + monthlyDifference,
      prorataRatio: 1,
      usedFallbackPeriod: true,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const totalPeriod = Math.max(1, periodEnd - periodStart);
  const remaining = Math.max(0, periodEnd - now);
  const remainingRatio = Math.min(1, remaining / totalPeriod);
  const prorata = remaining > 0 ? Math.max(1, Math.round(monthlyDifference * remainingRatio)) : monthlyDifference;

  return {
    setupDeltaCents: setupDelta,
    monthlyDeltaCents: monthlyDifference,
    prorataCents: prorata,
    totalDueNowCents: setupDelta + prorata,
    prorataRatio: remaining > 0 ? remainingRatio : 1,
    usedFallbackPeriod: remaining <= 0,
  };
}

async function validateTargetMonthlyPrice(stripe: Stripe, targetPlan: TooliaPlanId) {
  const config = getStripePlanConfig(targetPlan);

  if (!config.monthlyPriceId) {
    return {
      ok: false,
      message: `Configuration Stripe incomplète : ${config.monthlyPriceEnvKey} manquant.`,
      config,
    };
  }

  try {
    const price = await stripe.prices.retrieve(config.monthlyPriceId);

    if (!price.active) {
      return { ok: false, message: `Prix Stripe inactif pour ${config.monthlyPriceEnvKey}.`, config };
    }

    if (price.currency !== "eur" || price.unit_amount !== config.monthlyPriceEur * 100) {
      return {
        ok: false,
        message: `Prix Stripe invalide pour ${config.monthlyPriceEnvKey} : montant attendu ${config.monthlyPriceEur} € en EUR.`,
        config,
      };
    }

    if (!price.recurring || price.recurring.interval !== "month") {
      return {
        ok: false,
        message: `Prix Stripe invalide pour ${config.monthlyPriceEnvKey} : utilisez un prix mensuel récurrent.`,
        config,
      };
    }

    return { ok: true, message: "", config };
  } catch (error) {
    const safeError = safeStripeError(error);
    return {
      ok: false,
      message:
        process.env.NODE_ENV !== "production"
          ? `Prix Stripe invalide pour ${config.monthlyPriceEnvKey} : ${safeError.message}.`
          : `Prix Stripe invalide pour ${config.monthlyPriceEnvKey}.`,
      config,
    };
  }
}

async function getUpgradeContext(request: NextRequest, targetPlan: TooliaPlanId) {
  const auth = await requireAuthenticatedRouteUser(request);
  if (auth.response) return { response: auth.response };

  const activeSubscription = await getActiveSubscriptionForUser(auth.user.id);
  if (!activeSubscription?.stripe_subscription_id) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          code: "checkout_required",
          message: "Aucune offre active trouvée. Utilisez Stripe Checkout pour choisir une première offre.",
        },
        { status: 409 },
      ),
    };
  }

  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    return {
      response: NextResponse.json(
        { ok: false, message: "Configuration Stripe incomplète : STRIPE_SECRET_KEY manquant." },
        { status: 500 },
      ),
    };
  }

  const stripe = new Stripe(stripeSecretKey);
  const targetValidation = await validateTargetMonthlyPrice(stripe, targetPlan);
  if (!targetValidation.ok) {
    return { response: NextResponse.json({ ok: false, message: targetValidation.message }, { status: 500 }) };
  }

  const subscription = await stripe.subscriptions.retrieve(activeSubscription.stripe_subscription_id, {
    expand: ["items.data.price"],
  });
  const monthlyItem = getMonthlySubscriptionItem(subscription);
  if (!monthlyItem) {
    return {
      response: NextResponse.json(
        { ok: false, message: "Abonnement Stripe invalide : aucun prix mensuel récurrent trouvé." },
        { status: 500 },
      ),
    };
  }

  const stripeCurrentPlan = getPlanFromStripePriceId(monthlyItem.price?.id);
  const currentPlan = normalizePlanId(activeSubscription.plan_id);
  if (stripeCurrentPlan && stripeCurrentPlan !== currentPlan && process.env.NODE_ENV !== "production") {
    console.warn("[stripe/upgrade] Stripe subscription price differs from Toolia plan", {
      tooliaPlan: currentPlan,
      stripePlan: stripeCurrentPlan,
      targetPlan,
    });
  }
  const persistedState = await getPersistedSaasState(auth.user.id).catch(() => null);
  const returnPath = persistedState?.dashboard ? "/dashboard" : "/onboarding";

  if (currentPlan === targetPlan) {
    return {
      response: NextResponse.json({
        ok: true,
        noOp: true,
        message: `Votre offre ${getStripePlanConfig(targetPlan).name} est déjà active.`,
        redirectTo: returnPath,
      }),
    };
  }

  if (planRank[targetPlan] < planRank[currentPlan]) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          code: "portal_required",
          portalRequired: true,
          message: "Cette modification est une baisse d’offre. Elle se gère dans le portail sécurisé Stripe.",
        },
        { status: 409 },
      ),
    };
  }

  const setupDelta = setupDeltaCents[`${currentPlan}:${targetPlan}`];
  if (!setupDelta) {
    return {
      response: NextResponse.json(
        { ok: false, message: "Montée de gamme non prise en charge pour cette combinaison d’offres." },
        { status: 400 },
      ),
    };
  }

  const currentConfig = getStripePlanConfig(currentPlan);
  const targetConfig = targetValidation.config;
  const currentMonthlyCents = currentConfig.monthlyPriceEur * 100;
  const targetMonthlyCents = targetConfig.monthlyPriceEur * 100;
  const period = getBillingPeriod(subscription, monthlyItem);
  const amount = calculateUpgradeAmount({
    fromPlan: currentPlan,
    toPlan: targetPlan,
    subscriptionCurrentPeriodStart: period.start,
    subscriptionCurrentPeriodEnd: period.end,
  });

  return {
    auth,
    stripe,
    activeSubscription,
    subscription,
    currentPlan,
    targetPlan,
    currentConfig,
    targetConfig,
    currentMonthlyCents,
    targetMonthlyCents,
    setupDeltaCents: amount.setupDeltaCents,
    monthlyDeltaCents: amount.monthlyDeltaCents,
    prorataCents: amount.prorataCents,
    totalDueNowCents: amount.totalDueNowCents,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    prorataRatio: amount.prorataRatio,
    usedFallbackPeriod: amount.usedFallbackPeriod,
    returnPath,
    customerId: activeSubscription.stripe_customer_id || getCustomerId(subscription.customer),
  };
}

export async function GET(request: NextRequest) {
  try {
    const target = request.nextUrl.searchParams.get("target") || "";
    if (!isTooliaPlanId(target) || target === "starter") {
      return NextResponse.json({ ok: false, message: "Offre cible invalide." }, { status: 400 });
    }

    const context = await getUpgradeContext(request, target);
    if ("response" in context) return context.response;

    return NextResponse.json({
      ok: true,
      currentPlan: context.currentPlan,
      currentPlanName: context.currentConfig.name,
      targetPlan: context.targetPlan,
      targetPlanName: context.targetConfig.name,
      currentMonthlyCents: context.currentMonthlyCents,
      targetMonthlyCents: context.targetMonthlyCents,
      setupDeltaCents: context.setupDeltaCents,
      monthlyDeltaCents: context.monthlyDeltaCents,
      prorataCents: context.prorataCents,
      totalDueNowCents: context.totalDueNowCents,
      returnPath: context.returnPath,
      currentPeriodStart: context.currentPeriodStart,
      currentPeriodEnd: context.currentPeriodEnd,
      prorataRatio: context.prorataRatio,
      usedFallbackPeriod: context.usedFallbackPeriod,
    });
  } catch (error) {
    const safeError = safeStripeError(error);
    console.error("[stripe/upgrade:preview] failed", {
      type: safeError.type,
      code: safeError.code,
      message: safeError.message,
      statusCode: safeError.statusCode,
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          process.env.NODE_ENV !== "production"
            ? `Aperçu Stripe impossible : ${safeError.message}`
            : "Aperçu Stripe impossible pour le moment.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedPlan = typeof body.plan === "string" ? body.plan : "";
    const confirmed = body.confirmed === true;

    if (!isTooliaPlanId(requestedPlan) || requestedPlan === "starter") {
      return NextResponse.json(
        { ok: false, message: "Choisissez Pro ou Premium pour une montée de gamme." },
        { status: 400 },
      );
    }

    if (!confirmed) {
      return NextResponse.json(
        {
          ok: false,
          code: "confirmation_required",
          message: "Confirmez le changement d’offre avant d’ouvrir le paiement Stripe.",
        },
        { status: 400 },
      );
    }

    const context = await getUpgradeContext(request, requestedPlan);
    if ("response" in context) return context.response;

    if (!context.customerId) {
      return NextResponse.json(
        { ok: false, message: "Aucun client Stripe n’est associé à cet abonnement." },
        { status: 500 },
      );
    }

    const metadata = {
      type: "toolia_plan_upgrade",
      user_id: context.auth.user.id,
      from_plan: context.currentPlan,
      to_plan: context.targetPlan,
      plan: context.targetPlan,
      stripe_subscription_id: context.subscription.id,
      setup_delta_cents: String(context.setupDeltaCents),
      monthly_delta_cents: String(context.monthlyDeltaCents),
      prorata_cents: String(context.prorataCents),
      total_due_now_cents: String(context.totalDueNowCents),
    };
    const appUrl = getPublicAppUrl();
    const session = await context.stripe.checkout.sessions.create({
      mode: "payment",
      customer: context.customerId,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Passage ${context.currentConfig.name} → ${context.targetConfig.name}`,
              description: "Différence de mise en place + ajustement d’abonnement",
            },
            unit_amount: context.totalDueNowCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}${context.returnPath}?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/change-plan?target=${context.targetPlan}&upgrade=cancelled`,
      client_reference_id: context.auth.user.id,
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, message: "Stripe n’a pas retourné d’URL de paiement." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      redirectTo: session.url,
      message:
        "Paiement Stripe ouvert. Le changement d’offre sera appliqué après confirmation du paiement.",
      setupDeltaCents: context.setupDeltaCents,
      prorataCents: context.prorataCents,
      totalDueNowCents: context.totalDueNowCents,
    });
  } catch (error) {
    const safeError = safeStripeError(error);
    console.error("[stripe/upgrade] failed", {
      type: safeError.type,
      code: safeError.code,
      message: safeError.message,
      statusCode: safeError.statusCode,
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          process.env.NODE_ENV !== "production"
            ? `Upgrade Stripe impossible : ${safeError.message}`
            : "Upgrade Stripe impossible pour le moment.",
      },
      { status: 500 },
    );
  }
}
