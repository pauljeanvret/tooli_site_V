import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null | undefined

export function getSupabaseAdminClient() {
  if (adminClient !== undefined) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !supabaseSecretKey) {
    adminClient = null
    return adminClient
  }

  adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}

export function isSupabaseAdminConfigured() {
  return Boolean(getSupabaseAdminClient())
}
