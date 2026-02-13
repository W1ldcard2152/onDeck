'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Singleton pattern for Supabase client to reduce connection overhead
let supabaseClient: ReturnType<typeof createClientComponentClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient()
  }
  return supabaseClient
}

// Reset client if needed (for testing or auth changes)
export function resetSupabaseClient() {
  supabaseClient = null
}