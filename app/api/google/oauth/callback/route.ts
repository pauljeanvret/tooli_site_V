import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import {
  GOOGLE_GMAIL_SCOPES,
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthClient,
  verifyGoogleOAuthStateCookie,
} from '@/lib/google/oauth'
import { saveGmailConnection } from '@/lib/saas/gmail-store'

function redirectWithStatus(request: NextRequest, status: string, returnTo: 'dashboard' | 'onboarding' = 'dashboard') {
  const target = returnTo === 'onboarding' ? '/onboarding/profile' : '/dashboard'
  const url = new URL(target, request.nextUrl.origin)
  url.searchParams.set('gmail', status)

  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const googleError = request.nextUrl.searchParams.get('error')
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  const cookieValue = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  const payload = verifyGoogleOAuthStateCookie(cookieValue, state)
  const returnTo = payload?.returnTo || 'dashboard'

  if (googleError) {
    const status = googleError === 'access_denied' ? 'cancelled' : 'failed'
    return redirectWithStatus(request, status, returnTo)
  }

  if (!payload || !code) {
    return redirectWithStatus(request, 'failed', returnTo)
  }

  try {
    const oauth2Client = getGoogleOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const googleEmail = userInfo.email

    if (!tokens.access_token || !googleEmail) {
      return redirectWithStatus(request, 'failed', returnTo)
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    const scopes = tokens.scope?.split(' ').filter(Boolean) || [...GOOGLE_GMAIL_SCOPES]

    console.info('[google/oauth/callback] Gmail tokens received', {
      hasAccessToken: Boolean(tokens.access_token),
      hasRefreshToken: Boolean(tokens.refresh_token),
      hasModifyScope: scopes.includes('https://www.googleapis.com/auth/gmail.modify'),
      draftCreationAllowed: scopes.includes('https://www.googleapis.com/auth/gmail.modify'),
      readingAllowed: scopes.includes('https://www.googleapis.com/auth/gmail.modify'),
      expiresAtExists: Boolean(expiresAt),
      googleEmail,
    })

    await saveGmailConnection({
      userId: payload.userId,
      googleEmail,
      googleAccountId: userInfo.id || null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
      scopes,
    })

    const response = redirectWithStatus(
      request,
      tokens.refresh_token ? 'connected' : 'connected_no_refresh_token',
      returnTo,
    )
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE)

    return response
  } catch (error) {
    console.error('[google/oauth/callback] Gmail connection failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return redirectWithStatus(request, 'failed', returnTo)
  }
}
