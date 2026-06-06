import { NextResponse } from 'next/server'
import { getSupabaseHost, isValidSupabaseProjectUrl } from '@/lib/supabase/url'

function getPublicKeyPrefix(key: string | undefined) {
  const value = key?.trim() || ''

  if (value.startsWith('sb_publishable')) return 'sb_publishable'
  if (value.startsWith('eyJ') || value.split('.').length === 3) return 'jwt/legacy'
  return 'unknown'
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, message: 'Route de diagnostic désactivée en production.' },
      { status: 404 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabaseHost = getSupabaseHost(supabaseUrl)
  const supabaseUrlValid = isValidSupabaseProjectUrl(supabaseUrl)

  let canReachSupabase = false
  let status = 0
  let message = 'Supabase public URL or key missing.'

  if (supabaseUrl && supabasePublicKey && supabaseUrlValid) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`, {
        cache: 'no-store',
        headers: {
          apikey: supabasePublicKey,
          Authorization: `Bearer ${supabasePublicKey}`,
        },
      })
      const text = await response.text()

      canReachSupabase = true
      status = response.status
      message = text.slice(0, 300) || response.statusText
    } catch (error) {
      canReachSupabase = false
      status = 0
      message = error instanceof Error ? error.message : 'Supabase fetch failed.'
    }
  }

  return NextResponse.json({
    ok: Boolean(supabaseUrlValid && supabasePublicKey && supabaseSecretKey && canReachSupabase),
    supabaseUrlExists: Boolean(supabaseUrl),
    supabaseHost,
    publicKeyExists: Boolean(supabasePublicKey),
    publicKeyPrefix: getPublicKeyPrefix(supabasePublicKey),
    secretKeyExists: Boolean(supabaseSecretKey),
    canReachSupabase,
    status,
    message,
  })
}
