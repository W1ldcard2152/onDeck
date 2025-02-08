import React, { useState } from 'react';
import { Search, Bell, Settings, Menu } from 'lucide-react';
import AuthUI from '../Auth';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import type { Database } from '@/types/database.types';
import { BottomNav } from './responsiveNav/BottomNav';
import { DesktopNav } from './responsiveNav/DesktopNav';
import { MobileHeader } from './responsiveNav/MobileHeader';
import DashboardPage from '@/app/dashboard/page';
import TasksPage from '@/app/tasks/page';
import NotesPage from '@/app/notes/page';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'tasks' | 'notes' | 'projects' | 'habits' | 'journal'>('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardPage />;
      case 'tasks':
        return <TasksPage />;
      case 'notes':
        return <NotesPage />;
      case 'projects':
        return <div className="text-center py-12">Projects feature coming soon</div>;
      case 'habits':
        return <div className="text-center py-12">Habits feature coming soon</div>;
      case 'journal':
        return <div className="text-center py-12">Journal feature coming soon</div>;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Navigation */}
      <DesktopNav 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <MobileHeader className="md:hidden" />

        {/* Desktop Header */}
        <header className="hidden md:flex h-16 bg-white border-b items-center justify-between px-4">
          <div className="flex items-center flex-1">
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

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-16 md:pb-6">
          {renderContent()}
        </main>

        {/* Mobile Navigation */}
        <BottomNav 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
        />
      </div>
    </div>
  );
};

export default DesktopLayout;