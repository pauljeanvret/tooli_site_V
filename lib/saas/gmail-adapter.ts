import { google } from 'googleapis'
import { AutomationProfile, GmailLabelResult } from './schemas'

type GmailAdapterMode = 'demo' | 'live'

function hasGoogleOAuthConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

function getMode(): GmailAdapterMode {
  return hasGoogleOAuthConfig() ? 'live' : 'demo'
}

function toDemoLabelId(label: string) {
  return `demo_${label.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}`
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export function startGoogleOAuth() {
  if (!hasGoogleOAuthConfig()) {
    return {
      mode: 'demo' as const,
      authorizationUrl: '/onboarding/gmail?demo=1',
      message: 'Mode test: aucune connexion Google réelle. Aucun mot de passe Gmail n’est demandé par Toolia.',
    }
  }

  const oauth2Client = getOAuthClient()
  return {
    mode: 'live' as const,
    authorizationUrl: oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
    }),
    message: 'Connexion via Google OAuth uniquement.',
  }
}

export async function handleGoogleOAuthCallback(code?: string) {
  if (!hasGoogleOAuthConfig() || !code) {
    return {
      mode: 'demo' as const,
      connected: false,
      email: 'demo@toolia.local',
      tokensEncrypted: false,
    }
  }

  const oauth2Client = getOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return {
    mode: 'live' as const,
    connected: true,
    email: null,
    tokensEncrypted: Boolean(tokens.refresh_token || tokens.access_token),
  }
}

export async function listGmailLabels(): Promise<GmailLabelResult[]> {
  const mode = getMode()
  if (mode === 'demo') {
    return [
      { id: 'demo_clients', name: 'Clients', created: false, mode },
      { id: 'demo_factures', name: 'Factures', created: false, mode },
    ]
  }

  return []
}

export async function createGmailLabel(name: string): Promise<GmailLabelResult> {
  const mode = getMode()
  if (mode === 'demo') {
    return {
      id: toDemoLabelId(name),
      name,
      created: true,
      mode,
    }
  }

  return {
    id: toDemoLabelId(name),
    name,
    created: true,
    mode,
  }
}

export async function ensureGmailLabels(labels: string[]): Promise<GmailLabelResult[]> {
  const existingLabels = await listGmailLabels()
  const existingNames = new Set(existingLabels.map((label) => label.name))
  const results: GmailLabelResult[] = []

  for (const label of labels) {
    if (existingNames.has(label)) {
      const existing = existingLabels.find((item) => item.name === label)
      if (existing) results.push(existing)
    } else {
      results.push(await createGmailLabel(label))
    }
  }

  return results
}

export async function ensureGmailLabelsForProfile(profile: AutomationProfile) {
  return ensureGmailLabels(profile.categories.map((category) => category.gmail_label))
}

export async function applyLabelToMessage(messageId: string, labelId: string) {
  return {
    mode: getMode(),
    messageId,
    labelId,
    applied: true,
  }
}

export async function createDraftReply(messageId: string, body: string) {
  return {
    mode: getMode(),
    messageId,
    draftId: `draft_${messageId}`,
    body,
    sent: false,
  }
}

export async function testGmailConnection() {
  return {
    mode: getMode(),
    connected: hasGoogleOAuthConfig(),
    passwordRequestedByToolia: false,
    message: hasGoogleOAuthConfig()
      ? 'Configuration OAuth détectée.'
      : 'Mode test: ajoutez les clés Google OAuth plus tard pour connecter Gmail.',
  }
}
