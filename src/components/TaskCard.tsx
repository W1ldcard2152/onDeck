'use client'

import React from 'react';
import { TaskWithDetails } from '@/lib/types';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

interface TaskCardProps {
  task: TaskWithDetails;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  // Add debug logging
  console.log('Rendering TaskCard:', { task });

  const hasDueDate = Boolean(task.due_date);
  const hasDoDate = Boolean(task.do_date);

  return (
    <div className="p-4 mb-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <h3 className="text-lg font-medium text-gray-900">{task.item.title}</h3>
      
      {task.description && (
        <p className="mt-1 text-sm text-gray-600">{task.description}</p>
      )}
      
      <div className="mt-2 flex flex-wrap gap-3">
        {hasDoDate && task.do_date && (
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Do: {format(new Date(task.do_date), 'MMM d, yyyy')}</span>
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
};