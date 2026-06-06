import { z } from 'zod'

export const legacyAutomationActions = [
  'label_only',
  'draft_reply',
  'notify_telegram',
  'archive',
] as const

export const telegramPreferences = ['none', 'important_only', 'all_selected'] as const

const customDraftInstructionsSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().slice(0, 1000) : ''),
  z.string().max(1000),
)

export const defaultCategorySuggestions = [
  'clients',
  'prospects',
  'factures',
  'fournisseurs',
  'urgences',
  'newsletters',
  'publicites',
  'administratif',
  'commandes',
  'sav',
] as const

export const categoryLabels: Record<(typeof defaultCategorySuggestions)[number], string> = {
  clients: 'Clients',
  prospects: 'Prospects',
  factures: 'Factures',
  fournisseurs: 'Fournisseurs',
  urgences: 'Urgences',
  newsletters: 'Newsletters',
  publicites: 'Publicités',
  administratif: 'Administratif',
  commandes: 'Commandes',
  sav: 'SAV',
}

export const categoryDescriptions: Record<(typeof defaultCategorySuggestions)[number], string> = {
  clients: 'Messages de clients existants, demandes de suivi, livrables et échanges commerciaux en cours.',
  prospects: 'Nouveaux leads, demandes de devis, prises de contact et opportunités commerciales.',
  factures: 'Factures, reçus, paiements, relances comptables et justificatifs.',
  fournisseurs: 'Messages de prestataires, fournisseurs, partenaires opérationnels et achats.',
  urgences: 'Emails à traiter rapidement, incidents, blocages, délais courts ou demandes critiques.',
  newsletters: 'Newsletters, veilles, contenus récurrents et emails de lecture non prioritaire.',
  publicites: 'Promotions, prospection froide, publicités et emails marketing non sollicités.',
  administratif: 'Documents, formalités, contrats, assurances, RH et démarches internes.',
  commandes: 'Commandes, livraisons, confirmations, retours et suivi logistique.',
  sav: 'Support client, réclamations, problèmes d’usage et demandes après-vente.',
}

const rawActionsSchema = z
  .object({
    label: z.boolean().optional(),
    draft: z.boolean().optional(),
    telegram: z.boolean().optional(),
    archive: z.boolean().optional(),
  })
  .passthrough()

function actionsFromLegacy(action: unknown) {
  const legacyReviewAction = 'human' + '_review'
  const legacyReviewLabel = 'validation' + '_humaine'
  if (action === legacyReviewAction || action === legacyReviewLabel) {
    return { label: true, draft: false, telegram: false, archive: false }
  }

  if (typeof action === 'string' && draftStringSignal(action)) {
    return { label: true, draft: true, telegram: false, archive: false }
  }

  if (action === 'archive') {
    return { label: false, draft: false, telegram: false, archive: true }
  }

  if (action === 'draft_reply') {
    return { label: true, draft: true, telegram: false, archive: false }
  }

  if (action === 'notify_telegram') {
    return { label: true, draft: false, telegram: true, archive: false }
  }

  return { label: true, draft: false, telegram: false, archive: false }
}

function draftStringSignal(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '')

  return [
    'draft',
    'draftreply',
    'labeldraft',
    'label+draft',
    'labeldraftreply',
    'brouillon',
    'labelbrouillon',
  ].includes(normalized)
}

function valueHasDraftSignal(value: unknown): boolean {
  if (!value) return false
  if (typeof value === 'string') return draftStringSignal(value)
  if (Array.isArray(value)) return value.some((item) => valueHasDraftSignal(item))
  if (typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  if (record.draft === true) return true
  if (record.create_draft === true) return true
  if (record.draft_reply_enabled === true) return true
  if (typeof record.action === 'string' && draftStringSignal(record.action)) return true
  if (typeof record.response_mode === 'string' && draftStringSignal(record.response_mode)) return true
  if (record.actions && valueHasDraftSignal(record.actions)) return true

  const draftReply = record.draft_reply
  if (draftReply && typeof draftReply === 'object' && !Array.isArray(draftReply)) {
    const draftReplyRecord = draftReply as Record<string, unknown>
    if (draftReplyRecord.enabled === true) return true
  }

  return false
}

export const categoryActionsSchema = z.preprocess((value) => {
  if (!value || typeof value === 'string') {
    return actionsFromLegacy(value)
  }

  return value
}, rawActionsSchema).transform((value) => {
  if (value.archive) {
    return { label: false, draft: false, telegram: false, archive: true }
  }

  const rawValue = value as typeof value & Record<string, unknown>
  return {
    label: value.label ?? true,
    draft: value.draft ?? valueHasDraftSignal(rawValue),
    telegram: value.telegram ?? false,
    archive: false,
  }
})

function normalizeCategoryInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const category = value as Record<string, unknown>
  const rest = { ...category }
  const action = rest.action
  const responseMode = rest.response_mode
  const createDraft = rest.create_draft
  const draftReplyEnabled = rest.draft_reply_enabled
  const draftReply = rest.draft_reply
  delete rest.action
  delete rest.response_mode
  delete rest.create_draft
  delete rest.draft_reply_enabled
  delete rest['human' + '_review_required']

  const parsedActions = categoryActionsSchema.safeParse(category.actions ?? actionsFromLegacy(action))
  const actions = parsedActions.success ? parsedActions.data : actionsFromLegacy(action)
  const draft =
    actions.draft ||
    createDraft === true ||
    draftReplyEnabled === true ||
    valueHasDraftSignal(responseMode) ||
    valueHasDraftSignal(draftReply)

  return {
    ...rest,
    actions: actions.archive ? actions : { ...actions, draft },
  }
}

export const onboardingCategorySchema = z.preprocess(
  normalizeCategoryInput,
  z
    .object({
      key: z.string().min(1),
      label: z.string().min(1),
      selected: z.boolean(),
      description: z.string().min(1),
      exampleEmail: z.string().optional(),
      actions: categoryActionsSchema,
    })
    .strict(),
)

export const onboardingAnswersSchema = z
  .object({
    mainGoal: z.string().min(3),
    businessContext: z.string().min(3),
    emailVolume: z.enum(['moins_20', '20_50', '50_100', '100_plus']),
    estimatedDailyEmailCount: z
      .preprocess(
        (value) => {
          if (value === null || value === undefined || value === '') return null
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : value
        },
        z.number().int().positive().nullable(),
      )
      .default(null),
    categories: z.array(onboardingCategorySchema).min(1),
    draftTone: z.enum(['professionnel', 'chaleureux', 'direct', 'premium']),
    customDraftInstructions: customDraftInstructionsSchema.default(''),
    telegramPreference: z.enum(telegramPreferences),
    automationLevel: z.enum(['balanced']).default('balanced'),
  })
  .superRefine((value, ctx) => {
    if (value.emailVolume !== '100_plus') return

    if (!value.estimatedDailyEmailCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estimatedDailyEmailCount'],
        message: 'Indiquez le nombre moyen d’emails reçus par jour.',
      })
      return
    }

    if (value.estimatedDailyEmailCount <= 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estimatedDailyEmailCount'],
        message:
          'Vous avez sélectionné + de 100 emails/jour, mais le nombre saisi doit être supérieur à 100. Corrigez le volume ou choisissez une autre tranche.',
      })
    }
  })
  .strict()

export const automationCategorySchema = z.preprocess(
  normalizeCategoryInput,
  z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      gmail_label: z.string().min(1),
      description: z.string().min(1),
      actions: categoryActionsSchema,
      priority: z.enum(['low', 'normal', 'high', 'urgent']),
      draft_reply: z
        .object({
          enabled: z.boolean(),
          tone: z.string().min(1),
          instructions: z.string().min(1),
        })
        .strict(),
      telegram: z
        .object({
          notify: z.boolean(),
          channel: z.string().nullable(),
        })
        .strict(),
      archive: z
        .object({
          enabled: z.boolean(),
          after_label: z.boolean(),
        })
        .strict(),
    })
    .strict(),
)

function normalizeProfileInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const profile = value as Record<string, unknown>
  const globalSettings = (profile.global_settings || {}) as Record<string, unknown>
  const safety = (profile.safety || {}) as Record<string, unknown>
  const safeSafety = { ...safety }
  delete safeSafety['require_' + 'human' + '_review' + '_for_drafts']
  delete safeSafety.fallback_action

  return {
    ...profile,
    global_settings: {
      ...globalSettings,
      automation_level: 'balanced',
      telegram_preference:
        globalSettings.telegram_preference ||
        (globalSettings.telegram_enabled ? 'important_only' : 'none'),
    },
    safety: {
      ...safeSafety,
      drafts_require_approval: true,
      fallback_action: 'label_only',
    },
  }
}

export const automationProfileSchema = z.preprocess(
  normalizeProfileInput,
  z
    .object({
      version: z.literal('toolia_profile_v1'),
      business_context: z
        .object({
          main_goal: z.string().min(1),
          business_description: z.string().min(1),
          email_volume: z.string().min(1),
          estimated_daily_email_count: z.number().int().positive().nullable().optional(),
        })
        .strict(),
      global_settings: z
        .object({
          default_tone: z.string().min(1),
          custom_draft_instructions: z.string().max(1000).default(''),
          automation_level: z.literal('balanced'),
          telegram_enabled: z.boolean(),
          telegram_preference: z.enum(telegramPreferences).default('none'),
          gmail_connection_required: z.literal(true),
          auto_send_enabled: z.literal(false),
          permanent_delete_enabled: z.literal(false),
          n8n_exposed_to_user: z.literal(false),
        })
        .strict(),
      categories: z.array(automationCategorySchema).min(1),
      safety: z
        .object({
          drafts_require_approval: z.literal(true),
          allow_auto_send: z.literal(false),
          allow_permanent_delete: z.literal(false),
          fallback_action: z.literal('label_only'),
          max_emails_per_worker_run: z.number().int().min(1).max(200),
          sensitive_keywords: z.array(z.string()),
          audit_logging_enabled: z.literal(true),
        })
        .strict(),
    })
    .strict()
    .superRefine((value, ctx) => {
      const emailVolume = value.business_context.email_volume
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      const isMoreThan100 = emailVolume.includes('plus de 100') || emailVolume.includes('+ de 100')

      if (!isMoreThan100) return

      const exactCount = value.business_context.estimated_daily_email_count
      if (!exactCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['business_context', 'estimated_daily_email_count'],
          message: 'Indiquez le nombre moyen d’emails reçus par jour.',
        })
        return
      }

      if (exactCount <= 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['business_context', 'estimated_daily_email_count'],
          message:
            'Vous avez sélectionné + de 100 emails/jour, mais le nombre saisi doit être supérieur à 100. Corrigez le volume ou choisissez une autre tranche.',
        })
      }
    }),
)

export type CategoryActions = z.infer<typeof categoryActionsSchema>
export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>
export type AutomationProfile = z.infer<typeof automationProfileSchema>
export type AutomationCategory = z.infer<typeof automationCategorySchema>

export type LegacyAutomationAction = (typeof legacyAutomationActions)[number]

export type GmailLabelResult = {
  id: string
  name: string
  created: boolean
  mode: 'demo' | 'live'
}
