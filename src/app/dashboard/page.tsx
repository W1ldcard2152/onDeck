'use client'

import React, { useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';

export default function DashboardPage() {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading: tasksLoading, error: tasksError } = useTasks(user?.id, 5);
  const { notes, isLoading: notesLoading } = useNotes(user?.id, 3);

  // Debug logging
  useEffect(() => {
    if (tasks) {
      console.log('All tasks:', tasks);
      const activeTasks = tasks.filter(task => 
        (task.status === 'active' || task.status === 'on_deck') &&
        !task.item?.is_archived
      );
      console.log('Filtered active tasks:', activeTasks);
    }
  }, [tasks]);

  const activeTasks = tasks?.filter(task => 
    (task.status === 'active' || task.status === 'on_deck') &&
    !task.item?.is_archived
  ) || [];

  const activeNotes = notes?.filter(note => !note.item.is_archived) || [];

  if (tasksLoading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  if (tasksError) {
    console.error('Tasks error:', tasksError);
    return <div className="text-center py-8 text-red-600">Error loading tasks</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DashboardCard
        title="Active Tasks"
        content={
          <div className="space-y-4">
            {activeTasks.length > 0 ? (
              activeTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                No active tasks
              </div>
            )}
          </div>
        }
      />

      <DashboardCard
        title="Recent Notes"
        content={
          <div className="space-y-4">
            {activeNotes.length > 0 ? (
              activeNotes.map(note => (
                <NoteCard key={note.id} note={note} preview />
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                No recent notes
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}