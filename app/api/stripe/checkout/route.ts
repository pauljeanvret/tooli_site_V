import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTooliaPlanId, normalizePlanId } from "@/lib/saas/plan-config";
import { getPersistedSaasState } from "@/lib/saas/supabase-store";
import { getActiveSubscriptionForUser, getStripeCustomerIdForUser } from "@/lib/saas/subscription-store";
import {
  formatMissingStripeEnvMessage,
  getMissingStripePriceEnvKeys,
  getPublicAppUrl,
  getStripePlanConfig,
  getStripeSecretKey,
  type StripePlanConfig,
} from "@/lib/saas/stripe-plans";
import { requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

type SafeStripeError = {
  type: string | null;
  code: string | null;
  message: string;
  statusCode: number | null;
};

function sanitizeStripeMessage(message: string) {
  return message.replace(/price_[A-Za-z0-9_]+/g, "[Price ID]");
}

function serializeStripeError(error: unknown): SafeStripeError {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const rawMessage =
    typeof record?.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : String(error);

  return {
    type: typeof record?.type === "string" ? record.type : null,
    code: typeof record?.code === "string" ? record.code : null,
    message: sanitizeStripeMessage(rawMessage),
    statusCode: typeof record?.statusCode === "number" ? record.statusCode : null,
  };
}

function developmentStripeMessage(prefix: string, error: unknown) {
  const safeError = serializeStripeError(error);
  const details = [safeError.message, safeError.code ? `code ${safeError.code}` : null]
    .filter(Boolean)
    .join(" · ");
  return `${prefix} : ${details || "erreur Stripe inconnue"}.`;
}

async function validateStripePrice(input: {
  stripe: Stripe;
  priceId: string;
  envKey: string;
  expectedKind: "monthly" | "setup";
  expectedAmountEur: number;
}) {
  let price: Stripe.Price;

  try {
    price = await input.stripe.prices.retrieve(input.priceId);
  } catch (error) {
    const message =
      process.env.NODE_ENV !== "production"
        ? developmentStripeMessage(`Prix Stripe invalide pour ${input.envKey}`, error)
        : `Prix Stripe invalide pour ${input.envKey}.`;

    return { ok: false, message };
  }

  if (!price.active) {
    return {
      ok: false,
      message: `Prix Stripe inactif pour ${input.envKey}. Activez ce prix dans Stripe ou remplacez la variable.`,
    };
  }

  if (price.currency !== "eur") {
    return {
      ok: false,
      message: `Prix Stripe invalide pour ${input.envKey} : la devise doit être EUR.`,
    };
  }

  if (price.unit_amount !== input.expectedAmountEur * 100) {
    return {
      ok: false,
      message: `Prix Stripe invalide pour ${input.envKey} : montant attendu ${input.expectedAmountEur} €.`,
    };
  }

  if (input.expectedKind === "monthly") {
    if (!price.recurring || price.recurring.interval !== "month") {
      return {
        ok: false,
        message: `Prix Stripe invalide pour ${input.envKey} : utilisez un prix mensuel récurrent.`,
      };
    }
  }

  if (input.expectedKind === "setup" && price.recurring) {
    return {
      ok: false,
      message: `Prix Stripe invalide pour ${input.envKey} : utilisez un prix one-time pour les frais de mise en place.`,
    };
  }

  return { ok: true, message: "" };
}

async function validateStripePrices(stripe: Stripe, config: StripePlanConfig) {
  const monthly = await validateStripePrice({
    stripe,
    priceId: config.monthlyPriceId,
    envKey: config.monthlyPriceEnvKey,
    expectedKind: "monthly",
    expectedAmountEur: config.monthlyPriceEur,
  });
  if (!monthly.ok) return monthly;

  return validateStripePrice({
    stripe,
    priceId: config.setupPriceId,
    envKey: config.setupPriceEnvKey,
    expectedKind: "setup",
    expectedAmountEur: config.setupPriceEur,
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const requestedPlan = typeof body.plan === "string" ? body.plan : "";

    if (!isTooliaPlanId(requestedPlan)) {
      return NextResponse.json({ ok: false, message: "Offre Toolia invalide." }, { status: 400 });
    }

    const plan = requestedPlan;
    const config = getStripePlanConfig(plan);
    const activeSubscription = await getActiveSubscriptionForUser(auth.user.id);

    if (activeSubscription) {
      const activePlan = normalizePlanId(activeSubscription.plan_id);
      const persistedState = await getPersistedSaasState(auth.user.id).catch(() => null);
      const redirectTo = persistedState?.dashboard ? "/dashboard" : "/onboarding";

      if (activePlan === plan) {
        return NextResponse.json(
          {
            ok: false,
            code: "plan_already_active",
            message: `Votre offre ${config.name} est déjà active. Continuez la configuration de votre automatisation.`,
            redirectTo,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          code: "subscription_change_requires_portal",
          message:
            "Vous avez déjà une offre active. Les changements d’offre se font dans le portail sécurisé Stripe.",
          portalRequired: true,
        },
        { status: 409 },
      );
    }

    const stripeSecretKey = getStripeSecretKey();
    const missingEnvKeys = [
      ...(!stripeSecretKey ? ["STRIPE_SECRET_KEY"] : []),
      ...getMissingStripePriceEnvKeys(plan),
    ];

    if (missingEnvKeys.length > 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Missing Stripe env vars: ${missingEnvKeys.join(", ")}`);
      }

      return NextResponse.json(
        {
          ok: false,
          message: formatMissingStripeEnvMessage(missingEnvKeys),
          missing: missingEnvKeys,
        },
        { status: 500 },
      );
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: "Configuration Supabase serveur incomplète." },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const priceValidation = await validateStripePrices(stripe, config);
    if (!priceValidation.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[stripe/checkout] price validation failed", {
          plan,
          message: priceValidation.message,
          monthlyPriceEnvKey: config.monthlyPriceEnvKey,
          setupPriceEnvKey: config.setupPriceEnvKey,
        });
      }

      return NextResponse.json(
        { ok: false, message: priceValidation.message },
        { status: 500 },
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name,email")
      .eq("id", auth.user.id)
      .maybeSingle();

    let customerId = await getStripeCustomerIdForUser(auth.user.id);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email || (typeof profile?.email === "string" ? profile.email : undefined),
        name: typeof profile?.full_name === "string" ? profile.full_name : undefined,
        metadata: {
          user_id: auth.user.id,
        },
      });
      customerId = customer.id;
    }

    const appUrl = getPublicAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        { price: config.monthlyPriceId, quantity: 1 },
        { price: config.setupPriceId, quantity: 1 },
      ],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      client_reference_id: auth.user.id,
      metadata: {
        user_id: auth.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: auth.user.id,
          plan,
        },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, message: "Stripe n'a pas retourné d'URL de paiement." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    const safeError = serializeStripeError(error);
    console.error("[stripe/checkout] failed", {
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
            ? `Erreur Stripe Checkout : ${safeError.message}`
            : "Création du paiement Stripe impossible pour le moment.",
        stripeError: process.env.NODE_ENV !== "production" ? safeError : undefined,
      },
      { status: 500 },
    );
  }
}
