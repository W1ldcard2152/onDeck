'use client'

import React, { useState, useMemo, useEffect } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';
import { NewEntryForm } from '@/components/NewEntryForm';
import { NewEntryDropdown } from '@/components/NewEntryDropdown';
import { QuoteOfTheDay } from '@/components/QuoteOfTheDay';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, CheckSquare, FileText, ArrowRight, MoreHorizontal, MoreVertical, Link, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHabits } from '@/hooks/useHabits';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, isToday, isTomorrow, isPast, isFuture, addDays, isWithinInterval, isAfter } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { TaskWithDetails, NoteWithDetails, DailyContext } from '@/lib/types';
import type { TaskStatus, Priority } from '@/types/database.types';
import type { Database } from '@/types/database.types';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';
import { getSupabaseClient } from '@/lib/supabase-client';
import { startOfDay, parseISO, isBefore } from 'date-fns';

const DashboardPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  // Only fetch active, habit, and project tasks for dashboard - filtering at database level for performance
  const { tasks: fetchedTasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(
    user?.id,
    50,
    true, // includeHabitTasks
    ['active', 'habit', 'project'] // Only fetch active, habit, and project tasks
  );
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useNotes(user?.id);
  const { habits, isLoading: habitsLoading } = useHabits(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  const [taskToEdit, setTaskToEdit] = useState<TaskWithDetails | null>(null);

  // Local state for optimistic updates
  const [localTasks, setLocalTasks] = useState<TaskWithDetails[]>([]);

  // Sync fetched tasks to local state
  useEffect(() => {
    setLocalTasks(fetchedTasks);
  }, [fetchedTasks]);

  // Use local tasks for rendering
  const tasks = localTasks;

  // Removed automatic daily cleanup - habit tasks should only be deleted when replaced
  // by newer tasks or during manual regeneration, not automatically based on date
  const [taskToView, setTaskToView] = useState<TaskWithDetails | null>(null);
  const supabase = createClientComponentClient<Database>();

  // Parse date helper function
  const parseDateForDisplay = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    
    try {
      // For dates stored as YYYY-MM-DD (which we're now using)
      if (dateString.includes('-') && dateString.length <= 10) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      
      // Fallback for ISO format dates
      return new Date(dateString);
    } catch (e) {
      console.error('Error parsing date:', e);
      return null;
    }
  };

  // Helper functions for date checks
  const isDateToday = (dateString: string | null): boolean => {
    const date = parseDateForDisplay(dateString);
    return date ? isToday(date) : false;
  };

  const isDatePast = (dateString: string | null): boolean => {
    const date = parseDateForDisplay(dateString);
    return date ? isPast(date) && !isToday(date) : false;
  };

  const isDateInFuture = (dateString: string | null): boolean => {
    const date = parseDateForDisplay(dateString);
    return date ? isFuture(date) : false;
  };

  const isDateWithinUpcoming = (dateString: string | null, start: Date, end: Date): boolean => {
    const date = parseDateForDisplay(dateString);
    if (!date) return false;
    
    try {
      // For "tomorrow" specifically, we need to ensure it's captured properly
      if (isTomorrow(date)) return true;
      
      return isWithinInterval(date, { start, end });
    } catch (e) {
      console.error('Error checking interval:', e, dateString);
      return false;
    }
  };

  // Format the date for display
  const formatDateDisplay = (dateString: string) => {
    const date = parseDateForDisplay(dateString);
    if (!date) return '';
    
    // Date reference points
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const threeDaysLater = addDays(today, 3);
    
    if (isToday(date)) {
      return 'Today';
    } else if (isTomorrow(date)) {
      return 'Tomorrow';
    } else if (isWithinInterval(date, { start: tomorrow, end: threeDaysLater })) {
      return format(date, 'EEE, MMM d'); // e.g. "Wed, Apr 5"
    } else {
      return format(date, 'MMM d'); // e.g. "Apr 5"
    }
  };

  const formatReminderTime = (reminderTimeString: string) => {
    try {
      const date = new Date(reminderTimeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Error parsing reminder time:', e);
      return '';
    }
  };

  // Helper function to check if task matches context
  const taskMatchesContext = (task: TaskWithDetails, context: DailyContext | 'all' | 'past'): boolean => {
    // Parse daily_context (JSON array or null)
    let taskContexts: DailyContext[] = [];
    if (task.daily_context) {
      try {
        taskContexts = JSON.parse(task.daily_context);
      } catch (e) {
        // If parsing fails, treat as empty array
        taskContexts = [];
      }
    }

    // If task has no contexts (null or empty array), it's "all day" and appears in all tabs
    const isAllDay = !task.daily_context || taskContexts.length === 0;

    if (context === 'all' || context === 'past') {
      return true; // All tasks appear in "All" and "Past" tabs
    }

    // For specific contexts, check if task has that context or is all-day
    return isAllDay || taskContexts.includes(context);
  };

  // Get primary context for a task
  const getPrimaryContext = (task: TaskWithDetails): DailyContext | 'none' => {
    if (!task.daily_context) return 'none';
    try {
      const contexts: DailyContext[] = JSON.parse(task.daily_context);
      return contexts[0] || 'none';
    } catch {
      return 'none';
    }
  };

  // Filter tasks by context and date
  const getFilteredTasks = (context: DailyContext | 'all' | 'past') => {
    const today = startOfDay(new Date());
    console.log(`\n=== Filtering tasks for context: ${context} ===`);
    console.log(`Total tasks: ${tasks.length}`);

    const filtered = tasks.filter(task => {
      // Only show non-completed tasks
      if (task.status === 'completed') return false;

      // Parse dates
      const assignedDate = task.assigned_date ? startOfDay(parseISO(task.assigned_date)) : null;
      const dueDate = task.due_date ? startOfDay(parseISO(task.due_date)) : null;

      // For "Past" tab: show only tasks from before today
      if (context === 'past') {
        const hasRelevantAssignedDate = assignedDate && isBefore(assignedDate, today);
        const hasRelevantDueDate = dueDate && isBefore(dueDate, today);
        return (hasRelevantAssignedDate || hasRelevantDueDate) && taskMatchesContext(task, context);
      }

      // For "All" and context tabs: show tasks today or earlier
      const hasRelevantAssignedDate = assignedDate && (isToday(assignedDate) || isBefore(assignedDate, today));
      const hasRelevantDueDate = dueDate && (isToday(dueDate) || isBefore(dueDate, today));

      return (hasRelevantAssignedDate || hasRelevantDueDate) && taskMatchesContext(task, context);
    });

    // Sort tasks by context, then by due date priority
    const contextOrder: Record<string, number> = {
      'all_day': 0,
      'morning': 1,
      'work': 2,
      'family': 3,
      'evening': 4,
      'none': 5
    };

    const sorted = filtered.sort((a, b) => {
      // First sort by context (if viewing "all" tab)
      if (context === 'all' || context === 'past') {
        const contextA = getPrimaryContext(a);
        const contextB = getPrimaryContext(b);
        const contextDiff = contextOrder[contextA] - contextOrder[contextB];
        if (contextDiff !== 0) return contextDiff;
      }

      // Within each context, prioritize tasks with due dates
      const hasDueA = !!a.due_date;
      const hasDueB = !!b.due_date;
      if (hasDueA && !hasDueB) return -1;
      if (!hasDueA && hasDueB) return 1;

      // If both have due dates, sort by due date (earliest first)
      if (hasDueA && hasDueB) {
        const dateA = new Date(a.due_date!).getTime();
        const dateB = new Date(b.due_date!).getTime();
        if (dateA !== dateB) return dateA - dateB;
      }

      // Use sort_order for manual ordering (lower numbers first)
      return a.sort_order - b.sort_order;
    });

    console.log(`Filtered tasks count: ${sorted.length}`);
    return sorted;
  };

  // Move task up or down in the list by swapping sort_order
  const moveTask = async (taskId: string, direction: 'up' | 'down', filteredTasks: TaskWithDetails[]) => {
    const currentIndex = filteredTasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredTasks.length) return;

    const currentTask = filteredTasks[currentIndex];
    const targetTask = filteredTasks[targetIndex];

    // Don't allow moving past tasks with due dates if current task doesn't have one
    if (!currentTask.due_date && targetTask.due_date) return;

    // Simply swap the sort_order values
    const newCurrentSortOrder = targetTask.sort_order;
    const newTargetSortOrder = currentTask.sort_order;

    // Store previous state for rollback
    const previousTasks = [...localTasks];

    // Optimistically update local state
    setLocalTasks(prev => prev.map(task => {
      if (task.id === currentTask.id) {
        return { ...task, sort_order: newCurrentSortOrder };
      }
      if (task.id === targetTask.id) {
        return { ...task, sort_order: newTargetSortOrder };
      }
      return task;
    }));

    try {
      // Update both tasks in the database
      const results = await Promise.all([
        supabase.from('tasks').update({ sort_order: newCurrentSortOrder }).eq('id', currentTask.id),
        supabase.from('tasks').update({ sort_order: newTargetSortOrder }).eq('id', targetTask.id)
      ]);

      // Check for errors in the responses
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('Database update errors:', errors);
        // Revert to previous state
        setLocalTasks(previousTasks);
        refetchTasks();
      }
    } catch (error) {
      console.error('Error moving task:', error);
      // Revert to previous state
      setLocalTasks(previousTasks);
      refetchTasks();
    }
  };

  // Handle updates
  const handleUpdate = () => {
    refetchTasks();
    refetchNotes();
    setRefreshKey(prev => prev + 1);
  };
  
  // Update task status with optimistic UI update
  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    // Find the task to check if it's a habit task
    const task = localTasks.find(t => t.id === taskId);

    // Optimistic update - immediately update the local UI
    const previousTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    try {
      // Update the task status in the database
      const {error: taskError} = await supabase
        .from('tasks')
        // @ts-ignore - Supabase type inference issue
        .update({status: newStatus})
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Update item timestamps
      const { error: itemError } = await supabase
        .from('items')
        // @ts-ignore - Supabase type inference issue
        .update({ updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (itemError) throw itemError;

      // If completing a habit task, generate the next occurrence
      if (newStatus === 'completed' && task?.habit_id && user?.id) {
        const habit = habits.find(h => h.id === task.habit_id);
        if (habit && habit.is_active) {
          console.log('Habit task completed - generating next occurrence for:', habit.title);
          try {
            const taskGenerator = new HabitTaskGenerator(supabase, user.id);
            // Use the current date (when task is actually completed) as the base for calculating next occurrence
            const completedDate = new Date();
            await taskGenerator.generateNextTask(habit, completedDate, false); // isInitialTask = false
            console.log('✅ Next habit task generated successfully');
            // Refetch tasks to show the new habit task
            refetchTasks();
          } catch (genError) {
            console.error('❌ Error generating next habit task:', genError);
            // Don't rollback - the completion was successful, just task generation failed
          }
        }
      }

      // Success - the realtime subscription will eventually sync, but we already have the right state
    } catch (err) {
      console.error('Error updating task status:', err);
      // On error, rollback to previous state
      setLocalTasks(previousTasks);
    }
  };

  // Function to delete a task with optimistic UI update
  const deleteTask = async (taskId: string): Promise<void> => {
    // Ask for confirmation
    if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) {
      return;
    }

    // Optimistic update - immediately remove from local UI
    const previousTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(task => task.id !== taskId));

    try {
      // Delete the task
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Delete the item
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('id', taskId);

      if (itemError) throw itemError;

      // Success - the realtime subscription will eventually sync, but we already have the right state
    } catch (err) {
      console.error('Error deleting task:', err);
      // On error, rollback to previous state
      setLocalTasks(previousTasks);
    }
  };

  // Memoize expensive calculations to prevent unnecessary re-computation
  const dashboardData = useMemo(() => {
    // Date reference points
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);
    const threeDaysLater = addDays(today, 3);

    // Tasks are already filtered at database level to exclude 'completed' status
    // No need for additional client-side filtering
    const activeTasks = tasks;

    // Debug logging to see what tasks we have
    console.log('All tasks (non-completed only):', tasks.length);
    console.log('Habit tasks:', tasks.filter(task => task.habit_id).length);

    return { today, tomorrow, dayAfterTomorrow, threeDaysLater, activeTasks };
  }, [tasks]);

  const { today, tomorrow, dayAfterTomorrow, threeDaysLater, activeTasks } = dashboardData;

  // Memoize task filtering and sorting to prevent unnecessary recalculation
  const taskSections = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    
    // Tasks for Today (due today or in the past, or assigned today or in the past)
    const todayDueTasks = activeTasks.filter(task => {
      if (!task.due_date) return false;
      
      // Debug logging for habit tasks
      if (task.habit_id) {
        console.log('Habit task found:', {
          title: task.title,
          due_date: task.due_date,
          isToday: isDateToday(task.due_date),
          parsedDate: parseDateForDisplay(task.due_date),
          todayDate: new Date().toDateString()
        });
      }
      
      return isDateToday(task.due_date) || isDatePast(task.due_date);
    }).sort((a, b) => {
      // First sort by past due (oldest first)
      if (isDatePast(a.due_date) && isDatePast(b.due_date)) {
        const aDate = parseDateForDisplay(a.due_date!)?.getTime() || 0;
        const bDate = parseDateForDisplay(b.due_date!)?.getTime() || 0;
        return aDate - bDate; // Oldest past due first
      }
      
      // Then sort by priority (high to low)
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });
    

    const todayAssignedTasks = activeTasks.filter(task => {
      // Skip if already in due today/past list (only for tasks that actually have due dates)
      if (task.due_date && (isDateToday(task.due_date) || isDatePast(task.due_date))) {
        return false;
      }

      // Include if assigned today or in the past
      return task.assigned_date && (isDateToday(task.assigned_date) || isDatePast(task.assigned_date));
    }).sort((a, b) => {
      // Helper to get time for a task
      const getTaskTime = (task: typeof a): string | null => {
        // Always prioritize reminder_time if it exists (for both habit and regular tasks)
        if (task.reminder_time) {
          const date = new Date(task.reminder_time);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        // If no reminder_time, treat as all-day task (even for habits with time_of_day)
        return null;
      };

      const aTime = getTaskTime(a);
      const bTime = getTaskTime(b);

      // Tasks without times come first (all day tasks)
      if (!aTime && !bTime) {
        // Both have no time, sort by past assigned date (oldest first)
        if (isDatePast(a.assigned_date) && isDatePast(b.assigned_date)) {
          const aDate = parseDateForDisplay(a.assigned_date!)?.getTime() || 0;
          const bDate = parseDateForDisplay(b.assigned_date!)?.getTime() || 0;
          return aDate - bDate; // Oldest first
        }

        // Then sort by priority (high to low)
        const aPriority = a.priority || 'normal';
        const bPriority = b.priority || 'normal';
        return priorityOrder[aPriority] - priorityOrder[bPriority];
      }

      if (!aTime) return -1; // a has no time, comes first
      if (!bTime) return 1;  // b has no time, comes first

      // Both have times, sort chronologically
      return aTime.localeCompare(bTime);
    });

    
    // Tasks for Upcoming (due or assigned in next 3 days, excluding today)
    const upcomingDueTasks = activeTasks.filter(task => {
      if (!task.due_date) return false;
      
      // Skip habit tasks in upcoming section
      if (task.habit_id) return false;
      
      // Skip if due today or in the past (already covered in Today section)
      if (isDateToday(task.due_date) || isDatePast(task.due_date)) return false;
      
      // Include if due tomorrow or within the next 3 days
      return isDateWithinUpcoming(task.due_date, tomorrow, threeDaysLater);
    }).sort((a, b) => {
      // First sort by due date
      const aDate = parseDateForDisplay(a.due_date!)?.getTime() || 0;
      const bDate = parseDateForDisplay(b.due_date!)?.getTime() || 0;
      
      // If same date, sort by priority
      if (aDate === bDate) {
        const aPriority = a.priority || 'normal';
        const bPriority = b.priority || 'normal';
        return priorityOrder[aPriority] - priorityOrder[bPriority];
      }
      
      return aDate - bDate;
    });
    
    const upcomingAssignedTasks = activeTasks.filter(task => {
      // Skip habit tasks in upcoming section
      if (task.habit_id) return false;
      
      // Skip if due in upcoming period, due today, or due in past
      if (task.due_date) {
        if (isDateToday(task.due_date) || isDatePast(task.due_date)) return false;
        if (isDateWithinUpcoming(task.due_date, tomorrow, threeDaysLater)) return false;
      }
      
      // Skip if assigned today or in the past (already covered in Today section)
      if (task.assigned_date && (isDateToday(task.assigned_date) || isDatePast(task.assigned_date))) {
        return false;
      }
      
      // Check for tomorrow specifically to ensure those tasks appear
      if (task.assigned_date) {
        const assignedDate = parseDateForDisplay(task.assigned_date);
        if (assignedDate && isTomorrow(assignedDate)) {
          return true;
        }
      }
      
      // Include if assigned within the next 3 days
      return task.assigned_date && isDateWithinUpcoming(task.assigned_date, tomorrow, threeDaysLater);
    }).sort((a, b) => {
      // First sort by assigned date
      const aDate = parseDateForDisplay(a.assigned_date!)?.getTime() || 0;
      const bDate = parseDateForDisplay(b.assigned_date!)?.getTime() || 0;
      
      // If same date, sort by priority
      if (aDate === bDate) {
        const aPriority = a.priority || 'normal';
        const bPriority = b.priority || 'normal';
        return priorityOrder[aPriority] - priorityOrder[bPriority];
      }
      
      return aDate - bDate;
    });
    
    // Tasks with no date assigned (limited to 5)
    const tasksWithoutDates = activeTasks
      .filter(task => !task.due_date && !task.assigned_date)
      .sort((a, b) => {
        // Sort by priority (high to low)
        const aPriority = a.priority || 'normal';
        const bPriority = b.priority || 'normal';
        return priorityOrder[aPriority] - priorityOrder[bPriority];
      })
      .slice(0, 5);

    // Debug the final results
    console.log('Dashboard task filtering results:', {
      todayDueTasks: todayDueTasks.length,
      todayAssignedTasks: todayAssignedTasks.length,
      todayAssignedHabitTasks: todayAssignedTasks.filter(t => t.habit_id).length,
      todayAssignedTaskDetails: todayAssignedTasks.filter(t => t.habit_id).map(t => ({
        title: t.item?.title,
        status: t.status,
        assigned_date: t.assigned_date,
        habit_id: t.habit_id
      }))
    });

    return {
      todayDueTasks,
      todayAssignedTasks,
      upcomingDueTasks,
      upcomingAssignedTasks,
      tasksWithoutDates
    };
  }, [activeTasks, today, tomorrow, threeDaysLater]);

  const { todayDueTasks, todayAssignedTasks, upcomingDueTasks, upcomingAssignedTasks, tasksWithoutDates } = taskSections;

  // Memoize recent notes filtering
  const recentNotes = useMemo(() => {
    return [...notes]
      .filter(note => {
        // Skip notes without item data
        if (!note.item || !note.item.created_at) return false;
        
        const createdDate = new Date(note.item.created_at);
        return isWithinInterval(createdDate, { start: addDays(today, -7), end: today });
      })
      .sort((a, b) => {
        // Sort by newest first
        return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
      })
      .slice(0, 3); // Only show 3 most recent notes
  }, [notes, today]);

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

  // Helper function to get background color based on task time
  const getTimeColor = (task: TaskWithDetails): string => {
    // Get the actual time for this task
    let timeString: string | null = null;

    if (task.reminder_time) {
      const date = new Date(task.reminder_time);
      timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (task.habit_id) {
      const habit = habits.find(h => h.id === task.habit_id);
      if (habit) {
        const rule = typeof habit.recurrence_rule === 'string'
          ? JSON.parse(habit.recurrence_rule)
          : habit.recurrence_rule;
        timeString = rule?.time_of_day || null;
      }
    }

    // If no time, return white background (all-day)
    if (!timeString) {
      return 'bg-white border-gray-200';
    }

    // Convert time to minutes for comparison
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Define time slots in minutes
    const timeSlots = [
      { time: 8 * 60, color: 'bg-yellow-50 border-yellow-200' },      // 8:00am - yellow
      { time: 9 * 60 + 45, color: 'bg-orange-50 border-orange-200' }, // 9:45am - orange
      { time: 13 * 60, color: 'bg-red-50 border-red-200' },           // 1:00pm - red
      { time: 18 * 60 + 15, color: 'bg-green-50 border-green-200' },  // 6:15pm - green
      { time: 20 * 60 + 20, color: 'bg-blue-50 border-blue-200' },    // 8:20pm - blue
    ];

    // Find the appropriate color based on time
    let selectedColor = 'bg-yellow-50 border-yellow-200'; // Default to yellow for early times

    for (const slot of timeSlots) {
      if (totalMinutes <= slot.time) {
        selectedColor = slot.color;
        break;
      }
      selectedColor = slot.color; // Use this color for times after this slot
    }

    return selectedColor;
  };

  // Get status badge color
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

  // Get context background color for task cards
  const getContextColor = (task: TaskWithDetails): string => {
    // Tasks due TODAY or PAST get dark red color (priority alert)
    // Only check due_date, not assigned_date
    if (task.due_date) {
      const isDueToday = isDateToday(task.due_date);
      const isDuePast = isDatePast(task.due_date);

      if (isDueToday || isDuePast) {
        return 'bg-red-100 border-red-400'; // Dark red for due today or overdue
      }
    }

    // Get the task's daily context
    const dailyContexts: DailyContext[] = task.daily_context
      ? (() => {
          try {
            return JSON.parse(task.daily_context);
          } catch {
            return [];
          }
        })()
      : [];

    // Use the first context for color (most tasks will have one context)
    const primaryContext = dailyContexts[0];

    switch (primaryContext) {
      case 'all_day':
        return 'bg-white border-gray-200'; // White for all day
      case 'morning':
        return 'bg-orange-50 border-orange-200'; // Orange for morning
      case 'work':
        return 'bg-red-50 border-red-200'; // Red for work
      case 'family':
        return 'bg-green-50 border-green-200'; // Green for family
      case 'evening':
        return 'bg-purple-50 border-purple-200'; // Purple for evening
      default:
        return 'bg-white border-gray-200'; // Default white for no context
    }
  };

  // Render task list for a given context
  const renderTaskList = (context: DailyContext | 'all' | 'past') => {
    const filteredTasks = getFilteredTasks(context);

    const getContextTitle = (ctx: typeof context) => {
      if (ctx === 'all') return 'All';
      if (ctx === 'past') return 'Past';
      if (ctx === 'all_day') return 'All Day';
      return ctx.charAt(0).toUpperCase() + ctx.slice(1);
    };

    return (
      <DashboardCard
        title={`${getContextTitle(context)} Tasks (${filteredTasks.length})`}
        content={
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No tasks</div>
            ) : (
              filteredTasks.map((task, index) => {
                const isPastDue = task.due_date && isDatePast(task.due_date);
                const isPastAssigned = task.assigned_date && isDatePast(task.assigned_date);
                const contextLabel = isPastDue ? "OVERDUE" : isPastAssigned ? "PAST ASSIGNED" : undefined;

                return renderTask(task, contextLabel, filteredTasks, index);
              })
            )}
          </div>
        }
      />
    );
  };

  // Render a task item with simpler design
  const renderTask = (task: TaskWithDetails, contextLabel?: string, filteredTasks?: TaskWithDetails[], index?: number) => {
    const canMoveUp = filteredTasks && index !== undefined && index > 0;
    const canMoveDown = filteredTasks && index !== undefined && index < filteredTasks.length - 1;

    return (
      <div key={task.id} className={`p-3 md:p-4 rounded-lg border hover:shadow-sm transition-shadow ${getContextColor(task)}`}>
        <div className="flex items-start gap-2 md:gap-3">
          {/* Manual ordering arrows */}
          {filteredTasks && index !== undefined && (
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => moveTask(task.id, 'up', filteredTasks)}
                disabled={!canMoveUp}
                className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${!canMoveUp ? 'opacity-30 cursor-not-allowed' : ''}`}
                title="Move up"
              >
                <ChevronUp className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={() => moveTask(task.id, 'down', filteredTasks)}
                disabled={!canMoveDown}
                className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${!canMoveDown ? 'opacity-30 cursor-not-allowed' : ''}`}
                title="Move down"
              >
                <ChevronDown className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:h-8 md:w-8 flex-shrink-0"
              >
                <MoreVertical className="h-5 w-5 md:h-4 md:w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => setTaskToEdit(task)}
                className="text-base md:text-sm py-3 md:py-2"
              >
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateTaskStatus(task.id, 'completed')}
                className="text-base md:text-sm py-3 md:py-2"
              >
                Mark Completed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateTaskStatus(task.id, task.status === 'active' ? 'on_deck' : 'active')}
                className="text-base md:text-sm py-3 md:py-2"
              >
                Edit Status: {task.status === 'active' ? 'Set On Deck' : 'Set Active'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteTask(task.id)}
                className="text-red-600 hover:text-red-700 text-base md:text-sm py-3 md:py-2"
              >
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => updateTaskStatus(task.id, 'completed')}
            className="flex-shrink-0 mt-0.5 p-1 md:p-0"
          >
            <CheckCircle2 className="h-6 w-6 md:h-5 md:w-5 text-blue-500" />
          </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-base md:text-sm break-words">{task.item.title}</h3>
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 mt-1 text-xs text-gray-600">
            {contextLabel && (
              <span className={`font-medium whitespace-nowrap ${contextLabel === "OVERDUE" ? "text-red-600" : "text-orange-500"}`}>{contextLabel}</span>
            )}
            {task.assigned_date && (
              <span className="whitespace-nowrap">Assigned: {format(parseISO(task.assigned_date), 'MMM d, yyyy')}</span>
            )}
            {task.due_date && (
              <span className="text-orange-600 font-medium whitespace-nowrap">Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
            )}
            {task.reminder_time && (
              <span className="flex items-center text-blue-600 font-medium whitespace-nowrap">
                🔔 {formatReminderTime(task.reminder_time)}
              </span>
            )}
            {!task.reminder_time && task.habit_id && (() => {
              const habit = habits.find(h => h.id === task.habit_id);
              if (habit) {
                const rule = typeof habit.recurrence_rule === 'string'
                  ? JSON.parse(habit.recurrence_rule)
                  : habit.recurrence_rule;
                if (rule?.time_of_day) {
                  return (
                    <span className="flex items-center text-blue-600 font-medium whitespace-nowrap">
                      🔔 {format(new Date(`2000-01-01T${rule.time_of_day}`), 'h:mm a')}
                    </span>
                  );
                }
              }
              return null;
            })()}
            {task.project_id && (
              <span className="flex items-center text-blue-500 whitespace-nowrap">
                <Link className="mr-1 h-3 w-3" />
                Project
              </span>
            )}
          </div>
        </div>
        <Badge className={`${getStatusColor(task.status || 'active')} flex-shrink-0 text-xs`}>{task.status || 'active'}</Badge>
      </div>
    </div>
    );
  };

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <NewEntryDropdown onEntryCreated={handleUpdate} />
        </div>

        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <NewEntryDropdown onEntryCreated={handleUpdate} />
        </div>
      </div>

      {/* Quote of the Day */}
      <QuoteOfTheDay />
      
      {/* Edit task modal */}
      {taskToEdit && (
        <NewEntryForm
          initialData={taskToEdit}
          isEditing={true}
          onEntryCreated={() => {
            handleUpdate();
            setTaskToEdit(null);
          }}
          onClose={() => setTaskToEdit(null)}
        />
      )}
      
      {/* Task detail dialog */}
      {taskToView && (
        <Dialog open={Boolean(taskToView)} onOpenChange={(open) => !open && setTaskToView(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{taskToView.item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2 text-sm">
                {taskToView.assigned_date && (
                  <div className="flex items-center text-gray-600">
                    <Calendar className="mr-1 h-4 w-4" />
                    <span>Assigned: {formatDateDisplay(taskToView.assigned_date)}</span>
                  </div>
                )}
                {taskToView.reminder_time && (
                  <div className="flex items-center text-blue-600 font-medium">
                    🔔 {formatReminderTime(taskToView.reminder_time)}
                  </div>
                )}
                {!taskToView.reminder_time && taskToView.habit_id && (() => {
                  const habit = habits.find(h => h.id === taskToView.habit_id);
                  if (habit) {
                    const rule = typeof habit.recurrence_rule === 'string'
                      ? JSON.parse(habit.recurrence_rule)
                      : habit.recurrence_rule;
                    if (rule?.time_of_day) {
                      return (
                        <div className="flex items-center text-blue-600 font-medium">
                          🔔 {format(new Date(`2000-01-01T${rule.time_of_day}`), 'h:mm a')}
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
                {taskToView.due_date && (
                  <div className="flex items-center text-gray-600">
                    <Clock className="mr-1 h-4 w-4" />
                    <span>Due: {formatDateDisplay(taskToView.due_date)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Badge className={getStatusColor(taskToView.status || 'on_deck')}>
                  {taskToView.status || 'on_deck'}
                </Badge>
                {taskToView.project_id && (
                  <Badge className="bg-blue-100 text-blue-800">
                    Project
                  </Badge>
                )}
              </div>
              
              {taskToView.description ? (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">
                    {taskToView.description}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 italic text-sm">No description available</p>
              )}
              
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setTaskToView(null);
                    setTaskToEdit(taskToView);
                  }}
                >
                  Edit
                </Button>
                <Button onClick={() => setTaskToView(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Tabs for Context-based Tasks */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 gap-1">
          <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
          <TabsTrigger value="past" className="text-xs md:text-sm">Past</TabsTrigger>
          <TabsTrigger value="all_day" className="text-xs md:text-sm">All Day</TabsTrigger>
          <TabsTrigger value="morning" className="text-xs md:text-sm">Morning</TabsTrigger>
          <TabsTrigger value="work" className="text-xs md:text-sm">Work</TabsTrigger>
          <TabsTrigger value="family" className="text-xs md:text-sm">Family</TabsTrigger>
          <TabsTrigger value="evening" className="text-xs md:text-sm">Evening</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {renderTaskList('all')}
        </TabsContent>

        <TabsContent value="past">
          {renderTaskList('past')}
        </TabsContent>

        <TabsContent value="all_day">
          {renderTaskList('all_day')}
        </TabsContent>

        <TabsContent value="morning">
          {renderTaskList('morning')}
        </TabsContent>

        <TabsContent value="work">
          {renderTaskList('work')}
        </TabsContent>

        <TabsContent value="family">
          {renderTaskList('family')}
        </TabsContent>

        <TabsContent value="evening">
          {renderTaskList('evening')}
        </TabsContent>
      </Tabs>

      {/* Weekly Calendar */}
      <WeeklyCalendar tasks={tasks} habits={habits} />

      {/* Upcoming Tasks Section */}
      {/* Add debugging output for tomorrow's tasks */}
      {/* Uncomment this when debugging date issues
      <div className="text-xs text-gray-500 mb-4">
        <div>Tomorrow's date: {tomorrow.toISOString()}</div>
        <div>Three days later: {threeDaysLater.toISOString()}</div>
        <div>Tasks with tomorrow's assigned date: {
          activeTasks.filter(t => t.assigned_date && isTomorrow(parseDateForDisplay(t.assigned_date)!)).length
        }</div>
      </div>
      */}
      
      <DashboardCard 
        title={`Upcoming (${upcomingDueTasks.length + upcomingAssignedTasks.length})`}
        content={
          <div className="space-y-3">
            {upcomingDueTasks.length === 0 && upcomingAssignedTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No upcoming tasks</div>
            ) : (
              <>
                {upcomingDueTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Due Soon</h3>
                    <div className="space-y-2">
                      {upcomingDueTasks.map(task => renderTask(task))}
                    </div>
                  </div>
                )}
                
                {upcomingAssignedTasks.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned Soon</h3>
                    <div className="space-y-2">
                      {upcomingAssignedTasks.map(task => renderTask(task))}
                    </div>
                  </div>
                )}
              </>
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
                <div className="space-y-2">
                  {tasksWithoutDates.map(task => renderTask(task))}
                </div>
              )}
              
              {activeTasks.filter(task => !task.due_date && !task.assigned_date).length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{activeTasks.filter(task => !task.due_date && !task.assigned_date).length - 5} more unscheduled tasks
                </div>
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
      </div>
    </div>
  );
};

// Helper function to get status color
const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case 'on_deck':
      return 'bg-gray-100 text-gray-800';
    case 'active':
      return 'bg-orange-100 text-orange-800';
    case 'habit':
      return 'bg-blue-100 text-blue-800';
    case 'project':
      return 'bg-purple-100 text-purple-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default DashboardPage;