import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { z } from 'zod'
import {
  AI_DRAFT_RETRY_MESSAGE,
  AiDraftGenerationError,
  detectAddressingMode,
  generateAiDraftReply,
  getAiProviderStatus,
  type AddressingMode,
  type WritingStyleProfile,
} from '@/lib/ai/provider'
import type { AutomationProfile, OnboardingAnswers } from '@/lib/saas/schemas'
import { getPersistedSaasState, getWritingStyleProfile } from '@/lib/saas/supabase-store'
import { getOAuthClientForUser, hasGmailComposeScope } from '@/lib/saas/gmail-store'
import { base64UrlEncode, buildGmailDraftMime } from '@/lib/saas/gmail-draft-mime'
import { checkQuota, getMonthlyUsageSnapshot, recordUsage } from '@/lib/saas/plan-limits'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePaidSaasRouteAccess } from '@/lib/saas/route-access'

const requestSchema = z
  .object({
    incomingEmail: z.string().min(20).max(8000),
  })
  .strict()

type DraftDebug = {
  addressingMode: AddressingMode
  selectedTone: string
  hasCustomInstructions: boolean
  customInstructionsPreview: string
  validationPassed: boolean
  retryable?: boolean
}

function jsonError(status: number, step: string, message: string, details = '', debug?: Partial<DraftDebug>) {
  return NextResponse.json(
    {
      ok: false,
      step,
      message,
      details,
      ...debug,
    },
    { status },
  )
}

async function getActiveProfileId(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const { data } = await supabase
    .from('automation_profiles')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.id || null
}

async function logDraftCreation(input: {
  userId: string
  automationProfileId: string | null
  draftId: string
  provider: string
  model: string
  confidence: string
}) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return

  await supabase.from('email_processing_logs').insert({
    user_id: input.userId,
    automation_profile_id: input.automationProfileId,
    status: 'ai_test_draft',
    details: {
      type: 'ai_test_draft',
      draftId: input.draftId,
      provider: input.provider,
      model: input.model,
      confidence: input.confidence,
      sent: false,
    },
  })
}

function buildProfileForDraft(input: {
  profile: AutomationProfile
  answers: OnboardingAnswers | null | undefined
}) {
  const latestCustomInstructions =
    input.answers
      ? String(input.answers.customDraftInstructions || '').trim().slice(0, 1000)
      : input.profile.global_settings.custom_draft_instructions || ''
  const latestTone = input.answers?.draftTone || input.profile.global_settings.default_tone

  return {
    ...input.profile,
    global_settings: {
      ...input.profile.global_settings,
      default_tone: latestTone,
      custom_draft_instructions: latestCustomInstructions,
    },
  }
}

function makeDraftDebug(input: {
  profile: AutomationProfile
  incomingEmail: string
  writingStyleProfile?: WritingStyleProfile | null
  validationPassed: boolean
}): DraftDebug {
  const customInstructions = input.profile.global_settings.custom_draft_instructions || ''
  const selectedTone = input.profile.global_settings.default_tone

  return {
    addressingMode: detectAddressingMode(
      customInstructions,
      input.incomingEmail,
      selectedTone,
      input.writingStyleProfile?.tutoiement_or_vouvoiement_preference,
    ),
    selectedTone,
    hasCustomInstructions: Boolean(customInstructions.trim()),
    customInstructionsPreview: customInstructions.trim().slice(0, 120),
    validationPassed: input.validationPassed,
  }
}

function normalizeDraftErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Création du brouillon IA impossible.'

  if (error instanceof AiDraftGenerationError) {
    return AI_DRAFT_RETRY_MESSAGE
  }

  if (message.includes('tutoiement demandé')) {
    return 'Le brouillon ne respecte pas le tutoiement demandé. Réessayez.'
  }

  if (message.includes('vouvoiement demandé')) {
    return 'Le brouillon ne respecte pas le vouvoiement demandé. Réessayez.'
  }

  return AI_DRAFT_RETRY_MESSAGE
}

export async function POST(request: NextRequest) {
  const access = await requirePaidSaasRouteAccess(
    request,
    'Un abonnement Toolia actif est requis pour créer un brouillon IA.',
  )
  if (access.response) return access.response
  const user = access.user
  if (!user?.id) {
    return jsonError(401, 'auth', 'Connectez-vous avant de créer un brouillon IA.')
  }

  let draftDebug: DraftDebug | undefined

  try {
    const body = requestSchema.parse(await request.json())
    const aiStatus = getAiProviderStatus()

    if (!aiStatus.configured) {
      return jsonError(400, 'ai_config', 'Clé IA manquante. Ajoutez OPENROUTER_API_KEY dans .env.local.')
    }

    const persistedState = await getPersistedSaasState(user.id)
    if (!persistedState?.profile) {
      return jsonError(400, 'profile', 'Aucune configuration Toolia active trouvée.')
    }

    const { oauth2Client, connection } = await getOAuthClientForUser(user.id)
    const hasCompose = hasGmailComposeScope(connection)
    const gmailEmail = connection.google_email || connection.gmail_email

    if (!gmailEmail) {
      return jsonError(400, 'gmail_connection', 'Connexion Gmail incomplète.')
    }

    if (!hasCompose) {
      return jsonError(403, 'gmail_scope', 'Reconnectez Gmail pour autoriser la création de brouillons.')
    }

    const draftQuota = await checkQuota(user.id, 'ai_draft', 1)
    if (!draftQuota.allowed) {
      return NextResponse.json(
        {
          ok: false,
          step: 'quota',
          message: 'Votre limite de brouillons IA est atteinte pour ce mois-ci.',
          upgradeRequired: true,
          usage: draftQuota.snapshot,
        },
        { status: 403 },
      )
    }

    const profileForDraft = buildProfileForDraft({
      profile: persistedState.profile,
      answers: persistedState.answers,
    })
    const writingStyleProfile = await getWritingStyleProfile(user.id)
    draftDebug = makeDraftDebug({
      profile: profileForDraft,
      incomingEmail: body.incomingEmail,
      writingStyleProfile,
      validationPassed: false,
    })

    const aiDraft = await generateAiDraftReply({
      profile: profileForDraft,
      incomingEmail: body.incomingEmail,
      writingStyleProfile,
    })
    draftDebug = {
      ...draftDebug,
      addressingMode: aiDraft.addressingMode,
      selectedTone: aiDraft.selectedTone,
      validationPassed: true,
    }
    const subject = aiDraft.subject.startsWith('[Test Toolia]')
      ? aiDraft.subject
      : `[Test Toolia] ${aiDraft.subject}`
    const raw = buildGmailDraftMime({
      to: gmailEmail,
      subject,
      body: aiDraft.body,
      testDraft: true,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const draftResponse = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: base64UrlEncode(raw),
        },
      },
    })
    const draftId = draftResponse.data.id

    if (!draftId) {
      return jsonError(502, 'gmail_draft', 'Gmail n’a pas retourné d’identifiant de brouillon.')
    }

    const automationProfileId = await getActiveProfileId(user.id)
    await logDraftCreation({
      userId: user.id,
      automationProfileId,
      draftId,
      provider: aiDraft.provider,
      model: aiDraft.model,
      confidence: aiDraft.confidence,
    })
    const usage = await recordUsage(user.id, 'ai_draft', 1, {
      source: 'dashboard',
    }).catch(async () => getMonthlyUsageSnapshot(user.id))

    console.info('[gmail/drafts/create-ai-test] Draft created', {
      hasAccessToken: Boolean(connection.access_token_encrypted),
      hasRefreshToken: Boolean(connection.refresh_token_encrypted),
      hasComposeScope: hasCompose,
      hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
      provider: aiDraft.provider,
      model: aiDraft.model,
      draftId,
      bodyLength: aiDraft.body.length,
      subjectLength: subject.length,
      addressingMode: aiDraft.addressingMode,
      selectedTone: aiDraft.selectedTone,
      hasCustomInstructions: draftDebug?.hasCustomInstructions,
    })

    return NextResponse.json({
      ok: true,
      draftId,
      subject,
      bodyPreview: aiDraft.body,
      confidence: aiDraft.confidence,
      reasoningSummary: aiDraft.reasoning_summary,
      gmailEmail,
      sent: false,
      usage,
      ...(draftDebug || {}),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(400, 'request_validation', 'Collez un exemple d’email reçu suffisamment détaillé.', error.message)
    }

    const message = normalizeDraftErrorMessage(error)
    const retryable = true
    console.error('[gmail/drafts/create-ai-test] Failed', {
      message,
      retryable,
      hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
      provider: getAiProviderStatus().provider,
      model: getAiProviderStatus().model,
      addressingMode: draftDebug?.addressingMode,
      selectedTone: draftDebug?.selectedTone,
      hasCustomInstructions: draftDebug?.hasCustomInstructions,
    })

    return jsonError(
      500,
      'server_exception',
      message,
      '',
      draftDebug ? { ...draftDebug, validationPassed: false, retryable } : { retryable },
    )
  }
}
