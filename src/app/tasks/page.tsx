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
  const [hasInitialized, setHasInitialized] = useState(false);

  // Prevent the handleTaskUpdate function from being recreated on every render
  const handleTaskUpdate = useCallback(() => {
    console.log('Task updated, refreshing data...');
    refetch();
    setRefreshKey(prevKey => prevKey + 1);
  }, [refetch]);

  // Only run the initial refresh once
  useEffect(() => {
    if (!hasInitialized && !isLoading) {
      console.log('Running one-time initialization');
      setHasInitialized(true);
    }
  }, [hasInitialized, isLoading]);

  if (isLoading) {
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
        tasks={tasks} 
        onTaskUpdate={handleTaskUpdate} 
        key={`tasks-table-${refreshKey}`} 
      />
      
      {/* Debug information */}
      <div className="text-xs text-gray-400 mt-8">
        Tasks with project links: {tasks.filter(t => t.project_id).length} / {tasks.length}
      </div>
      
      {/* Add TasksDebugger but only manually trigger refreshes */}
      <TasksDebugger tasks={tasks} />
    </div>
  );
}