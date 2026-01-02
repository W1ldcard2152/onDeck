'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { isSameDay, parseISO } from 'date-fns';
import { HabitsTable } from '@/components/HabitsTable';
import { NewHabitForm } from '@/components/NewHabitForm';
import { MonthlyCalendar } from '@/components/MonthlyCalendar';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHabits, type Habit } from '@/hooks/useHabits';
import { getSupabaseClient } from '@/lib/supabase-client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TaskWithDetails } from '@/lib/types';

export default function HabitsPage() {
  const { user } = useSupabaseAuth();
  const { habits, isLoading, error, refetch } = useHabits(user?.id);
  
  // State for habit tasks debugging
  const [habitTasks, setHabitTasks] = useState<TaskWithDetails[]>([]);
  const [showHabitTasks, setShowHabitTasks] = useState(false);
  const [loadingHabitTasks, setLoadingHabitTasks] = useState(false);
  
  // State for habit editing
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  // State for calendar filtering
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [filteredHabitTasks, setFilteredHabitTasks] = useState<TaskWithDetails[]>([]);
  
  const fetchHabitTasks = useCallback(async () => {
    if (!user?.id) return;
    
    setLoadingHabitTasks(true);
    try {
      const supabase = getSupabaseClient();
      
      console.log('=== HABIT TASK DEBUG ===');
      console.log('User ID:', user.id);
      
      // First, let's check if we have any active habits at all
      const { data: activeHabits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      console.log('Active habits found:', activeHabits?.length || 0, activeHabits?.map(h => ({ id: h.id, title: h.title })));
      
      if (habitsError) {
        console.error('Error fetching active habits:', habitsError);
      }
      
      // Get current and future habit tasks
      // Since tasks now generate on completion, we only need to show active tasks
      console.log('Fetching habit tasks (active only - tasks generate on completion)');

      // Get habit tasks with status 'habit' (not completed)
      const { data: habitTasksData, error: habitTasksError } = await supabase
        .from('tasks')
        .select('*')
        .not('habit_id', 'is', null)
        .eq('status', 'habit')
        .order('assigned_date', { ascending: true });
      
      console.log('Raw habit tasks query result:', { data: habitTasksData?.length || 0, error: habitTasksError });
      
      if (habitTasksError) throw habitTasksError;
      if (!habitTasksData || habitTasksData.length === 0) {
        console.log('NO ACTIVE HABIT TASKS FOUND - Complete a habit to generate the next task');
        setHabitTasks([]);
        return;
      }

      console.log(`Found ${habitTasksData.length} active habit tasks`);
      console.log('Sample tasks:', habitTasksData.slice(0, 3).map(t => ({ id: t.id, habit_id: t.habit_id, assigned_date: t.assigned_date, status: t.status })));
      
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

  // Filter habit tasks based on selected date
  useEffect(() => {
    if (!selectedDate) {
      setFilteredHabitTasks(habitTasks);
      return;
    }

    const tasksForDate = habitTasks.filter(task => {
      const taskDate = task.due_date ? parseISO(task.due_date) : 
                      task.assigned_date ? parseISO(task.assigned_date) : null;
      return taskDate && isSameDay(taskDate, selectedDate);
    });

    setFilteredHabitTasks(tasksForDate);
  }, [habitTasks, selectedDate]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(selectedDate && isSameDay(selectedDate, date) ? undefined : date);
  };
  
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
          <NewHabitForm
            onHabitCreated={handleHabitCreated}
            editingHabit={editingHabit}
            onHabitUpdated={handleHabitUpdated}
          />
        </div>

        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Habits</h1>
          <NewHabitForm
            onHabitCreated={handleHabitCreated}
            editingHabit={editingHabit}
            onHabitUpdated={handleHabitUpdated}
          />
        </div>
      </div>

      {/* Monthly Calendar for Habits */}
      <MonthlyCalendar 
        tasks={habitTasks}
        habits={habits}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
        showHabits={true}
      />

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
                {loadingHabitTasks ? '...' : `${selectedDate ? filteredHabitTasks.length : habitTasks.length} tasks`}
              </span>
              {selectedDate && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Filtered
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Shows current habit tasks • New tasks generate when you complete a habit
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
            ) : (selectedDate ? filteredHabitTasks.length === 0 : habitTasks.length === 0) ? (
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
                    {(selectedDate ? filteredHabitTasks : habitTasks).map((task) => (
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