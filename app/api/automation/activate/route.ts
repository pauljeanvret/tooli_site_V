import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getConnectedGmailConnection } from "@/lib/saas/gmail-store";
import { validateProfileAgainstPlan } from "@/lib/saas/plan-limits";
import { getActiveSubscriptionForUser } from "@/lib/saas/subscription-store";
import { getAutomationRecord, storeAutomationProfile } from "@/lib/saas/demo-store";
import { findDraftConsistencyIssues, summarizeProfileCategoryActions } from "@/lib/saas/profile-consistency";
import { automationProfileSchema, onboardingAnswersSchema } from "@/lib/saas/schemas";
import { getPersistedSaasState, storeSupabaseAutomationProfile } from "@/lib/saas/supabase-store";
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const profile = automationProfileSchema.parse(body.profile);
    const answersResult = body.answers ? onboardingAnswersSchema.safeParse(body.answers) : null;
    const categorySummary = summarizeProfileCategoryActions(profile);
    const draftConsistencyIssues = answersResult?.success
      ? findDraftConsistencyIssues(profile, answersResult.data)
      : [];
    if (draftConsistencyIssues.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Configuration incohérente : certaines catégories cochées en Brouillon ne sont pas sauvegardées comme brouillons. Revenez à l’étape Actions et enregistrez à nouveau.",
          draftConsistencyIssues,
          categorySummary,
        },
        { status: 400 },
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[automation/activate] category action summary", { categorySummary });
    }

    const mode = body.mode === "account" ? "account" : "demo";
    const activationMode = body.activationMode === "live" ? "live" : "test";
    const editing = body.editing === true;

    if (mode === "account") {
      const auth = await requireAuthenticatedRouteUser(request);
      if (auth.response) return auth.response;

      const mismatch = rejectMismatchedBodyUserId(body, auth.user.id);
      if (mismatch) return mismatch;

      const userId = auth.user.id;
      const activeSubscription = await getActiveSubscriptionForUser(userId);

      if (activationMode === "live") {
        if (!activeSubscription) {
          return NextResponse.json(
            {
              ok: false,
              error: "Le paiement doit être validé avant activation.",
              upgradeRequired: true,
            },
            { status: 403 },
          );
        }

        const gmailConnection = await getConnectedGmailConnection(userId);
        if (!gmailConnection) {
          return NextResponse.json(
            {
              ok: false,
              error: "Connectez Gmail pour activer Toolia.",
              gmailRequired: true,
            },
            { status: 403 },
          );
        }
      }

      const planValidation = await validateProfileAgainstPlan(userId, profile);
      if (!planValidation.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: planValidation.message,
            upgradeRequired: true,
          },
          { status: 403 },
        );
      }

      const existingState = await getPersistedSaasState(userId);
      if (existingState?.dashboard && !editing) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Une automatisation existe déjà. Utilisez Modifier depuis le tableau de bord pour changer la configuration.",
          },
          { status: 409 },
        );
      }

      const labels = profile.categories.map((category) => ({
        id: category.id,
        name: category.name,
        created: false,
        mode: "demo" as const,
      }));
      const persistedRecord = await storeSupabaseAutomationProfile(userId, profile, labels, {
        testMode: activationMode === "test",
      });
      if (!persistedRecord) {
        return NextResponse.json(
          { ok: false, error: "Sauvegarde Supabase indisponible. Activation non effectuée." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        status: persistedRecord.status,
        subscriptionStatus: activationMode === "live" ? "active" : persistedRecord.subscriptionStatus,
        gmailConnected: activationMode === "live" ? true : persistedRecord.gmailConnected,
        labels: persistedRecord.labels,
        logs: persistedRecord.logs,
        categorySummary,
      });
    }

    const userId = typeof body.userId === "string" ? body.userId : "demo-user";
    const existingRecord = getAutomationRecord(userId);
    if (existingRecord && !editing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Une automatisation existe déjà. Utilisez Modifier depuis le tableau de bord pour changer la configuration.",
        },
        { status: 409 },
      );
    }

    const labels = profile.categories.map((category) => ({
      id: category.id,
      name: category.name,
      created: false,
      mode: "demo" as const,
    }));
    const record = storeAutomationProfile(userId, profile, labels, { testMode: activationMode === "test" });

    return NextResponse.json({
      ok: true,
      status: record.status,
      subscriptionStatus: record.subscriptionStatus,
      gmailConnected: record.gmailConnected,
      labels,
      logs: record.logs,
      categorySummary,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.issues[0]?.message || "Configuration invalide.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Activation impossible." },
      { status: 500 },
    );
  }
}
