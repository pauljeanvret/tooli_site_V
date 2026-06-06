import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return null

  return authorization.slice('bearer '.length).trim()
}

export async function getAuthenticatedSupabaseUser(request: NextRequest): Promise<User | null> {
  const token = getBearerToken(request)
  const admin = getSupabaseAdminClient()
  if (!token || !admin) return null

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user?.id) return null

  return data.user
}
