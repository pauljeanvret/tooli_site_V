import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { google } from 'googleapis'

export const GOOGLE_GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
] as const

export type GoogleOAuthCookiePayload = {
  state: string
  userId: string
  returnTo: 'dashboard' | 'onboarding'
  createdAt: number
}

export const GOOGLE_OAUTH_STATE_COOKIE = 'toolia_google_oauth_state'

function getSigningSecret() {
  return (
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'toolia-local-oauth-state'
  )
}

function sign(value: string) {
  return createHmac('sha256', getSigningSecret()).update(value).digest('base64url')
}

function encodePayload(payload: GoogleOAuthCookiePayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function createGoogleOAuthState(input: Omit<GoogleOAuthCookiePayload, 'state' | 'createdAt'>) {
  const payload: GoogleOAuthCookiePayload = {
    ...input,
    state: randomBytes(24).toString('base64url'),
    createdAt: Date.now(),
  }
  const encoded = encodePayload(payload)

  return {
    payload,
    cookieValue: `${encoded}.${sign(encoded)}`,
  }
}

export function verifyGoogleOAuthStateCookie(cookieValue: string | undefined, state: string | null) {
  if (!cookieValue || !state) return null

  const [encoded, signature] = cookieValue.split('.')
  if (!encoded || !signature) return null

  const expected = sign(encoded)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as GoogleOAuthCookiePayload
  const maxAgeMs = 10 * 60 * 1000
  if (payload.state !== state || Date.now() - payload.createdAt > maxAgeMs) return null

  return payload
}

export function hasGoogleOAuthConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export function getGoogleAuthorizationUrl(state: string) {
  const oauth2Client = getGoogleOAuthClient()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [...GOOGLE_GMAIL_SCOPES],
    state,
  })
}
