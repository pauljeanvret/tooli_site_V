import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseHost } from '@/lib/supabase/url'
import { rejectMismatchedBodyUserId, requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

type SerializedError = {
  name: string | null
  message: string
  status: number | string | null
  code: string | null
  details: string | null
  hint: string | null
}

function serializeError(error: unknown): SerializedError {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : null
  const message =
    typeof record?.message === 'string'
      ? record.message
      : error instanceof Error
        ? error.message
        : String(error)

  return {
    name: typeof record?.name === 'string' ? record.name : null,
    message,
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

async function upsertProfile(admin: SupabaseClient, input: { userId: string; name: string; email: string }) {
  return admin.from('profiles').upsert({
    id: input.userId,
    full_name: input.name,
    email: input.email,
    updated_at: new Date().toISOString(),
  })
}

function sessionFromUser(user: User, fallbackName: string) {
  const metadata = user.user_metadata as { full_name?: string; name?: string }
  const email = user.email || ''

  return {
    userId: user.id,
    name: metadata.full_name || metadata.name || fallbackName || email.split('@')[0],
    email,
    mode: 'account' as const,
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const debug = {
    supabaseHost: getSupabaseHost(supabaseUrl),
    secretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  }

  try {
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
            details: JSON.stringify(debug),
            hint: null,
          },
        },
        { status: 500 },
      )
    }

    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    const body = await request.json().catch(() => ({}))
    const mismatch = rejectMismatchedBodyUserId(body, auth.user.id)
    if (mismatch) return mismatch

    const bodyName = typeof body.name === 'string' ? body.name.trim() : ''
    const session = sessionFromUser(auth.user, bodyName)
    const userId = session.userId
    const email = session.email.trim().toLowerCase()
    const name = (session.name || email.split('@')[0]).trim()

    if (!userId || !isValidEmail(email) || name.length < 1) {
      return NextResponse.json(
        {
          ok: false,
          step: 'profile_insert',
          error: {
            name: null,
            message: 'Session Supabase invalide.',
            status: 400,
            code: null,
            details: 'Connectez-vous avant de synchroniser le profil Toolia.',
            hint: null,
          },
        },
        { status: 400 },
      )
    }

    const { error } = await upsertProfile(admin, { userId, name, email })
    if (error) {
      const serialized = serializeError(error)
      console.error('[account/profile] profile_insert failed', {
        debug,
        error: serialized,
      })
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
    console.error('[account/profile] server_exception failed', {
      debug,
      error: serialized,
    })
    return NextResponse.json({ ok: false, step: 'server_exception', error: serialized }, { status: 500 })
  }
}
