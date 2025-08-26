'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HabitsTable } from '@/components/HabitsTable';
import { NewHabitForm } from '@/components/NewHabitForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { getSupabaseClient } from '@/lib/supabase-client';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import type { TaskWithDetails } from '@/lib/types';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';

export default function HabitsPage() {
  const { user } = useSupabaseAuth();
  const { habits, isLoading, error, refetch } = useHabits(user?.id);
  
  // State for habit tasks debugging
  const [habitTasks, setHabitTasks] = useState<TaskWithDetails[]>([]);
  const [showHabitTasks, setShowHabitTasks] = useState(false);
  const [loadingHabitTasks, setLoadingHabitTasks] = useState(false);
  const [refreshingAllTasks, setRefreshingAllTasks] = useState(false);
  
  // State for habit editing
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  const fetchHabitTasks = useCallback(async () => {
    if (!user?.id) return;
    
    setLoadingHabitTasks(true);
    try {
      const supabase = getSupabaseClient();
      
      // Get items for habit tasks
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_type', 'task')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      
      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) {
        setHabitTasks([]);
        return;
      }
      
      // Get tasks with habit status - use batch processing to avoid URL length issues
      const itemIds = itemsData.map(item => item.id);
      console.log('Fetching habit tasks for item IDs in batches:', itemIds.length);
      
      // Process in batches to avoid URL length limitations
      const batchSize = 50;
      const allTaskData: any[] = [];
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batchIds = itemIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(itemIds.length / batchSize);
        
        console.log(`Processing habit task batch ${batchNumber}/${totalBatches} with ${batchIds.length} items`);
        
        try {
          const { data: batchTaskData, error: batchTaskError } = await supabase
            .from('tasks')
            .select('*')
            .in('id', batchIds)
            .not('habit_id', 'is', null)
            .order('assigned_date', { ascending: true });
          
          if (batchTaskError) {
            console.error(`Error in habit task batch ${batchNumber}:`, batchTaskError);
            throw batchTaskError;
          }
          
          if (batchTaskData) {
            allTaskData.push(...batchTaskData);
          }
          
          // Add delay between batches to avoid rate limiting (except for last batch)
          if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          console.error(`Failed to process habit task batch ${batchNumber}:`, error);
          throw error;
        }
      }
      
      console.log('All habit task batches completed, total tasks found:', allTaskData.length);
      if (allTaskData.length === 0) {
        setHabitTasks([]);
        return;
      }
      
      const taskData = allTaskData;
      
      // Combine items and tasks
      const combinedTasks: TaskWithDetails[] = taskData
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
            habit_id: task.habit_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            title: item.title,
            type: 'task' as const,
            user_id: item.user_id,
            content: task.description,
            item: item
          };
        })
        .filter((task): task is TaskWithDetails => task !== null);
      
      setHabitTasks(combinedTasks);
    } catch (err) {
      console.error('Error fetching habit tasks:', err);
    } finally {
      setLoadingHabitTasks(false);
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (showHabitTasks) {
      fetchHabitTasks();
    }
  }, [showHabitTasks, fetchHabitTasks]);
  
  
  const refreshAllHabitTasks = async () => {
    if (!user?.id) return;
    
    setRefreshingAllTasks(true);
    try {
      const supabase = getSupabaseClient();
      const taskGenerator = new HabitTaskGenerator(supabase, user.id);
      
      console.log('Starting habit task regeneration...');
      await taskGenerator.regenerateAllHabitTasks();
      console.log('Habit task regeneration completed');
      
      // Refresh the habit tasks debug view
      if (showHabitTasks) {
        await fetchHabitTasks();
      }
      
      alert('All habit tasks have been refreshed successfully!');
    } catch (err) {
      console.error('Failed to refresh habit tasks:', err);
      alert('Failed to refresh habit tasks. Check console for details.');
    } finally {
      setRefreshingAllTasks(false);
    }
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
  };

  const handleHabitUpdated = async () => {
    setEditingHabit(null);
    refetch();
    
    // Also refresh the debug view if it's open
    if (showHabitTasks) {
      await fetchHabitTasks();
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Habits</h1>
          <div className="flex gap-2">
            <button
              onClick={refreshAllHabitTasks}
              disabled={refreshingAllTasks}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAllTasks ? 'animate-spin' : ''}`} />
              {refreshingAllTasks ? 'Refreshing...' : 'Refresh Tasks'}
            </button>
            <NewHabitForm 
              onHabitCreated={refetch} 
              editingHabit={editingHabit}
              onHabitUpdated={handleHabitUpdated}
            />
          </div>
        </div>
        
        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Habits</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={refreshAllHabitTasks}
              disabled={refreshingAllTasks}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAllTasks ? 'animate-spin' : ''}`} />
              {refreshingAllTasks ? 'Refreshing...' : 'Refresh Tasks'}
            </button>
            <NewHabitForm 
              onHabitCreated={refetch} 
              editingHabit={editingHabit}
              onHabitUpdated={handleHabitUpdated}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-full"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="text-red-600">
              {error instanceof Error ? error.message : 'Error loading habits'}
            </div>
          </div>
        ) : !habits || habits.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No habits yet. Create your first habit to get started!
            </div>
          </div>
        ) : (
          <HabitsTable 
            habits={habits} 
            onHabitUpdate={refetch}
            onEditHabit={handleEditHabit}
          />
        )}
      </div>
      
      {/* Debug Section - Habit Tasks */}
      <div className="bg-white rounded-xl shadow-sm">
        <button
          onClick={() => setShowHabitTasks(!showHabitTasks)}
          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
        >
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Habit Tasks (Debug View)
            </h3>
            <p className="text-sm text-gray-500">
              Shows all tasks linked to habits
            </p>
          </div>
          {showHabitTasks ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        
        {showHabitTasks && (
          <div className="border-t">
            {loadingHabitTasks ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            ) : habitTasks.length === 0 ? (
              <div className="p-6">
                <div className="text-gray-500 text-center py-4">
                  No habit tasks found
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Habit ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {habitTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {task.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.due_date || 'None'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.assigned_date || 'None'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {task.habit_id || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}