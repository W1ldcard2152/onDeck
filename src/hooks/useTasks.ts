'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Task {
  id: string
  do_date: string | null
  due_date: string | null
  status: string | null
  is_project_converted: boolean | null
  converted_project_id: string | null
  description: string | null
  items: {
    title: string
    user_id: string
  }
}

export function useTasks(userId: string, limit: number = 10) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchTasks() {
    try {
      console.log('Fetching tasks for user:', userId)
      setIsLoading(true)
      
      // First, get items for this user
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, title, user_id')
        .eq('user_id', userId)
        .eq('item_type', 'task');
      
      console.log('Items found:', itemsData);
      
      if (itemsError) throw itemsError;
      
      if (!itemsData?.length) {
        setTasks([]);
        return;
      }
      
      // Then get tasks for these items
      const itemIds = itemsData.map(item => item.id);
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', itemIds)
        .order('due_date', { ascending: true });
        
      console.log('Tasks found:', tasksData);
      
      if (tasksError) throw tasksError;
      
      if (!tasksData) {
        setTasks([]);
        return;
      }

      // Combine the data
      const combinedTasks = tasksData.map(task => ({
        ...task,
        items: itemsData.find(item => item.id === task.id)
      }));

      console.log('Combined tasks:', combinedTasks);
      
      setTasks(combinedTasks as Task[]);
    } catch (e) {
      console.error('Error in fetchTasks:', e);
      setError(e instanceof Error ? e : new Error('An error occurred while fetching tasks'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, [userId, limit]);

  return { tasks, isLoading, error, refetch: fetchTasks };
}