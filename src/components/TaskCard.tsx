'use client'

import React from 'react';
import { TaskWithDetails } from '@/lib/types';
import { Calendar, Clock } from 'lucide-react';
import { formatDate } from '@/lib/timezone';
import { useContexts } from '@/hooks/useContexts';

interface TaskCardProps {
  task: TaskWithDetails;
}

export const TaskCard: React.FC<TaskCardProps> = React.memo(({ task }) => {
  const hasAssignedDate = Boolean(task.assigned_date);
  const hasDueDate = Boolean(task.due_date);
  const { contexts } = useContexts();

  const contextIds: string[] = task.daily_context
    ? (() => { try { return JSON.parse(task.daily_context); } catch { return []; } })()
    : [];

  const contextLabels = contextIds
    .map(id => contexts.find(c => c.id === id))
    .filter(Boolean)
    .map(c => `${c!.emoji} ${c!.name}`)
    .join(', ');

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
            <span>Assigned: {formatDate(task.assigned_date)}</span>
          </div>
        )}

        {contextLabels && (
          <div className="flex items-center text-sm text-blue-600 font-medium">
            <span>{contextLabels}</span>
          </div>
        )}

        {hasDueDate && task.due_date && (
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-1" />
            <span>Due: {formatDate(task.due_date)}</span>
          </div>
        )}
      </div>
    </div>
  );
});

TaskCard.displayName = 'TaskCard';
