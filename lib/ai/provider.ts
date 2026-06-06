import { z } from 'zod'
import type { AutomationProfile } from '@/lib/saas/schemas'

const aiDraftSchema = z
  .object({
    subject: z.string().min(3).max(160),
    body: z.string().min(20).max(6000),
    confidence: z.enum(['low', 'medium', 'high']),
    reasoning_summary: z.string().min(3).max(500),
  })
  .strict()

const writingStyleProfileSchema = z
  .object({
    sample_count: z.number().int().min(0).max(20),
    tone_summary: z.string().min(3).max(900),
    average_length: z.enum(['short', 'medium', 'long']),
    greeting_style: z.string().min(1).max(500),
    closing_style: z.string().min(1).max(500),
    signature_detected: z.string().max(500).nullable(),
    formality_level: z.enum(['casual', 'balanced', 'formal']),
    tutoiement_or_vouvoiement_preference: z.enum(['tu', 'vous', 'mixed', 'unknown']),
    common_phrases: z.array(z.string().min(1).max(160)).max(12),
    things_to_avoid: z.array(z.string().min(1).max(160)).max(12),
  })
  .strict()

const emailClassificationSchema = z
  .object({
    category: z.string().min(1).max(120),
    confidence: z.number().min(0).max(1),
    importance: z.enum(['low', 'normal', 'high', 'urgent']),
    shouldApplyLabel: z.boolean(),
    shouldCreateDraft: z.boolean(),
    shouldNotifyTelegram: z.boolean(),
    archiveSuggested: z.boolean().optional().default(false),
    reason: z.string().min(3).max(500),
    draft: z
      .object({
        subject: z.string().min(1).max(180),
        body: z.string().min(20).max(6000),
      })
      .nullable(),
  })
  .strict()

const emailBatchClassificationItemSchema = emailClassificationSchema.extend({
  email_id: z.string().min(1).max(256),
})

const emailBatchClassificationSchema = z
  .object({
    results: z.array(emailBatchClassificationItemSchema).min(1).max(10),
  })
  .strict()

export type AiDraftResult = z.infer<typeof aiDraftSchema>
export type WritingStyleProfile = z.infer<typeof writingStyleProfileSchema>
export type EmailClassificationResult = z.infer<typeof emailClassificationSchema>
export type EmailBatchClassificationResult = z.infer<typeof emailBatchClassificationItemSchema>
export type AddressingMode = 'tu' | 'vous' | 'auto'

export const AI_DRAFT_RETRY_MESSAGE = 'Le brouillon n’a pas pu être généré. Réessayez dans quelques secondes.'

export class AiDraftGenerationError extends Error {
  retryable = true

  constructor(message = AI_DRAFT_RETRY_MESSAGE) {
    super(message)
    this.name = 'AiDraftGenerationError'
  }
}

export class AiStyleAnalysisError extends Error {
  retryable = true

  constructor(message = 'Analyse IA impossible pour le moment.') {
    super(message)
    this.name = 'AiStyleAnalysisError'
  }
}

export class AiClassificationError extends Error {
  retryable = true

  constructor(message = 'Analyse impossible pour le moment.') {
    super(message)
    this.name = 'AiClassificationError'
  }
}

type AiProviderTask = 'classification' | 'draft' | 'draft_small' | 'draft_medium' | 'draft_complex' | 'style' | 'default'
export type DraftComplexity = 'small' | 'medium' | 'complex'

type AiProviderConfig = {
  provider: 'openrouter' | 'openai'
  model: string
  apiKey: string
  url: string
}

function getModelForTask(provider: 'openrouter' | 'openai', task: AiProviderTask) {
  if (task === 'classification') {
    return (
      process.env.LLM_CLASSIFICATION_MODEL ||
      process.env.LLM_MODEL ||
      (provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini')
    )
  }

  if (task === 'draft' || task === 'draft_small') {
    return (
      process.env.LLM_DRAFT_SMALL_MODEL ||
      process.env.LLM_DRAFT_MODEL ||
      process.env.LLM_MODEL ||
      (provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini')
    )
  }

  if (task === 'draft_medium') {
    return (
      process.env.LLM_DRAFT_MEDIUM_MODEL ||
      process.env.LLM_DRAFT_SMALL_MODEL ||
      process.env.LLM_DRAFT_MODEL ||
      process.env.LLM_MODEL ||
      (provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini')
    )
  }

  if (task === 'draft_complex') {
    return (
      process.env.LLM_DRAFT_COMPLEX_MODEL ||
      process.env.LLM_DRAFT_MEDIUM_MODEL ||
      process.env.LLM_DRAFT_SMALL_MODEL ||
      process.env.LLM_DRAFT_MODEL ||
      process.env.LLM_MODEL ||
      (provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini')
    )
  }

  return process.env.LLM_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini')
}

function draftTaskForComplexity(complexity: DraftComplexity = 'medium'): AiProviderTask {
  if (complexity === 'small') return 'draft_small'
  if (complexity === 'complex') return 'draft_complex'
  return 'draft_medium'
}

function maxDraftTokensForComplexity(complexity: DraftComplexity = 'medium') {
  if (complexity === 'small') return 260
  if (complexity === 'complex') return 760
  return 460
}

export function getAiProviderStatus() {
  const provider = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase()
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const openAiKey = process.env.OPENAI_API_KEY

  if (provider === 'openai') {
    return {
      configured: Boolean(openAiKey),
      provider: 'openai' as const,
      model: getModelForTask('openai', 'default'),
      classificationModel: getModelForTask('openai', 'classification'),
      draftModel: getModelForTask('openai', 'draft'),
      draftSmallModel: getModelForTask('openai', 'draft_small'),
      draftMediumModel: getModelForTask('openai', 'draft_medium'),
      draftComplexModel: getModelForTask('openai', 'draft_complex'),
      hasOpenRouterKey: Boolean(openRouterKey),
      hasOpenAiKey: Boolean(openAiKey),
    }
  }

  return {
    configured: Boolean(openRouterKey),
    provider: 'openrouter' as const,
    model: getModelForTask('openrouter', 'default'),
    classificationModel: getModelForTask('openrouter', 'classification'),
    draftModel: getModelForTask('openrouter', 'draft'),
    draftSmallModel: getModelForTask('openrouter', 'draft_small'),
    draftMediumModel: getModelForTask('openrouter', 'draft_medium'),
    draftComplexModel: getModelForTask('openrouter', 'draft_complex'),
    hasOpenRouterKey: Boolean(openRouterKey),
    hasOpenAiKey: Boolean(openAiKey),
  }
}

function getAiProviderConfig(task: AiProviderTask = 'default'): AiProviderConfig | null {
  const status = getAiProviderStatus()

  if (status.provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return null

    return {
      provider: 'openai',
      model: getModelForTask('openai', task),
      apiKey,
      url: 'https://api.openai.com/v1/chat/completions',
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  return {
    provider: 'openrouter',
    model: getModelForTask('openrouter', task),
    apiKey,
    url: 'https://openrouter.ai/api/v1/chat/completions',
  }
}

function summarizeProfile(profile: AutomationProfile) {
  return {
    objective: profile.business_context.main_goal,
    businessContext: profile.business_context.business_description,
    emailVolume: profile.business_context.email_volume,
    draftTone: profile.global_settings.default_tone,
    customDraftInstructions: profile.global_settings.custom_draft_instructions || '',
    categories: profile.categories.map((category) => ({
      name: category.name,
      description: category.description,
      actions: category.actions,
      draftInstructions: category.draft_reply.instructions,
      telegramNotify: category.telegram.notify,
      archive: category.archive.enabled,
    })),
    safety: {
      draftsRequireApproval: profile.safety.drafts_require_approval,
      allowAutoSend: profile.safety.allow_auto_send,
      allowPermanentDelete: profile.safety.allow_permanent_delete,
      sensitiveKeywords: profile.safety.sensitive_keywords,
    },
  }
}

function categoryDescriptionFallback(name: string) {
  const key = normalizeForDetection(name)
  const defaults: Record<string, string> = {
    clients: 'Emails de clients existants : questions, suivi, projets, support.',
    prospects: 'Demandes de nouveaux clients potentiels : tarifs, disponibilités, devis.',
    factures: 'Factures, paiements, comptabilité, reçus et justificatifs.',
    urgences: 'Messages sensibles ou bloquants : délai court, client mécontent, juridique, sécurité.',
    administratif: 'Documents, comptes, démarches, messages officiels ou organisation générale.',
    fournisseurs: 'Messages de partenaires, prestataires, achats ou fournisseurs.',
    commandes: 'Commandes, suivi de livraison, achats ou demandes liées à une transaction.',
    sav: 'Support après-vente, problème client, réclamation ou demande d’aide.',
    newsletters: 'Emails d’information, newsletters et contenus récurrents.',
    publicites: 'Promotions, publicités et prospection non prioritaire.',
  }

  return defaults[key] || `Emails correspondant au label Gmail “${name}”.`
}

function normalizeForDetection(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function detectAddressingMode(
  customInstructions: string | undefined,
  incomingEmail: string,
  selectedTone: string,
  learnedPreference?: WritingStyleProfile['tutoiement_or_vouvoiement_preference'] | null,
): AddressingMode {
  const custom = normalizeForDetection(customInstructions || '')
  const incoming = normalizeForDetection(incomingEmail)
  const tone = normalizeForDetection(selectedTone)

  if (/\b(tutoiement|tutoyer|tutoie|toujours tutoyer|parler en tu|ecrire en tu|répondre en tu|repondre en tu)\b/.test(custom)) {
    return 'tu'
  }

  if (/\b(vouvoiement|vouvoyer|vouvoie|toujours vouvoyer|parler en vous|ecrire en vous|répondre en vous|repondre en vous)\b/.test(custom)) {
    return 'vous'
  }

  if (learnedPreference === 'tu' || learnedPreference === 'vous') {
    return learnedPreference
  }

  const incomingUsesTu = /\b(tu|ton|ta|tes|toi|te|t'|t’|peux-tu|as-tu)\b/.test(incoming)
  const incomingUsesVous = /\b(vous|votre|vos)\b/.test(incoming)

  if (incomingUsesTu && !incomingUsesVous && (tone === 'chaleureux' || tone === 'direct')) {
    return 'tu'
  }

  if (incomingUsesVous) return 'vous'
  if (tone === 'professionnel' || tone === 'premium') return 'vous'

  return 'auto'
}

function parseJsonObject(content: string) {
  const trimmed = content.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(withoutFence)
}

function isMalformedAiOutputError(error: unknown) {
  if (error instanceof AiDraftGenerationError) return true
  if (error instanceof SyntaxError) return true
  if (error instanceof z.ZodError) return true

  const message = error instanceof Error ? error.message : String(error)
  return /json|parse|expected|unexpected|invalid|invalide|réponse ia vide|reponse ia vide/i.test(message)
}

function normalizeClosingLine(value: string) {
  return normalizeForDetection(value)
    .replace(/[.,!;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isClosingLine(value: string) {
  const normalized = normalizeClosingLine(value)

  return (
    /^(bien\s+)?cordialement$/.test(normalized) ||
    /^bien\s+a\s+vous$/.test(normalized) ||
    /^bonne\s+(journee|soiree|fin\s+de\s+journee)$/.test(normalized) ||
    /^a\s+bientot$/.test(normalized) ||
    /^merci(\s+d'?avance|\s+beaucoup)?$/.test(normalized)
  )
}

function isSoftThanksClosing(value: string) {
  return /^merci(\s+d'?avance|\s+beaucoup)?$/.test(normalizeClosingLine(value))
}

function hasNaturalClosing(body: string) {
  const tailLines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)

  return tailLines.some(isClosingLine)
}

function looksLikeSignatureLine(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (isClosingLine(trimmed)) return false
  if (trimmed.length > 80) return false
  if (/[.!?]$/.test(trimmed)) return false

  return trimmed.split(/\s+/).length <= 8
}

function cleanupDuplicateClosings(body: string) {
  const lines = body.split(/\r?\n/)
  const nonEmptyIndices = lines
    .map((line, index) => (line.trim() ? index : -1))
    .filter((index) => index >= 0)
  const tailStart = nonEmptyIndices.slice(-14)[0] ?? 0
  const blocks: Array<{ start: number; end: number; hasSignature: boolean; soft: boolean }> = []

  for (let index = tailStart; index < lines.length; index += 1) {
    if (!isClosingLine(lines[index])) continue

    let end = index
    let signatureLines = 0
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next]
      if (!line.trim()) break
      if (!looksLikeSignatureLine(line)) break
      signatureLines += 1
      end = next
      if (signatureLines >= 2) break
    }

    blocks.push({
      start: index,
      end,
      hasSignature: signatureLines > 0,
      soft: isSoftThanksClosing(lines[index]),
    })
  }

  if (blocks.length <= 1) return body

  const preferredBlock =
    [...blocks].reverse().find((block) => block.hasSignature) ||
    blocks[blocks.length - 1]
  const removeLines = new Set<number>()

  for (const block of blocks) {
    if (block === preferredBlock) continue
    if (block.start < preferredBlock.start && block.soft) continue

    for (let index = block.start; index <= block.end; index += 1) {
      removeLines.add(index)
    }
  }

  return lines
    .filter((_, index) => !removeLines.has(index))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function usesTuAddressing(body: string) {
  return /\b(tu|ton|ta|tes|toi|te|t'|t’|peux-tu|as-tu)\b/i.test(body)
}

function usesVousAddressing(body: string) {
  return /(?<!rendez-)\b(vous|votre|vos|vôtre|veuillez)\b|(?:pouvez|pourriez)-vous/i.test(body)
}

function validateAddressing(body: string, addressingMode: AddressingMode) {
  if (addressingMode === 'tu') {
    if (usesVousAddressing(body) || !usesTuAddressing(body)) {
      return 'Le brouillon ne respecte pas le tutoiement demandé. Réessayez.'
    }
  }

  if (addressingMode === 'vous' && usesTuAddressing(body)) {
    return 'Le brouillon ne respecte pas le vouvoiement demandé. Réessayez.'
  }

  return null
}

function validateDraftCompleteness(body: string) {
  const compact = body.replace(/\s+/g, ' ').trim()
  if (compact.length < 60) return 'Le brouillon est trop court pour être fiable.'
  if (/\[(?:[^\]]+)\]/.test(body)) return 'Le brouillon contient encore un placeholder entre crochets.'
  if (/(?:\w|,|;|:)$/.test(compact) && !hasNaturalClosing(body)) {
    return 'Le brouillon semble incomplet ou se termine trop brusquement.'
  }
  return null
}

export function cleanAiDraftBody(rawBody: string) {
  const placeholderPattern =
    /\[(?:ins[eé]rer|votre|à compléter|a completer|signature|nom|jour|heure|date|créneau|creneau)[^\]]*\]/i
  const forbiddenLinePattern =
    /(?:^|\b)(résumé|resume|reasoning|raisonnement|classification|analyse interne|debug|json|toolia|brouillon créé|aucun email n|généré par|genere par|intelligence artificielle|ia)(?:\b|:)/i

  const cleanedLines = rawBody
    .replace(/^```(?:json|text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '--')
    .filter((line) => !placeholderPattern.test(line))
    .filter((line) => !forbiddenLinePattern.test(line))

  let body = cleanedLines
    .join('\n')
    .replace(placeholderPattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  body = cleanupDuplicateClosings(body)

  if (!body || body.length < 20) {
    body =
      'Bonjour,\n\nMerci pour votre message. Pouvez-vous me préciser les éléments nécessaires afin que je puisse vous répondre précisément ?'
  }

  if (!hasNaturalClosing(body)) {
    body = `${body}\n\nCordialement,`
  }

  return cleanupDuplicateClosings(body)
}

function cleanAiDraftSubject(rawSubject: string) {
  const cleaned = rawSubject
    .replace(/\[(?:ins[eé]rer|votre|à compléter|a completer|signature|nom|jour|heure|date|créneau|creneau)[^\]]*\]/gi, '')
    .replace(/```/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'Réponse à votre message'
}

function buildAiMessages(input: {
  profile: AutomationProfile
  incomingEmail: string
  addressingMode: AddressingMode
  writingStyleProfile?: WritingStyleProfile | null
  retryFeedback?: string
}) {
  const profileSummary = summarizeProfile(input.profile)
  const customInstructions = input.profile.global_settings.custom_draft_instructions || ''
  const retryInstruction = input.retryFeedback
    ? ' Tentative de correction : la réponse précédente était invalide. Retourne uniquement un objet JSON strictement valide avec les clés subject, body, confidence et reasoning_summary. Aucun texte avant ou après le JSON.'
    : ''

  return [
    {
      role: 'system' as const,
      content:
        `Tu prépares uniquement le contenu d’un brouillon de réponse email en français professionnel. Respecte strictement cette priorité : 1. règles de sécurité, 2. instructions personnalisées utilisateur, 3. style d’écriture appris depuis les emails envoyés, 4. ton sélectionné, 5. comportement Toolia par défaut. Les instructions personnalisées doivent être appliquées exactement sauf si elles contredisent une règle de sécurité, et elles gagnent toujours sur le style appris. Si un style appris est fourni, imite ses formules, sa longueur, ses salutations et ses fins naturelles sans copier d’emails bruts. Si le style appris contient une signature claire, tu peux l’utiliser une seule fois. N’invente jamais de signature. Si addressing_mode vaut "tu", tu dois tutoyer le destinataire dans tout le mail. Utilise uniquement tu/ton/ta/tes/toi. Il est interdit d’utiliser vous/votre/vos/veuillez/pouvez-vous/pourriez-vous. Si addressing_mode vaut "vous", tu dois vouvoyer le destinataire dans tout le mail. Utilise uniquement vous/votre/vos. Il est interdit d’utiliser tu/ton/ta/tes/toi. Ne mélange jamais tu et vous. Si addressing_mode vaut "auto", infère depuis l’email reçu puis reste cohérent. Le ton chaleureux doit être nettement plus humain, amical et relationnel que le ton professionnel, tout en restant sérieux. Le ton professionnel reste neutre et clair. Le ton direct est court. Le ton premium est soigné et haut de gamme. Le champ body doit contenir une seule réponse claire, sans mention de Toolia, sans mention d’IA, sans résumé, sans analyse, sans JSON, sans markdown, sans footer technique et sans signature factice. Ajoute au maximum une seule formule de fin. Ne cumule jamais plusieurs fins comme “Bien cordialement” puis “Cordialement”. Ne rajoute jamais une deuxième signature après la signature apprise. Ne mets jamais de placeholders comme [Insérer jour], [Insérer heure], [Votre nom], [Votre signature] ou [À compléter]. Si une information manque, pose une clarification concise ou écris naturellement que l’expéditeur reviendra avec les détails, par exemple pour les disponibilités : “Je reviens rapidement avec mes disponibilités.” N’invente jamais de faits, prix, délais, disponibilités ou engagements absents du contexte. Termine naturellement, par exemple par “Cordialement,” si aucune signature réelle n’est fournie. Réponds uniquement en JSON valide avec subject, body, confidence, reasoning_summary. reasoning_summary doit être bref, sûr pour l’utilisateur, et ne doit jamais être recopié dans body.${retryInstruction}`,
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        toolia_profile: profileSummary,
        selected_tone: profileSummary.draftTone,
        custom_instructions: customInstructions,
        learned_writing_style: input.writingStyleProfile || null,
        priority_order: [
          'Règles de sécurité',
          'Instructions personnalisées utilisateur',
          'Style d’écriture appris',
          'Ton sélectionné',
          'Comportement Toolia par défaut',
        ],
        addressing_mode: input.addressingMode,
        addressing_contract:
          input.addressingMode === 'tu'
            ? 'OBLIGATOIRE : tutoyer le destinataire partout. Utiliser uniquement tu/ton/ta/tes/toi. Interdit : vous, votre, vos, vôtre, veuillez, pouvez-vous, pourriez-vous.'
            : input.addressingMode === 'vous'
              ? 'OBLIGATOIRE : vouvoyer le destinataire partout. Utiliser vous/votre/vos. Interdit : tu, ton, ta, tes, toi, peux-tu.'
              : 'Mode automatique : choisir tu ou vous selon l’email reçu et rester cohérent sans mélange.',
        simulated_incoming_email: input.incomingEmail,
        retry_feedback: input.retryFeedback || null,
        required_output: {
          subject: 'Objet court du brouillon',
          body: 'Corps complet du brouillon prêt à relire',
          confidence: 'low | medium | high',
          reasoning_summary: 'Résumé bref et sûr de la logique utilisée',
        },
        safety_rules: [
          'Les règles de sécurité gagnent toujours sur les instructions personnalisées.',
          'Appliquer les instructions personnalisées si elles ne contredisent pas la sécurité.',
          'Ne jamais envoyer automatiquement.',
          'Ne jamais inventer de prix.',
          'Ne jamais inventer de disponibilité.',
          'Ne jamais inventer de délai.',
          'Ne jamais inventer d’engagement.',
          'Ne pas promettre ce qui n’est pas dans l’email reçu ou le profil.',
          'Demander une clarification concise si une information importante manque.',
          'Le body doit être uniquement la réponse email finale.',
          'Ne jamais utiliser de placeholders entre crochets.',
          'Ne jamais ajouter de signature générique ou de footer technique.',
          'Ne jamais inclure de raisonnement interne dans le body.',
        ],
      }),
    },
  ]
}

async function requestAiDraft(input: {
  config: AiProviderConfig
  profile: AutomationProfile
  incomingEmail: string
  addressingMode: AddressingMode
  complexity?: DraftComplexity
  writingStyleProfile?: WritingStyleProfile | null
  retryFeedback?: string
}) {
  const response = await fetch(input.config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(input.config.provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'Toolia',
          }
        : {}),
    },
    body: JSON.stringify({
      model: input.config.model,
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: maxDraftTokensForComplexity(input.complexity || 'medium'),
      messages: buildAiMessages({
        profile: input.profile,
        incomingEmail: input.incomingEmail,
        addressingMode: input.addressingMode,
        writingStyleProfile: input.writingStyleProfile,
        retryFeedback: input.retryFeedback,
      }),
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Erreur IA ${response.status}: ${details.slice(0, 300)}`)
  }

  let data: { choices?: Array<{ message?: { content?: unknown } }> }
  try {
    data = await response.json()
  } catch {
    throw new AiDraftGenerationError()
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new AiDraftGenerationError()
  }

  let parsed: AiDraftResult
  try {
    parsed = aiDraftSchema.parse(parseJsonObject(content))
  } catch {
    throw new AiDraftGenerationError()
  }

  const cleanedBody = cleanAiDraftBody(parsed.body)

  return {
    parsed,
    cleanedBody,
    validationIssue:
      validateAddressing(cleanedBody, input.addressingMode) ||
      validateDraftCompleteness(cleanedBody),
  }
}

async function requestWritingStyleAnalysis(input: {
  config: AiProviderConfig
  samples: string[]
  retryFeedback?: string
}) {
  const response = await fetch(input.config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(input.config.provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'Toolia',
          }
        : {}),
    },
    body: JSON.stringify({
      model: input.config.model,
      response_format: { type: 'json_object' },
      temperature: 0.15,
      messages: [
        {
          role: 'system',
          content:
            'Tu analyses un petit lot d’emails envoyés par un utilisateur pour produire un profil de style compact. Ne recopie pas les emails. Ne conserve pas de données personnelles. Retourne uniquement un JSON strictement valide avec les champs demandés. Décris le style, la longueur, les salutations, les fins, le niveau de formalité, la préférence tu/vous, les expressions fréquentes et ce qu’il vaut mieux éviter.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            sent_email_samples: input.samples.map((sample, index) => ({
              index: index + 1,
              body: sample.slice(0, 2500),
            })),
            retry_feedback: input.retryFeedback || null,
            required_output: {
              sample_count: input.samples.length,
              tone_summary: 'Résumé compact du style',
              average_length: 'short | medium | long',
              greeting_style: 'Style de salutation',
              closing_style: 'Style de fin',
              signature_detected: 'Signature détectée ou null',
              formality_level: 'casual | balanced | formal',
              tutoiement_or_vouvoiement_preference: 'tu | vous | mixed | unknown',
              common_phrases: ['formule fréquente'],
              things_to_avoid: ['élément à éviter'],
            },
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new AiStyleAnalysisError()
  }

  let data: { choices?: Array<{ message?: { content?: unknown } }> }
  try {
    data = await response.json()
  } catch {
    throw new AiStyleAnalysisError()
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new AiStyleAnalysisError()
  }

  try {
    const parsed = writingStyleProfileSchema.parse(parseJsonObject(content))
    return {
      ...parsed,
      sample_count: input.samples.length,
      common_phrases: parsed.common_phrases.slice(0, 12),
      things_to_avoid: parsed.things_to_avoid.slice(0, 12),
    }
  } catch {
    throw new AiStyleAnalysisError()
  }
}

export async function analyzeWritingStyleFromSamples(samples: string[]) {
  const config = getAiProviderConfig('style')
  if (!config) {
    throw new AiStyleAnalysisError()
  }

  try {
    return {
      profile: await requestWritingStyleAnalysis({ config, samples }),
      provider: config.provider,
      model: config.model,
    }
  } catch (error) {
    if (!(error instanceof AiStyleAnalysisError)) throw error

    return {
      profile: await requestWritingStyleAnalysis({
        config,
        samples,
        retryFeedback: 'La première analyse était invalide. Retourne uniquement un JSON valide conforme au schéma demandé.',
      }),
      provider: config.provider,
      model: config.model,
    }
  }
}

async function requestEmailClassification(input: {
  config: AiProviderConfig
  profile: AutomationProfile
  writingStyleProfile?: WritingStyleProfile | null
  email: {
    from: string
    subject: string
    body: string
    snippet?: string | null
  }
  threadContext?: unknown
  retryFeedback?: string
}) {
  const profileSummary = summarizeProfile(input.profile)
  const categoryNames = input.profile.categories.map((category) => category.name)
  const configuredCategories = input.profile.categories.map((category) => ({
    category_name: category.name,
    gmail_label_name: category.gmail_label || category.name,
    description: category.description?.trim() || categoryDescriptionFallback(category.name),
    selected_actions: category.actions,
    action_explanations: {
      label: category.actions.label ? 'Appliquer le label Gmail correspondant.' : 'Ne pas appliquer de label automatiquement.',
      draft: category.actions.draft ? 'Un brouillon peut être créé si l’email nécessite une réponse.' : 'Ne pas créer de brouillon pour cette catégorie.',
      telegram: category.actions.telegram ? 'Une alerte pourrait être utile plus tard, mais Telegram n’est pas traité dans ce batch.' : 'Pas d’alerte Telegram.',
      archive: category.actions.archive ? 'Archivage seulement suggéré, jamais appliqué dans ce batch.' : 'Ne pas suggérer l’archivage sauf signal évident.',
    },
    draft_instructions: category.draft_reply.instructions,
  }))

  const response = await fetch(input.config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(input.config.provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'Toolia',
          }
        : {}),
    },
    body: JSON.stringify({
      model: input.config.model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Tu classes un email Gmail entrant selon la configuration Toolia de l’utilisateur. Tu dois retourner uniquement un JSON strictement valide. Choisis UNIQUEMENT parmi les catégories configurées, sans inventer de catégorie. Utilise les descriptions, exemples implicites, labels Gmail et actions activées pour décider. Si le sujet ou le corps contient clairement urgence, urgent, réponse rapide, blocage, délai critique ou client mécontent, et qu’une catégorie configurée correspond aux urgences, privilégie cette catégorie plutôt qu’une catégorie générale comme administratif. Si le message vient clairement d’un client existant et qu’aucune catégorie urgence n’existe, privilégie la catégorie client la plus proche si elle existe. Si tu hésites entre plusieurs catégories, baisse la confidence et explique brièvement pourquoi. Si tu n’es pas assez sûr, mets une confidence inférieure à 0.75 : le backend passera l’email en needs_review et ne fera aucune action automatique. Ne propose jamais d’envoi automatique. Ne propose jamais de suppression définitive. Si une catégorie a archive=true, indique seulement archiveSuggested=true, sans archiver. Si la catégorie ne permet pas les brouillons, draft doit être null. Si un brouillon est utile et autorisé, il doit répondre au dernier email entrant en tenant compte du fil, sans mentionner Toolia, l’IA, test, JSON ou raisonnement interne. Le brouillon doit contenir une seule réponse claire, au maximum une seule formule de fin, et jamais de fins empilées comme “Bien cordialement” puis “Cordialement”. Si le style appris contient une signature claire, utilise-la au plus une fois. N’invente jamais de signature.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            user_goal: input.profile.business_context.main_goal,
            business_context: input.profile.business_context.business_description,
            email_volume: input.profile.business_context.email_volume,
            configured_categories: configuredCategories,
            allowed_categories: categoryNames,
            profile: profileSummary,
            learned_writing_style: input.writingStyleProfile || null,
            email: {
              from: input.email.from,
              subject: input.email.subject,
              body: input.email.body.slice(0, 5000),
              snippet: input.email.snippet || null,
            },
            thread_context: input.threadContext || null,
            retry_feedback: input.retryFeedback || null,
            confidence_rule: 'Si confidence < 0.75, shouldApplyLabel doit être false et shouldCreateDraft doit être false.',
            required_output: {
              category: 'une des catégories autorisées',
              confidence: 'nombre entre 0 et 1',
              importance: 'low | normal | high | urgent',
              shouldApplyLabel: true,
              shouldCreateDraft: false,
              shouldNotifyTelegram: false,
              archiveSuggested: false,
              reason: 'explication courte et sûre',
              draft: null,
            },
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new AiClassificationError()
  }

  let data: { choices?: Array<{ message?: { content?: unknown } }> }
  try {
    data = await response.json()
  } catch {
    throw new AiClassificationError()
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new AiClassificationError()
  }

  try {
    const parsed = emailClassificationSchema.parse(parseJsonObject(content))
    if (!categoryNames.includes(parsed.category)) {
      throw new AiClassificationError()
    }

    const category = input.profile.categories.find((item) => item.name === parsed.category)
    const lowConfidence = parsed.confidence < 0.75
    const draftAllowed = Boolean(category?.actions.draft)

    return {
      ...parsed,
      shouldApplyLabel: lowConfidence ? false : parsed.shouldApplyLabel,
      shouldCreateDraft: lowConfidence || !draftAllowed ? false : parsed.shouldCreateDraft,
      draft: lowConfidence || !draftAllowed || !parsed.shouldCreateDraft ? null : parsed.draft,
      shouldNotifyTelegram: Boolean(category?.actions.telegram && parsed.shouldNotifyTelegram),
      archiveSuggested: Boolean(category?.actions.archive || parsed.archiveSuggested),
    }
  } catch {
    throw new AiClassificationError()
  }
}

async function requestEmailBatchClassification(input: {
  config: AiProviderConfig
  profile: AutomationProfile
  writingStyleProfile?: WritingStyleProfile | null
  emails: Array<{
    id: string
    from: string
    subject: string
    snippet?: string | null
    bodyPreview?: string | null
    ruleCandidateCategory?: string | null
    ruleReason?: string | null
  }>
  retryFeedback?: string
}) {
  const profileSummary = summarizeProfile(input.profile)
  const categoryNames = input.profile.categories.map((category) => category.name)
  const configuredCategories = input.profile.categories.map((category) => ({
    category_name: category.name,
    gmail_label_name: category.gmail_label || category.name,
    description: category.description?.trim() || categoryDescriptionFallback(category.name),
    selected_actions: category.actions,
    draft_allowed: Boolean(category.actions.draft || category.draft_reply.enabled),
    draft_reply_enabled: Boolean(category.draft_reply.enabled),
    draft_instructions: category.draft_reply.instructions,
  }))

  const response = await fetch(input.config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(input.config.provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'Toolia',
          }
        : {}),
    },
    body: JSON.stringify({
      model: input.config.model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'Tu classes un lot compact d’emails Gmail entrants pour Toolia. Retourne uniquement un JSON strictement valide avec une clé results. Chaque résultat doit reprendre email_id. Choisis UNIQUEMENT parmi les catégories configurées, sans inventer de catégorie. Utilise les descriptions, actions activées, sujet, expéditeur, snippet et ruleCandidateCategory si fourni. Si ruleCandidateCategory indique une urgence claire et que cette catégorie existe, privilégie-la sauf contradiction évidente. Si confidence < 0.75, shouldApplyLabel=false, shouldCreateDraft=false et draft=null. Pour réduire les coûts, ne rédige jamais de brouillon complet dans cette classification batch : draft doit toujours être null. shouldCreateDraft peut être true uniquement si la catégorie autorise les brouillons et si l’email semble nécessiter une réponse humaine. Ne propose jamais d’envoi automatique, de suppression définitive ou d’archivage appliqué.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            user_goal: input.profile.business_context.main_goal,
            business_context: input.profile.business_context.business_description,
            email_volume: input.profile.business_context.email_volume,
            configured_categories: configuredCategories,
            allowed_categories: categoryNames,
            selected_tone: profileSummary.draftTone,
            learned_writing_style: input.writingStyleProfile || null,
            emails: input.emails.map((email) => ({
              email_id: email.id,
              from: email.from,
              subject: email.subject,
              snippet: email.snippet || null,
              body_preview: (email.bodyPreview || '').slice(0, 700),
              rule_candidate_category: email.ruleCandidateCategory || null,
              rule_reason: email.ruleReason || null,
            })),
            retry_feedback: input.retryFeedback || null,
            required_output: {
              results: [
                {
                  email_id: 'id fourni',
                  category: 'une des catégories autorisées',
                  confidence: 'nombre entre 0 et 1',
                  importance: 'low | normal | high | urgent',
                  shouldApplyLabel: true,
                  shouldCreateDraft: false,
                  shouldNotifyTelegram: false,
                  archiveSuggested: false,
                  reason: 'explication courte',
                  draft: null,
                },
              ],
            },
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new AiClassificationError()
  }

  let data: { choices?: Array<{ message?: { content?: unknown } }> }
  try {
    data = await response.json()
  } catch {
    throw new AiClassificationError()
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new AiClassificationError()
  }

  try {
    const parsed = emailBatchClassificationSchema.parse(parseJsonObject(content))
    const emailIds = new Set(input.emails.map((email) => email.id))

    return parsed.results
      .filter((item) => emailIds.has(item.email_id))
      .map((item) => {
        if (!categoryNames.includes(item.category)) {
          throw new AiClassificationError()
        }

        const category = input.profile.categories.find((candidate) => candidate.name === item.category)
        const lowConfidence = item.confidence < 0.75
        const draftAllowed = Boolean(category?.actions.draft || category?.draft_reply.enabled)

        return {
          ...item,
          shouldApplyLabel: lowConfidence ? false : item.shouldApplyLabel,
          shouldCreateDraft: lowConfidence || !draftAllowed ? false : item.shouldCreateDraft,
          draft: null,
          shouldNotifyTelegram: Boolean(category?.actions.telegram && item.shouldNotifyTelegram),
          archiveSuggested: Boolean(category?.actions.archive || item.archiveSuggested),
        }
      })
  } catch {
    throw new AiClassificationError()
  }
}

export async function classifyIncomingEmail(input: {
  profile: AutomationProfile
  writingStyleProfile?: WritingStyleProfile | null
  email: {
    from: string
    subject: string
    body: string
    snippet?: string | null
  }
  threadContext?: unknown
}) {
  const config = getAiProviderConfig('classification')
  if (!config) {
    throw new AiClassificationError()
  }

  try {
    return {
      result: await requestEmailClassification({ config, ...input }),
      provider: config.provider,
      model: config.model,
    }
  } catch (error) {
    if (!(error instanceof AiClassificationError)) throw error

    return {
      result: await requestEmailClassification({
        config,
        ...input,
        retryFeedback: 'La première classification était invalide. Retourne uniquement un JSON valide conforme au schéma demandé.',
      }),
      provider: config.provider,
      model: config.model,
    }
  }
}

export async function classifyIncomingEmailsBatch(input: {
  profile: AutomationProfile
  writingStyleProfile?: WritingStyleProfile | null
  emails: Array<{
    id: string
    from: string
    subject: string
    snippet?: string | null
    bodyPreview?: string | null
    ruleCandidateCategory?: string | null
    ruleReason?: string | null
  }>
}) {
  const config = getAiProviderConfig('classification')
  if (!config) {
    throw new AiClassificationError()
  }

  try {
    return {
      results: await requestEmailBatchClassification({ config, ...input }),
      provider: config.provider,
      model: config.model,
    }
  } catch (error) {
    if (!(error instanceof AiClassificationError)) throw error

    return {
      results: await requestEmailBatchClassification({
        config,
        ...input,
        retryFeedback:
          'La première classification batch était invalide. Retourne uniquement un JSON valide avec results, un résultat par email_id.',
      }),
      provider: config.provider,
      model: config.model,
    }
  }
}

export async function generateAiDraftReply(input: {
  profile: AutomationProfile
  incomingEmail: string
  writingStyleProfile?: WritingStyleProfile | null
  complexity?: DraftComplexity
}): Promise<AiDraftResult & { provider: 'openrouter' | 'openai'; model: string; addressingMode: AddressingMode; selectedTone: string; complexity: DraftComplexity }> {
  const complexity = input.complexity || 'medium'
  const config = getAiProviderConfig(draftTaskForComplexity(complexity))
  if (!config) {
    throw new Error('Clé IA manquante. Ajoutez OPENROUTER_API_KEY dans .env.local.')
  }
  const selectedTone = input.profile.global_settings.default_tone
  const addressingMode = detectAddressingMode(
    input.profile.global_settings.custom_draft_instructions,
    input.incomingEmail,
    selectedTone,
    input.writingStyleProfile?.tutoiement_or_vouvoiement_preference,
  )
  let result

  try {
    result = await requestAiDraft({
      config,
      profile: input.profile,
      incomingEmail: input.incomingEmail,
      addressingMode,
      complexity,
      writingStyleProfile: input.writingStyleProfile,
    })
  } catch (error) {
    if (!isMalformedAiOutputError(error)) throw error

    result = await requestAiDraft({
      config,
      profile: input.profile,
      incomingEmail: input.incomingEmail,
      addressingMode,
      complexity,
      writingStyleProfile: input.writingStyleProfile,
      retryFeedback: 'La première réponse IA était mal formée ou inutilisable.',
    })
  }

  if (result.validationIssue) {
    result = await requestAiDraft({
      config,
      profile: input.profile,
      incomingEmail: input.incomingEmail,
      addressingMode,
      complexity,
      writingStyleProfile: input.writingStyleProfile,
      retryFeedback: result.validationIssue,
    })
  }

  if (result.validationIssue) {
    if (result.validationIssue.includes('tutoiement demandé') || result.validationIssue.includes('vouvoiement demandé')) {
      throw new Error(result.validationIssue)
    }

    throw new AiDraftGenerationError()
  }

  return {
    ...result.parsed,
    subject: cleanAiDraftSubject(result.parsed.subject),
    body: result.cleanedBody,
    provider: config.provider,
    model: config.model,
    addressingMode,
    selectedTone,
    complexity,
  }
}
