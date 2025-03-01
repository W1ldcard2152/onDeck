'use client'

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { TaskWithDetails } from '@/lib/types';
import type { Database } from '@/types/database.types';
import { useOfflineData } from './useOfflineData';

export function useTasksWithOffline(userId: string | undefined, limit: number = 50) {
  const [onlineTasks, setOnlineTasks] = useState<TaskWithDetails[]>([]);
  const [isOnlineLoading, setIsOnlineLoading] = useState(true);
  const [onlineError, setOnlineError] = useState<Error | null>(null);
  
  // Fetch tasks from the server when online
  const fetchOnlineTasks = useCallback(async () => {
    // Don't try to fetch if we're offline or don't have a userId
    if (!userId || !navigator.onLine) {
      setIsOnlineLoading(false);
      return;
    }
    
    try {
      setIsOnlineLoading(true);
      
      const supabase = createClientComponentClient<Database>();
  
      // Get all tasks including completed ones and project linked tasks
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (taskError) throw taskError;
      if (!taskData || taskData.length === 0) {
        setOnlineTasks([]);
        setIsOnlineLoading(false);
        return;
      }
  
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .in('id', taskData.map(task => task.id));
  
      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
        setOnlineTasks([]);
        setIsOnlineLoading(false);
        return;
      }
  
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
  
      setOnlineTasks(combinedTasks);
      
    } catch (e) {
      console.error('Error in fetchOnlineTasks:', e);
      setOnlineError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'));
    } finally {
      setIsOnlineLoading(false);
    }
  }, [userId]);

  // Fetch online tasks on mount and when userId changes
  useEffect(() => {
    fetchOnlineTasks();
  }, [userId, fetchOnlineTasks]);

  // Use the useOfflineData hook to handle offline support
  const {
    data: tasks,
    loading,
    isOffline,
    lastSynced,
    addItem,
    updateItem,
    deleteItem
  } = useOfflineData<TaskWithDetails>({
    collection: 'tasks',
    onlineData: onlineTasks,
    isOnlineLoading
  });

  // Combined refetch function
  const refetch = async () => {
    if (navigator.onLine) {
      await fetchOnlineTasks();
    }
  };

  return { 
    tasks, 
    loading: loading || isOnlineLoading, 
    error: onlineError,
    isOffline,
    lastSynced,
    refetch,
    addTask: addItem,
    updateTask: updateItem,
    deleteTask: deleteItem
  };
}