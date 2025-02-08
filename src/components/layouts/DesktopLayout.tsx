'use client'

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { addDays, isWithinInterval } from 'date-fns';
import AuthUI from '../Auth';
import { Search, Bell, Settings, Home, CheckSquare, BookOpen, 
         FolderOpen, Calendar, Star, Menu } from 'lucide-react';
import { NewEntryForm } from '../NewEntryForm';
import { DashboardCard } from '../DashboardCard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { TaskCard } from '../TaskCard';
import { NoteCard } from '../NoteCard';
import { TaskTable } from '../TaskTable';
import { NotesTable } from '../NotesTable'; 
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

const AuthenticatedLayout: React.FC<{ userId: string }> = ({ userId }) => {
  const [activeSection, setActiveSection] = React.useState<'dashboard' | 'tasks' | 'notes'>('dashboard');
  const { tasks, isLoading: taskLoading, error: taskError, refetch } = useTasks(userId);
  const { notes, isLoading: notesLoading, error: notesError } = useNotes(userId);

  // Memoized dashboard data
  const dashboardTasks = React.useMemo(() => {
    if (!tasks) return [];
    const today = new Date();
    const threeDaysFromNow = addDays(today, 3);

    return tasks.filter((task): task is TaskWithDetails => {
      if (!task) return false;
      if (task.status === 'completed') return false;
      if (task.is_project_converted) return false;

      // Include if task is active
      if (task.status === 'active') return true;

      // Include if task is high priority
      if (task.priority === 'high') return true;

      // Include if task has a due date within next 3 days
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        return isWithinInterval(dueDate, { start: today, end: threeDaysFromNow });
      }

      return false;
    }).sort((a, b) => {
      // Sort by status (active first)
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }
      
      // Then by priority (high first)
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (a.priority !== b.priority) {
        return (priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal']);
      }
      
      // Then by due date (earliest first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      
      return 0;
    });
  }, [tasks]);

  const dashboardNotes = React.useMemo(() => {
    if (!notes) return [];
    
    return notes
      .filter(note => !note.item.is_archived)
      .sort((a, b) => 
        new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime()
      )
      .slice(0, 5);
  }, [notes]);

  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 auto-rows-min">
      <DashboardCard
        title="Active & Important Tasks"
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
            ) : dashboardTasks.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No active or important tasks</div>
            ) : (
              dashboardTasks.map((task) => (
                <div key={task.id} className="relative">
                  {task.priority === 'high' && (
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-500 rounded-full" />
                  )}
                  <TaskCard task={task} />
                </div>
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
            ) : !dashboardNotes || dashboardNotes.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No notes yet</div>
            ) : (
              dashboardNotes.map((note) => (
                <NoteCard key={note.id} note={note} preview={true} />
              ))
            )}
          </div>
        }
      />
    </div>
  );

  const renderTasks = () => (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Sort by clicking column headers</span>
            <div className="flex items-center space-x-1 ml-2 px-2 py-1 bg-gray-100 rounded">
              <ChevronUp className="h-4 w-4 text-blue-600" />
              <span className="text-xs">1</span>
              <ChevronDown className="h-3 w-3 text-blue-400" />
              <span className="text-xs">2</span>
              <span className="text-gray-500">= multi-column sort</span>
            </div>
          </div>
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

  const renderNotes = () => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">All Notes</h2>
      </div>
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
          <NotesTable 
            notes={notes}
            onNoteUpdate={refetch}
          />
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboard();
      case 'tasks':
        return renderTasks();
      case 'notes':
        return renderNotes();
      default:
        return <div>Select a section to view content</div>;
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
   activeSection === 'tasks' ? 'Task Manager' : // Changed from 'Tasks' to 'Task Manager'
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