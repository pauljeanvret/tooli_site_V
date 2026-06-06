import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import {
  getWorkerSubscriptionAccessForUser,
  type TooliaWorkerSubscriptionAccess,
} from "@/lib/saas/subscription-store";
import { requireAuthenticatedRouteUser } from "@/lib/supabase/route-auth";

export type PaidSaasRouteAccess = {
  user: User;
  subscriptionAccess: TooliaWorkerSubscriptionAccess;
  response: null;
};

export async function requirePaidSaasRouteAccess(
  request: NextRequest,
  message = "Un abonnement Toolia actif est requis pour utiliser cette action.",
): Promise<PaidSaasRouteAccess | { user: null; subscriptionAccess: null; response: NextResponse }> {
  const auth = await requireAuthenticatedRouteUser(request);
  if (auth.response) {
    return { user: null, subscriptionAccess: null, response: auth.response };
  }

  const subscriptionAccess = await getWorkerSubscriptionAccessForUser(auth.user.id);
  if (!subscriptionAccess.allowed) {
    return {
      user: null,
      subscriptionAccess: null,
      response: NextResponse.json(
        {
          ok: false,
          step: "subscription",
          message,
          reason: subscriptionAccess.reason,
          upgradeRequired: true,
        },
        { status: 403 },
      ),
    };
  }

  return {
    user: auth.user,
    subscriptionAccess,
    response: null,
  };
}
