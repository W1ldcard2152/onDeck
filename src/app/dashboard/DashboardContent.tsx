import React from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { TaskList } from '@/components/TaskList';
import { TaskCard } from '@/components/TaskCard';
import { NoteCard } from '@/components/NoteCard';
import { DashboardCard } from '@/components/DashboardCard';

useEffect(() => {
  if ('serviceWorker' in navigator) {
    console.log('Service Worker is supported');
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered successfully', reg);
      })
      .catch(err => {
        console.error('Service Worker registration failed', err);
      });
  } else {
    console.error('Service Worker is NOT supported');
  }
}, []);

const DashboardContent = () => {
  const { user } = useSupabaseAuth();
  const { tasks, isLoading: tasksLoading } = useTasks(user?.id, 5);
  const { notes, isLoading: notesLoading } = useNotes(user?.id, 3);

  const activeTasks = tasks?.filter(task => 
    (task.status === 'active' || task.status === 'on_deck') &&
    !task.item.is_archived
  ) || [];

  const activeNotes = notes?.filter(note => !note.item.is_archived) || [];

  if (tasksLoading || notesLoading) {
    return <div className="text-center py-8">Loading...</div>;
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
};

export default DashboardContent;