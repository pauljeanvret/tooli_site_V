'use client'

import React from 'react'
import Link from 'next/link'
import { BarChart3, RefreshCw, ShieldAlert, TrendingUp, Users } from 'lucide-react'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type FinanceCustomer = {
  userId: string
  customerEmail: string | null
  customerName: string | null
  companyName: string | null
  stripeCustomerId: string | null
  plan: 'starter' | 'pro' | 'premium'
  planName: string
  subscriptionStatus: string
  currentPeriodEnd: string | null
  monthlyPriceEur: number
  setupPriceEur: number
  estimatedRevenueEur: number
  aiCostEur: number
  profitEur: number
  marginPercent: number | null
  aiCalls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  gmailMessageCount: number
  lastAiUsageAt: string | null
  gmailConnected: boolean
  telegramConnected: boolean
  actionBreakdown: Record<string, { count: number; cost: number }>
  recentEvents: Array<{
    id: string
    createdAt: string
    source: string | null
    actionType: string | null
    provider: string | null
    model: string | null
    promptTokens: number
    completionTokens: number
    totalCostEur: number
    gmailMessageCount: number | null
    success: boolean
    errorCode: string | null
  }>
}

type FinancePayload = {
  ok?: boolean
  message?: string
  monthKey?: string
  revenueMode?: string
  summary?: {
    activeCustomers: number
    totalCustomers: number
    estimatedRevenueEur: number
    aiCostEur: number
    estimatedProfitEur: number
    averageAiCostPerActiveCustomerEur: number
    aiCalls: number
    totalTokens: number
    gmailMessageCount: number
    mostExpensiveCustomer: { email: string | null; plan: string; aiCostEur: number } | null
  }
  customers?: FinanceCustomer[]
}

const planOptions = [
  { value: 'all', label: 'Tous les plans' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
]

const statusOptions = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Annulés' },
  { value: 'missing', label: 'Sans abonnement' },
]

const sortOptions = [
  { value: 'cost_desc', label: 'Coût IA décroissant' },
  { value: 'revenue_desc', label: 'Revenu décroissant' },
  { value: 'profit_asc', label: 'Profit le plus faible' },
  { value: 'margin_asc', label: 'Marge la plus faible' },
  { value: 'last_usage_desc', label: 'Dernière activité IA' },
]

function defaultMonth() {
  return new Date().toISOString().slice(0, 7)
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Jamais'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function actionLabel(action: string | null) {
  if (action === 'email_classification') return 'Classification'
  if (action === 'draft_generation') return 'Brouillon IA'
  if (action === 'style_analysis') return 'Analyse de style'
  if (action === 'telegram_summary') return 'Résumé Telegram'
  return action || 'Autre'
}

export function AdminFinanceClient() {
  const [month, setMonth] = React.useState(defaultMonth())
  const [plan, setPlan] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [sort, setSort] = React.useState('cost_desc')
  const [payload, setPayload] = React.useState<FinancePayload | null>(null)
  const [expandedUserId, setExpandedUserId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const loadFinance = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    const supabase = getSupabaseBrowserClient()
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
    const token = data.session?.access_token

    if (!token) {
      setError('Connectez-vous avec un compte admin pour accéder à la finance.')
      setPayload(null)
      setIsLoading(false)
      return
    }

    const params = new URLSearchParams({ month, plan, status, sort })
    const response = await fetch(`/api/admin/finance?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)
    const nextPayload = (await response?.json().catch(() => null)) as FinancePayload | null

    if (!response?.ok || !nextPayload?.ok) {
      setError(nextPayload?.message || 'Impossible de charger la finance.')
      setPayload(null)
      setIsLoading(false)
      return
    }

    setPayload(nextPayload)
    setIsLoading(false)
  }, [month, plan, sort, status])

  React.useEffect(() => {
    void loadFinance()
  }, [loadFinance])

  const summary = payload?.summary
  const customers = payload?.customers || []

  return (
    <div className="min-h-screen bg-toolia-bg-main">
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:px-8 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
              Admin Toolia
            </p>
            <h1 className="font-heading mt-3 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">
              Finance & coûts IA
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-white/60">
              Suivi interne par client : revenus estimés, coûts IA, marge et activité Gmail. Les revenus sont estimés depuis le plan actif tant que les factures Stripe exactes ne sont pas historisées.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
              <Link href="/admin/diagnostics" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                Diagnostics
              </Link>
              <span className="rounded-full bg-toolia-primary px-4 py-2 text-white">Finance</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadFinance()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-[28px] border border-slate-200/90 bg-white/90 p-4 shadow-[0_20px_70px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-slate-950/60 md:grid-cols-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Mois</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Plan</span>
            <select value={plan} onChange={(event) => setPlan(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-white">
              {planOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Statut</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-white">
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Tri</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 dark:border-white/10 dark:bg-slate-950/70 dark:text-white">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              {error}
            </div>
            <Link href="/login" className="mt-2 inline-block underline">
              Se connecter
            </Link>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Revenu estimé', value: summary ? formatEuro(summary.estimatedRevenueEur) : '...', icon: EuroIcon },
            { label: 'Coût IA', value: summary ? formatEuro(summary.aiCostEur) : '...', icon: BarChart3 },
            { label: 'Profit estimé', value: summary ? formatEuro(summary.estimatedProfitEur) : '...', icon: TrendingUp },
            { label: 'Clients actifs', value: summary ? `${summary.activeCustomers}/${summary.totalCustomers}` : '...', icon: Users },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-[28px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_18px_60px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-slate-950/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">{card.label}</p>
                  <Icon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                </div>
                <p className="mt-4 text-3xl font-extrabold text-slate-950 dark:text-white">{card.value}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          Revenus marqués comme estimés : les factures Stripe exactes ne sont pas encore historisées dans ce tableau.
        </div>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="rounded-[28px] border border-slate-200/90 bg-white/80 p-8 text-center text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
              Chargement de la finance...
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200/90 bg-white/80 p-8 text-center text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
              Aucun usage IA trouvé sur ce mois.
            </div>
          ) : (
            customers.map((customer) => {
              const expanded = expandedUserId === customer.userId
              return (
                <article key={customer.userId} className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/90 shadow-[0_18px_70px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-slate-950/62">
                  <button
                    type="button"
                    onClick={() => setExpandedUserId(expanded ? null : customer.userId)}
                    className="grid w-full gap-4 px-5 py-5 text-left lg:grid-cols-[1.3fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr]"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Client</p>
                      <p className="mt-1 text-base font-extrabold text-slate-950 dark:text-white">
                        {customer.customerName || customer.customerEmail || customer.userId}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-white/58">{customer.customerEmail || 'Email non renseigné'}</p>
                    </div>
                    <Metric label="Plan" value={`${customer.planName} · ${customer.subscriptionStatus}`} />
                    <Metric label="Revenu" value={formatEuro(customer.estimatedRevenueEur)} />
                    <Metric label="Coût IA" value={formatEuro(customer.aiCostEur)} />
                    <Metric label="Profit" value={formatEuro(customer.profitEur)} tone={customer.profitEur < 0 ? 'danger' : 'default'} />
                    <Metric label="Marge" value={customer.marginPercent === null ? 'N/A' : `${customer.marginPercent}%`} tone={customer.marginPercent !== null && customer.marginPercent < 50 ? 'warning' : 'default'} />
                  </button>

                  {expanded ? (
                    <div className="border-t border-slate-200/90 px-5 py-5 dark:border-white/10">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Connexions</h3>
                          <dl className="mt-3 grid gap-2 text-sm">
                            <Detail label="Gmail" value={customer.gmailConnected ? 'Connecté' : 'Non connecté'} />
                            <Detail label="Telegram" value={customer.telegramConnected ? 'Connecté' : 'Non connecté'} />
                            <Detail label="Période" value={formatDate(customer.currentPeriodEnd)} />
                            <Detail label="Stripe customer" value={customer.stripeCustomerId || 'Non trouvé'} />
                          </dl>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Usage IA</h3>
                          <dl className="mt-3 grid gap-2 text-sm">
                            <Detail label="Appels IA" value={formatNumber(customer.aiCalls)} />
                            <Detail label="Emails concernés" value={formatNumber(customer.gmailMessageCount)} />
                            <Detail label="Tokens estimés" value={formatNumber(customer.totalTokens)} />
                            <Detail label="Dernier usage" value={formatDate(customer.lastAiUsageAt)} />
                          </dl>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Actions</h3>
                          <div className="mt-3 space-y-2 text-sm">
                            {Object.entries(customer.actionBreakdown).length ? (
                              Object.entries(customer.actionBreakdown).map(([action, item]) => (
                                <div key={action} className="flex items-center justify-between gap-3">
                                  <span className="font-semibold text-slate-600 dark:text-white/60">{actionLabel(action)}</span>
                                  <span className="font-extrabold text-slate-950 dark:text-white">
                                    {item.count} · {formatEuro(item.cost)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-500 dark:text-white/45">Aucune action IA.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                        <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Derniers événements IA</h3>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
                              <tr>
                                <th className="py-2 pr-4">Date</th>
                                <th className="py-2 pr-4">Action</th>
                                <th className="py-2 pr-4">Modèle</th>
                                <th className="py-2 pr-4">Tokens</th>
                                <th className="py-2 pr-4">Coût</th>
                                <th className="py-2 pr-4">Statut</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customer.recentEvents.map((event) => (
                                <tr key={event.id} className="border-t border-slate-200/80 dark:border-white/10">
                                  <td className="py-3 pr-4 text-slate-600 dark:text-white/60">{formatDate(event.createdAt)}</td>
                                  <td className="py-3 pr-4 font-semibold text-slate-800 dark:text-white/75">{actionLabel(event.actionType)}</td>
                                  <td className="py-3 pr-4 text-slate-600 dark:text-white/60">{event.provider}/{event.model}</td>
                                  <td className="py-3 pr-4 text-slate-600 dark:text-white/60">{formatNumber(event.promptTokens + event.completionTokens)}</td>
                                  <td className="py-3 pr-4 font-extrabold text-slate-950 dark:text-white">{formatEuro(event.totalCostEur)}</td>
                                  <td className="py-3 pr-4 text-slate-600 dark:text-white/60">{event.success ? 'OK' : event.errorCode || 'Erreur'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const color =
    tone === 'danger'
      ? 'text-red-700 dark:text-red-200'
      : tone === 'warning'
        ? 'text-amber-700 dark:text-amber-200'
        : 'text-slate-800 dark:text-white/75'

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-extrabold ${color}`}>{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-semibold text-slate-500 dark:text-white/45">{label}</dt>
      <dd className="break-words text-right font-semibold text-slate-800 dark:text-white/72">{value}</dd>
    </div>
  )
}

function EuroIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 10h12" />
      <path d="M4 14h10" />
      <path d="M19 5a8 8 0 1 0 0 14" />
    </svg>
  )
}
