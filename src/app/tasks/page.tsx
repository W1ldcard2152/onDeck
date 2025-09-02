'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { isSameDay, parseISO } from 'date-fns';
import { useTasks } from '@/hooks/useTasks';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { TaskTable } from '@/components/TaskTable';
import { MonthlyCalendar } from '@/components/MonthlyCalendar';
import { NewTaskForm } from '@/components/NewTaskForm';
import { NewNoteForm } from '@/components/NewNoteForm';
import { NewEntryForm } from '@/components/NewEntryForm';
import { DoneEntryForm } from '@/components/DoneEntryForm';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import TasksDebugger from '@/components/TasksDebugger';

export default function TasksPage() {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading, error, refetch } = useTasks(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localTasks, setLocalTasks] = useState<typeof tasks>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [filteredTasks, setFilteredTasks] = useState<typeof tasks>([]);

  // Update localTasks whenever tasks changes
  useEffect(() => {
    console.log('Tasks changed, updating local state...');
    setLocalTasks(tasks);
    // Increment refreshKey to force table re-render
    setRefreshKey(prev => prev + 1);
  }, [tasks]);

  // Filter tasks based on selected date
  useEffect(() => {
    if (!selectedDate) {
      setFilteredTasks(localTasks);
      return;
    }

    const tasksForDate = localTasks.filter(task => {
      const taskDate = task.due_date ? parseISO(task.due_date) : 
                      task.assigned_date ? parseISO(task.assigned_date) : null;
      return taskDate && isSameDay(taskDate, selectedDate);
    });

    setFilteredTasks(tasksForDate);
  }, [localTasks, selectedDate]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(selectedDate && isSameDay(selectedDate, date) ? undefined : date);
  };

  // Callback for explicit task updates
  const handleTaskUpdate = useCallback(() => {
    console.log('Task updated, manually refreshing data...');
    refetch();
  }, [refetch]);

  if (isLoading && localTasks.length === 0) {
    return (
      <div className="py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-center items-center h-32">
            <div className="text-lg text-gray-500">Loading tasks...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading tasks: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="mb-6">
        {/* Desktop layout: title and buttons on same line */}
        <div className="hidden sm:flex justify-between items-center">
          <h1 className="text-2xl font-bold">Tasks</h1>
          <div className="flex gap-2">
            <DoneEntryForm onEntryCreated={handleTaskUpdate} />
            <NewTaskForm onEntryCreated={handleTaskUpdate} />
            <NewNoteForm onEntryCreated={handleTaskUpdate} />
          </div>
        </div>
        
        {/* Mobile layout: title on top, buttons underneath */}
        <div className="sm:hidden space-y-4">
          <h1 className="text-2xl font-bold">Tasks</h1>
          <div className="flex flex-wrap gap-2">
            <DoneEntryForm onEntryCreated={handleTaskUpdate} />
            <NewTaskForm onEntryCreated={handleTaskUpdate} />
            <NewNoteForm onEntryCreated={handleTaskUpdate} />
          </div>
        </div>
      </div>

      {/* Monthly Calendar */}
      <MonthlyCalendar 
        tasks={localTasks.filter(task => !task.habit_id)} // Only show regular tasks, not habit tasks
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
        showHabits={false}
      />

      {/* Add key to force re-render on data changes */}
      <TaskTable 
        tasks={filteredTasks} 
        onTaskUpdate={handleTaskUpdate} 
        key={`tasks-table-${refreshKey}`} 
      />
      
      {/* Debug information */}
      <div className="text-xs text-gray-400 mt-8">
        Tasks with project links: {localTasks.filter(t => t.project_id).length} / {localTasks.length}
      </div>
      
      {/* Add TasksDebugger but only manually trigger refreshes */}
      <TasksDebugger tasks={localTasks} />
    </div>
  );
}