import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

function serializeError(error: unknown) {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : null

  return {
    name: typeof record?.name === 'string' ? record.name : null,
    message:
      typeof record?.message === 'string'
        ? record.message
        : error instanceof Error
          ? error.message
          : String(error),
    status:
      typeof record?.status === 'number' || typeof record?.status === 'string'
        ? record.status
        : null,
    code: typeof record?.code === 'string' ? record.code : null,
    details: typeof record?.details === 'string' ? record.details : null,
    hint: typeof record?.hint === 'string' ? record.hint : null,
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    const body = await request.json().catch(() => ({}))
    const mismatch = rejectMismatchedBodyUserId(body, auth.user.id)
    if (mismatch) return mismatch

    const userId = auth.user.id
    const email = auth.user.email?.trim().toLowerCase() || ''
    const metadata = auth.user.user_metadata as { full_name?: string; name?: string } | null
    const name =
      typeof metadata?.full_name === 'string' && metadata.full_name.trim().length > 0
        ? metadata.full_name.trim()
        : typeof metadata?.name === 'string' && metadata.name.trim().length > 0
          ? metadata.name.trim()
          : typeof body.name === 'string' && body.name.trim().length > 0
            ? body.name.trim()
            : email.split('@')[0]

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          step: 'auth_login',
          error: {
            name: null,
            message: 'Connexion Supabase requise.',
            status: 400,
            code: null,
            details: 'Le login doit se faire avec email et mot de passe via Supabase Auth.',
            hint: null,
          },
        },
        { status: 400 },
      )
    }

    const admin = getSupabaseAdminClient()
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          step: 'profile_insert',
          error: {
            name: null,
            message: 'Configuration Supabase serveur incomplète.',
            status: 500,
            code: null,
            details: null,
            hint: null,
          },
        },
        { status: 500 },
      )
    }

    const { error } = await admin.from('profiles').upsert({
      id: userId,
      full_name: name,
      email,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      const serialized = serializeError(error)
      console.error('[account/login] profile_insert failed', serialized)
      return NextResponse.json({ ok: false, step: 'profile_insert', error: serialized }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      session: {
        userId,
        name,
        email,
        mode: 'account',
      },
    })
  } catch (error) {
    const serialized = serializeError(error)
    console.error('[account/login] server_exception failed', serialized)
    return NextResponse.json({ ok: false, step: 'server_exception', error: serialized }, { status: 500 })
  }
}
