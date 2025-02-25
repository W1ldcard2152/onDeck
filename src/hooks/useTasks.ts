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
  
      // First debug the raw task data from the database
      const { data: taskDataRaw, error: taskErrorRaw } = await supabase
        .from('tasks')
        .select('*');
      
      console.log('ALL tasks in database:', taskDataRaw?.length);
      console.log('Sample tasks statuses:', taskDataRaw?.slice(0, 5).map(t => ({ 
        id: t.id, 
        status: t.status 
      })));
  
      // Then get all tasks including completed ones
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true })
        .limit(limit)
  
      console.log('Task query response:', { 
        count: taskData?.length, 
        statuses: taskData?.map(t => t.status) 
      });
  
      if (taskError) throw taskError
      if (!taskData || taskData.length === 0) {
        console.log('No tasks found')
        setTasks([])
        return
      }
  
      const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('item_type', 'task')
      .eq('is_archived', false) // Only non-archived items
      .in('id', taskData.map(task => task.id))
  
      console.log('Items query response:', { 
        count: itemsData?.length,
        ids: itemsData?.map(item => item.id)
      });
  
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
  
      console.log('Combined tasks with status breakdown:', {
        total: combinedTasks.length,
        active: combinedTasks.filter(t => t.status === 'active').length,
        onDeck: combinedTasks.filter(t => t.status === 'on_deck').length,
        completed: combinedTasks.filter(t => t.status === 'completed').length,
        nullStatus: combinedTasks.filter(t => t.status === null).length,
      });
  
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