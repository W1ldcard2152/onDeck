'use client'

import React, { useEffect, useState } from 'react';
import AuthUI from '../Auth';
import { Search, Bell, Settings, Home, CheckSquare, BookOpen, 
         FolderOpen, Calendar, Star, Database, Menu, Clock } from 'lucide-react';
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
import { isAfter, isBefore, startOfTomorrow, format } from 'date-fns';

// Type definitions
interface Task {
  id: string;
  do_date: string | null;
  due_date: string | null;
  status: string;
  is_project_converted: boolean;
  converted_project_id: string | null;
}

interface Item {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  item_type: string;
  is_archived: boolean;
  archived_at: string | null;
  archive_reason: string | null;
}

interface TaskWithDetails extends Task {
  title: string;
  created_at: string;
  user_id: string;
}

interface TaskCardProps {
  task: TaskWithDetails;
}

interface TaskListProps {
  tasks: TaskWithDetails[];
  title: string;
}

// Mock data - replace with API calls later
const mockTasks: Task[] = [
  {
    id: "23704fce-8406-4f9f-a331-c5ca4d3c411c",
    do_date: null,
    due_date: null,
    status: "active",
    is_project_converted: false,
    converted_project_id: null
  },
  {
    id: "3c3b07c4-9bf2-4e74-9437-399767adef23",
    do_date: null,
    due_date: "2025-02-05",
    status: "active",
    is_project_converted: false,
    converted_project_id: null
  }
];

const mockItems: Item[] = [
  {
    id: "23704fce-8406-4f9f-a331-c5ca4d3c411c",
    user_id: "25f70130-bc30-47ab-8ec3-165869870ff4",
    title: "Example Task 1",
    created_at: "2025-02-02 16:50:18.795016+00",
    updated_at: "2025-02-02 16:50:18.795016+00",
    item_type: "task",
    is_archived: false,
    archived_at: null,
    archive_reason: null
  },
  {
    id: "3c3b07c4-9bf2-4e74-9437-399767adef23",
    user_id: "25f70130-bc30-47ab-8ec3-165869870ff4",
    title: "Test Task 001",
    created_at: "2025-02-02 18:02:26.727525+00",
    updated_at: "2025-02-02 18:02:26.727525+00",
    item_type: "task",
    is_archived: false,
    archived_at: null,
    archive_reason: null
  }
];

// UserMenu component
export const UserMenu = () => {
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

// Task Components
const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const hasDueDate = Boolean(task.due_date);
  const hasDoDate = Boolean(task.do_date);

  return (
    <div className="p-4 mb-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
      
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

const TaskList: React.FC<TaskListProps> = ({ tasks, title }) => {
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

// Main DesktopLayout component
const DesktopLayout: React.FC = () => {
  const { user, loading } = useSupabaseAuth();
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [taskLoading, setTaskLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const itemsMap = new Map(
          mockItems.map(item => [item.id, item])
        );

        const combinedTasks: TaskWithDetails[] = mockTasks
          .filter(task => !task.is_project_converted)
          .map(task => {
            const item = itemsMap.get(task.id);
            if (!item) return null;

            return {
              ...task,
              title: item.title,
              created_at: item.created_at,
              user_id: item.user_id
            };
          })
          .filter((task): task is TaskWithDetails => task !== null);

        setTasks(combinedTasks);
        setTaskLoading(false);
      } catch (err) {
        console.error('Error loading tasks:', err);
        setError('Failed to load tasks. Please try again later.');
        setTaskLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const activeTasks = tasks.filter(task => {
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:block w-64 bg-navy-900 text-white p-4">
        {/* Logo */}
        <div className="flex items-center mb-8">
          <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
          <span className="text-xl font-semibold">OnDeck</span>
        </div>

        {/* Navigation */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center flex-1">
            {/* Mobile menu button */}
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
          
          {/* User Controls */}
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

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <NewEntryForm onEntryCreated={() => {
              // TODO: Add refresh logic here when we implement 
              // global state management
            }} />
          </div>

          {/* Responsive Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 auto-rows-min">
            {/* Active Tasks Card */}
            <DashboardCard
              title="Active Tasks"
              content={
                taskLoading ? (
                  <div className="animate-pulse">
                    <div className="h-24 bg-gray-200 rounded mb-3"></div>
                    <div className="h-24 bg-gray-200 rounded"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-600 p-4">{error}</div>
                ) : (
                  <div className="space-y-3">
                    {activeTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                    {activeTasks.length === 0 && (
                      <div className="text-gray-500 text-center py-4">
                        No active tasks
                      </div>
                    )}
                  </div>
                )
              }
            />

            {/* Projects Card */}
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

            {/* Notes Card */}
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

            {/* Habits Card */}
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