import {
  AutomationCategory,
  AutomationProfile,
  CategoryActions,
  OnboardingAnswers,
  automationProfileSchema,
  categoryActionsSchema,
  onboardingAnswersSchema,
} from './schemas'

type ProfileGenerationResult = {
  profile: AutomationProfile
  mode: 'mock' | 'openai' | 'openrouter'
  validation: 'passed'
  fallbackReason?: string
}

const emailVolumeLabels: Record<OnboardingAnswers['emailVolume'], string> = {
  moins_20: 'Moins de 20 emails par jour',
  '20_50': '20 à 50 emails par jour',
  '50_100': '50 à 100 emails par jour',
  '100_plus': 'Plus de 100 emails par jour',
}

const sensitiveKeywords = [
  'résiliation',
  'litige',
  'avocat',
  'mise en demeure',
  'paiement refusé',
  'urgence',
  'confidentiel',
]

function normalizeCustomDraftInstructions(value: string | undefined) {
  return (value || '').trim().slice(0, 1000)
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function priorityForCategory(key: string, actions: CategoryActions): AutomationCategory['priority'] {
  if (key.includes('urgence') || actions.telegram) return 'urgent'
  if (key.includes('client') || key.includes('facture') || key.includes('sav')) return 'high'
  if (key.includes('newsletter') || key.includes('publicite')) return 'low'
  return 'normal'
}

function makeCategory(category: OnboardingAnswers['categories'][number], answers: OnboardingAnswers): AutomationCategory {
  const actions = answers.telegramPreference !== 'all_selected'
    ? { ...category.actions, telegram: false }
    : category.actions

  const telegramEnabled =
    actions.telegram &&
    answers.telegramPreference === 'all_selected'
  const customInstructions = normalizeCustomDraftInstructions(answers.customDraftInstructions)

  return {
    id: category.key,
    name: category.label,
    gmail_label: category.label,
    description: category.description,
    actions,
    priority: priorityForCategory(category.key, actions),
    draft_reply: {
      enabled: actions.draft,
      tone: answers.draftTone,
      instructions:
        actions.draft
          ? [
              `Préparer un brouillon ${answers.draftTone}, contextualisé et prêt à valider. Ne jamais envoyer automatiquement.`,
              customInstructions ? `Préférences de ton utilisateur : ${customInstructions}` : null,
            ].filter(Boolean).join(' ')
          : 'Aucun brouillon automatique pour cette catégorie.',
    },
    telegram: {
      notify: telegramEnabled,
      channel: telegramEnabled ? 'demo-toolia-alerts' : null,
    },
    archive: {
      enabled: actions.archive,
      after_label: actions.archive,
    },
  }
}

function normalizeAnswerActions(actions: CategoryActions, answers: OnboardingAnswers) {
  const parsed = categoryActionsSchema.parse(actions)
  return answers.telegramPreference !== 'all_selected'
    ? { ...parsed, telegram: false }
    : parsed
}

function draftInstructionsForCategory(
  category: AutomationCategory,
  actions: CategoryActions,
  answers: OnboardingAnswers,
) {
  if (!actions.draft) return 'Aucun brouillon automatique pour cette catégorie.'

  const customInstructions = normalizeCustomDraftInstructions(answers.customDraftInstructions)
  const currentInstructions = category.draft_reply.instructions || ''
  if (currentInstructions && !currentInstructions.toLowerCase().includes('aucun brouillon')) {
    return currentInstructions
  }

  return [
    `Préparer un brouillon ${answers.draftTone}, contextualisé et prêt à valider. Ne jamais envoyer automatiquement.`,
    customInstructions ? `Préférences de ton utilisateur : ${customInstructions}` : null,
  ].filter(Boolean).join(' ')
}

function enforceCategoryActionsFromAnswers(profile: AutomationProfile, answers: OnboardingAnswers): AutomationProfile {
  const answersByKey = new Map(answers.categories.map((category) => [category.key, category]))
  const answersByLabel = new Map(answers.categories.map((category) => [normalizeName(category.label), category]))

  const categories = profile.categories.map((category) => {
    const answerCategory = answersByKey.get(category.id) || answersByLabel.get(normalizeName(category.name))
    if (!answerCategory || !answerCategory.selected) return category

    const actions = normalizeAnswerActions(answerCategory.actions, answers)
    const telegramEnabled = Boolean(actions.telegram && answers.telegramPreference === 'all_selected')

    return {
      ...category,
      name: answerCategory.label,
      gmail_label: answerCategory.label,
      description: answerCategory.description,
      actions,
      priority: priorityForCategory(answerCategory.key, actions),
      draft_reply: {
        ...category.draft_reply,
        enabled: actions.draft,
        tone: answers.draftTone,
        instructions: draftInstructionsForCategory(category, actions, answers),
      },
      telegram: {
        notify: telegramEnabled,
        channel: telegramEnabled ? category.telegram.channel || 'demo-toolia-alerts' : null,
      },
      archive: {
        enabled: actions.archive,
        after_label: actions.archive,
      },
    }
  })
  const telegramEnabled = answers.telegramPreference !== 'none'

  return automationProfileSchema.parse({
    ...profile,
    global_settings: {
      ...profile.global_settings,
      telegram_enabled: telegramEnabled,
      telegram_preference: answers.telegramPreference,
    },
    categories,
  })
}

export function buildMockAutomationProfile(rawAnswers: unknown): AutomationProfile {
  const answers = onboardingAnswersSchema.parse(rawAnswers)
  const selectedCategories = answers.categories.filter((category) => category.selected)
  const categories = selectedCategories.length > 0 ? selectedCategories : answers.categories.slice(0, 3)
  const preparedCategories = categories.map((category) => makeCategory(category, answers))
  const telegramEnabled = answers.telegramPreference !== 'none'

  const profile: AutomationProfile = {
    version: 'toolia_profile_v1',
    business_context: {
      main_goal: answers.mainGoal,
      business_description: answers.businessContext,
      email_volume: emailVolumeLabels[answers.emailVolume],
      estimated_daily_email_count: answers.estimatedDailyEmailCount || null,
    },
    global_settings: {
      default_tone: answers.draftTone,
      custom_draft_instructions: normalizeCustomDraftInstructions(answers.customDraftInstructions),
      automation_level: 'balanced',
      telegram_enabled: telegramEnabled,
      telegram_preference: answers.telegramPreference,
      gmail_connection_required: true,
      auto_send_enabled: false,
      permanent_delete_enabled: false,
      n8n_exposed_to_user: false,
    },
    categories: preparedCategories,
    safety: {
      drafts_require_approval: true,
      allow_auto_send: false,
      allow_permanent_delete: false,
      fallback_action: 'label_only',
      max_emails_per_worker_run: 50,
      sensitive_keywords: sensitiveKeywords,
      audit_logging_enabled: true,
    },
  }

  return enforceCategoryActionsFromAnswers(automationProfileSchema.parse(profile), answers)
}

function getLLMConfig() {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase()

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai' as const,
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
    }
  }

  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter' as const,
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
    }
  }

  return null
}

async function generateWithLLM(answers: OnboardingAnswers, config: NonNullable<ReturnType<typeof getLLMConfig>>) {
  const safeExample = buildMockAutomationProfile(answers)
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu génères uniquement un JSON strict pour Toolia. Interdiction d’activer auto_send_enabled ou permanent_delete_enabled. Les brouillons doivent toujours attendre une validation avant envoi.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            onboarding_answers: answers,
            required_shape: safeExample,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('LLM response did not include JSON content')
  }

  return enforceCategoryActionsFromAnswers(automationProfileSchema.parse(JSON.parse(content)), answers)
}

export async function generateAutomationProfile(rawAnswers: unknown): Promise<ProfileGenerationResult> {
  const answers = onboardingAnswersSchema.parse(rawAnswers)
  const config = getLLMConfig()

  if (!config) {
    return {
      profile: buildMockAutomationProfile(answers),
      mode: 'mock',
      validation: 'passed',
    }
  }

  try {
    return {
      profile: await generateWithLLM(answers, config),
      mode: config.provider,
      validation: 'passed',
    }
  } catch (error) {
    return {
      profile: buildMockAutomationProfile(answers),
      mode: 'mock',
      validation: 'passed',
      fallbackReason: error instanceof Error ? error.message : 'AI generation failed',
    }
  }
}
