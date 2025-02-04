'use client'

import React from 'react';
import { TaskWithDetails } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface TaskListProps {
  tasks: TaskWithDetails[];
  title: string;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, title }) => {
  if (tasks.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <div className="text-gray-500 text-center py-8">No active tasks</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};