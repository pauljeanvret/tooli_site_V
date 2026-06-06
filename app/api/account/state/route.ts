import { NextRequest, NextResponse } from "next/server";

import { getAiProviderStatus } from "@/lib/ai/provider";
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
    if (!state) {
      return NextResponse.json({
        ok: true,
        plan: null,
        answers: null,
        profile: null,
        styleProfile: null,
        usage: null,
        dashboard: null,
        gmail: null,
        ai: getAiProviderStatus(),
      });
    }

    return NextResponse.json({ ok: true, ...state, ai: getAiProviderStatus() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Chargement impossible." },
      { status: 500 },
    );
  }
}
