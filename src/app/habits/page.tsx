'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HabitsTable } from '@/components/HabitsTable';
import { NewHabitForm } from '@/components/NewHabitForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { getSupabaseClient } from '@/lib/supabase-client';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { TaskWithDetails } from '@/lib/types';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';

export default function HabitsPage() {
  const { user } = useSupabaseAuth();
  const { habits, isLoading, error, refetch } = useHabits(user?.id);
  
  // State for habit tasks debugging
  const [habitTasks, setHabitTasks] = useState<TaskWithDetails[]>([]);
  const [showHabitTasks, setShowHabitTasks] = useState(false);
  const [loadingHabitTasks, setLoadingHabitTasks] = useState(false);
  const [emergencyCleanup, setEmergencyCleanup] = useState(false);
  
  // State for habit editing
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  const fetchHabitTasks = useCallback(async () => {
    if (!user?.id) return;
    
    setLoadingHabitTasks(true);
    try {
      const supabase = getSupabaseClient();
      
      // Get habit tasks within extended range to support minimum task generation (365 days max)
      const oneYearFromNow = new Date();
      oneYearFromNow.setDate(oneYearFromNow.getDate() + 365);
      const dateFilter = oneYearFromNow.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`Fetching habit tasks with assigned_date <= ${dateFilter} for debugging (extended for minimum task generation)`);
      
      // Get habit tasks directly with date filtering to avoid processing too many items
      const { data: habitTasksData, error: habitTasksError } = await supabase
        .from('tasks')
        .select('*')
        .not('habit_id', 'is', null)
        .or(`assigned_date.is.null,assigned_date.lte.${dateFilter}`)
        .order('assigned_date', { ascending: true });
      
      if (habitTasksError) throw habitTasksError;
      if (!habitTasksData || habitTasksData.length === 0) {
        setHabitTasks([]);
        return;
      }
      
      console.log(`Found ${habitTasksData.length} habit tasks within 1 year (for minimum task generation support)`);
      
      // Get corresponding items for these tasks
      const taskIds = habitTasksData.map(task => task.id);
      console.log('Fetching items for habit task IDs in batches:', taskIds.length);
      
      // Process items in batches to avoid URL length limitations
      const batchSize = 50;
      const allItemData: any[] = [];
      
      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batchIds = taskIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(taskIds.length / batchSize);
        
        console.log(`Processing habit items batch ${batchNumber}/${totalBatches} with ${batchIds.length} items`);
        
        try {
          const { data: batchItemData, error: batchItemError } = await supabase
            .from('items')
            .select('*')
            .in('id', batchIds)
            .eq('user_id', user.id)
            .eq('item_type', 'task')
            .eq('is_archived', false);
          
          if (batchItemError) {
            console.error(`Error in habit items batch ${batchNumber}:`, batchItemError);
            throw batchItemError;
          }
          
          if (batchItemData) {
            allItemData.push(...batchItemData);
          }
          
          // Add delay between batches to avoid rate limiting (except for last batch)
          if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          console.error(`Failed to process habit items batch ${batchNumber}:`, error);
          throw error;
        }
      }
      
      console.log('All habit items batches completed, total items found:', allItemData.length);
      if (allItemData.length === 0) {
        setHabitTasks([]);
        return;
      }
      
      const taskData = habitTasksData;
      const itemsData = allItemData;
      
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

  // Load initial count even when debug view is collapsed
  useEffect(() => {
    if (user?.id && !showHabitTasks) {
      fetchHabitTasks();
    }
  }, [user?.id, showHabitTasks, fetchHabitTasks]);
  
  

  const handleEmergencyCleanup = async () => {
    if (!user?.id) return;
    
    const confirmed = confirm(
      'EMERGENCY CLEANUP: This will delete ALL habit tasks and recreate them from scratch. ' +
      'This is useful if you have too many habit tasks. Continue?'
    );
    
    if (!confirmed) return;
    
    setEmergencyCleanup(true);
    try {
      const supabase = getSupabaseClient();
      const taskGenerator = new HabitTaskGenerator(supabase, user.id);
      
      console.log('Starting emergency habit task cleanup...');
      await taskGenerator.emergencyHabitTaskCleanup();
      console.log('Emergency cleanup completed');
      
      // Refresh the habit tasks debug view
      if (showHabitTasks) {
        await fetchHabitTasks();
      }
      
      alert('Emergency cleanup completed! All habit tasks have been reset.');
    } catch (err) {
      console.error('Failed to run emergency cleanup:', err);
      alert('Emergency cleanup failed. Check console for details.');
    } finally {
      setEmergencyCleanup(false);
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

  const handleHabitCreated = async () => {
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
              onClick={handleEmergencyCleanup}
              disabled={emergencyCleanup}
              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <Trash2 className={`h-4 w-4 mr-2 ${emergencyCleanup ? 'animate-spin' : ''}`} />
              {emergencyCleanup ? 'Cleaning...' : 'Emergency Cleanup'}
            </button>
            <NewHabitForm 
              onHabitCreated={handleHabitCreated} 
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
              onClick={handleEmergencyCleanup}
              disabled={emergencyCleanup}
              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <Trash2 className={`h-4 w-4 mr-2 ${emergencyCleanup ? 'animate-spin' : ''}`} />
              {emergencyCleanup ? 'Cleaning...' : 'Emergency Cleanup'}
            </button>
            <NewHabitForm 
              onHabitCreated={handleHabitCreated} 
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
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Habit Tasks (Debug View)
              </h3>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {loadingHabitTasks ? '...' : `${habitTasks.length} tasks`}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Shows all tasks linked to habits (within 14 days) • Use Emergency Cleanup if count gets too high
            </p>
          </div>
          
          {showHabitTasks && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent collapse
                fetchHabitTasks();
              }}
              disabled={loadingHabitTasks}
              className="mr-4 inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              🔄
              Refresh
            </button>
          )}
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