'use client'

import React from 'react';
import { useTasks } from '@/hooks/useTasks';
import { DashboardCard } from './DashboardCard';

interface TaskCardProps {
  userId: string;
  onRefetch?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ userId, onRefetch }) => {
  const { tasks, isLoading, error, refetch } = useTasks(userId, 5);

  React.useEffect(() => {
    if (onRefetch) {
      onRefetch();
    }
  }, [onRefetch]);

  if (error) {
    return (
      <DashboardCard
        title="Active Tasks"
        content={
          <div className="text-red-500">
            Failed to load tasks: {error.message}
          </div>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <DashboardCard
        title="Active Tasks"
        content={
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 animate-pulse rounded-lg" />
            <div className="h-12 bg-gray-100 animate-pulse rounded-lg" />
          </div>
        }
      />
    );
  }

  return (
    <DashboardCard
      title="Active Tasks"
      content={
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              No active tasks
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{task.items.title}</span>
                  {task.description && (
                    <span className="text-sm text-gray-600">{task.description}</span>
                  )}
                  <span className="text-sm text-gray-500">
                    Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {task.status}
                </div>
              </div>
            ))
          )}
        </div>
      }
    />
  );
};