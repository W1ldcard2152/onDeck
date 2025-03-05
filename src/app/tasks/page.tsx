'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { TaskTable } from '@/components/TaskTable';
import { NewEntryForm } from '@/components/NewEntryForm';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import TasksDebugger from '@/components/TasksDebugger';

export default function TasksPage() {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading, error, refetch } = useTasks(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localTasks, setLocalTasks] = useState<typeof tasks>([]);

  // Update localTasks whenever tasks changes
  useEffect(() => {
    console.log('Tasks changed, updating local state...');
    setLocalTasks(tasks);
    // Increment refreshKey to force table re-render
    setRefreshKey(prev => prev + 1);
  }, [tasks]);

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <NewEntryForm onEntryCreated={handleTaskUpdate} />
      </div>

      {/* Add key to force re-render on data changes */}
      <TaskTable 
        tasks={localTasks} 
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