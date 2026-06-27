'use client'

import Link from 'next/link'
import React from 'react'
import { ArrowRight, CheckCircle2, Clock, Euro, ShieldCheck } from 'lucide-react'

import {
  diagnosticOptions,
  formatEuro,
  getPlanSignupUrl,
  planLabels,
  type DiagnosticFormValues,
  type DiagnosticResult,
} from '@/lib/diagnostic'
import { trackEvent } from '@/lib/analytics'

type DiagnosticFormState = Omit<DiagnosticFormValues, 'inbox_minutes_per_day'> & {
  inbox_minutes_per_day: string
}

type FieldErrors = Partial<Record<keyof DiagnosticFormState, string>>

const diagnosticInteractionFields = new Set<keyof DiagnosticFormState>([
  'age_range',
  'role',
  'company_size',
  'emails_per_day_range',
  'inbox_minutes_per_day',
  'main_pain',
  'organization_level',
  'monthly_income_range',
])

const initialForm: DiagnosticFormState = {
  first_name: '',
  email: '',
  age_range: '',
  role: '',
  company_size: '',
  emails_per_day_range: '',
  inbox_minutes_per_day: '',
  main_pain: '',
  organization_level: '',
  monthly_income_range: '',
  consent_to_contact: false,
  source: 'diagnostic',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  company_website: '',
}

const inputClass =
  'w-full min-w-0 max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.10)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-500 sm:border-slate-200/90 sm:bg-white/90 sm:font-medium sm:placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35 dark:focus:border-blue-300 dark:focus:ring-blue-300/10'

const labelClass = 'block text-sm font-bold text-slate-950 dark:text-white'
const helperClass = 'mt-1 block text-xs leading-relaxed text-slate-700 dark:text-white/55'

function cleanErrorMessage(value: unknown) {
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : ''
}

function validateClientForm(form: DiagnosticFormState) {
  const errors: FieldErrors = {}

  if (!form.first_name.trim()) errors.first_name = 'Indiquez votre prénom.'
  if (!form.email.trim()) {
    errors.email = 'Indiquez votre email.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Indiquez un email valide.'
  }

  ;(
    [
      'age_range',
      'role',
      'company_size',
      'emails_per_day_range',
      'inbox_minutes_per_day',
      'main_pain',
      'organization_level',
      'monthly_income_range',
    ] as Array<keyof DiagnosticFormState>
  ).forEach((field) => {
    if (!String(form[field] || '').trim()) errors[field] = 'Ce champ est requis.'
  })

  if (!form.consent_to_contact) {
    errors.consent_to_contact = 'Vous devez accepter pour recevoir votre diagnostic.'
  }

  return errors
}

function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  helper,
}: {
  label: string
  value: string
  options: Array<string | { value: number; label: string }>
  onChange: (value: string) => void
  error?: string
  helper?: string
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {helper && <span className={helperClass}>{helper}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} mt-2`}
      >
        <option value="">Choisir une réponse</option>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : String(option.value)
          const optionLabel = typeof option === 'string' ? option : option.label

          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          )
        })}
      </select>
      {error && <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-300">{error}</span>}
    </label>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="toolia-diagnostic-metric-card rounded-[22px] border border-slate-200/90 bg-white/80 p-4 shadow-[0_18px_48px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-white/5">
      <div className="toolia-diagnostic-metric-icon mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
        {icon}
      </div>
      <p className="toolia-diagnostic-metric-label text-sm font-medium text-slate-500 dark:text-white/55">{label}</p>
      <p className="toolia-diagnostic-metric-value mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

export function DiagnosticClient() {
  const [form, setForm] = React.useState<DiagnosticFormState>(initialForm)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [submitError, setSubmitError] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<DiagnosticResult | null>(null)
  const resultRef = React.useRef<HTMLDivElement>(null)
  const contactSectionRef = React.useRef<HTMLElement>(null)
  const diagnosticStartedTrackedRef = React.useRef(false)
  const contactReachedTrackedRef = React.useRef(false)

  React.useEffect(() => {
    const section = contactSectionRef.current
    if (!section || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !contactReachedTrackedRef.current) {
          contactReachedTrackedRef.current = true
          trackEvent('diagnostic_contact_reached')
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )

    observer.observe(section)

    return () => observer.disconnect()
  }, [])

  function updateField<K extends keyof DiagnosticFormState>(field: K, value: DiagnosticFormState[K]) {
    if (diagnosticInteractionFields.has(field) && !diagnosticStartedTrackedRef.current) {
      diagnosticStartedTrackedRef.current = true
      trackEvent('diagnostic_started', { field })
    }

    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setResult(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    setResult(null)

    const clientErrors = validateClientForm(form)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const payload: DiagnosticFormValues = {
      ...form,
      inbox_minutes_per_day: Number(form.inbox_minutes_per_day),
      source: 'diagnostic',
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; result?: DiagnosticResult; errors?: Record<string, unknown> }
        | null

      if (!response.ok || !data?.ok || !data.result) {
        const serverErrors = data?.errors || {}
        setErrors((current) => ({
          ...current,
          first_name: cleanErrorMessage(serverErrors.first_name) || current.first_name,
          email: cleanErrorMessage(serverErrors.email) || current.email,
          consent_to_contact:
            cleanErrorMessage(serverErrors.consent_to_contact) || current.consent_to_contact,
        }))
        setSubmitError(data?.message || 'Impossible de calculer votre diagnostic pour le moment.')
        setResult(null)
        return
      }

      setResult(data.result)
      trackEvent('diagnostic_submitted', {
        emails_per_day_range: payload.emails_per_day_range,
        inbox_minutes_per_day: payload.inbox_minutes_per_day,
        recommended_plan: data.result.recommended_plan,
      })
      trackEvent('diagnostic_result_viewed', {
        recommended_plan: data.result.recommended_plan,
        emails_per_day_range: payload.emails_per_day_range,
        inbox_minutes_per_day: payload.inbox_minutes_per_day,
      })

      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch {
      setSubmitError('Impossible de calculer votre diagnostic pour le moment.')
      setResult(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = Object.keys(validateClientForm(form)).length === 0 && !isSubmitting

  return (
    <div className="toolia-diagnostic-page relative overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-toolia-bg-main dark:via-toolia-bg-main dark:to-toolia-bg-main">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.10),transparent_56%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.18),transparent_58%)]" />
      <section className="toolia-diagnostic-section relative mx-auto w-full max-w-7xl px-3 py-8 sm:px-6 sm:py-12 md:px-8 lg:px-10 lg:py-16">
        <div className="toolia-diagnostic-layout grid min-w-0 gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="toolia-diagnostic-intro rounded-[30px] border border-slate-300/80 bg-slate-100/95 p-5 shadow-[0_18px_60px_rgba(22,34,74,0.10)] backdrop-blur-xl dark:border-transparent dark:bg-transparent dark:p-0 dark:shadow-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none lg:sticky lg:top-28">
            <p className="toolia-diagnostic-eyebrow text-xs font-extrabold uppercase tracking-[0.28em] text-blue-900 dark:text-blue-200 sm:text-blue-700">
              Diagnostic Gmail
            </p>
            <h1 className="toolia-diagnostic-title font-heading mt-4 max-w-xl text-[clamp(2rem,8.2vw,2.4rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-[#07111f] dark:text-slate-50 dark:[text-shadow:0_2px_26px_rgba(255,255,255,0.14)] sm:text-5xl sm:text-slate-950 lg:text-6xl">
              Combien votre boîte mail vous coûte-t-elle vraiment ?
            </h1>
            <p className="toolia-diagnostic-lead mt-5 max-w-xl text-base font-semibold leading-7 text-slate-800 dark:text-slate-100 sm:text-lg sm:font-normal sm:text-slate-600">
              Répondez à quelques questions. Toolia estime le temps perdu, le coût mensuel approximatif et l’offre la plus adaptée à votre volume Gmail.
            </p>

            <div className="toolia-diagnostic-bullets mt-7 grid gap-3 text-sm font-bold text-slate-800 dark:text-slate-200 sm:font-medium sm:text-slate-600">
              {[
                'Aucune connexion Gmail nécessaire.',
                'Calcul basé uniquement sur vos réponses.',
                'Résultat immédiat, sans scan de votre boîte mail.',
              ].map((item) => (
                <div
                  key={item}
                  className="toolia-diagnostic-bullet flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200/90 bg-white/80 px-3 py-2 shadow-sm dark:border-transparent dark:bg-transparent dark:px-0 dark:py-0 dark:shadow-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none"
                >
                  <CheckCircle2 className="toolia-diagnostic-bullet-icon mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <span className="toolia-diagnostic-bullet-text min-w-0 flex-1">{item}</span>
                </div>
              ))}
            </div>
          </div>

        <form
          onSubmit={handleSubmit}
          className="toolia-diagnostic-form min-w-0 rounded-[32px] border border-slate-300 bg-white p-5 shadow-[0_30px_95px_rgba(22,34,74,0.20)] backdrop-blur-2xl sm:border-slate-200/90 sm:bg-white/90 sm:p-7 sm:shadow-[0_24px_90px_rgba(22,34,74,0.11)] dark:border-white/10 dark:bg-slate-950/60"
        >
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              value={form.company_website}
              onChange={(event) => updateField('company_website', event.target.value)}
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid gap-8">
              <section>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  Votre contexte
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Tranche d’âge"
                    value={form.age_range}
                    options={[...diagnosticOptions.age_range]}
                    onChange={(value) => updateField('age_range', value)}
                    error={errors.age_range}
                  />
                  <SelectField
                    label="Situation / rôle"
                    value={form.role}
                    options={[...diagnosticOptions.role]}
                    onChange={(value) => updateField('role', value)}
                    error={errors.role}
                  />
                  <SelectField
                    label="Taille de l’entreprise"
                    value={form.company_size}
                    options={[...diagnosticOptions.company_size]}
                    onChange={(value) => updateField('company_size', value)}
                    error={errors.company_size}
                  />
                  <SelectField
                    label="Organisation actuelle"
                    value={form.organization_level}
                    options={[...diagnosticOptions.organization_level]}
                    onChange={(value) => updateField('organization_level', value)}
                    error={errors.organization_level}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  Votre boîte mail
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Emails reçus par jour"
                    value={form.emails_per_day_range}
                    options={[...diagnosticOptions.emails_per_day_range]}
                    onChange={(value) => updateField('emails_per_day_range', value)}
                    error={errors.emails_per_day_range}
                  />
                  <SelectField
                    label="Temps passé par jour dans Gmail"
                    value={form.inbox_minutes_per_day}
                    options={[...diagnosticOptions.inbox_minutes_per_day]}
                    onChange={(value) => updateField('inbox_minutes_per_day', value)}
                    error={errors.inbox_minutes_per_day}
                  />
                  <div className="sm:col-span-2">
                    <SelectField
                      label="Votre difficulté principale"
                      value={form.main_pain}
                      options={[...diagnosticOptions.main_pain]}
                      onChange={(value) => updateField('main_pain', value)}
                      error={errors.main_pain}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  Estimation économique
                </h2>
                <div className="mt-4">
                  <SelectField
                    label="Votre revenu mensuel net approximatif ou la valeur mensuelle de votre temps"
                    helper="Cette donnée sert uniquement à estimer le coût du temps perdu dans votre boîte mail. Elle est enregistrée sous forme de fourchette."
                    value={form.monthly_income_range}
                    options={[...diagnosticOptions.monthly_income_range]}
                    onChange={(value) => updateField('monthly_income_range', value)}
                    error={errors.monthly_income_range}
                  />
                </div>
              </section>

              <section
                ref={contactSectionRef}
                onFocusCapture={() => {
                  if (!contactReachedTrackedRef.current) {
                    contactReachedTrackedRef.current = true
                    trackEvent('diagnostic_contact_reached')
                  }
                }}
                className="rounded-[28px] border border-blue-100 bg-blue-50/55 p-4 dark:border-blue-300/15 dark:bg-blue-400/8 sm:p-5"
              >
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  Recevoir mon diagnostic
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-white/60">
                  Dernière étape : indiquez où recevoir votre résultat. Nous l’utiliserons uniquement pour vous envoyer votre diagnostic et vous recontacter à propos de Toolia.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Prénom</span>
                    <input
                      value={form.first_name}
                      onChange={(event) => updateField('first_name', event.target.value)}
                      className={`${inputClass} mt-2`}
                      placeholder="Votre prénom"
                    />
                    {errors.first_name && (
                      <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-300">
                        {errors.first_name}
                      </span>
                    )}
                  </label>

                  <label className="block">
                    <span className={labelClass}>Email</span>
                    <span className={helperClass}>
                      Votre email sert uniquement à vous envoyer le diagnostic et à vous recontacter à propos de Toolia.
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      className={`${inputClass} mt-2`}
                      placeholder="vous@entreprise.com"
                    />
                    {errors.email && (
                      <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-300">
                        {errors.email}
                      </span>
                    )}
                  </label>
                </div>

                <div className="toolia-diagnostic-consent mt-5 rounded-[24px] border border-slate-200/90 bg-white/76 p-4 dark:border-white/10 dark:bg-white/5">
                  <label className="toolia-diagnostic-consent-label grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.consent_to_contact}
                      onChange={(event) => updateField('consent_to_contact', event.target.checked)}
                      className="toolia-diagnostic-consent-checkbox mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-500 dark:border-white/20"
                    />
                    <span className="toolia-diagnostic-consent-text block min-w-0 text-sm font-semibold leading-6 text-slate-800 dark:text-white/75">
                      J’accepte que Toolia enregistre mes réponses afin de calculer mon diagnostic et puisse me recontacter à propos de Toolia.
                    </span>
                  </label>
                  {errors.consent_to_contact && (
                    <span className="mt-2 block text-xs font-medium text-red-600 dark:text-red-300">
                      {errors.consent_to_contact}
                    </span>
                  )}
                  <p className="toolia-diagnostic-consent-note mt-3 text-xs leading-5 text-slate-600 dark:text-white/50">
                    Toolia ne lit pas votre boîte Gmail pour ce diagnostic. Les résultats sont calculés uniquement à partir de vos réponses. Vous pouvez demander la suppression de vos données à tooliadev@gmail.com.
                  </p>
                </div>
              </section>

              {submitError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="toolia-diagnostic-submit flex w-full items-center justify-center gap-2 rounded-full bg-toolia-primary px-6 py-4 text-base font-bold text-white shadow-[0_18px_44px_rgba(22,34,74,0.24)] transition hover:-translate-y-0.5 hover:bg-toolia-primary-light disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Calcul du diagnostic...' : 'Calculer mon diagnostic'}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>

        {result && (
          <section ref={resultRef} className="toolia-diagnostic-result mt-10 rounded-[34px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_28px_100px_rgba(22,34,74,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/62 sm:p-8">
            <p className="toolia-diagnostic-result-eyebrow text-xs font-bold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
              Votre diagnostic Toolia
            </p>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="toolia-diagnostic-result-title font-heading max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl">
                  Environ {result.hours_lost_per_month}h perdues par mois dans votre boîte mail.
                </h2>
                <p className="toolia-diagnostic-result-lead mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-white/60">
                  Cette estimation est calculée à partir de vos réponses. Elle donne un ordre de grandeur, pas une mesure financière exacte.
                </p>
              </div>
              <div className="toolia-diagnostic-plan-card rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-300/20 dark:bg-emerald-300/10">
                <p className="toolia-diagnostic-plan-label text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
                  Offre recommandée
                </p>
                <p className="toolia-diagnostic-plan-name mt-1 text-3xl font-extrabold text-emerald-900 dark:text-white">
                  {planLabels[result.recommended_plan]}
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<Clock className="h-5 w-5" />}
                label="Temps perdu par mois"
                value={`${result.hours_lost_per_month}h`}
              />
              <MetricCard
                icon={<Clock className="h-5 w-5" />}
                label="Temps perdu par an"
                value={`${result.hours_lost_per_year}h`}
              />
              <MetricCard
                icon={<Euro className="h-5 w-5" />}
                label="Coût estimé par mois"
                value={formatEuro(result.cost_lost_per_month)}
              />
              <MetricCard
                icon={<Euro className="h-5 w-5" />}
                label="Coût estimé par an"
                value={formatEuro(result.cost_lost_per_year)}
              />
            </div>

            <div className="toolia-diagnostic-why-card mt-7 rounded-[24px] border border-slate-200/90 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="toolia-diagnostic-why-icon mt-1 h-5 w-5 flex-shrink-0 text-blue-700 dark:text-blue-200" />
                <div>
                  <h3 className="toolia-diagnostic-why-title text-lg font-extrabold text-slate-950 dark:text-white">
                    Pourquoi {planLabels[result.recommended_plan]} ?
                  </h3>
                  <p className="toolia-diagnostic-why-text mt-2 text-sm leading-6 text-slate-600 dark:text-white/60">
                    {result.recommendation_text}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`toolia-diagnostic-roi-card mt-4 rounded-[24px] border p-5 ${
                result.roi_warning
                  ? 'toolia-diagnostic-roi-warning border-amber-200 bg-amber-50/80 dark:border-amber-300/20 dark:bg-amber-300/10'
                  : 'toolia-diagnostic-roi-ok border-emerald-200 bg-emerald-50/80 dark:border-emerald-300/20 dark:bg-emerald-300/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <Euro
                  className={`toolia-diagnostic-roi-icon mt-1 h-5 w-5 flex-shrink-0 ${
                    result.roi_warning ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'
                  }`}
                />
                <div>
                  <h3 className="toolia-diagnostic-roi-title text-lg font-extrabold text-slate-950 dark:text-white">
                    {result.roi_title}
                  </h3>
                  <p className="toolia-diagnostic-roi-text mt-2 text-sm leading-6 text-slate-700 dark:text-white/70">
                    {result.roi_text}
                  </p>
                  {result.roi_warning && (
                    <p className="toolia-diagnostic-roi-note mt-3 text-sm font-semibold leading-6 text-slate-800 dark:text-white/80">
                      Le plan recommandé reste un choix technique. Vous pouvez décider selon le niveau de douleur, de charge mentale et de régularité attendu, pas uniquement selon une économie immédiate.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={getPlanSignupUrl(result.recommended_plan)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-toolia-primary px-6 py-4 text-sm font-bold text-white shadow-[0_18px_44px_rgba(22,34,74,0.22)] transition hover:-translate-y-0.5 hover:bg-toolia-primary-light"
              >
                Commencer avec {planLabels[result.recommended_plan]}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/pricing?plan=${result.recommended_plan}`}
                className="toolia-diagnostic-secondary-cta inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-950 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-blue-300/40 dark:hover:bg-blue-400/10"
              >
                Voir les offres
              </Link>
            </div>
          </section>
        )}
      </section>
    </div>
  )
}
