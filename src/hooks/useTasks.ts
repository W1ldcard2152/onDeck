'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { TaskWithDetails } from '@/lib/types'
import type { Database } from '@/types/database.types'

export function useTasks(userId: string | undefined, limit: number = 50) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  // Use a ref to track if we're already fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);
  // Use a ref to store last user ID to prevent duplicate fetches for the same user
  const lastUserIdRef = useRef<string | undefined>(undefined);

  const fetchTasks = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      console.log('Already fetching tasks, request ignored');
      return;
    }
    
    // If user hasn't changed, don't fetch again
    if (lastUserIdRef.current === userId && tasks.length > 0) {
      console.log('User has not changed and we already have tasks, skipping fetch');
      return;
    }
    
    try {
      if (!userId) {
        setTasks([]);
        setIsLoading(false);
        return;
      }
      
      // Set fetching flag to true
      isFetchingRef.current = true;
      lastUserIdRef.current = userId;
  
      console.log('Fetching tasks for user:', userId);
      setIsLoading(true);
      
      const supabase = createClientComponentClient<Database>();
  
      // Get all tasks including completed ones and project linked tasks
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (taskError) throw taskError;
      if (!taskData || taskData.length === 0) {
        console.log('No tasks found');
        setTasks([]);
        setIsLoading(false);
        return;
      }
      
      // Count project-linked tasks
      const projectTasksCount = taskData.filter(t => t.project_id).length;
      console.log('Task query response:', { 
        count: taskData.length, 
        projectTasks: projectTasksCount 
      });
  
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .in('id', taskData.map(task => task.id));
  
      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
        console.log('No matching items found');
        setTasks([]);
        setIsLoading(false);
        return;
      }
  
      // Log the items query response
      console.log('Items query response:', { count: itemsData.length });
  
      // Combine items and tasks
      const combinedTasks = taskData
        .map(task => {
          const item = itemsData.find(item => item.id === task.id);
          if (!item) return null;
          
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
          };
        })
        .filter((task): task is TaskWithDetails => task !== null);
  
      // Get unique project IDs
      const projectIds = [...new Set(
        combinedTasks
          .filter(t => t.project_id)
          .map(t => t.project_id)
      )].filter(Boolean);
      
      console.log('Combined tasks with project breakdown:', {
        total: combinedTasks.length,
        withProjects: combinedTasks.filter(t => t.project_id).length,
        projectIds
      });
  
      setTasks(combinedTasks);
      
    } catch (e) {
      console.error('Error in fetchTasks:', e);
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'));
    } finally {
      setIsLoading(false);
      // Reset the fetching flag
      isFetchingRef.current = false;
    }
  }, [userId, tasks.length]);

  // Only fetch tasks when userId changes
  useEffect(() => {
    fetchTasks();
  }, [userId, fetchTasks]);

  return { 
    tasks, 
    isLoading, 
    error, 
    refetch: fetchTasks 
  };
}