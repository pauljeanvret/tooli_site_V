import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { getPublicAppUrl, getStripeSecretKey } from "@/lib/saas/stripe-plans";
import { getStripeCustomerIdForUser } from "@/lib/saas/subscription-store";
import { requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const portalNotConfiguredMessage = "Le portail de gestion Stripe n’est pas encore configuré.";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request);
    if (auth.response) return auth.response;

    const stripeSecretKey = getStripeSecretKey();
    if (!stripeSecretKey) {
      return NextResponse.json(
        { ok: false, message: portalNotConfiguredMessage },
        { status: 500 },
      );
    }

    const customerId = await getStripeCustomerIdForUser(auth.user.id);
    if (!customerId) {
      return NextResponse.json(
        { ok: false, message: "Aucun abonnement Stripe actif n'est associé à votre compte." },
        { status: 400 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getPublicAppUrl()}/dashboard`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("[stripe/portal] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: portalNotConfiguredMessage },
      { status: 500 },
    );
  }
}
