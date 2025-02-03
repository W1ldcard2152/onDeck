'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Entry } from '@/types/database.types'

export function useTasks(userId: string, limit: number = 10) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchTasks() {
      try {
        console.log('Fetching tasks for user:', userId)
        setIsLoading(true)
        
        // Make sure we're querying the entries table
        const { data, error, count } = await supabase
          .from('entries')  // Query the entries table, not tasks
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .eq('type', 'task')  // This filters for only task type entries
          .limit(limit)
          .order('created_at', { ascending: false })

        console.log('Query response:', { data, error, count })

        if (error) {
          console.error('Supabase error:', error)
          throw error
        }
        
        if (!data) {
          console.log('No data returned from query')
          setEntries([])
          return
        }

        console.log('Tasks fetched successfully:', data.length)
        setEntries(data)
      } catch (e) {
        console.error('Error in fetchTasks:', e)
        setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchTasks()
  }, [userId, limit])

  return { entries, isLoading, error }
}