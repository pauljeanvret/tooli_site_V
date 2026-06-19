'use client'

import Link from 'next/link'
import React from 'react'
import { ArrowRight, CheckCircle2, Clock, Euro, ShieldCheck } from 'lucide-react'

import {
  calculateDiagnostic,
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
  'w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-sm font-medium text-slate-950 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35 dark:focus:border-blue-300 dark:focus:ring-blue-300/10'

const labelClass = 'text-sm font-semibold text-slate-950 dark:text-white'
const helperClass = 'mt-1 text-xs leading-relaxed text-slate-500 dark:text-white/55'

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
    <div className="rounded-[22px] border border-slate-200/90 bg-white/80 p-4 shadow-[0_18px_48px_rgba(22,34,74,0.08)] dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{value}</p>
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

  React.useEffect(() => {
    trackEvent('diagnostic_started')
  }, [])

  function updateField<K extends keyof DiagnosticFormState>(field: K, value: DiagnosticFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

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
    trackEvent('diagnostic_submitted', {
      emails_per_day_range: payload.emails_per_day_range,
      inbox_minutes_per_day: payload.inbox_minutes_per_day,
    })

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
        return
      }

      setResult(data.result)
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
    } finally {
      setIsSubmitting(false)
    }
  }

  const preview = result || (form.inbox_minutes_per_day && form.monthly_income_range ? calculateDiagnostic({
    ...form,
    inbox_minutes_per_day: Number(form.inbox_minutes_per_day),
  }) : null)

  return (
    <div className="relative overflow-hidden bg-toolia-bg-main">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.16),transparent_58%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.18),transparent_58%)]" />
      <section className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 md:px-8 lg:px-10 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
              Diagnostic Gmail
            </p>
            <h1 className="font-heading mt-4 max-w-xl text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              Combien votre boîte mail vous coûte-t-elle vraiment ?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-white/70 sm:text-lg">
              Répondez à quelques questions. Toolia estime le temps perdu, le coût mensuel approximatif et l’offre la plus adaptée à votre volume Gmail.
            </p>

            <div className="mt-7 grid gap-3 text-sm text-slate-600 dark:text-white/60">
              {[
                'Aucune connexion Gmail nécessaire.',
                'Calcul basé uniquement sur vos réponses.',
                'Résultat immédiat, sans scan de votre boîte mail.',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {preview && (
              <div className="mt-8 rounded-[28px] border border-slate-200/90 bg-white/80 p-5 shadow-[0_20px_70px_rgba(22,34,74,0.09)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-white/45">
                  Aperçu
                </p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {formatEuro(preview.cost_lost_per_month)}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
                  coût mensuel estimé à partir des réponses déjà saisies.
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_24px_90px_rgba(22,34,74,0.11)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/60 sm:p-7"
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
                  Vos coordonnées
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                      Nous l’utiliserons uniquement pour vous envoyer votre diagnostic et vous recontacter à propos de Toolia.
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
              </section>

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

              <section className="rounded-[24px] border border-slate-200/90 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <label className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={form.consent_to_contact}
                    onChange={(event) => updateField('consent_to_contact', event.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-500 dark:border-white/20"
                  />
                  <span className="text-sm leading-6 text-slate-700 dark:text-white/70">
                    J’accepte que Toolia enregistre mes réponses afin de calculer mon diagnostic et puisse me recontacter par email à propos de Toolia. Je peux demander la suppression de mes données à tout moment.
                  </span>
                </label>
                {errors.consent_to_contact && (
                  <span className="mt-2 block text-xs font-medium text-red-600 dark:text-red-300">
                    {errors.consent_to_contact}
                  </span>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-white/50">
                  Toolia ne lit pas votre boîte Gmail pour ce diagnostic. Les résultats sont calculés uniquement à partir de vos réponses. Vos informations sont utilisées pour générer votre diagnostic et, si vous l’acceptez, vous recontacter à propos de Toolia. Vous pouvez demander la suppression de vos données à tooliadev@gmail.com.
                </p>
              </section>

              {submitError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-toolia-primary px-6 py-4 text-base font-bold text-white shadow-[0_18px_44px_rgba(22,34,74,0.24)] transition hover:-translate-y-0.5 hover:bg-toolia-primary-light disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Calcul du diagnostic...' : 'Calculer mon diagnostic'}
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>

        {result && (
          <section ref={resultRef} className="mt-10 rounded-[34px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_28px_100px_rgba(22,34,74,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/62 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
              Votre diagnostic Toolia
            </p>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-heading max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl">
                  Environ {result.hours_lost_per_month}h perdues par mois dans votre boîte mail.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-white/60">
                  Cette estimation est calculée à partir de vos réponses. Elle donne un ordre de grandeur, pas une mesure financière exacte.
                </p>
              </div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-300/20 dark:bg-emerald-300/10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
                  Offre recommandée
                </p>
                <p className="mt-1 text-3xl font-extrabold text-emerald-900 dark:text-white">
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

            <div className="mt-7 rounded-[24px] border border-slate-200/90 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 flex-shrink-0 text-blue-700 dark:text-blue-200" />
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950 dark:text-white">
                    Pourquoi {planLabels[result.recommended_plan]} ?
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/60">
                    {result.recommendation_text}
                  </p>
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
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-950 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-blue-300/40 dark:hover:bg-blue-400/10"
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
