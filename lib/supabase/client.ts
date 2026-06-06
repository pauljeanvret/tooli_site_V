'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null | undefined

export function getSupabaseBrowserClient() {
  if (browserClient !== undefined) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabasePublicKey) {
    browserClient = null
    return browserClient
  }

  browserClient = createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })

  return browserClient
}
