'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { TaskWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'

export function useTasks(userId: string | undefined, limit: number = 50) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(createClientComponentClient<Database>())
  
  // Use a ref to track if we're already fetching to prevent duplicate requests
  const isFetchingRef = useRef(false)
  // Track last refresh time to avoid duplicate fetches in short time periods
  const lastRefreshTimeRef = useRef<number>(0)

  const fetchTasks = useCallback(async () => {
    // Prevent fetch if already in progress
    if (isFetchingRef.current) {
      console.log('Already fetching tasks, request ignored')
      return
    }
    
    // Skip fetching if no user ID
    if (!userId) {
      setTasks([])
      setIsLoading(false)
      return
    }
    
    // Set fetching flag to true
    isFetchingRef.current = true
    
    // Record fetch timestamp
    lastRefreshTimeRef.current = Date.now()
    
    try {
      console.log('Fetching tasks for user:', userId)
      setIsLoading(true)
      
      const supabase = supabaseRef.current
  
      // Get all tasks including completed ones and project linked tasks
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true })
      
      if (taskError) throw taskError
      if (!taskData || taskData.length === 0) {
        console.log('No tasks found')
        setTasks([])
        setIsLoading(false)
        return
      }
      
      // Count project-linked tasks
      const projectTasksCount = taskData.filter(t => t.project_id).length
      console.log('Task query response:', { 
        count: taskData.length, 
        projectTasks: projectTasksCount 
      })
  
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .in('id', taskData.map(task => task.id))
  
      if (itemsError) throw itemsError
      if (!itemsData || itemsData.length === 0) {
        console.log('No matching items found')
        setTasks([])
        setIsLoading(false)
        return
      }
  
      // Log the items query response
      console.log('Items query response:', { count: itemsData.length })
  
      // Combine items and tasks
      const combinedTasks = taskData
        .map(task => {
          const item = itemsData.find(item => item.id === task.id)
          if (!item) return null
          
          return {
            id: task.id,
            assigned_date: task.assigned_date,
            due_date: task.due_date,
            status: task.status || 'on_deck',
            description: task.description,
            is_project_converted: task.is_project_converted || false,
            converted_project_id: task.converted_project_id,
            priority: task.priority || 'normal',
            project_id: task.project_id,
            item: item
          }
        })
        .filter((task): task is TaskWithDetails => task !== null)
  
      // Get unique project IDs
      const projectIds = [...new Set(
        combinedTasks
          .filter(t => t.project_id)
          .map(t => t.project_id)
      )].filter(Boolean)
      
      console.log('Combined tasks with project breakdown:', {
        total: combinedTasks.length,
        withProjects: combinedTasks.filter(t => t.project_id).length,
        projectIds
      })
  
      setTasks(combinedTasks)
      
    } catch (e) {
      console.error('Error in fetchTasks:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
    } finally {
      setIsLoading(false)
      // Reset the fetching flag
      isFetchingRef.current = false
    }
  }, [userId])

  // Initial data fetch when userId changes
  useEffect(() => {
    if (userId) {
      fetchTasks()
    } else {
      setTasks([])
      setIsLoading(false)
    }
  }, [userId, fetchTasks])
  
  // Set up real-time subscriptions - separate from initial data fetch
  useEffect(() => {
    if (!userId) return
    
    const supabase = supabaseRef.current
    
    console.log('Setting up real-time subscriptions for tasks')
    
    // Set up real-time subscriptions for both tasks and items tables
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' }, 
        (payload) => {
          console.log('Task change detected, refreshing data...')
          fetchTasks() // Always refresh when real-time events occur
        }
      )
      .subscribe()
    
    const itemsChannel = supabase  
      .channel('items-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('Item change detected, refreshing data...')
          fetchTasks() // Always refresh when real-time events occur
        }
      )
      .subscribe()
      
    // Clean up subscriptions when component unmounts or userId changes
    return () => {
      console.log('Cleaning up task subscriptions')
      tasksChannel.unsubscribe()
      itemsChannel.unsubscribe()
    }
  }, [userId, fetchTasks])

  return { 
    tasks, 
    isLoading, 
    error, 
    refetch: fetchTasks 
  }
}