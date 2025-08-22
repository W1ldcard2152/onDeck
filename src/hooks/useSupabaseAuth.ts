'use client'

import { useEffect, useState } from 'react'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Get initial session - this is faster than getUser()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  return { user, loading }
}