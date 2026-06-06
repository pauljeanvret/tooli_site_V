'use client'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const storageKeys = {
  plan: 'toolia_selected_plan',
  profile: 'toolia_automation_profile',
  dashboard: 'toolia_dashboard_state',
}

type ClientDashboardState = {
  status?: 'active' | 'active_test' | 'paused'
  subscriptionStatus?: 'demo' | 'active' | 'inactive'
}

type TooliaClientState = {
  isLoggedIn: boolean
  hasAutomation: boolean
  hasActiveAutomation: boolean
  hasSelectedPlan: boolean
  targetPath: '/signup' | '/pricing' | '/onboarding' | '/dashboard'
  ctaLabel: string
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

async function loadPersistedState(token: string) {
  const response = await fetch('/api/account/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  }).catch(() => null)

  if (!response?.ok) return null
  return response.json().catch(() => null) as Promise<{
    ok?: boolean
    plan?: unknown | null
    profile?: unknown | null
    dashboard?: ClientDashboardState | null
  } | null>
}

export async function getTooliaClientState(): Promise<TooliaClientState> {
  const supabase = getSupabaseBrowserClient()
  const [{ data: userData }, { data: sessionData }] = supabase
    ? await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()])
    : [{ data: { user: null } }, { data: { session: null } }]
  const user = userData.user
  const token = sessionData.session?.access_token || null

  if (!user?.id || !token) {
    return {
      isLoggedIn: false,
      hasAutomation: false,
      hasActiveAutomation: false,
      hasSelectedPlan: false,
      targetPath: '/signup',
      ctaLabel: 'Automatiser ma boîte Gmail',
    }
  }

  const persisted = await loadPersistedState(token)
  const hasPersistedResponse = Boolean(persisted?.ok)
  const localDashboard = readStorage<ClientDashboardState | null>(storageKeys.dashboard, null)
  const localProfile = readStorage<unknown | null>(storageKeys.profile, null)
  const localPlan = readStorage<unknown | null>(storageKeys.plan, null)
  const dashboard = hasPersistedResponse ? persisted?.dashboard : localDashboard
  const profile = hasPersistedResponse ? persisted?.profile : localProfile
  const hasAutomation = Boolean(profile && dashboard)
  const hasActiveAutomation =
    dashboard?.status === 'active' ||
    dashboard?.status === 'active_test' ||
    dashboard?.status === 'paused'
  const hasSelectedPlan = Boolean(hasPersistedResponse ? persisted?.plan : localPlan)
  const targetPath = hasAutomation ? '/dashboard' : hasSelectedPlan ? '/onboarding' : '/pricing'

  return {
    isLoggedIn: true,
    hasAutomation,
    hasActiveAutomation,
    hasSelectedPlan,
    targetPath,
    ctaLabel: hasAutomation ? 'Mon espace Toolia' : 'Automatiser ma boîte Gmail',
  }
}

export async function routeToTooliaStart() {
  const state = await getTooliaClientState()
  window.location.href = state.targetPath
}
