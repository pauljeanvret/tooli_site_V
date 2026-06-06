import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseHost, isValidSupabaseProjectUrl } from '@/lib/supabase/url'

type SignupStep = 'auth_signup' | 'auth_signup_no_user' | 'profile_insert' | 'server_exception'
type SerializedError = {
  name: string | null
  message: string
  status: number | string | null
  code: string | null
  details: string | null
  hint: string | null
}

type SafeAuthResponseShape = {
  hasUser: boolean
  hasSession: boolean
  userId: string | null
  userEmail: string | null
  identitiesCount: number
  error: SerializedError | null
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
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

function makeError(message: string, extra?: Partial<SerializedError>) {
  return {
    name: extra?.name ?? null,
    message,
    status: extra?.status ?? null,
    code: extra?.code ?? null,
    details: extra?.details ?? null,
    hint: extra?.hint ?? null,
  } satisfies SerializedError
}

function debugFailure(step: SignupStep, error: SerializedError, status = 500) {
  return NextResponse.json({ ok: false, step, error }, { status })
}

function getSupabaseEnvState() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabaseHost = getSupabaseHost(supabaseUrl)
  const supabaseUrlLooksValid = isValidSupabaseProjectUrl(supabaseUrl)

  return {
    supabaseUrl,
    supabasePublicKey,
    supabaseSecretKey,
    debug: {
      supabaseHost,
      supabaseUrlLooksValid,
      publicKey: Boolean(supabasePublicKey),
      secretKey: Boolean(supabaseSecretKey),
    },
  }
}

function safeAuthResponseShape(
  data: {
    user?: {
      id?: string
      email?: string
      identities?: unknown[] | null
    } | null
    session?: unknown | null
  } | null,
  error: unknown,
): SafeAuthResponseShape {
  return {
    hasUser: Boolean(data?.user),
    hasSession: Boolean(data?.session),
    userId: data?.user?.id || null,
    userEmail: data?.user?.email || null,
    identitiesCount: Array.isArray(data?.user?.identities) ? data.user.identities.length : 0,
    error: error ? serializeError(error) : null,
  }
}

function isExistingAccountError(error: SerializedError) {
  const value = `${error.message} ${error.code || ''}`.toLowerCase()

  return (
    value.includes('already registered') ||
    value.includes('already exists') ||
    value.includes('user_already_exists') ||
    value.includes('email_exists')
  )
}

function isRateLimitError(error: SerializedError) {
  const value = `${error.message} ${error.code || ''} ${error.status || ''}`.toLowerCase()

  return (
    value.includes('429') ||
    value.includes('rate limit') ||
    value.includes('too many') ||
    value.includes('over_email_send_rate_limit')
  )
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const found = data.users.find((user) => user.email?.toLowerCase() === email)
    if (found) return found
    if (data.users.length < 100) return null
  }

  return null
}

async function upsertProfile(input: {
  admin: SupabaseClient
  userId: string
  name: string
  email: string
}) {
  return input.admin.from('profiles').upsert({
    id: input.userId,
    full_name: input.name,
    email: input.email,
    updated_at: new Date().toISOString(),
  })
}

async function upsertExistingUserProfileIfFound(admin: SupabaseClient, email: string, name: string) {
  const existingUser = await findAuthUserByEmail(admin, email)
  if (!existingUser?.id) return null

  const { error } = await upsertProfile({
    admin,
    userId: existingUser.id,
    name,
    email: existingUser.email || email,
  })

  if (error) throw error
  return existingUser
}

export async function POST(request: NextRequest) {
  try {
    const env = getSupabaseEnvState()
    console.info('[account/signup] Supabase hostname checked', env.debug)

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (name.length < 2 || !isValidEmail(email) || password.length < 8) {
      return debugFailure(
        'auth_signup',
        makeError('Nom, email professionnel et mot de passe requis.', {
          details: 'Le mot de passe doit contenir au moins 8 caracteres.',
          status: 400,
        }),
        400,
      )
    }

    if (!env.supabaseUrl || !env.supabasePublicKey || !env.debug.supabaseUrlLooksValid) {
      return debugFailure(
        'auth_signup',
        makeError('Configuration Supabase publique incomplete.', {
          details: JSON.stringify(env.debug),
          status: 500,
        }),
        500,
      )
    }

    if (!env.supabaseSecretKey) {
      return debugFailure(
        'profile_insert',
        makeError('Configuration Supabase serveur incomplete.', {
          details: JSON.stringify(env.debug),
          status: 500,
        }),
        500,
      )
    }

    const admin = getSupabaseAdminClient()
    if (!admin) {
      return debugFailure(
        'profile_insert',
        makeError('Client Supabase serveur indisponible.', {
          details: JSON.stringify(env.debug),
          status: 500,
        }),
        500,
      )
    }

    const authClient = createClient(env.supabaseUrl, env.supabasePublicKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          apikey: env.supabasePublicKey,
          Authorization: `Bearer ${env.supabasePublicKey}`,
        },
      },
    })

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })
    const safeResponse = safeAuthResponseShape(authData, authError)

    console.info('[account/signup] auth_signup response', safeResponse)

    if (authError) {
      const serialized = serializeError(authError)
      console.error('[account/signup] auth_signup failed', {
        env: env.debug,
        response: safeResponse,
        error: serialized,
      })

      if (isExistingAccountError(serialized)) {
        await upsertExistingUserProfileIfFound(admin, email, name)
        return debugFailure(
          'auth_signup',
          makeError('Un compte existe déjà avec cet email. Connectez-vous.', {
            code: serialized.code,
            status: serialized.status,
            details: serialized.message,
          }),
          409,
        )
      }

      if (isRateLimitError(serialized)) {
        return debugFailure(
          'auth_signup',
          makeError('Trop de tentatives. Attendez quelques minutes avant de réessayer.', {
            code: serialized.code,
            status: serialized.status || 429,
            details: serialized.message,
          }),
          429,
        )
      }

      return debugFailure(
        'auth_signup',
        serialized,
        typeof serialized.status === 'number' ? serialized.status : 500,
      )
    }

    if (
      authData.user?.id &&
      safeResponse.identitiesCount === 0 &&
      !authData.session
    ) {
      await upsertExistingUserProfileIfFound(admin, email, name)
      return debugFailure(
        'auth_signup',
        makeError('Un compte existe déjà avec cet email. Connectez-vous.', {
          status: 409,
          details: JSON.stringify(safeResponse),
        }),
        409,
      )
    }

    let userId = authData.user?.id || null
    let userEmail = authData.user?.email || email
    let emailConfirmationRequired = !authData.session

    if (!userId) {
      const foundUser = await findAuthUserByEmail(admin, email)

      if (foundUser?.id) {
        userId = foundUser.id
        userEmail = foundUser.email || email
        emailConfirmationRequired = !foundUser.email_confirmed_at
      } else {
        console.error('[account/signup] auth_signup_no_user failed', {
          env: env.debug,
          response: safeResponse,
        })
        return NextResponse.json(
          {
            ok: false,
            step: 'auth_signup_no_user',
            message:
              "Supabase n'a pas retourné d'utilisateur. Vérifiez si l'email existe déjà ou si la confirmation email bloque la création.",
            debug: safeResponse,
          },
          { status: 500 },
        )
      }
    }

    const { error: profileError } = await upsertProfile({
      admin,
      userId,
      name,
      email: userEmail,
    })

    if (profileError) {
      const serialized = serializeError(profileError)
      console.error('[account/signup] profile_insert failed', {
        env: env.debug,
        error: serialized,
      })
      return debugFailure(
        'profile_insert',
        serialized,
        500,
      )
    }

    return NextResponse.json({
      ok: true,
      emailConfirmationRequired,
      message: emailConfirmationRequired
        ? 'Compte créé. Vérifiez votre email si Supabase demande une confirmation.'
        : 'Compte créé.',
      session: {
        userId,
        name,
        email: userEmail,
        mode: 'account',
      },
      authSession: authData.session
        ? {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
          }
        : null,
    })
  } catch (error) {
    const serialized = serializeError(error)
    console.error('[account/signup] server_exception failed', serialized)
    return debugFailure(
      'server_exception',
      serialized,
      500,
    )
  }
}

export async function GET() {
  return debugFailure(
    'server_exception',
    makeError('Methode non autorisee pour la creation de compte.', {
      details: 'Utilisez POST /api/account/signup avec name, email et password.',
      status: 405,
    }),
    405,
  )
}
