'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { TaskWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'

export function useTasks(userId: string, limit: number = 10) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchTasks() {
    try {
      console.log('Fetching tasks for user:', userId)
      setIsLoading(true)
      
      const supabase = createClientComponentClient<Database>()

      // Query tasks and join with items
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          item:items!inner (
            id,
            user_id,
            title,
            created_at,
            updated_at,
            item_type,
            is_archived,
            archived_at,
            archive_reason
          )
        `)
        .eq('items.user_id', userId)
        .eq('items.item_type', 'task')
        .eq('items.is_archived', false)
        .eq('is_project_converted', false)
        .or('due_date.gte.now, due_date.is.null')
        .order('due_date', { ascending: true })
        .limit(limit)

      console.log('Task query result:', {
        success: !taskError,
        count: taskData?.length,
        data: taskData
      })

      if (taskError) {
        throw taskError
      }

      if (!taskData) {
        setTasks([])
        return
      }

      // Transform the data into the expected format
      const combinedTasks = taskData.map(task => ({
        id: task.id,
        do_date: task.do_date,
        due_date: task.due_date,
        status: task.status || 'active',
        description: task.description,
        is_project_converted: task.is_project_converted,
        converted_project_id: task.converted_project_id,
        item: task.item
      })) as TaskWithDetails[]

      // Sort tasks: tasks with due dates first, sorted by date
      // then tasks without due dates, sorted by creation date
      const sortedTasks = combinedTasks.sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime();
      });

      setTasks(sortedTasks)
      
    } catch (e) {
      console.error('Error in fetchTasks:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [userId, limit])

  return { tasks, isLoading, error, refetch: fetchTasks }
}