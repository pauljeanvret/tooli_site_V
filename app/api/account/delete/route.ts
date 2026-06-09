import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeSecretKey } from "@/lib/saas/stripe-plans";
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";
import { getSupabaseHost } from "@/lib/supabase/url";

function serializeError(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : null;

  return {
    name: typeof record?.name === "string" ? record.name : null,
    message:
      typeof record?.message === "string"
        ? record.message
        : error instanceof Error
          ? error.message
          : String(error),
    status: typeof record?.status === "number" || typeof record?.status === "string" ? record.status : null,
    code: typeof record?.code === "string" ? record.code : null,
    details: typeof record?.details === "string" ? record.details : null,
    hint: typeof record?.hint === "string" ? record.hint : null,
  };
}

async function deleteFromTable(table: string, userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Client Supabase serveur indisponible.");

  const { error } = await admin.from(table).delete().eq("user_id", userId);
  if (error && error.code !== "42P01") throw error;
}

async function cancelStripeSubscriptionsForUser(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Client Supabase serveur indisponible.");

  const { data, error } = await admin
    .from("subscriptions")
    .select("id,status,stripe_subscription_id")
    .eq("user_id", userId)
    .not("stripe_subscription_id", "is", null);

  if (error && error.code !== "42P01") throw error;

  const subscriptionsToCancel = (data || [])
    .filter((subscription) => {
      const status = String(subscription.status || "");
      return Boolean(subscription.stripe_subscription_id && !["canceled", "cancelled", "demo"].includes(status));
    })
    .map((subscription) => String(subscription.stripe_subscription_id));

  if (subscriptionsToCancel.length === 0) return;

  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    throw new Error("Configuration Stripe serveur indisponible pour annuler l’abonnement.");
  }

  const stripe = new Stripe(stripeSecretKey);
  for (const subscriptionId of [...new Set(subscriptionsToCancel)]) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      const stripeError = error instanceof Error ? error.message : String(error);
      if (!/No such subscription|already canceled|canceled/i.test(stripeError)) {
        throw error;
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const debug = {
    supabaseHost: getSupabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL),
    secretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  try {
    const auth = await requireAuthenticatedRouteUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const mismatch = rejectMismatchedBodyUserId(body, auth.user.id);
    if (mismatch) return mismatch;

    const confirmation = typeof (body as { confirmation?: unknown }).confirmation === "string"
      ? (body as { confirmation: string }).confirmation.trim()
      : "";

    if (confirmation !== "SUPPRIMER") {
      return NextResponse.json(
        {
          ok: false,
          message: "Tapez SUPPRIMER pour confirmer la suppression du compte.",
        },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: "Configuration Supabase serveur incomplète." },
        { status: 500 },
      );
    }

    const userId = auth.user.id;
    await cancelStripeSubscriptionsForUser(userId);

    const { data: profileRows } = await admin.from("automation_profiles").select("id").eq("user_id", userId);
    const profileIds = (profileRows || []).map((row) => row.id).filter(Boolean);

    if (profileIds.length > 0) {
      const { data: categoryRows } = await admin
        .from("automation_categories")
        .select("id")
        .in("automation_profile_id", profileIds);
      const categoryIds = (categoryRows || []).map((row) => row.id).filter(Boolean);

      if (categoryIds.length > 0) {
        const { error: mappingError } = await admin
          .from("gmail_label_mappings")
          .delete()
          .in("automation_category_id", categoryIds);
        if (mappingError) throw mappingError;
      }

      const { error: categoriesError } = await admin
        .from("automation_categories")
        .delete()
        .in("automation_profile_id", profileIds);
      if (categoriesError) throw categoriesError;
    }

    await deleteFromTable("email_processing_logs", userId);
    await deleteFromTable("gmail_label_mappings", userId);
    await deleteFromTable("telegram_connections", userId);
    await deleteFromTable("gmail_connections", userId);
    await deleteFromTable("subscriptions", userId);
    await deleteFromTable("ai_usage_events", userId);
    await deleteFromTable("monthly_usage", userId);
    await deleteFromTable("writing_style_profiles", userId);
    await deleteFromTable("audit_logs", userId);
    await deleteFromTable("automation_profiles", userId);

    const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
    if (profileError) throw profileError;

    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const serialized = serializeError(error);
    console.error("[account/delete] failed", {
      debug,
      error: serialized,
    });

    return NextResponse.json(
      {
        ok: false,
        message: "Suppression du compte impossible pour le moment.",
      },
      { status: 500 },
    );
  }
}
