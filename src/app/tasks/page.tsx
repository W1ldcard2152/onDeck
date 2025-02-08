import React from 'react';
import { TaskTable } from '@/components/TaskTable';
import { NewEntryForm } from '@/components/NewEntryForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useTasks } from '@/hooks/useTasks';

export default function TasksPage() {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading, error, refetch } = useTasks(user?.id || '');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Task Manager</h1>
        <NewEntryForm onEntryCreated={() => refetch()} />
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
              {error instanceof Error ? error.message : 'Error loading tasks'}
            </div>
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              No tasks yet. Create your first task to get started!
            </div>
          </div>
        ) : (
          <TaskTable 
            tasks={tasks} 
            onTaskUpdate={refetch}
          />
        )}
      </div>
    </div>
  );
}