import { NextRequest, NextResponse } from "next/server";

import { updateAutomationStatus } from "@/lib/saas/demo-store";
import { updateSupabaseAutomationStatus } from "@/lib/saas/supabase-store";
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "account" ? "account" : "demo";
  const activationMode = body.activationMode === "test" ? "test" : "live";
  const nextStatus = activationMode === "test" ? "active_test" : "active";

  if (mode === "account") {
    const auth = await requireAuthenticatedRouteUser(request);
    if (auth.response) return auth.response;

    const mismatch = rejectMismatchedBodyUserId(body, auth.user.id);
    if (mismatch) return mismatch;

    const persistedRecord = await updateSupabaseAutomationStatus(auth.user.id, nextStatus);
    if (persistedRecord) {
      return NextResponse.json({
        ok: true,
        status: persistedRecord.status,
        logs: persistedRecord.logs,
      });
    }
  }

  const userId = typeof body.userId === "string" ? body.userId : "demo-user";
  const record = updateAutomationStatus(userId, nextStatus);

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    logs: record?.logs || [],
  });
}
