import { randomBytes, randomUUID } from 'crypto'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  automationProfileSchema,
  onboardingAnswersSchema,
  type AutomationProfile,
  type GmailLabelResult,
  type OnboardingAnswers,
} from './schemas'
import type { WritingStyleProfile } from '@/lib/ai/provider'
import type { ProcessingLog } from './demo-store'
import { getMonthlyUsageSnapshot, normalizePlanId } from './plan-limits'
import { isAutomationCategoryDraftEnabled, summarizeProfileCategoryActions } from './profile-consistency'
import { getStripeBillingStateForUser, isPaidSubscriptionStatus } from './subscription-store'
import { getTelegramConnection } from './telegram-store'

type AccountSession = {
  userId: string
  name: string
  email: string
  mode: 'account'
}

type PersistedPlan = {
  id: 'starter' | 'essential' | 'pro' | 'premium'
  name?: string
  price?: string
  setup?: string
  maxLabels?: number
  description?: string
  features?: string[]
  featured?: boolean
  paid?: boolean
  promoCode?: string | null
}

const planDefaults: Record<'starter' | 'pro' | 'premium', Required<Pick<PersistedPlan, 'id' | 'name' | 'maxLabels'>>> = {
  starter: { id: 'starter', name: 'Starter', maxLabels: 5 },
  pro: { id: 'pro', name: 'Pro', maxLabels: 12 },
  premium: { id: 'premium', name: 'Premium', maxLabels: 25 },
}

const gmailComposeScope = 'https://www.googleapis.com/auth/gmail.compose'
const gmailReadonlyScope = 'https://www.googleapis.com/auth/gmail.readonly'
const gmailModifyScope = 'https://www.googleapis.com/auth/gmail.modify'

function hasComposeScope(connection: { scopes?: string[] | null; scope?: string | null } | null | undefined) {
  if (hasModifyScope(connection)) return true

  return Boolean(
    connection?.scopes?.includes(gmailComposeScope) ||
      connection?.scope?.split(' ').includes(gmailComposeScope),
  )
}

function hasReadScope(connection: { scopes?: string[] | null; scope?: string | null } | null | undefined) {
  if (hasModifyScope(connection)) return true

  return Boolean(
    connection?.scopes?.includes(gmailReadonlyScope) ||
      connection?.scope?.split(' ').includes(gmailReadonlyScope),
  )
}

function hasModifyScope(connection: { scopes?: string[] | null; scope?: string | null } | null | undefined) {
  return Boolean(
    connection?.scopes?.includes(gmailModifyScope) ||
      connection?.scope?.split(' ').includes(gmailModifyScope),
  )
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function makeTemporaryPassword() {
  return `${randomUUID()}-${randomBytes(24).toString('hex')}Aa1!`
}

function makeLog(message: string, level: ProcessingLog['level'] = 'info'): ProcessingLog {
  return {
    id: `db_${Date.now()}_${randomBytes(4).toString('hex')}`,
    created_at: new Date().toISOString(),
    level,
    message,
  }
}

function planFromId(planId: string | null | undefined, paid = false): PersistedPlan | null {
  if (!planId) return null
  return { ...planDefaults[normalizePlanId(planId)], paid }
}

async function findAuthUserByEmail(email: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) return null

    const found = data.users.find((user) => user.email?.toLowerCase() === email)
    if (found) return found
    if (data.users.length < 100) return null
  }

  return null
}

export function isSupabasePersistenceConfigured() {
  return Boolean(getSupabaseAdminClient())
}

export async function ensureSupabaseAccount(input: { name: string; email: string }) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const email = normalizeEmail(input.email)
  const name = input.name.trim()

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (profileLookupError) throw profileLookupError

  if (existingProfile?.id) {
    return {
      userId: existingProfile.id,
      name: existingProfile.full_name || name,
      email: existingProfile.email || email,
      mode: 'account',
    } satisfies AccountSession
  }

  let userId: string | null = null
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: makeTemporaryPassword(),
    user_metadata: { full_name: name },
  })

  if (createUserError) {
    const existingUser = await findAuthUserByEmail(email)
    if (!existingUser?.id) throw createUserError
    userId = existingUser.id
  } else {
    userId = createdUser.user?.id || null
  }

  if (!userId) throw new Error('Impossible de créer le compte Supabase.')

  const { error: upsertProfileError } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: name,
    email,
    updated_at: new Date().toISOString(),
  })

  if (upsertProfileError) throw upsertProfileError

  return {
    userId,
    name,
    email,
    mode: 'account',
  } satisfies AccountSession
}

export async function findSupabaseAccountByEmail(rawEmail: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const email = normalizeEmail(rawEmail)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.id) return null

  return {
    userId: data.id,
    name: data.full_name || email.split('@')[0],
    email: data.email || email,
    mode: 'account',
  } satisfies AccountSession
}

export async function saveSelectedPlan(userId: string, rawPlan: unknown) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const plan = rawPlan as Partial<PersistedPlan>

  if (plan.promoCode) {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      actor: 'user',
      event: 'promo_code_entered',
      metadata: { code: plan.promoCode },
    })
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('plan_id,status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return isPaidSubscriptionStatus(subscription?.status) ? planFromId(subscription?.plan_id, true) : null
}

export async function saveOnboardingAnswers(userId: string, rawAnswers: unknown) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const answers = onboardingAnswersSchema.parse(rawAnswers)
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    actor: 'user',
    event: 'onboarding_answers_saved',
    metadata: { answers },
  })

  if (error) throw error
  return answers
}

export async function storeSupabaseAutomationProfile(
  userId: string,
  rawProfile: unknown,
  labels: GmailLabelResult[],
  options: { testMode?: boolean } = {},
) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const profile = automationProfileSchema.parse(rawProfile)
  const categorySummary = summarizeProfileCategoryActions(profile)
  const now = new Date().toISOString()

  const { error: disableError } = await supabase
    .from('automation_profiles')
    .update({ status: 'disabled', updated_at: now })
    .eq('user_id', userId)
    .in('status', ['draft', 'active', 'paused'])

  if (disableError) throw disableError

  const { data: profileRecord, error: profileError } = await supabase
    .from('automation_profiles')
    .insert({
      user_id: userId,
      status: 'active',
      profile_json: profile,
      business_context: profile.business_context,
      global_settings: profile.global_settings,
      safety: profile.safety,
      activated_at: now,
    })
    .select('id')
    .single()

  if (profileError) throw profileError

  for (const category of profile.categories) {
    const draftEnabled = isAutomationCategoryDraftEnabled(category)
    const normalizedActions = {
      ...category.actions,
      draft: draftEnabled,
    }

    const { data: categoryRecord, error: categoryError } = await supabase
      .from('automation_categories')
      .insert({
        automation_profile_id: profileRecord.id,
        key: category.id,
        label: category.name,
        description: category.description,
        actions: normalizedActions,
        priority: category.priority,
        draft_reply_enabled: draftEnabled,
        telegram_notify: normalizedActions.telegram,
        archive_enabled: normalizedActions.archive,
      })
      .select('id')
      .single()

    if (categoryError) throw categoryError

    const label = labels.find((item) => item.name === category.gmail_label || item.name === category.name)
    const { error: mappingError } = await supabase.from('gmail_label_mappings').insert({
      user_id: userId,
      automation_category_id: categoryRecord.id,
      gmail_label_id: label?.id || null,
      gmail_label_name: label?.name || category.name,
      created_in_gmail: label?.mode === 'live',
    })

    if (mappingError) throw mappingError
  }

  await supabase.from('email_processing_logs').insert([
    {
      user_id: userId,
      automation_profile_id: profileRecord.id,
      status: 'configuration_ready',
      details: { message: 'Configuration Toolia prête.', categorySummary },
    },
    {
      user_id: userId,
      automation_profile_id: profileRecord.id,
      status: 'labels_prepared',
      details: { count: labels.length },
    },
  ])

  await supabase.from('audit_logs').insert({
    user_id: userId,
    actor: 'system',
    event: options.testMode ? 'automation_test_activated' : 'automation_activated',
    metadata: { labels_count: labels.length, mode: options.testMode ? 'test' : 'live', categorySummary },
  })

  if (options.testMode) {
    const { data: existingSubscription, error: subscriptionLookupError } = await supabase
      .from('subscriptions')
      .select('id, plan_id, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subscriptionLookupError) throw subscriptionLookupError

    if (existingSubscription?.id && !isPaidSubscriptionStatus(existingSubscription.status)) {
      const { error: subscriptionUpdateError } = await supabase
        .from('subscriptions')
        .update({ plan_id: 'starter', status: 'demo', updated_at: now })
        .eq('id', existingSubscription.id)

      if (subscriptionUpdateError) throw subscriptionUpdateError
    } else {
      const { error: subscriptionInsertError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: 'starter',
        status: 'demo',
      })

      if (subscriptionInsertError) throw subscriptionInsertError
    }
  }

  return {
    status: options.testMode ? ('active_test' as const) : ('active' as const),
    subscriptionStatus: options.testMode ? ('demo' as const) : ('active' as const),
    gmailConnected: false,
    labels,
    logs: [
      makeLog('Configuration Toolia prête.'),
      makeLog(`${labels.length} labels Gmail préparés.`),
      makeLog('Automatisation activée avec validation des brouillons avant envoi.'),
    ],
  }
}

export async function getWritingStyleProfile(userId: string): Promise<(WritingStyleProfile & { updated_at?: string }) | null> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('writing_style_profiles')
    .select(
      'sample_count, tone_summary, average_length, greeting_style, closing_style, signature_detected, formality_level, tutoiement_or_vouvoiement_preference, common_phrases, things_to_avoid, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) return null
    throw error
  }

  if (!data) return null

  return {
    sample_count: Number(data.sample_count || 0),
    tone_summary: String(data.tone_summary || ''),
    average_length:
      data.average_length === 'short' || data.average_length === 'long' ? data.average_length : 'medium',
    greeting_style: String(data.greeting_style || ''),
    closing_style: String(data.closing_style || ''),
    signature_detected: data.signature_detected ? String(data.signature_detected) : null,
    formality_level:
      data.formality_level === 'casual' || data.formality_level === 'formal' ? data.formality_level : 'balanced',
    tutoiement_or_vouvoiement_preference:
      data.tutoiement_or_vouvoiement_preference === 'tu' ||
      data.tutoiement_or_vouvoiement_preference === 'vous' ||
      data.tutoiement_or_vouvoiement_preference === 'mixed'
        ? data.tutoiement_or_vouvoiement_preference
        : 'unknown',
    common_phrases: Array.isArray(data.common_phrases) ? data.common_phrases.map(String).slice(0, 12) : [],
    things_to_avoid: Array.isArray(data.things_to_avoid) ? data.things_to_avoid.map(String).slice(0, 12) : [],
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
  }
}

export async function saveWritingStyleProfile(
  userId: string,
  profile: WritingStyleProfile,
): Promise<WritingStyleProfile & { updated_at: string }> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Configuration Supabase serveur incomplète.')

  const updatedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('writing_style_profiles')
    .upsert({
      user_id: userId,
      sample_count: profile.sample_count,
      tone_summary: profile.tone_summary,
      average_length: profile.average_length,
      greeting_style: profile.greeting_style,
      closing_style: profile.closing_style,
      signature_detected: profile.signature_detected,
      formality_level: profile.formality_level,
      tutoiement_or_vouvoiement_preference: profile.tutoiement_or_vouvoiement_preference,
      common_phrases: profile.common_phrases,
      things_to_avoid: profile.things_to_avoid,
      updated_at: updatedAt,
    })
    .select('updated_at')
    .single()

  if (error) throw error

  await supabase.from('audit_logs').insert({
    user_id: userId,
    actor: 'system',
    event: 'writing_style_profile_updated',
    metadata: {
      sample_count: profile.sample_count,
      formality_level: profile.formality_level,
      addressing: profile.tutoiement_or_vouvoiement_preference,
    },
  })

  return {
    ...profile,
    updated_at: String(data?.updated_at || updatedAt),
  }
}

export async function updateSupabaseAutomationStatus(userId: string, status: 'active' | 'active_test' | 'paused') {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const now = new Date().toISOString()
  const dbStatus = status === 'active_test' ? 'active' : status
  const { data: current, error: lookupError } = await supabase
    .from('automation_profiles')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (!current?.id) return null

  const { error: updateError } = await supabase
    .from('automation_profiles')
    .update({
      status: dbStatus,
      paused_at: status === 'paused' ? now : null,
      updated_at: now,
    })
    .eq('id', current.id)

  if (updateError) throw updateError

  await supabase.from('audit_logs').insert({
    user_id: userId,
    actor: 'user',
    event: status === 'paused' ? 'automation_paused' : status === 'active_test' ? 'automation_test_resumed' : 'automation_resumed',
    metadata: { mode: status === 'active_test' ? 'test' : 'live' },
  })

  return {
    status,
    logs: [makeLog(status === 'active' || status === 'active_test' ? 'Automatisation reprise.' : 'Automatisation mise en pause.')],
  }
}

export async function getPersistedSaasState(userId: string) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null

  const { data: activeSubscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: latestSubscription } = activeSubscription
    ? { data: null }
    : await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const subscription = activeSubscription || latestSubscription

  const { data: gmailConnection } = await supabase
    .from('gmail_connections')
    .select('connected_at, revoked_at, gmail_email, google_email, status, scopes, scope')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: profileRecord } = await supabase
    .from('automation_profiles')
    .select('id, status, profile_json')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: answerLog } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('event', 'onboarding_answers_saved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const answersResult = onboardingAnswersSchema.safeParse(
    (answerLog?.metadata as { answers?: unknown } | null | undefined)?.answers,
  )
  const profileResult = automationProfileSchema.safeParse(profileRecord?.profile_json)
  const profile = profileResult.success ? profileResult.data : null
  const answers = answersResult.success ? answersResult.data : null
  const paidSubscription = isPaidSubscriptionStatus(subscription?.status)
  const plan = paidSubscription ? planFromId(subscription?.plan_id, true) : null
  const styleProfile = await getWritingStyleProfile(userId)
  const subscriptionStatus = paidSubscription ? 'active' : subscription?.status === 'demo' ? 'demo' : 'inactive'
  const usage = await getMonthlyUsageSnapshot(userId).catch(() => null)
  const billing = paidSubscription ? await getStripeBillingStateForUser(userId).catch(() => null) : null
  const telegram = await getTelegramConnection(userId).catch(() => null)

  if (!profile || !profileRecord?.id) {
    const gmailConnected = Boolean(gmailConnection?.connected_at && !gmailConnection?.revoked_at && gmailConnection?.status !== 'disconnected')

    return {
      plan,
      answers,
      profile: null,
        styleProfile,
        usage,
        billing,
        telegram,
        dashboard: null,
      gmail: {
        connected: gmailConnected,
        googleEmail: gmailConnection?.google_email || gmailConnection?.gmail_email || null,
        hasComposeScope: hasComposeScope(gmailConnection),
        hasReadScope: hasReadScope(gmailConnection),
        hasModifyScope: hasModifyScope(gmailConnection),
        needsScopeUpgrade: gmailConnected && !hasModifyScope(gmailConnection),
      },
    }
  }

  const { data: categoryRows } = await supabase
    .from('automation_categories')
    .select('id')
    .eq('automation_profile_id', profileRecord.id)

  const categoryIds = (categoryRows || []).map((row) => row.id).filter(Boolean)
  const { data: labelRows } = categoryIds.length
    ? await supabase
        .from('gmail_label_mappings')
        .select('gmail_label_id, gmail_label_name, created_in_gmail')
        .eq('user_id', userId)
        .in('automation_category_id', categoryIds)
    : { data: [] }

  const { data: logRows } = await supabase
    .from('email_processing_logs')
    .select('id, created_at, status, details')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const labels: GmailLabelResult[] = (labelRows || []).map((row) => ({
    id: row.gmail_label_id || row.gmail_label_name,
    name: row.gmail_label_name,
    created: Boolean(row.created_in_gmail),
    mode: row.created_in_gmail ? 'live' : 'demo',
  }))

  const gmailConnected = Boolean(gmailConnection?.connected_at && !gmailConnection?.revoked_at && gmailConnection?.status !== 'disconnected')

  return {
    plan,
    answers,
    profile,
    styleProfile,
    usage,
    billing,
    gmail: {
      connected: gmailConnected,
      googleEmail: gmailConnection?.google_email || gmailConnection?.gmail_email || null,
      hasComposeScope: hasComposeScope(gmailConnection),
      hasReadScope: hasReadScope(gmailConnection),
      hasModifyScope: hasModifyScope(gmailConnection),
      needsScopeUpgrade: gmailConnected && !hasModifyScope(gmailConnection),
    },
    telegram,
    dashboard: {
      status:
        profileRecord.status === 'paused'
          ? 'paused'
          : subscriptionStatus === 'demo'
            ? 'active_test'
            : subscriptionStatus === 'active'
              ? 'active'
              : 'paused',
      subscriptionStatus,
      gmailConnected,
      labels: labels.length
        ? labels
        : profile.categories.map((category) => ({
            id: category.id,
            name: category.name,
            created: false,
            mode: 'demo' as const,
          })),
      draftTestCount: (logRows || []).filter((row) => row.status === 'ai_test_draft').length,
      logs: (logRows || []).map((row) => ({
        id: row.id,
        created_at: row.created_at,
        level: 'info' as const,
        message:
          typeof row.details?.message === 'string'
            ? row.details.message
            : row.status || 'Action Toolia enregistrée.',
      })),
    },
  }
}
