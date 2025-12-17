'use client'

import React, { useState, useEffect } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { NewEntryForm } from '@/components/NewEntryForm';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, CheckSquare, FileText, ArrowRight, MoreHorizontal } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHabits } from '@/hooks/useHabits';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { HabitTaskActivator } from '@/lib/habitTaskActivator';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';
import { format, isToday, isPast, isFuture, addDays, isWithinInterval } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskWithDetails, NoteWithDetails } from '@/lib/types';
import type { TaskStatus, Priority } from '@/types/database.types';
import type { Database } from '@/types/database.types';

const DashboardPage: React.FC = () => {
  // Remove the service worker registration from this component
  // Service workers should be registered in _document.tsx or through next-pwa-setup.js

  const { user } = useSupabaseAuth();
  // Only load on_deck, active, and habit tasks for dashboard
  const { tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(
    user?.id, 
    50, 
    true,  // Include habit tasks for dashboard
    ['on_deck', 'active', 'habit']  // Status filters
  );
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useNotes(user?.id);
  const { habits, isLoading: habitsLoading } = useHabits(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  const supabase = createClientComponentClient<Database>();

  // Activate today's habit tasks on dashboard load
  useEffect(() => {
    const activateTodaysTasks = async () => {
      if (user?.id) {
        try {
          console.log('Dashboard: Starting habit task activation...');
          const activator = new HabitTaskActivator(supabase, user.id);
          await activator.ensureTodaysTasksAreActive();

          // Force update ALL habit task times - more aggressive approach
          console.log('Dashboard: Force updating ALL habit task times...');
          const generator = new HabitTaskGenerator(supabase, user.id);
          await generator.forceUpdateAllHabitTaskTimes();

          console.log('Dashboard: Task activation and time update complete, refreshing tasks...');
          // Refresh tasks after activation
          refetchTasks();
        } catch (error) {
          console.error('Failed to activate today\'s habit tasks:', error);
        }
      }
    };

    activateTodaysTasks();
  }, [user?.id, refetchTasks]); // Include refetchTasks in dependencies

  // Handle updates
  const handleUpdate = () => {
    refetchTasks();
    refetchNotes();
    setRefreshKey(prev => prev + 1);
  };
  
  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    setLoadingTasks(prev => ({ ...prev, [taskId]: true }));
    
    try {
      // Get the current task data first
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update the task status
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
  
      if (taskError) throw taskError;
  
      // Update item timestamps
      const { error: itemError } = await supabase
        .from('items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);
  
      if (itemError) throw itemError;
      
      // Refresh the data
      handleUpdate();
    } catch (err) {
      console.error('Error updating task status:', err);
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  if (tasksLoading || notesLoading || habitsLoading) {
    return (
      <div className="py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-center items-center h-32">
            <div className="text-lg text-gray-500">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  // Get all active, on_deck, and habit tasks sorted by time
  const onDeckTasks = tasks
    .filter(task => task.status === 'active' || task.status === 'on_deck' || task.habit_id)
    .sort((a, b) => {
      // Helper to get time for a task (either from reminder_time or habit's time_of_day)
      const getTaskTime = (task: TaskWithDetails): string | null => {
        // For habit tasks, get time from habit
        if (task.habit_id) {
          const habit = habits.find(h => h.id === task.habit_id);
          if (habit) {
            const rule = typeof habit.recurrence_rule === 'string'
              ? JSON.parse(habit.recurrence_rule)
              : habit.recurrence_rule;
            return rule?.time_of_day || null;
          }
        }
        // For regular tasks with reminder_time
        if (task.reminder_time) {
          const date = new Date(task.reminder_time);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        return null;
      };

      const aTime = getTaskTime(a);
      const bTime = getTaskTime(b);

      // Debug logging
      console.log(`Sorting: "${a.item?.title}" (time: ${aTime || 'none'}) vs "${b.item?.title}" (time: ${bTime || 'none'})`);

      // Tasks without times come first (all day tasks)
      if (!aTime && !bTime) {
        // Both have no time, sort by assigned date
        const aDate = a.assigned_date ? new Date(a.assigned_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.assigned_date ? new Date(b.assigned_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      }
      if (!aTime) return -1; // a has no time, comes first
      if (!bTime) return 1;  // b has no time, comes first

      // Both have times, sort chronologically
      return aTime.localeCompare(bTime);
    });

  console.log('=== FINAL ONDECK TASK ORDER ===');
  onDeckTasks.forEach((task, index) => {
    const getTime = (t: TaskWithDetails): string | null => {
      if (t.habit_id) {
        const h = habits.find(hab => hab.id === t.habit_id);
        if (h) {
          const r = typeof h.recurrence_rule === 'string' ? JSON.parse(h.recurrence_rule) : h.recurrence_rule;
          return r?.time_of_day || null;
        }
      }
      if (t.reminder_time) {
        const d = new Date(t.reminder_time);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
      return null;
    };

    const time = getTime(task);
    console.log(`${index + 1}. "${task.item?.title}" - Time: ${time || 'ALL DAY'}`);
  });

  // Debug: Check habit tasks for reminder_time
  const habitTasksWithTime = tasks.filter(task => task.habit_id);
  console.log('=== HABIT TASKS DEBUG (DashboardContent) ===');
  console.log('Total habit tasks found:', habitTasksWithTime.length);
  habitTasksWithTime.forEach(t => {
    console.log(`Task: "${t.item?.title}"`);
    console.log(`  - habit_id: ${t.habit_id}`);
    console.log(`  - reminder_time: ${t.reminder_time}`);
    console.log(`  - assigned_date: ${t.assigned_date}`);
    console.log(`  - status: ${t.status}`);

    // Also check if we can find the habit and its time
    const habit = habits.find(h => h.id === t.habit_id);
    if (habit) {
      console.log(`  - Found habit: ${habit.title}`);
      // Parse recurrence_rule if needed
      const rule = typeof habit.recurrence_rule === 'string'
        ? JSON.parse(habit.recurrence_rule)
        : habit.recurrence_rule;
      console.log(`  - Habit time_of_day: ${rule?.time_of_day || 'NOT SET'}`);
    } else {
      console.log(`  - Habit NOT FOUND in habits list!`);
    }
  });

  // Also debug what habits we have
  console.log('=== HABITS DEBUG ===');
  console.log('Total habits loaded:', habits.length);
  habits.forEach(h => {
    console.log(`Habit: "${h.title}" (id: ${h.id})`);
    // Parse recurrence_rule if needed
    const rule = typeof h.recurrence_rule === 'string'
      ? JSON.parse(h.recurrence_rule)
      : h.recurrence_rule;
    console.log(`  - time_of_day: ${rule?.time_of_day || 'NOT SET'}`);
    console.log(`  - recurrence_rule type: ${typeof h.recurrence_rule}`);
  });

  // Debug logging for dashboard
  const todayStr = new Date().toISOString().split('T')[0];
  const habitTasks = tasks.filter(task => task.habit_id);
  const todayHabitTasks = habitTasks.filter(task => task.assigned_date === todayStr);
  const activeHabitTasks = habitTasks.filter(task => task.status === 'active');
  const todayActiveHabitTasks = todayHabitTasks.filter(task => task.status === 'active');
  
  console.log('=== DASHBOARD DEBUG ===');
  console.log(`Dashboard received ${tasks.length} tasks total`);
  console.log(`Habit tasks: ${habitTasks.length}`);
  console.log('Habit tasks details:', habitTasks.map(t => ({ 
    id: t.id, 
    status: t.status, 
    habit_id: t.habit_id, 
    title: t.item?.title,
    assigned_date: t.assigned_date 
  })));
  console.log(`On deck tasks after filtering: ${onDeckTasks.length}`);
  console.log('On deck tasks details:', onDeckTasks.map(t => ({ 
    id: t.id, 
    status: t.status, 
    habit_id: t.habit_id, 
    title: t.item?.title,
    assigned_date: t.assigned_date,
    isHabit: !!t.habit_id 
  })));
    
  // Get tasks with no assigned date that are not completed
  const tasksWithoutDates = tasks
    .filter(task => {
      // Only include non-completed tasks with no assigned date
      return task.status !== 'completed' && !task.assigned_date;
    })
    .sort((a, b) => {
      // Sort by priority (high to low)
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });

  // Get tasks with due dates in the next 3 days (not completed)
  const today = new Date();
  const threeDaysLater = addDays(today, 3);
  
  const upcomingDueTasks = tasks
    .filter(task => {
      // Only include non-completed tasks
      if (task.status === 'completed') return false;
      
      // Only include tasks with a due date in the next 3 days
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      return dueDate && isWithinInterval(dueDate, { start: today, end: threeDaysLater });
    })
    .sort((a, b) => {
      // Sort by due date (soonest first)
      const aDate = a.due_date ? new Date(a.due_date).getTime() : 0;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : 0;
      return aDate - bDate;
    });

  // Get recent notes
  const recentNotes = [...notes]
    .filter(note => {
      const createdDate = new Date(note.item.created_at);
      return isWithinInterval(createdDate, { start: addDays(today, -7), end: today });
    })
    .sort((a, b) => {
      // Sort by newest first
      return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
    })
    .slice(0, 3); // Only show 3 most recent notes

  // Format the date for display
  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    if (isToday(date)) {
      return 'Today';
    } else if (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    } else {
      return format(date, 'EEE, MMM d'); // e.g. "Wed, Apr 5"
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <NewEntryForm onEntryCreated={handleUpdate} defaultType="task" />
      </div>

      {/* Active Tasks Section (sorted by assigned date) */}
      <DashboardCard 
        title="On Deck"
        content={
          <div className="space-y-3">
            {onDeckTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks on deck</div>
            ) : (
              onDeckTasks.map((task, index) => {
                // Check if this task has a time
                const hasTime = (() => {
                  if (task.habit_id) {
                    const habit = habits.find(h => h.id === task.habit_id);
                    if (habit) {
                      const rule = typeof habit.recurrence_rule === 'string'
                        ? JSON.parse(habit.recurrence_rule)
                        : habit.recurrence_rule;
                      return !!rule?.time_of_day;
                    }
                  }
                  return !!task.reminder_time;
                })();

                // Check if previous task had a time (to show separator)
                const prevTask = index > 0 ? onDeckTasks[index - 1] : null;
                const prevHasTime = prevTask ? (() => {
                  if (prevTask.habit_id) {
                    const habit = habits.find(h => h.id === prevTask.habit_id);
                    if (habit) {
                      const rule = typeof habit.recurrence_rule === 'string'
                        ? JSON.parse(habit.recurrence_rule)
                        : habit.recurrence_rule;
                      return !!rule?.time_of_day;
                    }
                  }
                  return !!prevTask.reminder_time;
                })() : false;

                // Show separator when transitioning from no-time to time tasks
                const showSeparator = hasTime && !prevHasTime && index > 0;

                // Show "All Day" label before first task if it has no time
                const showAllDayLabel = index === 0 && !hasTime && onDeckTasks.some((t, i) => {
                  if (t.habit_id) {
                    const h = habits.find(hab => hab.id === t.habit_id);
                    if (h) {
                      const r = typeof h.recurrence_rule === 'string'
                        ? JSON.parse(h.recurrence_rule)
                        : h.recurrence_rule;
                      return !!r?.time_of_day;
                    }
                  }
                  return !!t.reminder_time;
                });

                return (
                  <React.Fragment key={task.id}>
                    {showAllDayLabel && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <span className="text-xs text-gray-500 font-medium px-2">All Day</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>
                    )}
                    {showSeparator && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <span className="text-xs text-gray-500 font-medium px-2">Scheduled</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>
                    )}
                    <div className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
                          <button
                            className="mr-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                            aria-label="Change task status"
                          >
                            {loadingTasks[task.id] ? (
                              <div className="h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckSquare className="h-5 w-5 text-orange-500" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'on_deck')}>
                            Mark as On Deck
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                            Mark as Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <h3 className="font-medium text-gray-900">
                        {task.item.title}
                      </h3>
                    </div>
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority || 'normal'}
                    </Badge>
                  </div>
                  
                  {task.description && (
                    <p className="ml-7 text-sm text-gray-600">{task.description}</p>
                  )}
                  
                  <div className="ml-7 mt-2 flex flex-wrap gap-2 text-xs">
                    {task.due_date && (
                      <span className={`flex items-center ${isPast(new Date(task.due_date)) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        <Clock className="mr-1 h-3 w-3" />
                        Due: {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                    {task.assigned_date && (
                      <span className="flex items-center text-gray-500">
                        <Calendar className="mr-1 h-3 w-3" />
                        Assigned: {format(new Date(task.assigned_date), 'MMM d')}
                      </span>
                    )}
                    {(() => {
                      // For habit tasks, show time from the habit's time_of_day
                      if (task.habit_id) {
                        const habit = habits.find(h => h.id === task.habit_id);
                        if (habit) {
                          // Parse recurrence_rule if it's a string
                          const rule = typeof habit.recurrence_rule === 'string'
                            ? JSON.parse(habit.recurrence_rule)
                            : habit.recurrence_rule;

                          if (rule?.time_of_day) {
                            return (
                              <span className="flex items-center text-gray-500">
                                <Clock className="mr-1 h-3 w-3" />
                                {format(new Date(`2000-01-01T${rule.time_of_day}`), 'h:mm a')}
                              </span>
                            );
                          }
                        }
                        return null;
                      }
                      // For regular tasks, show reminder_time if it exists
                      if (task.reminder_time) {
                        return (
                          <span className="flex items-center text-gray-500">
                            <Clock className="mr-1 h-3 w-3" />
                            {format(new Date(task.reminder_time), 'h:mm a')}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        }
      />

      {/* Weekly Calendar */}
      <WeeklyCalendar tasks={tasks} habits={habits} onTaskUpdate={handleUpdate} />

      {/* Upcoming Due Tasks Section (next 3 days) */}
      <DashboardCard 
        title="Due Soon (Next 3 Days)"
        content={
          <div className="space-y-3">
            {upcomingDueTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks due in the next 3 days</div>
            ) : (
              upcomingDueTasks.map(task => (
                <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
                          <button
                            className="mr-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                            aria-label="Change task status"
                          >
                            {loadingTasks[task.id] ? (
                              <div className="h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckSquare className="h-5 w-5 text-orange-500" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {task.status !== 'active' && (
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'active')}>
                              Mark as Active
                            </DropdownMenuItem>
                          )}
                          {task.status !== 'on_deck' && (
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'on_deck')}>
                              Mark as On Deck
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                            Mark as Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <h3 className="font-medium text-gray-900">
                        {task.item.title}
                      </h3>
                    </div>
                    <Badge className={`${getStatusColor(task.status || 'on_deck')} mr-2`}>
                      {task.status || 'on_deck'}
                    </Badge>
                  </div>
                  
                  {task.description && (
                    <p className="ml-7 text-sm text-gray-600">{task.description}</p>
                  )}
                  
                  <div className="ml-7 mt-2 flex flex-wrap gap-2 text-xs">
                    {task.due_date && (
                      <span className={`flex items-center font-medium ${isToday(new Date(task.due_date)) ? 'text-orange-600' : 'text-red-600'}`}>
                        <Clock className="mr-1 h-3 w-3" />
                        Due: {formatDateDisplay(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            
            <div className="pt-2">
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto" asChild>
                <a href="/tasks">
                  View all tasks <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        }
      />

      {/* Quick Access Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Notes */}
        <DashboardCard 
          title="Recent Notes"
          content={
            <div className="space-y-3">
              {recentNotes.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No recent notes</div>
              ) : (
                recentNotes.map(note => (
                  <NoteCard key={note.id} note={note} preview={true} />
                ))
              )}
              
              <div className="mt-2">
                <Button variant="outline" className="w-full" onClick={() => {
                  const addNoteBtn = document.querySelector('[class*="NewEntryForm"] button') as HTMLButtonElement;
                  if (addNoteBtn) addNoteBtn.click();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Note
                </Button>
              </div>
            </div>
          }
        />
        
        {/* Tasks Without Dates */}
        <DashboardCard 
          title="Unscheduled Tasks"
          content={
            <div className="space-y-3">
              {tasksWithoutDates.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No unscheduled tasks</div>
              ) : (
                tasksWithoutDates.slice(0, 5).map(task => (
                  <div key={task.id} className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={loadingTasks[task.id]}>
                            <button
                              className="mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm disabled:opacity-50"
                              aria-label="Change task status"
                            >
                              {loadingTasks[task.id] ? (
                                <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckSquare className="h-5 w-5 text-blue-500" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {task.status !== 'active' && (
                              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'active')}>
                                Mark as Active
                              </DropdownMenuItem>
                            )}
                            {task.status !== 'on_deck' && (
                              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'on_deck')}>
                                Mark as On Deck
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                              Mark as Completed
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <h3 className="font-medium text-gray-900">
                          {task.item.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(task.status || 'on_deck')}>
                          {task.status || 'on_deck'}
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority || 'normal'}
                        </Badge>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className="ml-7 text-sm text-gray-600">{task.description}</p>
                    )}
                  </div>
                ))
              )}
              
              {tasksWithoutDates.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{tasksWithoutDates.length - 5} more unscheduled tasks
                </div>
              )}
              
              <div className="pt-2">
                <Button variant="ghost" className="text-orange-600 hover:text-orange-700 p-0 h-auto" asChild>
                  <a href="/tasks">
                    View all tasks <ArrowRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
};

// Helper function to get status color
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'on_deck':
      return 'bg-yellow-100 text-yellow-800';
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default DashboardPage;