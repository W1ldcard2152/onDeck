'use client'

import React from 'react';
import AuthUI from '../Auth';
import { Search, Bell, Settings, Home, CheckSquare, BookOpen, 
         FolderOpen, Calendar, Star, Menu } from 'lucide-react';
import { NewEntryForm } from '../NewEntryForm';
import { DashboardCard } from '../DashboardCard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
// Update Supabase import to use the React client
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { isAfter, isBefore, startOfTomorrow } from 'date-fns';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { TaskCard } from '../TaskCard';
import { NoteCard } from '../NoteCard';
import { TaskTable } from '../TaskTable';
import type { TaskWithDetails } from '@/lib/types';
import type { Database } from '@/types/database.types';

const UserMenu = () => {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 bg-gray-200 rounded-full cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={`flex w-full items-center px-3 py-2 rounded-lg cursor-pointer text-left
        ${active ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
    >
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

const NavDivider = () => (
  <div className="my-2 border-t border-gray-700" />
);

const DesktopLayout: React.FC = () => {
  const { user, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthUI />;
  }

  return <AuthenticatedLayout userId={user.id} />;
};

interface AuthenticatedLayoutProps {
  userId: string;
}

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ userId }) => {
  const [activeSection, setActiveSection] = React.useState<'dashboard' | 'tasks' | 'notes'>('dashboard');
  const { tasks, isLoading: taskLoading, error: taskError, refetch } = useTasks(userId);
  const { notes, isLoading: notesLoading, error: notesError } = useNotes(userId);

  const activeTasks = React.useMemo(() => {
    return (tasks || []).filter((task): task is TaskWithDetails => {
      if (!task) return false;
      if (task.status !== 'active') return false;
      if (task.is_project_converted) return false;
      
      const now = new Date();
      const tomorrow = startOfTomorrow();
  
      if (task.do_date && isAfter(new Date(task.do_date), tomorrow)) {
        return false;
      }
  
      if (task.due_date && isBefore(new Date(task.due_date), now)) {
        return false;
      }
  
      return true;
    });
  }, [tasks]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
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
        );
      
      case 'tasks':
        return (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">All Tasks</h2>
                <NewEntryForm onEntryCreated={() => refetch()} />
              </div>
            </div>
            <div className="p-6">
              {taskLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-full"></div>
                </div>
              ) : taskError ? (
                <div className="text-red-600 p-4">
                  {taskError instanceof Error ? taskError.message : 'Error loading tasks'}
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No tasks yet. Create your first task to get started!
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
      
      case 'notes':
        return (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">All Notes</h2>
              <NewEntryForm onEntryCreated={() => refetch()} />
            </div>
            <div className="space-y-3">
              {notes?.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden md:block w-64 bg-navy-900 text-white p-4">
        <div className="flex items-center mb-8">
          <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
          <span className="text-xl font-semibold">OnDeck</span>
        </div>

        <nav className="space-y-2">
          <NavItem 
            icon={<Home size={20} />} 
            label="Dashboard" 
            active={activeSection === 'dashboard'} 
            onClick={() => setActiveSection('dashboard')}
          />
          <NavItem 
            icon={<CheckSquare size={20} />} 
            label="Tasks" 
            active={activeSection === 'tasks'}
            onClick={() => setActiveSection('tasks')}
          />
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Notes" 
            active={activeSection === 'notes'}
            onClick={() => setActiveSection('notes')}
          />
          
          <NavDivider />
          
          <NavItem icon={<FolderOpen size={20} />} label="Projects" />
          <NavItem icon={<Star size={20} />} label="Habits" />
          <NavItem icon={<Calendar size={20} />} label="Journal" />
        </nav>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center flex-1">
            <button 
              type="button"
              className="md:hidden p-2 mr-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              type="button"
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Bell size={20} className="text-gray-600" />
            </button>
            <button 
              type="button"
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Settings size={20} className="text-gray-600" />
            </button>
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-semibold">
    {activeSection === 'dashboard' ? 'Dashboard' : 
     activeSection === 'tasks' ? 'Tasks' : 
     activeSection === 'notes' ? 'Notes' : ''}
  </h1>
  <NewEntryForm onEntryCreated={() => refetch()} />
</div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default DesktopLayout;