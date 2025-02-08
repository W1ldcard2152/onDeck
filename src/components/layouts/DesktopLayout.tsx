'use client'

import React, { useState } from 'react';
import { Search, Bell, Settings } from 'lucide-react';
import { cn } from "@/lib/utils";
import { BottomNav } from './responsiveNav/BottomNav';
import { DesktopNav } from './responsiveNav/DesktopNav';
import { MobileHeader } from './responsiveNav/MobileHeader';
import AuthUI from '@/components/Auth';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { SectionType } from './responsiveNav/types';
import DashboardPage from '@/app/dashboard/page';
import TasksPage from '@/app/tasks/page';
import NotesPage from '@/app/notes/page';

const DesktopLayout = () => {
  const { user, loading } = useSupabaseAuth();
  const [activeSection, setActiveSection] = useState<SectionType>('dashboard');

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
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Navigation - hidden on mobile */}
      <div className="hidden md:block fixed left-0 top-0 h-full">
        <DesktopNav 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
        />
      </div>

      {/* Main Content Area */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        {/* Mobile Header - visible only on mobile */}
        <MobileHeader className="md:hidden" />

        {/* Desktop Header - visible only on desktop */}
        <header className="hidden md:flex h-16 bg-white border-b items-center justify-between px-4 sticky top-0">
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
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Bell size={20} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings size={20} className="text-gray-600" />
            </button>
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 mt-16 md:mt-0 pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>

        {/* Bottom Navigation - visible only on mobile */}
        <BottomNav 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
        />
      </div>
    </div>
  );
};

export default DesktopLayout;