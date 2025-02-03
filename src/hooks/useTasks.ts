'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Task {
  id: string
  do_date: string | null
  due_date: string | null
  status: string | null
  is_project_converted: boolean | null
  converted_project_id: string | null
  items: {
    title: string
    user_id: string
  }
}

export function useTasks(userId: string, limit: number = 10) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchTasks() {
      try {
        console.log('Fetching tasks for user:', userId)
        setIsLoading(true)
        
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            *,
            items!tasks_id_fkey (
              title,
              user_id
            )
          `)
          .eq('status', 'active')
          .eq('items.user_id', userId)
          .limit(limit)
          .order('due_date', { ascending: true })

        console.log('Query response:', { data, error })

        if (error) throw error
        
        if (!data) {
          console.log('No data returned from query')
          setTasks([])
          return
        }

        console.log('Tasks fetched successfully:', data.length)
        setTasks(data as Task[])
      } catch (e) {
        console.error('Error in fetchTasks:', e)
        setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchTasks()
  }, [userId, limit])

  return { tasks, isLoading, error }
}