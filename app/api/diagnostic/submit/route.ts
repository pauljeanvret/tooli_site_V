import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { calculateDiagnostic, diagnosticOptions } from '@/lib/diagnostic'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function optionSchema(values: readonly string[]) {
  return z
    .string()
    .trim()
    .min(1)
    .max(140)
    .refine((value) => values.includes(value), 'Option invalide.')
}

const diagnosticSubmitSchema = z.object({
  first_name: z.string().trim().min(1, 'Prénom requis.').max(80),
  email: z.string().trim().min(1, 'Email requis.').max(254).email('Email invalide.'),
  age_range: optionSchema(diagnosticOptions.age_range),
  role: optionSchema(diagnosticOptions.role),
  company_size: optionSchema(diagnosticOptions.company_size),
  emails_per_day_range: optionSchema(diagnosticOptions.emails_per_day_range),
  inbox_minutes_per_day: z.coerce
    .number()
    .int()
    .refine(
      (value) => diagnosticOptions.inbox_minutes_per_day.some((option) => option.value === value),
      'Durée invalide.',
    ),
  main_pain: optionSchema(diagnosticOptions.main_pain),
  organization_level: optionSchema(diagnosticOptions.organization_level),
  monthly_income_range: optionSchema(diagnosticOptions.monthly_income_range),
  consent_to_contact: z.boolean().refine((value) => value === true, 'Consentement requis.'),
  source: z.string().trim().max(80).optional().default('diagnostic'),
  utm_source: z.string().trim().max(120).optional().default(''),
  utm_medium: z.string().trim().max(120).optional().default(''),
  utm_campaign: z.string().trim().max(120).optional().default(''),
  company_website: z.string().trim().max(200).optional().default(''),
})

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = diagnosticSubmitSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Certains champs sont manquants ou invalides.',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    if (parsed.data.company_website) {
      return NextResponse.json(
        { ok: false, message: 'Submission refused.' },
        { status: 400 },
      )
    }

    const admin = getSupabaseAdminClient()
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: 'Le diagnostic est indisponible pour le moment.' },
        { status: 500 },
      )
    }

    const result = calculateDiagnostic(parsed.data)
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null
    const referrer = request.headers.get('referer')?.slice(0, 500) || null

    const { data, error } = await admin
      .from('diagnostic_submissions')
      .insert({
        first_name: parsed.data.first_name,
        email: parsed.data.email.toLowerCase(),
        age_range: parsed.data.age_range,
        role: parsed.data.role,
        company_size: parsed.data.company_size,
        emails_per_day_range: parsed.data.emails_per_day_range,
        emails_per_day_estimate: result.emails_per_day_estimate,
        inbox_minutes_per_day: parsed.data.inbox_minutes_per_day,
        main_pain: parsed.data.main_pain,
        organization_level: parsed.data.organization_level,
        monthly_income_range: parsed.data.monthly_income_range,
        monthly_income_estimate: result.monthly_income_estimate,
        hourly_value: result.hourly_value,
        hours_lost_per_month: result.hours_lost_per_month,
        hours_lost_per_year: result.hours_lost_per_year,
        cost_lost_per_month: result.cost_lost_per_month,
        cost_lost_per_year: result.cost_lost_per_year,
        recommended_plan: result.recommended_plan,
        consent_to_contact: parsed.data.consent_to_contact,
        status: 'new',
        source: parsed.data.source || 'diagnostic',
        utm_source: parsed.data.utm_source || null,
        utm_medium: parsed.data.utm_medium || null,
        utm_campaign: parsed.data.utm_campaign || null,
        user_agent: userAgent,
        referrer,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[diagnostic/submit] insert failed', {
        message: error.message,
        code: error.code,
      })

      return NextResponse.json(
        { ok: false, message: 'Impossible d’enregistrer le diagnostic pour le moment.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      submissionId: data?.id,
      result,
    })
  } catch (error) {
    console.error('[diagnostic/submit] unexpected error', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })

    return NextResponse.json(
      { ok: false, message: 'Impossible de calculer le diagnostic pour le moment.' },
      { status: 500 },
    )
  }
}
