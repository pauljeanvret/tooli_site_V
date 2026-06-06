import { NextRequest, NextResponse } from "next/server";

import { getPersistedSaasState } from "@/lib/saas/supabase-store";
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const mismatch = rejectMismatchedBodyUserId(body, auth.user.id);
    if (mismatch) return mismatch;

    const state = await getPersistedSaasState(auth.user.id);

    return NextResponse.json({
      ok: true,
      plan: state?.plan || null,
      subscriptionStatus: state?.dashboard?.subscriptionStatus || "inactive",
      message: "Le plan Toolia est maintenant modifié uniquement après validation du paiement Stripe.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Chargement du plan impossible." },
      { status: 500 },
    );
  }
}
