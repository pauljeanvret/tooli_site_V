import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseUser } from "./server-auth";

export async function requireAuthenticatedRouteUser(request: NextRequest) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          ok: false,
          message: "Session invalide ou expirée. Connectez-vous pour continuer.",
        },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}

export function rejectMismatchedBodyUserId(body: unknown, authenticatedUserId: string) {
  if (!body || typeof body !== "object" || !("userId" in body)) {
    return null;
  }

  const bodyUserId = (body as { userId?: unknown }).userId;

  if (typeof bodyUserId === "string" && bodyUserId && bodyUserId !== authenticatedUserId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vous n'êtes pas autorisé à modifier cet espace Toolia.",
      },
      { status: 403 },
    );
  }

  return null;
}
