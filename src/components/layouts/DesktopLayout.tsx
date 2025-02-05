'use client'

import React from 'react';
import AuthUI from '../Auth';
import { Search, Bell, Settings, Home, CheckSquare, BookOpen, 
         FolderOpen, Calendar, Star, Database, Menu } from 'lucide-react';
import { NewEntryForm } from '../NewEntryForm';
import { DashboardCard } from '../DashboardCard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { isAfter, isBefore, startOfTomorrow } from 'date-fns';
import { useTasks } from '@/hooks/useTasks';
import { TaskCard } from '../TaskCard';
import type { TaskWithDetails } from '@/lib/types';

// UserMenu component
const UserMenu = () => {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-8 h-8 bg-gray-200 rounded-full cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all" />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// NavItem component
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false }) => {
  return (
    <div className={`flex items-center px-3 py-2 rounded-lg cursor-pointer
      ${active ? 'bg-blue-600' : 'hover:bg-gray-800'}`}>
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
    </div>
  );
};

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

const AuthenticatedLayout: React.FC<{ userId: string }> = ({ userId }) => {
  const { tasks, isLoading: taskLoading, error: taskError } = useTasks(userId);

  const activeTasks = React.useMemo(() => {
    // Add debug logging
    console.log('Filtering tasks:', {
      inputTasks: tasks,
      tasksLength: tasks?.length
    });
  
    return (tasks || []).filter((task): task is TaskWithDetails => {
      if (!task) {
        console.log('Task is null or undefined');
        return false;
      }
      
      if (!task.item) {
        console.log('Task has no item:', task);
        return false;
      }
  
      if (task.status !== 'active') {
        console.log('Task not active:', task.status);
        return false;
      }
      
      if (task.is_project_converted) {
        console.log('Task is project converted');
        return false;
      }
      
      const now = new Date();
      const tomorrow = startOfTomorrow();
  
      if (task.do_date && isAfter(new Date(task.do_date), tomorrow)) {
        console.log('Task do_date is after tomorrow');
        return false;
      }
  
      if (task.due_date && isBefore(new Date(task.due_date), now)) {
        console.log('Task due_date is before now');
        return false;
      }
  
      return true;
    });
  }, [tasks]);

  const renderTasksContent = () => {
    if (taskLoading) {
      return (
        <div className="animate-pulse">
          <div className="h-24 bg-gray-200 rounded mb-3"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      );
    }
  
    if (taskError) {
      return (
        <div className="text-red-600 p-4">
          {taskError instanceof Error ? taskError.message : 'An error occurred loading tasks'}
        </div>
      );
    }
  
    // Add debug logging
    console.log('Rendering tasks:', {
      totalTasks: tasks?.length,
      activeTasks: activeTasks.length,
      firstActiveTask: activeTasks[0],
    });
  
    if (!activeTasks || activeTasks.length === 0) {
      return (
        <div className="text-gray-500 text-center py-4">
          No active tasks
        </div>
      );
    }
  
    return (
      <div className="space-y-3">
        {activeTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden md:block w-64 bg-navy-900 text-white p-4">
        <div className="flex items-center mb-8">
          <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
          <span className="text-xl font-semibold">OnDeck</span>
        </div>

        <nav className="space-y-2">
          <NavItem icon={<Home size={20} />} label="Dashboard" active={true} />
          <NavItem icon={<CheckSquare size={20} />} label="Tasks" />
          <NavItem icon={<FolderOpen size={20} />} label="Projects" />
          <NavItem icon={<BookOpen size={20} />} label="Notes" />
          <NavItem icon={<Calendar size={20} />} label="Journal" />
          <NavItem icon={<Star size={20} />} label="Habits" />
          <NavItem icon={<Database size={20} />} label="Vault" />
        </nav>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center flex-1">
            <button className="md:hidden p-2 mr-2 hover:bg-gray-100 rounded-lg">
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
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Bell size={20} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings size={20} className="text-gray-600" />
            </button>
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <NewEntryForm onEntryCreated={() => {}} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 auto-rows-min">
            <DashboardCard
              title="Active Tasks"
              content={renderTasksContent()}
            />

            <DashboardCard
              title="Current Projects"
              content={
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Personal Website</span>
                      <span className="text-sm text-gray-500">75%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{width: '75%'}}></div>
                    </div>
                  </div>
                </div>
              }
            />

            <DashboardCard
              title="Recent Notes"
              content={
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Project Ideas</div>
                    <div className="line-clamp-2">Some notes about potential project ideas and implementation details...</div>
                  </div>
                </div>
              }
            />

            <DashboardCard
              title="Daily Habits"
              content={
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span>Morning Routine</span>
                      <span className="text-sm text-green-500">Done</span>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DesktopLayout;