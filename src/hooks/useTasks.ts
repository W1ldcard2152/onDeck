'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TaskWithDetails, TaskStatus } from '@/lib/types'
import type { Database } from '@/types/database.types'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getPendingItems } from '@/lib/offlineSyncQueue'
import * as taskService from '@/lib/taskService'

export type { CreateTaskInput, UpdateTaskInput, TaskRow } from '@/lib/taskService'

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

      // Build the tasks query with proper filtering
      let tasksQuery = supabase
        .from('tasks')
        .select('*');

      // Apply status filter if provided
      if (statusFilter && statusFilter.length > 0) {
        tasksQuery = tasksQuery.in('status', statusFilter);
      }

      // Then apply habit task filtering
      if (includeHabitTasks === false) {
        tasksQuery = tasksQuery.is('habit_id', null);
      }

      const { data: allTasks, error: tasksError } = await tasksQuery
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true })
        .order('assigned_date', { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;
      if (!allTasks || allTasks.length === 0) {
        setTasks([]);
        return;
      }

      // Fetch all corresponding items in a single query (no batching needed)
      const taskIds = allTasks.map(task => task.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .in('id', taskIds)
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false);

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
        setTasks([])
        return
      }

      // Build a lookup map for O(1) item access instead of O(n) .find() per task
      const itemsMap = new Map(itemsData.map(item => [item.id, item]));

      // Combine items and tasks
      const combinedTasks = allTasks
        .map(task => {
          const item = itemsMap.get(task.id)
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
            checklist_template_id: task.checklist_template_id || null,
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

      // Merge in any pending offline tasks
      const pendingTasks = getPendingItems('task')
      const pendingTaskDetails: TaskWithDetails[] = pendingTasks.map(entry => ({
        id: entry.id,
        created_at: entry.createdAt,
        updated_at: entry.createdAt,
        title: entry.title,
        type: 'task' as const,
        user_id: userId!,
        content: entry.fields.description || null,
        due_date: entry.fields.due_date || null,
        assigned_date: entry.fields.assigned_date || null,
        reminder_time: entry.fields.reminder_time || null,
        status: entry.fields.status || 'on_deck',
        priority: entry.fields.priority || 'normal',
        description: entry.fields.description || null,
        project_id: null,
        habit_id: null,
        is_project_converted: false,
        converted_project_id: null,
        daily_context: entry.fields.daily_context || null,
        sort_order: 999,
        checklist_template_id: null,
        item: {
          id: entry.id,
          user_id: userId!,
          title: entry.title,
          created_at: entry.createdAt,
          updated_at: entry.createdAt,
          item_type: 'task',
          is_archived: false,
          archived_at: null,
          archive_reason: null
        },
        _pending: true
      }))

      setTasks([...combinedTasks, ...pendingTaskDetails])

    } catch (e) {
      console.error('Error in fetchTasks:', e)
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

  // ---- Mutation methods (Phase 3a.4) ----
  // Pessimistic: each method calls the service, then refetches. Components handle their
  // own optimistic UI. Errors are thrown — they do NOT set the hook's `error` state
  // (that's reserved for the read path).

  const createTask = useCallback(
    async (input: taskService.CreateTaskInput): Promise<taskService.TaskRow> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      const result = await taskService.createTask(supabaseRef.current, input)
      await fetchTasks()
      return result
    },
    [userId, fetchTasks]
  )

  const deleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.deleteTask(supabaseRef.current, userId, taskId)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const deleteTasks = useCallback(
    async (taskIds: string[]): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.deleteTasks(supabaseRef.current, userId, taskIds)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: taskService.UpdateTaskInput
    ): Promise<taskService.TaskRow> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      const result = await taskService.updateTask(supabaseRef.current, userId, taskId, updates)
      await fetchTasks()
      return result
    },
    [userId, fetchTasks]
  )

  const updateTaskStatus = useCallback(
    async (taskId: string, status: string): Promise<taskService.TaskRow> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      const result = await taskService.updateTaskStatus(supabaseRef.current, userId, taskId, status)
      await fetchTasks()
      return result
    },
    [userId, fetchTasks]
  )

  const updateTaskPriority = useCallback(
    async (taskId: string, priority: string): Promise<taskService.TaskRow> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      const result = await taskService.updateTaskPriority(supabaseRef.current, userId, taskId, priority)
      await fetchTasks()
      return result
    },
    [userId, fetchTasks]
  )

  const swapTaskOrder = useCallback(
    async (
      taskA: { id: string; sort_order: number },
      taskB: { id: string; sort_order: number }
    ): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.swapTaskOrder(supabaseRef.current, userId, taskA, taskB)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const reorderTasks = useCallback(
    async (updates: Array<{ id: string; sort_order: number }>): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.reorderTasks(supabaseRef.current, userId, updates)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const updateHabitTasksField = useCallback(
    async (
      habitId: string,
      field: 'checklist_template_id',
      value: string | null
    ): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.updateHabitTasksField(supabaseRef.current, userId, habitId, field, value)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const deleteIncompleteHabitTasks = useCallback(
    async (habitId: string): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.deleteIncompleteHabitTasks(supabaseRef.current, userId, habitId)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const deleteIncompleteProjectTasks = useCallback(
    async (projectId: string): Promise<void> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      await taskService.deleteIncompleteProjectTasks(supabaseRef.current, userId, projectId)
      await fetchTasks()
    },
    [userId, fetchTasks]
  )

  const countTasksByContext = useCallback(
    async (contextId: string): Promise<number> => {
      if (!userId) throw new Error('useTasks: cannot mutate without authenticated user')
      return taskService.countTasksByContext(supabaseRef.current, userId, contextId)
    },
    [userId]
  )

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    createTask,
    deleteTask,
    deleteTasks,
    updateTask,
    updateTaskStatus,
    updateTaskPriority,
    swapTaskOrder,
    reorderTasks,
    updateHabitTasksField,
    deleteIncompleteHabitTasks,
    deleteIncompleteProjectTasks,
    countTasksByContext,
  }
}
