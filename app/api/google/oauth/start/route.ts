import { NextRequest, NextResponse } from 'next/server'
import {
  createGoogleOAuthState,
  getGoogleAuthorizationUrl,
  getGoogleRedirectUri,
  GOOGLE_GMAIL_SCOPES,
  GOOGLE_OAUTH_STATE_COOKIE,
  hasGoogleOAuthConfig,
} from '@/lib/google/oauth'
import { getAuthenticatedSupabaseUser } from '@/lib/supabase/server-auth'
import { getConnectedGmailConnection, hasRequiredGmailScopes } from '@/lib/saas/gmail-store'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status })
}

export async function GET(request: NextRequest) {
  if (!hasGoogleOAuthConfig()) {
    return jsonError('Connexion Gmail indisponible : configuration Google OAuth manquante.', 500)
  }

  const user = await getAuthenticatedSupabaseUser(request)
  if (!user?.id) {
    return jsonError('Connectez-vous avant de connecter Gmail.', 401)
  }

  const from = request.nextUrl.searchParams.get('from') === 'dashboard' ? 'dashboard' : 'onboarding'
  const forceConsent =
    request.nextUrl.searchParams.get('force') === '1' ||
    request.nextUrl.searchParams.get('prompt') === 'consent'
  const alreadyConnected = await getConnectedGmailConnection(user.id)
  const alreadyHasRequiredScopes = alreadyConnected ? hasRequiredGmailScopes(alreadyConnected) : false

  if (alreadyConnected && alreadyHasRequiredScopes && !forceConsent) {
    return NextResponse.json({
      ok: true,
      alreadyConnected: true,
      message: 'Gmail est déjà connecté.',
      redirectTo:
        from === 'onboarding'
          ? '/onboarding/profile?gmail=already_connected'
          : '/dashboard?gmail=already_connected',
    })
  }

  const { payload, cookieValue } = createGoogleOAuthState({
    userId: user.id,
    returnTo: from,
  })
  const authorizationUrl = getGoogleAuthorizationUrl(payload.state)
  const redirectUri = getGoogleRedirectUri()

  console.info('[google/oauth/start] Google authorization URL created', {
    from,
    forceConsent,
    redirectUri,
    scopes: GOOGLE_GMAIL_SCOPES,
    alreadyConnected: Boolean(alreadyConnected),
    alreadyHasRequiredScopes,
  })

  const wantsJson = request.nextUrl.searchParams.get('response') === 'json'
  const response = wantsJson
    ? NextResponse.json({ ok: true, authorizationUrl })
    : NextResponse.redirect(authorizationUrl)

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  })

  return response
}
