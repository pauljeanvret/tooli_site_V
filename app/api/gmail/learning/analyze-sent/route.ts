import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { analyzeWritingStyleFromSamples, AiStyleAnalysisError } from '@/lib/ai/provider'
import {
  getOAuthClientForUser,
  hasGmailModifyScope,
} from '@/lib/saas/gmail-store'
import {
  extractGmailMessageText,
  getGmailHeader,
  isLikelyAutomatedMessage,
  messageHasAttachments,
} from '@/lib/saas/gmail-message-utils'
import { saveWritingStyleProfile } from '@/lib/saas/supabase-store'
import { checkQuota, getMonthlyUsageSnapshot, recordUsage } from '@/lib/saas/plan-limits'
import { requirePaidSaasRouteAccess } from '@/lib/saas/route-access'
import { estimateTokensFromChars, recordAiCostUsage } from '@/lib/ai-costs'

const cleanErrorMessage = 'Analyse IA impossible pour le moment.'

function jsonError(status: number, step: string, message: string) {
  return NextResponse.json({ ok: false, step, message, retryable: true }, { status })
}

function isSelfTestEmail(to: string, googleEmail: string | null | undefined, subject: string) {
  if (!googleEmail) return false
  const lowerTo = to.toLowerCase()
  const lowerEmail = googleEmail.toLowerCase()

  return lowerTo.includes(lowerEmail) && /test|toolia|brouillon/i.test(subject)
}

function isUsableSample(message: Parameters<typeof extractGmailMessageText>[0], body: string, googleEmail: string | null) {
  const trimmed = body.trim()
  if (trimmed.length < 20) return false
  if (messageHasAttachments(message) && trimmed.length < 80) return false
  if (isLikelyAutomatedMessage(message, trimmed)) return false

  const to = getGmailHeader(message, 'To')
  const subject = getGmailHeader(message, 'Subject')
  if (isSelfTestEmail(to, googleEmail, subject)) return false

  return true
}

export async function POST(request: NextRequest) {
  const access = await requirePaidSaasRouteAccess(
    request,
    'Un abonnement Toolia actif est requis pour analyser votre style d’écriture.',
  )
  if (access.response) return access.response
  const user = access.user
  if (!user?.id) {
    return jsonError(401, 'auth', 'Connectez-vous avant de lancer l’analyse.')
  }

  let sentEmailCount = 0
  let usableSampleCount = 0
  let hasModifyScope = false

  try {
    const { oauth2Client, connection } = await getOAuthClientForUser(user.id)
    hasModifyScope = hasGmailModifyScope(connection)
    const googleEmail = connection.google_email || connection.gmail_email

    if (!hasModifyScope) {
      return jsonError(403, 'gmail_scope', 'Autorisation Gmail à mettre à jour.')
    }

    const styleQuota = await checkQuota(user.id, 'style_analysis', 1)
    if (!styleQuota.allowed) {
      return NextResponse.json(
        {
          ok: false,
          step: 'quota',
          message: 'Vous avez déjà utilisé vos analyses de style ce mois-ci.',
          retryable: false,
          usage: styleQuota.snapshot,
        },
        { status: 403 },
      )
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:sent newer_than:12m',
      maxResults: 20,
    })
    const messages = listResponse.data.messages || []
    sentEmailCount = messages.length
    const samples: string[] = []

    for (const message of messages) {
      if (!message.id) continue

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      })
      const data = fullMessage.data
      const body = extractGmailMessageText(data)

      if (!isUsableSample(data, body, googleEmail)) continue

      samples.push(body.slice(0, 2500))
      if (samples.length >= 20) break
    }

    usableSampleCount = samples.length
    if (!usableSampleCount) {
      return jsonError(400, 'no_samples', 'Aucun email envoyé exploitable trouvé.')
    }

    const analysis = await analyzeWritingStyleFromSamples(samples)
    await recordAiCostUsage({
      userId: user.id,
      customerId: user.id,
      stripeCustomerId: access.subscriptionAccess.subscription?.stripe_customer_id || null,
      plan: access.subscriptionAccess.planId,
      source: 'learning',
      actionType: 'style_analysis',
      provider: analysis.provider,
      model: analysis.model,
      promptTokens: estimateTokensFromChars(samples.reduce((sum, sample) => sum + sample.length, 0) + 1200),
      completionTokens: estimateTokensFromChars(JSON.stringify(analysis.profile).length),
      gmailMessageCount: usableSampleCount,
      metadata: {
        route: 'gmail_learning_analyze_sent',
        sample_count: usableSampleCount,
      },
      success: true,
    }).catch((costError) => {
      console.warn('[gmail/learning/analyze-sent] AI cost logging failed', {
        message: costError instanceof Error ? costError.message : String(costError),
        provider: analysis.provider,
        model: analysis.model,
        usableSampleCount,
      })
    })
    const savedProfile = await saveWritingStyleProfile(user.id, analysis.profile)
    const usage = await recordUsage(user.id, 'style_analysis', 1, {
      source: 'learning',
    }).catch(async () => getMonthlyUsageSnapshot(user.id))

    console.info('[gmail/learning/analyze-sent] Writing style analyzed', {
      hasModifyScope,
      sentEmailCount,
      usableSampleCount,
      profileSaved: true,
      userId: user.id,
      provider: analysis.provider,
      model: analysis.model,
    })

    return NextResponse.json({
      ok: true,
      message: 'Style analysé avec succès.',
      sampleCount: savedProfile.sample_count,
      profile: savedProfile,
      usage,
      provider: analysis.provider,
      model: analysis.model,
    })
  } catch (error) {
    console.error('[gmail/learning/analyze-sent] Failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
      hasModifyScope,
      sentEmailCount,
      usableSampleCount,
      profileSaved: false,
      userId: user.id,
    })

    if (error instanceof AiStyleAnalysisError) {
      return jsonError(502, 'ai_analysis', cleanErrorMessage)
    }

    return jsonError(500, 'server_exception', cleanErrorMessage)
  }
}
