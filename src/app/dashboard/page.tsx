import React from 'react';
import { DashboardCard } from '@/components/DashboardCard';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { NewEntryForm } from '@/components/NewEntryForm';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { isAfter, isBefore, startOfTomorrow } from 'date-fns';
import type { TaskWithDetails } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading: taskLoading, error: taskError, refetch } = useTasks(user?.id || '', 10);
  const { notes, isLoading: notesLoading, error: notesError } = useNotes(user?.id || '', 5);

  const activeTasks = React.useMemo(() => {
    return (tasks || []).filter((task): task is TaskWithDetails => {
      if (!task) return false;
      if (task.status !== 'active') return false;
      if (task.is_project_converted) return false;
      
      const now = new Date();
      const tomorrow = startOfTomorrow();
  
      if (task.assigned_date && isAfter(new Date(task.assigned_date), tomorrow)) {
        return false;
      }
  
      if (task.due_date && isBefore(new Date(task.due_date), now)) {
        return false;
      }
  
      return true;
    });
  }, [tasks]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <NewEntryForm onEntryCreated={() => refetch()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 auto-rows-min">
        <DashboardCard
          title="Active Tasks"
          content={
            <div className="space-y-3">
              {taskLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              ) : taskError ? (
                <div className="text-red-600 p-4">
                  {taskError instanceof Error ? taskError.message : 'Error loading tasks'}
                </div>
              ) : activeTasks.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No active tasks</div>
              ) : (
                activeTasks.slice(0, 5).map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))
              )}
            </div>
          }
        />
        
        <DashboardCard
          title="Recent Notes"
          content={
            <div className="space-y-3">
              {notesLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              ) : notesError ? (
                <div className="text-red-600 p-4">
                  {notesError instanceof Error ? notesError.message : 'Error loading notes'}
                </div>
              ) : !notes || notes.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No notes yet</div>
              ) : (
                notes.slice(0, 5).map((note) => (
                  <NoteCard key={note.id} note={note} preview={true} />
                ))
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}