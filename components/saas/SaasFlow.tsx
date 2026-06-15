'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  Check,
  ChevronRight,
  Gauge,
  Mail,
  Pause,
  PencilLine,
  Play,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { getTooliaClientState } from '@/lib/saas/client-navigation'
import {
  categoryDescriptions,
  categoryLabels,
  defaultCategorySuggestions,
  telegramPreferences,
} from '@/lib/saas/schemas'
import type {
  AutomationProfile,
  CategoryActions,
  GmailLabelResult,
  LegacyAutomationAction,
  OnboardingAnswers,
} from '@/lib/saas/schemas'
import type { ProcessingLog } from '@/lib/saas/demo-store'
import {
  getPlanLimits,
  recommendPlan,
  type PlanLimits,
} from '@/lib/saas/plan-config'
import { findDraftConsistencyIssues } from '@/lib/saas/profile-consistency'
import { trackEvent } from '@/lib/analytics'

const storageKeys = {
  session: 'toolia_demo_session',
  plan: 'toolia_selected_plan',
  answers: 'toolia_onboarding_answers',
  gmail: 'toolia_gmail_connection',
  telegram: 'toolia_telegram_connection',
  profile: 'toolia_automation_profile',
  dashboard: 'toolia_dashboard_state',
  generationDone: 'toolia_generation_done',
  editMode: 'toolia_editing_automation',
}

const allowDemoMode = false

type DemoSession = {
  userId: string
  name: string
  email: string
  mode: 'demo' | 'account'
}

type ApiErrorResponse = {
  ok?: boolean
  step?: string
  message?: string
  error?:
    | string
    | {
        name?: string | null
        message?: string | null
        status?: number | string | null
        code?: string | null
        details?: string | null
        hint?: string | null
      }
  details?: string
}

type SignupResponse = ApiErrorResponse & {
  session?: DemoSession
  emailConfirmationRequired?: boolean
  authSession?: {
    access_token: string
    refresh_token: string
  } | null
}

type PlanOption = {
  id: 'starter' | 'essential' | 'pro' | 'premium'
  name: string
  price: string
  setup: string
  maxLabels: number
  description: string
  features: string[]
  featured?: boolean
  paid?: boolean
}

type DashboardState = {
  status: 'active' | 'active_test' | 'paused'
  subscriptionStatus: 'demo' | 'active' | 'inactive'
  gmailConnected: boolean
  labels: GmailLabelResult[]
  logs: ProcessingLog[]
  draftTestCount?: number
}

type BillingState = {
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  cancelAt: string | null
  scheduledChange: {
    type: 'plan_change' | 'cancellation'
    planId?: 'starter' | 'pro' | 'premium'
    planName?: string
    effectiveAt: string | null
  } | null
  nextEstimatedPaymentCents: number | null
}

type GmailConnectionState = {
  connected?: boolean
  mode?: 'test' | 'demo' | 'pending' | 'live'
  googleEmail?: string | null
  hasComposeScope?: boolean
  hasReadScope?: boolean
  hasModifyScope?: boolean
  needsScopeUpgrade?: boolean
  passwordRequestedByToolia?: boolean
}

type TelegramConnectionState = {
  connected?: boolean
  enabled?: boolean
  username?: string | null
  connectedAt?: string | null
  status?: string
}

type TelegramConnectState = {
  botLink: string
  botUsername?: string
  startCommand?: string
  qrCodeDataUrl: string
  expiresAt: string
}

type WritingStyleProfileState = {
  sample_count: number
  tone_summary: string
  average_length: 'short' | 'medium' | 'long'
  greeting_style: string
  closing_style: string
  signature_detected: string | null
  formality_level: 'casual' | 'balanced' | 'formal'
  tutoiement_or_vouvoiement_preference: 'tu' | 'vous' | 'mixed' | 'unknown'
  common_phrases: string[]
  things_to_avoid: string[]
  updated_at?: string
}

type AiProviderState = {
  configured?: boolean
  provider?: 'openrouter' | 'openai'
  model?: string
}

type UsageSnapshotState = {
  plan: 'starter' | 'pro' | 'premium'
  limits: PlanLimits
  current: {
    monthKey: string
    emailsAnalyzed: number
    emailsProcessed: number
    emailsAiAnalyzed: number
    aiDraftsCreated: number
    telegramAlertsSent: number
    styleAnalysesUsed: number
    creditsUsed: number
  }
  remaining: {
    emailAnalysis: number
    aiDraft: number
    telegramAlert: number
    styleAnalysis: number
  }
}

type ClassificationResultCard = {
  messageId: string
  threadId?: string | null
  sender: string
  subject: string
  category: string
  confidence: number
  importance: string
  status: 'processed' | 'needs_review' | 'skipped' | 'error'
  labelApplied: boolean
  draftCreated: boolean
  draftId: string | null
  reason: string
  skipReason?: string | null
  actionTaken: string
  threadContextUsed: boolean
  availableCategories: Array<{
    name: string
    description: string
    actions: string[]
  }>
  labelMappingStatus: 'verified' | 'created_or_verified' | 'missing' | 'not_needed'
  labelMappingWarning?: string | null
  previousCategory?: string | null
}

type ClassificationSummary = {
  analyzed: number
  labelsApplied: number
  draftsCreated: number
  needsReview: number
  skipped?: number
}

type WizardCategory = OnboardingAnswers['categories'][number]

type ClientActionKey = keyof CategoryActions

const actionLabels: Record<ClientActionKey, string> = {
  label: 'Label',
  draft: 'Brouillon',
  telegram: 'Telegram',
  archive: 'Archiver',
}

const actionHelp: Record<ClientActionKey, string> = {
  label: 'Toolia classe l’email dans ce label Gmail.',
  draft: 'Toolia prépare une réponse, mais ne l’envoie jamais sans validation.',
  telegram: 'Toolia vous envoie une alerte si cet email mérite votre attention.',
  archive: 'Toolia range l’email hors de la boîte de réception. Cette action ne se combine pas avec brouillon ou alerte.',
}

const actionOrder: ClientActionKey[] = ['label', 'draft', 'telegram', 'archive']

const toneLabels: Record<OnboardingAnswers['draftTone'], string> = {
  professionnel: 'Professionnel',
  chaleureux: 'Chaleureux',
  direct: 'Direct',
  premium: 'Premium',
}

const toneHelp: Record<OnboardingAnswers['draftTone'], string> = {
  professionnel: 'Clair, sérieux, adapté à la plupart des échanges.',
  chaleureux: 'Humain, amical et relationnel, tout en restant professionnel.',
  direct: 'Court, efficace, sans phrases inutiles.',
  premium: 'Plus soigné, idéal pour clients importants ou prestations haut de gamme.',
}

const sharedToneExampleEmail = `Bonjour,

Pouvez-vous me confirmer vos disponibilités cette semaine et m’indiquer les prochaines étapes pour avancer ?

Merci,
Marc`

const toneExamples: Record<OnboardingAnswers['draftTone'], string> = {
  professionnel: `Bonjour Marc,

Merci pour votre message.

Je reviens vers vous rapidement avec mes disponibilités pour cette semaine et les prochaines étapes à prévoir.

Cordialement,`,
chaleureux: `Bonjour Marc,

Merci beaucoup pour votre message, avec plaisir.

Je regarde mes disponibilités pour cette semaine et je reviens vers vous rapidement avec une proposition claire pour la suite.

Bonne journée,`,
  direct: `Bonjour Marc,

Merci pour votre message.

Je vous envoie mes disponibilités et les prochaines étapes dès que possible.

Cordialement,`,
  premium: `Bonjour Marc,

Merci pour votre retour.

Je vais vérifier mes disponibilités cette semaine et vous transmettre une proposition structurée avec les prochaines étapes pour avancer dans les meilleures conditions.

Bien cordialement,`,
}

function wantsTutoiement(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return /\b(tutoiement|tutoyer|tutoie|toujours tutoyer|parler en tu|repondre en tu|ecrire en tu)\b/.test(normalized)
}

function wantsVouvoiement(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return /\b(vouvoiement|vouvoyer|vouvoie|toujours vouvoyer|parler en vous|repondre en vous|ecrire en vous)\b/.test(normalized)
}

function getAddressingModeLabel(customInstructions: string, tone: OnboardingAnswers['draftTone']) {
  if (wantsTutoiement(customInstructions)) return 'Tutoiement'
  if (wantsVouvoiement(customInstructions)) return 'Vouvoiement'
  if (tone === 'professionnel' || tone === 'premium') return 'Vouvoiement'
  return 'Auto'
}

function getToneExample(tone: OnboardingAnswers['draftTone'], customInstructions: string) {
  if (tone === 'chaleureux' && wantsTutoiement(customInstructions)) {
    return `Bonjour Marc,

Merci beaucoup pour ton message, avec plaisir.

Je regarde mes disponibilités pour cette semaine et je te redis rapidement avec une proposition claire pour la suite.

Bonne journée,`
  }

  return toneExamples[tone]
}

const telegramLabels: Record<OnboardingAnswers['telegramPreference'], string> = {
  none: 'Désactivé',
  important_only: 'Alertes urgentes uniquement',
  all_selected: 'Alertes pour certaines catégories',
}

const telegramHelp: Record<OnboardingAnswers['telegramPreference'], string> = {
  none: 'Telegram est désactivé. Vous ne recevrez aucune alerte.',
  important_only: 'Toolia vous prévient seulement pour les emails vraiment urgents.',
  all_selected: 'Toolia vous alerte uniquement pour les catégories où vous avez activé Telegram.',
}

const generationSteps = [
  'Analyse de vos réponses',
  'Préparation des labels Gmail',
  'Création des règles de tri',
  'Préparation des brouillons',
  'Vérification finale',
]

const emailVolumeRequiredMessage = 'Indiquez le nombre moyen d’emails reçus par jour.'
const emailVolumeBelowRangeMessage =
  'Vous avez sélectionné + de 100 emails/jour, mais le nombre saisi doit être supérieur à 100. Corrigez le volume ou choisissez une autre tranche.'

const rawPlanOptions: PlanOption[] = [
  {
    id: 'essential',
    name: 'Essentiel',
    price: '29 €/mois',
    setup: '49 € setup',
    maxLabels: 5,
    description: 'Pour démarrer avec une automatisation Gmail simple et maîtrisée.',
    features: ['5 labels Gmail', '1 500 emails traités/mois', '100 brouillons IA/mois', 'Traitement automatique toutes les 30 min minimum', 'Telegram non inclus'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '69 €/mois',
    setup: '99 € setup',
    maxLabels: 12,
    description: 'Pour indépendants et petites équipes qui vivent dans Gmail.',
    features: ['12 labels Gmail', '4 000 emails traités/mois', '400 brouillons IA/mois', 'Alertes Telegram par catégorie', 'Traitement automatique toutes les 10 min minimum'],
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '129 €/mois',
    setup: '199 € setup',
    maxLabels: 25,
    description: 'Pour volumes plus élevés et besoin de suivi plus rapide.',
    features: ['25 catégories personnalisées', '10 000 emails traités/mois', '1 200 brouillons IA/mois', 'Telegram avancé inclus', 'Traitement automatique toutes les 5 min minimum'],
  },
]

const planOptions: PlanOption[] = rawPlanOptions.map((plan) => {
  if (plan.id === 'essential') {
    return {
      ...plan,
      id: 'starter',
      name: 'Starter',
      price: '29 €/mois',
      setup: '49 € setup',
      description: 'Pour démarrer avec une automatisation Gmail simple et maîtrisée.',
      features: ['5 labels Gmail', '1 500 emails traités/mois', '100 brouillons IA/mois', '1 analyse de style/mois', 'Traitement automatique toutes les 30 min minimum', 'Telegram non inclus'],
    }
  }

  if (plan.id === 'pro') {
    return {
      ...plan,
      price: '69 €/mois',
      setup: '99 € setup',
      description: 'Pour indépendants et petites équipes qui vivent dans Gmail.',
      features: ['12 labels Gmail', '4 000 emails traités/mois', '400 brouillons IA/mois', 'Alertes Telegram par catégorie', 'Traitement automatique toutes les 10 min minimum'],
    }
  }

  return {
    ...plan,
    price: '129 €/mois',
    setup: '199 € setup',
    description: 'Pour volumes plus élevés et besoin de suivi plus rapide.',
    features: ['25 catégories personnalisées', '10 000 emails traités/mois', '1 200 brouillons IA/mois', 'Telegram avancé inclus', 'Traitement automatique toutes les 5 min minimum'],
  }
})

const analyticsPlanDetails: Record<'starter' | 'pro' | 'premium', { setup_price: number; monthly_price: number }> = {
  starter: { setup_price: 49, monthly_price: 29 },
  pro: { setup_price: 99, monthly_price: 69 },
  premium: { setup_price: 199, monthly_price: 129 },
}

const onboardingStepAnalytics = ['objective', 'context', 'volume', 'labels', 'actions'] as const

function planAnalyticsParams(plan: Pick<PlanOption, 'id'> | null | undefined) {
  const planId = plan?.id === 'essential' ? 'starter' : plan?.id
  if (planId !== 'starter' && planId !== 'pro' && planId !== 'premium') return {}

  return {
    plan: planId,
    ...analyticsPlanDetails[planId],
  }
}

function customLabelCount(categories: Array<{ key: string }>) {
  return categories.filter((category) => category.key.startsWith('custom_')).length
}

function normalizePersistedPlan(plan: Partial<PlanOption> | null | undefined) {
  if (!plan?.id) return null

  const normalizedId = plan.id === 'essential' ? 'starter' : plan.id
  const defaults = planOptions.find((option) => option.id === normalizedId)
  if (!defaults) return null

  return { ...plan, ...defaults, id: normalizedId, paid: plan.paid }
}

function getPlanOptionById(planId: string | null | undefined) {
  if (!planId) return null
  const normalizedId = planId === 'essential' ? 'starter' : planId
  return planOptions.find((option) => option.id === normalizedId) || null
}

function getPlanIdFromUrl() {
  if (typeof window === 'undefined') return null
  const planId = new URLSearchParams(window.location.search).get('plan')
  return getPlanOptionById(planId)?.id || null
}

function persistSelectedPlanById(planId: string | null | undefined) {
  const plan = getPlanOptionById(planId)
  if (!plan) return null

  const nextPlan = { ...plan, paid: false }
  writeStorage(storageKeys.plan, nextPlan)
  return nextPlan
}

function planRank(planId: PlanOption['id'] | string | null | undefined) {
  if (planId === 'premium') return 2
  if (planId === 'pro') return 1
  return 0
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
}

function removeStorage(key: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(key)
  }
}

function makeUserId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `demo_${Date.now()}`
}

function getSession(): DemoSession | null {
  const existing = readStorage<DemoSession | null>(storageKeys.session, null)
  if (existing?.userId) return existing

  return null
}

function getStoredPlan() {
  return readStorage<PlanOption | null>(storageKeys.plan, null)
}

function isDemoSession(session: DemoSession | null) {
  return allowDemoMode && session?.mode === 'demo'
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function hasValidSession(session: DemoSession | null) {
  if (!session) return false
  if (session.mode === 'demo') return allowDemoMode

  return session.name.trim().length > 1 && isValidEmail(session.email)
}

function sessionFromAuthUser(user: User): DemoSession | null {
  if (!user.id || !user.email) return null

  const metadata = user.user_metadata as { full_name?: string; name?: string }
  return {
    userId: user.id,
    name: metadata.full_name || metadata.name || user.email.split('@')[0],
    email: user.email,
    mode: 'account',
  }
}

const writingPreferenceLabels: Record<WritingStyleProfileState['tutoiement_or_vouvoiement_preference'], string> = {
  tu: 'Tutoiement',
  vous: 'Vouvoiement',
  mixed: 'Mixte',
  unknown: 'Non détecté',
}

async function getSupabaseAccessToken() {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

function getPasswordResetRedirectTo() {
  if (typeof window === 'undefined') return '/reset-password'

  return `${window.location.origin}/reset-password`
}

async function startGoogleOAuth(returnTo: 'dashboard' | 'onboarding', options?: { forceConsent?: boolean }) {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('Connectez-vous avant de connecter Gmail.')

  const params = new URLSearchParams({
    from: returnTo,
    response: 'json',
  })
  if (options?.forceConsent) params.set('force', '1')

  const url = `/api/google/oauth/start?${params.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await readJsonResponse<{
    ok?: boolean
    authorizationUrl?: string
    redirectTo?: string
    message?: string
  }>(response, url)

  if (!response.ok || !data.ok) {
    throw new Error(data.message || 'Connexion Gmail impossible.')
  }

  window.location.href = data.authorizationUrl || data.redirectTo || '/dashboard'
}

async function syncTooliaProfile(session: DemoSession) {
  if (session.mode !== 'account') return

  const token = await getSupabaseAccessToken()
  const response = await fetch('/api/account/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      userId: session.userId,
      name: session.name,
      email: session.email,
    }),
  })
  const data = await readJsonResponse<ApiErrorResponse & { ok?: boolean }>(response, '/api/account/profile')

  if (!response.ok || !data.ok) {
    throw new Error(formatApiError(data))
  }

  return data
}

async function getSupabaseSessionFromBrowser(): Promise<DemoSession | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  const session = !error && data.user ? sessionFromAuthUser(data.user) : null
  if (!session) return null

  writeStorage(storageKeys.session, session)
  return session
}

async function resolveSession() {
  const supabaseSession = await getSupabaseSessionFromBrowser()
  if (hasValidSession(supabaseSession)) return supabaseSession

  const existing = getSession()
  if (existing?.mode === 'demo' && hasValidSession(existing)) return existing

  removeStorage(storageKeys.session)
  return null
}

async function persistPlanForSession(session: DemoSession | null, plan: PlanOption) {
  if (session?.mode !== 'account') return
  const token = await getSupabaseAccessToken()
  if (!token) return

  await fetch('/api/account/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  }).catch(() => null)
}

async function persistOnboardingForSession(session: DemoSession | null, answers: OnboardingAnswers) {
  if (session?.mode !== 'account') return
  const token = await getSupabaseAccessToken()
  if (!token) return

  await fetch('/api/account/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answers }),
  }).catch(() => null)
}

async function loadPersistedState(session: DemoSession | null) {
  if (session?.mode !== 'account') return null
  const token = await getSupabaseAccessToken()
  if (!token) return null

  const response = await fetch('/api/account/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  }).catch(() => null)

  if (!response?.ok) return null
  return response.json() as Promise<{
    ok: boolean
    plan?: Partial<PlanOption> | null
    answers?: OnboardingAnswers | null
    profile?: AutomationProfile | null
    styleProfile?: WritingStyleProfileState | null
    usage?: UsageSnapshotState | null
    billing?: BillingState | null
    dashboard?: DashboardState | null
    gmail?: GmailConnectionState | null
    telegram?: TelegramConnectionState | null
    ai?: AiProviderState | null
  }>
}

async function readJsonResponse<T>(response: Response, url: string): Promise<T> {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text()
    const preview = text.slice(0, 300)
    console.error('[signup] Réponse non JSON', {
      url,
      status: response.status,
      preview,
    })
    throw new Error("Le serveur a renvoyé une page HTML au lieu d'une réponse JSON.")
  }

  return response.json() as Promise<T>
}

function formatApiError(data: ApiErrorResponse) {
  if (data.error && typeof data.error === 'object') {
    if (data.error.message?.toLowerCase().includes('un compte existe')) {
      return 'Un compte existe déjà avec cet email. Connectez-vous.'
    }

    if (
      data.error.status === 429 ||
      data.error.status === '429' ||
      data.error.message?.toLowerCase().includes('trop de tentatives') ||
      data.error.message?.toLowerCase().includes('rate limit')
    ) {
      return 'Trop de tentatives. Attendez quelques minutes avant de réessayer.'
    }

    const parts = [
      data.step ? `Étape ${data.step}` : null,
      data.error.message || data.message || 'Erreur Supabase inconnue.',
      data.error.code ? `code ${data.error.code}` : null,
      data.error.status ? `status ${data.error.status}` : null,
    ].filter(Boolean)
    const details =
      process.env.NODE_ENV !== 'production' && data.error.details
        ? ` Détails: ${data.error.details}`
        : ''

    return `${parts.join(' — ')}${details}`
  }

  const parts = [
    data.step ? `Étape ${data.step}` : null,
    data.message || data.error || 'Création de compte impossible.',
  ].filter(Boolean)
  const details =
    process.env.NODE_ENV !== 'production' && data.details
      ? ` Détails: ${data.details}`
      : ''

  return `${parts.join(' — ')}${details}`
}

function StatusPill({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    success: 'border-toolia-success/40 bg-toolia-success/10 text-toolia-success',
    warning: 'border-toolia-warning/40 bg-toolia-warning/10 text-toolia-warning',
    danger: 'border-toolia-danger/40 bg-toolia-danger/10 text-toolia-danger',
    info: 'border-toolia-info/40 bg-toolia-info/10 text-toolia-text',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

function DemoNotice() {
  return null
}

function SaasShell({
  eyebrow,
  title,
  description,
  children,
  showDemoNotice = false,
  displayTitle = false,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  showDemoNotice?: boolean
  displayTitle?: boolean
}) {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/70 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">{eyebrow}</p>
          <h1 className={`${displayTitle ? 'font-heading font-extrabold tracking-[-0.035em]' : 'font-bold'} text-3xl leading-tight text-toolia-text md:text-5xl`}>
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-toolia-text-secondary md:text-lg">{description}</p>
        </div>
        {showDemoNotice && <DemoNotice />}
        {children}
      </div>
    </section>
  )
}

function AppCard({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`rounded-card border border-toolia-border-subtle bg-gradient-to-br from-toolia-card to-toolia-gradient-dark/20 p-6 shadow-soft ${className}`}>
      {children}
    </div>
  )
}

function NeutralLoadingState({
  title = 'Chargement de votre espace Toolia...',
  description = 'Synchronisation de votre statut, de votre offre et de votre configuration.',
}: {
  title?: string
  description?: string
}) {
  return (
    <AppCard>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 animate-pulse rounded-full border border-toolia-info/30 bg-toolia-info/10" />
          <div>
            <h2 className="text-2xl font-bold text-toolia-text">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-toolia-text-secondary">{description}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
              <div className="h-3 w-24 animate-pulse rounded-full bg-toolia-text-muted/20" />
              <div className="mt-4 h-8 w-32 animate-pulse rounded-full bg-toolia-text-muted/15" />
            </div>
          ))}
        </div>
      </div>
    </AppCard>
  )
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-toolia-text-secondary">{children}</p>
}

const authShellClass =
  'toolia-auth-shell relative isolate overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_90px_rgba(22,34,74,0.10)] backdrop-blur-xl dark:border-toolia-border-subtle dark:bg-slate-900/70 sm:p-6 lg:p-10'
const authPanelClass =
  'toolia-auth-panel rounded-[28px] border border-slate-200/90 bg-white/95 p-5 shadow-[0_22px_70px_rgba(22,34,74,0.12)] dark:border-toolia-border-subtle dark:bg-slate-950/60 sm:p-7 md:p-8'
const authInputClass =
  'toolia-auth-input rounded-[18px] border border-slate-200 bg-white/90 px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-toolia-border-subtle dark:bg-white/5 dark:text-toolia-text dark:placeholder:text-toolia-text-muted/75 dark:focus:border-toolia-primary dark:focus:bg-toolia-card dark:focus:ring-toolia-info/10'
const authLabelClass = 'flex flex-col gap-2 text-sm font-medium text-slate-900 dark:text-toolia-text'
const authMutedCardClass =
  'toolia-auth-muted-card flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-slate-700 dark:border-toolia-border-subtle dark:bg-white/5 dark:text-toolia-text-secondary'
const authLinkClass =
  'toolia-auth-link font-semibold text-blue-700 underline-offset-4 transition hover:text-blue-900 hover:underline dark:text-toolia-text dark:hover:text-white'
const authDisabledButtonClass =
  'mt-1 w-full disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-100 dark:disabled:bg-slate-700 dark:disabled:text-white dark:disabled:opacity-70'

function NextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-btn bg-toolia-primary px-5 py-3 text-sm font-semibold text-white shadow-btn-primary transition hover:-translate-y-0.5 hover:bg-toolia-primary-light"
    >
      {children}
      <ChevronRight size={16} />
    </Link>
  )
}

async function createStripePortalUrl() {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('Connectez-vous pour gérer votre abonnement.')

  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await readJsonResponse<{ ok?: boolean; url?: string; message?: string }>(
    response,
    '/api/stripe/portal',
  )

  if (!response.ok || !data.ok || !data.url) {
    throw new Error(data.message || 'Le portail de gestion Stripe n’est pas encore configuré.')
  }

  return data.url
}

function StripePortalButton({
  label = 'Gérer la facturation',
  variant = 'outline',
}: {
  label?: string
  variant?: React.ComponentProps<typeof Button>['variant']
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openPortal = async () => {
    setError('')
    setLoading(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous pour gérer votre abonnement.')

      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJsonResponse<{ ok?: boolean; url?: string; message?: string }>(
        response,
        '/api/stripe/portal',
      )

      if (!response.ok || !data.ok || !data.url) {
        throw new Error(data.message || 'Le portail de gestion Stripe n’est pas encore configuré.')
      }

      window.location.href = data.url
    } catch (portalError) {
      setError(
        portalError instanceof Error
          ? portalError.message
          : 'Le portail de gestion Stripe n’est pas encore configuré.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variant} size="sm" onClick={() => void openPortal()} isLoading={loading}>
        {loading ? 'Ouverture du portail...' : label}
      </Button>
      {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}
    </div>
  )
}

function PlanUpgradeButton({
  plan,
  subscriptionStatus,
  billing,
}: {
  plan: PlanOption | null
  subscriptionStatus?: DashboardState['subscriptionStatus'] | null
  billing?: BillingState | null
}) {
  if (subscriptionStatus === 'active' && plan?.paid) {
    const scheduledDate = formatFrenchDate(billing?.scheduledChange?.effectiveAt || billing?.currentPeriodEnd)
    const nextPayment = billing?.nextEstimatedPaymentCents
      ? formatEuroCents(billing.nextEstimatedPaymentCents)
      : null

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-toolia-success">
          {plan.id === 'premium' ? 'Offre Premium active' : `Offre ${plan.name} active`}
        </p>
        {billing?.scheduledChange?.type === 'plan_change' && billing.scheduledChange.planName && (
          <div className="rounded-card border border-toolia-info/30 bg-toolia-info/10 p-3 text-xs leading-relaxed text-toolia-text-secondary">
            <p className="font-semibold text-toolia-text">
              Passage à {billing.scheduledChange.planName} prévu{scheduledDate ? ` le ${scheduledDate}` : ''}.
            </p>
            <p>Vous conservez les fonctionnalités {plan.name} jusqu’à cette date.</p>
          </div>
        )}
        {billing?.scheduledChange?.type === 'cancellation' && (
          <div className="rounded-card border border-toolia-warning/30 bg-toolia-warning/10 p-3 text-xs leading-relaxed text-toolia-text-secondary">
            <p className="font-semibold text-toolia-text">
              Résiliation prévue{scheduledDate ? ` le ${scheduledDate}` : ''}.
            </p>
            <p>Votre accès reste actif jusqu’à la fin de la période payée.</p>
          </div>
        )}
        {nextPayment && (
          <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-3 text-xs leading-relaxed text-toolia-text-secondary">
            <p className="font-semibold text-toolia-text">Prochain paiement estimé : {nextPayment}</p>
            <p>Ce montant peut inclure un ajustement Stripe lié à un changement d’offre.</p>
          </div>
        )}
        {plan.id !== 'premium' && (
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-btn border border-toolia-primary/50 px-4 py-2 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary"
          >
            Changer d’offre
          </Link>
        )}
        <StripePortalButton label="Gérer la facturation" />
        <p className="text-xs leading-relaxed text-toolia-text-secondary">
          Les changements d’offre, les annulations et les moyens de paiement se gèrent via Stripe.
        </p>
      </div>
    )
  }

  return (
    <Link
      href="/pricing"
      className="inline-flex items-center justify-center rounded-btn border border-toolia-primary/50 px-4 py-2 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary"
    >
      Améliorer mon offre
    </Link>
  )
}

function UsageBar({
  label,
  value,
  limit,
}: {
  label: string
  value: number
  limit: number
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0
  const isExceeded = limit > 0 && value >= limit

  return (
    <div className="rounded-card bg-toolia-card-hover p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-toolia-text">{label}</p>
        <p className="text-sm text-toolia-text-secondary">{value} / {limit}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-toolia-bg-secondary">
        <div
          className={`h-full rounded-full ${isExceeded ? 'bg-toolia-danger' : percent >= 80 ? 'bg-toolia-warning' : 'bg-toolia-info'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function makeInitialCategories(): WizardCategory[] {
  const selectedDefaults = new Set(['clients', 'prospects', 'factures', 'urgences', 'administratif'])

  return defaultCategorySuggestions.map((key) => {
    let actions: CategoryActions = { label: true, draft: false, telegram: false, archive: false }
    if (key === 'clients' || key === 'prospects' || key === 'sav') {
      actions = { label: true, draft: true, telegram: false, archive: false }
    }
    if (key === 'urgences') {
      actions = { label: true, draft: false, telegram: true, archive: false }
    }
    if (key === 'newsletters' || key === 'publicites') {
      actions = { label: false, draft: false, telegram: false, archive: true }
    }

    return {
      key,
      label: categoryLabels[key],
      selected: selectedDefaults.has(key),
      description: categoryDescriptions[key],
      exampleEmail: '',
      actions,
    }
  })
}

function actionsFromLegacy(action: LegacyAutomationAction | string): CategoryActions {
  const legacyReviewAction = 'human' + '_review'
  const legacyReviewLabel = 'validation' + '_humaine'
  if (action === legacyReviewAction || action === legacyReviewLabel) {
    return { label: true, draft: false, telegram: false, archive: false }
  }

  if (action === 'archive') return { label: false, draft: false, telegram: false, archive: true }
  if (action === 'draft_reply') return { label: true, draft: true, telegram: false, archive: false }
  if (action === 'notify_telegram') return { label: true, draft: false, telegram: true, archive: false }
  return { label: true, draft: false, telegram: false, archive: false }
}

function normalizeActions(actions?: Partial<CategoryActions> | null, legacyAction?: string): CategoryActions {
  if (!actions) return actionsFromLegacy(legacyAction || 'label_only')
  if (actions.archive) return { label: false, draft: false, telegram: false, archive: true }

  return {
    label: actions.label ?? true,
    draft: actions.draft ?? false,
    telegram: actions.telegram ?? false,
    archive: false,
  }
}

function normalizeProfile(profile: AutomationProfile | null): AutomationProfile | null {
  if (!profile) return null

  return {
    ...profile,
    categories: profile.categories.map((category) => ({
      ...category,
      actions: normalizeActions(category.actions, (category as unknown as { action?: string }).action),
    })),
  }
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function actionsFromProfileCategory(category: AutomationProfile['categories'][number]): CategoryActions {
  const actions = normalizeActions(category.actions, (category as unknown as { action?: string }).action)
  if (category.draft_reply.enabled && !actions.archive) {
    return { ...actions, label: true, draft: true }
  }
  return actions
}

function emailVolumeFromProfile(profile: AutomationProfile, fallback?: OnboardingAnswers['emailVolume']): OnboardingAnswers['emailVolume'] {
  const volume = profile.business_context.email_volume
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (volume.includes('100') && (volume.includes('plus') || volume.includes('+'))) return '100_plus'
  if (volume.includes('50') && volume.includes('100')) return '50_100'
  if (volume.includes('20') && volume.includes('50')) return '20_50'
  if (volume.includes('20')) return 'moins_20'
  return fallback || '20_50'
}

function draftToneFromProfile(profile: AutomationProfile, fallback?: OnboardingAnswers['draftTone']): OnboardingAnswers['draftTone'] {
  const tone = profile.global_settings.default_tone
  if (tone === 'professionnel' || tone === 'chaleureux' || tone === 'direct' || tone === 'premium') return tone
  return fallback || 'professionnel'
}

function answersFromProfile(profile: AutomationProfile, fallback?: OnboardingAnswers | null): OnboardingAnswers {
  const defaults = makeInitialCategories().map((category) => ({ ...category, selected: false }))
  const profileById = new Map(profile.categories.map((category) => [category.id, category]))
  const profileByLabel = new Map(profile.categories.map((category) => [normalizeName(category.name), category]))
  const usedProfileCategoryIds = new Set<string>()

  const categories = defaults.map((category) => {
    const profileCategory = profileById.get(category.key) || profileByLabel.get(normalizeName(category.label))
    if (!profileCategory) return category
    usedProfileCategoryIds.add(profileCategory.id)

    return {
      ...category,
      selected: true,
      label: profileCategory.name,
      description: profileCategory.description,
      actions: actionsFromProfileCategory(profileCategory),
    }
  })

  for (const profileCategory of profile.categories) {
    if (usedProfileCategoryIds.has(profileCategory.id)) continue
    categories.push({
      key: profileCategory.id || `custom_${profileCategory.name}`,
      label: profileCategory.name,
      selected: true,
      description: profileCategory.description,
      exampleEmail: '',
      actions: actionsFromProfileCategory(profileCategory),
    })
  }

  const storedTelegramPreference =
    (profile.global_settings as AutomationProfile['global_settings'] & {
      telegram_preference?: OnboardingAnswers['telegramPreference']
    }).telegram_preference
  const telegramPreference: OnboardingAnswers['telegramPreference'] =
    storedTelegramPreference === 'none' ||
    storedTelegramPreference === 'important_only' ||
    storedTelegramPreference === 'all_selected'
      ? storedTelegramPreference
      : !profile.global_settings.telegram_enabled
        ? 'none'
        : profile.categories.some((category) => category.actions.telegram)
          ? 'all_selected'
          : 'important_only'

  return {
    mainGoal: profile.business_context.main_goal || fallback?.mainGoal || 'Gagner du temps sans manquer les emails importants',
    businessContext:
      profile.business_context.business_description ||
      fallback?.businessContext ||
      'Activité de service avec clients, prospects et factures à traiter chaque semaine.',
    emailVolume: emailVolumeFromProfile(profile, fallback?.emailVolume),
    estimatedDailyEmailCount:
      profile.business_context.estimated_daily_email_count ||
      fallback?.estimatedDailyEmailCount ||
      null,
    categories,
    draftTone: draftToneFromProfile(profile, fallback?.draftTone),
    customDraftInstructions:
      profile.global_settings.custom_draft_instructions ||
      fallback?.customDraftInstructions ||
      '',
    telegramPreference,
    automationLevel: 'balanced',
  }
}

function selectedActionLabels(actions: CategoryActions) {
  return actionOrder
    .filter((action) => actions[action])
    .map((action) => actionLabels[action])
    .join(' + ')
}

function profileLabels(profile: AutomationProfile) {
  return profile.categories.map((category) => category.gmail_label.replace(/^Toolia\//, ''))
}

function summarySafetyItems() {
  return [
    'Toolia ne demande jamais votre mot de passe Gmail.',
    'Les réponses préparées restent des brouillons à valider.',
    'Les emails ne sont jamais supprimés définitivement.',
    'Vous pouvez mettre l’automatisation en pause à tout moment.',
  ]
}

function ActionToggles({
  actions,
  telegramDisabled,
  telegramDisabledReason,
  onChange,
}: {
  actions: CategoryActions
  telegramDisabled: boolean
  telegramDisabledReason?: string
  onChange: (action: ClientActionKey, checked: boolean) => void
}) {
  const normalized = normalizeActions(actions)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {actionOrder.map((action) => {
          const disabled =
            action === 'label' ||
            (normalized.archive && (action === 'draft' || action === 'telegram')) ||
            (telegramDisabled && action === 'telegram')
          const checked =
            action === 'label'
              ? normalized.label && !normalized.archive
              : action === 'telegram' && telegramDisabled
                ? false
                : normalized[action]

          return (
            <label
              key={action}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                checked
                  ? 'border-toolia-primary bg-toolia-primary/20 text-toolia-text'
                  : 'border-toolia-border-subtle bg-toolia-card text-toolia-text-secondary'
              } ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-toolia-primary'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(action, event.target.checked)}
                className="h-4 w-4 accent-toolia-primary"
              />
              {actionLabels[action]}
            </label>
          )
        })}
      </div>
      <div className="grid gap-2">
        {actionOrder.map((action) => (
          <p key={action} className="text-xs leading-relaxed text-toolia-text-secondary">
            <span className="font-semibold text-toolia-text">{actionLabels[action]} :</span>{' '}
            {action === 'telegram' && telegramDisabled
              ? telegramDisabledReason || 'Telegram est désactivé dans les réglages globaux.'
              : actionHelp[action]}
          </p>
        ))}
      </div>
    </div>
  )
}

export function SignupClient() {
  const router = useRouter()
  const signupStartedTracked = useRef(false)
  const [checkingAccount, setCheckingAccount] = useState(true)
  const [sessionCheckMessage, setSessionCheckMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)


  useEffect(() => {
    let active = true
    let timedOut = false

    if (!signupStartedTracked.current) {
      signupStartedTracked.current = true
      trackEvent('signup_started')
    }

    const selectedPlanId = getPlanIdFromUrl()
    if (selectedPlanId) {
      persistSelectedPlanById(selectedPlanId)
    }

    const timeout = window.setTimeout(() => {
      timedOut = true
      if (!active) return
      setSessionCheckMessage('Connectez-vous ou créez un compte pour continuer avec cette offre.')
      setCheckingAccount(false)
    }, 4500)

    async function redirectLoggedInUser() {
      try {
        const state = await getTooliaClientState()
        if (!active || timedOut) return

        if (state.isLoggedIn) {
          router.replace(selectedPlanId ? `/pricing?plan=${selectedPlanId}` : state.targetPath)
          return
        }

        setCheckingAccount(false)
      } catch {
        if (!active || timedOut) return
        setSessionCheckMessage('Connectez-vous ou créez un compte pour continuer avec cette offre.')
        setCheckingAccount(false)
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void redirectLoggedInUser()

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [router])

  const startFlow = async (mode: DemoSession['mode']) => {
    setError('')
    setSuccess('')

    if (mode === 'demo') {
      const session: DemoSession = {
        userId: 'demo-user',
        name: 'Test Toolia',
        email: 'demo@toolia.test',
        mode,
      }

      writeStorage(storageKeys.session, session)
      router.push('/pricing')
      return
    }

    if (!canCreateAccount) return
    setLoading(true)

    try {
      const signupUrl = '/api/account/signup'
      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await readJsonResponse<SignupResponse>(response, signupUrl)

      if (!response.ok || !data.ok || !data.session) {
        const details = formatApiError(data)
        throw new Error(details)
      }

      if (data.authSession) {
        const supabase = getSupabaseBrowserClient()
        await supabase?.auth.setSession(data.authSession)
      }

      trackEvent('signup_completed')
      writeStorage(storageKeys.session, data.session)
      if (data.emailConfirmationRequired) {
        setSuccess(data.message || 'Compte créé. Vérifiez votre email si Supabase demande une confirmation.')
        if (!data.authSession) {
          window.setTimeout(() => router.push('/login'), 1800)
          return
        }

        window.setTimeout(() => router.push('/pricing'), 1200)
        return
      }

      router.push('/pricing')
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Création de compte impossible.')
    } finally {
      setLoading(false)
    }
  }

  const passwordMismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation
  const canCreateAccount =
    name.trim().length > 1 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    password === passwordConfirmation
  const accountAlreadyExistsError = error.toLowerCase().includes('compte existe')

  if (checkingAccount) {
    return (
      <SaasShell
        eyebrow="Compte"
        title="Chargement de votre espace"
        description="Toolia vérifie votre session avant de continuer."
      >
        <AppCard>
          <p className="text-toolia-text-secondary">Préparation de votre espace...</p>
        </AppCard>
      </SaasShell>
    )
  }

  return (
    <SaasShell
      eyebrow="Compte"
      title="Lancez votre espace Toolia"
      description="Créez votre compte pour choisir votre offre, configurer Toolia et connecter Gmail en toute sécurité."
      displayTitle
    >
      <div className={authShellClass}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-toolia-info/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-8 h-80 w-80 rounded-full bg-toolia-primary/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-xl">
            <StatusPill tone="success">Espace client sécurisé</StatusPill>
            <h2 className="font-heading mt-5 text-3xl font-extrabold leading-tight tracking-[-0.035em] text-toolia-text md:text-4xl">
              Créez votre compte, gardez le contrôle.
            </h2>
            <p className="mt-4 text-base leading-8 text-toolia-text-secondary">
              Toolia prépare votre espace avant la connexion Gmail. Vous choisissez votre offre, vous configurez vos règles, puis rien n’est envoyé sans votre validation.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-toolia-text-secondary">
              {[
                'Paiement sécurisé via Stripe.',
                'Connexion Gmail contrôlée par Google.',
                'Aucun email envoyé automatiquement.',
              ].map((item) => (
                <div key={item} className={authMutedCardClass}>
                  <span className="flex h-2.5 w-2.5 rounded-full bg-toolia-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-2xl">
            {sessionCheckMessage && (
              <div className="mb-5 rounded-[24px] border border-toolia-info/25 bg-toolia-info/10 p-4">
                <p className="text-sm font-medium text-toolia-text">{sessionCheckMessage}</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button type="button" onClick={() => setSessionCheckMessage('')}>
                    Créer un compte
                  </Button>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-btn border border-toolia-border-subtle bg-toolia-card px-5 py-3 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary"
                  >
                    Se connecter
                  </Link>
                </div>
              </div>
            )}

            <div className={authPanelClass}>
              <div className="mb-7">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Compte Toolia</p>
                <h3 className="mt-3 text-2xl font-bold text-toolia-text">Créer mon espace Toolia</h3>
                <HelperText>
                  Renseignez vos accès Toolia. La connexion Gmail se fera ensuite depuis Google, jamais avec votre mot de passe Gmail.
                </HelperText>
              </div>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (canCreateAccount) {
                trackEvent('cta_click', {
                  cta_location: 'signup',
                  cta_label: 'Créer mon espace Toolia',
                })
                void startFlow('account')
              }
            }}
          >
            <label className={authLabelClass}>
              Nom
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={authInputClass}
                placeholder="Votre nom"
              />
            </label>
            <label className={authLabelClass}>
              Email professionnel
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={authInputClass}
                placeholder="vous@entreprise.com"
                type="email"
              />
            </label>
            <label className={authLabelClass}>
              Mot de passe
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={authInputClass}
                placeholder="Minimum 8 caractères"
                type="password"
                autoComplete="new-password"
              />
            </label>
            <label className={authLabelClass}>
              Confirmer le mot de passe
              <input
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                className={authInputClass}
                placeholder="Retapez votre mot de passe"
                type="password"
                autoComplete="new-password"
              />
            </label>
            {password.length > 0 && password.length < 8 && (
              <p className="text-sm text-toolia-text-secondary">Le mot de passe doit contenir au moins 8 caractères.</p>
            )}
            {passwordMismatch && (
              <p className="text-sm font-medium text-toolia-danger">Les mots de passe ne correspondent pas.</p>
            )}
            {success && <p className="text-sm font-medium text-toolia-success">{success}</p>}
            {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}
            {accountAlreadyExistsError && (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-btn border border-toolia-primary/35 bg-toolia-primary/10 px-4 py-3 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary hover:bg-toolia-primary/15"
              >
                Ce compte existe déjà. Se connecter
              </Link>
            )}
            <Button
              type="submit"
              size="lg"
              className={authDisabledButtonClass}
              disabled={!canCreateAccount || loading}
            >
              {loading ? 'Création en cours...' : 'Créer mon espace Toolia'}
            </Button>
            <p className="text-center text-sm text-toolia-text-secondary">
              Vous avez déjà un compte ?{' '}
              <Link href="/login" className={authLinkClass}>
                Se connecter
              </Link>
            </p>
          </form>
            </div>
          </div>
        </div>
      </div>
    </SaasShell>
  )
}

export function LoginClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('password') === 'updated') {
      setNotice('Votre mot de passe a été modifié. Vous pouvez vous connecter.')
      window.history.replaceState(null, '', '/login')
    }
  }, [])

  return (
    <SaasShell
      eyebrow="Connexion"
      title="Reprendre votre configuration"
      description="Connectez-vous avec votre email professionnel et votre mot de passe Toolia."
      displayTitle
    >
      <div className={authShellClass}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-toolia-info/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-8 h-80 w-80 rounded-full bg-toolia-primary/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-xl">
            <StatusPill tone="info">Accès client sécurisé</StatusPill>
            <h2 className="font-heading mt-5 text-3xl font-extrabold leading-tight tracking-[-0.035em] text-toolia-text md:text-4xl">
              Retrouvez votre espace sans friction.
            </h2>
            <p className="mt-4 text-base leading-8 text-toolia-text-secondary">
              Reprenez votre configuration, consultez vos automatisations et gardez le contrôle sur vos brouillons Gmail.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-toolia-text-secondary">
              {[
                'Session protégée par Supabase Auth.',
                'Connexion Gmail gérée séparément par Google.',
                'Aucun email envoyé automatiquement.',
              ].map((item) => (
                <div key={item} className={authMutedCardClass}>
                  <span className="flex h-2.5 w-2.5 rounded-full bg-toolia-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-2xl">
            <div className={authPanelClass}>
              <div className="mb-7">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Connexion Toolia</p>
                <h3 className="mt-3 text-2xl font-bold text-toolia-text">Se connecter</h3>
                <HelperText>
                  Accédez à votre espace Toolia avec votre email professionnel et votre mot de passe.
                </HelperText>
              </div>
        <form
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault()
            const submittedEmail = email.trim()
            if (!submittedEmail) {
              setError('Entrez votre email pour continuer.')
              return
            }

            if (!password) {
              setError('Entrez votre mot de passe pour continuer.')
              return
            }

            trackEvent('login_started')
            setLoading(true)
            setError('')

            try {
              const supabase = getSupabaseBrowserClient()
              if (!supabase) {
                throw new Error('Connexion Supabase indisponible. Vérifiez la configuration de l’application.')
              }

              const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: submittedEmail,
                password,
              })

              if (authError) {
                const authMessage = authError.message.toLowerCase()
                if (authError.status === 429 || authMessage.includes('rate limit') || authMessage.includes('too many')) {
                  throw new Error('Trop de tentatives. Attendez quelques minutes avant de réessayer.')
                }

                throw new Error('Email ou mot de passe incorrect.')
              }

              const session = data.user ? sessionFromAuthUser(data.user) : null
              if (!session) {
                throw new Error('Connexion réussie, mais le compte Supabase est incomplet.')
              }

              await syncTooliaProfile(session)
              writeStorage(storageKeys.session, session)
              trackEvent('login_completed')
              router.push('/dashboard')
            } catch (loginError) {
              setError(loginError instanceof Error ? loginError.message : 'Connexion impossible.')
            } finally {
              setLoading(false)
            }
          }}
        >
          <label className={authLabelClass}>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInputClass}
              placeholder="vous@entreprise.com"
              type="email"
            />
          </label>
          <label className={authLabelClass}>
            Mot de passe
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={authInputClass}
              placeholder="Votre mot de passe"
              type="password"
              autoComplete="current-password"
            />
          </label>
          <div className="-mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-toolia-text-secondary underline-offset-4 transition hover:text-toolia-text hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          {notice && (
            <p className="rounded-[18px] border border-toolia-success/25 bg-toolia-success/10 px-4 py-3 text-sm font-medium text-toolia-success">
              {notice}
            </p>
          )}
          {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}
          <Button
            type="submit"
            size="lg"
            className={authDisabledButtonClass}
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>
              <p className="mt-5 text-center text-sm text-toolia-text-secondary">
                Pas encore de compte ?{' '}
                <Link href="/signup" className={authLinkClass}>
                  Créer mon espace Toolia
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </SaasShell>
  )
}

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const submitResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const submittedEmail = email.trim().toLowerCase()

    setError('')
    setSuccess('')

    if (!submittedEmail) {
      setError('Entrez votre email professionnel pour recevoir le lien.')
      return
    }

    if (!isValidEmail(submittedEmail)) {
      setError('Entrez une adresse email valide.')
      return
    }

    trackEvent('forgot_password_started')
    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) throw new Error('Configuration Supabase indisponible.')

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(submittedEmail, {
        redirectTo: getPasswordResetRedirectTo(),
      })

      if (resetError) throw resetError

      setSuccess('Si un compte Toolia existe avec cette adresse, un email de réinitialisation vient d’être envoyé.')
    } catch {
      setError('Le lien de réinitialisation n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SaasShell
      eyebrow="Sécurité"
      title="Réinitialiser votre mot de passe"
      description="Entrez l’adresse email utilisée pour votre compte Toolia. Nous vous enverrons un lien pour choisir un nouveau mot de passe."
      displayTitle
    >
      <div className={authShellClass}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-toolia-info/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-8 h-80 w-80 rounded-full bg-toolia-primary/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-2xl">
          <div className={authPanelClass}>
            <div className="mb-7">
              <StatusPill tone="info">Compte Toolia</StatusPill>
              <h2 className="mt-4 text-2xl font-bold text-toolia-text">Recevoir un lien sécurisé</h2>
              <HelperText>
                Le message est envoyé par Supabase Auth. Pour votre sécurité, Toolia ne confirme jamais publiquement si une adresse existe.
              </HelperText>
            </div>

            <form className="flex flex-col gap-5" onSubmit={submitResetRequest}>
              <label className={authLabelClass}>
                Email professionnel
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={authInputClass}
                  placeholder="vous@entreprise.com"
                  type="email"
                  autoComplete="email"
                />
              </label>

              {success && (
                <p className="rounded-[18px] border border-toolia-success/25 bg-toolia-success/10 px-4 py-3 text-sm font-medium text-toolia-success">
                  {success}
                </p>
              )}
              {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={loading} isLoading={loading}>
                {loading ? 'Envoi du lien...' : 'Envoyer le lien de réinitialisation'}
              </Button>

              <p className="text-center text-sm text-toolia-text-secondary">
                <Link href="/login" className={authLinkClass}>
                  Retour à la connexion
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </SaasShell>
  )
}

export function ResetPasswordClient() {
  const router = useRouter()
  const [initializing, setInitializing] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = getSupabaseBrowserClient()

    if (!supabase) {
      setError('Connexion Supabase indisponible. Vérifiez la configuration de l’application.')
      setInitializing(false)
      return
    }
    const supabaseClient = supabase

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true)
        setError('')
        setInitializing(false)
      }
    })

    async function prepareRecoverySession() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        let shouldCleanUrl = false

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
          shouldCleanUrl = true
        } else if (code) {
          const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          shouldCleanUrl = true
        }

        const { data } = await supabaseClient.auth.getSession()
        if (!active) return

        if (!data.session) {
          setError('Ce lien de réinitialisation est invalide ou expiré.')
          setSessionReady(false)
        } else {
          setSessionReady(true)
          setError('')
        }

        if (shouldCleanUrl) {
          window.history.replaceState(null, '', '/reset-password')
        }
      } catch {
        if (!active) return
        setError('Ce lien de réinitialisation est invalide ou expiré.')
        setSessionReady(false)
      } finally {
        if (active) setInitializing(false)
      }
    }

    void prepareRecoverySession()

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const submitNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!sessionReady) {
      setError('Ce lien de réinitialisation est invalide ou expiré.')
      return
    }

    if (password.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (password !== passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) throw new Error('Configuration Supabase indisponible.')

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSuccess('Votre mot de passe a été modifié.')
      setPassword('')
      setPasswordConfirmation('')
      trackEvent('password_reset_completed')
      await supabase.auth.signOut()
      window.setTimeout(() => router.push('/login?password=updated'), 1800)
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()
      const samePasswordRejected =
        rawMessage.includes('different from the old password') ||
        rawMessage.includes('same password') ||
        rawMessage.includes('new password should be different')

      if (samePasswordRejected) {
        setError('Impossible d’utiliser le même mot de passe que l’ancien. Choisissez un nouveau mot de passe.')
      } else {
        setError('Impossible de changer le mot de passe. Vérifiez votre lien ou demandez un nouveau lien de réinitialisation.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <SaasShell
        eyebrow="Sécurité"
        title="Vérification du lien"
        description="Toolia prépare la page de réinitialisation de votre mot de passe."
        displayTitle
      >
        <NeutralLoadingState
          title="Vérification du lien..."
          description="Nous confirmons la session de récupération avant d’afficher le formulaire."
        />
      </SaasShell>
    )
  }

  return (
    <SaasShell
      eyebrow="Sécurité"
      title="Choisir un nouveau mot de passe"
      description="Saisissez un nouveau mot de passe pour sécuriser votre espace Toolia."
      displayTitle
    >
      <div className={authShellClass}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-toolia-info/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-8 h-80 w-80 rounded-full bg-toolia-primary/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-2xl">
          <div className={authPanelClass}>
            <div className="mb-7">
              <StatusPill tone={sessionReady ? 'success' : 'warning'}>
                {sessionReady ? 'Lien vérifié' : 'Lien indisponible'}
              </StatusPill>
              <h2 className="mt-4 text-2xl font-bold text-toolia-text">Nouveau mot de passe</h2>
              <HelperText>
                Utilisez un mot de passe d’au moins 8 caractères. Votre mot de passe Gmail n’est jamais demandé par Toolia.
              </HelperText>
            </div>

            {!sessionReady ? (
              <div className="flex flex-col gap-5">
                {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center justify-center rounded-btn bg-toolia-primary px-[18px] py-3 text-base font-medium text-white shadow-btn-primary transition hover:bg-toolia-primary-light"
                >
                  Demander un nouveau lien
                </Link>
                <Link href="/login" className={`text-center text-sm ${authLinkClass}`}>
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form className="flex flex-col gap-5" onSubmit={submitNewPassword}>
                <label className={authLabelClass}>
                  Nouveau mot de passe
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={authInputClass}
                    placeholder="Minimum 8 caractères"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
                <label className={authLabelClass}>
                  Confirmer le mot de passe
                  <input
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className={authInputClass}
                    placeholder="Retapez votre nouveau mot de passe"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>

                {success && (
                  <p className="rounded-[18px] border border-toolia-success/25 bg-toolia-success/10 px-4 py-3 text-sm font-medium text-toolia-success">
                    {success}
                  </p>
                )}
                {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}

                <Button type="submit" size="lg" className="w-full" disabled={loading} isLoading={loading}>
                  {loading ? 'Modification...' : 'Modifier mon mot de passe'}
                </Button>
                <p className="text-center text-sm text-toolia-text-secondary">
                  <Link href="/login" className={authLinkClass}>
                    Se connecter
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </SaasShell>
  )
}

export function PricingClient() {
  const router = useRouter()
  const [session, setSession] = useState<DemoSession | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null)
  const [checkoutInfo, setCheckoutInfo] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<DashboardState['subscriptionStatus'] | null>(null)
  const [continuationPath, setContinuationPath] = useState<'/onboarding' | '/dashboard'>('/onboarding')

  useEffect(() => {
    let active = true

    async function load() {
      const urlPlanId = getPlanIdFromUrl()
      const planFromUrl = persistSelectedPlanById(urlPlanId)
      const storedPlan = planFromUrl || getStoredPlan()
      const storedSession = await resolveSession()
      if (!active) return

      if (!hasValidSession(storedSession)) {
        router.replace(storedPlan?.id ? `/signup?plan=${storedPlan.id}` : '/signup')
        return
      }

      setSession(storedSession)
      setSelectedPlan(storedPlan)

      const persisted = await loadPersistedState(storedSession)
      if (!active || !persisted?.ok) return

      const persistedPlan = normalizePersistedPlan(persisted.plan)
      if (persistedPlan) {
        setSelectedPlan(persistedPlan)
        writeStorage(storageKeys.plan, persistedPlan)
      }
      if (persisted.dashboard?.subscriptionStatus) {
        setSubscriptionStatus(persisted.dashboard.subscriptionStatus)
      }
      setContinuationPath(persisted.dashboard ? '/dashboard' : '/onboarding')
    }

    void load()
    return () => {
      active = false
    }
  }, [router])

  const demo = isDemoSession(session)
  const activeStripeSubscription = Boolean(!demo && selectedPlan?.paid)
  const activePremiumSubscription = activeStripeSubscription && selectedPlan?.id === 'premium'
  const pricingActionLabel = (plan: PlanOption) => {
    if (activeStripeSubscription && selectedPlan?.id === plan.id) return 'Continuer la configuration'
    if (activeStripeSubscription && selectedPlan?.id && planRank(plan.id) > planRank(selectedPlan.id)) return 'Changer d’offre'
    if (activeStripeSubscription) return 'Gérer la facturation'
    return `Choisir ${plan.name}`
  }
  const choosePlan = async (plan: PlanOption) => {
    const planParams = planAnalyticsParams(plan)
    trackEvent('plan_selected', planParams)
    trackEvent('cta_click', {
      cta_location: 'pricing',
      cta_label: pricingActionLabel(plan),
      ...planParams,
    })

    if (!hasValidSession(session)) {
      router.push('/signup')
      return
    }

    setCheckoutInfo('')
    setCheckoutError('')

    if (activeStripeSubscription && selectedPlan?.paid) {
      if (plan.id === selectedPlan.id) {
        setCheckoutInfo(`Votre offre ${selectedPlan.name} est déjà active. Continuez la configuration de votre automatisation.`)
        window.setTimeout(() => router.push(continuationPath), 1200)
        return
      }

      setCheckoutLoadingPlan(plan.id)
      try {
        if (planRank(plan.id) > planRank(selectedPlan.id)) {
          router.push(`/billing/change-plan?target=${plan.id}`)
          return
        }

        setCheckoutInfo('Vous avez déjà une offre active. Les changements sont gérés de manière sécurisée via Stripe.')
        window.location.href = await createStripePortalUrl()
      } catch (portalError) {
        setCheckoutError(portalError instanceof Error ? portalError.message : 'Le portail de gestion Stripe n’est pas encore configuré.')
      } finally {
        setCheckoutLoadingPlan(null)
      }
      return
    }

    if (demo) {
      const nextPlan = { ...plan, paid: true }
      writeStorage(storageKeys.plan, nextPlan)
      router.push('/onboarding')
      return
    }

    const token = await getSupabaseAccessToken()
    if (!token) {
      setCheckoutError('Connectez-vous pour choisir une offre.')
      return
    }

    setCheckoutLoadingPlan(plan.id)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: plan.id }),
      })
      const data = await readJsonResponse<{
        ok?: boolean
        url?: string
        message?: string
        code?: string
        redirectTo?: '/onboarding' | '/dashboard'
        portalRequired?: boolean
      }>(
        response,
        '/api/stripe/checkout',
      )

      if (!response.ok || !data.ok || !data.url) {
        if (data.code === 'plan_already_active' && data.redirectTo) {
          setCheckoutError(data.message || `Votre offre ${plan.name} est déjà active. Continuez la configuration de votre automatisation.`)
          window.setTimeout(() => router.push(data.redirectTo || continuationPath), 1200)
          return
        }

        if (data.portalRequired) {
          setCheckoutInfo(data.message || 'Vous avez déjà une offre active. Les changements sont gérés de manière sécurisée via Stripe.')
          window.location.href = await createStripePortalUrl()
          return
        }

        setCheckoutError(data.message || "Paiement Stripe indisponible pour le moment.")
        return
      }

      trackEvent('checkout_started', planParams)
      window.location.href = data.url
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Paiement Stripe indisponible pour le moment.")
    } finally {
      setCheckoutLoadingPlan(null)
    }
  }

  return (
    <SaasShell
      eyebrow="Offre"
      title="Choisissez votre plan"
      description={
        demo
          ? 'Choisissez l’offre adaptée à votre configuration.'
          : 'Dans le vrai parcours client, le choix du plan redirigera ensuite vers Stripe Checkout pour finaliser le paiement.'
      }
      showDemoNotice={allowDemoMode && demo}
      displayTitle
    >
      {activePremiumSubscription && (
        <AppCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <StatusPill tone="success">Offre Premium active</StatusPill>
              <p className="mt-3 text-sm leading-relaxed text-toolia-text-secondary">
                Les changements d’offre, les annulations et les moyens de paiement se gèrent dans le portail sécurisé Stripe.
              </p>
            </div>
            <StripePortalButton label="Gérer la facturation" />
          </div>
        </AppCard>
      )}
      {selectedPlan && !activePremiumSubscription && (
        <AppCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-toolia-text-secondary">Offre présélectionnée</p>
              <p className="text-xl font-bold text-toolia-text">{selectedPlan.name}</p>
            </div>
            {activePremiumSubscription ? (
              <StripePortalButton label="Gérer la facturation" />
            ) : (
              <Button
                type="button"
                disabled={checkoutLoadingPlan === selectedPlan.id}
                onClick={() => void choosePlan(selectedPlan)}
              >
              {checkoutLoadingPlan === selectedPlan.id ? 'Ouverture du paiement...' : pricingActionLabel(selectedPlan)}
              </Button>
            )}
          </div>
        </AppCard>
      )}
      <AppCard>
        <p className="text-sm text-toolia-text-secondary">
          Si vous avez un code promo, vous pourrez l’ajouter sur la page de paiement sécurisée Stripe.
        </p>
        {checkoutInfo && <p className="mt-3 text-sm font-medium text-toolia-text-secondary">{checkoutInfo}</p>}
        {checkoutError && <p className="mt-3 text-sm font-medium text-toolia-danger">{checkoutError}</p>}
      </AppCard>
      <div className="grid gap-6 md:grid-cols-3">
        {planOptions.map((plan) => (
          <AppCard
            key={plan.id}
            className={plan.featured || selectedPlan?.id === plan.id ? 'border-toolia-primary shadow-btn-primary' : ''}
          >
            <div className="flex h-full flex-col gap-5">
              <div>
                {plan.featured && <StatusPill tone="success">Recommandé</StatusPill>}
                <h2 className="mt-3 text-2xl font-bold text-toolia-text">{plan.name}</h2>
                <p className="mt-2 text-sm text-toolia-text-secondary">{plan.description}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-toolia-text">{plan.price}</p>
                <p className="text-sm text-toolia-text-secondary">{plan.setup}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-toolia-text-secondary">
                    <Check size={16} className="mt-0.5 shrink-0 text-toolia-success" />
                    {feature}
                  </li>
                ))}
              </ul>
              {activePremiumSubscription ? (
                <StripePortalButton label="Gérer la facturation" variant={plan.featured ? 'primary' : 'outline'} />
              ) : (
                <Button
                  type="button"
                  variant={plan.featured ? 'primary' : 'outline'}
                  disabled={checkoutLoadingPlan === plan.id}
                  onClick={() => void choosePlan(plan)}
                >
                  {checkoutLoadingPlan === plan.id ? 'Ouverture du paiement...' : pricingActionLabel(plan)}
                </Button>
              )}
            </div>
          </AppCard>
        ))}
      </div>
    </SaasShell>
  )
}

const planBillingDetails: Record<'starter' | 'pro' | 'premium', { monthly: number; setup: number }> = {
  starter: { monthly: 29, setup: 49 },
  pro: { monthly: 69, setup: 99 },
  premium: { monthly: 129, setup: 199 },
}

const upgradeSetupDelta: Record<string, number> = {
  'starter:pro': 50,
  'starter:premium': 150,
  'pro:premium': 100,
}

function getUpgradeSetupDelta(currentPlanId: string | null | undefined, targetPlanId: string | null | undefined) {
  if (!currentPlanId || !targetPlanId) return null
  return upgradeSetupDelta[`${currentPlanId}:${targetPlanId}`] ?? null
}

type UpgradePreview = {
  currentPlan: 'starter' | 'pro' | 'premium'
  currentPlanName: string
  targetPlan: 'starter' | 'pro' | 'premium'
  targetPlanName: string
  currentMonthlyCents: number
  targetMonthlyCents: number
  setupDeltaCents: number
  monthlyDeltaCents: number
  prorataCents: number
  totalDueNowCents: number
  returnPath?: '/onboarding' | '/dashboard'
  usedFallbackPeriod?: boolean
}

function formatEuroCents(cents: number | null | undefined) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format((cents || 0) / 100)
}

function formatFrenchDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function ChangePlanClient({ targetPlanId }: { targetPlanId?: string | null }) {
  const router = useRouter()
  const targetPlan = getPlanOptionById(targetPlanId)
  const [session, setSession] = useState<DemoSession | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PlanOption | null>(null)
  const [preview, setPreview] = useState<UpgradePreview | null>(null)
  const [continuationPath, setContinuationPath] = useState<'/onboarding' | '/dashboard'>('/onboarding')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!hasValidSession(storedSession)) {
        router.replace(targetPlan?.id ? `/signup?plan=${targetPlan.id}` : '/signup')
        return
      }

      setSession(storedSession)

      if (isDemoSession(storedSession)) {
        setCurrentPlan(getStoredPlan())
        setLoading(false)
        return
      }

      const persisted = await loadPersistedState(storedSession)
      if (!active) return

      const persistedPlan = normalizePersistedPlan(persisted?.plan)
      setCurrentPlan(persistedPlan)
      if (persistedPlan) writeStorage(storageKeys.plan, persistedPlan)
      setContinuationPath(persisted?.dashboard ? '/dashboard' : '/onboarding')

      if (persistedPlan?.paid && targetPlan?.id && planRank(targetPlan.id) > planRank(persistedPlan.id)) {
        const token = await getSupabaseAccessToken()
        if (!token) throw new Error('Connectez-vous pour modifier votre abonnement.')

        const response = await fetch(`/api/stripe/upgrade?target=${targetPlan.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await readJsonResponse<UpgradePreview & { ok?: boolean; message?: string }>(
          response,
          '/api/stripe/upgrade',
        )

        if (!response.ok || !data.ok) {
          throw new Error(data.message || 'Calcul du changement d’offre impossible.')
        }

        setPreview(data)
        if (data.returnPath === '/dashboard' || data.returnPath === '/onboarding') {
          setContinuationPath(data.returnPath)
        }
      }

      const upgradeStatus = new URLSearchParams(window.location.search).get('upgrade')
      if (upgradeStatus === 'cancelled') {
        setInfo('Paiement annulé. Votre offre actuelle reste inchangée.')
      }
      setLoading(false)
    }

    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Chargement de votre offre impossible.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [router, targetPlan?.id])

  const currentBilling = currentPlan?.id ? planBillingDetails[currentPlan.id as 'starter' | 'pro' | 'premium'] : null
  const targetBilling = targetPlan?.id ? planBillingDetails[targetPlan.id as 'starter' | 'pro' | 'premium'] : null
  const isUpgrade = currentPlan?.id && targetPlan?.id ? planRank(targetPlan.id) > planRank(currentPlan.id) : false
  const isSamePlan = Boolean(currentPlan?.id && targetPlan?.id && currentPlan.id === targetPlan.id)
  const setupDelta = isUpgrade ? getUpgradeSetupDelta(currentPlan?.id, targetPlan?.id) : null
  const localMonthlyDeltaCents =
    currentBilling && targetBilling ? Math.max(0, (targetBilling.monthly - currentBilling.monthly) * 100) : 0
  const displayedSetupDeltaCents = preview?.setupDeltaCents ?? (setupDelta ?? 0) * 100
  const displayedProrataCents = preview?.prorataCents ?? localMonthlyDeltaCents
  const displayedTotalCents = preview?.totalDueNowCents ?? displayedSetupDeltaCents + displayedProrataCents

  const confirmUpgrade = async () => {
    if (!targetPlan || !isUpgrade) return

    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous pour modifier votre abonnement.')

      const response = await fetch('/api/stripe/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: targetPlan.id, confirmed: true }),
      })
      const data = await readJsonResponse<{
        ok?: boolean
        message?: string
        redirectTo?: string
        url?: string
        invoiceUrl?: string | null
        noOp?: boolean
        portalRequired?: boolean
      }>(response, '/api/stripe/upgrade')

      if (!response.ok || !data.ok) {
        if (data.portalRequired) {
          setInfo('Cette modification se gère dans le portail sécurisé Stripe.')
          window.location.href = await createStripePortalUrl()
          return
        }

        throw new Error(data.message || 'Modification de l’offre impossible pour le moment.')
      }

      setInfo(data.message || 'Modification envoyée à Stripe.')
      const nextUrl = data.url || data.redirectTo
      if (nextUrl) {
        if (data.url) {
          trackEvent('checkout_started', planAnalyticsParams(targetPlan))
        }
        window.location.href = nextUrl
        return
      }

      window.setTimeout(() => router.push(data.noOp ? continuationPath : '/dashboard?upgrade=pending'), 900)
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : 'Modification de l’offre impossible pour le moment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SaasShell
      eyebrow="Facturation"
      title="Modifier mon offre"
      description="Vérifiez le changement avant d’ouvrir le paiement sécurisé Stripe."
      showDemoNotice={allowDemoMode && isDemoSession(session)}
    >
      <AppCard>
        {loading && <p className="text-sm text-toolia-text-secondary">Chargement de votre offre...</p>}

        {!loading && !targetPlan && (
          <div className="flex flex-col gap-4">
            <StatusPill tone="danger">Offre introuvable</StatusPill>
            <p className="text-sm text-toolia-text-secondary">Choisissez une offre valide pour continuer.</p>
            <NextLink href="/pricing">Voir les offres</NextLink>
          </div>
        )}

        {!loading && targetPlan && !currentPlan?.paid && (
          <div className="flex flex-col gap-4">
            <StatusPill tone="warning">Aucune offre active</StatusPill>
            <p className="text-sm text-toolia-text-secondary">
              Cette page sert aux changements d’offre pour les abonnements déjà actifs. Pour choisir votre première offre,
              utilisez le paiement initial.
            </p>
            <NextLink href={`/pricing?plan=${targetPlan.id}`}>Choisir {targetPlan.name}</NextLink>
          </div>
        )}

        {!loading && targetPlan && currentPlan?.paid && isSamePlan && (
          <div className="flex flex-col gap-4">
            <StatusPill tone="success">Offre déjà active</StatusPill>
            <p className="text-sm text-toolia-text-secondary">
              Votre offre {targetPlan.name} est déjà active. Vous pouvez continuer votre configuration Toolia.
            </p>
            <NextLink href={continuationPath}>Continuer</NextLink>
          </div>
        )}

        {!loading && targetPlan && currentPlan?.paid && !isSamePlan && !isUpgrade && (
          <div className="flex flex-col gap-4">
            <StatusPill tone="info">Gestion Stripe</StatusPill>
            <p className="text-sm text-toolia-text-secondary">
              Les baisses d’offre, les annulations et les moyens de paiement se gèrent dans le portail sécurisé Stripe.
              Aucun remboursement de mise en place n’est appliqué automatiquement.
            </p>
            <StripePortalButton label="Gérer la facturation" />
          </div>
        )}

        {!loading && targetPlan && currentPlan?.paid && isUpgrade && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                <p className="text-sm text-toolia-text-secondary">Offre actuelle</p>
                <p className="mt-1 text-2xl font-bold text-toolia-text">{currentPlan.name}</p>
                {currentBilling && (
                  <p className="mt-2 text-sm text-toolia-text-secondary">{currentBilling.monthly} € / mois</p>
                )}
              </div>
              <div className="rounded-card border border-toolia-primary/50 bg-toolia-primary/10 p-4">
                <p className="text-sm text-toolia-text-secondary">Nouvelle offre</p>
                <p className="mt-1 text-2xl font-bold text-toolia-text">{targetPlan.name}</p>
                {targetBilling && (
                  <p className="mt-2 text-sm text-toolia-text-secondary">{targetBilling.monthly} € / mois</p>
                )}
              </div>
            </div>

            <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
              <h2 className="text-lg font-bold text-toolia-text">Détail du changement</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm text-toolia-text-secondary">Différence de mise en place</p>
                  <p className="mt-1 text-xl font-bold text-toolia-text">
                    {formatEuroCents(displayedSetupDeltaCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-toolia-text-secondary">Ajustement d’abonnement estimé</p>
                  <p className="mt-1 text-xl font-bold text-toolia-text">
                    {formatEuroCents(displayedProrataCents)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm text-toolia-text-secondary">Total estimé aujourd’hui</p>
                  <p className="mt-1 text-2xl font-bold text-toolia-text">
                    {formatEuroCents(displayedTotalCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-toolia-text-secondary">Nouveau prix mensuel après changement</p>
                  <p className="mt-1 text-2xl font-bold text-toolia-text">
                    {formatEuroCents(preview?.targetMonthlyCents ?? (targetBilling?.monthly || 0) * 100)} / mois
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-toolia-text-secondary">
                Le paiement couvre la différence de mise en place et l’ajustement de l’abonnement pour la période en
                cours. Le changement d’offre sera appliqué uniquement après paiement confirmé par Stripe.
              </p>
            </div>

            {info && <p className="text-sm font-medium text-toolia-text-secondary">{info}</p>}
            {error && <p className="text-sm font-medium text-toolia-danger">{error}</p>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-btn border border-toolia-border-subtle px-4 py-3 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary"
              >
                Retour aux offres
              </Link>
              <Button type="button" onClick={() => void confirmUpgrade()} disabled={submitting} isLoading={submitting}>
                {submitting ? 'Ouverture du paiement sécurisé...' : 'Continuer vers le paiement sécurisé'}
              </Button>
            </div>
          </div>
        )}
      </AppCard>
    </SaasShell>
  )
}

export function OnboardingWizard() {
  const router = useRouter()
  const onboardingStartedTracked = useRef(false)
  const [returnToSettings, setReturnToSettings] = useState(false)
  const [step, setStep] = useState(0)
  const [session, setSession] = useState<DemoSession | null>(null)
  const [plan, setPlan] = useState<PlanOption | null>(null)
  const [mainGoal, setMainGoal] = useState('Gagner du temps sans manquer les emails importants')
  const [businessContext, setBusinessContext] = useState('Activité de service avec clients, prospects et factures à traiter chaque semaine.')
  const [emailVolume, setEmailVolume] = useState<OnboardingAnswers['emailVolume']>('20_50')
  const [estimatedDailyEmailCount, setEstimatedDailyEmailCount] = useState('')
  const [volumeError, setVolumeError] = useState('')
  const [categories, setCategories] = useState<WizardCategory[]>(makeInitialCategories)
  const [draftTone, setDraftTone] = useState<OnboardingAnswers['draftTone']>('professionnel')
  const [customDraftInstructions, setCustomDraftInstructions] = useState('')
  const [telegramPreference, setTelegramPreference] = useState<OnboardingAnswers['telegramPreference']>('important_only')
  const automationLevel: OnboardingAnswers['automationLevel'] = 'balanced'
  const [customLabelName, setCustomLabelName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customExample, setCustomExample] = useState('')
  const [telegramConnection, setTelegramConnection] = useState<TelegramConnectionState | null>(() =>
    readStorage<TelegramConnectionState | null>(storageKeys.telegram, null),
  )
  const [error, setError] = useState('')
  const [initializing, setInitializing] = useState(true)

  const hydrateAnswers = (answers: OnboardingAnswers | null | undefined) => {
    if (!answers) return

    setMainGoal(answers.mainGoal)
    setBusinessContext(answers.businessContext)
    setEmailVolume(answers.emailVolume)
    setEstimatedDailyEmailCount(answers.estimatedDailyEmailCount ? String(answers.estimatedDailyEmailCount) : '')
    setCategories(answers.categories)
    setDraftTone(answers.draftTone)
    setCustomDraftInstructions((answers.customDraftInstructions || '').slice(0, 1000))
    setTelegramPreference(answers.telegramPreference)
  }

  useEffect(() => {
    let active = true

    async function load() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!hasValidSession(storedSession)) {
        router.replace('/signup')
        return
      }

      const fromSettings = new URLSearchParams(window.location.search).get('from') === 'settings'
      if (storedSession?.mode === 'account') {
        const state = await getTooliaClientState()
        if (!fromSettings && state.hasAutomation) {
          router.replace('/dashboard')
          return
        }
      }

      setSession(storedSession)
      setPlan(getStoredPlan())
      setReturnToSettings(fromSettings)
      writeStorage(storageKeys.editMode, fromSettings)

      const storedAnswers = readStorage<OnboardingAnswers | null>(storageKeys.answers, null)
      hydrateAnswers(storedAnswers)

      if (storedSession?.mode === 'account') {
        const persisted = await loadPersistedState(storedSession)
        if (!active) return
        if (!persisted?.ok) {
          setError('Synchronisation de votre configuration impossible pour le moment.')
          setInitializing(false)
          return
        }
        const persistedPlan = normalizePersistedPlan(persisted?.plan || null)
        if (persistedPlan) {
          setPlan(persistedPlan)
          writeStorage(storageKeys.plan, persistedPlan)
        }
        setTelegramConnection(persisted?.telegram || null)
        if (persisted?.telegram) {
          writeStorage(storageKeys.telegram, persisted.telegram)
        }
        const persistedProfile = normalizeProfile(persisted?.profile || null)
        if (fromSettings && persistedProfile) {
          const profileBackedAnswers = answersFromProfile(persistedProfile, persisted?.answers || storedAnswers)
          hydrateAnswers(profileBackedAnswers)
          writeStorage(storageKeys.answers, profileBackedAnswers)
          writeStorage(storageKeys.generationDone, false)
          removeStorage(storageKeys.profile)
        } else if (persisted?.answers) {
          hydrateAnswers(persisted.answers)
        }
      }

      if (active) setInitializing(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [router])

  const selectedCategories = useMemo(() => categories.filter((category) => category.selected), [categories])
  const totalSteps = 5
  const activePlanLimits = plan ? getPlanLimits(plan.id) : getPlanLimits('starter')
  const labelLimit = activePlanLimits.maxLabels
  const planAllowsCategoryTelegram = plan ? activePlanLimits.telegramCategoryAlerts : false
  const planIsStarter = plan?.id === 'starter' || plan?.id === 'essential'
  const demo = isDemoSession(session)
  const telegramConnected = Boolean(telegramConnection?.connected)
  const telegramDisabled =
    !planAllowsCategoryTelegram ||
    telegramPreference === 'none' ||
    telegramPreference === 'important_only' ||
    !telegramConnected
  let telegramDisabledReason = !planAllowsCategoryTelegram
    ? 'Cette action n’est pas incluse dans votre offre actuelle. Passez à Pro pour recevoir des alertes Telegram sur vos catégories importantes.'
    : 'Telegram est désactivé dans les réglages globaux.'
  telegramDisabledReason = !planAllowsCategoryTelegram
    ? "Telegram est disponible à partir de l'offre Pro."
    : telegramPreference === 'none'
      ? 'Activez Telegram en haut pour recevoir des alertes sur ce label.'
      : telegramPreference === 'important_only'
        ? 'Les alertes urgentes sont actives : Toolia alerte automatiquement les emails urgents, sans sélection par catégorie.'
        : !telegramConnected
          ? "Connectez Telegram avant d'activer les alertes."
          : ''

  useEffect(() => {
    if (initializing || onboardingStartedTracked.current) return
    onboardingStartedTracked.current = true
    trackEvent('onboarding_started', planAnalyticsParams(plan))
  }, [initializing, plan])

  useEffect(() => {
    if (initializing) return
    if (planAllowsCategoryTelegram) return

    setCategories((current) =>
      current.map((category) => ({
        ...category,
        actions: { ...normalizeActions(category.actions), telegram: false },
      })),
    )
    setTelegramPreference('none')
  }, [initializing, planAllowsCategoryTelegram])

  if (initializing) {
    return (
      <SaasShell
        eyebrow="Configuration"
        title="Vérification de votre configuration"
        description="Toolia synchronise votre offre, vos réglages et vos connexions avant d’afficher les options."
      >
        <NeutralLoadingState
          title="Vérification de votre configuration..."
          description="Nous récupérons votre offre et vos réglages pour éviter d’afficher de fausses limitations."
        />
      </SaasShell>
    )
  }

  const updateCategory = (key: string, patch: Partial<WizardCategory>) => {
    setCategories((current) =>
      current.map((category) => (category.key === key ? { ...category, ...patch } : category)),
    )
  }

  const toggleCategory = (category: WizardCategory, selected: boolean) => {
    if (selected && selectedCategories.length >= labelLimit) {
      setError('Vous avez atteint la limite de labels de votre offre.')
      return
    }
    setError('')
    updateCategory(category.key, { selected })
  }

  const applyActionChange = (
    currentActions: CategoryActions,
    action: ClientActionKey,
    checked: boolean,
  ): CategoryActions => {
    const current = normalizeActions(currentActions)

    if (action === 'label') return current

    if (action === 'archive') {
      return checked
        ? { label: false, draft: false, telegram: false, archive: true }
        : { label: true, draft: false, telegram: false, archive: false }
    }

    if (action === 'telegram' && telegramDisabled) return { ...current, telegram: false }

    return normalizeActions({
      ...current,
      label: true,
      archive: false,
      [action]: checked,
    })
  }

  const updateCategoryAction = (key: string, action: ClientActionKey, checked: boolean) => {
    if (action === 'telegram' && checked && telegramDisabled) {
      setError(telegramDisabledReason)
      return
    }
    setError('')
    setCategories((current) =>
      current.map((category) =>
        category.key === key
          ? { ...category, actions: applyActionChange(category.actions, action, checked) }
          : category,
      ),
    )
  }

  const changeTelegramPreference = (value: OnboardingAnswers['telegramPreference']) => {
    if (!planAllowsCategoryTelegram) {
      setError('Alertes Telegram indisponibles avec l’offre Starter.')
      setTelegramPreference('none')
      return
    }

    if (value === 'all_selected' && !planAllowsCategoryTelegram) {
      setError('Les alertes Telegram par catégorie sont incluses dans l’offre Pro.')
      return
    }
    setError('')
    setTelegramPreference(value)

    if (value === 'none') {
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          actions: { ...normalizeActions(category.actions), telegram: false },
        })),
      )
    }
  }

  const addCustomLabel = () => {
    if (selectedCategories.length >= labelLimit) {
      setError('Vous avez atteint la limite de labels de votre offre.')
      return
    }

    if (!customLabelName.trim()) {
      setError('Ajoutez au minimum un nom de label personnalisé.')
      return
    }

    const key = `custom_${Date.now()}`
    const description = customDescription.trim() || 'Label personnalisé ajouté pendant la configuration.'
    setCategories((current) => [
      ...current,
      {
        key,
        label: customLabelName.trim(),
        selected: true,
        description,
        exampleEmail: customExample.trim(),
        actions: { label: true, draft: false, telegram: false, archive: false },
      },
    ])
    setCustomLabelName('')
    setCustomDescription('')
    setCustomExample('')
    setError('')
  }

  const removeCustomLabel = (key: string) => {
    setCategories((current) => current.filter((category) => category.key !== key))
  }

  const validateVolumeStep = () => {
    if (emailVolume !== '100_plus') {
      setVolumeError('')
      return true
    }

    if (!estimatedDailyEmailCount.trim()) {
      setVolumeError(emailVolumeRequiredMessage)
      return false
    }

    const parsedEstimatedDailyEmailCount = Number(estimatedDailyEmailCount)
    if (!Number.isFinite(parsedEstimatedDailyEmailCount) || parsedEstimatedDailyEmailCount <= 100) {
      setVolumeError(emailVolumeBelowRangeMessage)
      return false
    }

    setVolumeError('')
    return true
  }

  const trackCurrentOnboardingStep = (stepIndex: number) => {
    trackEvent('onboarding_step_completed', {
      step: onboardingStepAnalytics[stepIndex] || 'summary',
      selected_label_count: selectedCategories.length,
      custom_label_count: customLabelCount(categories),
    })
  }

  const saveAnswers = async () => {
    if (selectedCategories.length === 0) {
      setError('Sélectionnez au moins une catégorie.')
      return
    }
    if (selectedCategories.length > labelLimit) {
      setError('Vous avez atteint la limite de labels de votre offre.')
      return
    }
    const parsedEstimatedDailyEmailCount = Number(estimatedDailyEmailCount)
    if (!validateVolumeStep()) {
      setStep(2)
      return
    }

    trackCurrentOnboardingStep(step)

    const sanitizedCategories = categories.map((category) => ({
      ...category,
      actions: planAllowsCategoryTelegram && telegramPreference === 'all_selected' && telegramConnected
        ? normalizeActions(category.actions)
        : { ...normalizeActions(category.actions), telegram: false },
    }))

    const answers: OnboardingAnswers = {
      mainGoal,
      businessContext,
      emailVolume,
      estimatedDailyEmailCount: emailVolume === '100_plus' ? Math.round(parsedEstimatedDailyEmailCount) : null,
      categories: sanitizedCategories,
      draftTone,
      customDraftInstructions: customDraftInstructions.trim().slice(0, 1000),
      telegramPreference: planAllowsCategoryTelegram ? telegramPreference : 'none',
      automationLevel,
    }

    trackEvent('automation_config_completed', {
      step: 'summary',
      selected_label_count: selectedCategories.length,
      custom_label_count: customLabelCount(categories),
      telegram_enabled: answers.telegramPreference !== 'none',
    })

    if (process.env.NODE_ENV !== 'production') {
      console.info('[saas/onboarding] category actions saved', {
        categories: answers.categories
          .filter((category) => category.selected)
          .map((category) => ({
            category: category.label,
            labelEnabled: Boolean(category.actions.label),
            draftEnabled: Boolean(category.actions.draft),
            archiveEnabled: Boolean(category.actions.archive),
            telegramEnabled: Boolean(category.actions.telegram),
          })),
      })
    }

    writeStorage(storageKeys.answers, answers)
    writeStorage(storageKeys.generationDone, false)
    removeStorage(storageKeys.profile)
    await persistOnboardingForSession(session, answers)

    const editingExistingAutomation = readStorage<boolean>(storageKeys.editMode, false)
    if (editingExistingAutomation && session?.mode === 'account') {
      const persisted = await loadPersistedState(session)
      if (persisted?.gmail?.connected) {
        writeStorage(storageKeys.gmail, persisted.gmail)
        router.push('/onboarding/profile')
        return
      }
    }

    router.push(editingExistingAutomation ? '/onboarding/gmail?from=edit' : '/onboarding/gmail')
  }

  return (
    <SaasShell
      eyebrow={`Configuration ${step + 1}/${totalSteps}`}
      title="Configurez votre automatisation Gmail"
      description="Toolia va vous poser quelques questions pour comprendre comment vous voulez gérer vos emails. Plus vos réponses sont précises, plus l’automatisation sera fiable."
      showDemoNotice={allowDemoMode && demo}
    >
      <AppCard>
        <div className="mb-6 rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
          <p className="text-sm text-toolia-text-secondary">
            Plan sélectionné : <span className="font-semibold text-toolia-text">{plan?.name || 'Offre à confirmer'}</span> · {selectedCategories.length}/{labelLimit} labels utilisés.
          </p>
          {!planAllowsCategoryTelegram && planIsStarter && (
            <p className="mt-2 text-sm text-toolia-warning">
              Les alertes Telegram par catégorie sont incluses dans l’offre Pro.
              <Link href="/pricing" className="ml-2 font-semibold text-toolia-text underline">
                Voir les offres
              </Link>
            </p>
          )}
        </div>

        <div className="mb-8 grid gap-2 sm:grid-cols-5">
          {['Objectif', 'Contexte', 'Volume', 'Labels', 'Actions'].map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (step === 2 && index > 2 && !validateVolumeStep()) return
                setStep(index)
              }}
              className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                index === step
                  ? 'border-toolia-primary bg-toolia-primary text-white'
                  : 'border-toolia-border-subtle bg-toolia-card-hover text-toolia-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Quel est votre objectif principal ?</h2>
              <HelperText>
                Expliquez ce que vous voulez que Toolia améliore : gagner du temps, ne plus manquer les urgences, préparer des réponses, trier les factures, etc.
              </HelperText>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
              Objectif
              <textarea
                value={mainGoal}
                onChange={(event) => setMainGoal(event.target.value)}
                className="min-h-32 rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Quel est votre contexte métier ?</h2>
              <HelperText>
                Décrivez votre activité, vos clients, et les emails que vous recevez souvent. Cela aide Toolia à classer les messages avec plus de précision.
              </HelperText>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
              Contexte
              <textarea
                value={businessContext}
                onChange={(event) => setBusinessContext(event.target.value)}
                className="min-h-40 rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Combien d’emails recevez-vous ?</h2>
              <HelperText>
                Le volume aide Toolia à choisir une approche plus prudente quand il y a beaucoup d’emails à traiter.
              </HelperText>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['moins_20', 'Moins de 20 emails/jour'],
                ['20_50', '20 à 50 emails/jour'],
                ['50_100', '50 à 100 emails/jour'],
                ['100_plus', 'Plus de 100 emails/jour'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setEmailVolume(value as OnboardingAnswers['emailVolume'])
                    setVolumeError('')
                  }}
                  className={`rounded-card border p-4 text-left ${
                    emailVolume === value
                      ? 'border-toolia-primary bg-toolia-primary/20'
                      : 'border-toolia-border-subtle bg-toolia-card-hover'
                  }`}
                >
                  <span className="font-semibold text-toolia-text">{label}</span>
                </button>
              ))}
            </div>
            {emailVolume === '100_plus' && (
              <label className="flex max-w-md flex-col gap-2 text-sm font-medium text-toolia-text">
                Environ combien d’emails recevez-vous par jour ?
                <input
                  value={estimatedDailyEmailCount}
                  onChange={(event) => {
                    setEstimatedDailyEmailCount(event.target.value.replace(/[^\d]/g, ''))
                    setVolumeError('')
                  }}
                  className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
                  inputMode="numeric"
                  placeholder="Ex : 140"
                />
                {volumeError && <span className="text-sm font-medium text-toolia-danger">{volumeError}</span>}
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Quels labels voulez-vous dans Gmail ?</h2>
              <HelperText>
                Chaque catégorie sélectionnée deviendra un label Gmail. Vous pouvez partir des suggestions ou ajouter vos propres labels.
              </HelperText>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <div
                  key={category.key}
                  className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4"
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={category.selected}
                      onChange={(event) => toggleCategory(category, event.target.checked)}
                      className="mt-1 h-4 w-4 accent-toolia-primary"
                    />
                    <span>
                      <span className="block font-semibold text-toolia-text">{category.label}</span>
                      <span className="block text-sm text-toolia-text-secondary">{category.description}</span>
                    </span>
                  </label>
                  {category.key.startsWith('custom_') && (
                    <button
                      type="button"
                      onClick={() => removeCustomLabel(category.key)}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-toolia-danger"
                    >
                      <Trash2 size={14} />
                      Retirer ce label
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-card border border-toolia-border-subtle bg-toolia-bg-main/35 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Plus size={18} className="text-toolia-info" />
                <h3 className="text-lg font-bold text-toolia-text">Ajouter mon propre label</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
                  Nom du label
                  <input
                    value={customLabelName}
                    onChange={(event) => setCustomLabelName(event.target.value)}
                    className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
                    placeholder="Ex: Partenariats"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text md:col-span-2">
                  Description ou règle
                  <textarea
                    value={customDescription}
                    onChange={(event) => setCustomDescription(event.target.value)}
                    className="min-h-24 rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
                    placeholder="Optionnel : quels emails doivent aller dans ce label ?"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text md:col-span-2">
                  Exemple d’email
                  <textarea
                    value={customExample}
                    onChange={(event) => setCustomExample(event.target.value)}
                    className="min-h-20 rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
                    placeholder="Ex: Objet ou phrase typique que vous recevez"
                  />
                </label>
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={addCustomLabel}>
                Ajouter mon propre label
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Que doit faire Toolia pour chaque label ?</h2>
              <HelperText>
                Choisissez l’action attendue. Toolia reste prudent : les brouillons sont préparés pour validation.
              </HelperText>
            </div>
            <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
              {!planAllowsCategoryTelegram ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-toolia-text">Alertes Telegram</p>
                  <p className="text-sm text-toolia-text-secondary">
                    Telegram est disponible à partir de l’offre Pro.
                  </p>
                  <Link href="/pricing" className="text-sm font-semibold text-toolia-text underline">
                    Passez à Pro pour activer les alertes Telegram.
                  </Link>
                </div>
              ) : (
                <>
                  <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
                    Alertes Telegram
                    <select
                      value={telegramPreference}
                      onChange={(event) =>
                        changeTelegramPreference(event.target.value as (typeof telegramPreferences)[number])
                      }
                      className="rounded-card border border-toolia-border-subtle bg-toolia-card px-4 py-3 text-toolia-text outline-none"
                    >
                      {Object.entries(telegramLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-3 text-sm text-toolia-text-secondary">{telegramHelp[telegramPreference]}</p>
                  {!telegramConnected && telegramPreference !== 'none' && (
                    <p className="mt-2 text-sm text-toolia-warning">
                      Connectez Telegram depuis le tableau de bord avant d’activer les alertes.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-4">
              {selectedCategories.map((category) => (
                <div key={category.key} className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-toolia-text">{category.label}</h3>
                    {category.description && (
                      <p className="mt-1 text-sm text-toolia-text-secondary">{category.description}</p>
                    )}
                  </div>
                  <ActionToggles
                    actions={category.actions}
                    telegramDisabled={telegramDisabled}
                    telegramDisabledReason={telegramDisabledReason}
                    onChange={(action, checked) => updateCategoryAction(category.key, action, checked)}
                  />
                  {category.actions.archive && (
                    <p className="mt-3 text-sm text-toolia-info">{actionHelp.archive}</p>
                  )}
                  <textarea
                    value={category.description}
                    onChange={(event) => updateCategory(category.key, { description: event.target.value })}
                    className="min-h-24 w-full rounded-card border border-toolia-border-subtle bg-toolia-card px-3 py-2 text-sm text-toolia-text outline-none focus:border-toolia-primary"
                  />
                  {'exampleEmail' in category && category.exampleEmail && (
                    <p className="mt-2 text-xs text-toolia-text-secondary">Exemple : {category.exampleEmail}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-toolia-text">Ton des brouillons</h3>
                  <p className="text-sm text-toolia-text-secondary">
                    Comparez le même email avec chaque ton, puis choisissez celui qui ressemble le plus à votre manière de répondre.
                  </p>
                </div>
                <div className="mt-4 rounded-card border border-toolia-border-subtle bg-toolia-bg-main/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-toolia-text-muted">Email reçu</p>
                  <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-toolia-text-secondary">{sharedToneExampleEmail}</pre>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {(Object.keys(toneLabels) as OnboardingAnswers['draftTone'][]).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setDraftTone(tone)}
                      className={`rounded-card border p-4 text-left transition hover:border-toolia-info ${
                        draftTone === tone
                          ? 'border-toolia-info bg-toolia-info/15 shadow-soft'
                          : 'border-toolia-border-subtle bg-toolia-card'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-base font-bold text-toolia-text">{toneLabels[tone]}</span>
                          <span className="mt-1 block text-sm text-toolia-text-secondary">{toneHelp[tone]}</span>
                        </span>
                        {draftTone === tone && <Check size={18} className="shrink-0 text-toolia-success" />}
                      </span>
                      <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-card bg-toolia-bg-secondary p-3 text-xs leading-5 text-toolia-text-secondary">
                        {getToneExample(tone, customDraftInstructions)}
                      </pre>
                    </button>
                  ))}
                </div>
                <label className="mt-5 flex flex-col gap-2 text-sm font-medium text-toolia-text">
                  Instructions personnalisées
                  <span className="text-sm font-normal text-toolia-text-secondary">
                    Ajoutez ici vos préférences de ton. Par exemple : phrases courtes, tutoiement, ton très premium, éviter les formules trop longues, etc.
                  </span>
                  <textarea
                    value={customDraftInstructions}
                    maxLength={1000}
                    onChange={(event) => setCustomDraftInstructions(event.target.value.slice(0, 1000))}
                    className="min-h-32 rounded-card border border-toolia-border bg-toolia-bg-secondary px-4 py-3 text-sm leading-6 text-toolia-text outline-none transition placeholder:text-toolia-text-muted focus:border-toolia-info focus:ring-2 focus:ring-toolia-info/30"
                    placeholder="Exemple : Je veux des réponses courtes, professionnelles, avec un ton humain. Éviter les phrases trop commerciales."
                  />
                  <span className="text-xs text-toolia-text-muted">{customDraftInstructions.length}/1000 caractères</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex flex-col gap-2 rounded-card border border-toolia-warning/30 bg-toolia-warning/10 p-4">
            <p className="text-sm font-medium text-toolia-text">{error}</p>
            {(error.includes('limite de labels') || error.includes('offre actuelle')) && (
              <Link href="/pricing" className="text-sm font-semibold text-toolia-text underline">
                Améliorer mon offre
              </Link>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 && !returnToSettings}
            onClick={() => {
              if (step === 0 && returnToSettings) {
                router.push('/dashboard/settings')
                return
              }
              setStep((current) => Math.max(0, current - 1))
            }}
          >
            Retour
          </Button>
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 2 && !validateVolumeStep()) return
                trackCurrentOnboardingStep(step)
                setStep((current) => Math.min(totalSteps - 1, current + 1))
              }}
            >
              Continuer
            </Button>
          ) : (
            <Button type="button" onClick={() => void saveAnswers()}>
              Préparer la connexion Gmail
            </Button>
          )}
        </div>
      </AppCard>
    </SaasShell>
  )
}

export function GmailSetupClient() {
  const router = useRouter()
  const [session, setSession] = useState<DemoSession | null>(null)
  const [fromDashboard, setFromDashboard] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [gmailError, setGmailError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!hasValidSession(storedSession)) {
        router.replace('/signup')
        return
      }

      setSession(storedSession)
      setFromDashboard(new URLSearchParams(window.location.search).get('from') === 'dashboard')
    }

    void load()
    return () => {
      active = false
    }
  }, [router])

  const demo = isDemoSession(session)
  const connectGmail = async () => {
    setGmailError('')
    setOauthLoading(true)

    try {
      trackEvent('gmail_connect_started', { source: fromDashboard ? 'dashboard' : 'onboarding' })
      await startGoogleOAuth(fromDashboard ? 'dashboard' : 'onboarding')
    } catch (error) {
      setGmailError(error instanceof Error ? error.message : 'Connexion Gmail impossible.')
      setOauthLoading(false)
    }
  }

  return (
    <SaasShell
      eyebrow="Gmail"
      title="Connexion Gmail sécurisée"
      description="Vous serez redirigé vers Google pour autoriser Toolia. Toolia ne vous demandera jamais votre mot de passe Gmail."
      showDemoNotice={allowDemoMode && demo}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AppCard>
          <div className="flex items-start gap-4">
            <Mail className="mt-1 text-toolia-info" />
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Connecter Gmail</h2>
              <p className="mt-3 text-sm text-toolia-text-secondary">
                Autorisez Toolia depuis Google pour créer vos labels, lire les emails à traiter et préparer vos brouillons dans Gmail.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            onClick={() => void connectGmail()}
            disabled={oauthLoading}
            isLoading={oauthLoading}
          >
            Connecter mon Gmail avec Google
          </Button>
          <p className="mt-3 text-sm text-toolia-text-secondary">
            Toolia utilise l’autorisation Google sécurisée et ne vous demande jamais votre mot de passe Gmail.
          </p>
          {gmailError && <p className="mt-3 text-sm font-medium text-toolia-danger">{gmailError}</p>}
        </AppCard>
        <AppCard>
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 text-toolia-success" />
            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Ce que Toolia ne fait jamais</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-toolia-text-secondary">
                <li>Toolia ne demande jamais votre mot de passe Gmail.</li>
                <li>Vous vous connecterez via Google.</li>
                <li>Les brouillons ne sont jamais envoyés sans validation.</li>
                <li>Les emails ne sont jamais supprimés définitivement.</li>
              </ul>
            </div>
          </div>
        </AppCard>
      </div>
    </SaasShell>
  )
}

export function ProfileGeneratorClient() {
  const router = useRouter()
  const generatedOnce = useRef(false)
  const [profile, setProfile] = useState<AutomationProfile | null>(null)
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null)
  const [plan, setPlan] = useState<PlanOption | null>(null)
  const [session, setSession] = useState<DemoSession | null>(null)
  const [showTechnical, setShowTechnical] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function prepare() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!hasValidSession(storedSession)) {
        router.replace('/signup')
        return
      }

      setSession(storedSession)
      setPlan(getStoredPlan())
      const searchParams = new URLSearchParams(window.location.search)
      const gmailStatus = searchParams.get('gmail')
      if (gmailStatus === 'connected' || gmailStatus === 'connected_no_refresh_token') {
        trackEvent('gmail_connected', { source: 'onboarding' })
        writeStorage(storageKeys.gmail, {
          connected: true,
          mode: 'live',
          passwordRequestedByToolia: false,
        })
      }
      const persisted = await loadPersistedState(storedSession)
      if (active && persisted?.gmail) {
        writeStorage(storageKeys.gmail, persisted.gmail)
      }
      if (active) {
        const persistedPlan = normalizePersistedPlan(persisted?.plan || null)
        if (persistedPlan) {
          setPlan(persistedPlan)
          writeStorage(storageKeys.plan, persistedPlan)
        }
      }

      if (generatedOnce.current) return
      generatedOnce.current = true

      await generateProfile()
    }

    async function generateProfile() {
      const storedAnswers = readStorage<OnboardingAnswers | null>(storageKeys.answers, null)
      const storedProfile = normalizeProfile(readStorage<AutomationProfile | null>(storageKeys.profile, null))
      const generationDone = readStorage<boolean>(storageKeys.generationDone, false)
      setAnswers(storedAnswers)
      if (storedProfile && generationDone) {
        setProfile(storedProfile)
        return
      }

      if (!storedAnswers) {
        setError('Aucune réponse trouvée. Reprenez la configuration pour continuer.')
        return
      }

      const startedAt = Date.now()
      const token = await getSupabaseAccessToken()
      if (!token) {
        setError('Connectez-vous avant de préparer votre configuration.')
        return
      }

      const response = await fetch('/api/automation/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: storedAnswers }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.error || 'Impossible de préparer votre configuration.')
        return
      }

      const remaining = Math.max(0, 3200 - (Date.now() - startedAt))
      await new Promise((resolve) => setTimeout(resolve, remaining))

      const preparedProfile = normalizeProfile(data.profile)
      setProfile(preparedProfile)
      writeStorage(storageKeys.profile, preparedProfile)
      writeStorage(storageKeys.generationDone, true)

      if (process.env.NODE_ENV !== 'production' && preparedProfile && storedAnswers) {
        console.info('[saas/profile] generated category action payload', {
          categories: preparedProfile.categories.map((category) => {
            const answerCategory = storedAnswers.categories.find(
              (item) => item.selected && (item.key === category.id || normalizeName(item.label) === normalizeName(category.name)),
            )
            return {
              category: category.name,
              uiDraft: Boolean(answerCategory?.actions.draft),
              payloadDraft: Boolean(category.actions.draft || category.draft_reply.enabled),
              payloadLabel: Boolean(category.actions.label),
              payloadArchive: Boolean(category.actions.archive),
              payloadTelegram: Boolean(category.actions.telegram),
            }
          }),
        })
      }
    }

    void prepare().catch((profileError) => {
      setError(profileError instanceof Error ? profileError.message : 'Erreur inconnue')
    })

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (profile || error) return

    const interval = window.setInterval(() => {
      setGenerationStep((current) => Math.min(generationSteps.length - 1, current + 1))
    }, 650)

    return () => window.clearInterval(interval)
  }, [profile, error])

  const demo = isDemoSession(session)
  const recommendedPlan = profile
    ? recommendPlan({
        labelsCount: profile.categories.length,
        emailVolume: answers?.emailVolume,
        estimatedDailyEmailCount: answers?.estimatedDailyEmailCount || profile.business_context.estimated_daily_email_count || null,
        draftCategoriesCount: profile.categories.filter((category) => category.actions.draft).length,
        telegramCategoriesCount: profile.categories.filter((category) => category.actions.telegram).length,
      })
    : null
  const summaryPlanAllowsTelegram = plan ? getPlanLimits(plan.id).telegramCategoryAlerts : false
  const telegramSummaryLabel = !plan
    ? 'Offre à confirmer'
    : !summaryPlanAllowsTelegram
      ? 'Indisponibles avec l’offre Starter'
      : telegramLabels[(answers?.telegramPreference || 'none') as OnboardingAnswers['telegramPreference']]

  return (
    <SaasShell
      eyebrow="Configuration"
      title="Votre configuration est prête"
      description="Voici le résumé de ce que Toolia va préparer pour votre boîte Gmail."
      showDemoNotice={allowDemoMode && demo}
    >
      <AppCard>
        {!profile && !error && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-toolia-info/40 bg-toolia-info/10">
                <Sparkles className="animate-pulse text-toolia-info" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-toolia-text">Toolia prépare votre configuration</h2>
                <p className="text-sm text-toolia-text-secondary">Quelques secondes pour transformer vos réponses en parcours prêt à activer.</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-toolia-card-hover">
              <div
                className="h-full rounded-full bg-toolia-info transition-all duration-700 ease-out"
                style={{ width: `${((generationStep + 1) / generationSteps.length) * 100}%` }}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {generationSteps.map((stepLabel, index) => (
                <div
                  key={stepLabel}
                  className={`rounded-card border p-3 text-sm transition-all duration-500 ${
                    index <= generationStep
                      ? 'border-toolia-info/50 bg-toolia-info/10 text-toolia-text'
                      : 'border-toolia-border-subtle bg-toolia-card-hover text-toolia-text-muted'
                  }`}
                >
                  {index < generationStep ? <Check size={16} className="mb-2 text-toolia-success" /> : <Sparkles size={16} className="mb-2 text-toolia-info" />}
                  {stepLabel}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-4">
            <StatusPill tone="danger">À compléter</StatusPill>
            <p className="text-toolia-text-secondary">{error}</p>
            <NextLink href="/onboarding">Reprendre la configuration</NextLink>
          </div>
        )}

        {profile && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone="success">Configuration prête</StatusPill>
              <StatusPill tone="info">{plan?.name || 'Offre à confirmer'}</StatusPill>
              {recommendedPlan && (
                <StatusPill tone={recommendedPlan.id === 'premium' ? 'warning' : 'info'}>
                  {recommendedPlan.id === 'premium'
                    ? 'Votre configuration est intensive. Pack recommandé : Premium.'
                    : `Pack recommandé : ${recommendedPlan.name}`}
                </StatusPill>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                <p className="text-sm text-toolia-text-secondary">Objectif</p>
                <p className="mt-1 font-semibold text-toolia-text">{answers?.mainGoal || profile.business_context.main_goal}</p>
              </div>
              <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                <p className="text-sm text-toolia-text-secondary">Ton des réponses préparées</p>
                <p className="mt-1 font-semibold text-toolia-text">
                  {toneLabels[(answers?.draftTone || 'professionnel') as OnboardingAnswers['draftTone']]}
                </p>
              </div>
              <div className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                <p className="text-sm text-toolia-text-secondary">Alertes Telegram</p>
                <p className="mt-1 font-semibold text-toolia-text">
                  {telegramSummaryLabel}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Labels Gmail à préparer</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {profile.categories.map((category) => (
                  <div key={category.id} className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                    <p className="font-semibold text-toolia-text">{category.gmail_label.replace(/^Toolia\//, '')}</p>
                    <p className="mt-1 text-sm text-toolia-text-secondary">{selectedActionLabels(category.actions)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-toolia-text">Règles de sécurité</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {summarySafetyItems().map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-card bg-toolia-card-hover p-3 text-sm text-toolia-text-secondary">
                    <Check size={16} className="mt-0.5 shrink-0 text-toolia-success" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setShowTechnical((current) => !current)}
                className="text-left text-sm font-semibold text-toolia-text-secondary transition hover:text-toolia-text"
              >
                {showTechnical ? 'Masquer les détails techniques' : 'Afficher les détails techniques'}
              </button>
              <NextLink href="/onboarding/preview">Continuer vers l’activation</NextLink>
            </div>
            {showTechnical && (
              <pre className="max-h-[420px] overflow-auto rounded-card border border-toolia-border-subtle bg-toolia-bg-main p-4 text-xs leading-relaxed text-toolia-text">
                {JSON.stringify(profile, null, 2)}
              </pre>
            )}
          </div>
        )}
      </AppCard>
    </SaasShell>
  )
}

export function ActivationPreviewClient() {
  const router = useRouter()
  const [profile, setProfile] = useState<AutomationProfile | null>(null)
  const [labels, setLabels] = useState<GmailLabelResult[]>([])
  const [session, setSession] = useState<DemoSession | null>(null)
  const [plan, setPlan] = useState<PlanOption | null>(null)
  const [gmailState, setGmailState] = useState<GmailConnectionState | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!hasValidSession(storedSession)) {
        router.replace('/signup')
        return
      }

      const storedProfile = normalizeProfile(readStorage<AutomationProfile | null>(storageKeys.profile, null))
      const storedGmail = readStorage<GmailConnectionState | null>(storageKeys.gmail, null)
      setProfile(storedProfile)
      setSession(storedSession)
      setPlan(getStoredPlan())
      setGmailState(storedGmail)

      if (storedProfile) {
        setLabels(
          storedProfile.categories.map((category) => ({
            id: category.id,
            name: category.gmail_label,
            created: false,
            mode: 'demo' as const,
          })),
        )
      }

      const persisted = await loadPersistedState(storedSession)
      if (!active) return
      if (!persisted?.ok) {
        setInitializing(false)
        return
      }

      if (persisted.gmail) {
        setGmailState(persisted.gmail)
        writeStorage(storageKeys.gmail, persisted.gmail)
      }
      if (persisted.plan) {
        const persistedPlan = normalizePersistedPlan(persisted.plan)
        setPlan(persistedPlan)
        if (persistedPlan) writeStorage(storageKeys.plan, persistedPlan)
      }
      setInitializing(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [router])

  const demo = isDemoSession(session)
  const testMode = allowDemoMode && (
    demo ||
    gmailState?.mode === 'test' ||
    gmailState?.mode === 'demo' ||
    gmailState?.mode === 'pending'
  )
  const realActivationReady = Boolean(session?.mode === 'account' && plan?.paid && gmailState?.connected)
  const canActivate = Boolean(profile && session && (testMode || realActivationReady))
  const disabledReasons = !testMode
    ? [
        !plan ? 'Choisissez une offre pour activer Toolia.' : null,
        plan && !plan.paid ? 'Le paiement doit être validé avant activation.' : null,
        !gmailState?.connected ? 'Connectez Gmail pour activer Toolia.' : null,
      ].filter((reason): reason is string => Boolean(reason))
    : []

  const activate = async () => {
    if (!profile || !canActivate) return
    setLoading(true)
    setError('')

    try {
      const currentSession = getSession()
      if (!currentSession) {
        router.push('/signup')
        return
      }

      const editingExistingAutomation = readStorage<boolean>(storageKeys.editMode, false)
      if (currentSession.mode === 'account' && !editingExistingAutomation) {
        const state = await getTooliaClientState()
        if (state.hasAutomation) {
          setError('Une automatisation existe déjà. Utilisez Modifier depuis le tableau de bord pour changer la configuration.')
          setLoading(false)
          return
        }
      }

      const token = currentSession.mode === 'account' ? await getSupabaseAccessToken() : null
      if (currentSession.mode === 'account' && !token) {
        throw new Error('Connectez-vous pour activer Toolia.')
      }

      const latestAnswers = readStorage<OnboardingAnswers | null>(storageKeys.answers, null)
      const draftConsistencyIssues = findDraftConsistencyIssues(profile, latestAnswers)
      if (draftConsistencyIssues.length > 0) {
        throw new Error(
          `Configuration incohérente : Brouillon est coché pour ${draftConsistencyIssues
            .map((issue) => issue.category)
            .join(', ')}, mais le profil à sauvegarder indique Brouillon désactivé. Revenez à l’étape Actions et enregistrez à nouveau.`,
        )
      }

      const response = await fetch('/api/automation/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: currentSession.mode,
          activationMode: testMode ? 'test' : 'live',
          editing: editingExistingAutomation,
          profile,
          answers: latestAnswers,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'Activation impossible')

      if (process.env.NODE_ENV !== 'production') {
        console.info('[saas/activation] category actions persisted', {
          categories: profile.categories.map((category) => {
            const answerCategory = latestAnswers?.categories.find(
              (item) => item.selected && (item.key === category.id || normalizeName(item.label) === normalizeName(category.name)),
            )
            const savedCategory = Array.isArray(data.categorySummary)
              ? data.categorySummary.find(
                  (item: { category?: string }) => item.category && normalizeName(item.category) === normalizeName(category.name),
                )
              : null
            return {
              category: category.name,
              uiDraft: Boolean(answerCategory?.actions.draft),
              payloadDraft: Boolean(category.actions.draft || category.draft_reply.enabled),
              savedSupabaseDraft: savedCategory ? Boolean(savedCategory.draftEnabled) : null,
              savedSupabaseLabel: savedCategory ? Boolean(savedCategory.labelEnabled) : null,
              savedSupabaseArchive: savedCategory ? Boolean(savedCategory.archiveEnabled) : null,
              savedSupabaseTelegram: savedCategory ? Boolean(savedCategory.telegramEnabled) : null,
            }
          }),
        })
      }

      const dashboardState: DashboardState = {
        status: data.status,
        subscriptionStatus: data.subscriptionStatus || (testMode ? 'demo' : 'active'),
        gmailConnected: testMode ? false : Boolean(gmailState?.connected),
        labels: data.labels,
        logs: data.logs,
      }

      writeStorage(storageKeys.dashboard, dashboardState)
      removeStorage(storageKeys.editMode)
      router.push('/dashboard')
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <SaasShell
        eyebrow="Activation"
        title="Dernière vérification"
        description="Toolia vérifie votre configuration, votre offre et votre connexion Gmail avant l’activation."
      >
        <NeutralLoadingState
          title="Vérification de votre configuration..."
          description="Nous confirmons les données nécessaires avant d’afficher les éventuels points à compléter."
        />
      </SaasShell>
    )
  }

  return (
    <SaasShell
      eyebrow="Activation"
      title="Dernière vérification"
      description="Avant d’activer Toolia, votre compte doit être prêt, l’offre validée et Gmail connecté."
      showDemoNotice={allowDemoMode && testMode}
    >
      {!profile ? (
        <AppCard>
          <StatusPill tone="danger">Configuration manquante</StatusPill>
          <p className="mt-4 text-toolia-text-secondary">Préparez d’abord votre configuration.</p>
          <div className="mt-6">
            <NextLink href="/onboarding/profile">Préparer la configuration</NextLink>
          </div>
        </AppCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <AppCard>
            <h2 className="text-2xl font-bold text-toolia-text">Prêt à activer</h2>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 rounded-card bg-toolia-card-hover px-3 py-2">
                <span className="text-sm text-toolia-text-secondary">Compte</span>
                <StatusPill tone={session ? 'success' : 'warning'}>{session ? 'Prêt' : 'À créer'}</StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-card bg-toolia-card-hover px-3 py-2">
                <span className="text-sm text-toolia-text-secondary">Offre</span>
                <StatusPill tone={plan?.paid || testMode ? 'success' : 'warning'}>{plan?.name || 'À choisir'}</StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-card bg-toolia-card-hover px-3 py-2">
                <span className="text-sm text-toolia-text-secondary">Gmail</span>
                <StatusPill tone={gmailState?.connected ? 'success' : testMode ? 'warning' : 'danger'}>
                  {gmailState?.connected ? 'Connecté' : 'À connecter'}
                </StatusPill>
              </div>
            </div>
            {!testMode && disabledReasons.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 text-sm text-toolia-text-secondary">
                {disabledReasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            )}
            {allowDemoMode && testMode && (
              <p className="mt-4 text-sm text-toolia-text-secondary">
                Rien ne sera créé dans un vrai Gmail.
              </p>
            )}
          </AppCard>
          <AppCard>
            <h2 className="text-2xl font-bold text-toolia-text">Labels à créer</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {profileLabels(profile).map((label) => (
                <div key={label} className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-3">
                  <p className="font-semibold text-toolia-text">{label}</p>
                  <p className="text-xs text-toolia-text-secondary">Préparé pour Gmail</p>
                </div>
              ))}
            </div>
            {error && <p className="mt-4 text-sm text-toolia-danger">{error}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/onboarding/profile"
                className="inline-flex items-center justify-center rounded-btn border border-toolia-border-subtle px-4 py-2 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary"
              >
                Retour
              </Link>
              <Button type="button" isLoading={loading} disabled={loading || !canActivate} onClick={activate}>
                Activer Toolia
              </Button>
            </div>
          </AppCard>
        </div>
      )}
    </SaasShell>
  )
}

export function DashboardClient() {
  const router = useRouter()
  const telegramConnectedTracked = useRef(false)
  const [profile, setProfile] = useState<AutomationProfile | null>(null)
  const [state, setState] = useState<DashboardState | null>(null)
  const [plan, setPlan] = useState<PlanOption | null>(null)
  const [session, setSession] = useState<DemoSession | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<DashboardState['subscriptionStatus'] | null>(null)
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null)
  const [gmailState, setGmailState] = useState<GmailConnectionState | null>(null)
  const [telegramState, setTelegramState] = useState<TelegramConnectionState | null>(null)
  const [telegramConnect, setTelegramConnect] = useState<TelegramConnectState | null>(null)
  const [telegramBusy, setTelegramBusy] = useState(false)
  const [billing, setBilling] = useState<BillingState | null>(null)
  const [aiStatus, setAiStatus] = useState<AiProviderState | null>(null)
  const [usage, setUsage] = useState<UsageSnapshotState | null>(null)
  const [styleProfile, setStyleProfile] = useState<WritingStyleProfileState | null>(null)
  const [telegramResult, setTelegramResult] = useState('')
  const [billingResult, setBillingResult] = useState('')
  const [gmailResult, setGmailResult] = useState('')
  const [learningResult, setLearningResult] = useState('')
  const [learningError, setLearningError] = useState('')
  const [classificationResult, setClassificationResult] = useState('')
  const [classificationError, setClassificationError] = useState('')
  const [classificationSummary, setClassificationSummary] = useState<ClassificationSummary | null>(null)
  const [classificationCards, setClassificationCards] = useState<ClassificationResultCard[]>([])
  const [classificationLimit, setClassificationLimit] = useState<5 | 10 | 20>(5)
  const [includeAlreadyAnalyzed, setIncludeAlreadyAnalyzed] = useState(false)
  const [manualCategoryByMessage, setManualCategoryByMessage] = useState<Record<string, string>>({})
  const [classificationBusyMessageId, setClassificationBusyMessageId] = useState<string | null>(null)
  const [manualLabelBusyMessageId, setManualLabelBusyMessageId] = useState<string | null>(null)
  const [draftResult, setDraftResult] = useState('')
  const [draftError, setDraftError] = useState('')
  const [draftRetryable, setDraftRetryable] = useState(false)
  const [draftPreview, setDraftPreview] = useState('')
  const [incomingEmail, setIncomingEmail] = useState(
    'Bonjour, pouvez-vous me confirmer vos disponibilités cette semaine pour avancer sur notre projet ? J’aimerais aussi connaître les prochaines étapes et les éléments dont vous avez besoin de notre côté.',
  )
  const [dashboardLoaded, setDashboardLoaded] = useState(false)
  const [dashboardLoadError, setDashboardLoadError] = useState('')
  const [gmailBusy, setGmailBusy] = useState(false)
  const [learningBusy, setLearningBusy] = useState(false)
  const [classificationBusy, setClassificationBusy] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!storedSession) {
        router.replace('/login')
        return
      }

      setSession(storedSession)
      setDashboardLoadError('')
      const dashboardSearchParams = new URLSearchParams(window.location.search)
      const gmailStatus = dashboardSearchParams.get('gmail')
      const checkoutStatus = dashboardSearchParams.get('checkout')
      const upgradeStatus = dashboardSearchParams.get('upgrade')
      if (upgradeStatus === 'success') {
        setBillingResult('Paiement confirmé. Mise à jour de votre offre en cours...')
      }
      if (gmailStatus === 'connected') setGmailResult('Gmail est connecté.')
      if (gmailStatus === 'connected_no_refresh_token') setGmailResult('Gmail est connecté. Google n’a pas renvoyé de refresh token.')
      if (gmailStatus === 'already_connected') setGmailResult('Gmail est déjà connecté.')
      if (gmailStatus === 'cancelled') setGmailResult('Autorisation Google annulée.')
      if (gmailStatus === 'failed') setGmailResult('La connexion Gmail a échoué.')

      const persisted = await loadPersistedState(storedSession)
      if (!active) return
      if (!persisted?.ok) {
        setDashboardLoadError('Synchronisation de votre espace impossible pour le moment.')
        setDashboardLoaded(true)
        return
      }

      const persistedPlan = normalizePersistedPlan(persisted.plan)
      const persistedProfile = normalizeProfile(persisted.profile || null)

      if (checkoutStatus === 'success') {
        trackEvent('checkout_completed', planAnalyticsParams(persistedPlan))
      }

      if (gmailStatus === 'connected' || gmailStatus === 'connected_no_refresh_token' || gmailStatus === 'already_connected') {
        trackEvent('gmail_connected', { source: 'dashboard' })
      }

      setPlan(persistedPlan)
      if (persistedPlan) writeStorage(storageKeys.plan, persistedPlan)
      else removeStorage(storageKeys.plan)

      if (persisted.answers) {
        setAnswers(persisted.answers)
        writeStorage(storageKeys.answers, persisted.answers)
      }

      setProfile(persistedProfile)
      if (persistedProfile) writeStorage(storageKeys.profile, persistedProfile)
      else removeStorage(storageKeys.profile)

      setState(persisted.dashboard || null)
      if (persisted.dashboard) writeStorage(storageKeys.dashboard, persisted.dashboard)
      else removeStorage(storageKeys.dashboard)

      setGmailState(persisted.gmail || null)
      if (persisted.gmail) writeStorage(storageKeys.gmail, persisted.gmail)
      else removeStorage(storageKeys.gmail)

      setTelegramState(persisted.telegram || null)
      if (persisted.telegram) writeStorage(storageKeys.telegram, persisted.telegram)
      else removeStorage(storageKeys.telegram)

      setAiStatus(persisted.ai || null)

      setUsage(persisted.usage || null)
      setBilling(persisted.billing || null)
      setStyleProfile(persisted.styleProfile || null)
      setDashboardLoaded(true)

      if (upgradeStatus === 'success') {
        ;[1, 2, 3, 4, 5].forEach((attempt) => {
          window.setTimeout(() => {
            void loadPersistedState(storedSession).then((refreshed) => {
              if (!active || !refreshed?.ok) return

              const refreshedPlan = normalizePersistedPlan(refreshed.plan)
              const refreshedProfile = normalizeProfile(refreshed.profile || null)

              setPlan(refreshedPlan)
              if (refreshedPlan) writeStorage(storageKeys.plan, refreshedPlan)
              else removeStorage(storageKeys.plan)

              setProfile(refreshedProfile)
              if (refreshedProfile) writeStorage(storageKeys.profile, refreshedProfile)
              else removeStorage(storageKeys.profile)

              setState(refreshed.dashboard || null)
              if (refreshed.dashboard) writeStorage(storageKeys.dashboard, refreshed.dashboard)
              else removeStorage(storageKeys.dashboard)

              setUsage(refreshed.usage || null)
              setBilling(refreshed.billing || null)
              setStyleProfile(refreshed.styleProfile || null)
              setGmailState(refreshed.gmail || null)
              if (refreshed.gmail) writeStorage(storageKeys.gmail, refreshed.gmail)
              else removeStorage(storageKeys.gmail)
              setTelegramState(refreshed.telegram || null)
              if (refreshed.telegram) writeStorage(storageKeys.telegram, refreshed.telegram)
              else removeStorage(storageKeys.telegram)
              setAiStatus(refreshed.ai || null)

              if (refreshedPlan?.paid) {
                setBillingResult(`Offre ${refreshedPlan.name} active.`)
              } else if (attempt === 5) {
                setBillingResult('Paiement confirmé. Mise à jour de votre offre en cours...')
              }
            })
          }, attempt * 2000)
        })
      }
    }

    void load().catch(() => {
      if (!active) return
      setDashboardLoadError('Synchronisation de votre espace impossible pour le moment.')
      setDashboardLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const demo = isDemoSession(session)
  const testActive = allowDemoMode && (demo || state?.status === 'active_test' || state?.subscriptionStatus === 'demo')
  const automationRunning = state?.status === 'active' || state?.status === 'active_test'
  const validSession = hasValidSession(session)
  const configuredDraftCount = profile?.categories.filter((category) => category.actions.draft).length || 0
  const draftCount = configuredDraftCount + (state?.draftTestCount || 0)
  const telegramCount = profile?.categories.filter((category) => category.actions.telegram).length || 0
  const telegramAllowedByPlan = plan ? getPlanLimits(plan.id).telegramCategoryAlerts : false
  const activeLabels = profile?.categories.map((category) => category.name).join(', ') || 'Aucun label actif'
  const enabledActionKeys = actionOrder.filter((action) =>
    profile?.categories.some((category) => category.actions[action]),
  )
  const enabledActions = enabledActionKeys.map((action) => actionLabels[action]).join(', ') || 'Label'
  const customDraftInstructionPreview = (
    answers?.customDraftInstructions ||
    profile?.global_settings.custom_draft_instructions ||
    ''
  ).trim()
  const draftToneKey = (answers?.draftTone ||
    profile?.global_settings.default_tone ||
    'professionnel') as OnboardingAnswers['draftTone']
  const draftTone = toneLabels[draftToneKey]
  const addressingModeLabel = getAddressingModeLabel(customDraftInstructionPreview, draftToneKey)
  let telegramSetting = answers?.telegramPreference
    ? telegramLabels[answers.telegramPreference]
    : profile?.global_settings.telegram_enabled
      ? 'Activé'
      : 'Désactivé'
  if (!answers?.telegramPreference && profile?.global_settings.telegram_preference) {
    telegramSetting = telegramLabels[profile.global_settings.telegram_preference]
  }
  const gmailNeedsModifyScope = Boolean(state?.gmailConnected && gmailState?.connected && !gmailState?.hasModifyScope)
  const gmailNeedsScopeUpgrade = gmailNeedsModifyScope
  const canCreateAiDraft = Boolean(state?.gmailConnected && gmailState?.hasModifyScope && aiStatus?.configured)
  const canAnalyzeWritingStyle = Boolean(state?.gmailConnected && gmailState?.hasModifyScope && aiStatus?.configured)
  const canAnalyzeRecentEmails = Boolean(state?.gmailConnected && gmailState?.hasModifyScope && aiStatus?.configured)
  const usageItems = usage
    ? [
        { value: usage.current.emailsProcessed ?? usage.current.emailsAnalyzed, limit: usage.limits.emailAnalysesMonthly },
        { value: usage.current.aiDraftsCreated, limit: usage.limits.aiDraftsMonthly },
        { value: usage.current.telegramAlertsSent, limit: usage.limits.telegramAlertsMonthly },
        { value: usage.current.styleAnalysesUsed, limit: usage.limits.styleAnalysesMonthly },
      ]
    : []
  const usageAboveWarning = usageItems.some((item) => item.limit > 0 && item.value / item.limit >= 0.8)
  const usageExceeded = usageItems.some((item) => item.limit > 0 && item.value >= item.limit)
  const draftQuotaReached = Boolean(usage && usage.remaining.aiDraft <= 0)
  const styleQuotaReached = Boolean(usage && usage.remaining.styleAnalysis <= 0)
  const emailAnalysisQuotaReached = Boolean(usage && usage.remaining.emailAnalysis <= 0)
  const canCreateAiDraftNow = canCreateAiDraft && !draftQuotaReached
  const canAnalyzeWritingStyleNow = canAnalyzeWritingStyle && !styleQuotaReached
  const canAnalyzeRecentEmailsNow = canAnalyzeRecentEmails && !emailAnalysisQuotaReached
  const dashboardStatusItems = [
    {
      label: 'Gmail',
      value: state?.gmailConnected
        ? gmailNeedsScopeUpgrade
          ? 'Autorisation à mettre à jour'
          : 'Connecté'
        : 'À connecter',
      tone: state?.gmailConnected && !gmailNeedsScopeUpgrade ? 'success' : 'warning',
    },
    {
      label: 'Offre',
      value: plan?.paid ? `${plan.name} active` : plan?.name || 'Offre à choisir',
      tone: plan?.paid ? 'success' : 'info',
    },
    {
      label: 'Automatisation',
      value: automationRunning ? 'Active' : 'En pause',
      tone: automationRunning ? 'success' : 'warning',
    },
    {
      label: 'Telegram',
      value: !telegramAllowedByPlan ? 'Non inclus' : telegramState?.connected ? 'Connecté' : 'À connecter',
      tone: !telegramAllowedByPlan ? 'warning' : telegramState?.connected ? 'success' : 'info',
    },
  ] as const

  const toggleAutomation = async () => {
    if (!state) return
    setBusy(true)

    const currentSession = getSession()
    if (!currentSession) {
      setBusy(false)
      router.push('/signup')
      return
    }

    const endpoint = automationRunning ? '/api/automation/pause' : '/api/automation/resume'
    const token = currentSession.mode === 'account' ? await getSupabaseAccessToken() : null
    if (currentSession.mode === 'account' && !token) {
      setBusy(false)
      router.push('/login')
      return
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        mode: currentSession.mode,
        activationMode: testActive ? 'test' : 'live',
      }),
    })
    const data = await response.json()
    const localLog: ProcessingLog = {
      id: `local_${Date.now()}`,
      created_at: new Date().toISOString(),
      level: 'info',
      message: data.status === 'active' || data.status === 'active_test' ? 'Automatisation reprise.' : 'Automatisation mise en pause.',
    }
    const nextState: DashboardState = {
      ...state,
      status: data.status,
      logs: data.logs?.length ? data.logs : [localLog, ...state.logs],
    }

    setState(nextState)
    writeStorage(storageKeys.dashboard, nextState)
    setBusy(false)
  }

  const refreshAccountState = async () => {
    const currentSession = getSession()
    const refreshed = await loadPersistedState(currentSession)
    if (!refreshed?.ok) return refreshed

    if (refreshed.telegram) {
      setTelegramState(refreshed.telegram)
      writeStorage(storageKeys.telegram, refreshed.telegram)
    }
    if (refreshed.usage) setUsage(refreshed.usage)
    return refreshed
  }

  const startTelegramConnection = async () => {
    setTelegramResult('')
    setTelegramBusy(true)
    trackEvent('telegram_connect_started', { cta_location: 'dashboard' })

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous pour connecter Telegram.')

      const response = await fetch('/api/telegram/connect/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Connexion Telegram impossible.')

      setTelegramConnect({
        botLink: data.botLink,
        botUsername: data.botUsername,
        startCommand: data.startCommand,
        qrCodeDataUrl: data.qrCodeDataUrl,
        expiresAt: data.expiresAt,
      })
      setTelegramResult('Ouvrez Telegram puis envoyez la commande /start préremplie. Si elle n’apparaît pas, copiez la commande affichée.')

      ;[1, 2, 3, 4, 5, 6, 7, 8].forEach((attempt) => {
        window.setTimeout(() => {
          void refreshAccountState().then((refreshed) => {
            if (refreshed?.telegram?.connected) {
              if (!telegramConnectedTracked.current) {
                telegramConnectedTracked.current = true
                trackEvent('telegram_connected', { source: 'dashboard' })
              }
              setTelegramResult('Telegram connecté.')
              setTelegramConnect(null)
            } else if (attempt === 8) {
              setTelegramResult('Connexion en attente. Envoyez la commande /start affichée dans Telegram, puis actualisez le tableau de bord.')
            }
          })
        }, attempt * 3000)
      })
    } catch (error) {
      setTelegramResult(error instanceof Error ? error.message : 'Connexion Telegram impossible.')
    } finally {
      setTelegramBusy(false)
    }
  }

  const testTelegram = async () => {
    setTelegramResult('')
    setTelegramBusy(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous avant de vérifier Telegram.')
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setTelegramResult(data.ok ? 'Alerte Telegram envoyée.' : data.message || 'Vérification Telegram impossible.')
      await refreshAccountState()
    } catch (error) {
      setTelegramResult(error instanceof Error ? error.message : 'Envoi Telegram impossible.')
    } finally {
      setTelegramBusy(false)
    }
  }

  const disconnectTelegramFromDashboard = async () => {
    setTelegramResult('')
    setTelegramBusy(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous pour déconnecter Telegram.')
      const response = await fetch('/api/telegram/connect/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Déconnexion Telegram impossible.')
      setTelegramConnect(null)
      setTelegramResult(data.message || 'Telegram est déconnecté.')
      await refreshAccountState()
    } catch (error) {
      setTelegramResult(error instanceof Error ? error.message : 'Déconnexion Telegram impossible.')
    } finally {
      setTelegramBusy(false)
    }
  }

  const connectGmailFromDashboard = async (forceConsent = false) => {
    setGmailResult('')
    setGmailBusy(true)

    try {
      trackEvent('gmail_connect_started', { source: 'dashboard', force_consent: forceConsent })
      await startGoogleOAuth('dashboard', { forceConsent })
    } catch (error) {
      setGmailResult(error instanceof Error ? error.message : 'Connexion Gmail impossible.')
      setGmailBusy(false)
    }
  }

  const ensureGmailLabelsFromDashboard = async () => {
    setGmailResult('')
    setGmailBusy(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous avant de créer les labels Gmail.')

      const response = await fetch('/api/gmail/labels/ensure', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await readJsonResponse<{
        ok?: boolean
        message?: string
        created?: GmailLabelResult[]
        existing?: GmailLabelResult[]
        updatedColors?: GmailLabelResult[]
        oldPrefixedLabelsDetected?: string[]
        warnings?: Array<{ name: string; message: string }>
        errors?: Array<{ name: string; message: string }>
      }>(response, '/api/gmail/labels/ensure')

      if (!response.ok || !data.ok) throw new Error(data.message || 'Création des labels Gmail impossible.')

      const nextLabels = [...(data.created || []), ...(data.existing || [])]
      if (nextLabels.length && state) {
        const nextState = {
          ...state,
          gmailConnected: true,
          labels: nextLabels,
        }
        setState(nextState)
        writeStorage(storageKeys.dashboard, nextState)
      }
      const createdCount = data.created?.length || 0
      const existingCount = data.existing?.length || 0
      const updatedColorCount = data.updatedColors?.length || 0
      const messages = [
        `Labels Gmail prêts. ${createdCount} créés, ${existingCount} déjà existants, ${updatedColorCount} couleurs ajoutées.`,
      ]

      if (data.oldPrefixedLabelsDetected?.length) {
        messages.push(
          'Ancienne version détectée : certains labels Toolia/... existent déjà. Vous pouvez les supprimer manuellement dans Gmail si vous n’en voulez plus.',
        )
      }

      if (data.warnings?.length) {
        messages.push('Certains labels sont prêts, mais une couleur n’a pas pu être appliquée.')
      }

      if (data.errors?.length) {
        messages.push(`Certains labels n’ont pas pu être créés : ${data.errors.map((item) => item.name).join(', ')}.`)
      }

      setGmailResult(messages.join(' '))
    } catch (error) {
      setGmailResult(error instanceof Error ? error.message : 'Création des labels Gmail impossible.')
    } finally {
      setGmailBusy(false)
    }
  }

  const createAiTestDraft = async () => {
    if (draftBusy) return

    setDraftResult('')
    setDraftError('')
    setDraftRetryable(false)
    setDraftPreview('')
    setDraftBusy(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous avant de créer un brouillon IA.')

      const response = await fetch('/api/gmail/drafts/create-ai-test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ incomingEmail }),
      })
      const data = await readJsonResponse<{
        ok?: boolean
        step?: string
        message?: string
        details?: string
        draftId?: string
        subject?: string
        bodyPreview?: string
        confidence?: 'low' | 'medium' | 'high'
        reasoningSummary?: string
        addressingMode?: 'tu' | 'vous' | 'auto'
        selectedTone?: string
        hasCustomInstructions?: boolean
        customInstructionsPreview?: string
        validationPassed?: boolean
        retryable?: boolean
        sent?: boolean
        usage?: UsageSnapshotState | null
      }>(response, '/api/gmail/drafts/create-ai-test')

      if (!response.ok || !data.ok) {
        const message = data.retryable
          ? 'Le brouillon n’a pas pu être généré. Réessayez dans quelques secondes.'
          : data.message || 'Le brouillon n’a pas pu être généré. Réessayez dans quelques secondes.'
        setDraftError(message)
        setDraftRetryable(Boolean(data.retryable))
        return
      }

      setDraftResult('Brouillon IA créé dans Gmail. Aucun email n’a été envoyé.')
      setDraftError('')
      setDraftRetryable(false)
      setDraftPreview(
        [data.subject, data.bodyPreview]
          .filter(Boolean)
          .join('\n\n'),
      )
      if (data.usage) setUsage(data.usage)

      if (state) {
        const nextState = {
          ...state,
          draftTestCount: (state.draftTestCount || 0) + 1,
        }
        setState(nextState)
        writeStorage(storageKeys.dashboard, nextState)
      }
    } catch (error) {
      setDraftError('Le brouillon n’a pas pu être généré. Réessayez dans quelques secondes.')
      setDraftRetryable(true)
    } finally {
      setDraftBusy(false)
    }
  }

  const analyzeWritingStyle = async () => {
    if (learningBusy) return

    setLearningResult('')
    setLearningError('')
    setLearningBusy(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous avant de lancer l’analyse.')

      const response = await fetch('/api/gmail/learning/analyze-sent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await readJsonResponse<{
        ok?: boolean
        message?: string
        profile?: WritingStyleProfileState
        usage?: UsageSnapshotState | null
      }>(response, '/api/gmail/learning/analyze-sent')

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.message || 'Analyse IA impossible pour le moment.')
      }

      setStyleProfile(data.profile)
      if (data.usage) setUsage(data.usage)
      setLearningResult('Style analysé avec succès.')
    } catch (error) {
      setLearningError(error instanceof Error ? error.message : 'Analyse IA impossible pour le moment.')
    } finally {
      setLearningBusy(false)
    }
  }

  const analyzeRecentEmails = async (options: { messageId?: string } = {}) => {
    if (classificationBusy || classificationBusyMessageId) return

    const singleMessageId = options.messageId || null
    setClassificationResult('')
    setClassificationError('')
    if (!singleMessageId) {
      setClassificationSummary(null)
      setClassificationCards([])
    }
    setClassificationBusy(!singleMessageId)
    setClassificationBusyMessageId(singleMessageId)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous avant d’analyser vos emails.')

      const response = await fetch('/api/gmail/classification/analyze-recent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: classificationLimit,
          includeAlreadyAnalyzed: singleMessageId ? true : includeAlreadyAnalyzed,
          messageId: singleMessageId || undefined,
        }),
      })
      const data = await readJsonResponse<{
        ok?: boolean
        message?: string
        quotaNotice?: string
        usage?: UsageSnapshotState | null
        summary?: ClassificationSummary
        results?: ClassificationResultCard[]
      }>(response, '/api/gmail/classification/analyze-recent')

      if (!response.ok || !data.ok || !data.summary) {
        throw new Error(data.message || 'Analyse impossible pour le moment.')
      }

      if (singleMessageId) {
        const nextCard = data.results?.[0]
        if (nextCard) {
          setClassificationCards((current) =>
            current.map((item) => (item.messageId === singleMessageId ? nextCard : item)),
          )
          setManualCategoryByMessage((current) => ({
            ...current,
            [singleMessageId]: nextCard.category,
          }))
        }
      } else {
        setClassificationSummary(data.summary)
        setClassificationCards(data.results || [])
        setManualCategoryByMessage(
          Object.fromEntries((data.results || []).map((item) => [item.messageId, item.category])),
        )
      }
      if (data.usage) setUsage(data.usage)
      setClassificationResult(
        singleMessageId
          ? 'Email reclassé.'
          : `${data.quotaNotice ? `${data.quotaNotice} ` : ''}${data.summary.analyzed} emails traités, ${data.summary.labelsApplied} labels appliqués, ${data.summary.draftsCreated} brouillons créés, ${data.summary.needsReview} à vérifier.`,
      )
    } catch (error) {
      setClassificationError(error instanceof Error ? error.message : 'Analyse impossible pour le moment.')
    } finally {
      setClassificationBusy(false)
      setClassificationBusyMessageId(null)
    }
  }

  const applyManualLabel = async (item: ClassificationResultCard) => {
    const category = manualCategoryByMessage[item.messageId] || item.category
    if (!category || manualLabelBusyMessageId) return

    setClassificationError('')
    setClassificationResult('')
    setManualLabelBusyMessageId(item.messageId)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous avant d’appliquer un label.')

      const response = await fetch('/api/gmail/classification/apply-label', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: item.messageId,
          category,
        }),
      })
      const data = await readJsonResponse<{ ok?: boolean; message?: string; category?: string }>(
        response,
        '/api/gmail/classification/apply-label',
      )

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Erreur lors de l’application du label.')
      }

      setClassificationCards((current) =>
        current.map((card) =>
          card.messageId === item.messageId
            ? {
                ...card,
                category,
                confidence: 1,
                status: 'processed',
                labelApplied: true,
                labelMappingStatus: 'verified',
                actionTaken: 'Label appliqué manuellement',
                reason: 'Catégorie corrigée manuellement.',
              }
            : card,
        ),
      )
      setClassificationResult('Label appliqué.')
    } catch (error) {
      setClassificationError(error instanceof Error ? error.message : 'Erreur lors de l’application du label.')
    } finally {
      setManualLabelBusyMessageId(null)
    }
  }

  if (!dashboardLoaded) {
    return (
      <SaasShell
        eyebrow="Dashboard"
        title="Chargement de votre espace Toolia"
        description="Toolia synchronise votre offre, vos connexions et votre automatisation."
      >
        <NeutralLoadingState
          title="Chargement de votre espace Toolia..."
          description="Nous récupérons votre statut réel avant d’afficher les alertes Gmail, Telegram, IA ou automatisation."
        />
      </SaasShell>
    )
  }

  if (dashboardLoadError) {
    return (
      <SaasShell
        eyebrow="Dashboard"
        title="Synchronisation impossible"
        description="Votre espace Toolia reste protégé, mais l’état serveur n’a pas pu être confirmé."
      >
        <AppCard>
          <StatusPill tone="warning">Synchronisation</StatusPill>
          <p className="mt-4 text-sm leading-6 text-toolia-text-secondary">{dashboardLoadError}</p>
          <div className="mt-6">
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        </AppCard>
      </SaasShell>
    )
  }

  if (!validSession || !profile || !state) {
    const startHref = validSession ? '/onboarding' : '/signup'
    const startLabel = validSession ? 'Automatiser maintenant' : 'Créer mon espace Toolia'

    return (
      <SaasShell
        eyebrow="Dashboard"
        title="Aucune automatisation active"
        description="Terminez la configuration pour voir votre tableau de bord Toolia."
      >
        <AppCard>
          {billingResult && <p className="mb-4 text-sm font-medium text-toolia-text-secondary">{billingResult}</p>}
          <NextLink href={startHref}>{startLabel}</NextLink>
        </AppCard>
      </SaasShell>
    )
  }

  return (
    <SaasShell
      eyebrow="Dashboard"
      title="Tableau de bord Toolia"
      description="Pilotez votre automatisation, vos labels, vos brouillons et vos alertes."
      showDemoNotice={allowDemoMode && testActive}
    >
      {allowDemoMode && testActive && (
        <div className="rounded-card border border-toolia-info/30 bg-toolia-info/10 px-4 py-3 text-sm font-medium text-toolia-text">
          Cette configuration est inactive tant que Gmail et l’offre ne sont pas validés.
        </div>
      )}

      {billingResult && (
        <div className="rounded-card border border-toolia-info/30 bg-toolia-info/10 px-4 py-3 text-sm font-medium text-toolia-text">
          {billingResult}
        </div>
      )}

      <AppCard className="p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStatusItems.map((item) => (
            <div key={item.label} className="rounded-card border border-toolia-border-subtle bg-toolia-bg-secondary/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-toolia-text-muted">{item.label}</p>
              <div className="mt-2">
                <StatusPill tone={item.tone}>{item.value}</StatusPill>
              </div>
            </div>
          ))}
        </div>
      </AppCard>

      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Connexions et pilotage</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AppCard className="flex h-full flex-col">
          <Mail className="mb-3 text-toolia-info" />
          <h2 className="text-xl font-bold text-toolia-text">Gmail</h2>
          <StatusPill tone={state.gmailConnected && !gmailNeedsScopeUpgrade ? 'success' : 'warning'}>
            {state.gmailConnected
              ? gmailNeedsScopeUpgrade
                ? 'Autorisation Gmail à mettre à jour'
                : 'Connecté'
              : 'À connecter'}
          </StatusPill>
          {state.gmailConnected && gmailState?.googleEmail && (
            <p className="mt-2 text-sm font-medium text-toolia-text">{gmailState.googleEmail}</p>
          )}
          <p className="mt-3 text-sm text-toolia-text-secondary">
            Connectez votre boîte Gmail pour que Toolia puisse créer les labels et préparer les brouillons.
          </p>
          {state.gmailConnected ? (
            <div className="mt-auto flex flex-col gap-2 pt-4">
              {gmailNeedsScopeUpgrade && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void connectGmailFromDashboard(true)}
                  disabled={gmailBusy}
                  isLoading={gmailBusy}
                >
                  Reconnecter Gmail
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={ensureGmailLabelsFromDashboard}
                disabled={gmailBusy}
                isLoading={gmailBusy}
              >
                Créer / vérifier les labels Gmail
              </Button>
              {!gmailNeedsScopeUpgrade && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void connectGmailFromDashboard(true)}
                  disabled={gmailBusy}
                  isLoading={gmailBusy}
                >
                  Reconnecter Gmail
                </Button>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-auto"
              onClick={() => void connectGmailFromDashboard(false)}
              disabled={gmailBusy}
              isLoading={gmailBusy}
            >
              Connecter Gmail
            </Button>
          )}
          {gmailResult && <p className="mt-3 text-sm text-toolia-text-secondary">{gmailResult}</p>}
        </AppCard>
        <AppCard className="flex h-full flex-col">
          <Gauge className="mb-3 text-toolia-info" />
          <h2 className="text-xl font-bold text-toolia-text">Plan</h2>
          <p className="mt-1 font-semibold text-toolia-text">{plan?.name || 'Offre à choisir'}</p>
          <p className="mt-3 text-sm text-toolia-text-secondary">
            Votre offre définit le nombre de labels et les options disponibles.
          </p>
          <div className="mt-auto pt-4">
            <PlanUpgradeButton plan={plan} subscriptionStatus={state?.subscriptionStatus} billing={billing} />
          </div>
        </AppCard>
        <AppCard className="flex h-full flex-col">
          {automationRunning ? <Play className="mb-3 text-toolia-success" /> : <Pause className="mb-3 text-toolia-warning" />}
          <h2 className="text-xl font-bold text-toolia-text">Automatisation</h2>
          <StatusPill tone={automationRunning ? 'success' : 'warning'}>
            {automationRunning ? 'Active' : 'En pause'}
          </StatusPill>
          <p className="mt-3 text-sm text-toolia-text-secondary">
            Toolia applique vos règles sur les emails entrants.
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <Button type="button" variant="outline" onClick={toggleAutomation} disabled={busy} isLoading={busy}>
              {automationRunning ? 'Mettre en pause' : 'Reprendre'}
            </Button>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center justify-center rounded-btn border border-toolia-border-subtle px-3 py-2 text-sm font-semibold text-toolia-text transition hover:border-toolia-primary"
            >
              Modifier
            </Link>
          </div>
        </AppCard>
        <AppCard className="flex h-full flex-col">
          <PencilLine className="mb-3 text-toolia-info" />
          <h2 className="text-xl font-bold text-toolia-text">Brouillons préparés</h2>
          <p className="text-2xl font-bold text-toolia-text">{draftCount}</p>
          <p className="mt-3 text-sm text-toolia-text-secondary">
            Réponses préparées dans Gmail, jamais envoyées sans validation.
          </p>
        </AppCard>
        <AppCard className="flex h-full flex-col">
          <Settings className="mb-3 text-toolia-info" />
          <h2 className="text-xl font-bold text-toolia-text">Labels créés</h2>
          <p className="text-2xl font-bold text-toolia-text">{state.labels.length}</p>
          <p className="mt-3 text-sm text-toolia-text-secondary">
            Catégories que Toolia prépare dans votre Gmail.
          </p>
        </AppCard>
        <AppCard className="flex h-full flex-col">
          <Bell className="mb-3 text-toolia-info" />
          <h2 className="text-xl font-bold text-toolia-text">Alertes Telegram</h2>
          {!telegramAllowedByPlan ? (
            <>
              <StatusPill tone="warning">Indisponible</StatusPill>
              <p className="mt-3 text-sm text-toolia-text-secondary">
                Alertes Telegram indisponibles avec l’offre Starter.
              </p>
              <Link
                href="/pricing"
                className="mt-auto inline-flex pt-4 text-sm font-semibold text-toolia-text underline underline-offset-4"
              >
                Voir les offres avec Telegram
              </Link>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-toolia-text">{telegramCount}</p>
              <p className="mt-3 text-sm text-toolia-text-secondary">
                {telegramState?.connected
                  ? telegramState.username
                    ? `Telegram connecté avec @${telegramState.username}.`
                    : 'Telegram connecté.'
                  : 'Connectez Telegram pour recevoir les alertes importantes. Vous n’avez rien à configurer manuellement.'}
              </p>
              {telegramState?.connected ? (
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={testTelegram} disabled={telegramBusy} isLoading={telegramBusy}>
                    <Send size={16} />
                    Vérifier Telegram
                  </Button>
                  <Button type="button" variant="ghost" onClick={disconnectTelegramFromDashboard} disabled={telegramBusy}>
                    Déconnecter Telegram
                  </Button>
                </div>
              ) : (
                <>
                  <Button type="button" variant="outline" className="mt-auto" onClick={startTelegramConnection} disabled={telegramBusy} isLoading={telegramBusy}>
                    <Send size={16} />
                    Connecter Telegram
                  </Button>
                  {telegramConnect && (
                    <div className="mt-5 rounded-card border border-toolia-border bg-toolia-card-hover p-4">
                      <a
                        href={telegramConnect.botLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-toolia-primary px-4 py-2 text-sm font-semibold text-white"
                      >
                        Ouvrir Telegram
                      </a>
                      {telegramConnect.startCommand && (
                        <div className="mt-4 rounded-card border border-toolia-border bg-toolia-surface p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-toolia-text-muted">
                            Commande de connexion
                          </p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <code className="min-w-0 flex-1 overflow-x-auto rounded-full border border-toolia-border bg-toolia-card px-3 py-2 text-xs font-semibold text-toolia-text">
                              {telegramConnect.startCommand}
                            </code>
                            <button
                              type="button"
                              className="rounded-full border border-toolia-border px-3 py-2 text-xs font-semibold text-toolia-text transition hover:border-toolia-primary"
                              onClick={() => {
                                void navigator.clipboard?.writeText(telegramConnect.startCommand || '')
                                setTelegramResult('Commande Telegram copiée. Collez-la dans le bot Toolia si elle n’est pas préremplie.')
                              }}
                            >
                              Copier
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                        <img
                          src={telegramConnect.qrCodeDataUrl}
                          alt="QR code de connexion Telegram Toolia"
                          className="h-36 w-36 rounded-card bg-white p-2"
                        />
                        <ol className="space-y-2 text-sm text-toolia-text-secondary">
                          <li>1. Installez Telegram sur votre téléphone si ce n’est pas déjà fait.</li>
                          <li>2. Scannez le QR code ou cliquez sur le bouton.</li>
                          <li>3. Envoyez la commande /start préremplie. Si elle n’apparaît pas, copiez la commande affichée ci-dessus.</li>
                        </ol>
                      </div>
                      <div className="mt-4 space-y-2 text-xs text-toolia-text-secondary">
                        <p>Si vous utilisez un ordinateur, scannez le QR code avec votre téléphone.</p>
                        <p>Si vous n’avez pas Telegram, installez l’application sur votre téléphone puis créez votre compte.</p>
                        <p>Si Telegram est déjà connecté sur votre ordinateur, le bouton peut ouvrir Telegram Web ou Telegram Desktop directement.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {telegramResult && <p className="mt-3 text-sm text-toolia-text-secondary">{telegramResult}</p>}
            </>
          )}
        </AppCard>
        </div>
      </div>

      {usage && (
        <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Usage du mois</p>
        <AppCard>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-toolia-text">Utilisation du mois</h2>
            <p className="max-w-3xl text-sm leading-6 text-toolia-text-secondary">
              Toolia utilise l’IA pour analyser vos emails, préparer des brouillons et générer certaines alertes. Chaque offre inclut une utilisation mensuelle adaptée à votre volume.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <UsageBar label="Emails traités" value={usage.current.emailsProcessed ?? usage.current.emailsAnalyzed} limit={usage.limits.emailAnalysesMonthly} />
            <UsageBar label="Brouillons IA" value={usage.current.aiDraftsCreated} limit={usage.limits.aiDraftsMonthly} />
            <UsageBar label="Alertes Telegram" value={usage.current.telegramAlertsSent} limit={usage.limits.telegramAlertsMonthly} />
            <UsageBar label="Analyses de style" value={usage.current.styleAnalysesUsed} limit={usage.limits.styleAnalysesMonthly} />
          </div>
          <p className="mt-3 text-xs text-toolia-text-secondary">
            Inclut les emails classés automatiquement, même sans appel IA.
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <p className="mt-1 text-xs text-toolia-text-secondary">
              Emails analysés par IA : {usage.current.emailsAiAnalyzed ?? usage.current.emailsAnalyzed}
            </p>
          )}
          {usageAboveWarning && (
            <p className="mt-4 text-sm font-medium text-toolia-warning">
              {usageExceeded
                ? 'Limite atteinte. Améliorez votre offre pour continuer cette action.'
                : 'Vous approchez de votre limite mensuelle.'}
            </p>
          )}
        </AppCard>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
      <AppCard className="flex h-full flex-col">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-toolia-text">Créer un brouillon IA</h2>
            <p className="mt-2 text-sm text-toolia-text-secondary">
              Collez un exemple d’email reçu. Toolia prépare un brouillon dans Gmail, sans jamais l’envoyer.
            </p>
          </div>
          {gmailNeedsModifyScope && (
            <Button type="button" variant="outline" onClick={() => void connectGmailFromDashboard(true)} disabled={gmailBusy} isLoading={gmailBusy}>
              Reconnecter Gmail
            </Button>
          )}
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-semibold text-toolia-text">Email reçu</span>
          <textarea
            className="mt-2 min-h-36 w-full rounded-card border border-toolia-border bg-toolia-bg-secondary px-4 py-3 text-sm leading-6 text-toolia-text shadow-inner outline-none transition placeholder:text-toolia-text-muted focus:border-toolia-info focus:ring-2 focus:ring-toolia-info/30"
            value={incomingEmail}
            onChange={(event) => setIncomingEmail(event.target.value)}
            placeholder="Collez ici un exemple d’email reçu"
          />
        </label>
        <div className="mt-4 flex flex-col gap-3">
          {!state.gmailConnected && (
            <p className="text-sm font-medium text-toolia-text-secondary">Connectez Gmail pour créer un brouillon IA.</p>
          )}
          {state.gmailConnected && gmailNeedsModifyScope && (
            <p className="text-sm font-medium text-toolia-warning">
              Reconnectez Gmail pour autoriser Toolia à gérer vos emails et brouillons.
            </p>
          )}
          {state.gmailConnected && !gmailNeedsModifyScope && !aiStatus?.configured && (
            <p className="text-sm font-medium text-toolia-warning">
              Configuration IA indisponible pour le moment.
            </p>
          )}
          {draftQuotaReached && state.gmailConnected && !gmailNeedsModifyScope && aiStatus?.configured && (
            <p className="text-sm font-medium text-toolia-warning">
              Votre limite de brouillons IA est atteinte pour ce mois-ci.
            </p>
          )}
          {canCreateAiDraftNow && (
            <Button type="button" onClick={createAiTestDraft} disabled={draftBusy} isLoading={draftBusy}>
              {draftBusy ? 'Génération du brouillon⬦' : 'Créer un brouillon IA'}
            </Button>
          )}
          {draftBusy && (
            <p className="text-sm font-medium text-toolia-text-secondary">Génération du brouillon⬦</p>
          )}
          {draftError && (
            <div className="rounded-card border border-toolia-warning/40 bg-toolia-warning/10 p-4">
              <p className="text-sm font-medium text-toolia-text">{draftError}</p>
              {draftRetryable && canCreateAiDraftNow && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={createAiTestDraft}
                  disabled={draftBusy}
                  isLoading={draftBusy}
                >
                  Réessayer
                </Button>
              )}
            </div>
          )}
          {draftResult && <p className="text-sm font-medium text-toolia-text-secondary">{draftResult}</p>}
          {draftPreview && (
            <pre className="max-h-96 overflow-y-auto rounded-card border border-toolia-border-subtle bg-toolia-bg-secondary p-4 text-sm leading-6 whitespace-pre-wrap text-toolia-text">
              {draftPreview}
            </pre>
          )}
        </div>
      </AppCard>

      <AppCard className="flex h-full flex-col">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-toolia-text">Apprendre mon style d’écriture</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-toolia-text-secondary">
              Toolia peut analyser vos anciens emails envoyés pour mieux imiter votre ton, vos formules et votre manière de répondre.
              Les emails bruts ne sont pas conservés.
            </p>
          </div>
          {gmailNeedsModifyScope && (
            <Button type="button" variant="outline" onClick={() => void connectGmailFromDashboard(true)} disabled={gmailBusy} isLoading={gmailBusy}>
              Reconnecter Gmail
            </Button>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <StatusPill tone="info">Analyse limitée aux emails envoyés récents.</StatusPill>
          <StatusPill tone="success">Aucun email n’est envoyé.</StatusPill>
          <StatusPill tone="info">Seul un résumé de style est gardé.</StatusPill>
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-5">
          {!state.gmailConnected && (
            <p className="text-sm font-medium text-toolia-text-secondary">Connectez Gmail pour analyser votre style.</p>
          )}
          {state.gmailConnected && gmailNeedsModifyScope && (
            <p className="text-sm font-medium text-toolia-warning">Autorisation Gmail à mettre à jour.</p>
          )}
          {state.gmailConnected && !gmailNeedsModifyScope && !aiStatus?.configured && (
            <p className="text-sm font-medium text-toolia-warning">
              Configuration IA indisponible pour le moment.
            </p>
          )}
          {styleQuotaReached && state.gmailConnected && !gmailNeedsModifyScope && aiStatus?.configured && (
            <p className="text-sm font-medium text-toolia-warning">
              Vous avez déjà utilisé vos analyses de style ce mois-ci.
            </p>
          )}
          {canAnalyzeWritingStyleNow && (
            <Button type="button" onClick={analyzeWritingStyle} disabled={learningBusy} isLoading={learningBusy}>
              {learningBusy
                ? 'Analyse du style⬦'
                : styleProfile
                  ? 'Ré-analyser mon style'
                  : 'Analyser mes emails envoyés'}
            </Button>
          )}
          {learningResult && <p className="text-sm font-medium text-toolia-success">{learningResult}</p>}
          {learningError && <p className="text-sm font-medium text-toolia-warning">{learningError}</p>}
        </div>
        {styleProfile && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">Style analysé</p>
              <p className="mt-1 text-sm font-semibold text-toolia-text">{styleProfile.sample_count} emails analysés</p>
              {styleProfile.updated_at && (
                <p className="mt-1 text-xs text-toolia-text-muted">
                  Dernière analyse : {new Date(styleProfile.updated_at).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">Préférence tu/vous</p>
              <p className="mt-1 text-sm font-semibold text-toolia-text">
                {writingPreferenceLabels[styleProfile.tutoiement_or_vouvoiement_preference]}
              </p>
            </div>
            <div className="rounded-card bg-toolia-card-hover p-4 md:col-span-2">
              <p className="text-sm text-toolia-text-secondary">Résumé du ton détecté</p>
              <p className="mt-1 text-sm leading-6 text-toolia-text">{styleProfile.tone_summary}</p>
            </div>
          </div>
        )}
      </AppCard>
      </div>

      <AppCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-toolia-text">Analyser mes derniers emails</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-toolia-text-secondary">
              Toolia peut analyser vos derniers emails reçus, proposer les bons labels et préparer des brouillons si nécessaire.
              Rien n’est envoyé automatiquement.
            </p>
          </div>
          {gmailNeedsModifyScope && (
            <Button type="button" variant="outline" onClick={() => void connectGmailFromDashboard(true)} disabled={gmailBusy} isLoading={gmailBusy}>
              Reconnecter Gmail
            </Button>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {!state.gmailConnected && (
            <p className="text-sm font-medium text-toolia-text-secondary">Connectez Gmail pour analyser vos emails reçus.</p>
          )}
          {state.gmailConnected && gmailNeedsModifyScope && (
            <p className="text-sm font-medium text-toolia-warning">Autorisation Gmail à mettre à jour.</p>
          )}
          {state.gmailConnected && !gmailNeedsModifyScope && !aiStatus?.configured && (
            <p className="text-sm font-medium text-toolia-warning">
              Configuration IA indisponible pour le moment.
            </p>
          )}
          <div className="rounded-[24px] border border-toolia-border-subtle bg-toolia-bg-secondary/45 p-3">
          <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
              Analyser des emails récents
              <select
                value={classificationLimit}
                onChange={(event) => setClassificationLimit(Number(event.target.value) as 5 | 10 | 20)}
                className="rounded-card border border-toolia-border-subtle bg-toolia-card px-3 py-2 text-toolia-text outline-none focus:border-toolia-info"
              >
                <option value={5}>5 derniers emails</option>
                <option value={10}>10 derniers emails</option>
                <option value={20}>20 derniers emails</option>
              </select>
            </label>
            <label className="flex min-h-[44px] items-center gap-3 rounded-card border border-toolia-border-subtle bg-toolia-card px-4 py-2.5 text-sm font-medium text-toolia-text">
              <input
                type="checkbox"
                checked={includeAlreadyAnalyzed}
                onChange={(event) => setIncludeAlreadyAnalyzed(event.target.checked)}
                className="mt-1 h-4 w-4 accent-toolia-info"
              />
              Inclure les emails déjà analysés
            </label>
          </div>
          </div>
          <p className="text-sm text-toolia-text-secondary">
            Cette action utilise votre quota d’emails traités.
          </p>
          {usage && (
            <p className="text-sm text-toolia-text-secondary">
              Quota restant : {usage.remaining.emailAnalysis} emails traités ce mois-ci.
            </p>
          )}
          {emailAnalysisQuotaReached && state.gmailConnected && !gmailNeedsModifyScope && aiStatus?.configured && (
            <p className="text-sm font-medium text-toolia-warning">
              Votre limite mensuelle est atteinte pour cette action.
            </p>
          )}
          {canAnalyzeRecentEmailsNow && (
            <Button
              type="button"
              onClick={() => analyzeRecentEmails()}
              disabled={classificationBusy}
              isLoading={classificationBusy}
            >
              {classificationBusy ? 'Analyse des emails⬦' : `Analyser ${classificationLimit} emails`}
            </Button>
          )}
          {classificationResult && <p className="text-sm font-medium text-toolia-success">{classificationResult}</p>}
          {classificationError && <p className="text-sm font-medium text-toolia-warning">{classificationError}</p>}
        </div>
        {classificationSummary && (
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">Emails traités</p>
              <p className="mt-1 text-xl font-bold text-toolia-text">{classificationSummary.analyzed}</p>
            </div>
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">Labels appliqués</p>
              <p className="mt-1 text-xl font-bold text-toolia-text">{classificationSummary.labelsApplied}</p>
            </div>
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">Brouillons créés</p>
              <p className="mt-1 text-xl font-bold text-toolia-text">{classificationSummary.draftsCreated}</p>
            </div>
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">À vérifier</p>
              <p className="mt-1 text-xl font-bold text-toolia-text">{classificationSummary.needsReview}</p>
            </div>
            <div className="rounded-card bg-toolia-card-hover p-4">
              <p className="text-sm text-toolia-text-secondary">Ignorés</p>
              <p className="mt-1 text-xl font-bold text-toolia-text">{classificationSummary.skipped || 0}</p>
            </div>
          </div>
        )}
        {classificationCards.length > 0 && (
          <div className="mt-5 grid gap-3">
            {classificationCards.map((item) => (
              <div key={item.messageId} className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-toolia-text">{item.sender || 'Expéditeur inconnu'}</p>
                    <p className="mt-1 text-sm text-toolia-text-secondary">{item.subject || '(Sans objet)'}</p>
                  </div>
                  <StatusPill tone={item.status === 'processed' ? 'success' : item.status === 'needs_review' ? 'warning' : 'info'}>
                    {item.status === 'processed'
                      ? 'Traité'
                      : item.status === 'needs_review'
                        ? 'À vérifier'
                        : item.status === 'skipped'
                          ? 'Ignoré'
                          : 'Erreur'}
                  </StatusPill>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-toolia-text-secondary md:grid-cols-4">
                  <span>Catégorie : <strong className="text-toolia-text">{item.category}</strong></span>
                  <span>Confiance : <strong className="text-toolia-text">{Math.round(item.confidence * 100)}%</strong></span>
                  <span>Label : <strong className="text-toolia-text">{item.labelApplied ? 'appliqué' : 'non appliqué'}</strong></span>
                  <span>Brouillon : <strong className="text-toolia-text">{item.draftCreated ? 'créé' : 'non'}</strong></span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-toolia-text-secondary md:grid-cols-3">
                  <span>Action : <strong className="text-toolia-text">{item.actionTaken}</strong></span>
                  <span>Fil utilisé : <strong className="text-toolia-text">{item.threadContextUsed ? 'oui' : 'non'}</strong></span>
                  <span>Mapping label : <strong className="text-toolia-text">{item.labelMappingStatus}</strong></span>
                </div>
                {item.previousCategory && item.previousCategory !== item.category && (
                  <p className="mt-2 text-xs text-toolia-text-secondary">
                    Catégorie précédente : {item.previousCategory}
                  </p>
                )}
                {item.skipReason && (
                  <p className="mt-2 text-sm font-medium text-toolia-warning">Raison d’ignorance : {item.skipReason}</p>
                )}
                {item.labelMappingWarning && (
                  <p className="mt-2 text-sm font-medium text-toolia-warning">{item.labelMappingWarning}</p>
                )}
                <p className="mt-3 text-sm text-toolia-text-secondary">{item.reason}</p>
                <div className="mt-3 rounded-card border border-toolia-border-subtle bg-toolia-bg-main/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-toolia-text-muted">
                    Catégories envoyées à l’IA
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.availableCategories.map((category) => (
                      <span
                        key={`${item.messageId}_${category.name}`}
                        className="rounded-full border border-toolia-border-subtle px-3 py-1 text-xs text-toolia-text-secondary"
                        title={`${category.description} Actions : ${category.actions.join(', ') || 'aucune'}`}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                  <label className="flex min-w-56 flex-col gap-2 text-sm font-medium text-toolia-text">
                    Corriger la catégorie
                    <select
                      value={manualCategoryByMessage[item.messageId] || item.category}
                      onChange={(event) =>
                        setManualCategoryByMessage((current) => ({
                          ...current,
                          [item.messageId]: event.target.value,
                        }))
                      }
                      className="rounded-card border border-toolia-border-subtle bg-toolia-bg-secondary px-3 py-2 text-toolia-text outline-none focus:border-toolia-info"
                    >
                      {(profile?.categories || []).map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => analyzeRecentEmails({ messageId: item.messageId })}
                    disabled={Boolean(classificationBusyMessageId || classificationBusy)}
                    isLoading={classificationBusyMessageId === item.messageId}
                  >
                    Reclasser
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyManualLabel(item)}
                    disabled={Boolean(manualLabelBusyMessageId || classificationBusy)}
                    isLoading={manualLabelBusyMessageId === item.messageId}
                  >
                    Appliquer ce label
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AppCard>

      <AppCard>
        <h2 className="text-2xl font-bold text-toolia-text">Configuration actuelle</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-card bg-toolia-card-hover p-4">
            <p className="text-sm text-toolia-text-secondary">Labels actifs</p>
            <p className="mt-1 text-sm font-semibold text-toolia-text">{activeLabels}</p>
          </div>
          <div className="rounded-card bg-toolia-card-hover p-4">
            <p className="text-sm text-toolia-text-secondary">Actions activées</p>
            <p className="mt-1 text-sm font-semibold text-toolia-text">{enabledActions}</p>
          </div>
          <div className="rounded-card bg-toolia-card-hover p-4">
            <p className="text-sm text-toolia-text-secondary">Ton des brouillons</p>
            <p className="mt-1 text-sm font-semibold text-toolia-text">{draftTone}</p>
            {customDraftInstructionPreview && (
              <p className="mt-2 text-xs text-toolia-text-secondary">
                Instructions personnalisées : {customDraftInstructionPreview}
              </p>
            )}
            <p className="mt-2 text-xs text-toolia-text-secondary">
              Mode d’adresse détecté : {addressingModeLabel}
            </p>
          </div>
          <div className="rounded-card bg-toolia-card-hover p-4">
            <p className="text-sm text-toolia-text-secondary">Telegram</p>
            <p className="mt-1 text-sm font-semibold text-toolia-text">{telegramSetting}</p>
          </div>
        </div>
      </AppCard>
    </SaasShell>
  )
}

export function SettingsClient() {
  const router = useRouter()
  const [profile, setProfile] = useState<AutomationProfile | null>(null)
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null)
  const [plan, setPlan] = useState<PlanOption | null>(null)
  const [session, setSession] = useState<DemoSession | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<DashboardState['subscriptionStatus'] | null>(null)
  const [showTechnical, setShowTechnical] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsLoadError, setSettingsLoadError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const storedSession = await resolveSession()
      if (!active) return

      if (!storedSession) {
        router.replace('/login')
        return
      }

      setSession(storedSession)
      setSettingsLoadError('')

      const persisted = await loadPersistedState(storedSession)
      if (!active) return
      if (!persisted?.ok) {
        setSettingsLoadError('Synchronisation de votre configuration impossible pour le moment.')
        setSettingsLoaded(true)
        return
      }

      const persistedPlan = normalizePersistedPlan(persisted.plan)
      const persistedProfile = normalizeProfile(persisted.profile || null)

      setPlan(persistedPlan)
      setAnswers(persisted.answers || null)
      setProfile(persistedProfile)
      setSubscriptionStatus(persisted.dashboard?.subscriptionStatus || null)
      setSettingsLoaded(true)
    }

    void load().catch(() => {
      if (!active) return
      setSettingsLoadError('Synchronisation de votre configuration impossible pour le moment.')
      setSettingsLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const deleteAccount = async () => {
    setDeleteError('')

    if (!session || session.mode !== 'account') {
      setDeleteError('Connectez-vous pour supprimer votre compte.')
      return
    }

    if (deleteConfirmation.trim() !== 'SUPPRIMER') {
      setDeleteError('Tapez SUPPRIMER pour confirmer.')
      return
    }

    setDeletingAccount(true)

    try {
      const token = await getSupabaseAccessToken()
      if (!token) throw new Error('Connectez-vous pour supprimer votre compte.')

      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          confirmation: deleteConfirmation.trim(),
        }),
      })
      const data = await readJsonResponse<{ ok?: boolean; message?: string }>(response, '/api/account/delete')

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Suppression du compte impossible.')
      }

      const supabase = getSupabaseBrowserClient()
      await supabase?.auth.signOut()
      Object.values(storageKeys).forEach((key) => removeStorage(key))
      router.push('/')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Suppression du compte impossible.')
    } finally {
      setDeletingAccount(false)
    }
  }

  if (!settingsLoaded) {
    return (
      <SaasShell
        eyebrow="Paramètres"
        title="Chargement de votre configuration"
        description="Toolia synchronise vos réglages avant d’afficher les options de modification."
      >
        <NeutralLoadingState
          title="Vérification de votre automatisation..."
          description="Nous récupérons votre configuration active pour éviter d’afficher un état incomplet."
        />
      </SaasShell>
    )
  }

  if (settingsLoadError) {
    return (
      <SaasShell
        eyebrow="Paramètres"
        title="Synchronisation impossible"
        description="Votre configuration n’a pas pu être confirmée pour le moment."
      >
        <AppCard>
          <StatusPill tone="warning">Synchronisation</StatusPill>
          <p className="mt-4 text-sm leading-6 text-toolia-text-secondary">{settingsLoadError}</p>
          <div className="mt-6">
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        </AppCard>
      </SaasShell>
    )
  }

  return (
    <SaasShell
      eyebrow="Paramètres"
      title="Réglages de l’automatisation"
      description="Consultez les choix actifs ou modifiez vos labels, actions, brouillons et alertes."
    >
      {!profile ? (
        <div className="grid gap-6">
          <AppCard>
            <p className="text-toolia-text-secondary">Aucune configuration trouvée.</p>
            <div className="mt-6">
              <NextLink href="/onboarding">Créer une configuration</NextLink>
            </div>
          </AppCard>
          <AppCard>
            <h2 className="text-2xl font-bold text-toolia-text">Apparence</h2>
            <p className="mt-3 text-sm text-toolia-text-secondary">
              Choisissez le thème de l’interface Toolia sur cet appareil.
            </p>
            <div className="mt-5">
              <ThemeToggle />
            </div>
          </AppCard>
          {session?.mode === 'account' && (
            <AppCard id="delete-account">
              <h2 className="text-2xl font-bold text-toolia-text">Supprimer mon compte</h2>
              <p className="mt-3 text-sm text-toolia-text-secondary">
                Cette action supprime votre espace Toolia et les données liées à votre automatisation. Elle ne supprime aucun email dans Gmail.
              </p>
              <div className="mt-5 flex flex-col gap-3 md:max-w-md">
                <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
                  Confirmation
                  <input
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
                    placeholder="Tapez SUPPRIMER"
                  />
                </label>
                {deleteError && <p className="text-sm font-medium text-toolia-danger">{deleteError}</p>}
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletingAccount}
                  isLoading={deletingAccount}
                  onClick={deleteAccount}
                >
                  Supprimer mon compte
                </Button>
              </div>
            </AppCard>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <AppCard>
            <h2 className="text-2xl font-bold text-toolia-text">Sécurité</h2>
            <div className="mt-4 flex flex-col gap-3">
              {summarySafetyItems().map((item) => (
                <StatusPill key={item} tone="success">{item}</StatusPill>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <NextLink href="/onboarding?from=settings">Modifier ma configuration</NextLink>
              <PlanUpgradeButton plan={plan} subscriptionStatus={subscriptionStatus} />
              <Link href="/dashboard" className="text-sm font-semibold text-toolia-text-secondary hover:text-toolia-text">
                Retour dashboard
              </Link>
            </div>
          </AppCard>
          <AppCard>
            <h2 className="text-2xl font-bold text-toolia-text">Apparence</h2>
            <p className="mt-3 text-sm text-toolia-text-secondary">
              Passez en mode clair, sombre ou suivez le réglage système de votre appareil.
            </p>
            <div className="mt-5">
              <ThemeToggle />
            </div>
          </AppCard>
          <AppCard>
            <h2 className="text-2xl font-bold text-toolia-text">Configuration active</h2>
            <div className="mt-4 grid gap-4">
              <div className="rounded-card bg-toolia-card-hover p-4">
                <p className="text-sm text-toolia-text-secondary">Objectif</p>
                <p className="mt-1 text-toolia-text">{answers?.mainGoal || profile.business_context.main_goal}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {profile.categories.map((category) => (
                <div key={category.id} className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-3">
                  <p className="font-semibold text-toolia-text">{category.name}</p>
                  <p className="mt-1 text-sm text-toolia-text-secondary">{selectedActionLabels(category.actions)}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowTechnical((current) => !current)}
              className="mt-5 text-left text-sm font-semibold text-toolia-text-secondary transition hover:text-toolia-text"
            >
              {showTechnical ? 'Masquer les détails techniques' : 'Afficher les détails techniques'}
            </button>
            {showTechnical && (
              <pre className="mt-4 max-h-[420px] overflow-auto rounded-card border border-toolia-border-subtle bg-toolia-bg-main p-4 text-xs text-toolia-text">
                {JSON.stringify(profile, null, 2)}
              </pre>
            )}
          </AppCard>
          {session?.mode === 'account' && (
            <AppCard className="lg:col-span-2" id="delete-account">
              <h2 className="text-2xl font-bold text-toolia-text">Supprimer mon compte</h2>
              <p className="mt-3 text-sm text-toolia-text-secondary">
                Cette action supprime votre espace Toolia et les données liées à votre automatisation. Elle ne supprime aucun email dans Gmail.
              </p>
              <div className="mt-5 flex flex-col gap-3 md:max-w-md">
                <label className="flex flex-col gap-2 text-sm font-medium text-toolia-text">
                  Confirmation
                  <input
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    className="rounded-card border border-toolia-border-subtle bg-toolia-card-hover px-4 py-3 text-toolia-text outline-none focus:border-toolia-primary"
                    placeholder="Tapez SUPPRIMER"
                  />
                </label>
                {deleteError && <p className="text-sm font-medium text-toolia-danger">{deleteError}</p>}
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletingAccount}
                  isLoading={deletingAccount}
                  onClick={deleteAccount}
                >
                  Supprimer mon compte
                </Button>
              </div>
            </AppCard>
          )}
        </div>
      )}
    </SaasShell>
  )
}



