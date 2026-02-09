'use client'

import React from 'react';
import { TaskWithDetails, DailyContext } from '@/lib/types';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

interface TaskCardProps {
  task: TaskWithDetails;
}

export const TaskCard: React.FC<TaskCardProps> = React.memo(({ task }) => {
  const hasAssignedDate = Boolean(task.assigned_date);
  const hasDueDate = Boolean(task.due_date);

  const dailyContexts: DailyContext[] = task.daily_context
    ? (() => {
        try {
          return JSON.parse(task.daily_context);
        } catch {
          return [];
        }
      })()
    : [];

  const formatContexts = (contexts: DailyContext[]): string => {
    if (contexts.length === 0) return '';
    return contexts.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
  };

  return (
    <div className="p-4 mb-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <h3 className="text-lg font-medium text-gray-900">{task.item.title}</h3>
      
      {task.description && (
        <p className="mt-1 text-sm text-gray-600">{task.description}</p>
      )}
      
      <div className="mt-2 flex flex-wrap gap-3">
        {hasAssignedDate && task.assigned_date && (
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Assigned: {format(new Date(task.assigned_date), 'MMM d, yyyy')}</span>
          </div>
        )}

        {dailyContexts.length > 0 && (
          <div className="flex items-center text-sm text-blue-600 font-medium">
            <span>📅 {formatContexts(dailyContexts)}</span>
          </div>
        )}

        {hasDueDate && task.due_date && (
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-1" />
            <span>Due: {format(new Date(task.due_date), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>
    </div>
  );
});

TaskCard.displayName = 'TaskCard';