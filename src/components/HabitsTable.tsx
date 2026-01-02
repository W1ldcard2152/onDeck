'use client'

import React, { useState, useEffect } from 'react';
import { format, addDays, addWeeks, addMonths, startOfDay, isAfter, isSameDay } from 'date-fns';
import { MoreHorizontal, Play, Pause, Trash2, Edit, RotateCcw } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from '@/types/database.types';
import type { Habit } from '@/hooks/useHabits';
import { HabitTaskGenerator } from '@/lib/habitTaskGenerator';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface HabitsTableProps {
  habits: Habit[];
  onHabitUpdate: () => void;
  onEditHabit?: (habit: Habit) => void;
}

const HabitsTable = ({ habits, onHabitUpdate, onEditHabit }: HabitsTableProps) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [nextScheduledDates, setNextScheduledDates] = useState<Record<string, Date | null>>({});
  const { user } = useSupabaseAuth();

  const supabase = createClientComponentClient<Database>();

  // Sort habits: active first, then alphabetically by title
  const sortedHabits = React.useMemo(() => {
    return [...habits].sort((a, b) => {
      // First sort by active status (active first)
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }
      // Then sort alphabetically by title
      return a.title.localeCompare(b.title);
    });
  }, [habits]);

  // Fetch actual next scheduled dates from the tasks table
  const fetchNextScheduledDates = async () => {
    if (!user?.id || habits.length === 0) return;

    try {
      // Get today's date in local timezone (YYYY-MM-DD)
      const todayDate = new Date();
      const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('habit_id, assigned_date')
        .not('habit_id', 'is', null)
        .gte('assigned_date', today)
        .neq('status', 'completed')
        .order('assigned_date', { ascending: true });

      if (error) throw error;

      // Group tasks by habit_id and find the earliest date for each
      const nextDates: Record<string, Date | null> = {};
      
      // Initialize all habits to null
      habits.forEach(habit => {
        nextDates[habit.id] = null;
      });

      // Find the earliest scheduled date for each habit
      if (tasks) {
        tasks.forEach(task => {
          if (task.habit_id && task.assigned_date) {
            const currentNext = nextDates[task.habit_id];
            const taskDate = new Date(task.assigned_date + 'T00:00:00'); // Parse as local date
            
            if (!currentNext || taskDate < currentNext) {
              nextDates[task.habit_id] = taskDate;
            }
          }
        });
      }

      setNextScheduledDates(nextDates);
    } catch (err) {
      console.error('Error fetching next scheduled dates:', err);
    }
  };

  // Fetch next scheduled dates when habits change
  useEffect(() => {
    fetchNextScheduledDates();
  }, [habits, user?.id]);

  const formatRecurrenceRule = (rule: any): string => {
    if (!rule || typeof rule !== 'object') return 'Unknown';
    
    try {
      const { type, interval = 1, days_of_week, unit } = rule;
      
      switch (type) {
        case 'daily':
          return interval === 1 ? 'Daily' : `Every ${interval} days`;
        case 'weekly':
          if (days_of_week && days_of_week.length > 0) {
            if (days_of_week.length === 7) return 'Daily';
            if (days_of_week.length === 5 && 
                days_of_week.every((day: string) => 
                  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)
                )) {
              return 'Weekdays';
            }
            return `Weekly on ${days_of_week.join(', ')}`;
          }
          return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
        case 'monthly':
          return interval === 1 ? 'Monthly' : `Every ${interval} months`;
        case 'yearly':
          return interval === 1 ? 'Yearly' : `Every ${interval} years`;
        default:
          return 'Custom';
      }
    } catch (e) {
      return 'Unknown';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const calculateNextScheduled = (habit: Habit): Date | null => {
    if (!habit.is_active || !habit.recurrence_rule) return null;

    const rule = habit.recurrence_rule;
    const now = new Date();
    const today = startOfDay(now);
    // Helper to parse date string as local time (not UTC)
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed
    };
    
    const startDate = rule.start_date ? parseLocalDate(rule.start_date) : today;
    
    // If start date is in the future and matches pattern, use that
    if (isAfter(startOfDay(startDate), today)) {
      if (matchesRecurrencePattern(startOfDay(startDate), rule, startDate)) {
        return startOfDay(startDate);
      }
    }

    // For daily habits, simple calculation
    if (rule.type === 'daily') {
      const interval = rule.interval || 1;
      let nextDate = startOfDay(startDate);
      
      while (!isAfter(nextDate, today)) {
        nextDate = addDays(nextDate, interval);
      }
      return nextDate;
    }

    // For weekly and monthly habits, check each day until we find a match
    let checkDate = isSameDay(today, startOfDay(startDate)) ? today : addDays(today, 1);
    
    for (let i = 0; i < 365; i++) {
      if (matchesRecurrencePattern(checkDate, rule, startDate)) {
        return startOfDay(checkDate);
      }
      checkDate = addDays(checkDate, 1);
    }

    return null;
  };

  const matchesRecurrencePattern = (date: Date, rule: any, startDate: Date): boolean => {
    switch (rule.type) {
      case 'daily':
        return true; // Daily habits match every day (interval handled in calculation)
      
      case 'weekly':
        if (rule.days_of_week && rule.days_of_week.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = dayNames[date.getDay()];
          return rule.days_of_week.includes(dayName);
        }
        return true;
      
      case 'monthly':
        if (rule.days_of_month && rule.days_of_month.length > 0) {
          return rule.days_of_month.includes(date.getDate());
        }
        return date.getDate() === startDate.getDate();
      
      default:
        return false;
    }
  };

  const formatNextScheduled = (habit: Habit): string => {
    if (!habit.is_active) return 'Inactive';
    
    const nextDate = nextScheduledDates[habit.id];
    if (!nextDate) return 'No tasks scheduled';

    const dateStr = format(nextDate, 'MMM d');
    const timeStr = habit.recurrence_rule?.time_of_day 
      ? format(new Date(`2000-01-01T${habit.recurrence_rule.time_of_day}`), 'h:mm a')
      : null;

    return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
  };

  const handleToggleActive = async (habitId: string, isActive: boolean) => {
    if (!user) return;

    setLoading(prev => ({ ...prev, [habitId]: true }));
    setError(null);

    try {
      // Update the habit status
      const { error: updateError } = await supabase
        .from('habits')
        .update({ is_active: isActive })
        .eq('id', habitId);

      if (updateError) throw updateError;

      // Generate or clear tasks based on new on-completion model
      const generator = new HabitTaskGenerator(supabase, user.id);

      if (isActive) {
        // Get the habit data and generate first task
        const { data: habit, error: habitError } = await supabase
          .from('habits')
          .select('*')
          .eq('id', habitId)
          .single();

        if (habitError) throw habitError;
        if (habit) {
          // Generate first task starting from today or the habit's start_date
          // Parse date in local timezone to avoid UTC conversion issues
          const startDate = habit.recurrence_rule?.start_date
            ? new Date(habit.recurrence_rule.start_date + 'T00:00:00')
            : new Date();
          await generator.generateNextTask(habit as Habit, startDate, true); // isInitialTask = true
        }
      } else {
        // Delete incomplete tasks when deactivating
        await generator.deleteIncompleteHabitTasks(habitId);
      }

      onHabitUpdate();
      await fetchNextScheduledDates(); // Refresh next scheduled dates
    } catch (err) {
      console.error('Error toggling habit:', err);
      setError(err instanceof Error ? err.message : 'Failed to update habit');
    } finally {
      setLoading(prev => ({ ...prev, [habitId]: false }));
    }
  };

  const handleDeleteClick = (habitId: string) => {
    setHabitToDelete(habitId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!habitToDelete || !user) return;

    setLoading(prev => ({ ...prev, [habitToDelete]: true }));

    try {
      // First clear any associated incomplete tasks
      const generator = new HabitTaskGenerator(supabase, user.id);
      await generator.deleteIncompleteHabitTasks(habitToDelete);

      // Then delete the habit
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitToDelete);

      if (error) throw error;

      onHabitUpdate();
      await fetchNextScheduledDates(); // Refresh next scheduled dates
    } catch (err) {
      console.error('Error deleting habit:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete habit');
    } finally {
      setLoading(prev => ({ ...prev, [habitToDelete]: false }));
      setHabitToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleRegenerateTasks = async (habitId: string) => {
    if (!user) return;

    setLoading(prev => ({ ...prev, [habitId]: true }));
    setError(null);

    try {
      const { data: habit, error: habitError } = await supabase
        .from('habits')
        .select('*')
        .eq('id', habitId)
        .single();

      if (habitError) throw habitError;
      if (!habit || !habit.is_active) {
        throw new Error('Cannot regenerate tasks for inactive habit');
      }

      const generator = new HabitTaskGenerator(supabase, user.id);

      // Delete incomplete tasks and generate a fresh one
      await generator.deleteIncompleteHabitTasks(habitId);

      // Generate next task starting from today
      // Parse date in local timezone to avoid UTC conversion issues
      const startDate = habit.recurrence_rule?.start_date
        ? new Date(habit.recurrence_rule.start_date + 'T00:00:00')
        : new Date();
      await generator.generateNextTask(habit as Habit, startDate, true); // isInitialTask = true

      onHabitUpdate();
      await fetchNextScheduledDates(); // Refresh next scheduled dates
    } catch (err) {
      console.error('Error regenerating tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate tasks');
    } finally {
      setLoading(prev => ({ ...prev, [habitId]: false }));
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Next Scheduled</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHabits.map((habit) => {
              const isLoading = loading[habit.id];
              
              return (
                <TableRow key={habit.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={habit.is_active}
                        onCheckedChange={(checked) => handleToggleActive(habit.id, checked)}
                        disabled={isLoading}
                      />
                      <Badge className={habit.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {habit.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{habit.title}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant="outline">
                      {formatRecurrenceRule(habit.recurrence_rule)}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Badge className={getPriorityColor(habit.priority)}>
                      {habit.priority}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <span className={habit.is_active ? 'text-gray-900' : 'text-gray-500'}>
                      {formatNextScheduled(habit)}
                    </span>
                  </TableCell>
                  
                  <TableCell>
                    {format(new Date(habit.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  
                  <TableCell className="max-w-[12rem] truncate">
                    {habit.description || '-'}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(habit.id, !habit.is_active)}
                          disabled={isLoading}
                        >
                          {habit.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem
                          onClick={() => onEditHabit?.(habit)}
                          disabled={isLoading}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Habit
                        </DropdownMenuItem>
                        
                        {habit.is_active && (
                          <DropdownMenuItem
                            onClick={() => handleRegenerateTasks(habit.id)}
                            disabled={isLoading}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Regenerate Tasks
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(habit.id)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 focus:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Habit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this habit?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the habit and all its associated tasks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export { HabitsTable };
export default HabitsTable;