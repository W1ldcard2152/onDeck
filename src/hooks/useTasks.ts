'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TaskWithDetails, TaskStatus } from '@/lib/types'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'

export function useTasks(
  userId: string | undefined,
  limit: number = 50,
  includeHabitTasks: boolean = false,
  statusFilter?: TaskStatus[]
) {
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
      
      // First get tasks with proper filtering for habit tasks and date range
      // Dashboard shows tasks from 30 days ago to 5 days in future (or no assigned date)
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
      const upperDateFilter = fiveDaysFromNow.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const lowerDateFilter = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`Filtering tasks to assigned_date between ${lowerDateFilter} and ${upperDateFilter} or no assigned_date`);
      
      // Build the query with proper date filtering
      // Use a simpler approach: get tasks with no date OR within date range
      let tasksQuery = supabase
        .from('tasks')
        .select('*');
      
      // Apply status filter if provided
      if (statusFilter && statusFilter.length > 0) {
        // Filter by status first - this applies to ALL tasks (habit and non-habit)
        tasksQuery = tasksQuery.in('status', statusFilter);
      }

      // Then apply habit task filtering
      if (includeHabitTasks === false) {
        // Explicitly exclude habit tasks
        tasksQuery = tasksQuery.is('habit_id', null);
      }
      // If includeHabitTasks is true or not specified, include all tasks (both regular and habit tasks)
      
      const { data: allTasksRaw, error: tasksError} = await tasksQuery
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true })
        .order('assigned_date', { ascending: true, nullsFirst: false });
      
      console.log('Tasks query completed:', { taskCount: allTasksRaw?.length, tasksError })
      if (tasksError) throw tasksError;
      if (!allTasksRaw || allTasksRaw.length === 0) {
        setTasks([]);
        return;
      }
      
      // No date filtering - show all tasks
      const allTasks = allTasksRaw;
      
      console.log(`Filtered ${allTasksRaw.length} tasks down to ${allTasks.length} within date range ${lowerDateFilter} to ${upperDateFilter}`);
      
      // Get the task IDs to fetch corresponding items
      const taskIds = allTasks.map(task => task.id);
      console.log('About to query items for task IDs in batches:', taskIds.length);
      
      // Process in batches to avoid URL length limitations
      const batchSize = 50;
      const allItemData: any[] = [];
      
      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batchIds = taskIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(taskIds.length / batchSize);
        
        console.log(`Processing items batch ${batchNumber}/${totalBatches} with ${batchIds.length} items`)
        
        // Retry logic for rate limiting
        let retries = 0;
        const maxRetries = 3;
        
        while (retries <= maxRetries) {
          try {
            const { data: batchItemData, error: batchItemError } = await supabase
              .from('items')
              .select('*')
              .in('id', batchIds)
              .eq('user_id', userId)
              .eq('item_type', 'task')
              .eq('is_archived', false);
            
            if (batchItemError) {
              // Check if it's a rate limit error
              if (batchItemError.message?.includes('429') || batchItemError.message?.includes('rate limit')) {
                if (retries < maxRetries) {
                  const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
                  console.warn(`Rate limit hit in items batch ${batchNumber}, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1})`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  retries++;
                  continue;
                }
              }
              console.error(`Error in items batch ${batchNumber}:`, batchItemError);
              throw batchItemError;
            }
            
            if (batchItemData) {
              allItemData.push(...batchItemData);
            }
            
            // Success - break out of retry loop
            break;
            
          } catch (error) {
            if (retries < maxRetries) {
              const delay = Math.pow(2, retries) * 1000;
              console.warn(`Error in items batch ${batchNumber}, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1}):`, error);
              await new Promise(resolve => setTimeout(resolve, delay));
              retries++;
              continue;
            }
            console.error(`Failed to process items batch ${batchNumber} after ${maxRetries + 1} attempts:`, error);
            throw error;
          }
        }
        
        // Add delay between batches to avoid rate limiting (except for last batch)
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      
      console.log('All items batches completed, total items found:', allItemData.length)
      if (allItemData.length === 0) {
        setTasks([])
        return
      }
      
      const taskData = allTasks;
      const itemsData = allItemData;
  
      // Combine items and tasks
      const combinedTasks = taskData
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
            daily_context: task.daily_context,
            sort_order: task.sort_order || 0,
            created_at: item.created_at,
            updated_at: item.updated_at,
            title: item.title,
            type: 'task' as const,
            user_id: item.user_id,
            content: task.description,
            item: item
          }
        })
        .filter(task => task !== null) as TaskWithDetails[]
  
      setTasks(combinedTasks)
      
    } catch (e) {
      console.error('Error in fetchTasks:', e)
      console.error('Full error details:', JSON.stringify(e, null, 2))
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userId, includeHabitTasks, statusFilter?.join(',')]) // Use stable string representation

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