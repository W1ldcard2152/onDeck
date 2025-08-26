'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TaskWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useTasks(userId: string | undefined, limit: number = 50, includeHabitTasks: boolean = false) {
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
  
      console.log('Starting fetchTasks for userId:', userId)
      
      // Get items first
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
  
      console.log('Items query completed:', { itemsData, itemsError })
      if (itemsError) throw itemsError
      if (!itemsData || itemsData.length === 0) {
        setTasks([])
        return
      }
      
      // Get tasks for those items - use batch processing to avoid URL length issues
      const itemIds = itemsData.map(item => item.id);
      console.log('About to query tasks for item IDs in batches:', itemIds.length)
      
      // Process in batches to avoid URL length limitations
      const batchSize = 50;
      const allTaskData: any[] = [];
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batchIds = itemIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(itemIds.length / batchSize);
        
        console.log(`Processing batch ${batchNumber}/${totalBatches} with ${batchIds.length} items`)
        
        // Retry logic for rate limiting
        let retries = 0;
        const maxRetries = 3;
        
        while (retries <= maxRetries) {
          try {
            let taskQuery = supabase
              .from('tasks')
              .select('*')
              .in('id', batchIds);
            
            // Conditionally exclude habit tasks (filter by habit_id instead of status)
            if (!includeHabitTasks) {
              taskQuery = taskQuery.is('habit_id', null);
            }
            
            const { data: batchTaskData, error: batchTaskError } = await taskQuery
              .order('due_date', { ascending: true })
              .order('assigned_date', { ascending: true });
            
            if (batchTaskError) {
              // Check if it's a rate limit error
              if (batchTaskError.message?.includes('429') || batchTaskError.message?.includes('rate limit')) {
                if (retries < maxRetries) {
                  const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
                  console.warn(`Rate limit hit in batch ${batchNumber}, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1})`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  retries++;
                  continue;
                }
              }
              console.error(`Error in batch ${batchNumber}:`, batchTaskError);
              throw batchTaskError;
            }
            
            if (batchTaskData) {
              allTaskData.push(...batchTaskData);
            }
            
            // Success - break out of retry loop
            break;
            
          } catch (error) {
            if (retries < maxRetries) {
              const delay = Math.pow(2, retries) * 1000;
              console.warn(`Error in batch ${batchNumber}, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1}):`, error);
              await new Promise(resolve => setTimeout(resolve, delay));
              retries++;
              continue;
            }
            console.error(`Failed to process batch ${batchNumber} after ${maxRetries + 1} attempts:`, error);
            throw error;
          }
        }
        
        // Add delay between batches to avoid rate limiting (except for last batch)
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      
      console.log('All batches completed, total tasks found:', allTaskData.length)
      if (allTaskData.length === 0) {
        setTasks([])
        return
      }
      
      const taskData = allTaskData;
  
      // Combine items and tasks
      const combinedTasks: TaskWithDetails[] = taskData
        .map(task => {
          const item = itemsData.find(item => item.id === task.id)
          if (!item) return null
          
          return {
            id: task.id,
            assigned_date: task.assigned_date,
            due_date: task.due_date,
            reminder_time: task.reminder_time,
            status: task.status || 'on_deck',
            description: task.description,
            is_project_converted: task.is_project_converted || false,
            converted_project_id: task.converted_project_id,
            priority: task.priority || 'normal',
            project_id: task.project_id,
            habit_id: task.habit_id,
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
      console.error('Full error details:', JSON.stringify(e, null, 2))
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userId, includeHabitTasks])

  // Initial data fetch when userId changes
  useEffect(() => {
    if (userId) {
      fetchTasks()
    } else {
      setTasks([])
      setIsLoading(false)
    }
  }, [userId, fetchTasks, includeHabitTasks])
  
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
  }, [userId, fetchTasks, includeHabitTasks])

  return { 
    tasks, 
    isLoading, 
    error, 
    refetch: fetchTasks 
  }
}