'use client'

import { useEffect, useState, useRef } from 'react'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-client'

const CACHED_USER_ID_KEY = 'sophia_cached_user_id'

export function getCachedUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CACHED_USER_ID_KEY)
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()
  const prevUserRef = useRef<User | null>(null)

  useEffect(() => {
    let mounted = true

    const updateUser = (newUser: User | null) => {
      if (!mounted) return
      setUser(newUser)
      setLoading(false)

      // Cache user ID for offline use
      if (newUser?.id) {
        localStorage.setItem(CACHED_USER_ID_KEY, newUser.id)
      } else if (prevUserRef.current && !newUser) {
        // User signed out — clear cache
        localStorage.removeItem(CACHED_USER_ID_KEY)
      }
      prevUserRef.current = newUser
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        updateUser(session?.user ?? null)
      }
    )

    // Get initial session - this is faster than getUser()
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  return { user, loading }
}