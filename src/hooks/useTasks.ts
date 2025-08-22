'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TaskWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useTasks(userId: string | undefined, limit: number = 50) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(getSupabaseClient())
  
  // Use a ref to track if we're already fetching to prevent duplicate requests
  const isFetchingRef = useRef(false)
  // Track last refresh time to avoid duplicate fetches in short time periods
  const lastRefreshTimeRef = useRef<number>(0)

  const fetchTasks = useCallback(async () => {
    // Prevent fetch if already in progress
    if (isFetchingRef.current) {
      return
    }
    
    // Skip fetching if no user ID
    if (!userId) {
      setTasks([])
      setIsLoading(false)
      return
    }
    
    // Prevent duplicate fetches within 100ms
    const now = Date.now()
    if (now - lastRefreshTimeRef.current < 100) {
      return
    }
    
    // Set fetching flag to true
    isFetchingRef.current = true
    lastRefreshTimeRef.current = now
    
    try {
      setIsLoading(true)
      
      const supabase = supabaseRef.current
  
      // Get items first
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
  
      if (itemsError) throw itemsError
      if (!itemsData || itemsData.length === 0) {
        setTasks([])
        return
      }
      
      // Get tasks for those items
      const itemIds = itemsData.map(item => item.id)
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', itemIds)
        .order('due_date', { ascending: true })
      
      if (taskError) throw taskError
      if (!taskData || taskData.length === 0) {
        setTasks([])
        return
      }
  
      // Combine items and tasks
      const combinedTasks: TaskWithDetails[] = taskData
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
            created_at: item.created_at,
            updated_at: item.updated_at,
            title: item.title,
            type: 'task' as const,
            user_id: item.user_id,
            content: task.description,
            item: item
          }
        })
        .filter((task): task is TaskWithDetails => task !== null)
  
      setTasks(combinedTasks)
      
    } catch (e) {
      console.error('Error in fetchTasks:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
    } finally {
      setIsLoading(false)
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
  
  // Set up real-time subscriptions with debouncing
  useEffect(() => {
    if (!userId) return
    
    const supabase = supabaseRef.current
    let refreshTimeout: NodeJS.Timeout
    
    const debouncedRefresh = () => {
      clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        fetchTasks()
      }, 250) // Debounce rapid changes
    }
    
    // Single channel for both tables to reduce connections
    const channel = supabase
      .channel(`user-tasks-${userId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' }, 
        debouncedRefresh
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` },
        debouncedRefresh
      )
      .subscribe()
      
    return () => {
      clearTimeout(refreshTimeout)
      channel.unsubscribe()
    }
  }, [userId, fetchTasks])

  return { 
    tasks, 
    isLoading, 
    error, 
    refetch: fetchTasks 
  }
}