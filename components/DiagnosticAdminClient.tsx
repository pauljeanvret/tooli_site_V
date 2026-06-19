'use client'

import React from 'react'
import Link from 'next/link'
import { RefreshCw, Save, ShieldAlert } from 'lucide-react'

import { diagnosticStatusOptions, formatEuro, planLabels, type DiagnosticPlan, type DiagnosticStatus } from '@/lib/diagnostic'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type DiagnosticSubmission = {
  id: string
  created_at: string
  first_name: string
  email: string
  age_range: string
  role: string
  company_size: string
  emails_per_day_range: string
  emails_per_day_estimate: number
  inbox_minutes_per_day: number
  main_pain: string
  organization_level: string
  monthly_income_range: string
  monthly_income_estimate: number
  hourly_value: number
  hours_lost_per_month: number
  hours_lost_per_year: number
  cost_lost_per_month: number
  cost_lost_per_year: number
  recommended_plan: DiagnosticPlan
  consent_to_contact: boolean
  status: DiagnosticStatus
  notes: string | null
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
}

const planFilterOptions: Array<{ value: '' | DiagnosticPlan; label: string }> = [
  { value: '', label: 'Tous les plans' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatMinutes(value: number) {
  if (value < 60) return `${value} min`
  if (value === 90) return '1h30'
  return `${Math.round(value / 60)}h`
}

export function DiagnosticAdminClient() {
  const [submissions, setSubmissions] = React.useState<DiagnosticSubmission[]>([])
  const [statusFilter, setStatusFilter] = React.useState<'' | DiagnosticStatus>('')
  const [planFilter, setPlanFilter] = React.useState<'' | DiagnosticPlan>('')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [notesDraft, setNotesDraft] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [isUpdatingId, setIsUpdatingId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  const loadSubmissions = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    setMessage('')

    const supabase = getSupabaseBrowserClient()
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
    const token = data.session?.access_token

    if (!token) {
      setError('Connectez-vous avec un compte admin pour accéder aux diagnostics.')
      setIsLoading(false)
      return
    }

    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (planFilter) params.set('plan', planFilter)

    const response = await fetch(`/api/admin/diagnostics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)

    const payload = (await response?.json().catch(() => null)) as
      | { ok?: boolean; message?: string; submissions?: DiagnosticSubmission[] }
      | null

    if (!response?.ok || !payload?.ok) {
      setError(payload?.message || 'Impossible de charger les diagnostics.')
      setIsLoading(false)
      return
    }

    setSubmissions(payload.submissions || [])
    setNotesDraft(
      Object.fromEntries((payload.submissions || []).map((submission) => [submission.id, submission.notes || ''])),
    )
    setIsLoading(false)
  }, [planFilter, statusFilter])

  React.useEffect(() => {
    void loadSubmissions()
  }, [loadSubmissions])

  async function updateSubmission(id: string, changes: { status?: DiagnosticStatus; notes?: string | null }) {
    setIsUpdatingId(id)
    setError('')
    setMessage('')

    const supabase = getSupabaseBrowserClient()
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
    const token = data.session?.access_token

    if (!token) {
      setError('Session admin introuvable.')
      setIsUpdatingId(null)
      return
    }

    const response = await fetch('/api/admin/diagnostics', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, ...changes }),
    }).catch(() => null)

    const payload = (await response?.json().catch(() => null)) as
      | { ok?: boolean; message?: string; submission?: DiagnosticSubmission }
      | null

    if (!response?.ok || !payload?.ok || !payload.submission) {
      setError(payload?.message || 'Mise à jour impossible.')
      setIsUpdatingId(null)
      return
    }

    setSubmissions((current) =>
      current.map((submission) => (submission.id === id ? payload.submission! : submission)),
    )
    setNotesDraft((current) => ({ ...current, [id]: payload.submission?.notes || '' }))
    setMessage('Diagnostic mis à jour.')
    setIsUpdatingId(null)
  }

  return (
    <div className="min-h-screen bg-toolia-bg-main">
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:px-8 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
              Admin Toolia
            </p>
            <h1 className="font-heading mt-3 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">
              Diagnostics Gmail
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-white/60">
              Suivi des diagnostics publics soumis par les visiteurs. Cette page est réservée aux emails listés dans ADMIN_EMAILS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-[28px] border border-slate-200/90 bg-white/90 p-4 shadow-[0_20px_70px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-slate-950/60 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
              Statut
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | DiagnosticStatus)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="">Tous les statuts</option>
              {diagnosticStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
              Offre recommandée
            </span>
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value as '' | DiagnosticPlan)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              {planFilterOptions.map((plan) => (
                <option key={plan.value || 'all'} value={plan.value}>
                  {plan.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
                Résultats
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">{submissions.length}</p>
            </div>
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
            {message}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              {error}
            </div>
            {error.includes('Connectez-vous') && (
              <Link href="/login" className="mt-2 inline-block underline">
                Se connecter
              </Link>
            )}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="rounded-[28px] border border-slate-200/90 bg-white/80 p-8 text-center text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
              Chargement des diagnostics...
            </div>
          ) : submissions.length === 0 && !error ? (
            <div className="rounded-[28px] border border-slate-200/90 bg-white/80 p-8 text-center text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
              Aucun diagnostic trouvé.
            </div>
          ) : (
            submissions.map((submission) => {
              const expanded = expandedId === submission.id

              return (
                <article
                  key={submission.id}
                  className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/90 shadow-[0_18px_70px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-slate-950/62"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : submission.id)}
                    className="grid w-full gap-3 px-5 py-4 text-left md:grid-cols-[1.3fr_1fr_1fr_1fr_0.8fr]"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {formatDate(submission.created_at)}
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-950 dark:text-white">
                        {submission.first_name}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-white/58">{submission.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Profil</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white/75">{submission.role}</p>
                      <p className="text-xs text-slate-500 dark:text-white/45">{submission.company_size}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Volume</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white/75">
                        {submission.emails_per_day_range} emails/j
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/45">
                        {formatMinutes(submission.inbox_minutes_per_day)} / jour
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Estimation</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white/75">
                        {formatEuro(submission.cost_lost_per_month)} / mois
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/45">
                        {formatEuro(submission.cost_lost_per_year)} / an
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Plan</p>
                      <p className="mt-1 rounded-full bg-blue-50 px-3 py-1 text-center text-sm font-extrabold text-blue-800 dark:bg-blue-300/10 dark:text-blue-100">
                        {planLabels[submission.recommended_plan]}
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-200/90 px-5 py-5 dark:border-white/10">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Réponses</h3>
                          <dl className="mt-3 grid gap-2 text-sm">
                            <div>
                              <dt className="font-semibold text-slate-500 dark:text-white/45">Âge</dt>
                              <dd className="text-slate-800 dark:text-white/72">{submission.age_range}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500 dark:text-white/45">Difficulté</dt>
                              <dd className="text-slate-800 dark:text-white/72">{submission.main_pain}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500 dark:text-white/45">Organisation</dt>
                              <dd className="text-slate-800 dark:text-white/72">{submission.organization_level}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500 dark:text-white/45">Revenu / valeur temps</dt>
                              <dd className="text-slate-800 dark:text-white/72">{submission.monthly_income_range}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500 dark:text-white/45">Source</dt>
                              <dd className="break-words text-slate-800 dark:text-white/72">
                                {submission.source || 'diagnostic'}
                                {submission.utm_source ? ` / ${submission.utm_source}` : ''}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Suivi commercial</h3>
                          <div className="mt-3 grid gap-3">
                            <label className="block">
                              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-white/45">
                                Statut
                              </span>
                              <select
                                value={submission.status}
                                onChange={(event) =>
                                  void updateSubmission(submission.id, {
                                    status: event.target.value as DiagnosticStatus,
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
                              >
                                {diagnosticStatusOptions.map((status) => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-white/45">
                                Notes
                              </span>
                              <textarea
                                value={notesDraft[submission.id] || ''}
                                onChange={(event) =>
                                  setNotesDraft((current) => ({
                                    ...current,
                                    [submission.id]: event.target.value,
                                  }))
                                }
                                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
                                placeholder="Ajouter une note de suivi..."
                              />
                            </label>
                            <button
                              type="button"
                              disabled={isUpdatingId === submission.id}
                              onClick={() =>
                                void updateSubmission(submission.id, {
                                  notes: notesDraft[submission.id] || null,
                                })
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-full bg-toolia-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-toolia-primary-light disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Save className="h-4 w-4" />
                              {isUpdatingId === submission.id ? 'Enregistrement...' : 'Enregistrer la note'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
