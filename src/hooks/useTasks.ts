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

      // First get all task IDs from the tasks table that have dates
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')  // Select all columns to make sure we get the status
        .order('due_date', { ascending: true })
        .limit(limit)

      console.log('Task query response:', { taskData, taskError });

      if (taskError) throw taskError
      if (!taskData || taskData.length === 0) {
        console.log('No tasks found')
        setTasks([])
        return
      }

      // Then get the corresponding items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .in('id', taskData.map(task => task.id))

      console.log('Items query response:', { itemsData, itemsError });

      if (itemsError) throw itemsError
      if (!itemsData || itemsData.length === 0) {
        console.log('No matching items found')
        setTasks([])
        return
      }

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
          status: task.status,
          description: task.description,
          is_project_converted: task.is_project_converted,
          converted_project_id: task.converted_project_id,
          priority: task.priority,
          item: item
        }
      }).filter((task): task is TaskWithDetails => task !== null)

      // Sort tasks by status and due date
      const sortedTasks = combinedTasks.sort((a, b) => {
        const statusOrder = { 'active': 0, 'on_deck': 1, 'completed': 2 };
        const statusA = statusOrder[a.status || 'on_deck'];
        const statusB = statusOrder[b.status || 'on_deck'];
        if (statusA !== statusB) {
          return statusA - statusB;
        }
        
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        }
        if (a.due_date) return -1
        if (b.due_date) return 1
        return new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime()
      })

      console.log('Setting tasks state with:', sortedTasks);
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