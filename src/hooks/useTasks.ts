'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { TaskWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'

export function useTasks(userId: string | undefined, limit: number = 10) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchTasks() {
    try {
      if (!userId) {
        setTasks([]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching tasks for user:', userId)
      setIsLoading(true)
      
      const supabase = createClientComponentClient<Database>()

      // Get all tasks with status 'active' or 'on_deck'
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .in('status', ['active', 'on_deck'])
        .order('due_date', { ascending: true })
        .limit(limit)

      console.log('Task query response:', { taskData, taskError });

      if (taskError) throw taskError
      if (!taskData || taskData.length === 0) {
        console.log('No tasks found')
        setTasks([])
        return
      }

      // Get the corresponding items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .in('id', taskData.map(task => task.id))

      console.log('Items query response:', { itemsData, itemsError });

      if (itemsError) throw itemsError

      // Combine tasks and items
      const combinedTasks = taskData
        .map(task => {
          const item = itemsData?.find(item => item.id === task.id)
          if (!item) {
            console.log(`No matching item found for task ${task.id}`)
            return null
          }
        
          return {
            id: task.id,
            assigned_date: task.assigned_date,
            due_date: task.due_date,
            status: task.status,
            description: task.description,
            is_project_converted: task.is_project_converted,
            converted_project_id: task.converted_project_id,
            priority: task.priority,
            item: item
          }
        })
        .filter((task): task is TaskWithDetails => task !== null)

      console.log('Setting tasks state with:', combinedTasks);
      setTasks(combinedTasks)
      
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