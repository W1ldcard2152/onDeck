'use client'

import React from 'react';
import AuthUI from './Auth';
import { Search, Bell, Settings, Home, CheckSquare, BookOpen, 
         FolderOpen, Calendar, Star, Database, Menu } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { NewEntryForm } from './NewEntryForm';
import { DashboardCard } from './DashboardCard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

// Separate UserMenu component
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

// Separate NavItem component
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

// Main DesktopLayout component
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
  {/* Dynamic Task Card */}
  <TaskCard 
    userId={user.id} 
    onRefetch={() => {
      // This will be called when the TaskCard needs to refresh
    }} 
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