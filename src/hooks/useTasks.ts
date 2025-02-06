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

      // First, get items of type 'task'
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .limit(limit)

      if (itemsError) throw itemsError
      if (!itemsData || itemsData.length === 0) {
        console.log('No task items found')
        setTasks([])
        return
      }

      console.log('Found items:', itemsData)

      // Get task details for these items
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', itemsData.map(item => item.id))
        .eq('is_project_converted', false)
        .or('due_date.gte.now,due_date.is.null')

      if (taskError) throw taskError
      if (!taskData) {
        console.log('No task details found')
        setTasks([])
        return
      }

      console.log('Found task details:', taskData)

      // Combine items and tasks
      const combinedTasks = taskData.map(task => {
        const item = itemsData.find(item => item.id === task.id)
        if (!item) {
          console.warn(`No matching item found for task ${task.id}`)
          return null
        }
      
        return {
          id: task.id,
          assigned_date: task.assigned_date,
          due_date: task.due_date,
          status: task.status || 'active',
          description: task.description,
          is_project_converted: task.is_project_converted,
          converted_project_id: task.converted_project_id,
          item: item
        }
      }).filter((task): task is TaskWithDetails => task !== null)

      console.log('Combined tasks:', combinedTasks)

      // Sort tasks
      const sortedTasks = combinedTasks.sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        }
        if (a.due_date) return -1
        if (b.due_date) return 1
        return new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime()
      })

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