import { NextRequest, NextResponse } from "next/server";

import { saveOnboardingAnswers } from "@/lib/saas/supabase-store";
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const mismatch = rejectMismatchedBodyUserId(body, auth.user.id);
    if (mismatch) return mismatch;

    const answers = await saveOnboardingAnswers(auth.user.id, (body as { answers?: unknown }).answers);
    return NextResponse.json({ ok: true, answers });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sauvegarde de la configuration impossible." },
      { status: 500 },
    );
  }
}
