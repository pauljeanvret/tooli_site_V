import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isAdminEmail } from '@/lib/admin'
import { diagnosticStatusOptions, type DiagnosticStatus } from '@/lib/diagnostic'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export const dynamic = 'force-dynamic'

const statusValues = diagnosticStatusOptions.map((status) => status.value) as [DiagnosticStatus, ...DiagnosticStatus[]]
const planValues = ['starter', 'pro', 'premium'] as const

async function requireAdmin(request: NextRequest) {
  const auth = await requireAuthenticatedRouteUser(request)
  if (auth.response) return { user: null, response: auth.response }

  if (!isAdminEmail(auth.user.email)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          ok: false,
          message: 'Accès admin non autorisé.',
        },
        { status: 403 },
      ),
    }
  }

  return { user: auth.user, response: null }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, message: 'Client Supabase serveur indisponible.' },
      { status: 500 },
    )
  }

  const status = request.nextUrl.searchParams.get('status')
  const plan = request.nextUrl.searchParams.get('plan')

  let query = admin
    .from('diagnostic_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250)

  if (status && statusValues.includes(status as DiagnosticStatus)) {
    query = query.eq('status', status)
  }

  if (plan && planValues.includes(plan as (typeof planValues)[number])) {
    query = query.eq('recommended_plan', plan)
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/diagnostics] list failed', {
      message: error.message,
      code: error.code,
    })

    return NextResponse.json(
      { ok: false, message: 'Impossible de charger les diagnostics.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, submissions: data || [] })
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(statusValues).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Mise à jour invalide.' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, message: 'Client Supabase serveur indisponible.' },
      { status: 500 },
    )
  }

  const payload: { status?: DiagnosticStatus; notes?: string | null } = {}
  if (parsed.data.status) payload.status = parsed.data.status
  if ('notes' in parsed.data) payload.notes = parsed.data.notes?.trim() || null

  if (!Object.keys(payload).length) {
    return NextResponse.json(
      { ok: false, message: 'Aucun changement à enregistrer.' },
      { status: 400 },
    )
  }

  const { data, error } = await admin
    .from('diagnostic_submissions')
    .update(payload)
    .eq('id', parsed.data.id)
    .select('*')
    .single()

  if (error) {
    console.error('[admin/diagnostics] update failed', {
      message: error.message,
      code: error.code,
    })

    return NextResponse.json(
      { ok: false, message: 'Impossible de mettre à jour ce diagnostic.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, submission: data })
}
